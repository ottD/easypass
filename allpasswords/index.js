var __webpack_require__ =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 5);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/*!********************************!*\
  !*** ./web/data/browserAPI.js ***!
  \********************************/
/*! dynamic exports provided */
/*! all exports used */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */



var locale = __webpack_require__(/*! locale */ 7);

var _require = __webpack_require__(/*! ../eventTarget */ 8),
    EventTarget = _require.EventTarget;

document.documentElement.classList.add("webclient");

var ports = [];

// Posting messages to proper origin isn't possible on file://
var targetOrigin = location.protocol != "file:" ? location.origin : "*";

var expectedPortIds = [];

function getPortId() {
  return new Promise(function (resolve, reject) {
    expectedPortIds.push(resolve);
    parent.postMessage({
      type: "get-port-id"
    }, targetOrigin);
  });
}

module.exports = {
  runtime: {
    connect: function connect(params) {
      var id = null;
      var queue = [];

      var port = {
        postMessage: function postMessage(payload) {
          if (id === null) {
            queue.push(payload);
            return;
          }

          parent.postMessage({
            type: "message",
            payload: payload,
            id: id,
            target: "background"
          }, targetOrigin);
        },

        disconnect: function disconnect(message) {
          delete ports[id];
          parent.postMessage({
            type: "disconnect",
            id: id,
            target: "background"
          }, targetOrigin);
        },

        onMessage: new EventTarget()
      };

      getPortId().then(function (response) {
        id = response;
        ports[id] = port;
        parent.postMessage({
          type: "connect",
          name: params.name,
          id: id,
          target: "background"
        }, targetOrigin);

        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = queue[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var payload = _step.value;

            port.postMessage(payload);
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }

        queue = null;
      });

      return port;
    },

    getBackgroundPage: function getBackgroundPage() {
      return Promise.reject(new Error("Not implemented"));
    }
  },
  i18n: {
    getMessage: function getMessage(id) {
      return locale[id];
    }
  }
};

window.addEventListener("message", function (event) {
  // On Chrome, file:// is used as document origin yet messages get origin null
  if (event.origin != location.origin && !(event.origin == "null" && location.origin == "file://")) return;

  var message = event.data;
  if (message.type == "port-id") {
    if (expectedPortIds.length) expectedPortIds.shift()(message.id);
  } else if (message.type == "message") {
    var port = ports[message.id];
    if (port) port.onMessage._emit(message.payload);
  }
});

window.addEventListener("show-panel", function (event) {
  parent.postMessage({
    type: "show-panel"
  }, targetOrigin);
});

/***/ }),
/* 1 */
/*!************************************!*\
  !*** ./data/allpasswords/utils.js ***!
  \************************************/
/*! dynamic exports provided */
/*! all exports used */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */



var _require = __webpack_require__(/*! ../browserAPI */ 0),
    i18n = _require.i18n;

function $(id) {
  return document.getElementById(id);
}
exports.$ = $;

function setCommandHandler(element, handler) {
  if (typeof element == "string") element = $(element);
  var wrapper = function wrapper(event) {
    event.preventDefault();
    handler.call(element, event);
  };
  element.addEventListener("click", wrapper);
}
exports.setCommandHandler = setCommandHandler;

function localize(error) {
  if (/\s/.test(error)) return error;

  try {
    return i18n.getMessage(error) || error;
  } catch (e) {
    // Edge will throw for unknown messages
    return error;
  }
}

function showError(error) {
  if (error == "canceled") return;

  alert(localize(error));
}
exports.showError = showError;

/***/ }),
/* 2 */
/*!***************************!*\
  !*** ./data/messaging.js ***!
  \***************************/
/*! dynamic exports provided */
/*! all exports used */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */



function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var browser = __webpack_require__(/*! ./browserAPI */ 0);

var _require = __webpack_require__(/*! ../lib/eventTarget */ 12),
    EventTarget = _require.EventTarget,
    emit = _require.emit;

var messageQueue = null;
var portName = "contentScript";
if (typeof browser.runtime.getBackgroundPage == "function") {
  // If we can access the background page we are not in a content script.
  portName = document.documentElement.dataset.portname;
  messageQueue = [];
  document.addEventListener("DOMContentLoaded", function (event) {
    var queue = messageQueue;
    messageQueue = null;

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = queue[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var message = _step.value;

        emit.apply(undefined, [exports.port, message.eventName].concat(_toConsumableArray(message.args)));
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }
  });
}

