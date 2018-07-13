/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let {EventTarget, emit} = require("../../lib/eventTarget");

module.exports = exports = new EventTarget();
exports.site = null;
exports.origSite = null;
exports.siteDisplayName = null;
exports.pwdList = null;
exports.masterPasswordState = null;

let stateToPanel = {
  "unset": ["change-master"],
  "set": ["enter-master", "change-master"],
  "migrating": ["migration"],
  "known": ["password-list", "generate-password", "stored-password", "recovery-code", "pwshow", "sync-setup", "sync-state", "confirm"]
};

function set(state)
{
  for (let key of Object.keys(state))
    exports[key] = state[key];

  if ("site" in state)
    exports.siteDisplayName = require("../common").getSiteDisplayName(state.site);

  if ("masterPasswordState" in state)
  {
    let {getActivePanel, setActivePanel} = require("./utils");
    let panels = stateToPanel[state.masterPasswordState];
    if (panels.indexOf(getActivePanel()) < 0)
      setActivePanel(panels[0]);
  }

  emit(exports, "update");
}
exports.set = set;
