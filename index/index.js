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
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/*!****************************!*\
  !*** ./web/index/index.js ***!
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



// Posting messages to proper origin isn't possible on file://

var targetOrigin = location.protocol != "file:" ? location.origin : "*";

function createFrame(id, src, listener) {
  var frame = document.createElement("iframe");
  frame.id = id;
  if (src) frame.src = src;
  if (listener) frame.addEventListener("load", listener);
  document.body.appendChild(frame);
}

window.addEventListener("load", function () {
  if (!crypto.subtle || typeof crypto.subtle.encrypt != "function") {
    document.getElementById("no-webcrypto").hidden = false;
    return;
  }

  crypto.subtle.importKey("raw", new Uint8Array(16), "AES-GCM", false, ["encrypt"]).then(function (key) {
    document.getElementById("inProgressOverlay").hidden = false;

    createFrame("background", "background/background.html", function () {
      createFrame("panel", "panel/panel.html", function (event) {
        document.getElementById("inProgressOverlay").hidden = true;
        event.target.setAttribute("data-active", "true");
      });
      createFrame("allpasswords", null);
    });
  }).catch(function (error) {
    document.getElementById("no-webcrypto").hidden = false;
    console.error(error);
  });
});

var maxPortID = 0;

window.addEventListener("message", function (event) {
  // On Chrome, file:// is used as document origin yet messages get origin null
  if (event.origin != location.origin && !(event.origin == "null" && location.origin == "file://")) return;

  if (event.data.type == "get-port-id") {
    event.source.postMessage({
      type: "port-id",
      id: ++maxPortID
    }, targetOrigin);
    return;
  } else if (event.data.type == "show-panel") {
    document.getElementById("allpasswords").removeAttribute("data-active");
    document.getElementById("panel").setAttribute("data-active", "true");
    return;
  } else if (event.data.type == "show-allpasswords") {
    document.getElementById("panel").removeAttribute("data-active");

    var frame = document.getElementById("allpasswords");
    frame.src = "allpasswords/allpasswords.html";
    frame.setAttribute("data-active", "true");
    return;
  }

  // Forward incoming messages to the right frame
  var target = document.getElementById(event.data.target).contentWindow;
  target.postMessage(event.data, targetOrigin);
});

// Hack: expose __webpack_require__ for simpler debugging
/* global __webpack_require__ */
module.exports = __webpack_require__;

/***/ })
/******/ ]);