<!--
 - This Source Code is subject to the terms of the Mozilla Public License
 - version 2.0 (the "License"). You can obtain a copy of the License at
 - http://mozilla.org/MPL/2.0/.
 -->

<template>
  <modal-overlay v-keyboard-navigation="password-menu-entry" @cancel="$emit('cancel')">
    <a v-if="!$isWebClient" v-focus href="#" class="password-menu-entry" @click.prevent="$parent.fillIn">
      <span class="to-document-link iconic-link" />
      {{ $t("to_document") }}
    </a>
    <div class="password-menu-entry-container">
      <a v-focus="$isWebClient" href="#" class="password-menu-entry" @click.prevent="$parent.copy">
        <span class="to-clipboard-link iconic-link" />
        {{ $t("to_clipboard") }}
      </a>
      <a href="#" class="password-menu-entry" @click.prevent="$parent.copyUsername">
        {{ $t("to_clipboard_username") }}
      </a>
    </div>
    <a href="#" class="password-menu-entry" @click.prevent="$parent.showPwShow">
      <span class="show-pwshow-link iconic-link" />
      {{ $t("show_pwshow") }}
    </a>
    <a href="#" class="password-menu-entry" @click.prevent="$parent.showNotes">
      <span class="notes-link iconic-link" />
      {{ $t(password.notes ? "edit_notes" : "add_notes") }}
    </a>
    <a v-if="password.type == 'stored'" href="#" class="password-menu-entry" @click.prevent="$parent.makeGenerated">
      <span class="make-generated-link iconic-link" />
      {{ $t("make_generated") }}
    </a>
    <a href="#" class="password-menu-entry" @click.prevent="$parent.bumpRevision">
      <span class="bump-revision-link iconic-link" />
      {{ $t("bump_revision") }}
    </a>
    <a href="#" class="password-menu-entry" @click.prevent="$parent.removePassword">
      <span class="password-remove-link iconic-link" />
      {{ $t("remove_password") }}
    </a>
  </modal-overlay>
</template>

<script>
"use strict";

export default {
  name: "PasswordMenu",
  localePath: "panel/components/PasswordMenu",
  props: {
    password: {
      type: Object,
      required: true
    }
  }
};
</script>
