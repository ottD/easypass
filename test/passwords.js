/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let {crypto, passwords, masterPassword, storage, browserAPI} = require("../build-test/lib");

let dummyMaster = "foobar";

let generated1 = {
  site: "example.com",
  name: "foo",
  length: 8,
  lower: true,
  upper: false,
  number: true,
  symbol: false,
  password: "jmkg5jd4"
};

let generated2 = {
  site: "example.com",
  name: "bar",
  revision: "2",
  length: 16,
  lower: false,
  upper: true,
  number: false,
  symbol: true,
  notes: "some notes",
  password: "$X*RR~V}?;FY[T|~"
};

let generated3 = {
  site: "example.com",
  name: "foo",
  type: "generated",
  revision: "2",
  length: 16,
  lower: true,
  upper: true,
  number: false,
  symbol: false,
  notes: "more notes",
  password: "ZfrQyEEavZqtjzcr"
};

let generated4 = {
  site: "example.info",
  name: "bar",
  type: "generated",
  length: 8,
  lower: false,
  upper: false,
  number: true,
  symbol: true,
  password: "6;!!|7/{"
};

let stored1 = {
  site: "example.com",
  name: "foo",
  password: "bar"
};

let stored2 = {
  site: "example.com",
  name: "bar",
  password: "foo",
  notes: "some more notes"
};

let stored3 = {
  site: "example.com",
  name: "bar",
  revision: "2",
  password: "foobar"
};

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

let origConsoleError;

exports.setUp = function(callback)
{
  let {storageData} = browserAPI;
  for (let key of Object.keys(storageData))
    delete storageData[key];

  masterPassword.forgetPassword();

  origConsoleError = console.error;
  console.error = function(...args)
  {
    if (!String(args[0]).includes("Syntax error") && !String(args[0]).includes("encrypted with wrong algorithm"))
      origConsoleError.call(this, ...args);
  };

  callback();
};

exports.tearDown = function(callback)
{
  console.error = origConsoleError;
  callback();
};

exports.testAddRemoveGenerated = function(test)
{
  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.addGenerated(generated1);
  }).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "generated2",
      site: generated1.site,
      name: generated1.name,
      length: generated1.length,
      lower: generated1.lower,
      upper: generated1.upper,
      number: generated1.number,
      symbol: generated1.symbol
    }]);

    return passwords.addGenerated(generated2);
  }).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "generated2",
      site: generated2.site,
      name: generated2.name,
      revision: generated2.revision,
      length: generated2.length,
      lower: generated2.lower,
      upper: generated2.upper,
      number: generated2.number,
      symbol: generated2.symbol,
      notes: generated2.notes
    },
    {
      type: "generated2",
      site: generated1.site,
      name: generated1.name,
      length: generated1.length,
      lower: generated1.lower,
      upper: generated1.upper,
      number: generated1.number,
      symbol: generated1.symbol
    }]);

    return Promise.all([
      pwdList,
      passwords.getPasswords(generated1.site),
      passwords.getPasswords("www." + generated1.site),
      passwords.getPasswords("www." + generated1.site + "."),
      passwords.getPasswords("sub." + generated1.site + ".")
    ]);
  }).then(([pwdList, siteData, wwwSiteData, wwwSiteData2, subSiteData]) =>
  {
    let [origSite, site, pwdList2] = siteData;
    test.equal(origSite, generated1.site);
    test.equal(site, generated1.site);
    test.deepEqual(pwdList2, pwdList);

    [origSite, site, pwdList2] = wwwSiteData;
    test.equal(origSite, generated1.site);
    test.equal(site, generated1.site);
    test.deepEqual(pwdList2, pwdList);
    test.deepEqual(wwwSiteData, wwwSiteData2);

    [origSite, site, pwdList2] = subSiteData;
    test.equal(origSite, "sub." + generated1.site);
    test.equal(site, "sub." + generated1.site);
    test.deepEqual(pwdList2, []);

    return passwords.removePassword(generated1);
  }).catch(unexpectedError.bind(test)).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "generated2",
      site: generated2.site,
      name: generated2.name,
      revision: generated2.revision,
      length: generated2.length,
      lower: generated2.lower,
      upper: generated2.upper,
      number: generated2.number,
      symbol: generated2.symbol,
      notes: generated2.notes
    }]);

    return passwords.removePassword(generated1);
  }).then(() =>
  {
    test.ok(false, "Succeeded removing a non-existant password");
  }).catch(expectedValue.bind(test, "no_such_password")).then(() =>
  {
    return passwords.removePassword({site: "sub." + generated2.site, name: generated2.name, revision: ""});
  }).then(() =>
  {
    test.ok(false, "Succeeded removing password with wrong revision number");
  }).catch(expectedValue.bind(test, "no_such_password")).then(() =>
  {
    return passwords.removePassword({site: "sub." + generated2.site, name: generated2.name, revision: generated2.revision});
  }).then(() =>
  {
    test.ok(false, "Succeeded removing a non-existant password");
  }).catch(expectedValue.bind(test, "no_such_password")).then(done.bind(test));
};

