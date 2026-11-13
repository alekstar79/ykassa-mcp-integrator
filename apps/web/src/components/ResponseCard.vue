<script setup lang="ts">
import type { Messages } from '../i18n';

defineProps<{
  reply: string;
  warning: string;
  messages: Messages;
}>();
</script>

<template>
  <section class="response-card" aria-live="polite">
    <h2>{{ messages.responseTitle }}</h2>
    <p>{{ reply }}</p>
    <p v-if="warning" class="response-warning">{{ warning }}</p>
  </section>
</template>

<style scoped>
.response-card {
  min-width: 0;
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: var(--radius, 2px);
  background: var(--surface);
}

h2 {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 600;
}

p {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--muted);
  line-height: 1.55;
}

.response-warning {
  margin-top: 6px;
  color: var(--error);
}
</style>
