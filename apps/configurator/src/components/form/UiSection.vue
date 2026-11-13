<script setup lang="ts">
import { CLIENT_UI_MODES } from '@alekstar79/ykassa-contracts';
import type { Messages } from '../../i18n';
import type { FormState } from '../../types';
import VisualSettings from './VisualSettings.vue';

defineProps<{
  form: FormState;
  messages: Messages;
  accentSample: string;
  errorFor: (field: string) => string | undefined;
  describedBy: (field: string, hintId: string) => string;
}>();
</script>

<template>
  <section class="form-group" :aria-labelledby="'ui-group-title'">
    <h2 id="ui-group-title">{{ messages.uiGroup }}</h2>
    <div class="field">
      <label for="ui-mode">{{ messages.modeLabel }}</label>
      <select
        id="ui-mode"
        v-model="form.ui.mode"
        :aria-invalid="Boolean(errorFor('ui.mode'))"
        :aria-describedby="describedBy('ui.mode', 'ui-mode-hint')"
      >
        <option
          v-for="mode in CLIENT_UI_MODES"
          :key="mode"
          :value="mode"
        >
          {{
            mode === 'reference-ui'
              ? messages.referenceMode
              : messages.customMode
          }}
        </option>
      </select>
      <p id="ui-mode-hint" class="field-hint">{{ messages.modeHint }}</p>
      <p v-if="errorFor('ui.mode')" class="field-error">
        {{ errorFor('ui.mode') }}
      </p>
    </div>

    <p v-if="form.ui.mode === 'custom-ui'" class="custom-ui-note">
      {{ messages.customUiContract }}
    </p>
    <VisualSettings
      v-else
      :form="form"
      :messages="messages"
      :accent-sample="accentSample"
      :error-for="errorFor"
      :described-by="describedBy"
    />
  </section>
</template>
