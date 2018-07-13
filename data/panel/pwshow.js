/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let {setSubmitHandler} = require("./events");
let state = require("./state");
let {$, getActivePanel, setSiteName, setActivePanel} = require("./utils");

let originalSelection = null;

state.on("update", updateSiteName);
updateSiteName();

function updateSiteName()
{
  setSiteName("pwshow-website-name");
}

setSubmitHandler("pwshow", () =>
{
  if (originalSelection)
    setActivePanel(originalSelection);
});

function show(password, text)
{
  $("pwshow-user-name").textContent = password.name;
  $("pwshow-password-text").setAttribute("value", text);

  let revisionField = $("pwshow-password-revision");
  revisionField.hidden = !password.revision;
  revisionField.textContent = password.revision;

  originalSelection = getActivePanel();
  setActivePanel("pwshow");
}
exports.show = show;
