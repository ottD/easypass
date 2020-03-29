/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let {
  passwords, recoveryCodes, masterPassword, fakeCrypto, browserAPI
} = require("../build-test/lib");

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

  fakeCrypto.disableFakeEncryption();
  fakeCrypto.enableFakeRandom(2);
  callback();
};

exports.tearDown = function(callback)
{
  fakeCrypto.enableFakeEncryption();
  fakeCrypto.disableFakeRandom();
  callback();
};

exports.testRecoveryCodes = function(test)
{
  const dummyMaster = "foobar";
  const stored = {
    site: "example.com",
    name: "foo",
    password: "bar"
  };

  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.addStored(stored);
  }).then(pwdList =>
  {
    return recoveryCodes.getCode(stored);
  }).then(code =>
  {
    let lines = code.trim().split(/[\r\n]+/);
    test.ok(lines[0].length == lines[lines.length - 1].length, "Lines have the same length");

    return Promise.all([
      code,
      recoveryCodes.isValid(code),
      recoveryCodes.isValid(lines[0]),
      recoveryCodes.isValid(lines[lines.length - 1]),
      recoveryCodes.isValid(lines.slice(0, -1).join("\n")),
      recoveryCodes.isValid(lines.slice(0, -2).concat([lines[lines.length - 1], lines[lines.length - 2]]).join("\n")),
      recoveryCodes.isValid(code.substr(10, 10) + code.substr(0, 10) + code.substr(20)),
      recoveryCodes.decodeCode(code)
    ]);
  }).then(([code, valid, firstLineValid, lastLineValid, reducedLinesValid, reorderedLinesValid, transposedValid, decoded]) =>
  {
    test.equal(valid, "ok", "Unchanged recovery code is valid");
    test.equal(firstLineValid, "unterminated", "Validating first line by itself");
    test.equal(lastLineValid, "checksum_mismatch", "Validating last line by itself");
    test.equal(reducedLinesValid, "unterminated", "Validating code without last line");
    test.equal(reorderedLinesValid, "checksum_mismatch", "Validating code with last two lines swapped");
    test.equal(transposedValid, "checksum_mismatch", "Code with two blocks swapped is not valid");
    test.equal(decoded, stored.password, "Password decoded correctly");
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};
