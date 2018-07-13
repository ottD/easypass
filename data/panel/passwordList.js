/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let {i18n} = require("../browserAPI");
let {passwords, masterPassword, passwordRetrieval, ui} = require("../proxy");
let {setCommandHandler, setSubmitHandler} = require("./events");
let siteSelection = require("./siteSelection");
let state = require("./state");
let {$, setActivePanel, setSiteName, showUnknownError} = require("./utils");

let {confirm} = require("./confirm");

let hidePasswordMessagesTimeout = null;

let selectSiteElement = $("select-site");
selectSiteElement.setAttribute("title", selectSiteElement.textContent);
selectSiteElement.textContent = "";
setCommandHandler(selectSiteElement, selectSite);

setCommandHandler("add-alias", addAlias);
setCommandHandler("remove-alias", removeAlias);
setCommandHandler("show-all", () =>
{
  ui.showAllPasswords()
    .then(() => window.close())
    .catch(showUnknownError);
});
setCommandHandler("lock-passwords", () =>
{
  masterPassword.forgetPassword()
    .then(() => state.set({masterPasswordState: "set"}))
    .catch(showUnknownError);
});

let menuPassword = null;
setCommandHandler("menu-to-document", () => fillInPassword(menuPassword));
setCommandHandler("menu-to-clipboard", () => copyToClipboard(menuPassword));
setCommandHandler("menu-pwshow", () => showPw(menuPassword));
setCommandHandler("menu-notes", () => showNotes(menuPassword));
setCommandHandler("menu-upgrade-password", () => upgradePassword(menuPassword));
setCommandHandler("menu-make-generated", () => makeGenerated(menuPassword));
setCommandHandler("menu-bump-revision", () => bumpRevision(menuPassword));
setCommandHandler("menu-password-remove", () => removePassword(menuPassword));
$("password-menu").addEventListener("click", hideMenu);
$("pwshow-password-text").addEventListener("mouseup", event => $("pwshow-password-text").select());

removeWhitespace($("password-template"));

let menu = $("password-menu");
menu.parentNode.removeChild(menu);
menu.removeAttribute("hidden");

hidePasswordMessages();

state.on("update", initPasswordList);
initPasswordList();

function initPasswordList()
{
  setSite();
  showPasswords();
}

function setSite()
{
  let {origSite, site, masterPasswordState} = state;

  if (origSite != site)
  {
    let aliasText = $("alias-text");
    if (!aliasText.hasAttribute("data-template"))
      aliasText.setAttribute("data-template", aliasText.textContent);
    aliasText.textContent = aliasText.getAttribute("data-template").replace(/\{1\}/g, origSite);

    $("alias-container").hidden = false;
  }
  else
    $("alias-container").hidden = true;

  $("add-alias").hidden = (!site || origSite != site || site == "pfp.invalid" || state.pwdList.length);

  let field = $("password-list-site");
  setSiteName(field);
  $("generate-password-link").hidden = $("stored-password-link").hidden = !site;

  if (masterPasswordState == "known" && !site)
    selectSite();
}

function hidePasswordMessages()
{
  if (hidePasswordMessagesTimeout)
    window.clearTimeout(hidePasswordMessagesTimeout);
  hidePasswordMessagesTimeout = null;

  for (let id of ["password_ready_message", "password_copied_message", "no_such_password", "unknown_generation_method", "wrong_site_message", "no_password_fields"])
    $(id).hidden = true;
}

function showPasswordMessage(error)
{
  hidePasswordMessages();

  let element = $(error);
  if (!element)
  {
    showUnknownError(error);
    return;
  }

  element.hidden = false;

  hidePasswordMessagesTimeout = window.setTimeout(hidePasswordMessages, 3000);
}

function selectSite()
{
  let message = i18n.getMessage("select_site");
  siteSelection.show(message).then(site =>
  {
    passwords.getPasswords(site)
      .then(([origSite, site, pwdList]) => state.set({origSite, site, pwdList}))
      .catch(showUnknownError);
  }).catch(() =>
  {
    // User cancelled
  });
}

