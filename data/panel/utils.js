/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

function $(id)
{
  return document.getElementById(id);
}
exports.$ = $;

function setFocus()
{
  let activePanel = getActivePanel();
  if (!activePanel)
    return;

  let defaultElement = $(activePanel).getAttribute("data-default-element");
  if (defaultElement)
    $(defaultElement).focus();
  else
    document.documentElement.focus();
}

function resetForm(form)
{
  require("./events").disableResetHandlers = true;
  try
  {
    form.reset();
    let custom = form.dataset.customReset;
    if (custom)
    {
      for (let statement of custom.split(/\s*,\s*/))
      {
        let match = /^([^.]+)\.([^=]+)(?:=(.*))?/.exec(statement);
        if (match && match[3])
          $(match[1]).setAttribute(match[2], match[3]);
        else if (match)
          $(match[1]).removeAttribute(match[2]);
      }
    }
    require("./formValidation").updateForm(form);
  }
  finally
  {
    require("./events").disableResetHandlers = false;
  }
}

function getActivePanel()
{
  let selection = document.querySelector("[data-active='true']");
  return selection ? selection.id : null;
}
exports.getActivePanel = getActivePanel;

function setActivePanel(id, noReset)
{
  let oldSelection = getActivePanel();
  if (oldSelection == id)
    return;

  if (oldSelection)
    $(oldSelection).removeAttribute("data-active");

  if (id)
  {
    let form = $(id);
    if (!noReset)
      resetForm(form);
    form.setAttribute("data-active", "true");
    $("unknown-error").hidden = true;

    setFocus();
  }
}
exports.setActivePanel = setActivePanel;

function setSiteName(element)
{
  if (typeof element == "string")
    element = $(element);

  let {site, siteDisplayName} = require("./state");
  element.textContent = siteDisplayName;
  if (site != siteDisplayName)
    element.classList.add("special-site");
  else
    element.classList.remove("special-site");
}
exports.setSiteName = setSiteName;

function showUnknownError(e)
{
  $("unknown-error-details").textContent = e;
  $("unknown-error").hidden = false;
  $("unknown-error-more").hidden = false;
  $("unknown-error-details").hidden = true;
}
exports.showUnknownError = showUnknownError;

// Avoid circular references here
Promise.resolve().then(() =>
{
  require("./events").setCommandHandler("unknown-error-more", () =>
  {
    $("unknown-error-more").hidden = true;
    $("unknown-error-details").hidden = false;
  });
});