var port = browser.runtime.connect({ name: portName });

exports.port = new EventTarget();
exports.port.name = portName;

exports.port.emit = function (eventName) {
  for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    args[_key - 1] = arguments[_key];
  }

  port.postMessage({ eventName: eventName, args: args });
};

exports.port.disconnect = function () {
  port.disconnect();
};

port.onMessage.addListener(function (message) {
  if (messageQueue) messageQueue.push(message);else emit.apply(undefined, [exports.port, message.eventName].concat(_toConsumableArray(message.args)));
});

/***/ }),
/* 3 */
/*!************************************!*\
  !*** ./data/allpasswords/modal.js ***!
  \************************************/
/*! dynamic exports provided */
/*! all exports used */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */



var _require = __webpack_require__(/*! ./utils */ 1),
    $ = _require.$;

function show(id) {
  hide();

  var element = $(id);
  if (!element || element.parentNode.id != "modalOverlay") throw new Error("Invalid modal dialog ID");

  element.setAttribute("active", "true");
  element.parentNode.hidden = false;
}
exports.show = show;

function hide() {
  var active = document.querySelector("#modalOverlay > [active='true']");
  if (active) active.removeAttribute("active");
  $("modalOverlay").hidden = true;
}
exports.hide = hide;

function active() {
  var active = document.querySelector("#modalOverlay > [active='true']");
  return active ? active.id : null;
}
exports.active = active;

/***/ }),
/* 4 */
/*!***********************!*\
  !*** ./data/proxy.js ***!
  \***********************/
/*! dynamic exports provided */
/*! all exports used */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */



var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _require = __webpack_require__(/*! ./messaging */ 2),
    port = _require.port;

var errorHandlers = new Map();
var currentHandlers = new Map();

var maxMessageId = 0;
function sendMessage(message) {
  return new Promise(function (resolve, reject) {
    var messageId = message.messageId = port.name + ++maxMessageId;
    port.once("_proxyResponse-" + messageId, function (_ref) {
      var _ref2 = _slicedToArray(_ref, 2),
          error = _ref2[0],
          result = _ref2[1];

      if (error) {
        var handler = errorHandlers.get(error);
        if (handler) {
          var promise = currentHandlers.get(error);
          if (!promise) {
            promise = handler(error, message).then(function () {
              currentHandlers.delete(error);
            }).catch(function (e) {
              currentHandlers.delete(error);
              throw e;
            });
            currentHandlers.set(error, promise);
          }

          // Have the handler deal with the error and retry.
          promise.then(function () {
            return sendMessage(message);
          }).then(resolve, reject);
        } else reject(error);
      } else resolve(result);
    });
    port.emit("_proxy", message);
  });
}

function Proxy(moduleName, methods) {
  var proxy = {};

  var _loop = function _loop(i) {
    var method = methods[i];
    proxy[method] = function () {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return sendMessage({ moduleName: moduleName, method: method, args: args });
    };
  };

  for (var i = 0; i < methods.length; i++) {
    _loop(i);
  }

  return proxy;
}

exports.setErrorHandler = function (error, handler) {
  return errorHandlers.set(error, handler);
};

exports.passwords = Proxy("passwords", ["exportPasswordData", "importPasswordData", "getPasswords", "addAlias", "removeAlias", "addGenerated", "addStored", "removePassword", "getPassword", "setNotes", "getAllPasswords", "getAllSites", "isMigrating"]);

exports.masterPassword = Proxy("masterPassword", ["changePassword", "checkPassword", "forgetPassword"]);

exports.passwordRetrieval = Proxy("passwordRetrieval", ["fillIn", "copyToClipboard"]);

exports.prefs = Proxy("prefs", ["get", "set"]);

exports.recoveryCodes = Proxy("recoveryCodes", ["getValidChars", "getCode", "formatCode", "isValid", "decodeCode"]);

exports.sync = Proxy("sync", ["authorize", "getManualAuthURL", "manualAuthorization", "disable", "sync"]);

exports.ui = Proxy("ui", ["showAllPasswords", "getLink", "openLink"]);

/***/ }),
/* 5 */
/*!************************************************************!*\
  !*** multi ./data/platform.js ./data/allpasswords/main.js ***!
  \************************************************************/