function addAlias()
{
  let {origSite} = state;
  let message = i18n.getMessage("select_alias").replace(/\{1\}/g, origSite);
  siteSelection.show(message).then(alias =>
  {
    if (alias == origSite)
      return;

    passwords.addAlias(origSite, alias)
      .then(() => passwords.getPasswords(state.origSite))
      .then(([origSite, site, pwdList]) => state.set({origSite, site, pwdList}))
      .catch(showUnknownError);
  }).catch(() =>
  {
    // User cancelled
  });
}

function removeAlias()
{
  let {origSite, siteDisplayName} = state;
  let message = i18n.getMessage("remove_alias_confirmation").replace(/\{1\}/g, origSite).replace(/\{2\}/g, siteDisplayName);
  confirm(message).then(response =>
  {
    if (response)
    {
      passwords.removeAlias(origSite)
        .then(() => passwords.getPasswords(origSite))
        .then(([origSite, site, pwdList]) => state.set({origSite, site, pwdList}))
        .catch(showUnknownError);
    }
  });
}

function showPasswords()
{
  hideMenu();

  let pwdList = state.pwdList;
  if (!pwdList)
    return;

  let list = $("password-list-container");
  while (list.lastChild && !list.lastChild.id)
    list.removeChild(list.lastChild);

  if (pwdList.length)
  {
    let template = $("password-template").firstElementChild;
    let links = template.querySelectorAll("a");
    for (let i = 0; i < links.length; i++)
    {
      let link = links[i];
      if (link.textContent)
      {
        link.setAttribute("title", link.textContent);
        link.textContent = "";
      }
    }

    for (let password of pwdList)
    {
      let tooltip;
      if (password.type == "generated2" || password.type == "generated")
      {
        tooltip = i18n.getMessage("password_type_" + password.type);
        if (password.type == "generated")
          tooltip += "\n" + i18n.getMessage("password_type_generated_replace");

        tooltip += "\n" + document.querySelector('label[for="password-length"]').textContent;
        tooltip += " " + password.length;

        tooltip += "\n" + document.querySelector('label[for="charset-lower"]').textContent;
        if (password.lower)
          tooltip += " " + "abc";
        if (password.upper)
          tooltip += " " + "XYZ";
        if (password.number)
          tooltip += " " + "789";
        if (password.symbol)
          tooltip += " " + "+^;";
      }
      else if (password.type == "stored")
        tooltip = i18n.getMessage("password_type_stored");

      if (password.notes)
        tooltip += "\n" + i18n.getMessage("password_info_notes") + " " + password.notes;

      let entry = template.cloneNode(true);
      setCommandHandler(entry.querySelector(".password-menu-link"), toggleMenu.bind(null, password, entry));
      setCommandHandler(entry.querySelector(".to-document-link"), fillInPassword.bind(null, password));
      setCommandHandler(entry.querySelector(".to-clipboard-link"), copyToClipboard.bind(null, password));

      if (password.type == "generated")
      {
        entry.querySelector(".user-name-container").addEventListener("click", ((password, event) =>
        {
          if (event.eventPhase == event.AT_TARGET)
            upgradePassword(password);
        }).bind(null, password));
      }

      entry.querySelector(".user-name-container").setAttribute("title", tooltip);
      if (password.type == "generated")
        entry.querySelector(".user-name-container").classList.add("legacy-warning");
      entry.querySelector(".user-name").textContent = password.name;

      let revisionNode = entry.querySelector(".password-revision");
      revisionNode.hidden = !password.revision;
      revisionNode.textContent = password.revision;

      list.appendChild(entry);
    }
  }

  $("no-passwords-message").hidden = pwdList.length;
}

function showMenu(password, element)
{
  hideMenu();

  let notes_link_msg = i18n.getMessage(password.notes ? "edit_notes" : "add_notes");
  menu.querySelector(".menu-notes-link").textContent = notes_link_msg;

  menu.querySelector("#menu-upgrade-password").hidden = (password.type != "generated");
  menu.querySelector("#menu-make-generated").hidden = (password.type != "stored");

  menuPassword = password;
  element.parentNode.insertBefore(menu, element.nextSibling);
  element.querySelector(".password-menu-link").setAttribute("data-menuactive", "true");
  menu.scrollIntoView(false);
}