exports.testAddRemoveStored = function(test)
{
  Promise.resolve().then(() =>
  {
    return passwords.addStored(stored1);
  }).then(() =>
  {
    test.ok(false, "Added stored password before knowing master password");
  }).catch(expectedValue.bind(test, "master_password_required")).then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.addStored(stored1);
  }).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "stored",
      site: stored1.site,
      name: stored1.name,
      password: stored1.password
    }]);
    return passwords.addStored(stored2);
  }).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "stored",
      site: stored2.site,
      name: stored2.name,
      password: stored2.password,
      notes: stored2.notes
    }, {
      type: "stored",
      site: stored1.site,
      name: stored1.name,
      password: stored1.password
    }]);

    return passwords.addStored(stored3);
  }).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "stored",
      site: stored2.site,
      name: stored2.name,
      password: stored2.password,
      notes: stored2.notes
    }, {
      type: "stored",
      site: stored3.site,
      name: stored3.name,
      revision: stored3.revision,
      password: stored3.password
    }, {
      type: "stored",
      site: stored1.site,
      name: stored1.name,
      password: stored1.password
    }]);

    return Promise.all([
      pwdList,
      passwords.getPasswords(stored1.site),
      passwords.getPasswords("www." + stored1.site),
      passwords.getPasswords("www." + stored1.site + "."),
      passwords.getPasswords("sub." + stored1.site + ".")
    ]);
  }).then(([pwdList, siteData, wwwSiteData, wwwSiteData2, subSiteData]) =>
  {
    let [origSite, site, pwdList2] = siteData;
    test.equal(origSite, stored1.site);
    test.equal(site, stored1.site);
    test.deepEqual(pwdList2, pwdList);

    [origSite, site, pwdList2] = wwwSiteData;
    test.equal(origSite, stored1.site);
    test.equal(site, stored1.site);
    test.deepEqual(pwdList2, pwdList);
    test.deepEqual(wwwSiteData, wwwSiteData2);

    [origSite, site, pwdList2] = subSiteData;
    test.equal(origSite, "sub." + stored1.site);
    test.equal(site, "sub." + stored1.site);
    test.deepEqual(pwdList2, []);

    return passwords.removePassword(stored3);
  }).catch(unexpectedError.bind(test)).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "stored",
      site: stored2.site,
      name: stored2.name,
      password: stored2.password,
      notes: stored2.notes
    }, {
      type: "stored",
      site: stored1.site,
      name: stored1.name,
      password: stored1.password
    }]);

    return passwords.removePassword(stored3);
  }).then(() =>
  {
    test.ok(false, "Succeeded removing a non-existant password");
  }).catch(expectedValue.bind(test, "no_such_password")).then(() =>
  {
    return passwords.removePassword({site: "sub." + stored2.site, name: stored2.name});
  }).then(() =>
  {
    test.ok(false, "Succeeded removing a non-existant password");
  }).catch(expectedValue.bind(test, "no_such_password")).then(done.bind(test));
};

