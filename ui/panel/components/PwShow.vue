<!--
 - This Source Code is subject to the terms of the Mozilla Public License
 - version 2.0 (the "License"). You can obtain a copy of the License at
 - http://mozilla.org/MPL/2.0/.
 -->

<template>
  <modal-overlay :focus-cancel="true" @cancel="$emit('cancel')">
    <div>{{ $t(".(PasswordNameEntry)username_label") }}</div>
    <div>
      <span>{{ password.name }}</span>
      <span v-if="password.revision" class="password-revision">{{ password.revision }}</span>
    </div>
    <div class="block-start qrcode-canvas-container">
      <canvas ref="canvas" :width="matrix.pixelWidth" :height="matrix.pixelWidth" />
    </div>
  </modal-overlay>
</template>

<script>
"use strict";

import JSQR from "jsqr";

export default {
  name: "QRCode",
  localePath: "panel/components/QRCode",
  props: {
    password: {
      type: Object,
      required: true
    },
    value: {
      type: String,
      required: true
    }
  },
  data()
  {
    let qr = new JSQR();

    let code = new qr.Code();
    code.encodeMode = code.ENCODE_MODE.BYTE;
    code.version = code.DEFAULT;
    code.errorCorrection = code.ERROR_CORRECTION.M;

    let input = new qr.Input();
    input.dataType = input.DATA_TYPE.TEXT;
    input.data = this.value;

    let matrix = new qr.Matrix(input, code);
    matrix.margin = 0;
    matrix.scale = 8;

    return {
      matrix
    };
  },
  mounted()
  {
    let canvas = this.$refs.canvas;
    let context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "black";
    this.matrix.draw(canvas, 0, 0);
  }
};
</script>
