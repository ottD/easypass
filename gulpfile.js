/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let fs = require("fs");
let path = require("path");
let url = require("url");

let del = require("del");
let gulp = require("gulp");
let eslint = require("gulp-eslint");
let htmlhint = require("gulp-htmlhint");
let sass = require("gulp-sass");
let stylelint = require("gulp-stylelint");
let merge = require("merge-stream");
let request = require("request");
let zip = require("gulp-zip");
let webpack = require("webpack-stream");

let utils = require("./gulp-utils");

gulp.task("default", ["all"], function()
{
});

gulp.task("all", ["xpi", "crx", "appx", "web"], function()
{
});

function buildWorkers(targetdir)
{
  let resolveConfig = {};

  if (targetdir == "build-test/data")
  {
    resolveConfig.alias = {
      "../lib/typedArrayConversion$": path.resolve(__dirname, "test-lib", "typedArrayConversion.js")
    };
  }

  return merge(
    gulp.src(["data/pbkdf2.js"])
        .pipe(webpack({
          output: {
            filename: "pbkdf2.js",
            pathinfo: true
          },
          resolve: resolveConfig
        }))
        .pipe(gulp.dest(`${targetdir}`)),
    gulp.src(["data/scrypt.js"])
        .pipe(webpack({
          output: {
            filename: "scrypt.js",
            pathinfo: true
          },
          node: {
            process: false,
            global: false,
            setImmediate: false
          },
          resolve: resolveConfig
        }))
        .pipe(gulp.dest(`${targetdir}`))
  );
}

function buildCommon(targetdir)
{
  return merge(
    gulp.src("LICENSE.txt")
        .pipe(gulp.dest(`${targetdir}`)),
    gulp.src(["data/**/*.html", "data/**/*.png", "data/**/*.svg"])
        .pipe(gulp.dest(`${targetdir}/data`)),
    gulp.src(["data/fillIn.js"])
        .pipe(webpack({
          output: {
            filename: "fillIn.js",
            pathinfo: true
          }
        }))
        .pipe(gulp.dest(`${targetdir}/data`)),
    gulp.src(["data/platform.js", "data/panel/main.js"])
        .pipe(webpack({
          output: {
            filename: "index.js",
            pathinfo: true,
            library: "__webpack_require__"
          },
          module: {
            rules: [
              {
                test: /\/jsqr-.*?\.js$/,
                use: "imports-loader?window=>exports"
              }
            ]
          }
        }))
        .pipe(gulp.dest(`${targetdir}/data/panel`)),
    gulp.src(["data/platform.js", "data/allpasswords/main.js"])
        .pipe(webpack({
          output: {
            filename: "index.js",
            pathinfo: true,
            library: "__webpack_require__"
          }
        }))
        .pipe(gulp.dest(`${targetdir}/data/allpasswords`)),
    gulp.src(["data/platform.js", "data/options/main.js"])
        .pipe(webpack({
          output: {
            filename: "index.js",
            pathinfo: true,
            library: "__webpack_require__"
          }
        }))
        .pipe(gulp.dest(`${targetdir}/data/options`)),
    gulp.src(["data/**/*.scss"])
        .pipe(sass())
        .pipe(gulp.dest(`${targetdir}/data`)),
    gulp.src("locale/**/*.properties")
        .pipe(utils.toChromeLocale())
        .pipe(gulp.dest(`${targetdir}/_locales`)),
    gulp.src(["lib/platform.js", "lib/main.js"])
        .pipe(webpack({
          output: {
            filename: "index.js",
            pathinfo: true,
            library: "__webpack_require__"
          }
        }))
        .pipe(gulp.dest(`${targetdir}`)),
    gulp.src(["data/reloader.js"])
        .pipe(gulp.dest(`${targetdir}/data`)),
    buildWorkers(`${targetdir}/data`)
  );
}

function touchReloader(targetdir)
{
  fs.writeFileSync(path.join(targetdir, "random.json"), Math.random());
}

function removeReloader(data)
{
  let index = data.background.scripts.indexOf("data/reloader.js");
  if (index >= 0)
    data.background.scripts.splice(index, 1);
}

gulp.task("build-chrome", ["validate"], function()
{
  let stream = merge(
    buildCommon("build-chrome"),
    gulp.src("manifest.json")
        .pipe(utils.jsonModify(data =>
        {
          delete data.applications;
        }))
        .pipe(gulp.dest("build-chrome"))
  );
  stream.on("finish", () => touchReloader("build-chrome"));
  return stream;
});

gulp.task("watch-chrome", ["build-chrome"], function()
{
  gulp.watch(["*.js", "*.json", "data/**/*", "lib/**/*", "locale/**/*"], ["build-chrome"]);
});

gulp.task("build-firefox", ["validate"], function()
{
  let stream = merge(
    buildCommon("build-firefox"),
    gulp.src("manifest.json")
        .pipe(utils.jsonModify(data =>
        {
          delete data.minimum_chrome_version;
          delete data.minimum_opera_version;
          delete data.background.persistent;

          data.browser_action.browser_style = false;
        }))
        .pipe(gulp.dest("build-firefox"))
  );
  stream.on("finish", () => touchReloader("build-firefox"));
  return stream;
});

