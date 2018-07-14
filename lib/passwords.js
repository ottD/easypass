/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let storage = require("./storage");

let crypto = require("./crypto");
let masterPassword = require("./masterPassword");

let lock = exports.lock = new (require("./lock"))();

let storagePrefix = "site@";

function _normalizeSite(site)
{
  // Remove trailing dots
  if (site && site[site.length - 1] == ".")
    site = site.substr(0, site.length - 1);

  // Remove www. prefix
  if (site.substr(0, 4) == "www.")
    site = site.substr(4);

  return site;
}

function _sortPasswords(list)
{
  list.sort((a, b) =>
  {
    if (a.name < b.name)
      return -1;
    else if (a.name > b.name)
      return 1;
    else
    {
      let rev1 = a.revision ? parseInt(a.revision, 10) : 1;
      let rev2 = b.revision ? parseInt(b.revision, 10) : 1;
      if (!isNaN(rev1) && !isNaN(rev2))
        return rev1 - rev2;
      else if (a.revision < b.revision)
        return -1;
      else if (a.revision > b.revision)
        return 1;
      else
        return 0;
    }
  });

  return list;
}

function getStoragePrefix()
{
  let userId = masterPassword.getUserId();
  return `${storagePrefix}${userId}:`;
}
exports.getStoragePrefix = getStoragePrefix;

function _getSiteKey(site)
{
  return masterPassword.getDigest(site).then(digest =>
  {
    let prefix = getStoragePrefix();
    return `${prefix}${digest}`;
  });
}

function _getPasswordPrefix(site)
{
  return _getSiteKey(site).then(key => `${key}:`);
}

function _getPasswordKey(site, name, revision)
{
  return Promise.all([
    _getPasswordPrefix(site),
    masterPassword.getDigest(site + "\0" + name + "\0" + (revision || ""))
  ]).then(([prefix, digest]) =>
  {
    return `${prefix}${digest}`;
  });
}

function _getSiteData(site)
{
  return _getSiteKey(site).then(key =>
  {
    return storage.get(key).then(data =>
    {
      if (data)
        return data;
      else
        return {};
    });
  });
}

function _hasPasswords(site)
{
  return _getPasswordPrefix(site).then(prefix =>
  {
    return storage.hasPrefix(prefix);
  });
}

function _getPasswords(site)
{
  return _getPasswordPrefix(site).then(prefix =>
  {
    return storage.getAllByPrefix(prefix);
  }).then(data =>
  {
    return _sortPasswords(Object.keys(data).map(key => data[key]));
  });
}

function _ensureSiteData(site)
{
  return _getSiteKey(site).then(key =>
  {
    return storage.has(key).then(exists =>
    {
      if (!exists)
        return storage.set(key, {site});
      return null;
    });
  });
}

function _deleteSiteData(site)
{
  return _getSiteKey(site).then(key => storage.delete(key));
}

function _deletePassword(site, name, revision)
{
  return _getPasswordKey(site, name, revision).then(key => storage.delete(key));
}

function getAlias(host)
{
  let origSite = _normalizeSite(host);
  return _getSiteData(origSite).then(siteData =>
  {
    return [origSite, siteData.alias || origSite];
  });
}
exports.getAlias = getAlias;

function addAlias(site, alias)
{
  return lock.acquire().then(() =>
  {
    return _hasPasswords(site);
  }).then(hasPasswords =>
  {
    if (hasPasswords)
      throw "site_has_passwords";

    return setSite({site, alias});
  }).finally(() => lock.release());
}
exports.addAlias = addAlias;

function removeAlias(site)
{
  return lock.acquire().then(() => _getSiteData(site)).then(siteData =>
  {
    if (!siteData || !siteData.alias)
      throw "no_such_alias";
  }).then(() =>
  {
    return _deleteSiteData(site);
  }).finally(() => lock.release());
}
exports.removeAlias = removeAlias;

function getPasswords(host)
{
  return getAlias(host).then(([origSite, site]) =>
  {
    return Promise.all([origSite, site, _getPasswords(site)]);
  });
}
exports.getPasswords = getPasswords;

function getPassword(site, name, revision)
{
  return _getPasswordKey(site, name, revision).then(key =>
  {
    return storage.get(key);
  }).then(passwordData =>
  {
    if (!passwordData)
      throw "no_such_password";

    if (passwordData.type == "stored")
      return passwordData.password;

    if (passwordData.type == "generated2" || passwordData.type == "generated")
    {
      let {length, lower, upper, number, symbol} = passwordData;
      let params = {
        masterPassword: masterPassword.get(),
        domain: site,
        name, revision, length, lower, upper, number, symbol
      };
      if (passwordData.type == "generated2")
        return crypto.derivePassword(params);
      else
        return crypto.derivePasswordLegacy(params);
    }

    throw "unknown_generation_method";
  });
}
exports.getPassword = getPassword;

function getAllPasswords()
{
  return storage.getAllByPrefix(getStoragePrefix()).then(data =>
  {
    let entries = Object.keys(data).map(key => data[key]);
    let result = Object.create(null);
    for (let siteData of entries)
    {
      if (siteData.type || siteData.alias)
        continue;

      result[siteData.site] = siteData;
      siteData.passwords = [];
      siteData.aliases = [];
    }

    for (let passwordData of entries)
    {
      if (!passwordData.type)
        continue;

      let siteData = result[passwordData.site];
      if (siteData)
        siteData.passwords.push(passwordData);
      else
        _deletePassword(passwordData.site, passwordData.name, passwordData.revision);
    }

    for (let siteData of entries)
    {
      if (siteData.type || !siteData.alias)
        continue;

      let targetSiteData = result[siteData.alias];
      if (targetSiteData && targetSiteData.passwords.length)
        targetSiteData.aliases.push(siteData.site);
      else
        _deleteSiteData(siteData.site);
    }

    for (let site of Object.keys(result))
    {
      let siteData = result[site];
      if (siteData.passwords.length)
      {
        _sortPasswords(siteData.passwords);
        siteData.aliases.sort();
      }
      else
      {
        delete result[site];
        _deleteSiteData(site);
      }
    }

    return result;
  });
}
exports.getAllPasswords = getAllPasswords;

