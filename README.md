Adrium Easy Pass
================

This is a fork of [PfP: Pain-free Passwords](https://pfp.works).
It enables you to use multiple master passwords and to drag-and-drop passwords in case the automatic fill-in does not work.

The motivation is briefly discussed in [an issue](https://github.com/palant/pfp/issues/80).

Differences to the original version:

* Multiple master passwords can be used
* Show the passwords concealed to use drag and drop
* Import/Export
* Smaller layout

What does not work (yet?):

* Migration
* Sync
* Only Chrome and Web tested

Using multiple master passwords
-------------------------------

Sites and accounts are linked to your master password.
If you want to use another master password on some sites,
you can create a new store by entering a different password.

To change to a different store, click on *Lock passwords*
and *New master password.*

You will get a new empty store. If you enter a master password
that's already in use, don't worry. You will just switch to the
store you have created previously.

Import/Export
-------------

You can import and export data that is compatible to PfP,
as the same format is used.

The backup is limited to the currently active master password.
So if you want to backup all of your stores, you need to that for all of them manually.

Description
===========

Adrium Easy Pass is a Firefox, Chrome, Opera and Edge password manager. Most passwords will be generated for a specific site and account from your master password whenever needed, these passwords are never stored on disk and can be recreated easily if data is lost. For passwords that cannot be changed for some reason, storing the password with the extension data is also supported. All extension data is safely encrypted.

You can get an idea of how AEP works by using the [online version](https://adrium.github.io/easypass/). Please make sure to read the warnings when using this one!

Installing build prerequisites
------------------------------

In order to build AEP you will need to install [Node.js](https://nodejs.org/) first (Node 7 or higher is required). You will also need [Gulp](http://gulpjs.com/), run the following command to install it (administrator privileges required):

    npm install --global gulp-cli

Additional dependencies are installed using the following command in the extension directory:

    npm install

How to build
------------

### Firefox

The following command with produce a file with a name like `build-firefox/pfp-n.n.n.xpi`:

    gulp xpi

### Chrome and Opera

The following command with produce a file with a name like `build-chrome/pfp-n.n.n.crx`:

    gulp crx --private-key=key.pem

You can also omit the `--private-key` parameter, an unsigned ZIP file will be created then which can be uploaded to Chrome Web Store or Opera Add-ons.

### Microsoft Edge

The following command will produce a file with a name like `build-edge/pfp-n.n.n.appx`:

    gulp appx

Note that Internet connection is currely required for Edge builds, as an external service is used for packaging.

### Web client

The following command with produce a file with a name like `build-web/pfp-web-n.n.n.zip`:

    gulp web

After unpacking the package, you can open `index.html` in the browser which will give you a slightly feature-reduced version of AEP.

How to test
-----------

### Firefox

The following command will create a `build-firefox` directory:

    gulp build-firefox

You can load this directory as a temporary extension in Firefox via `about:debugging` page. An already loaded extension will reload automatically on rebuild. If you want the directory to be updated automatically whenever you change any source files, you can use `gulp watch-firefox` instead.

### Chrome, Opera and Edge

The following command will create a `build-chrome` directory:

    gulp build-chrome

You can load this directory as an unpacked extension in Chrome, Opera or Edge. An already loaded extension will reload automatically on rebuild. If you want the directory to be updated automatically whenever you change any source files, you can use `gulp watch-chrome` instead.

### Web client

The following command will create a `build-web` directory:

    gulp build-web

You can then open `build-web/index.html` in your browser to test then.

Running unit tests
------------------

This repository contains an extensive test suite for the core functionality. You can run the unit tests using the following command:

    gulp test

You can also run an individual unit test file, for example:

    gulp test --test=masterPassword

Cleaning up the repository
--------------------------

You can run the following command to remove all temporary files that have been generated during build:

    gulp clean
