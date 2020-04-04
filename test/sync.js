/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let {
  sync, masterPassword, passwords, crypto, storage, browserAPI, fakeCrypto,
  provider
} = require("../build-test/lib");

let dummyMaster = "foobar";

function unexpectedError(error)
{
  this.ok(false, "Unexpected error: " + error);
  console.error(error);
}

function done()
{
  this.done();
}

function removePrefix(key)
{
  return key.replace(/user:.*\//, "");
}

function getLocalData()
{
  let {storageData} = browserAPI;
  let filteredData = {};
  for (let key of Object.keys(storageData))
  {
    let keyname = removePrefix(key);
    if (keyname.startsWith("site:"))
      filteredData[keyname] = storageData[key];
  }
  return filteredData;
}

function checkSyncError(test)
{
  let syncData = sync.getSyncData();
  if (syncData && syncData.error)
    test.ok(false, `Unexpected error: ${syncData.error}`);
}

function sign(data)
{
  let values = [data.revision];
  let rawkeys = {};
  let keys = Object.keys(data.data).map((key) =>
  {
    let keyname = removePrefix(key);
    rawkeys[keyname] = key;
    return keyname;
  });
  let ciphertext = atob(data.data[rawkeys["sync-secret"]].split("_")[1]);
  let secret = atob(JSON.parse(fakeCrypto.subtle._fakeDecrypt(ciphertext)));

  keys.sort();
  for (let key of keys)
    values.push([key, data.data[rawkeys[key]]]);
  data.signature = btoa("HMAC!" + secret + "!" + JSON.stringify(values));
  return data;
}

exports.setUp = function(callback)
{
  let {storageData} = browserAPI;
  for (let key of Object.keys(storageData))
    delete storageData[key];

  masterPassword.forgetPassword();

  provider._reset();

  callback();
};

exports.tearDown = function(callback)
{
  sync.disableSync().then(() => callback());
};

exports.testAuthorizeAndDisable = function(test)
{
  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    test.deepEqual(sync.getSyncData(), {}, "Sync not set up initially");
    return sync.authorize("dropbox");
  }).then(() =>
  {
    test.notDeepEqual(sync.getSyncData(), {}, "Sync set up after authorization");
    test.equal(sync.getSyncData().provider, "dropbox", "Sync provider");
    return sync.disableSync();
  }).then(() =>
  {
    test.deepEqual(sync.getSyncData(), {}, "Sync not set up after disabling");
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testMerge = function(test)
{
  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return sync.authorize("dropbox");
  }).then(() =>
  {
    return sync.sync();
  }).then(() =>
  {
    checkSyncError(test);

    return Promise.all([
      storage.get("salt", null),
      storage.get("hmac-secret", null),
      storage.get("sync-secret", null),
      null
    ]);
  }).then(([salt, hmac, secret, _]) =>
  {
    let {revision, contents} = provider._get("/passwords.json");
    test.equal(revision, 1, "File revision after initial sync");

    let parsed = JSON.parse(contents);
    test.deepEqual(parsed, sign({
      application: "pfp",
      format: 3,
      revision: 1,
      data: {
        salt,
        "hmac-secret": hmac,
        "sync-secret": secret
      }
    }), "Remote contents after initial sync");

    parsed.format = 2;
    provider._get("/passwords.json").contents = JSON.stringify(parsed);
    return sync.sync();
  }).then(() =>
  {
    checkSyncError(test);

    let {revision, contents} = provider._get("/passwords.json");
    test.equal(revision, 1, "No file revision change without changes");
    return Promise.all([
      storage.set("site:foo", "bar", null),
      storage.set("site:foo:blubber", "blabber", null)
    ]);
  }).then(() =>
  {
    return Promise.all([
      storage.get("salt", null),
      storage.get("hmac-secret", null),
      storage.get("sync-secret", null),
      sync.sync()
    ]);
  }).then(([salt, hmac, secret, _]) =>
  {
    checkSyncError(test);

    let {revision, contents} = provider._get("/passwords.json");
    test.equal(revision, 2, "File revision after local-only update");

    test.deepEqual(JSON.parse(contents), sign({
      application: "pfp",
      format: 3,
      revision: 2,
      data: {
        salt,
        "hmac-secret": hmac,
        "sync-secret": secret,
        "site:foo": "bar",
        "site:foo:blubber": "blabber"
      }
    }), "Remote contents after local-only update");

    provider._set("/passwords.json", 3, JSON.stringify(sign({
      application: "pfp",
      format: 3,
      revision: 8,
      data: {
        salt,
        "hmac-secret": hmac,
        "sync-secret": secret,
        "site:foo": "bas",
        "site:example.com:blub": "blab"
      }
    })));
    return Promise.all([salt, hmac, secret, sync.sync()]);
  }).then(([salt, hmac, secret, _]) =>
  {
    checkSyncError(test);

    let {revision, contents} = provider._get("/passwords.json");
    test.equal(revision, 3, "No file revision change after remote-only update");

    test.deepEqual(getLocalData(), {
      "site:foo": "bas",
      "site:example.com:blub": "blab"
    }, "Local contents after remote-only update");

    provider._set("/passwords.json", 4, JSON.stringify(sign({
      application: "pfp",
      format: 3,
      revision: 9,
      data: {
        salt,
        "hmac-secret": hmac,
        "sync-secret": secret,
        "site:foo": "bar",
        "site:foo:x": "y"
      }
    })));

    return Promise.all([
      storage.set("site:foo", "foo", null),
      storage.set("site:example.com:blub", "blub", null)
    ]);
  }).then(() =>
  {
    return Promise.all([
      storage.get("salt", null),
      storage.get("hmac-secret", null),
      storage.get("sync-secret", null),
      sync.sync()
    ]);
  }).then(([salt, hmac, secret, _]) =>
  {
    checkSyncError(test);

    let {revision, contents} = provider._get("/passwords.json");
    test.equal(revision, 5, "File revision after conflict resolution");

    test.deepEqual(JSON.parse(contents), sign({
      application: "pfp",
      format: 3,
      revision: 10,
      data: {
        salt,
        "hmac-secret": hmac,
        "sync-secret": secret,
        "site:foo": "foo",
        "site:foo:x": "y",
        "site:example.com:blub": "blub"
      }
    }), "Remote contents after conflict resolution");

    test.deepEqual(getLocalData(), {
      "site:foo": "foo",
      "site:foo:x": "y",
      "site:example.com:blub": "blub"
    }, "Local contents after conflict resolution");

    provider._set("/passwords.json", 6, JSON.stringify(sign({
      application: "pfp",
      format: 3,
      revision: 14,
      data: {
        salt,
        "hmac-secret": hmac,
        "sync-secret": secret,
        "site:foo:blubber": "blabber",
        "site:example.com:blub": "blab"
      }
    })));
    return sync.disableSync();
  }).then(() =>
  {
    return Promise.all([
      sync.authorize("dropbox"),
      masterPassword.checkPassword(dummyMaster)
    ]);
  }).then(() =>
  {
    return sync.sync();
  }).then(() =>
  {
    return Promise.all([
      storage.get("salt", null),
      storage.get("hmac-secret", null),
      storage.get("sync-secret", null),
      null
    ]);
  }).then(([salt, hmac, secret, _]) =>
  {
    checkSyncError(test);

    let {revision, contents} = provider._get("/passwords.json");
    test.equal(revision, 7, "File revision after reconnecting client");

    test.deepEqual(JSON.parse(contents), sign({
      application: "pfp",
      format: 3,
      revision: 15,
      data: {
        salt,
        "hmac-secret": hmac,
        "sync-secret": secret,
        "site:foo": "foo",
        "site:foo:blubber": "blabber",
        "site:foo:x": "y",
        "site:example.com:blub": "blub"
      }
    }), "Remote contents after reconnecting client");

    test.deepEqual(getLocalData(), {
      "site:foo": "foo",
      "site:foo:blubber": "blabber",
      "site:foo:x": "y",
      "site:example.com:blub": "blub"
    }, "Local contents after reconnecting client");

    provider._set("/passwords.json", 8, JSON.stringify(sign({
      application: "pfp",
      format: 3,
      revision: 18,
      data: {
        salt,
        "hmac-secret": hmac,
        "sync-secret": secret,
        "site:foo": "foo",
        "site:foo:x": "y",
        "site:example.com:blub": "blub"
      }
    })));

    return Promise.all([salt, hmac, secret, sync.sync()]);
  }).then(([salt, hmac, secret, _]) =>
  {
    checkSyncError(test);

    let {revision, contents} = provider._get("/passwords.json");
    test.equal(revision, 8, "No file revision change after remote removal of a previously synced key");

    test.deepEqual(getLocalData(), {
      "site:foo": "foo",
      "site:foo:x": "y",
      "site:example.com:blub": "blub"
    }, "Local contents after remote removal of a previously synced key");
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testUnrelated = function(test)
{
  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return sync.authorize("dropbox");
  }).then(() =>
  {
    return sync.sync();
  }).then(() =>
  {
    checkSyncError(test);

    return Promise.all([
      storage.get("salt", null),
      storage.get("hmac-secret", null),
      storage.get("sync-secret", null)
    ]);
  }).then(([salt, hmac, secret]) =>
  {
    provider._set("/passwords.json", 8, JSON.stringify(sign({
      application: "pfp",
      format: 3,
      revision: 20,
      data: {
        salt,
        "hmac-secret": hmac,
        "sync-secret": secret,
        "site:foo": "foo",
      }
    })));
    return Promise.all([salt, hmac, sync.sync()]);
  }).then(([salt, hmac, _]) =>
  {
    checkSyncError(test);

    test.deepEqual(getLocalData(), {
      "site:foo": "foo"
    }, "Local contents after update");

    return Promise.all([salt, hmac, storage.encrypt(crypto.generateRandom(32))]);
  }).then(([salt, hmac, secret]) =>
  {
    provider._set("/passwords.json", 8, JSON.stringify(sign({
      application: "pfp",
      format: 3,
      revision: 2,
      data: {
        salt,
        "hmac-secret": hmac,
        "sync-secret": secret,
        "site:foo": "bar",
        "site:bar": "foo"
      }
    })));
    return Promise.all([salt, hmac, secret, sync.sync()]);
  }).then(([salt, hmac, secret, _]) =>
  {
    test.equal(sync.getSyncData().error, "sync_unrelated_client", "Attempting to sync with a different sync secret");
    return Promise.all([salt, hmac, secret, sync.disableSync()]);
  }).then(([salt, hmac, secret, _]) =>
  {
    return Promise.all([salt, hmac, secret, sync.authorize("dropbox")]);
  }).then(([salt, hmac, secret, _]) =>
  {
    return Promise.all([salt, hmac, secret, sync.sync()]);
  }).then(([salt, hmac, secret, _]) =>
  {
    checkSyncError(test);

    test.deepEqual(getLocalData(), {
      "site:foo": "foo",
      "site:bar": "foo"
    }, "Local contents after reconnect");

    let parsed = JSON.parse(provider._get("/passwords.json").contents);
    test.deepEqual(parsed, sign({
      application: "pfp",
      format: 3,
      revision: 3,
      data: {
        salt,
        "hmac-secret": hmac,
        "sync-secret": secret,
        "site:foo": "foo",
        "site:bar": "foo"
      }
    }), "Remote contents after reconnect");
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testErrors = function(test)
{
  return Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return sync.authorize("dropbox");
  }).then(() =>
  {
    return sync.sync();
  }).then(() =>
  {
    test.ok(!sync.getSyncData().error, "No error after initial sync");

    return storage.set("site:foo", "bar", null);
  }).then(() =>
  {
    sync.getSyncData().token += "0";
    return sync.sync();
  }).then(() =>
  {
    test.equal(sync.getSyncData().error, "sync_invalid_token", "Attempting to sync with an invalid token");
    sync.getSyncData().token = sync.getSyncData().token.slice(0, -1);

    provider._set("/passwords.json", 2, "invalid JSON");
    return sync.sync();
  }).then(() =>
  {
    test.equal(sync.getSyncData().error, "sync_unknown_data_format", "Attempting to sync with invalid JSON");

    provider._set("/passwords.json", 3, JSON.stringify(null));
    return sync.sync();
  }).then(() =>
  {
    test.equal(sync.getSyncData().error, "sync_unknown_data_format", "Attempting to sync with null data");

    provider._set("/passwords.json", 4, JSON.stringify(123));
    return sync.sync();
  }).then(() =>
  {
    test.equal(sync.getSyncData().error, "sync_unknown_data_format", "Attempting to sync with non-object");

    provider._set("/passwords.json", 5, JSON.stringify({}));
    return sync.sync();
  }).then(() =>
  {
    test.equal(sync.getSyncData().error, "sync_unknown_data_format", "Attempting to sync with empty object");

    provider._set("/passwords.json", 6, JSON.stringify({
      application: "foobar",
      format: 3
    }));
    return sync.sync();
  }).then(() =>
  {
    test.equal(sync.getSyncData().error, "sync_unknown_data_format", "Attempting to sync with unknown application's data");

    provider._set("/passwords.json", 7, JSON.stringify({
      application: "pfp",
      format: 321
    }));
    return sync.sync();
  }).then(() =>
  {
    test.equal(sync.getSyncData().error, "sync_unknown_data_format", "Attempting to sync with unknown format version");

    provider._set("/passwords.json", 8, JSON.stringify({
      application: "pfp",
      format: 3,
      data: null
    }));
    return sync.sync();
  }).then(() =>
  {
    test.equal(sync.getSyncData().error, "sync_unknown_data_format", "Attempting to sync with null data");

    provider._set("/passwords.json", 9, JSON.stringify({
      application: "pfp",
      format: 3,
      data: 456
    }));
    return sync.sync();
  }).then(() =>
  {
    test.equal(sync.getSyncData().error, "sync_unknown_data_format", "Attempting to sync with non-object data");

    provider._set("/passwords.json", 9, JSON.stringify({
      application: "pfp",
      format: 3,
      data: {}
    }));
    return Promise.all([
      storage.get("salt", null),
      storage.get("hmac-secret", null),
      storage.get("sync-secret", null),
      sync.sync()
    ]);
  }).then(([salt, hmac, secret, _]) =>
  {
    test.equal(sync.getSyncData().error, "sync_unknown_data_format", "Attempting to sync with empty data");

    provider._set("/passwords.json", 8, JSON.stringify(sign({
      application: "pfp",
      format: 3,
      data: {
        salt,
        "hmac-secret": hmac,
        "sync-secret": secret
      }
    })));
    return Promise.all([salt, hmac, secret, sync.sync()]);
  }).then(([salt, hmac, secret, _]) =>
  {
    test.equal(sync.getSyncData().error, "sync_unknown_data_format", "Attempting to sync with signature but no revision number");

    provider._set("/passwords.json", 8, JSON.stringify({
      application: "pfp",
      format: 3,
      revision: 2,
      data: {
        salt,
        "hmac-secret": hmac,
        "sync-secret": secret
      }
    }));
    return Promise.all([salt, hmac, secret, sync.sync()]);
  }).then(([salt, hmac, secret, _]) =>
  {
    test.equal(sync.getSyncData().error, "sync_unknown_data_format", "Attempting to sync without signature");

    provider._set("/passwords.json", 8, JSON.stringify({
      application: "pfp",
      format: 3,
      revision: 2,
      signature: "invalid",
      data: {
        salt,
        "hmac-secret": hmac,
        "sync-secret": "unrelated"
      }
    }));
    return Promise.all([salt, hmac, secret, sync.sync()]);
  }).then(([salt, hmac, secret, _]) =>
  {
    test.equal(sync.getSyncData().error, "sync_unrelated_client", "Attempting to sync with different sync secret");

    provider._set("/passwords.json", 8, JSON.stringify({
      application: "pfp",
      format: 3,
      revision: 2,
      signature: "invalid",
      data: {
        salt,
        "hmac-secret": hmac,
        "sync-secret": secret
      }
    }));
    return Promise.all([salt, hmac, secret, sync.sync()]);
  }).then(([salt, hmac, secret, _]) =>
  {
    test.equal(sync.getSyncData().error, "sync_tampered_data", "Attempting to sync with invalid signature");

    provider._set("/passwords.json", 8, JSON.stringify({
      application: "pfp",
      format: 3,
      revision: 2,
      signature: 123,
      data: {
        salt,
        "hmac-secret": hmac,
        "sync-secret": secret
      }
    }));
    return Promise.all([salt, hmac, secret, sync.sync()]);
  }).then(([salt, hmac, secret, _]) =>
  {
    test.equal(sync.getSyncData().error, "sync_unknown_data_format", "Attempting to sync with numerical signature");

    provider._set("/passwords.json", 8, JSON.stringify(sign({
      application: "pfp",
      format: 3,
      revision: 0.5,
      data: {
        salt,
        "hmac-secret": hmac,
        "sync-secret": secret
      }
    })));
    return Promise.all([salt, hmac, secret, sync.sync()]);
  }).then(([salt, hmac, secret, _]) =>
  {
    test.equal(sync.getSyncData().error, "sync_tampered_data", "Attempting to downgrade revision");

    provider._set("/passwords.json", 8, JSON.stringify(sign({
      application: "pfp",
      format: 3,
      revision: 2,
      data: {
        salt,
        "hmac-secret": hmac,
        "sync-secret": secret
      }
    })));
    return sync.sync();
  }).then(() =>
  {
    test.ok(!sync.getSyncData().error, "Error reset after successful sync");
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testNesting = function(test)
{
  return Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return sync.authorize("dropbox");
  }).then(() =>
  {
    return sync.sync();
  }).then(() =>
  {
    test.ok(!sync.getSyncData().error, "No error after initial sync");

    return storage.set("site:foo", "bar", null);
  }).then(() =>
  {
    provider.changeRevisionOnGet = 1;
    return sync.sync();
  }).then(() =>
  {
    test.ok(!sync.getSyncData().error, "No error after conflict with another client");

    let {revision, contents} = provider._get("/passwords.json");
    test.equal(JSON.parse(contents).data["site:foo"], "bar",
               "Remote contents after conflict with another client");

    return storage.delete("site:foo");
  }).then(() =>
  {
    provider.changeRevisionOnGet = 10;
    return sync.sync();
  }).then(() =>
  {
    test.equals(sync.getSyncData().error, "sync_too_many_retries", "Error on too many conflicts");

    let {revision, contents} = provider._get("/passwords.json");
    test.equal(JSON.parse(contents).data["site:foo"], "bar",
               "Remote contents unchanged after too many conflicts");
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testRekey = function(test)
{
  let salt = null;
  return Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return sync.authorize("dropbox");
  }).then(() =>
  {
    return sync.sync();
  }).then(() =>
  {
    salt = JSON.parse(provider._get("/passwords.json").contents).data.salt;
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return Promise.all([
      passwords.addGenerated({
        site: "example.com",
        name: "foo",
        length: 8,
        lower: true,
        upper: false,
        number: true,
        symbol: false
      }),
      passwords.addGenerated({
        site: "example.info",
        name: "bar",
        length: 16,
        lower: false,
        upper: true,
        number: false,
        symbol: true
      }),
      passwords.addStored({
        site: "example.com",
        name: "foo",
        revision: 2,
        password: "bar"
      }),
      passwords.addAlias("example.net", "example.com")
    ]);
  }).then(() =>
  {
    return sync.authorize("dropbox");
  }).then(() =>
  {
    return sync.sync();
  }).then(() =>
  {
    test.ok(!sync.getSyncData().error, "No error after rekeying sync");
    return Promise.all([
      storage.get("salt", null),
      passwords.getAllPasswords()
    ]);
  }).then(([storedSalt, allPasswords]) =>
  {
    test.equal(storedSalt, salt);

    test.deepEqual(allPasswords, {
      "example.com": {
        site: "example.com",
        passwords: [
          {
            type: "generated2",
            site: "example.com",
            name: "foo",
            length: 8,
            lower: true,
            upper: false,
            number: true,
            symbol: false
          },
          {
            type: "stored",
            site: "example.com",
            name: "foo",
            revision: 2,
            password: "bar"
          }
        ],
        aliases: ["example.net"]
      },
      "example.info": {
        site: "example.info",
        passwords: [
          {
            type: "generated2",
            site: "example.info",
            name: "bar",
            length: 16,
            lower: false,
            upper: true,
            number: false,
            symbol: true
          }
        ],
        aliases: []
      }
    });
  }).then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return sync.authorize("dropbox");
  }).then(() =>
  {
    return sync.sync();
  }).then(() =>
  {
    test.ok(!sync.getSyncData().error, "No error after rekeying sync");
    return Promise.all([
      storage.get("salt", null),
      passwords.getAllPasswords()
    ]);
  }).then(([storedSalt, allPasswords]) =>
  {
    test.equal(storedSalt, salt);

    test.deepEqual(allPasswords, {
      "example.com": {
        site: "example.com",
        passwords: [
          {
            type: "generated2",
            site: "example.com",
            name: "foo",
            length: 8,
            lower: true,
            upper: false,
            number: true,
            symbol: false
          },
          {
            type: "stored",
            site: "example.com",
            name: "foo",
            revision: 2,
            password: "bar"
          }
        ],
        aliases: ["example.net"]
      },
      "example.info": {
        site: "example.info",
        passwords: [
          {
            type: "generated2",
            site: "example.info",
            name: "bar",
            length: 16,
            lower: false,
            upper: true,
            number: false,
            symbol: true
          }
        ],
        aliases: []
      }
    });
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};
