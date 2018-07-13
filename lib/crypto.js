/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

/* global crypto, TextEncoder, TextDecoder, atob, btoa, Worker */

let {toTypedArray} = require("./typedArrayConversion");

const AES_KEY_SIZE = 256;

// I, l, O, 0, 1 excluded because of potential confusion. ", ', \ excluded
// because of common bugs in web interfaces (magic quotes).
const LOWERCASE = "abcdefghjkmnpqrstuvwxyz";
const UPPERCASE = "ABCDEFGHJKMNPQRSTUVWXYZ";
const NUMBER = "23456789";
const SYMBOL = "!#$%&()*+,-./:;<=>?@[]^_{|}~";

let encoder = new TextEncoder("utf-8");
let decoder = new TextDecoder("utf-8");

let maxJobId = 0;
let scryptWorker = null;
let pbkdf2Worker = null;

function deriveBits(password, salt, length)
{
  return new Promise((resolve, reject) =>
  {
    if (!scryptWorker)
      scryptWorker = new Worker(require("./browserAPI").runtime.getURL("data/scrypt.js"));

    let currentJobId = ++maxJobId;
    let messageCallback = ({data: {jobId, result}}) =>
    {
      if (jobId != currentJobId)
        return;
      cleanup();
      resolve(toTypedArray(result));
    };
    let errorCallback = () =>
    {
      cleanup();

      // The worker is probably in a bad state, create a new one next time.
      scryptWorker = null;

      reject("worker-error");
    };
    let cleanup = () =>
    {
      scryptWorker.removeEventListener("message", messageCallback);
      scryptWorker.removeEventListener("error", errorCallback);
    };

    scryptWorker.addEventListener("message", messageCallback);
    scryptWorker.addEventListener("error", errorCallback);
    scryptWorker.postMessage({
      jobId: currentJobId,
      password: encoder.encode(password),
      salt: encoder.encode(salt),
      length: parseInt(length, 10)
    });
  });
}

function deriveBitsLegacy(password, salt, length)
{
  return new Promise((resolve, reject) =>
  {
    if (!pbkdf2Worker)
      pbkdf2Worker = new Worker(require("./browserAPI").runtime.getURL("data/pbkdf2.js"));

    let currentJobId = ++maxJobId;
    let messageCallback = ({data: {jobId, result}}) =>
    {
      if (jobId != currentJobId)
        return;
      cleanup();
      resolve(toTypedArray(result));
    };
    let errorCallback = () =>
    {
      cleanup();

      // The worker is probably in a bad state, create a new one next time.
      pbkdf2Worker = null;

      reject("worker-error");
    };
    let cleanup = () =>
    {
      pbkdf2Worker.removeEventListener("message", messageCallback);
      pbkdf2Worker.removeEventListener("error", errorCallback);
    };

    pbkdf2Worker.addEventListener("message", messageCallback);
    pbkdf2Worker.addEventListener("error", errorCallback);
    pbkdf2Worker.postMessage({
      jobId: currentJobId,
      password: encoder.encode(password),
      // Reserve 4 bytes at the end of the salt, PBKDF2 will need them
      salt: encoder.encode(salt + "    "),
      length: parseInt(length, 10)
    });
  });
}

function deriveKeyLegacy(password, salt, usage)
{
  return deriveBitsLegacy(password, salt, AES_KEY_SIZE / 8).then(array =>
  {
    return crypto.subtle.importKey(
      "raw",
      array,
      "AES-CBC",
      false,
      [usage]
    );
  });
}

exports.derivePassword = function(params)
{
  let salt = params.domain + "\0" + params.name;
  if (params.revision)
    salt += "\0" + params.revision;

  return Promise.resolve().then(() =>
  {
    return deriveBits(params.masterPassword, salt, params.length);
  }).then(array =>
  {
    return toPassword(array, params.lower, params.upper, params.number, params.symbol);
  });
};

exports.deriveKey = function(params)
{
  return Promise.resolve().then(() =>
  {
    return deriveBits(params.masterPassword, atob(params.salt), AES_KEY_SIZE / 8);
  }).then(array =>
  {
    return crypto.subtle.importKey(
      "raw", array, "AES-GCM", false, ["encrypt", "decrypt"]
    );
  });
};

exports.encryptData = function(key, plaintext)
{
  return Promise.resolve().then(() =>
  {
    let initializationVector = new Uint8Array(12);
    crypto.getRandomValues(initializationVector);

    return Promise.all([initializationVector, crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: initializationVector,
        tagLength: 128
      },
      key,
      encoder.encode(plaintext)
    )]);
  }).then(([initializationVector, buffer]) =>
  {
    let array = new Uint8Array(buffer);
    let result = [];
    for (let i = 0; i < array.length; i++)
      result.push(String.fromCharCode(array[i]));

    return toBase64(initializationVector) + "_" + toBase64(buffer);
  });
};

exports.decryptData = function(key, ciphertext)
{
  return Promise.resolve().then(() =>
  {
    let [initializationVector, data] = ciphertext.split("_", 2).map(fromBase64);

    return crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: initializationVector,
        tagLength: 128
      },
      key,
      data
    );
  }).then(buffer =>
  {
    return decoder.decode(buffer);
  });
};

exports.generateRandom = function(length)
{
  let array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return toBase64(array);
};

exports.importHmacSecret = function(rawSecret)
{
  return Promise.resolve().then(() =>
  {
    return crypto.subtle.importKey(
      "raw",
      fromBase64(rawSecret),
      {name: "HMAC", hash: "SHA-256"},
      false,
      ["sign"]
    );
  });
};

