<script setup lang="ts">
import type { Messages } from '../../i18n';
import { CLIENT_MODES, type ClientMode, type FormState } from '../../types';
import VisualSettings from './VisualSettings.vue';

defineProps<{
  form: FormState;
  messages: Messages;
  accentSample: string;
  errorFor: (field: string) => string | undefined;
  describedBy: (field: string, hintId: string) => string;
}>();

function modeLabel(mode: ClientMode, messages: Messages): string {
  switch (mode) {
    case 'reference-ui':
      return messages.referenceMode;
    case 'custom-ui':
      return messages.customMode;
    case 'messengers':
      return messages.messengerMode;
  }
}
</script>

<template>
  <section class="form-group" :aria-labelledby="'ui-group-title'">
    <h2 id="ui-group-title">{{ messages.uiGroup }}</h2>
    <div class="field">
      <label for="client-mode">{{ messages.modeLabel }}</label>
      <select
        id="client-mode"
        v-model="form.clientMode"
        :aria-invalid="Boolean(errorFor('clientMode'))"
        :aria-describedby="describedBy('clientMode', 'client-mode-hint')"
      >
        <option
          v-for="mode in CLIENT_MODES"
          :key="mode"
          :value="mode"
        >
          {{ modeLabel(mode, messages) }}
        </option>
      </select>
      <p id="client-mode-hint" class="field-hint">{{ messages.modeHint }}</p>
      <p v-if="errorFor('clientMode')" class="field-error">
        {{ errorFor('clientMode') }}
      </p>
    </div>

    <p v-if="form.clientMode === 'custom-ui'" class="custom-ui-note">
      {{ messages.customUiContract }}
    </p>
    <VisualSettings
      v-else-if="form.clientMode === 'reference-ui'"
      :form="form"
      :messages="messages"
      :accent-sample="accentSample"
      :error-for="errorFor"
      :described-by="describedBy"
    />
  </section>
</template>
