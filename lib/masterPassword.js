/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import {EventTarget, emit} from "./eventTarget";
import prefs, {getPref, setPref} from "./prefs";
import storage, {
  CURRENT_FORMAT, formatKey, saltKey, setPrefixCallback, hmacSecretKey, setKeyCallback,
  setHmacSecretCallback
} from "./storage";
import {getDigest, deriveKey, generateRandom, importHmacSecret} from "./crypto";
import {
  setMasterPasswordCallback, lock, isMigrating, migrateData, STORAGE_PREFIX,
  setPassword, setSite
} from "./passwords";

let rememberedMaster = null;
let useridPrefix = null;
let key = null;
let hmacSecret = null;
let lockTimer = null;
let autoLockSuspended = false;

export const userSaltKey = "usersalt";

const events = new EventTarget();
export default events;

// Expose state via callbacks to avoid circular dependencies
setMasterPasswordCallback(getMasterPassword);
setPrefixCallback(() => useridPrefix);
setKeyCallback(() => key);
setHmacSecretCallback(() => hmacSecret);

export function getState()
{
  if (isMigrating())
    return Promise.resolve("migrating");

  if (rememberedMaster)
    return Promise.resolve("known");

  return getPref(userSaltKey, null).then(value =>
  {
    return value == null ? "unset" : "set";
  });
}

export function getMasterPassword()
{
  if (!rememberedMaster)
    throw "master_password_required";

  return rememberedMaster;
}

export function getSalt()
{
  return storage.get(saltKey, null);
}

function _suspendAutoLock()
{
  if (lockTimer !== null)
    clearTimeout(lockTimer);
  lockTimer = null;
}

export function suspendAutoLock()
{
  _suspendAutoLock();
  autoLockSuspended = true;
}

function _resumeAutoLock()
{
  Promise.all([
    getPref("autolock", true),
    getPref("autolock_delay", 10)
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

export function resumeAutoLock()
{
  _suspendAutoLock();
  _resumeAutoLock();
  autoLockSuspended = false;
}

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

export function deriveKeyWithPassword(salt, masterPassword)
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
    return deriveKey({masterPassword, salt});
  });
}

function _setUserid(masterPassword)
{
  return getPref(userSaltKey, null).then((rawUserSalt) =>
  {
    if (rawUserSalt == null)
    {
      rawUserSalt = generateRandom(16);
      return setPref(userSaltKey, rawUserSalt).then(() => importHmacSecret(rawUserSalt));
    }
    return importHmacSecret(rawUserSalt);
  }).then((userSalt) =>
  {
    return getDigest(userSalt, masterPassword);
  }).then((digest) =>
  {
    useridPrefix = `user:${digest}/`;
  });
}

export function changePassword(masterPassword)
{
  return _setUserid(masterPassword).then(() =>
  {
    return storage.has(saltKey);
  }).then((hasSalt) =>
  {
    if (hasSalt)
      return checkPassword(masterPassword);

    let salt = generateRandom(16);
    return deriveKeyWithPassword(salt, masterPassword).then((newKey) =>
    {
      let rawHmacSecret = generateRandom(32);
      return Promise.all([
        newKey,
        importHmacSecret(rawHmacSecret),
        storage.set(formatKey, CURRENT_FORMAT, null),
        storage.set(saltKey, salt, null),
        storage.set(hmacSecretKey, rawHmacSecret, newKey)
      ]);
    }).then(([newKey, newHmacSecret]) =>
    {
      rememberedMaster = masterPassword;
      key = newKey;
      hmacSecret = newHmacSecret;
    }).then(emit(events, "passwordChanged"));
  });
}

export function checkPassword(masterPassword)
{
  let needsMigrating = false;

  return _setUserid(masterPassword).then(() =>
  {
    return Promise.all([
      storage.get(formatKey, null),
      storage.get(saltKey, null)
    ]);
  }).then(([format, salt]) =>
  {
    if (format && format != CURRENT_FORMAT)
      return Promise.reject();
    if (!format)
      needsMigrating = true;

    if (!salt)
      return Promise.reject();

    return deriveKeyWithPassword(salt, masterPassword);
  }).then(newKey =>
  {
    return storage.get(hmacSecretKey, newKey).then(rawHmacSecret =>
    {
      return importHmacSecret(rawHmacSecret);
    }).then(newHmacSecret =>
    {
      rememberedMaster = masterPassword;
      key = newKey;
      hmacSecret = newHmacSecret;

      if (needsMigrating)
      {
        migrateData(masterPassword).catch(e => console.error(e));
        throw "migrating";
      }
    }).then(emit(events, "passwordChanged"));
  }).catch(e =>
  {
    if (e == "migrating")
      throw e;
    useridPrefix = null;
    throw "declined";
  });
}

export function forgetPassword()
{
  rememberedMaster = null;
  key = null;
  hmacSecret = null;
  useridPrefix = null;
  return emit(events, "passwordCleared");
}

export function rekey(salt, rawHmacSecret, newKey)
{
  return storage.getAllByPrefix(STORAGE_PREFIX).then(entries =>
  {
    return Promise.all([
      entries,
      importHmacSecret(rawHmacSecret),
      storage.set(saltKey, salt, null),
      storage.set(hmacSecretKey, rawHmacSecret, newKey),
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
        actions.push(setPassword(value));
      else
        actions.push(setSite(value));
    }
    return Promise.all(actions);
  });
}