exports.getDigest = function(hmacSecret, data)
{
  return Promise.resolve().then(() =>
  {
    // Edge will fail if data is empty, see https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/7919579/
    if (!data)
      return new Uint8Array(0);

    return crypto.subtle.sign(
      {name: "HMAC", hash: "SHA-256"},
      hmacSecret,
      encoder.encode(data)
    );
  }).then(signature =>
  {
    return toBase64(signature);
  });
};

exports.getSimpleDigest = function(data)
{
  return crypto.subtle.digest("SHA-256", encoder.encode(data)).then(hash =>
  {
    return toBase64(hash);
  });
};

exports.derivePasswordLegacy = function(params)
{
  let salt = params.domain + "\0" + params.name;
  if (params.revision)
    salt += "\0" + params.revision;

  return Promise.resolve().then(() =>
  {
    return deriveBitsLegacy(params.masterPassword, salt, params.length);
  }).then(array =>
  {
    return toPassword(array, params.lower, params.upper, params.number, params.symbol);
  });
};

exports.decryptPasswordLegacy = function(params)
{
  let salt = params.domain + "\0" + params.name;
  return Promise.resolve().then(() =>
  {
    return deriveKeyLegacy(params.masterPassword, salt, "decrypt");
  }).then(key =>
  {
    let [initializationVector, password] = params.encrypted.split("_", 2).map(fromBase64);

    return crypto.subtle.decrypt(
      {"name": "AES-CBC", iv: initializationVector},
      key,
      password
    ).catch(e =>
    {
      console.error(e);
      throw "decryption_failure";
    });
  }).then(buffer =>
  {
    return decoder.decode(buffer);
  });
};

function toPassword(array, lower, upper, number, symbol)
{
  let charsets = [];
  if (lower)
    charsets.push(LOWERCASE);
  if (upper)
    charsets.push(UPPERCASE);
  if (number)
    charsets.push(NUMBER);
  if (symbol)
    charsets.push(SYMBOL);

  let lengthSum = (previous, current) => previous + current.length;
  let numChars = charsets.reduce(lengthSum, 0);
  let seen = new Set();

  let result = [];
  for (let i = 0; i < array.length; i++)
  {
    if (charsets.length - seen.size >= array.length - i)
    {
      for (let value of seen.values())
      {
        let index = charsets.indexOf(value);
        if (index >= 0)
          charsets.splice(index, 1);
      }
      seen.clear();
      numChars = charsets.reduce(lengthSum, 0);
    }

    let index = array[i] % numChars;
    for (let charset of charsets)
    {
      if (index < charset.length)
      {
        result.push(charset[index]);
        seen.add(charset);
        break;
      }
      index -= charset.length;
    }
  }
  return result.join("");
}

let pearsonHashPermutations = null;

function pearsonHash(buffer, start, len, virtualByte)
{
  if (!pearsonHashPermutations)
  {
    pearsonHashPermutations = new Array(256);
    for (let i = 0; i < pearsonHashPermutations.length; i++)
      pearsonHashPermutations[i] = ((i + 379) * 467) & 0xFF;
  }

  let hash = pearsonHashPermutations[virtualByte];
  for (let i = start; i < start + len; i++)
    hash = pearsonHashPermutations[hash ^ buffer[i]];
  return hash;
}
exports.pearsonHash = pearsonHash;

function toBase64(buffer)
{
  let array = new Uint8Array(buffer);
  let result = [];
  for (let i = 0; i < array.length; i++)
    result.push(String.fromCharCode(array[i]));

  return btoa(result.join(""));
}
exports.toBase64 = toBase64;

function fromBase64(string)
{
  let decoded = atob(string);
  let result = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++)
    result[i] = decoded.charCodeAt(i);

  return result;
}
exports.fromBase64 = fromBase64;

// Our Base32 variant follows RFC 4648 but uses a custom alphabet to remove
// ambiguous characters: 0, 1, O, I.
const base32Alphabet = exports.base32Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function toBase32(buffer)
{
  let pos = 0;
  let current = 0;
  let currentBits = 0;
  let result = [];
  while (pos < buffer.length || currentBits >= 5)
  {
    if (currentBits < 5)
    {
      current = (current << 8) | buffer[pos++];
      currentBits += 8;
    }

    let remainder = currentBits - 5;
    result.push(base32Alphabet[current >> remainder]);
    current &= ~(31 << remainder);
    currentBits = remainder;
  }

  // Our input is always padded, so there should never be data left here
  if (currentBits)
    throw new Error("Unexpected: length of data encoded to base32 has to be a multiple of five");

  return result.join("");
}
exports.toBase32 = toBase32;

function fromBase32(str)
{
  str = str.replace(new RegExp(`[^${base32Alphabet}]`, "g"), "").toUpperCase();
  if (str.length % 8)
    throw new Error("Unexpected: length of data decoded from base32 has to be a multiple of eight");

  let mapping = new Map();
  for (let i = 0; i < base32Alphabet.length; i++)
    mapping.set(base32Alphabet[i], i);

  let pos = 0;
  let current = 0;
  let currentBits = 0;
  let result = new Uint8Array(str.length / 8 * 5);
  for (let i = 0; i < str.length; i++)
  {
    current = (current << 5) | mapping.get(str[i]);
    currentBits += 5;
    if (currentBits >= 8)
    {
      let remainder = currentBits - 8;
      result[pos++] = current >> remainder;
      current &= ~(31 << remainder);
      currentBits = remainder;
    }
  }
  return result;
}
exports.fromBase32 = fromBase32;
