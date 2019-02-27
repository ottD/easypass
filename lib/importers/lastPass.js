/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

function parseCSV(fileContents)
{
  const header = "url,username,password,extra,name,grouping,fav";
  const headerFields = header.split(",");

  fileContents = fileContents.trim() + "\n";

  // Ensure we've got UNIX style line endings
  fileContents = fileContents.replace(/\r\n/g, "\n");

  // Quick sanity check, does this file have the right header?
  if (!fileContents.startsWith(header + "\n"))
    throw "unknown_data_format";

  // LastPass will sometimes encode "&", "<" and ">" into HTML entities when
  // exporting data, revert that.
  fileContents = fileContents.replace(/&lt;/ig, "<")
                             .replace(/&gt;/ig, ">")
                             .replace(/&amp;/ig, "&");

  const quotedValueRegexp = /^"((?:[^"]|"")*)"(?:,|(?=\n))/;
  const unquotedValueRegexp = /(.*?)(?:,|(?=\n))/;
  let entries = [];
  let currentEntry = [];
  let prevChar = null;

  while (fileContents)
  {
    if (fileContents[0] == "\n")
    {
      // End of current entry
      if (prevChar == ",")
      {
        currentEntry.push("");
        prevChar = null;
      }
      if (currentEntry.length != headerFields.length)
      {
        console.error(
          new Error("Syntax error, unexpected number of values in a line\n" +
                    JSON.stringify(currentEntry))
        );
        throw "syntax_error";
      }

      let entry = {};
      for (let j = 0; j < headerFields.length; j++)
        entry[headerFields[j]] = currentEntry[j];
      entries.push(entry);
      currentEntry = [];
      fileContents = fileContents.substr(1);
    }
    else
    {
      let quoted = (fileContents[0] == '"');
      let regexp = (quoted ? quotedValueRegexp : unquotedValueRegexp);
      let match = regexp.exec(fileContents);
      if (!match)
      {
        console.error(new Error("Syntax error, could not find end of value\n" +
                      fileContents.replace(/\n.*/, "")));
        throw "syntax_error";
      }
      prevChar = match[0].slice(-1);
      currentEntry.push(quoted ? match[1].replace(/""/g, '"') : match[1]);
      fileContents = fileContents.substr(match[0].length);
    }
  }

  return entries;
}

function getSite(url, passwordName)
{
  if (url == "http://sn")
  {
    // This is a secure note, not associated with any website
    return "pfp.invalid";
  }

  try
  {
    return new URL(url).hostname;
  }
  catch (e)
  {
    // Ignore invalid URLs, LastPass doesn't validate them
  }

  // No valid URL, but maybe password name is the site here
  if (passwordName.includes(".") && !/[\s/]/.test(passwordName))
    return passwordName;

  return null;
}

function import_(data, setRaw, setSite, setPassword)
{
  return Promise.resolve().then(() =>
  {
    let mergeActions = [];

    let seenSites = new Set();
    let seenPasswords = new Set();
    let entries = parseCSV(data);
    for (let {url, username, password, extra, name} of entries)
    {
      let site = getSite(url, name);
      if (!site)
      {
        // TODO: Warn user about skipped entries
        continue;
      }

      // FIXME - Duplicated from _normalizeSite in passwords.js
      // Remove trailing dots
      if (site[site.length - 1] == ".")
        site = site.substr(0, site.length - 1);

      // Remove www. prefix
      if (site.substr(0, 4) == "www.")
        site = site.substr(4);

      // No username can happen for secure notes, use password name as fallback
      if (!username)
        username = name;
      if (!username)
      {
        // TODO: Warn user about skipped entries
        continue;
      }

      if (!seenSites.has(site))
      {
        mergeActions.push(setSite({site}));
        seenSites.add(site);
      }

      if (extra || password)
      {
        let revision = "";
        if (name && name != site && name != username)
          revision = name;
        while (seenPasswords.has(JSON.stringify([site, username, revision])))
        {
          let match = /^(.*?)(\d+)/.exec(revision);
          if (match)
            revision = match[1] + (parseInt(match[2], 10) + 1);
          else
            revision += "2";
        }
        seenPasswords.add(JSON.stringify([site, username, revision]));

        let entry = {site, type: "stored", name: username, revision, password};
        if (extra)
          entry.notes = extra;
        mergeActions.push(setPassword(entry));
      }
    }
    return Promise.all(mergeActions);
  });
}
exports.import = import_;