/*! dynamic exports provided */
/*! all exports used */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(/*! /home/build/Code/pfp/data/platform.js */6);
module.exports = __webpack_require__(/*! /home/build/Code/pfp/data/allpasswords/main.js */9);


/***/ }),
/* 6 */
/*!**************************!*\
  !*** ./data/platform.js ***!
  \**************************/
/*! dynamic exports provided */
/*! all exports used */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */



var browser = __webpack_require__(/*! ./browserAPI */ 0);

// i18n

window.addEventListener("DOMContentLoaded", function () {
  var elements = document.querySelectorAll("[data-l10n-id]");
  for (var i = 0; i < elements.length; i++) {
    var element = elements[i];
    var id = element.getAttribute("data-l10n-id");
    element.textContent = browser.i18n.getMessage(id);
  }
});

/***/ }),
/* 7 */
/*!*********************************!*\
  !*** ./locale/en-US.properties ***!
  \*********************************/
/*! dynamic exports provided */
/*! all exports used */
/***/ (function(module, exports) {

module.exports = {"password_too_short":"The master password should be at least 6 characters long.","passwords_differ":"Passwords don't match.","weak_password":"Your master password is too simple and wouldn't take long enough to guess. It is recommended that you choose a more complicated password. Do you really want to proceed with this master password?","password_declined":"This doesn't seem to be the master password you have used before.","decryption_failure":"Some data could not be decrypted, maybe wrong master password was used?","user_name_required":"Please enter your user name or an arbitrary name if the website doesn't require one.","user_name_exists":"This user name already exists.","user_name_exists_generated":"This user name and revision combination already exists. Maybe increase the revision number?","no_characters_selected":"At least one character set has to be selected.","password_value_required":"Please enter the password you used on this website.","password_type_generated":"Password generated by an older extension version","password_type_generated_replace":"Click to replace!","password_type_generated_print":"Generated by Easy Passwords 1.x","password_type_generated2":"Generated password","password_type_stored":"Stored password","password_type_stored_with_recovery":"Stored password, recovery code below","password_info_notes":"Notes:","remove_password_confirmation":"Do you really want to remove the password \"{1}\" for the website {2}?","remove_alias_confirmation":"Do you really want to stop treating {1} as an alias for {2}?","upgrade_password_confirmation":"Upgrading the password will change its value. Make sure that you already filled in \"current password\" in the website's password change form. Proceed replacing password \"{1}\" for the website {2}?","recovery_checksum_mismatch":"Row is mistyped or not the next row.","sync_invalid_token":"Access has been denied, you probably need to authorize AEP again.","sync_unknown_data_format":"Format of currently stored data is unrecognized, it might have been created by a newer AEP version.","sync_connection_error":"Server connection failed.","sync_too_many_retries":"Too many retries after conflicting modifications.","sync_multiple_candidates":"Your storage provider has multiple AEP files stored for some reason. You probably need to delete AEP data there and sync again.","sync_wrong_master_password":"It seems that the currently stored data was encrypted with a different master password.","ok":"OK","cancel":"Cancel","yes":"Yes","no":"No","no_site_placeholder":"(none)","learn_more":"Learn more…","unknown_error":"The operation failed unexpectedly.","unknown_error_more":"Show error message","new_master_message":"You didn't define a master password yet, please do so below.","reset_master_message":"You can open another password store by resetting the master password.","master_security_message":"It is essential that you choose a strong master password.","new_master":"New master password:","new_master_repeat":"Please reenter password:","change_master_submit":"Set master password","master_password":"Enter master password:","enter_master_submit":"Access passwords","reset_master_link":"New master password","migration_title":"Easy Passwords is now Adrium Easy Pass!","migration_features_intro":"Some important security improvements have been implemented:","migration_feature1":"All data is now encrypted on disk, not only the stored passwords.","migration_feature2":"Your backups will also be encrypted, any data can only be retrieved with the right master password.","migration_feature3":"Updated password generation approach makes guessing your master password even harder.","migration_todos_intro":"There will be a six months transitional period. It is recommended that you do the following during that time:","migration_todo1":"Replace any of your old generated passwords, otherwise these will be automatically converted to stored passwords at the end of the transitional period.","migration_todo2":"Create a new (encrypted) backup. Unencrypted backups will no longer be supported after the end of the transitional period.","migration_in_progress":"Updating your data, please wait…","migration_continue":"Continue","site":"Website name:","select_site_label":"Select site","add_alias":"This website shares passwords with another?","alias_description":"You indicated that {1} shares passwords with this website.","remove_alias":"Revert","show_all_passwords":"Show all passwords","sync_setup":"Set up sync","sync_state":"Show sync state","lock_passwords":"Lock passwords","password_copied_message":"Password has been copied to clipboard.","no_such_password":"Unknown password!","unknown_generation_method":"Unknown password generation method!","wrong_site_message":"You are not on the right website!","no_password_fields":"The page has no password fields or the password fields belong to a different site!","no_passwords_message":"No passwords yet","password_ready_message":"Your password is ready, click again anywhere to copy it.","passwords_label":"Passwords:","password_menu":"All actions","to_document":"Fill in","to_clipboard":"Copy to clipboard","pwshow":"Show password","add_notes":"Add notes","edit_notes":"Edit notes","upgrade_password":"Replace by AEP 2.x password","make_generated":"Replace by generated password","bump_revision":"Generate new password for this user name","remove_password":"Remove password","generate_password_link":"Generate new password","stored_password_link":"Enter stored password","replace_password_warning":"Making this a generated password will change its value. Make sure that you already filled in \"current password\" in the website's password change form.","user_name":"User name:","change_password_revision":"Need a new password for the same username?","password_revision":"Revision:","password_length":"Length:","allowed_characters":"Allowed characters:","generate_legacy":"Easy Passwords 1.x password","generate_legacy_warning":"Don't use this option for new passwords! Only check when recovering a password that was initially created with an older extension version.","generate_password":"Generate password","stored_password_warning":"Generated passwords are preferable, these can be easily recovered as long as you still remember your master password and user name.","password_value":"Password:","use_recovery":"Use recovery code","save_password":"Save password","select_alias":"Mark \"{1}\" as an alias for:","select_site":"Show passwords for site:","autocomplete_no_sites":"No sites matched your search","recovery_code":"Recovery code:","password_notes":"Password notes:","save_notes":"Save notes","sync_selection_label":"Please select your storage provider:","sync_how_label":"How does this work?","sync_how_explanation":"You grant AEP access to a directory within your personal account on Dropbox or Google Drive™. This access will be used to upload a file with encrypted data regularly. It's the same data as with your manual backup, but you can connect multiple devices to the same account and changes will propagate to all of them automatically - assuming that they all use the same master password.","sync_safe_label":"Is this safe?","sync_safe_explanation":"Yes. AEP can only access its own file, not the other files stored in your account. Also, the file's data is fully encrypted and can only be decrypted using your master password.","sync_no_account_label":"What if I don't have an account?","sync_no_account_explanation":"It doesn't matter, you can create an account for free. You don't need to use that account for anything beyond AEP.","sync_token_label":"Please paste the code given by the storage provider:","sync_provider":"Uploading to:","sync_lastTime":"Last upload:","sync_lastTime_never":"Never","sync_lastTime_now":"Running…","sync_succeeded":"(succeeded)","sync_failed":"(failed)","do_sync":"Upload now","sync_reauthorize":"Reauthorize…","sync_disable":"Disable sync","sync_disable_confirmation":"Do you really want to disable sync functionality? Your data will no longer be backed up to your provider automatically.","allpasswords_title":"All passwords known to AEP","allpasswords_export":"Save password definitions to a file","allpasswords_import":"Import password definitions from a file","allpasswords_print":"Print","allpasswords_show_notes":"Show notes","allpasswords_show_passwords":"Show passwords","allpasswords_intro":"Here you can create an encrypted backup of your data. This page is also safe to print as long as the passwords aren't shown, the information shown is sufficient to recreate the passwords (same master password has to be used).","allpasswords_aliases":"Aliases:","master_password_required":"Your passwords are currently locked. Please unlock them by clicking AEP icon and try again.","unknown_data_format":"Unknown data format!","syntax_error":"The file contains errors and could not be imported.","allpasswords_import_confirm":"Your existing passwords might get overwritten. Are you sure you want to proceed?","allpasswords_import_with_master":"It seems that this backup was created with a different master password. It can still be imported, all generated passwords will be converted to stored passwords however.","allpasswords_import_success":"Passwords data has been imported.","allpasswords_show_confirm":"This will display all your passwords on screen, please only proceed if nobody can watch over your shoulder. This action might take some time to complete.","allpasswords_export_edge":"Bugs in Microsoft Edge currently prevent extensions from offering files for download. You will need to copy the text manually and paste it into a text editor such as Notepad.","autolock_title":"Enable auto-lock","autolock_description":"Lock passwords automatically when the panel is closed","autolock_delay_title":"Auto-lock delay","autolock_delay_description":"Interval in minutes after which the passwords should be locked"};

/***/ }),
/* 8 */
/*!****************************!*\
  !*** ./web/eventTarget.js ***!
  \****************************/