exports.testAddGeneratedExisting = function(test)
{
  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.addGenerated(generated1);
  }).catch(unexpectedError.bind(test)).then(() =>
  {
    return passwords.addGenerated(generated1);
  }).then(() =>
  {
    test.ok(false, "Succeeded adding the same password twice");
  }).catch(expectedValue.bind(test, "alreadyExists")).then(() =>
  {
    return passwords.addStored(stored1);
  }).catch(expectedValue.bind(test, "alreadyExists")).then(() =>
  {
    return passwords.addGenerated(generated1, true);
  }).catch(unexpectedError.bind(test)).then(() =>
  {
    return passwords.removePassword(generated1);
  }).then(() =>
  {
    return passwords.addStored(stored1);
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testRetrieval = function(test)
{
  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.addGenerated(generated1);
  }).then(pwdList =>
  {
    return passwords.getPassword(generated1);
  }).then(pwd =>
  {
    test.equal(pwd, generated1.password);
    return passwords.addGenerated(generated2);
  }).then(pwdList =>
  {
    return passwords.getPassword(generated2);
  }).then(pwd =>
  {
    test.equal(pwd, generated2.password);
    return passwords.removePassword(generated2);
  }).then(pwdList =>
  {
    return Promise.all([passwords.addStored(stored2), passwords.addStored(stored3)]);
  }).then(([pwdList1, pwdList2]) =>
  {
    return passwords.getPassword(stored2);
  }).then(pwd =>
  {
    test.equal(pwd, stored2.password);
    return passwords.getPassword(stored3);
  }).then(pwd =>
  {
    test.equal(pwd, stored3.password);
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testAliases = function(test)
{
  let expectedSite = "example.info";
  function expectData(expectedAlias, expectedPwdList)
  {
    return passwords.getAlias(expectedSite).then(([site, alias]) =>
    {
      test.equal(site, expectedSite);
      test.equal(alias, expectedAlias);

      return passwords.getAlias("www." + expectedSite);
    }).then(([site, alias]) =>
    {
      test.equal(site, expectedSite);
      test.equal(alias, expectedAlias);

      return passwords.getAlias(expectedSite + ".");
    }).then(([site, alias]) =>
    {
      test.equal(site, expectedSite);
      test.equal(alias, expectedAlias);

      return passwords.getPasswords(expectedSite);
    }).then(([site, alias, pwdList]) =>
    {
      test.equal(site, expectedSite);
      test.equal(alias, expectedAlias);
      test.deepEqual(pwdList, expectedPwdList);

      return passwords.getPasswords("www." + expectedSite);
    }).then(([site, alias, pwdList]) =>
    {
      test.equal(site, expectedSite);
      test.equal(alias, expectedAlias);
      test.deepEqual(pwdList, expectedPwdList);

      return passwords.getPasswords(expectedSite + ".");
    }).then(([site, alias, pwdList]) =>
    {
      test.equal(site, expectedSite);
      test.equal(alias, expectedAlias);
      test.deepEqual(pwdList, expectedPwdList);
    });
  }

  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.addGenerated(generated1);
  }).then(() =>
  {
    return expectData(expectedSite, []);
  }).then(() =>
  {
    return passwords.addAlias(expectedSite, generated1.site);
  }).then(() =>
  {
    return expectData(generated1.site, [{
      type: "generated2",
      site: generated1.site,
      name: generated1.name,
      length: generated1.length,
      lower: generated1.lower,
      upper: generated1.upper,
      number: generated1.number,
      symbol: generated1.symbol
    }]);
  }).then(() =>
  {
    return passwords.removeAlias(expectedSite);
  }).then(() =>
  {
    return expectData(expectedSite, []);
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testAliasErrors = function(test)
{
  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.addGenerated(generated1);
  }).then(() =>
  {
    return passwords.addAlias(generated1.site, "example.info");
  }).then(() =>
  {
    test.ok(false, "Successfully added an alias for a site with passwords");
  }).catch(expectedValue.bind(test, "site_has_passwords")).then(() =>
  {
    return passwords.removeAlias(generated1.site);
  }).then(() =>
  {
    test.ok(false, "Successfully removed a non-existant alias");
  }).catch(expectedValue.bind(test, "no_such_alias")).then(() =>
  {
    return passwords.removeAlias("example.info");
  }).then(() =>
  {
    test.ok(false, "Successfully removed a non-existant alias");
  }).catch(expectedValue.bind(test, "no_such_alias")).then(done.bind(test));
};

exports.testNotes = function(test)
{
  let notes1 = "foobarnotes";
  let notes2 = "barbasnotes";

  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.addGenerated(generated2);
  }).then(() =>
  {
    return passwords.setNotes(generated1, notes1);
  }).then(() =>
  {
    test.ok(false, "Successfully set notes on a non-existant password");
  }).catch(expectedValue.bind(test, "no_such_password")).then(() =>
  {
    return passwords.setNotes({site: "sub." + generated2.site, name: generated2.name, revision: generated2.revision}, notes1);
  }).then(() =>
  {
    test.ok(false, "Successfully set notes on a non-existant password");
  }).catch(expectedValue.bind(test, "no_such_password")).then(() =>
  {
    return passwords.getNotes(generated2);
  }).then(notes =>
  {
    test.equal(notes, generated2.notes);

    return passwords.setNotes(generated2, notes1);
  }).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "generated2",
      site: generated2.site,
      name: generated2.name,
      revision: generated2.revision,
      length: generated2.length,
      lower: generated2.lower,
      upper: generated2.upper,
      number: generated2.number,
      symbol: generated2.symbol,
      notes: notes1
    }]);

    return Promise.all([pwdList, passwords.getPasswords(generated2.site)]);
  }).then(([pwdList, [origSite, site, pwdList2]]) =>
  {
    test.deepEqual(pwdList2, pwdList);

    return passwords.getNotes(generated2);
  }).then(notes =>
  {
    test.equal(notes, notes1);

    return passwords.setNotes(generated2, notes2);
  }).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "generated2",
      site: generated2.site,
      name: generated2.name,
      revision: generated2.revision,
      length: generated2.length,
      lower: generated2.lower,
      upper: generated2.upper,
      number: generated2.number,
      symbol: generated2.symbol,
      notes: notes2
    }]);

    return passwords.getNotes(generated2);
  }).then(notes =>
  {
    test.equal(notes, notes2);

    return passwords.setNotes(generated2, null);
  }).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "generated2",
      site: generated2.site,
      name: generated2.name,
      revision: generated2.revision,
      length: generated2.length,
      lower: generated2.lower,
      upper: generated2.upper,
      number: generated2.number,
      symbol: generated2.symbol
    }]);

    return Promise.all([pwdList, passwords.getPasswords(generated2.site)]);
  }).then(([pwdList, [origSite, site, pwdList2]]) =>
  {
    test.deepEqual(pwdList2, pwdList);

    return passwords.setNotes(generated2, null);
  }).then(pwdList =>
  {
    test.deepEqual(pwdList, [{
      type: "generated2",
      site: generated2.site,
      name: generated2.name,
      revision: generated2.revision,
      length: generated2.length,
      lower: generated2.lower,
      upper: generated2.upper,
      number: generated2.number,
      symbol: generated2.symbol
    }]);
    return passwords.getNotes(generated2);
  }).then(notes =>
  {
    test.equal(notes, null);
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testAllPasswords = function(test)
{
  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(pwdList =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {});

    return passwords.addGenerated(generated1);
  }).then(pwdList =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "generated2",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: []
      }
    });

    return passwords.addStored(stored2);
  }).then(pwdList =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "stored",
          site: stored2.site,
          name: stored2.name,
          password: stored2.password,
          notes: stored2.notes
        }, {
          type: "generated2",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: []
      }
    });

    return Promise.all([
      passwords.addAlias("example.info", generated1.site),
      passwords.addAlias("sub1.example.info", generated1.site),
      passwords.addAlias("sub2.example.info", "sub." + generated2.site),
      passwords.addGenerated(Object.assign({}, generated2, {site: "sub." + generated2.site}))
    ]);
  }).then(() =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "stored",
          site: stored2.site,
          name: stored2.name,
          password: stored2.password,
          notes: stored2.notes
        }, {
          type: "generated2",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: ["example.info", "sub1.example.info"]
      },
      ["sub." + generated2.site]: {
        site: "sub." + generated2.site,
        passwords: [{
          type: "generated2",
          site: "sub." + generated2.site,
          name: generated2.name,
          revision: generated2.revision,
          length: generated2.length,
          lower: generated2.lower,
          upper: generated2.upper,
          number: generated2.number,
          symbol: generated2.symbol,
          notes: generated2.notes
        }],
        aliases: ["sub2.example.info"]
      }
    });

    return passwords.setNotes(stored2, "foobarnotes");
  }).then(pwdList =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "stored",
          site: stored2.site,
          name: stored2.name,
          password: stored2.password,
          notes: "foobarnotes"
        }, {
          type: "generated2",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: ["example.info", "sub1.example.info"]
      },
      ["sub." + generated2.site]: {
        site: "sub." + generated2.site,
        passwords: [{
          type: "generated2",
          site: "sub." + generated2.site,
          name: generated2.name,
          revision: generated2.revision,
          length: generated2.length,
          lower: generated2.lower,
          upper: generated2.upper,
          number: generated2.number,
          symbol: generated2.symbol,
          notes: generated2.notes
        }],
        aliases: ["sub2.example.info"]
      }
    });

    return passwords.removePassword({site: "sub." + generated2.site, name: generated2.name, revision: generated2.revision});
  }).then(pwdList =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "stored",
          site: stored2.site,
          name: stored2.name,
          password: stored2.password,
          notes: "foobarnotes"
        }, {
          type: "generated2",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: ["example.info", "sub1.example.info"]
      }
    });
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testExport = function(test)
{
  function checkExport(test, exportData)
  {
    let parsed = JSON.parse(exportData);
    test.equal(parsed.application, "pfp");
    test.equal(parsed.format, 3);
    test.ok(typeof parsed.data == "object");
    test.ok(parsed.data["salt"]);
    test.ok(parsed.data["hmac-secret"]);

    return storage.deleteByPrefix("").then(() =>
    {
      return masterPassword.changePassword(dummyMaster);
    }).then(() =>
    {
      return passwords.importPasswordData(exportData);
    }).then(() =>
    {
      return passwords.getAllPasswords();
    });
  }

  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.exportPasswordData();
  }).then(exportData =>
  {
    return checkExport(test, exportData);
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {});

    return passwords.addGenerated(generated1);
  }).then(pwdList =>
  {
    return passwords.exportPasswordData();
  }).then(exportData =>
  {
    return checkExport(test, exportData);
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "generated2",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: []
      }
    });

    return passwords.addGenerated(generated2);
  }).then(pwdList =>
  {
    return passwords.exportPasswordData();
  }).then(exportData =>
  {
    return checkExport(test, exportData);
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "generated2",
          site: generated2.site,
          name: generated2.name,
          revision: generated2.revision,
          length: generated2.length,
          lower: generated2.lower,
          upper: generated2.upper,
          number: generated2.number,
          symbol: generated2.symbol,
          notes: generated2.notes
        },
        {
          type: "generated2",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: []
      }
    });

    return Promise.all([
      passwords.addAlias("example.info", generated1.site),
      passwords.addStored(stored2)
    ]);
  }).then(() =>
  {
    return passwords.exportPasswordData();
  }).then(exportData =>
  {
    return checkExport(test, exportData);
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "stored",
          site: stored2.site,
          name: stored2.name,
          password: stored2.password,
          notes: stored2.notes
        }, {
          type: "generated2",
          site: generated2.site,
          name: generated2.name,
          revision: generated2.revision,
          length: generated2.length,
          lower: generated2.lower,
          upper: generated2.upper,
          number: generated2.number,
          symbol: generated2.symbol,
          notes: generated2.notes
        }, {
          type: "generated2",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }],
        aliases: ["example.info"]
      }
    });

    return passwords.setNotes(generated2, "foobarnotes");
  }).then(() =>
  {
    return passwords.exportPasswordData();
  }).then(exportData =>
  {
    return checkExport(test, exportData);
  }).then(allPasswords =>
  {
    return passwords.getNotes(generated2);
  }).then(notes =>
  {
    test.equal(notes, "foobarnotes");
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testDecryptingImport = function(test)
{
  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    let atob = str => Buffer.from(str, "base64").toString("binary");
    let btoa = str => Buffer.from(str, "binary").toString("base64");
    let salt = "asdf";
    let hmacSecret = "fdsa";
    let key = "4MgE2P1PbjLyAz7JxczGjOPNtaaqNKofAmGSbNvRtUM=";
    let iv = "fakeivwhatever";
    let cryptoPrefix = "AES-GCM!" + atob(key) + "!" + iv + "!";
    let hmacPrefix = "HMAC!" + hmacSecret + "!";
    let encrypt = data => btoa(iv) + "_" + btoa(cryptoPrefix + JSON.stringify(data));
    let digest = data => btoa(hmacPrefix + data);

    return passwords.importPasswordData(JSON.stringify({
      application: "pfp",
      format: 2,
      data: {
        salt: btoa(salt),
        "hmac-secret": encrypt(btoa(hmacSecret)),
        [`site:${digest(generated1.site)}`]: encrypt({
          site: generated1.site
        }),
        [`site:${digest(generated1.site)}:${digest(generated1.site + "\0" + generated1.name + "\0")}`]: encrypt({
          type: "generated2",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }),
        [`site:${digest(generated2.site)}:${digest(generated2.site + "\0" + generated2.name + "\0" + generated2.revision)}`]: encrypt({
          type: "generated2",
          site: generated2.site,
          name: generated2.name,
          revision: generated2.revision,
          length: generated2.length,
          lower: generated2.lower,
          upper: generated2.upper,
          number: generated2.number,
          symbol: generated2.symbol,
          notes: generated2.notes
        }),
        [`site:${digest(generated3.site)}:${digest(generated3.site + "\0" + generated3.name + "\0" + generated3.revision)}`]: encrypt({
          type: generated3.type,
          site: generated3.site,
          name: generated3.name,
          revision: generated3.revision,
          length: generated3.length,
          lower: generated3.lower,
          upper: generated3.upper,
          number: generated3.number,
          symbol: generated3.symbol,
          notes: generated3.notes
        }),
        [`site:${digest("sub." + generated1.site)}`]: encrypt({
          site: "sub." + generated1.site,
          alias: generated1.site
        })
      }
    }));
  }).then(() =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "generated2",
          site: generated2.site,
          name: generated2.name,
          revision: generated2.revision,
          length: generated2.length,
          lower: generated2.lower,
          upper: generated2.upper,
          number: generated2.number,
          symbol: generated2.symbol,
          notes: generated2.notes
        },
        {
          type: "generated2",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        },
        {
          type: "stored",
          site: generated3.site,
          name: generated3.name,
          revision: generated3.revision,
          password: generated3.password,
          notes: generated3.notes
        }],
        aliases: ["sub." + generated1.site]
      }
    });
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testConvertingImport = function(test)
{
  let backupMaster = dummyMaster + dummyMaster;
  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    let atob = str => Buffer.from(str, "base64").toString("binary");
    let btoa = str => Buffer.from(str, "binary").toString("base64");
    let salt = "asdf";
    let hmacSecret = "fdsa";
    let key = "gLrcDLgglH8KOr5bM3AhX5ARWD3ZvfKsqy76wpkDkLo=";
    let iv = "fakeivwhatever";
    let cryptoPrefix = "AES-GCM!" + atob(key) + "!" + iv + "!";
    let hmacPrefix = "HMAC!" + hmacSecret + "!";
    let encrypt = data => btoa(iv) + "_" + btoa(cryptoPrefix + JSON.stringify(data));
    let digest = data => btoa(hmacPrefix + data);

    return passwords.importPasswordData(JSON.stringify({
      application: "pfp",
      format: 3,
      data: {
        salt: btoa(salt),
        "hmac-secret": encrypt(btoa(hmacSecret)),
        [`site:${digest(generated1.site)}`]: encrypt({
          site: generated1.site
        }),
        [`site:${digest(generated1.site)}:${digest(generated1.site + "\0" + generated1.name + "\0")}`]: encrypt({
          type: "generated2",
          site: generated1.site,
          name: generated1.name,
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }),
        [`site:${digest(generated2.site)}:${digest(generated2.site + "\0" + generated2.name + "\0" + generated2.revision)}`]: encrypt({
          type: "generated2",
          site: generated2.site,
          name: generated2.name,
          revision: generated2.revision,
          length: generated2.length,
          lower: generated2.lower,
          upper: generated2.upper,
          number: generated2.number,
          symbol: generated2.symbol
        }),
        [`site:${digest(stored2.site)}:${digest(stored2.site + "\0" + stored2.name + "\0rev2")}`]: encrypt({
          type: "stored",
          site: stored2.site,
          name: stored2.name,
          revision: "rev2",
          password: stored2.password,
          notes: stored2.notes
        }),
        [`site:${digest(generated3.site)}:${digest(generated3.site + "\0" + generated3.name + "\0" + generated3.revision)}`]: encrypt({
          type: generated3.type,
          site: generated3.site,
          name: generated3.name,
          revision: generated3.revision,
          length: generated3.length,
          lower: generated3.lower,
          upper: generated3.upper,
          number: generated3.number,
          symbol: generated3.symbol,
          notes: generated3.notes
        }),
        [`site:${digest("sub." + generated1.site)}`]: encrypt({
          site: "sub." + generated1.site,
          alias: generated1.site
        })
      }
    }), backupMaster);
  }).then(() =>
  {
    return Promise.all([
      passwords.getAllPasswords(),
      crypto.derivePassword(Object.assign({
        masterPassword: backupMaster,
        domain: generated1.site
      }, generated1)),
      crypto.derivePassword(Object.assign({
        masterPassword: backupMaster,
        domain: generated2.site
      }, generated2)),
      crypto.derivePasswordLegacy(Object.assign({
        masterPassword: backupMaster,
        domain: generated3.site
      }, generated3))
    ]);
  }).then(([allPasswords, generated1result, generated2result, generated3result]) =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "stored",
          site: generated2.site,
          name: generated2.name,
          revision: generated2.revision,
          password: generated2result
        },
        {
          type: "stored",
          site: stored2.site,
          name: stored2.name,
          revision: "rev2",
          password: stored2.password,
          notes: stored2.notes
        },
        {
          type: "stored",
          site: generated1.site,
          name: generated1.name,
          password: generated1result
        },
        {
          type: "stored",
          site: generated3.site,
          name: generated3.name,
          revision: generated3.revision,
          password: generated3result,
          notes: generated3.notes
        }],
        aliases: ["sub." + generated1.site]
      }
    });
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testLastPassImport = function(test)
{
  function addHeader(contents)
  {
    return "url,username,password,extra,name,grouping,fav\n" + contents.trim();
  }

  Promise.resolve().then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.importPasswordData(
      addHeader(`
http://example.com,2,3,4,5,6,7
http://example.com,bar
      `)
    );
  }).then(() =>
  {
    test.ok(false, "Imported LastPass CSV which has the wrong number of values.");
  }).catch(expectedValue.bind(test, "syntax_error")).then(() =>
  {
    return passwords.importPasswordData(
      addHeader(`
http://example.com,2,3,4,"5,6,7
      `)
    );
  }).then(() =>
  {
    test.ok(false, "Imported LastPass CSV with dangling quote.");
  }).catch(expectedValue.bind(test, "syntax_error")).then(() =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {});
  }).then(() =>
  {
    return passwords.importPasswordData(addHeader(`
http://a.com,user,password,note,name,,
http://a.com,user,another password,note,name,,
http://a.com,user,another password,,another name,,
http://a.com,anotheruser,password,,name44,,
http://a.com,anotheruser,another password,,name44,,
http://a.com,user,password,,,,
http://a.com,user,another password,,,,
,user,password,note,b.com,,
junk,user,password,note,c.com,,
,user,password,note,dcom,,
,user,password,note,e.com/path,,
,user,password,note,This is f.com,,
http://f.com,,password,note,,,
http://sn,user,password,note,g.com,,
http://www.h.com,user,password,note,,,
http://i.com,,,note,name,,
http://j.com,,password,note,name,,
http://k.com,,password,,name,,
http://l.com,user,,,name,,
https://m.m.com/path?query,user,password,"before""in
side""""&amp;&lt;&gt;""after&amp;lt;",name,,
    `));
  }).then(() =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      "a.com": {
        site: "a.com",
        passwords: [{
          site: "a.com",
          type: "stored",
          name: "anotheruser",
          revision: "name44",
          password: "password"
        }, {
          site: "a.com",
          type: "stored",
          name: "anotheruser",
          revision: "name45",
          password: "another password"
        }, {
          site: "a.com",
          type: "stored",
          name: "user",
          revision: "",
          password: "password"
        }, {
          site: "a.com",
          type: "stored",
          name: "user",
          revision: "2",
          password: "another password"
        }, {
          site: "a.com",
          type: "stored",
          name: "user",
          revision: "another name",
          password: "another password"
        }, {
          site: "a.com",
          type: "stored",
          name: "user",
          revision: "name",
          password: "password",
          notes: "note"
        }, {
          site: "a.com",
          type: "stored",
          name: "user",
          revision: "name2",
          password: "another password",
          notes: "note"
        }],
        aliases: []
      },
      "b.com": {
        site: "b.com",
        passwords: [{
          site: "b.com",
          type: "stored",
          name: "user",
          revision: "",
          password: "password",
          notes: "note"
        }],
        aliases: []
      },
      "c.com": {
        site: "c.com",
        passwords: [{
          site: "c.com",
          type: "stored",
          name: "user",
          revision: "",
          password: "password",
          notes: "note"
        }],
        aliases: []
      },
      "pfp.invalid": {
        site: "pfp.invalid",
        passwords: [{
          site: "pfp.invalid",
          type: "stored",
          name: "user",
          revision: "g.com",
          password: "password",
          notes: "note"
        }],
        aliases: []
      },
      "h.com": {
        site: "h.com",
        passwords: [{
          site: "h.com",
          type: "stored",
          name: "user",
          revision: "",
          password: "password",
          notes: "note"
        }],
        aliases: []
      },
      "i.com": {
        site: "i.com",
        passwords: [{
          site: "i.com",
          type: "stored",
          name: "name",
          revision: "",
          password: "",
          notes: "note"
        }],
        aliases: []
      },
      "j.com": {
        site: "j.com",
        passwords: [{
          site: "j.com",
          type: "stored",
          name: "name",
          revision: "",
          password: "password",
          notes: "note"
        }],
        aliases: []
      },
      "k.com": {
        site: "k.com",
        passwords: [{
          site: "k.com",
          type: "stored",
          name: "name",
          revision: "",
          password: "password"
        }],
        aliases: []
      },
      "m.m.com": {
        site: "m.m.com",
        passwords: [{
          site: "m.m.com",
          type: "stored",
          name: "user",
          revision: "name",
          password: "password",
          notes: 'before"in\nside""&<>"after&lt;'
        }],
        aliases: []
      }
    });
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};

