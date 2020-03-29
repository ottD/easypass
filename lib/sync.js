/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import {importHmacSecret, getDigest, generateRandom} from "./crypto";
import {EventTarget, emit} from "./eventTarget";
import masterPassword, {
  deriveKeyWithPassword, rekey
} from "./masterPassword";
import {
  exportPasswordData, lock, STORAGE_PREFIX as passwordsPrefix
} from "./passwords";
import storage, {saltKey, hmacSecretKey, decrypt} from "./storage";
import * as dropboxProvider from "./sync-providers/dropbox";
import * as gdriveProvider from "./sync-providers/gdrive";
import * as remotestorageProvider from "./sync-providers/remotestorage";

const MAX_RETRIES = 5;

const MILLIS_IN_SECOND = 1000;
const MILLIS_IN_MINUTE = 60 * MILLIS_IN_SECOND;
const MILLIS_IN_HOUR = 60 * MILLIS_IN_MINUTE;

const events = EventTarget();
export default events;

function getProvider(provider)
{
  if (provider == "dropbox")
    return dropboxProvider;
  else if (provider == "gdrive")
    return gdriveProvider;
  else if (provider == "remotestorage")
    return remotestorageProvider;
  else
    throw new Error("Unknown sync provider");
}

let tracker = {
  enabled: false,
  prefix: "sync:",
  override: false,

  onModified(key)
  {
    if (this.override || !key.startsWith(passwordsPrefix))
      return Promise.resolve();

    return storage.set(this.prefix + key, true, null);
  },

  enable(startUp)
  {
    if (this.enabled)
      return Promise.resolve();

    this.enabled = true;
    let waitFor;
    if (startUp)
    {
      storage.on("set", this.onModified);
      storage.on("delete", this.onModified);
      return Promise.resolve();
    }
    else
    {
      return storage.getAllByPrefix(passwordsPrefix, null).then(items =>
      {
        storage.on("set", this.onModified);
        storage.on("delete", this.onModified);
        let actions = [];
        for (let key in items)
          actions.push(storage.set(this.prefix + key, true, null));
        return Promise.all(actions);
      });
    }
  },

  disable()
  {
    if (!this.enabled)
      return Promise.resolve();

    storage.off("set", this.onModified);
    storage.off("delete", this.onModified);
    this.enabled = false;
    return this.clearModifiedKeys();
  },

  getModifiedKeys()
  {
    return storage.getAllByPrefix(this.prefix, null).then(items =>
    {
      return new Set(Object.keys(items).map(key => key.substr(this.prefix.length)));
    });
  },

  clearModifiedKeys()
  {
    return storage.deleteByPrefix(this.prefix);
  }
};
tracker.onModified = tracker.onModified.bind(tracker);