/*! dynamic exports provided */
/*! all exports used */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */



function EventTarget() {
  this._listeners = [];
}
EventTarget.prototype = {
  addListener: function addListener(listener) {
    this._listeners.push(listener);
  },

  removeListener: function removeListener(listener) {
    var index = this._listeners.indexOf(listener);
    if (index >= 0) this._listeners.splice(index, 1);
  },

  _emit: function _emit() {
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = this._listeners[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var listener = _step.value;

        listener.apply(undefined, arguments);
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }
  }
};

exports.EventTarget = EventTarget;

/***/ }),
/* 9 */
/*!***********************************!*\
  !*** ./data/allpasswords/main.js ***!
  \***********************************/
/*! dynamic exports provided */
/*! all exports used */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */



var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _require = __webpack_require__(/*! ../browserAPI */ 0),
    i18n = _require.i18n;

var _require2 = __webpack_require__(/*! ../common */ 10),
    getSiteDisplayName = _require2.getSiteDisplayName;

var _require3 = __webpack_require__(/*! ./enterMaster */ 11),
    enterMaster = _require3.enterMaster;

var _require4 = __webpack_require__(/*! ./utils */ 1),
    $ = _require4.$,
    setCommandHandler = _require4.setCommandHandler,
    showError = _require4.showError;

