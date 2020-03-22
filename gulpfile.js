/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const url = require("url");

const del = require("del");
const gulp = require("gulp");
const eslint = require("gulp-eslint");
const htmlhint = require("gulp-htmlhint");
const rollupStream = require("gulp-better-rollup");
const sass = require("gulp-sass");
const stylelint = require("gulp-stylelint");
const zip = require("gulp-zip");
const merge = require("merge-stream");
const babel = require("rollup-plugin-babel");
const commonjs = require("rollup-plugin-commonjs");
const resolve = require("rollup-plugin-node-resolve");
const vue = require("rollup-plugin-vue");

const replace = require("./replacePlugin");
const utils = require("./gulp-utils");

function rollup(overrides = {})
{
  let prePlugins = overrides.plugins || [];
  let postPlugins = overrides.postPlugins || [];
  delete overrides.plugins;
  delete overrides.postPlugins;

  return rollupStream({
    plugins: [
      ...prePlugins,
      require("./globalLoader")({
        vue: "Vue",
        jsqr: "JSQR",
        zxcvbn: "zxcvbn"
      }),
      resolve(),
      commonjs({
        include: ["node_modules/**"]
      }),
      vue({
        template: {
          compilerOptions: {
            whitespace: "condense"
          }
        }
      }),
      ...postPlugins
    ]
  }, Object.assign({
    format: "cjs",
    compact: true
  }, overrides));
}

gulp.task("eslint", function()
{
  return gulp.src(["*.js", "*.json", "ui/**/*.js", "ui/**/*.vue", "lib/**/*.js",
                   "test/**/*.js", "test-lib/**/*.js", "web/**/*.js",
                   "contentScript/**/*.js", "worker/**/*.js",
                   "locale/**/*.json", "!ui/third-party/**"])
             .pipe(eslint())
             .pipe(eslint.format())
             .pipe(eslint.failAfterError());
});

gulp.task("htmlhint", function()
{
  return gulp.src(["ui/**/*.html", "web/**/*.html"])
             .pipe(htmlhint(".htmlhintrc"))
             .pipe(htmlhint.failReporter());
});

gulp.task("stylelint", function()
{
  return gulp.src(["ui/**/*.scss"])
             .pipe(stylelint({
               "failAfterError": true,
               "syntax": "scss",
               "reporters": [
                 {
                   "formatter": "string",
                   "console": true
                 }
               ]
             }));
});

gulp.task("validate", gulp.parallel("eslint", "htmlhint", "stylelint"));

function buildWorkers(targetdir)
{
  let overrides = {};

  if (targetdir == "build-test/worker")
  {
    overrides = {
      plugins: [replace({
        [path.resolve(__dirname, "lib", "typedArrayConversion.js")]: path.resolve(__dirname, "test-lib", "typedArrayConversion.js")
      })],
    };
  }

  return merge(
    gulp.src(["worker/pbkdf2.js"])
        .pipe(rollup(overrides))
        .pipe(gulp.dest(`${targetdir}`)),
    gulp.src(["worker/scrypt.js"])
        .pipe(rollup(overrides))
        .pipe(gulp.dest(`${targetdir}`))
  );
}

function buildCommon(targetdir)
{
  return merge(
    gulp.src("LICENSE.txt")
        .pipe(gulp.dest(`${targetdir}`)),
    gulp.src("ui/**/*.html")
        .pipe(gulp.dest(`${targetdir}/ui`)),
    gulp.src("ui/images/**")
        .pipe(gulp.dest(`${targetdir}/ui/images`)),
    gulp.src("ui/third-party/**")
        .pipe(gulp.dest(`${targetdir}/ui/third-party`)),
    gulp.src(["contentScript/fillIn.js"])
        .pipe(rollup({
          format: "iife"
        }))
        .pipe(gulp.dest(`${targetdir}/contentScript`)),
    gulp.src("ui/panel/main.js")
        .pipe(rollup({
          file: "panel.js"
        }))
        .pipe(gulp.dest(`${targetdir}/ui/panel`)),
    gulp.src("ui/allpasswords/main.js")
        .pipe(rollup({
          file: "allpasswords.js"
        }))
        .pipe(gulp.dest(`${targetdir}/ui/allpasswords`)),
    gulp.src("ui/options/main.js")
        .pipe(rollup({
          file: "options.js"
        }))
        .pipe(gulp.dest(`${targetdir}/ui/options`)),
    gulp.src(["ui/**/*.scss"])
        .pipe(sass())
        .pipe(gulp.dest(`${targetdir}/ui`)),
    gulp.src("locale/**/*.json")
        .pipe(utils.combineLocales())
        .pipe(utils.toChromeLocale())
        .pipe(gulp.dest(`${targetdir}/_locales`)),
    gulp.src("lib/main.js")
        .pipe(rollup({
          file: "background.js"
        }))
        .pipe(gulp.dest(`${targetdir}`)),
    gulp.src(["lib/reloader.js"])
        .pipe(gulp.dest(`${targetdir}`)),
    buildWorkers(`${targetdir}/worker`)
  );
}

function touchReloader(targetdir)
{
  fs.writeFileSync(path.join(targetdir, "random.json"), Math.random());
}

function removeReloader(data)
{
  let index = data.background.scripts.indexOf("reloader.js");
  if (index >= 0)
    data.background.scripts.splice(index, 1);
}

gulp.task("build-chrome", gulp.series("validate", function buildChrome()
{
  let stream = merge(
    buildCommon("build-chrome"),
    gulp.src("manifest.json")
        .pipe(utils.jsonModify(data =>
        {
          delete data.applications;
        }))
        .pipe(gulp.dest("build-chrome"))
  );
  stream.on("finish", () => touchReloader("build-chrome"));
  return stream;
}));

