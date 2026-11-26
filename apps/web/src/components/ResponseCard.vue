<script setup lang="ts">
import { computed } from 'vue';
import type { Messages } from '../i18n';
import { renderMarkdown } from '../utils/markdown';

const props = defineProps<{
  reply: string;
  warning: string;
  messages: Messages;
}>();

const formattedReply = computed(() => renderMarkdown(props.reply));
</script>

<template>
  <section class="response-card" aria-live="polite">
    <h2>{{ messages.responseTitle }}</h2>
    <div class="response-content" v-html="formattedReply" />
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

.response-content {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--muted);
  line-height: 1.55;
}

.response-content :deep(> :first-child) {
  margin-top: 0;
}

.response-content :deep(> :last-child) {
  margin-bottom: 0;
}

.response-content :deep(p),
.response-content :deep(ul),
.response-content :deep(ol),
.response-content :deep(blockquote),
.response-content :deep(pre),
.response-content :deep(table),
.response-content :deep(hr) {
  margin-block: 0 0.75em;
}

.response-content :deep(h1),
.response-content :deep(h2),
.response-content :deep(h3),
.response-content :deep(h4),
.response-content :deep(h5),
.response-content :deep(h6) {
  margin-block: 1em 0.5em;
  color: var(--ink);
  line-height: 1.3;
}

.response-content :deep(h1) {
  font-size: 1.35rem;
}

.response-content :deep(h2) {
  font-size: 1.2rem;
}

.response-content :deep(h3),
.response-content :deep(h4),
.response-content :deep(h5),
.response-content :deep(h6) {
  font-size: 1.05rem;
}

.response-content :deep(ul),
.response-content :deep(ol) {
  padding-inline-start: 1.5rem;
}

.response-content :deep(li + li) {
  margin-top: 0.25em;
}

.response-content :deep(a) {
  color: var(--accent);
  overflow-wrap: anywhere;
  text-decoration: underline;
  text-underline-offset: 0.15em;
}

.response-content :deep(blockquote) {
  padding-inline-start: 0.9rem;
  border-inline-start: 2px solid var(--line);
}

.response-content :deep(code) {
  padding: 0.08em 0.28em;
  border-radius: 2px;
  background: var(--surface-hover);
  color: var(--code);
  font-family: var(--font-mono);
  font-size: 0.9em;
  overflow-wrap: anywhere;
}

.response-content :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
  padding: 0.8rem;
  border: 1px solid var(--line);
  border-radius: var(--radius, 2px);
  background: var(--surface-hover);
}

.response-content :deep(pre code) {
  padding: 0;
  background: transparent;
  white-space: pre;
}

.response-content :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
}

.response-content :deep(th),
.response-content :deep(td) {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--line);
  text-align: start;
}

.response-content :deep(th) {
  color: var(--ink);
  font-weight: 600;
}

.response-content :deep(hr) {
  border: 0;
  border-top: 1px solid var(--line);
}

.response-warning {
  margin: 6px 0 0;
  color: var(--error);
}
</style>
