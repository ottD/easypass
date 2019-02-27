/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let scrypt = require("../data/scrypt");

function compare(test, password, salt, length, expected)
{
  let result = scrypt.deriveKey(
    Buffer.from(password, "utf-8"),
    Buffer.from(salt, "utf-8"),
    length
  );
  expected = expected.trim().split(/\s+/).map(n => parseInt(n, 16));
  test.deepEqual(new Uint8Array(result).join(",").split(","), expected);
}

exports.testExamples = function(test)
{
  compare(test, "", "", 64, `
    2c 80 4b f5 d0 cc b2 80 51 f2 0f b0 b9 9b f7 e9
    a4 5a 67 49 66 50 53 60 18 dd 88 39 d9 37 07 48
    f1 ac 54 8a 44 dd e1 4e f0 7f 30 6c 5f c7 fe 09
    10 54 c6 37 4d 73 d1 a4 f9 17 a0 fb cd 8b 88 b8
  `);

  compare(test, "password", "salt", 64, `
    4b c0 fd 50 7e 93 a6 00 76 80 21 34 1e c7 26 c5
    7c 00 cb 55 a4 70 2a 16 50 13 13 65 50 0c f4 71
    50 e2 0a 61 89 e2 62 63 30 06 8b 43 13 cb f1 ba
    8a 82 bb 34 f5 fe f9 50 01 78 c9 0d 3e b9 95 ac
  `);

  compare(test, "passwordPASSWORDpassword", "saltSALTsaltSALTsaltSALTsaltSALTsalt", 64, `
    92 26 94 41 7c e9 79 dc 24 02 f7 4e 70 15 4e fb
    af 23 93 eb dd 73 cb d5 dd 9a 5d 88 7c c9 a1 9e
    c5 bb e7 f3 9b df 56 1e 44 dc 3a a4 a3 24 7d 37
    61 1f 64 f1 0f 80 f8 5f 02 f0 b6 05 4a 4a 8f 5a
  `);

  compare(test, "pass\0word", "sa\0lt", 64, `
    bf a7 b1 2a ba 7c 57 7e fa da 7c b8 91 42 09 65
    d1 3e c0 b6 22 1c e8 61 72 39 45 b0 b9 87 a1 af
    5c 91 80 88 de 8b a3 32 eb ca b3 a1 85 af ef 7c
    f0 e6 8f 0b ce 0c 00 23 14 2d e1 60 2e 1f 58 88
  `);

  compare(test,
    "passwordPASSWORDpasswordPASSWORDpasswordPASSWORDpasswordPASSWORDpasswordPASSWORDpassword",
    "saltSALTsaltSALTsaltSALTsaltSALTsaltSALTsaltSALTsaltSALTsaltSALTsaltSALTsaltSALTsaltSALT",
    72, `
    a0 47 38 1e 3f df 62 13 db e5 c3 1d 98 4d f0 02
    9a 80 de 09 38 22 69 18 16 e0 1b 14 7f 71 ce 9a
    64 c2 9c 22 8b e0 bf 65 ca f4 03 69 05 55 78 5f
    5e 1e 2c ef 0e 2b d2 86 4c 30 88 41 fd c4 90 5e
    8b 69 47 f4 e8 05 47 39
  `);

  test.done();
};
