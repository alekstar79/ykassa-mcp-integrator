<script setup lang="ts">
import { computed } from 'vue';
import type { Messages } from '../i18n';
import type { ToolCall } from '../types';

const props = defineProps<{ calls: ToolCall[]; messages: Messages }>();

const paymentLinks = computed(() =>
  props.calls.flatMap((call) => {
    if (
      call.error !== undefined ||
      (call.name !== 'create_payment' && call.name !== 'create_invoice')
    ) {
      return [];
    }

    const url = getConfirmationUrl(call.result);
    return url === null ? [] : [{ id: call.id, name: call.name, url }];
  }),
);

function getConfirmationUrl(result?: string): string | null {
  if (typeof result !== 'string') return null;

  let candidate = result.trim();
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
  <section
    v-if="paymentLinks.length > 0"
    class="tool-calls-card"
    aria-live="polite"
  >
    <h2>{{ messages.toolCallsTitle }}</h2>
    <ul class="payment-link-list">
      <li v-for="link in paymentLinks" :key="link.id">
        <p>
          {{
            link.name === 'create_invoice'
              ? messages.invoiceLinkReady
              : messages.paymentLinkReady
          }}
        </p>
        <a
          class="payment-link"
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{
            link.name === 'create_invoice'
              ? messages.openInvoice
              : messages.pay
          }}
        </a>
      </li>
    </ul>
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

.payment-link-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  display: grid;
  justify-items: start;
  gap: 9px;
  padding: 14px 0;
  border-top: 1px solid var(--line);
}

p {
  margin: 0;
  line-height: 1.5;
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

a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