var modal = __webpack_require__(/*! ./modal */ 3);

var _require5 = __webpack_require__(/*! ../proxy */ 4),
    passwords = _require5.passwords,
    passwordRetrieval = _require5.passwordRetrieval,
    recoveryCodes = _require5.recoveryCodes;

var _require6 = __webpack_require__(/*! ../messaging */ 2),
    port = _require6.port;

function copyToClipboard(site, password, passwordInfo) {
  passwords.getPassword(site, password.name, password.revision).then(function (password) {
    var doCopy = function doCopy() {
      __webpack_require__(/*! ../clipboard */ 13).set(password);
      var message = passwordInfo.querySelector(".password-copied-message");
      message.hidden = false;
      setTimeout(function () {
        message.hidden = true;
      }, 3000);
    };

    var isWebClient = document.documentElement.classList.contains("webclient");
    if (!isWebClient) doCopy();else {
      var message = passwordInfo.querySelector(".password-ready-message");
      message.hidden = false;
      var handler = function handler(event) {
        window.removeEventListener("click", handler, true);
        message.hidden = true;
        event.stopPropagation();
        event.preventDefault();
        doCopy();
      };
      window.addEventListener("click", handler, true);
    }
  }).catch(showError);
}

function removePassword(site, password, passwordInfo) {
  var message = i18n.getMessage("remove_password_confirmation").replace(/\{1\}/g, password.name).replace(/\{2\}/g, site);
  if (confirm(message)) {
    passwords.removePassword(site, password.name, password.revision).then(function () {
      var siteInfo = passwordInfo.parentNode;
      siteInfo.removeChild(passwordInfo);
      if (!siteInfo.querySelector(".password-container")) siteInfo.parentNode.removeChild(siteInfo);
    }).catch(showError);
  }
}

function exportData() {
  passwords.exportPasswordData().then(function (data) {
    if (window.navigator.userAgent.indexOf(" Edge/") >= 0) {
      // Edge won't let extensions download blobs (https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/9551771/)
      // and it would ignore the file name anyway (https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/6594876/).
      // data: URIs don't work either (https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/4282810/).
      // Let the user copy the text manually, that's the only way.
      if (confirm(i18n.getMessage("allpasswords_export_edge"))) document.body.textContent = data;
    } else {
      // See https://bugzil.la/1379960, in Firefox this will only work with a
      // link inside a frame.
      var frameDoc = $("exportDataFrame").contentDocument;
      var link = frameDoc.body.lastChild;
      if (!link || link.localName != "a") {
        link = frameDoc.createElement("a");
        frameDoc.body.appendChild(link);
      }

      var blob = new Blob([data], { type: "application/json" });
      link.href = URL.createObjectURL(blob);
      link.download = "passwords-backup-" + new Date().toISOString().replace(/T.*/, "") + ".json";
      link.click();
    }
  }).catch(showError);
}

