/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let prefs = require("./prefs");
let storage = require("./storage");

let crypto = require("./crypto");

const saltKey = exports.saltKey = "salt";

let rememberedMaster = null;
let key = null;
let hmacSecret = null;
let lockTimer = null;
let autoLockSuspended = false;
let userId = null;
let hmacSecretKeyPrefix = "hmac";

Object.defineProperty(exports, "state", {
  enumerable: true,
  get: () =>
  {
    if (require("./passwords").isMigrating())
      return Promise.resolve("migrating");

    if (rememberedMaster)
      return Promise.resolve("known");

    return storage.has(saltKey).then(value =>
    {
      if (value)
        return "set";

      // Try legacy format
      return storage.has("masterPassword").then(value =>
      {
        return value ? "set" : "unset";
      });
    });
  }
});

exports.get = () =>
{
  if (!rememberedMaster)
    throw "master_password_required";

  return rememberedMaster;
};

exports.getSalt = () =>
{
  return storage.get(saltKey, null);
};

function getKey()
{
  if (!key)
    throw "master_password_required";

  return key;
}

exports.encrypt = (data, key, json) =>
{
  return Promise.resolve().then(() =>
  {
    if (typeof key == "undefined")
      key = getKey();

    if (!key)
      return data;

    if (json !== false)
      data = JSON.stringify(data);
    return crypto.encryptData(key, data);
  });
};

exports.decrypt = (data, key, json) =>
{
  return Promise.resolve().then(() =>
  {
    if (typeof key == "undefined")
      key = getKey();

    if (!key)
      return data;

    return crypto.decryptData(key, data).then(plaintext =>
    {
      if (json !== false)
        plaintext = JSON.parse(plaintext);
      return plaintext;
    });
  });
};

exports.getDigest = data =>
{
  if (!hmacSecret)
    return Promise.reject("master_password_required");

  return crypto.getDigest(hmacSecret, data);
};

function getUserId()
{
  if (!userId)
    throw "master_password_required";

  return userId;
}
exports.getUserId = getUserId;

function getHmacSecretKey()
{
  return hmacSecretKeyPrefix + "@" + getUserId();
}
exports.getHmacSecretKey = getHmacSecretKey;

function _suspendAutoLock()
{
  if (lockTimer !== null)
    clearTimeout(lockTimer);
  lockTimer = null;
}

function suspendAutoLock()
{
  _suspendAutoLock();
  autoLockSuspended = true;
}
exports.suspendAutoLock = suspendAutoLock;

function _resumeAutoLock()
{
  Promise.all([
    prefs.get("autolock", true),
    prefs.get("autolock_delay", 10)
  ]).then(([autolock, autolock_delay]) =>
  {
    if (autolock)
    {
      if (autolock_delay <= 0)
        forgetPassword();
      else
        lockTimer = setTimeout(forgetPassword, autolock_delay * 60 * 1000);
    }
  });
}

function resumeAutoLock()
{
  _suspendAutoLock();
  _resumeAutoLock();
  autoLockSuspended = false;
}
exports.resumeAutoLock = resumeAutoLock;

prefs.on("autolock", (name, value) =>
{
  if (value)
  {
    if (!autoLockSuspended)
      _resumeAutoLock();
  }
  else
    _suspendAutoLock();
});

function deriveKey(salt, masterPassword)
{
  return Promise.resolve().then(() =>
  {
    if (masterPassword)
      return masterPassword;
    if (rememberedMaster)
      return rememberedMaster;
    throw "master_password_required";
  }).then(masterPassword =>
  {
    return crypto.deriveKey({masterPassword, salt});
  });
}
exports.deriveKey = deriveKey;

function _getGeneratedUserId(salt, masterPassword)
{
  return crypto.getSimpleDigest(salt + masterPassword).then(enc =>
  {
    return enc.substr(0, 8);
  });
}

function changePassword(masterPassword, noLock)
{
  return storage.get(saltKey, null).then(storedSalt =>
  {
    if (!storedSalt)
      storedSalt = crypto.generateRandom(16);
    return Promise.all([
      deriveKey(storedSalt, masterPassword),
      _getGeneratedUserId(storedSalt, masterPassword),
      storage.set(saltKey, storedSalt, null)
    ]);
  }).then(([newKey, newUserId]) =>
  {
    userId = newUserId;
    return Promise.all([
      newKey,
      storage.get(getHmacSecretKey(), newKey)
    ]);
  }).then(([newKey, storedHmacSecret]) =>
  {
    if (!storedHmacSecret)
      storedHmacSecret = crypto.generateRandom(32);

    return Promise.all([
      crypto.importHmacSecret(storedHmacSecret),
      storage.set(getHmacSecretKey(), storedHmacSecret, newKey)
    ]).then(([newHmacSecret]) =>
    {
      rememberedMaster = masterPassword;
      key = newKey;
      hmacSecret = newHmacSecret;
    });
  });
}
exports.changePassword = changePassword;

function checkPassword(masterPassword)
{
  return storage.get(saltKey, null).then(salt =>
  {
    if (!salt)
    {
      // Try legacy format
      return storage.get("masterPassword", null).then(value =>
      {
        if (!value)
          return Promise.reject();

        let {hash, salt} = value;
        let params = {
          masterPassword,
          domain: "",
          name: salt,
          length: 2,
          lower: true,
          upper: false,
          number: false,
          symbol: false
        };
        return Promise.all([crypto.derivePasswordLegacy(params), hash]);
      }).then(([hash, expected]) =>
      {
        if (hash == expected)
        {
          require("./passwords").migrateData(masterPassword);
          return Promise.reject("migrating");
        }

        return Promise.reject();
      });
    }

    return Promise.all([
      deriveKey(salt, masterPassword),
      _getGeneratedUserId(salt, masterPassword)
    ]);
  }).then(([newKey, newUserId]) =>
  {
    userId = newUserId;
    return storage.get(getHmacSecretKey(), newKey).then(rawHmacSecret =>
    {
      return crypto.importHmacSecret(rawHmacSecret);
    }).then(newHmacSecret =>
    {
      rememberedMaster = masterPassword;
      key = newKey;
      hmacSecret = newHmacSecret;
    });
  }).catch(e =>
  {
    throw e == "migrating" ? e : "declined";
  });
}
exports.checkPassword = checkPassword;

function forgetPassword()
{
  userId = null;
  rememberedMaster = null;
  key = null;
  hmacSecret = null;
  return Promise.resolve();
}
exports.forgetPassword = forgetPassword;

function rekey(salt, rawHmacSecret, newKey)
{
  let passwords = require("./passwords");
  let prefix = passwords.STORAGE_PREFIX;
  return storage.getAllByPrefix(prefix).then(entries =>
  {
    return Promise.all([
      entries,
      crypto.importHmacSecret(rawHmacSecret),
      storage.set(saltKey, salt, null),
      storage.set(getHmacSecretKey(), rawHmacSecret, newKey),
      storage.delete(Object.keys(entries))
    ]);
  }).then(([entries, newHmacSecret]) =>
  {
    key = newKey;
    hmacSecret = newHmacSecret;

    let actions = [];
    for (let key in entries)
    {
      let value = entries[key];
      if (value.type)
        actions.push(passwords.setPassword(value));
      else
        actions.push(passwords.setSite(value));
    }
    return Promise.all(actions);
  });
}
exports.rekey = rekey;