gulp.task("build-test", ["validate"], function()
{
  return buildWorkers("build-test/data");
});

gulp.task("watch-firefox", ["build-firefox"], function()
{
  gulp.watch(["*.js", "*.json", "data/**/*", "lib/**/*", "locale/**/*"], ["build-firefox"]);
});

gulp.task("build-web", ["validate"], function()
{
  let targetdir = "build-web";
  return merge(
    gulp.src("LICENSE.txt")
        .pipe(gulp.dest(`${targetdir}`)),
    gulp.src(["data/**/*.html", "data/**/*.png", "data/**/*.svg", "!data/options/options.html"])
        .pipe(gulp.dest(`${targetdir}`)),
    gulp.src(["data/platform.js", "data/panel/main.js"])
        .pipe(webpack({
          output: {
            filename: "index.js",
            pathinfo: true,
            library: "__webpack_require__"
          },
          module: {
            rules: [
              {
                test: /\/jsqr-.*?\.js$/,
                use: "imports-loader?window=>exports"
              },
              {
                test: /\.properties$/,
                use: path.resolve(__dirname, "localeLoader.js")
              },
              {
                test: /\.js$/,
                exclude: /\/zxcvbn-.*\.js$/,
                use: {
                  loader: "babel-loader",
                  options: {
                    presets: ["babel-preset-env"]
                  }
                }
              }
            ]
          },
          resolve: {
            alias: {
              "./browserAPI$": path.resolve(__dirname, "web", "data", "browserAPI.js"),
              "../browserAPI$": path.resolve(__dirname, "web", "data", "browserAPI.js"),
              "locale$": path.resolve(__dirname, "locale", "en-US.properties")
            }
          }
        }))
        .pipe(gulp.dest(`${targetdir}/panel`)),
    gulp.src(["data/platform.js", "data/allpasswords/main.js"])
        .pipe(webpack({
          output: {
            filename: "index.js",
            pathinfo: true,
            library: "__webpack_require__"
          },
          module: {
            rules: [
              {
                test: /\.properties$/,
                use: path.resolve(__dirname, "localeLoader.js")
              },
              {
                test: /\.js$/,
                use: {
                  loader: "babel-loader",
                  options: {
                    presets: ["babel-preset-env"]
                  }
                }
              }
            ]
          },
          resolve: {
            alias: {
              "./browserAPI$": path.resolve(__dirname, "web", "data", "browserAPI.js"),
              "../browserAPI$": path.resolve(__dirname, "web", "data", "browserAPI.js"),
              "locale$": path.resolve(__dirname, "locale", "en-US.properties")
            }
          }
        }))
        .pipe(gulp.dest(`${targetdir}/allpasswords`)),
    gulp.src(["data/**/*.scss", "!data/options/options.scss"])
        .pipe(sass())
        .pipe(gulp.dest(`${targetdir}`)),
    gulp.src(["lib/platform.js", "lib/main.js"])
        .pipe(webpack({
          output: {
            filename: "index.js",
            pathinfo: true,
            library: "__webpack_require__"
          },
          module: {
            rules: [
              {
                test: /\/(scrypt|pbkdf2)\.js$/,
                use: path.resolve(__dirname, "workerLoader.js")
              },
              {
                test: /\.js$/,
                use: {
                  loader: "babel-loader",
                  options: {
                    presets: ["babel-preset-env"]
                  }
                }
              }
            ]
          },
          resolve: {
            alias: {
              "./browserAPI$": path.resolve(__dirname, "web", "background", "browserAPI.js"),
              "../browserAPI$": path.resolve(__dirname, "web", "data", "browserAPI.js")
            }
          }
        }))
        .pipe(gulp.dest(`${targetdir}/background`)),
    gulp.src("web/index/index.js")
        .pipe(webpack({
          output: {
            filename: "index/index.js",
            pathinfo: true,
            library: "__webpack_require__"
          },
          module: {
            rules: [
              {
                test: /\.js$/,
                use: {
                  loader: "babel-loader",
                  options: {
                    presets: ["babel-preset-env"]
                  }
                }
              }
            ]
          }
        }))
        .pipe(gulp.dest(targetdir)),
    gulp.src("web/**/*.scss")
        .pipe(sass())
        .pipe(gulp.dest(targetdir)),
    gulp.src("web/**/*.html")
        .pipe(gulp.dest(targetdir))
  );
});

gulp.task("eslint", function()
{
  return gulp.src(["*.js", "data/**/*.js", "lib/**/*.js", "test/**/*.js",
                   "test-lib/**/*.js", "web/**/*.js",
                   "!data/panel/zxcvbn-*.js", "!data/panel/jsqr-*.js",
                   "!data/panel/formatter.js"])
             .pipe(eslint())
             .pipe(eslint.format())
             .pipe(eslint.failAfterError());
});

gulp.task("htmlhint", function()
{
  return gulp.src(["data/**/*.html"])
             .pipe(htmlhint(".htmlhintrc"))
             .pipe(htmlhint.failReporter());
});