exports.testImportErrors = function(test)
{
  Promise.resolve().then(() =>
  {
    return passwords.importPasswordData("foobar");
  }).then(() =>
  {
    test.ok(false, "Imported malformed JSON");
  }).catch(expectedValue.bind(test, "unknown_data_format")).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify(42));
  }).then(() =>
  {
    test.ok(false, "Imported non-object");
  }).catch(expectedValue.bind(test, "unknown_data_format")).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify({
      application: "foobar",
      format: 3,
      data: {
        salt: "asdf",
        "hmac-secret": "fdsa"
      }
    }));
  }).then(() =>
  {
    test.ok(false, "Imported unknown application data");
  }).catch(expectedValue.bind(test, "unknown_data_format")).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify({
      application: "pfp",
      format: 33,
      data: {
        salt: "asdf",
        "hmac-secret": "fdsa"
      }
    }));
  }).then(() =>
  {
    test.ok(false, "Imported unknown format version");
  }).catch(expectedValue.bind(test, "unknown_data_format")).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify({
      application: "pfp",
      format: 3,
      data: null
    }));
  }).then(() =>
  {
    test.ok(false, "Imported null data");
  }).catch(expectedValue.bind(test, "unknown_data_format")).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify({
      application: "pfp",
      format: 3,
      data: {}
    }));
  }).then(() =>
  {
    test.ok(false, "Imported empty data");
  }).catch(expectedValue.bind(test, "unknown_data_format")).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify({
      application: "pfp",
      format: 3,
      data: {
        salt: "asdf"
      }
    }));
  }).then(() =>
  {
    test.ok(false, "Imported data without HMAC secret");
  }).catch(expectedValue.bind(test, "unknown_data_format")).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify({
      application: "pfp",
      format: 3,
      data: {
        "hmac-secret": "fdsa"
      }
    }));
  }).then(() =>
  {
    test.ok(false, "Imported data without salt");
  }).catch(expectedValue.bind(test, "unknown_data_format")).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify({
      application: "pfp",
      format: 3,
      data: {
        salt: "asdf",
        "hmac-secret": "fdsa"
      }
    }));
  }).then(() =>
  {
    test.ok(false, "Imported data without knowing master password");
  }).catch(expectedValue.bind(test, "master_password_required")).then(() =>
  {
    return masterPassword.changePassword(dummyMaster);
  }).then(() =>
  {
    return passwords.importPasswordData(JSON.stringify({
      application: "pfp",
      format: 3,
      data: {
        salt: "asdf",
        "hmac-secret": "fakeiv_" + btoa("AES-GCM!fakekey!fakeiv!\"fdsa\"")
      }
    }));
  }).then(() =>
  {
    test.ok(false, "Imported data not matching master password");
  }).catch(expectedValue.bind(test, "wrong_master_password")).then(() =>
  {
    return passwords.importPasswordData("url,username,password\n");
  }).then(() =>
  {
    test.ok(false, "Imported LastPass CSV with incorrect header");
  }).catch(expectedValue.bind(test, "unknown_data_format")).then(done.bind(test));
};