function importData() {
  $("importFile").click();
}

function importDataFromFile(file) {
  var reader = new FileReader();
  reader.onload = function () {
    if (confirm(i18n.getMessage("allpasswords_import_confirm"))) doImport(reader.result);
  };
  reader.readAsText(file);
}

function doImport(data, masterPass) {
  modal.show("in-progress");
  passwords.importPasswordData(data, masterPass).then(function () {
    modal.hide();
    alert(i18n.getMessage("allpasswords_import_success"));
    window.location.reload();
  }).catch(function (error) {
    modal.hide();
    if (error == "wrong_master_password") {
      enterMaster("allpasswords_import_with_master", true).then(function (newMaster) {
        doImport(data, newMaster);
      }).catch(function (error) {
        // User cancelled, ignore
      });
    } else showError(error);
  });
}

function showNotes(event) {
  var state = event.target.checked;
  if (state) {
    $("list").classList.add("show-notes");
    delete window.localStorage.hideNotes;
  } else {
    $("list").classList.remove("show-notes");
    window.localStorage.hideNotes = true;
  }
}

var askedPasswords = false;
var retrievedPasswords = false;

function showPasswords(event) {
  var state = event.target.checked;
  if (state && !askedPasswords) {
    if (confirm(i18n.getMessage("allpasswords_show_confirm"))) askedPasswords = true;else {
      event.target.checked = false;
      return;
    }
  }

  if (state) $("list").classList.add("show-passwords");else $("list").classList.remove("show-passwords");

  if (state && !retrievedPasswords) {
    retrievedPasswords = true;
    Promise.resolve().then(function () {
      var actions = [];
      var elements = $("list").querySelectorAll(".password-info-container");

      var _loop = function _loop(i) {
        var passwordInfo = elements[i];

        var _passwordInfo$_data = _slicedToArray(passwordInfo._data, 2),
            site = _passwordInfo$_data[0],
            passwordData = _passwordInfo$_data[1];

        actions.push(passwords.getPassword(site, passwordData.name, passwordData.revision).then(function (value) {
          var element = passwordInfo.querySelector(".password-value");
          element.textContent = value;
          element.hidden = false;
        }));
      };

      for (var i = 0; i < elements.length; i++) {
        _loop(i);
      }
      return Promise.all(actions);
    }).catch(function (e) {
      retrievedPasswords = false;
      showError(e);
    });
  }
}

function printPage() {
  window.print();
}

function goToSite(site, event) {
  event.preventDefault();
  passwords.getPasswords(site).then(function (_ref) {
    var _ref2 = _slicedToArray(_ref, 3),
        origSite = _ref2[0],
        site = _ref2[1],
        pwdList = _ref2[2];

    __webpack_require__(/*! ../messaging */ 2).port.emit("forward-to-panel", {
      name: "init",
      args: [{ origSite: origSite, site: site, pwdList: pwdList }]
    });
  });
  window.dispatchEvent(new Event("show-panel"));
}