function getAllSites()
{
  return storage.getAllByPrefix(getStoragePrefix()).then(data =>
  {
    let sites = [];
    for (let key of Object.keys(data))
    {
      let siteData = data[key];
      if (siteData.type || siteData.alias)
        continue;

      sites.push(siteData.site);
    }
    sites.sort();
    return sites;
  });
}
exports.getAllSites = getAllSites;

function exportPasswordData()
{
  return storage.getAllByPrefix("", null).then(data =>
  {
    // Convert data to pfp format 2

    let storagePrefixV2 = "site:";
    let hmacSecretKeyV2 = "hmac-secret";

    for (let key of Object.keys(data))
    {
      let newkey;

      if (key == masterPassword.saltKey)
      {
        /* include as-is */
      }
      else if (key == masterPassword.getHmacSecretKey())
      {
        data[hmacSecretKeyV2] = data[key];
        delete data[key];
      }
      else if (key.startsWith(getStoragePrefix()))
      {
        newkey = key.replace(getStoragePrefix(), storagePrefixV2);
        data[newkey] = data[key];
        delete data[key];
      }
      else
      {
        delete data[key];
      }
    }

    return JSON.stringify({
      application: "pfp",
      format: 2,
      data
    });
  });
}
exports.exportPasswordData = exportPasswordData;

function importPasswordData(data, masterPass)
{
  let importers = [
    require("./importers/default"),
    require("./importers/legacy"),
    require("./importers/lastPass")
  ];

  function setRaw(key, value)
  {
    return storage.set(key, value, null);
  }

  function tryNext()
  {
    let importer = importers.shift();
    return importer.import(data, setRaw, setSite, setPassword, masterPass).catch(e =>
    {
      if (e != "unknown_data_format" || !importers.length)
        throw e;
      return tryNext();
    });
  }

  return lock.acquire().then(tryNext).finally(() => lock.release());
}
exports.importPasswordData = importPasswordData;

function setPassword(entry)
{
  return _getPasswordKey(entry.site, entry.name, entry.revision).then(key =>
  {
    return storage.set(key, entry);
  });
}
exports.setPassword = setPassword;

function setSite(entry)
{
  return _getSiteKey(entry.site).then(key =>
  {
    return storage.set(key, entry);
  });
}
exports.setSite = setSite;

function addGenerated({site, name, revision, length, lower, upper, number, symbol, legacy}, replaceExisting)
{
  return lock.acquire().then(() => _ensureSiteData(site)).then(() =>
  {
    return _getPasswordKey(site, name, revision);
  }).then(key =>
  {
    if (replaceExisting)
      return [key, false];

    return Promise.all([key, storage.has(key)]);
  }).then(([key, exists]) =>
  {
    if (exists)
      throw "alreadyExists";

    let type = (legacy ? "generated" : "generated2");
    return storage.set(key, {
      site, name, revision, type, length, lower, upper, number, symbol
    });
  }).then(_ => _getPasswords(site)).finally(() => lock.release());
}
exports.addGenerated = addGenerated;

function addStored({site, name, revision, password})
{
  return lock.acquire().then(() => _ensureSiteData(site)).then(() =>
  {
    return _getPasswordKey(site, name, revision);
  }).then(key =>
  {
    return Promise.all([key, storage.has(key)]);
  }).then(([key, exists]) =>
  {
    if (exists)
      throw "alreadyExists";

    return storage.set(key, {
      type: "stored",
      site, name, revision, password
    });
  }).then(_ => _getPasswords(site)).finally(() => lock.release());
}
exports.addStored = addStored;

function removePassword(site, name, revision)
{
  return lock.acquire().then(() =>
  {
    return _getPasswordKey(site, name, revision);
  }).then(key =>
  {
    return storage.has(key).then(exists =>
    {
      if (!exists)
        throw "no_such_password";

      return storage.delete(key);
    });
  }).then(_ => _getPasswords(site)).finally(() => lock.release());
}
exports.removePassword = removePassword;

function setNotes(site, name, revision, notes)
{
  return lock.acquire().then(() =>
  {
    return _getPasswordKey(site, name, revision);
  }).then(key =>
  {
    return Promise.all([key, storage.get(key)]);
  }).then(([key, data]) =>
  {
    if (!data)
      throw "no_such_password";

    if (notes)
      data.notes = notes;
    else
      delete data.notes;
    return storage.set(key, data);
  }).then(_ => _getPasswords(site)).finally(() => lock.release());
}
exports.setNotes = setNotes;

function getNotes(site, name, revision)
{
  return _getPasswordKey(site, name, revision).then(key =>
  {
    return storage.get(key);
  }).then(passwordData =>
  {
    if (!passwordData)
      throw "no_such_password";
    return passwordData.notes;
  });
}
exports.getNotes = getNotes;

let migrationInProgress = null;

function migrateData(master)
{
  if (!migrationInProgress)
  {
    let migration = require("./migration");
    migrationInProgress = lock.acquire().then(() =>
    {
      return migration.migrateData(master, setSite, setPassword);
    }).finally(() =>
    {
      migrationInProgress = null;
      lock.release();
    });
  }
  return migrationInProgress;
}
exports.migrateData = migrateData;

exports.isMigrating = () => !!migrationInProgress;