gulp.task("stylelint", function()
{
  return gulp.src(["data/**/*.scss"])
             .pipe(stylelint({
               "failAfterError": true,
               "syntax": "scss",
               "reporters": [
                 {
                   "formatter": "string",
                   "console": true
                 }
               ]
             }));
});

gulp.task("validate", ["eslint", "htmlhint", "stylelint"], function()
{
});

gulp.task("crx", ["build-chrome"], function()
{
  let manifest = require("./manifest.json");
  let result = merge(
    gulp.src([
      "build-chrome/**",
      "!build-chrome/manifest.json", "!build-chrome/data/reloader.js", "!build-chrome/random.json",
      "!build-chrome/**/.*", "!build-chrome/**/*.zip", "!build-chrome/**/*.crx"
    ]),
    gulp.src("build-chrome/manifest.json").pipe(utils.jsonModify(removeReloader))
  ).pipe(zip("aep-" + manifest.version + ".zip"));
  let keyFile = utils.readArg("--private-key=");
  if (keyFile)
    result = result.pipe(utils.signCRX(keyFile));
  return result.pipe(gulp.dest("build-chrome"));
});

gulp.task("xpi", ["build-firefox"], function()
{
  let manifest = require("./manifest.json");
  return merge(
    gulp.src([
      "build-firefox/**",
      "!build-firefox/manifest.json", "!build-firefox/data/reloader.js", "!build-firefox/random.json",
      "!build-firefox/**/.*", "!build-firefox/**/*.xpi"
    ]),
    gulp.src("build-firefox/manifest.json").pipe(utils.jsonModify(removeReloader))
  ).pipe(zip("aep-" + manifest.version + ".xpi")).pipe(gulp.dest("build-firefox"));
});

gulp.task("build-edge", ["build-chrome"], function()
{
  let version = require("./manifest.json").version;
  while (version.split(".").length < 4)
    version += ".0";

  return merge(
    gulp.src([
      "build-chrome/**",
      "!build-chrome/manifest.json", "!build-chrome/data/reloader.js", "!build-chrome/random.json",
      "!build-chrome/**/.*", "!build-chrome/**/*.zip", "!build-chrome/**/*.crx"
    ]).pipe(gulp.dest("build-edge/extension/Extension")),
    gulp.src("build-chrome/manifest.json")
        .pipe(utils.jsonModify(removeReloader))
        .pipe(utils.jsonModify(data =>
        {
          data.browser_specific_settings = {
            edge: {
              browser_action_next_to_addressbar: true
            }
          };
        }))
        .pipe(gulp.dest("build-edge/extension/Extension")),
    gulp.src(["edge/**/*.xml", "edge/**/*.png"])
        .pipe(utils.transform((filepath, contents) =>
        {
          return [filepath, contents.replace(/{{version}}/g, version)];
        }), {files: ["appxmanifest.xml"]})
        .pipe(gulp.dest("build-edge/extension")),
    gulp.src("package.json")
        .pipe(utils.jsonModify(data =>
        {
          return {
            "DisplayName": data.title,
            "_DisplayName.comment": "",
            "Description": data.description,
            "_Description.comment": ""
          };
        }, "resources.resjson"))
        .pipe(gulp.dest("build-edge/extension/Resources/en-us"))
  );
});

gulp.task("build-edge/extension.zip", ["build-edge"], function()
{
  return gulp.src([
    "build-edge/**",
    "!build-edge/**/*.zip", "!build-edge/**/*.appx"
  ]).pipe(zip("extension.zip")).pipe(gulp.dest("build-edge"));
});

gulp.task("appx", ["build-edge/extension.zip"], function(callback)
{
  const endpoint = "https://cloudappx.azurewebsites.net/v3/build";
  let req = request.post({
    url: endpoint,
    encoding: null
  }, (err, response, responseBody) =>
  {
    if (err)
    {
      callback(err);
      return;
    }

    if (response.statusCode != 200)
    {
      callback(new Error(`Calling CloudAppX service failed: ${response.statusCode} ${response.statusMessage} (${responseBody})`));
      return;
    }

    let manifest = require("./manifest.json");
    fs.writeFile("build-edge/aep-" + manifest.version  + ".appx", responseBody, callback);
  });

  req.form().append("xml", fs.createReadStream("build-edge/extension.zip"));
});

gulp.task("web", ["build-web"], function()
{
  let manifest = require("./manifest.json");
  gulp.src([
    "build-web/**",
    "!build-web/**/.*", "!build-web/**/*.zip"
  ]).pipe(zip("aep-web-" + manifest.version + ".zip")).pipe(gulp.dest("build-web"));
});

gulp.task("test", ["validate", "build-test"], function()
{
  let testFile = utils.readArg("--test=");
  if (!testFile)
    testFile = "**/*.js";
  else if (!testFile.endsWith(".js"))
    testFile += ".js";

  return gulp.src("test/" + testFile)
             .pipe(utils.runTests());
});

gulp.task("clean", function()
{
  return del(["build-chrome", "build-firefox", "build-edge", "build-test", "build-web"]);
});