window.addEventListener("DOMContentLoaded", function () {
  var globalActions = {
    export: exportData,
    import: importData,
    print: printPage
  };

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = Object.keys(globalActions)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var id = _step.value;

      var element = $(id);
      element.setAttribute("title", element.textContent);
      element.textContent = "";
      setCommandHandler(element, globalActions[id]);
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  $("importFile").addEventListener("change", function (event) {
    importDataFromFile(event.target.files[0]);
  });

  var notesCheckbox = $("show-notes");
  notesCheckbox.addEventListener("click", showNotes);
  notesCheckbox.checked = !("hideNotes" in window.localStorage);
  showNotes({ target: notesCheckbox });

  $("show-passwords").addEventListener("click", showPasswords);

  passwords.getAllPasswords().then(function (sites) {
    var siteTemplate = $("site-template").firstElementChild;
    var passwordTemplate = $("password-template").firstElementChild;
    var links = passwordTemplate.querySelectorAll("a");
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      if (link.textContent) {
        link.setAttribute("title", link.textContent);
        link.textContent = "";
      }
    }

    var siteNames = Object.keys(sites);
    siteNames.sort();
    {
      var index = siteNames.indexOf("pfp.invalid");
      if (index >= 0) {
        siteNames.splice(index, 1);
        siteNames.unshift("pfp.invalid");
      }
    }

    var recoveryCodeOperations = [];
    var container = $("list");
    var currentLetter = null;
    var prevInfo = null;
    var isWebClient = document.documentElement.classList.contains("webclient");

    var _loop2 = function _loop2(site) {
      var _sites$site = sites[site],
          passwords = _sites$site.passwords,
          aliases = _sites$site.aliases;


      var displayName = getSiteDisplayName(site);
      var siteInfo = siteTemplate.cloneNode(true);
      if (isWebClient) {
        var _link = document.createElement("a");
        _link.setAttribute("href", "#");
        _link.textContent = displayName;
        _link.addEventListener("click", goToSite.bind(null, site));
        siteInfo.querySelector(".site-name").appendChild(_link);
      } else siteInfo.querySelector(".site-name").textContent = displayName;

      if (aliases.length) siteInfo.querySelector(".site-aliases-value").textContent = aliases.sort().join(", ");else siteInfo.querySelector(".site-aliases").hidden = true;

      var _loop3 = function _loop3(passwordData) {
        var passwordInfo = passwordTemplate.cloneNode(true);
        passwordInfo._data = [site, passwordData];
        passwordInfo.querySelector(".user-name").textContent = passwordData.name;

        var revisionNode = passwordInfo.querySelector(".password-revision");
        revisionNode.hidden = !passwordData.revision;
        revisionNode.textContent = passwordData.revision;

        setCommandHandler(passwordInfo.querySelector(".to-clipboard-link"), copyToClipboard.bind(null, site, passwordData, passwordInfo));
        setCommandHandler(passwordInfo.querySelector(".password-remove-link"), removePassword.bind(null, site, passwordData, passwordInfo));

        if (passwordData.type == "generated2" || passwordData.type == "generated") {
          passwordInfo.querySelector(".password-info.stored").hidden = true;
          passwordInfo.querySelector(".password-type." + passwordData.type).hidden = false;
          if (passwordData.type == "generated") passwordInfo.querySelector(".password-type.generated-print").hidden = false;
          passwordInfo.querySelector(".password-length-value").textContent = passwordData.length;

          var chars = [];
          if (passwordData.lower) chars.push("abc");
          if (passwordData.upper) chars.push("XYZ");
          if (passwordData.number) chars.push("789");
          if (passwordData.symbol) chars.push("+^;");
          passwordInfo.querySelector(".password-allowed-chars-value").textContent = chars.join(" ");
        } else {
          passwordInfo.querySelector(".password-info.generated").hidden = true;
          recoveryCodeOperations.push(recoveryCodes.getCode(site, passwordData.name, passwordData.revision).then(function (code) {
            passwordInfo.querySelector(".password-recovery").textContent = code;
          }));
        }

        var notes = passwordInfo.querySelector(".password-info.notes");
        notes.hidden = !passwordData.notes;
        if (passwordData.notes) notes.textContent += " " + passwordData.notes;

        siteInfo.appendChild(passwordInfo);
      };

      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = passwords[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var passwordData = _step3.value;

          _loop3(passwordData);
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }

      container.appendChild(siteInfo);

      var letter = displayName[0].toUpperCase();
      if (letter != currentLetter && letter != "(") {
        currentLetter = letter;
        var _link2 = document.createElement("a");
        _link2.textContent = currentLetter;
        _link2.href = "#";
        setCommandHandler(_link2, function () {
          var div = siteInfo;
          while (div && !div.parentNode) {
            div = div._nextSiteInfo;
          }if (div) div.scrollIntoView(true);
        });
        $("shortcuts").appendChild(_link2);
        _link2.focus();
      }

      if (prevInfo) prevInfo._nextSiteInfo = siteInfo;
      prevInfo = siteInfo;
    };

    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = siteNames[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var site = _step2.value;

        _loop2(site);
      }
    } catch (err) {
      _didIteratorError2 = true;
      _iteratorError2 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion2 && _iterator2.return) {
          _iterator2.return();
        }
      } finally {
        if (_didIteratorError2) {
          throw _iteratorError2;
        }
      }
    }

    Promise.all(recoveryCodeOperations).catch(showError);
  }).catch(showError);
});

// Hack: expose __webpack_require__ for simpler debugging
/* global __webpack_require__ */
module.exports = __webpack_require__;

/***/ }),
/* 10 */
/*!************************!*\
  !*** ./data/common.js ***!
  \************************/
