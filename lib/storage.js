/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

import browser from "./browserAPI";
import {deriveKey, encryptData, decryptData, getDigest} from "./crypto";
import {EventTarget, emit} from "./eventTarget";

export const CURRENT_FORMAT = 3;
export const formatKey = "format";
export const saltKey = "salt";
export const hmacSecretKey = "hmac-secret";
export const prefsPrefix = "pref:";

let keyCallback = null;
export function setKeyCallback(callback)
{
  keyCallback = callback;
}

let hmacSecretCallback = null;
export function setHmacSecretCallback(callback)
{
  hmacSecretCallback = callback;
}

let prefixCallback = null;
export function setPrefixCallback(callback)
{
  prefixCallback = callback;
}

function addPrefix(name)
{
  if (name.substring(0, prefsPrefix.length) === prefsPrefix)
    return name;
  let prefix = prefixCallback();
  if (prefix == null)
    throw "master_password_required";
  return prefix + name;
}

function removePrefix(name)
{
  if (name.substring(0, prefsPrefix.length) === prefsPrefix)
    return name;
  let prefix = prefixCallback();
  if (prefix == null)
    throw "master_password_required";
  if (name.substring(0, prefix.length) === prefix)
    return name.substring(prefix.length);
  throw "invalid_prefix";
}

function getKey()
{
  let key = keyCallback && keyCallback();
  if (!key)
    throw "master_password_required";

  return key;
}

export function encrypt(data, key, json)
{
  return Promise.resolve().then(() =>
  {
    if (typeof key == "undefined")
      key = getKey();

    if (!key)
      return data;

    if (json !== false)
      data = JSON.stringify(data);
    return encryptData(key, data);
  });
}

export function decrypt(data, key, json)
{
  return Promise.resolve().then(() =>
  {
    if (typeof key == "undefined")
      key = getKey();

    if (!key)
      return data;

    return decryptData(key, data).then(plaintext =>
    {
      if (json !== false)
        plaintext = JSON.parse(plaintext);
      return plaintext;
    });
  });
}

export function nameToStorageKey(data)
{
  let hmacSecret = hmacSecretCallback && hmacSecretCallback();
  if (!hmacSecret)
    return Promise.reject("master_password_required");

  return getDigest(hmacSecret, data);
}

function has(name)
{
  name = addPrefix(name);
  return browser.storage.local.get(name).then(items =>
  {
    return items.hasOwnProperty(name);
  });
}

function hasPrefix(prefix)
{
  prefix = addPrefix(prefix);
  return browser.storage.local.get(null).then(items =>
  {
    return Object.keys(items).some(name => name.startsWith(prefix));
  });
}

function get(name, key)
{
  name = addPrefix(name);
  return browser.storage.local.get(name).then(items =>
  {
    if (!items.hasOwnProperty(name))
      return undefined;

    return decrypt(items[name], key);
  });
}

function getAllByPrefix(prefix, key)
{
  prefix = addPrefix(prefix);
  return browser.storage.local.get(null).then(items =>
  {
    let result = {};
    let names = Object.keys(items).filter(name => name.startsWith(prefix) && !name.startsWith(prefsPrefix));
    let decryptNextName = () =>
    {
      if (!names.length)
        return result;

      let name = names.pop();
      let realname = removePrefix(name);
      return decrypt(items[name], key).then(plaintext =>
      {
        result[realname] = plaintext;
        return decryptNextName();
      });
    };
    return decryptNextName();
  });
}

function set(name, value, key)
{
  let keyname = addPrefix(name);
  return encrypt(value, key).then(ciphertext =>
  {
    return browser.storage.local.set({[keyname]: ciphertext});
  }).then(() =>
  {
    return emit(storage, "set", name);
  });
}

function delete_(name)
{
  let keynames = Array.isArray(name) ? name.map(addPrefix) : addPrefix(name);
  return browser.storage.local.remove(keynames).then(() =>
  {
    if (Array.isArray(name))
      return Promise.all(name.map(n => emit(storage, "delete", n)));
    else
      return emit(storage, "delete", name);
  });
}

function deleteByPrefix(prefix)
{
  return browser.storage.local.get(null).then(items =>
  {
    let keys = Object.keys(items).filter(name => name.startsWith(addPrefix(prefix))).map(removePrefix);
    return delete_(keys);
  });
}

function clear()
{
  throw "invalid_operation";
}

let storage = Object.assign(EventTarget(), {
  has, hasPrefix, get, getAllByPrefix, set, delete: delete_, deleteByPrefix,
  clear
});
export default storage;
