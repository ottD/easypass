/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let storage = require("../storage");
let masterPassword = require("../masterPassword");
let passwords = require("../passwords");
let crypto = require("../crypto");

let storagePrefixV2 = "site:";
let hmacSecretKeyV2 = "hmac-secret";

function importUnchanged(data, setRaw)
{
  let mergeActions = [];
  for (let key in data)
  {
    if (key.startsWith(storagePrefixV2))
    {
      let newkey = key.replace(storagePrefixV2, passwords.getStoragePrefix());
      mergeActions.push(setRaw(newkey, data[key]));
    }
  }
  return Promise.all(mergeActions);
}

function decryptThenImport(data, masterPass, setSite, setPassword)
{
  return masterPassword.deriveKey(data[masterPassword.saltKey], masterPass).then(decryptionKey =>
  {
    return Promise.all([
      decryptionKey,
      masterPassword.decrypt(data[hmacSecretKeyV2], decryptionKey)
    ]);
  }).catch(error =>
  {
    console.error(error);
    throw "wrong_master_password";
  }).then(([decryptionKey, hmacSecret]) =>
  {
    let decryptActions = [];
    for (let key in data)
      if (key.startsWith(storagePrefixV2))
        decryptActions.push(masterPassword.decrypt(data[key], decryptionKey));
    return Promise.all(decryptActions);
  }).then(entries =>
  {
    let mergeActions = [];
    for (let entry of entries)
    {
      if (!entry.type)
        mergeActions.push(setSite(entry));
      else if (entry.type == "generated2" || entry.type == "generated")
      {
        if (masterPass)
        {
          let params = {
            masterPassword: masterPass,
            domain: entry.site,
            name: entry.name,
            revision: entry.revision,
            length: entry.length,
            lower: entry.lower,
            upper: entry.upper,
            number: entry.number,
            symbol: entry.symbol
          };
          let action;
          if (entry.type == "generated2")
            action = crypto.derivePassword(params);
          else
            action = crypto.derivePasswordLegacy(params);
          mergeActions.push(action.then(password =>
          {
            return setPassword({
              type: "stored",
              site: entry.site,
              name: entry.name,
              revision: entry.revision,
              password
            });
          }));
        }
        else
          mergeActions.push(setPassword(entry));
      }
      else if (entry.type == "stored")
        mergeActions.push(setPassword(entry));
    }
    return Promise.all(mergeActions);
  });
}

function import_(data, setRaw, setSite, setPassword, masterPass)
{
  return Promise.resolve().then(() =>
  {
    try
    {
      data = JSON.parse(data);
    }
    catch (e)
    {
      throw "unknown_data_format";
    }

    if (!data || typeof data != "object" ||
        data.application != "pfp" || data.format != 2 ||
        !data.data || typeof data.data != "object" ||
        typeof data.data[masterPassword.saltKey] != "string" ||
        typeof data.data[hmacSecretKeyV2] != "string")
    {
      throw "unknown_data_format";
    }

    return Promise.all([
      storage.get(masterPassword.saltKey, null),
      storage.get(masterPassword.getHmacSecretKey(), null)
    ]);
  }).then(([saltRaw, hmacSecretRaw]) =>
  {
    if (masterPass)
      return decryptThenImport(data.data, masterPass, setSite, setPassword);
    else if (saltRaw == data.data[masterPassword.saltKey] && hmacSecretRaw == data.data[hmacSecretKeyV2])
    {
      // Backup was created with the same crypto parameters, we can just import
      // the entries as they are, without decrypting them first.
      return importUnchanged(data.data, setRaw);
    }
    else
      return decryptThenImport(data.data, null, setSite, setPassword);
  });
}
exports.import = import_;