/*! dynamic exports provided */
/*! all exports used */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */



function getSiteDisplayName(site) {
  if (site == "pfp.invalid") return __webpack_require__(/*! ./browserAPI */ 0).i18n.getMessage("no_site_placeholder");else if (site) return site;else return "???";
}
exports.getSiteDisplayName = getSiteDisplayName;

/***/ }),
/* 11 */
/*!******************************************!*\
  !*** ./data/allpasswords/enterMaster.js ***!
  \******************************************/
/*! dynamic exports provided */
/*! all exports used */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */



var _require = __webpack_require__(/*! ../browserAPI */ 0),
    i18n = _require.i18n;

var _require2 = __webpack_require__(/*! ./utils */ 1),
    $ = _require2.$,
    showError = _require2.showError;

var modal = __webpack_require__(/*! ./modal */ 3);
var proxy = __webpack_require__(/*! ../proxy */ 4);
var masterPassword = proxy.masterPassword;


var currentAction = null;
var previousModal = null;

function enterMaster(warning, noValidate) {
  var warningElement = $("master-password-warning");
  warningElement.hidden = !warning;
  if (warning) warningElement.textContent = i18n.getMessage(warning);

  return new Promise(function (resolve, reject) {
    currentAction = { resolve: resolve, reject: reject, noValidate: noValidate };
    previousModal = modal.active();
    modal.show("enter-master");
    $("master-password").focus();
  });
}
exports.enterMaster = enterMaster;

window.addEventListener("DOMContentLoaded", function () {
  var form = $("enter-master");

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var value = $("master-password").value.trim();
    if (value.length < 6) {
      showError("password_too_short");
      return;
    }

    if (currentAction.noValidate) {
      currentAction.resolve(value);
      return;
    }

    masterPassword.checkPassword(value).then(function () {
      if (previousModal) modal.show(previousModal);else modal.hide();
      previousModal = null;

      currentAction.resolve(value);
      currentAction = null;
      form.reset();
    }).catch(function (error) {
      showError(error == "declined" ? "password_declined" : error);
    });
  });

  form.addEventListener("reset", function (event) {
    if (!currentAction) return;

    modal.hide();
    currentAction.reject("canceled");
    currentAction = null;

    setTimeout(function () {
      return form.reset();
    }, 0);
  });

  form.addEventListener("keydown", function (event) {
    if (event.key == "Escape") form.reset();
  });
});

proxy.setErrorHandler("master_password_required", function () {
  return enterMaster();
});

/***/ }),
/* 12 */
/*!****************************!*\
  !*** ./lib/eventTarget.js ***!
  \****************************/
/*! dynamic exports provided */
/*! all exports used */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */



var proto = {
  on: function on(eventName, listener) {
    if (!(eventName in this._listeners)) this._listeners[eventName] = [];
    this._listeners[eventName].push(listener);
  },

  off: function off(eventName, listener) {
    var index = eventName in this._listeners ? this._listeners[eventName].indexOf(listener) : -1;
    if (index >= 0) this._listeners[eventName].splice(index, 1);
  },

  once: function once(eventName, listener) {
    var _this = this;

    var wrapper = function wrapper() {
      _this.off(eventName, wrapper);
      listener.apply(undefined, arguments);
    };
    this.on(eventName, wrapper);
  }
};

exports.EventTarget = function () {
  var result = Object.create(proto);
  result._listeners = [];
  return result;
};

exports.emit = function (obj, eventName) {
  for (var _len = arguments.length, args = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
    args[_key - 2] = arguments[_key];
  }

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = (obj._listeners[eventName] || [])[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var listener = _step.value;

      listener.apply(undefined, args);
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }
};

/***/ }),
/* 13 */
/*!***************************!*\
  !*** ./data/clipboard.js ***!
  \***************************/
/*! dynamic exports provided */
/*! all exports used */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */



/* global document */

var clipboardDummy = null;

exports.set = function (data) {
  if (!clipboardDummy) {
    clipboardDummy = document.createElement("textarea");
    clipboardDummy.style.position = "absolute";
    clipboardDummy.style.width = "0px";
    clipboardDummy.style.height = "0px";
    clipboardDummy.style.left = "-1000px";
    document.body.appendChild(clipboardDummy);
  }

  clipboardDummy.value = data;
  clipboardDummy.select();
  document.execCommand("copy", false, null);
};

/***/ })
/******/ ]);