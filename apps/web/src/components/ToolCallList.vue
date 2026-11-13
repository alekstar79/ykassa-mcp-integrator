<script setup lang="ts">
import type { Messages } from '../i18n';
import type { ToolCall } from '../types';

defineProps<{ calls: ToolCall[]; messages: Messages }>();

function displayResult(result: unknown): string {
  return JSON.stringify(result, null, 2) ?? '';
}

function getConfirmationUrl(result?: string): string | null {
  if (typeof result !== 'string') return null;

  let candidate = result.trim();
  if (!candidate.startsWith('https://yoomoney.ru/checkout/')) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('confirmation_url' in parsed) ||
        typeof parsed.confirmation_url !== 'string'
      ) {
        return null;
      }
      candidate = parsed.confirmation_url;
    } catch {
      return null;
    }
  }

  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' &&
      url.hostname === 'yoomoney.ru' &&
      url.pathname.startsWith('/checkout/')
      ? url.href
      : null;
  } catch {
    return null;
  }
}
</script>

<template>
  <section class="tool-calls-card" aria-live="polite">
    <h2>{{ messages.toolCallsTitle }}</h2>
    <ol class="tool-call-list">
      <li v-for="call in calls" :key="call.id">
        <strong>{{ call.name }}</strong>
        <details>
          <summary>{{ messages.arguments }}</summary>
          <pre>{{ displayResult(call.args) }}</pre>
        </details>
        <p v-if="call.error" class="tool-call-error" role="status">
          {{ call.error }}
        </p>
        <div v-else-if="getConfirmationUrl(call.result)" class="payment-result">
          <a
            class="payment-link"
            :href="getConfirmationUrl(call.result) ?? undefined"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ messages.pay }}
          </a>
          <details>
            <summary>{{ messages.responseDetails }}</summary>
            <pre>{{ call.result }}</pre>
          </details>
        </div>
        <pre v-else>{{ call.result ?? messages.missingResult }}</pre>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.tool-calls-card {
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

.tool-call-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  min-width: 0;
  padding: 14px 0;
  border-top: 1px solid var(--line);
}

strong {
  display: block;
  margin-bottom: 4px;
  overflow-wrap: anywhere;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
}

details {
  margin-top: 8px;
}

summary {
  cursor: pointer;
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
}

pre {
  max-width: 100%;
  max-height: 220px;
  margin: 14px 0 0;
  overflow: auto;
  color: var(--code);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 400;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.payment-result {
  display: grid;
  justify-items: start;
  gap: 9px;
  margin-top: 14px;
}

.payment-link {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  border: 1px solid var(--accent);
  border-radius: var(--radius, 2px);
  color: var(--accent-foreground);
  background: var(--accent);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 120ms ease, box-shadow 120ms ease,
    transform 120ms ease;
}

.payment-link:hover {
  background: var(--accent-hover);
  box-shadow: var(--micro-shadow);
}

.payment-link:active {
  transform: translateY(1px);
}

.tool-call-error {
  margin: 12px 0 0;
  color: var(--error);
  line-height: 1.5;
}

a:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