gulp.task("watch-chrome", gulp.series("build-chrome", function watchChrome()
{
  gulp.watch(["*.js", "*.json", "ui/**/*", "lib/**/*", "contentScript/**/*", "worker/**/*", "locale/**/*"], ["build-chrome"]);
}));

gulp.task("build-firefox", gulp.series("validate", function buildFirefox()
{
  let stream = merge(
    buildCommon("build-firefox"),
    gulp.src("manifest.json")
        .pipe(utils.jsonModify(data =>
        {
          delete data.minimum_chrome_version;
          delete data.minimum_opera_version;
          delete data.background.persistent;

          data.browser_action.browser_style = false;
        }))
        .pipe(gulp.dest("build-firefox"))
  );
  stream.on("finish", () => touchReloader("build-firefox"));
  return stream;
}));

gulp.task("build-test", gulp.series("validate", function buildTest()
{
  return merge(
    buildWorkers("build-test/worker"),
    gulp.src("test-lib/lib.js")
        .pipe(rollup({
          plugins: [replace({
            [path.resolve(__dirname, "lib", "browserAPI.js")]: path.resolve(__dirname, "test-lib", "browserAPI.js"),
            [path.resolve(__dirname, "lib", "typedArrayConversion.js")]: path.resolve(__dirname, "test-lib", "typedArrayConversion.js"),
            [path.resolve(__dirname, "lib", "sync-providers", "dropbox.js")]: path.resolve(__dirname, "test-lib", "sync-providers", "dropbox.js")
          })]
        }))
        .pipe(gulp.dest("build-test"))
  );
}));

gulp.task("watch-firefox", gulp.series("build-firefox", function watchFirefox()
{
  gulp.watch(["*.js", "*.json", "ui/**/*", "lib/**/*", "contentScript/**/*", "worker/**/*", "locale/**/*"], ["build-firefox"]);
}));

gulp.task("build-web", gulp.series("validate", function buildWeb()
{
  let targetdir = "build-web";
  return merge(
    gulp.src("LICENSE.txt")
        .pipe(gulp.dest(targetdir)),
    gulp.src(["ui/images/**"])
        .pipe(gulp.dest(`${targetdir}/images`)),
    gulp.src("ui/third-party/**")
        .pipe(gulp.dest(`${targetdir}/third-party`)),
    gulp.src(["ui/**/*.scss", "!ui/options/options.scss"])
        .pipe(sass())
        .pipe(gulp.dest(targetdir)),
    gulp.src("web/index.js")
        .pipe(rollup({
          plugins: [
            replace({
              [path.resolve(__dirname, "lib", "browserAPI.js")]: path.resolve(__dirname, "web", "backgroundBrowserAPI.js"),
              [path.resolve(__dirname, "ui", "browserAPI.js")]: path.resolve(__dirname, "web", "contentBrowserAPI.js")
            }),
            require("./workerLoader")(/\/(scrypt|pbkdf2)\.js$/),
            require("./localeLoader")(path.resolve(__dirname, "locale", "en_US"))
          ],
          postPlugins: [
            babel({
              babelrc: false,
              presets: ["@babel/preset-env"]
            })
          ]
        }))
        .pipe(gulp.dest(targetdir)),
    gulp.src("web/**/*.scss")
        .pipe(sass())
        .pipe(gulp.dest(targetdir)),
    gulp.src("web/**/*.html")
        .pipe(gulp.dest(targetdir))
  );
}));

gulp.task("crx", gulp.series("build-chrome", function buildCRX()
{
  let manifest = require("./manifest.json");
  return merge(
    gulp.src([
      "build-chrome/**",
      "!build-chrome/manifest.json", "!build-chrome/reloader.js", "!build-chrome/random.json",
      "!build-chrome/**/.*", "!build-chrome/**/*.zip", "!build-chrome/**/*.crx"
    ]),
    gulp.src("build-chrome/manifest.json").pipe(utils.jsonModify(removeReloader))
  ).pipe(zip("aep-" + manifest.version + ".zip")).pipe(gulp.dest("build-chrome"));
}));

gulp.task("xpi", gulp.series("build-firefox", function buildXPI()
{
  let manifest = require("./manifest.json");
  return merge(
    gulp.src([
      "build-firefox/**",
      "!build-firefox/manifest.json", "!build-firefox/reloader.js", "!build-firefox/random.json",
      "!build-firefox/**/.*", "!build-firefox/**/*.xpi"
    ]),
    gulp.src("build-firefox/manifest.json").pipe(utils.jsonModify(removeReloader))
  ).pipe(zip("aep-" + manifest.version + ".xpi")).pipe(gulp.dest("build-firefox"));
}));

gulp.task("web", gulp.series("build-web", function zipWeb()
{
  let manifest = require("./manifest.json");
  return gulp.src([
    "build-web/**",
    "!build-web/**/.*", "!build-web/**/*.zip"
  ]).pipe(zip("aep-web-" + manifest.version + ".zip")).pipe(gulp.dest("build-web"));
}));

gulp.task("test", gulp.series("validate", "build-test", function doTest()
{
  let testFile = utils.readArg("--test=");
  if (!testFile)
    testFile = "**/*.js";
  else if (!testFile.endsWith(".js"))
    testFile += ".js";

  return gulp.src("test/" + testFile)
             .pipe(utils.runTests());
}));

gulp.task("clean", function()
{
  return del(["build-chrome", "build-firefox", "build-test", "build-web"]);
});

gulp.task("all", gulp.parallel("xpi", "crx", "web"));
gulp.task("default", gulp.parallel("all"));