exports.testMigration = function(test)
{
  let atob = str => Buffer.from(str, "base64").toString("binary");
  let btoa = str => Buffer.from(str, "binary").toString("base64");
  let userid = "user:SE1BQyFhc2RmIWZvb2Jhcg==/";
  let salt = "asdf";
  let hmacSecret = "fdsa";
  let key = "4MgE2P1PbjLyAz7JxczGjOPNtaaqNKofAmGSbNvRtUM=";
  let iv = "fakeivwhatever";
  let cryptoPrefix = "AES-GCM!" + atob(key) + "!" + iv + "!";
  let hmacPrefix = "HMAC!" + hmacSecret + "!";
  let encrypt = data => btoa(iv) + "_" + btoa(cryptoPrefix + JSON.stringify(data));
  let digest = data => btoa(hmacPrefix + data);

  let {storageData} = browserAPI;
  storageData["usersalt"] = btoa(salt);
  storageData[`${userid}salt`] = btoa(salt);
  storageData[`${userid}hmac-secret`] = encrypt(btoa(hmacSecret));

  function setPassword(passwordData)
  {
    storageData[`${userid}site:${digest(passwordData.site)}`] = encrypt({site: passwordData.site});
    storageData[`${userid}site:${digest(passwordData.site)}:${digest(passwordData.site + "\0" + passwordData.name + "\0" + (passwordData.revision || ""))}`] = encrypt(passwordData);
  }

  setPassword({
    site: generated1.site,
    name: generated1.name,
    revision: "",
    type: "generated2",
    length: generated1.length,
    lower: generated1.lower,
    upper: generated1.upper,
    number: generated1.number,
    symbol: generated1.symbol
  });
  setPassword({
    site: generated2.site,
    name: generated2.name,
    revision: generated2.revision,
    type: "generated2",
    length: generated2.length,
    lower: generated2.lower,
    upper: generated2.upper,
    number: generated2.number,
    symbol: generated2.symbol,
    notes: generated2.notes
  });
  setPassword({
    site: generated3.site,
    name: generated3.name,
    revision: generated3.revision,
    type: "generated",
    length: generated3.length,
    lower: generated3.lower,
    upper: generated3.upper,
    number: generated3.number,
    symbol: generated3.symbol,
    notes: generated3.notes
  });
  setPassword({
    site: generated4.site,
    name: generated4.name,
    revision: "",
    type: "generated",
    length: generated4.length,
    lower: generated4.lower,
    upper: generated4.upper,
    number: generated4.number,
    symbol: generated4.symbol
  });
  setPassword({
    site: stored2.site,
    name: stored2.name,
    revision: "",
    type: "stored",
    password: stored2.password,
    notes: stored2.notes
  });

  storageData[`${userid}site:${digest("sub." + generated4.site)}`] = encrypt({
    site: "sub." + generated4.site,
    alias: generated4.site
  });

  Promise.resolve().then(() =>
  {
    return masterPassword.checkPassword(dummyMaster);
  }).then(() =>
  {
    test.ok(false, "Checking master password didn't trigger migration");
  }).catch(expectedValue.bind(test, "migrating")).then(() =>
  {
    function checkState()
    {
      return masterPassword.getState().then(state =>
      {
        if (state != "migrating")
          return state;

        return new Promise((resolve, reject) =>
        {
          setTimeout(() =>
          {
            resolve(checkState());
          }, 10);
        });
      });
    }

    return checkState();
  }).then(expectedValue.bind(test, "known")).then(() =>
  {
    return passwords.getAllPasswords();
  }).then(allPasswords =>
  {
    test.deepEqual(allPasswords, {
      [generated1.site]: {
        site: generated1.site,
        passwords: [{
          type: "stored",
          site: stored2.site,
          name: stored2.name,
          revision: "",
          password: stored2.password,
          notes: stored2.notes
        }, {
          type: "generated2",
          site: generated2.site,
          name: generated2.name,
          revision: generated2.revision,
          length: generated2.length,
          lower: generated2.lower,
          upper: generated2.upper,
          number: generated2.number,
          symbol: generated2.symbol,
          notes: generated2.notes
        }, {
          type: "generated2",
          site: generated1.site,
          name: generated1.name,
          revision: "",
          length: generated1.length,
          lower: generated1.lower,
          upper: generated1.upper,
          number: generated1.number,
          symbol: generated1.symbol
        }, {
          type: "stored",
          site: generated3.site,
          name: generated3.name,
          revision: generated3.revision,
          password: generated3.password,
          notes: generated3.notes
        }],
        aliases: []
      },
      [generated4.site]: {
        site: generated4.site,
        passwords: [{
          type: "stored",
          site: generated4.site,
          name: generated4.name,
          revision: "",
          password: generated4.password
        }],
        aliases: ["sub." + generated4.site]
      }
    });
    return masterPassword.forgetPassword();
  }).then(() =>
  {
    return masterPassword.checkPassword(dummyMaster);
  }).then(() =>
  {
    return masterPassword.getState();
  }).then(state =>
  {
    test.equal(state, "known", "No repeated migration on next login");
  }).catch(unexpectedError.bind(test)).then(done.bind(test));
};
