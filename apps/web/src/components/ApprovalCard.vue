<script setup lang="ts">
import { computed } from 'vue';
import type { Messages } from '../i18n';
import type { PendingApproval, ProposedActionItem } from '../types';

const props = defineProps<{
  approval: PendingApproval | null;
  busy: boolean;
  messages: Messages;
}>();

const emit = defineEmits<{ resolve: [approved: boolean] }>();
type KeyedAction = ProposedActionItem & { key: string };

function withActionKeys(
  actions: ProposedActionItem[],
  group: 'safe' | 'risky',
): KeyedAction[] {
  const occurrences = new Map<string, number>();

  return actions.map((action) => {
    const identity = JSON.stringify([action.tool, action.args]);
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);

    return { ...action, key: `${group}:${identity}:${occurrence}` };
  });
}

const safeActions = computed(
  () =>
    withActionKeys(
      props.approval?.actions.filter(
        (action) => !action.requires_confirmation,
      ) ?? [],
      'safe',
    ),
);
const riskyActions = computed(
  () =>
    withActionKeys(
      props.approval?.actions.filter(
        (action) => action.requires_confirmation,
      ) ?? [],
      'risky',
    ),
);

function displayResult(result: unknown): string {
  return JSON.stringify(result, null, 2) ?? '';
}
</script>

<template>
  <section v-if="approval" class="approval-card" aria-live="polite">
    <div class="approval-heading">
      <div>
        <p class="approval-label">{{ messages.approvalLabel }}</p>
        <h2>{{ messages.approvalTitle }}</h2>
      </div>
    </div>
    <div v-if="safeActions.length > 0" class="approval-group">
      <h3>{{ messages.safeActions }}</h3>
      <dl
        v-for="action in safeActions"
        :key="action.key"
        class="action-details"
      >
        <dt>{{ messages.operation }}</dt>
        <dd class="technical-value">{{ action.tool }}</dd>
        <dt>{{ messages.confirmation }}</dt>
        <dd>
          {{ action.requires_confirmation ? messages.yes : messages.no }}
        </dd>
        <details>
          <summary>{{ messages.arguments }}</summary>
          <pre>{{ displayResult(action.args) }}</pre>
        </details>
      </dl>
    </div>
    <div v-if="riskyActions.length > 0" class="approval-group">
      <h3>{{ messages.riskyActions }}</h3>
      <dl
        v-for="action in riskyActions"
        :key="action.key"
        class="action-details"
      >
        <dt>{{ messages.operation }}</dt>
        <dd class="technical-value">{{ action.tool }}</dd>
        <dt>{{ messages.confirmation }}</dt>
        <dd>
          {{ action.requires_confirmation ? messages.yes : messages.no }}
        </dd>
        <details>
          <summary>{{ messages.arguments }}</summary>
          <pre>{{ displayResult(action.args) }}</pre>
        </details>
      </dl>
    </div>
    <div class="approval-actions">
      <button
        class="approve-button"
        type="button"
        :disabled="busy"
        @click="emit('resolve', true)"
      >
        {{ messages.approveAll }}
      </button>
      <button
        class="reject-button"
        type="button"
        :disabled="busy"
        @click="emit('resolve', false)"
      >
        {{ messages.rejectAll }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.approval-card {
  min-width: 0;
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-left: 4px solid var(--alert-accent);
  border-radius: var(--radius, 2px);
  background: var(--surface);
}

.approval-heading {
  margin-bottom: 15px;
}

.approval-label {
  margin: 0 0 5px;
  color: var(--alert-accent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.approval-group h3 {
  margin: 18px 0 0;
  color: var(--ink);
  font-size: 13px;
  font-weight: 600;
}

.action-details {
  display: grid;
  grid-template-columns: minmax(90px, 0.35fr) minmax(0, 1fr);
  gap: 9px 14px;
  min-width: 0;
  margin: 0;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
}

.action-details details {
  grid-column: 1 / -1;
  margin-top: 3px;
}

summary {
  cursor: pointer;
  color: var(--accent);
  font-size: 13px;
}

dt {
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}

dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--ink);
  font-weight: 600;
}

.technical-value,
pre {
  font-family: var(--font-mono);
  font-weight: 400;
}

pre {
  max-height: 220px;
  margin: 14px 0 0;
  overflow: auto;
  color: var(--code);
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.approval-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

button {
  min-height: 48px;
  padding: 0 20px;
  border: 1px solid var(--accent);
  border-radius: var(--radius, 2px);
  font: inherit;
  font-weight: 600;
  transition: transform 120ms ease, background-color 120ms ease,
    box-shadow 120ms ease;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.approve-button {
  flex: 1;
  color: var(--accent-foreground);
  background: var(--accent);
}

.approve-button:hover:not(:disabled) {
  background: var(--accent-hover);
  box-shadow: var(--micro-shadow);
}

.reject-button {
  color: var(--accent);
  background: transparent;
}

.reject-button:hover:not(:disabled) {
  background: var(--surface-hover);
}

button:active:not(:disabled) {
  transform: translateY(1px);
}

button:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (max-width: 520px) {
  .approval-actions {
    flex-direction: column;
  }
}

@media (max-width: 380px) {
  .action-details {
    grid-template-columns: 1fr;
    gap: 5px;
  }
}
</style>
