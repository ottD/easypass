/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let fs = require("fs");
let path = require("path");
let spawn = require("child_process").spawn;
let Transform = require("stream").Transform;

let RSA = require("node-rsa");

exports.readArg = function(prefix, defaultValue)
{
  for (let arg of process.argv)
    if (arg.startsWith(prefix))
      return arg.substr(prefix.length);
  return defaultValue;
};

function transform(modifier, opts)
{
  if (!opts)
    opts = {};

  let stream = new Transform({objectMode: true});
  stream._transform = function(file, encoding, callback)
  {
    if (!file.isBuffer())
      throw new Error("Unexpected file type");

    if (opts.files && opts.files.indexOf(file.path) < 0)
    {
      callback(null, file);
      return;
    }

    Promise.resolve().then(() =>
    {
      let contents = opts.raw ? file.contents : file.contents.toString("utf-8");
      return modifier(file.path, contents);
    }).then(([filepath, contents]) =>
    {
      file.path = filepath;
      file.contents = Buffer.from(contents, "utf-8");
      callback(null, file);
    }).catch(e =>
    {
      console.error(e);
      callback(e);
    });
  };
  return stream;
}
exports.transform = transform;

exports.jsonModify = function(modifier, newName)
{
  return transform((filepath, contents) =>
  {
    let data = JSON.parse(contents);
    data = modifier(data) || data;
    if (newName)
      filepath = path.resolve(filepath, "..", newName);
    return [filepath, JSON.stringify(data, null, 2)];
  });
};

exports.signCRX = function(keyFile)
{
  return transform((filepath, contents) =>
  {
    return new Promise((resolve, reject) =>
    {
      fs.readFile(keyFile, function(error, data)
      {
        if (error)
          reject(error);
        else
          resolve(data);
      });
    }).then(keyData =>
    {
      let privateKey = RSA(keyData, {signingScheme: "pkcs1-sha1"});
      let publicKey = privateKey.exportKey("pkcs8-public-der");
      let signature = privateKey.sign(contents, "buffer");

      let header = Buffer.alloc(16);
      header.write("Cr24", 0);
      header.writeInt32LE(2, 4);
      header.writeInt32LE(publicKey.length, 8);
      header.writeInt32LE(signature.length, 12);
      return Buffer.concat([header, publicKey, signature, contents]);
    }).then(contents =>
    {
      return [filepath.replace(/\.zip$/, ".crx"), contents];
    });
  }, {raw: true});
};

exports.toChromeLocale = function()
{
  let parser = require("properties-parser");
  return transform((filepath, contents) =>
  {
    let properties = parser.parse(contents);
    let data = {};
    for (let key of Object.keys(properties))
      data[key] = {message: properties[key]};

    let locale = path.basename(filepath, ".properties");
    let manifest = require("./package.json");
    data.name = {"message": manifest.title};
    data.description = {"message": manifest.description};
    if ("locales" in manifest && locale in manifest.locales)
    {
      let localized = manifest.locales[locale];
      if ("title" in localized)
        data.name.message = localized.title;
      if ("description" in localized)
        data.description.message = localized.description;
    }

    return [
      path.join(path.dirname(filepath), locale.replace(/-/g, "_"), "messages.json"),
      JSON.stringify(data, null, 2)
    ];
  });
};

exports.runTests = function()
{
  function escape_string(str)
  {
    return str.replace(/(["'\\])/g, "\\$1");
  }

  function* readdir(dir, prefix = "")
  {
    for (let file of fs.readdirSync(dir))
    {
      let stats = fs.statSync(path.join(dir, file));
      if (stats.isDirectory())
        yield* readdir(path.join(dir, file), prefix + file + "/");
      else if (path.extname(file) == ".js")
        yield prefix + file;
    }
  }

  function rewriteRequires(source)
  {
    let modules = new Map();
    for (let file of readdir("test-lib"))
      modules.set(file.replace(/\.js$/, ""), path.resolve("test-lib", file));
    return source.replace(/(\brequire\(["'])\.\/([^"']+)/g, (match, prefix, request) =>
    {
      if (modules.has(request))
        return prefix + escape_string(modules.get(request));
      else
        return match;
    });
  }

  let {TextEncoder, TextDecoder} = require("text-encoding");

  class WorkerEventTarget
  {
    constructor(other)
    {
      if (other)
      {
        this.other = other;
        this.other.other = this;
      }
      let listeners = [];

      this.addEventListener = (type, listener) =>
      {
        if (type != "message")
          return;
        listeners.push(listener);
      };
      this.removeEventListener = (type, listener) =>
      {
        if (type != "message")
          return;
        let index = listeners.indexOf(listener);
        if (index >= 0)
          listeners.splice(index, 1);
      };
      this.onmessage = null;

      this.triggerListeners = function(data)
      {
        let event = {type: "message", data};
        if (typeof this.onmessage == "function")
          this.onmessage(event);
        for (let listener of listeners)
          listener(event);
      };

      this.postMessage = data =>
      {
        Promise.resolve().then(() =>
        {
          this.other.triggerListeners(data);
        });
      };
    }
  }

  class FakeWorker extends WorkerEventTarget
  {
    constructor(url)
    {
      super();

      require("sandboxed-module").require(url, {
        globals: {
          self: new WorkerEventTarget(this)
        }
      });
    }
  }

  let crypto = require("./test-lib/fake-crypto");
  let atob = str => Buffer.from(str, "base64").toString("binary");
  let btoa = str => Buffer.from(str, "binary").toString("base64");
  let {URL} = require("url");

  let nodeunit = require("sandboxed-module").require("nodeunit", {
    sourceTransformers: {rewriteRequires},
    globals: {
      TextEncoder, TextDecoder, crypto, atob, btoa, URL,
      Worker: FakeWorker,
      navigator: {
        onLine: true
      }
    }
  });
  let reporter = nodeunit.reporters.default;

  return transform((filepath, contents) =>
  {
    return new Promise((resolve, reject) =>
    {
      reporter.run([filepath], null, error =>
      {
        if (error)
          reject(error);
        else
          resolve([filepath, contents]);
      });
    });
  });
};
