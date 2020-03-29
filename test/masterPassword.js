/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let {passwords, masterPassword, browserAPI} = require("../build-test/lib");

let dummyMaster = "foobar";

function expectedValue(expected, value)
{
  this.equal(value, expected);
}

function unexpectedError(error)
{
  this.ok(false, "Unexpected error: " + error);
  console.error(error);
}

function done()
{
  this.done();
}

exports.setUp = function(callback)
{
  let {storageData} = browserAPI;
  for (let key of Object.keys(storageData))
    delete storageData[key];

  masterPassword.forgetPassword();

  callback();
};

exports.testGetAndForget = function(test)
{
  Promise.resolve().then(() =>
  {
    masterPassword.getMasterPassword();
    test.ok(false, "Getting master password didn't throw");
  }).catch(expectedValue.bind(test, "master_password_required")).then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    test.equal(masterPassword.getMasterPassword(), dummyMaster);

    return masterPassword.forgetPassword();
  }).catch(unexpectedError.bind(test)).then(() =>
  {
    masterPassword.getMasterPassword();
    test.ok(false, "Getting master password didn't throw");
  }).catch(expectedValue.bind(test, "master_password_required")).then(() =>
  {
    return masterPassword.forgetPassword();
  }).then(() =>
  {
    return masterPassword.checkPassword(dummyMaster);
  }).then(() =>
  {
    test.equal(masterPassword.getMasterPassword(), dummyMaster);
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testCheckPassword = function(test)
{
  masterPassword.checkPassword(dummyMaster).then(() =>
  {
    test.ok(false, "Accepted master password when none is set");
  }).catch(expectedValue.bind(test, "declined")).then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return masterPassword.checkPassword(dummyMaster);
  }).catch(unexpectedError.bind(test)).then(() =>
  {
    return masterPassword.checkPassword(dummyMaster + dummyMaster);
  }).then(() =>
  {
    test.ok(false, "Accepted wrong master password");
  }).catch(expectedValue.bind(test, "declined")).then(done.bind(test));
};

exports.testState = function(test)
{
  masterPassword.getState().then(state =>
  {
    test.equal(state, "unset");

    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return masterPassword.getState();
  }).then(state =>
  {
    test.equal(state, "known");

    return masterPassword.forgetPassword();
  }).then(() =>
  {
    return masterPassword.getState();
  }).then(state =>
  {
    test.equal(state, "set");

    return masterPassword.checkPassword(dummyMaster);
  }).then(() =>
  {
    return masterPassword.getState();
  }).then(state =>
  {
    test.equal(state, "known");
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testSeperateStorage = function(test)
{
  function addData()
  {
    return Promise.all([
      passwords.addGenerated({
        site: "example.com",
        name: "foo",
        length: 8,
        lower: true,
        upper: false,
        number: true,
        symbol: false,
        legacy: true
      }),
      passwords.addStored({
        site: "example.info",
        name: "bar",
        password: "foo"
      }),
      passwords.addAlias("sub.example.info", "example.com")
    ]);
  }

  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return addData();
  }).then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    let entries = Object.keys(allPasswords);
    test.ok(entries.includes("example.com"), "Includes example.com");
    test.ok(entries.includes("example.info"), "Includes example.info");

    return masterPassword.changePassword(dummyMaster + dummyMaster);
  }).then(() =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {});
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};
