<script setup lang="ts">
import type { Messages } from '../i18n';
import type { ValidationSummaryItem } from '../types';

defineProps<{
  summary: ValidationSummaryItem[];
  downloadError: string;
  messages: Messages;
}>();
</script>

<template>
  <section
    v-if="summary.length"
    class="validation-summary"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <p class="validation-summary-title">
      {{ messages.validationSummaryTitle }}
    </p>
    <ul>
      <li v-for="error in summary" :key="error.field">
        {{ error.label }}: {{ error.message }}
      </li>
    </ul>
  </section>
  <p v-if="downloadError" class="field-error" role="alert">
    {{ downloadError }}
  </p>
</template>
