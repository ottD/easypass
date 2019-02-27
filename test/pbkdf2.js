/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let {pbkdf2} = require("../data/pbkdf2");

function compare(test, password, salt, iterations, length, expected)
{
  let result = pbkdf2(
    Buffer.from(password, "utf-8"),
    Buffer.from(salt + "    ", "utf-8"),
    iterations,
    length
  );
  expected = expected.trim().split(/\s+/).map(n => parseInt(n, 16));
  test.deepEqual(new Uint8Array(result).join(",").split(","), expected);
}

exports.testRFC6070Vectors = function(test)
{
  // See https://tools.ietf.org/html/rfc6070
  compare(test, "password", "salt", 1, 20, `
    0c 60 c8 0f 96 1f 0e 71
    f3 a9 b5 24 af 60 12 06
    2f e0 37 a6
  `);

  compare(test, "password", "salt", 2, 20, `
    ea 6c 01 4d c7 2d 6f 8c
    cd 1e d9 2a ce 1d 41 f0
    d8 de 89 57
  `);

  compare(test, "password", "salt", 4096, 20, `
    4b 00 79 01 b7 65 48 9a
    be ad 49 d9 26 f7 21 d0
    65 a4 29 c1
  `);

/*
  compare(test, "password", "salt", 16777216, 20, `
    ee fe 3d 61 cd 4d a4 e4
    e9 94 5b 3d 6b a2 15 8c
    26 34 e9 84
  `);
*/

  compare(test, "passwordPASSWORDpassword", "saltSALTsaltSALTsaltSALTsaltSALTsalt", 4096, 25, `
    3d 2e ec 4f e4 1c 84 9b
    80 c8 d8 36 62 c0 e4 4a
    8b 29 1a 96 4c f2 f0 70
    38
  `);

  compare(test, "pass\0word", "sa\0lt", 4096, 16, `
    56 fa 6a a7 55 48 09 9d
    cc 37 d7 f0 34 25 e0 c3
  `);

  test.done();
};

exports.testOverlongData = function(test)
{
  compare(test,
    "passwordPASSWORDpasswordPASSWORDpasswordPASSWORDpasswordPASSWORDpasswordPASSWORDpassword",
    "saltSALTsaltSALTsaltSALTsaltSALTsaltSALTsaltSALTsaltSALTsaltSALTsaltSALTsaltSALTsaltSALT",
    4096, 70, `
    aa b0 9f 8f e8 5d 97 98 a1
    74 4d 0c c2 4b 7a 09 15 41
    4b 19 48 8b a2 67 41 dc 16
    0e 76 9f 93 8a 05 f7 4b d1
    8b 99 0e ff fa a5 f7 46 1e
    f7 c2 bb 3a 70 c1 62 23 78
    33 62 7c c8 bd a4 1c ea 69
    25 7e e8 ec 64 1e ff
  `);

  test.done();
};