function hideMenu()
{
  menuPassword = null;

  let element = $("password-list-container").querySelector(".password-menu-link[data-menuactive]");
  if (element)
    element.removeAttribute("data-menuactive");

  if (menu.parentNode)
    menu.parentNode.removeChild(menu);
}

function toggleMenu(password, element)
{
  if (!menuPassword || menuPassword != password)
    showMenu(password, element);
  else
    hideMenu();
}

function fillInPassword(password)
{
  let {site} = state;
  passwordRetrieval.fillIn(site, password.name, password.revision)
    .then(() => window.close())
    .catch(showPasswordMessage);
}

function copyToClipboard(password)
{
  let {site} = state;
  passwords.getPassword(site, password.name, password.revision).then(password =>
  {
    let doCopy = () =>
    {
      require("../clipboard").set(password);
      showPasswordMessage("password_copied_message");
    };

    let isWebClient = document.documentElement.classList.contains("webclient");
    if (!isWebClient)
      doCopy();
    else
    {
      showPasswordMessage("password_ready_message");
      let handler = event =>
      {
        window.removeEventListener("click", handler, true);
        event.stopPropagation();
        event.preventDefault();
        doCopy();
      };
      window.addEventListener("click", handler, true);
    }
  }).catch(showPasswordMessage);
}

function showPw(password)
{
  passwords.getPassword(state.site, password.name, password.revision)
    .then(value => require("./pwshow").show(password, value))
    .catch(showPasswordMessage);
}

function showNotes(password)
{
  require("./notes").edit(password);
}

function upgradePassword(password)
{
  let message = i18n.getMessage("upgrade_password_confirmation").replace(/\{1\}/g, password.name).replace(/\{2\}/g, state.siteDisplayName);
  confirm(message).then(response =>
  {
    if (response)
    {
      passwords.addGenerated({
        site: password.site,
        name: password.name,
        revision: password.revision,
        length: password.length,
        lower: password.lower,
        upper: password.upper,
        number: password.number,
        symbol: password.symbol,
        legacy: false
      }, true)
        .then(pwdList => state.set({pwdList}))
        .catch(showPasswordMessage);
    }
  });
}

function makeGenerated(password)
{
  setActivePanel("generate-password");

  $("replace-password-warning").hidden = false;
  $("generate-password-user-name").value = password.name;
  $("generate-password-user-name").setAttribute("readonly", "readonly");
  if (password.revision && password.revision != "1")
  {
    $("generate-password-revision").value = password.revision || "1";
    require("./generatePassword").showRevision();
  }
  else
    $("generate-change-password-revision").hidden = true;
  $("generate-password-revision").setAttribute("readonly", "readonly");
  $("generate-legacy-container").hidden = true;
}

function bumpRevision(password)
{
  setActivePanel("generate-password");

  $("generate-password-user-name").value = password.name;

  let {pwdList} = state;
  let revision = (parseInt(password.revision, 10) || 1) + 1;
  if (revision < 2)
    revision = 2;
  while (pwdList.some(pwd => pwd.name == password.name && pwd.revision == revision))
    revision++;
  $("generate-password-revision").value = revision;

  if (password.type == "generated2" || password.type == "generated")
  {
    $("password-length").value = password.length;
    $("charset-lower").checked = password.lower;
    $("charset-upper").checked = password.upper;
    $("charset-number").checked = password.number;
    $("charset-symbol").checked = password.symbol;
  }

  require("./generatePassword").showRevision();
}

function removePassword(password)
{
  let {siteDisplayName} = state;
  let message = i18n.getMessage("remove_password_confirmation").replace(/\{1\}/g, password.name).replace(/\{2\}/g, siteDisplayName);
  confirm(message).then(response =>
  {
    if (response)
    {
      passwords.removePassword(password.site, password.name, password.revision)
        .then(pwdList => state.set({pwdList}))
        .catch(showPasswordMessage);
    }
  });
}

function removeWhitespace(element)
{
  for (let i = 0; i < element.childNodes.length; i++)
  {
    if (element.childNodes[i].nodeType == 3 && element.childNodes[i].nodeValue.trim() == "")
      element.removeChild(element.childNodes[i--]);
    else if (element.childNodes[i].nodeType == 1)
      removeWhitespace(element.childNodes[i]);
  }
}