let engine = {
  storageKey: "syncData",
  secretKey: "sync-secret",
  checkInterval: 10 * MILLIS_IN_MINUTE,
  syncInterval: MILLIS_IN_HOUR,
  data: null,
  currentSync: null,
  _timeout: null,

  init()
  {
    storage.get(this.storageKey, null).then(value =>
    {
      this.data = value;
      if (this.data)
      {
        tracker.enable(true);
        this._start();
        throw "not_implemented";
      }
      emit(events, "dataModified");
    });
  },

  _start()
  {
    this._stop();

    this._timeout = setInterval(this._check, this.checkInterval);
    this._check();
  },

  _stop()
  {
    if (this._timeout !== null)
      clearTimeout(this._timeout);
    this._timeout = null;
  },

  _check()
  {
    let now = Date.now();
    if (!this.data.lastSync || this.data.lastSync > now || now - this.data.lastSync >= this.syncInterval)
      this.sync();
  },

  _rekey(data, nestingLevel)
  {
    return deriveKeyWithPassword(data[saltKey]).then(decryptionKey =>
    {
      return Promise.all([
        decryptionKey,
        decrypt(data[hmacSecretKey], decryptionKey)
      ]);
    }).catch(error =>
    {
      console.error(error);
      throw "sync_wrong_master_password";
    }).then(([decryptionKey, hmacSecret]) =>
    {
      return rekey(
        data[saltKey],
        hmacSecret,
        decryptionKey
      );
    }).then(() =>
    {
      return this.sync(nestingLevel + 1);
    });
  },

  _calculateSignature(data, revision, rawSecret)
  {
    let values = [revision];
    let keys = Object.keys(data);
    keys.sort();
    for (let key of keys)
      values.push([key, data[key]]);
    return importHmacSecret(rawSecret).then(secret =>
    {
      return getDigest(secret, JSON.stringify(values));
    });
  },

  _validateSignature(data, revision, rawSecret, expectedSignature)
  {
    return this._calculateSignature(data, revision, rawSecret).then(signature =>
    {
      if (signature != expectedSignature)
        throw "sync_tampered_data";
    });
  },

  sync(nestingLevel = 0)
  {
    if (!nestingLevel && this.currentSync)
      return this.currentSync;

    if (!navigator.onLine)
    {
      this.data.error = "sync_connection_error";
      emit(events, "dataModified");
      return storage.set(this.storageKey, this.data, null);
    }

    const path = "/passwords.json";
    let {provider, token, username} = this.data;

    let action = (nestingLevel ? Promise.resolve() : lock.acquire()).then(() =>
    {
      return Promise.all([
        getProvider(provider).get(path, token, username),
        exportPasswordData([this.secretKey])
      ]);
    }).then(([remoteData, localData]) =>
    {
      let local = JSON.parse(localData);
      if (!remoteData)
        return Promise.resolve([null, null, local, null]);

      let remote;
      try
      {
        remote = JSON.parse(remoteData.contents);
      }
      catch (e)
      {
        throw "sync_unknown_data_format";
      }

      if (!remote || typeof remote != "object" ||
          remote.application != local.application ||
          (remote.format != 2 && remote.format != 3) ||
          !remote.data || typeof remote.data != "object" ||
          typeof remote.data[saltKey] != "string" ||
          typeof remote.data[hmacSecretKey] != "string")
      {
        throw "sync_unknown_data_format";
      }

      if (remote.data[saltKey] != local.data[saltKey])
      {
        throw {
          toString()
          {
            return "rekey_required";
          },
          data: remote.data
        };
      }

      if (local.data[this.secretKey] && local.data[this.secretKey] != remote.data[this.secretKey])
        throw "sync_unrelated_client";

      let validation = Promise.resolve();
      if (remote.data[this.secretKey])
      {
        if (typeof remote.revision != "number" || remote.revision <= 0 || typeof remote.signature != "string")
          throw "sync_unknown_data_format";

        if (this.data.revision && remote.revision < this.data.revision)
          throw "sync_tampered_data";

        if (this.data.secret)
          validation = validation.then(() => this.data.secret);
        else
          validation = validation.then(() => decrypt(remote.data[this.secretKey]));

        validation = validation.then(secret =>
        {
          return Promise.all([
            secret,
            this._validateSignature(remote.data, remote.revision, secret, remote.signature)
          ]);
        }).then(([secret]) =>
        {
          this.data.secret = secret;
          this.data.revision = remote.revision;
          emit(events, "dataModified");
          return storage.set(this.storageKey, this.data, null);
        });
      }

      return validation.then(() =>
      {
        return Promise.all([
          remote,
          remoteData.revision,
          local,
          tracker.getModifiedKeys()
        ]);
      });
    }).then(([remote, fileRevision, local, modifiedKeys]) =>
    {
      let modified = !remote;
      let additions = [];
      let removals = [];
      if (remote)
      {
        for (let key of Object.keys(remote.data))
        {
          if (!modifiedKeys.has(key))
          {
            local.data[key] = remote.data[key];
            additions.push([key, local.data[key]]);
          }
          else if (local.data[key] != remote.data[key])
            modified = true;
        }

        for (let key of Object.keys(local.data))
        {
          if (!remote.data.hasOwnProperty(key))
          {
            if (!modifiedKeys.has(key))
            {
              delete local.data[key];
              removals.push(key);
            }
            else
              modified = true;
          }
        }
      }

      let updateAction = Promise.resolve();
      if (modified)
      {
        local.revision = (this.data.revision || 0) + 1;
        if (!this.data.secret)
        {
          updateAction = updateAction.then(() =>
          {
            this.data.secret = generateRandom(32);
            return storage.set(this.secretKey, this.data.secret);
          }).then(() =>
          {
            return storage.get(this.secretKey, null);
          }).then(encrypted =>
          {
            local.data[this.secretKey] = encrypted;
          });
        }

        updateAction = updateAction.then(() =>
        {
          return this._calculateSignature(local.data, local.revision, this.data.secret);
        }).then(signature =>
        {
          local.signature = signature;
          return getProvider(provider).put(path, JSON.stringify(local), fileRevision, token, username);
        }).then(() =>
        {
          this.data.revision = local.revision;
          emit(events, "dataModified");
          storage.set(this.storageKey, this.data, null);
        });
      }

      return Promise.all([
        additions,
        removals,
        updateAction
      ]);
    }).then(([additions, removals, _]) =>
    {
      tracker.override = true;
      let actions = [tracker.clearModifiedKeys()];
      for (let [key, value] of additions)
        actions.push(storage.set(key, value, null));
      if (removals.length)
        actions.push(storage.delete(removals));

      return Promise.all(actions);
    }).catch(e =>
    {
      if (e == "rekey_required")
        return this._rekey(e.data, nestingLevel);
      else if (e == "master_password_required")
        return this._reportError("sync_master_password_required");
      else if (e == "sync_wrong_revision")
      {
        // Remote revision changed, retry sync
        if (nestingLevel < MAX_RETRIES)
          return this.sync(nestingLevel + 1);
        else
          return this._reportError("sync_too_many_retries");
      }
      else
        return this._reportError(e);
    }).finally(() =>
    {
      let actions = null;
      if (this.data)
      {
        this.data.lastSync = Date.now();
        action = storage.set(this.storageKey, this.data, null);
      }

      if (!nestingLevel)
      {
        tracker.override = false;
        this.currentSync = null;

        emit(events, "dataModified");
        lock.release();
      }
      return action;
    });

    if (!nestingLevel)
      this.currentSync = action;

    delete this.data.error;
    emit(events, "dataModified");
    return Promise.all([
      action,
      storage.set(this.storageKey, this.data, null)
    ]);
  },

  _reportError(e)
  {
    if (!this.data)
      return Promise.resolve();

    this.data.error = String(e);
    if (typeof e != "string")
      console.error(e);
    emit(events, "dataModified");
    return storage.set(this.storageKey, this.data, null);
  },

  _changingPassword(noLock)
  {
    // Disable sync before clearing data, otherwise it will create change
    // entries for everything removed.
    this.disable(noLock);
  },

  setup(provider, token, username)
  {
    return lock.acquire().then(() =>
    {
      return tracker.enable();
    }).then(() =>
    {
      this.data = {provider, token, username};
      emit(events, "dataModified");
      this._start();
      masterPassword.on("changingPassword", this._changingPassword);
      return storage.set(this.storageKey, this.data, null);
    }).finally(() => lock.release());
  },

  disable(noLock)
  {
    if (!this.data)
      return Promise.resolve();

    return (noLock ? Promise.resolve() : lock.acquire()).then(() =>
    {
      this.data = null;
      this._stop();
      emit(events, "dataModified");
      masterPassword.off("changingPassword", this._changingPassword);
      return Promise.all([
        storage.delete(this.storageKey),
        storage.delete(this.secretKey),
        tracker.disable()
      ]);
    }).finally(() => noLock || lock.release());
  }
};
engine._changingPassword = engine._changingPassword.bind(engine);
engine._check = engine._check.bind(engine);
engine.init();

export function getSyncData()
{
  return engine.data || {};
}

export function isSyncing()
{
  return !!engine.currentSync;
}

export function authorize(provider, username)
{
  return getProvider(provider).authorize(username).then(token =>
  {
    return engine.setup(provider, token, username);
  }).catch(error =>
  {
    console.error(error);
  });
}

export function getManualAuthURL(provider, username)
{
  return getProvider(provider).getManualAuthURL(username);
}

export function manualAuthorization(provider, username, code)
{
  return getProvider(provider).processAuthCode(code).then(token =>
  {
    return engine.setup(provider, token, username);
  });
}

export function disableSync(noLock)
{
  return engine.disable(noLock);
}

export function sync()
{
  return engine.sync();
}
