<script setup lang="ts">
import { computed, ref, watch, type CSSProperties, type Ref } from 'vue';

import type { PublicClientConfig, RequestPayload } from './types';
import { CLIENT_CONFIG_DEFAULTS } from '@alekstar79/ykassa-contracts/defaults';
import { ACCENT_PALETTE } from '@alekstar79/ykassa-contracts/palette';
import { useClientApi } from './composables/useClientApi';
import { usePublicClient } from './composables/usePublicClient';
import { translations, type Locale, type Messages } from './i18n';
import ClientHeader from './components/ClientHeader.vue';
import ChatHistory from './components/ChatHistory.vue';
import RequestForm from './components/RequestForm.vue';

const THEME_STORAGE_KEY = 'yookassa-theme';
const LOCALE_STORAGE_KEY = 'yookassa-locale';
type Theme = 'light' | 'dark';

const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
const theme = ref<Theme>(storedTheme === 'dark' ? 'dark' : 'light');
const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
const locale = ref<Locale>(storedLocale === 'en' ? 'en' : 'ru');
const messages = computed<Messages>(() => translations[locale.value]);

document.documentElement.setAttribute('data-theme', theme.value);
document.documentElement.lang = locale.value;

watch(
  locale,
  (value) => {
    document.documentElement.lang = value;
    document.title = translations[value].documentTitle;
  },
  { immediate: true },
);

const {
  clientName,
  availableClients,
  publicClient: publicClientRef,
  clientError,
  isClientLoading,
  requiresClientSelection,
  noConfiguredClients,
  selectClient,
  retryClientLoad,
  backToClientSelection,
} = usePublicClient(locale);
const publicClient: Ref<PublicClientConfig | null> = publicClientRef;

const {
  chatTurns,
  isHistoryLoading,
  historyLoadFailed,
  historyLoadErrorDetail,
  activeTurnId,
  errorMessage,
  pendingApproval,
  isBusy,
  sendRequest,
  resolveApproval,
  retryHistory,
  clearError,
} = useClientApi(clientName, locale);

const clientStyle = computed<CSSProperties>(() => {
  const ui = {
    ...CLIENT_CONFIG_DEFAULTS.ui,
    ...publicClient.value?.ui,
  };

  const style: CSSProperties = {};
  const accent = ACCENT_PALETTE[ui.accent][theme.value];

  style['--accent'] = accent.bg;
  style['--accent-foreground'] = accent.fg;
  style['--accent-hover'] = accent.hover;
  style['--radius'] = `${ui.radius}px`;
  style['--h1-size'] = {
    s: 'clamp(1.5rem, 3.2vw, 2rem)',
    m: 'clamp(1.8rem, 4vw, 2.5rem)',
    l: 'clamp(2.2rem, 5vw, 3rem)',
  }[ui.h1_size];
  style['--font-body'] =
    ui.font_pair === 'inter+jetbrains'
      ? '"Inter", sans-serif'
      : '"Manrope", sans-serif';
  style['--micro-shadow'] =
    ui.shadow === 'none'
      ? 'none'
      : ui.shadow === 'medium'
        ? theme.value === 'dark'
          ? '0 3px 10px rgb(0 0 0 / 32%)'
          : '0 3px 10px rgb(17 24 39 / 12%)'
        : theme.value === 'dark'
          ? '0 1px 3px rgb(0 0 0 / 24%)'
          : '0 1px 3px rgb(17 24 39 / 7%)';

  return style;
});

async function handleSubmit(payload: RequestPayload): Promise<void> {
  if (!publicClient.value) return;
  await sendRequest(payload);
}

function selectTurn(turnId: string): void {
  activeTurnId.value = turnId;
}

function toggleTheme(): void {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme.value);
  window.localStorage.setItem(THEME_STORAGE_KEY, theme.value);
}

function setLocale(value: Locale): void {
  locale.value = value;
  window.localStorage.setItem(LOCALE_STORAGE_KEY, value);
}
</script>

<template>
  <main class="page" :style="clientStyle">
    <div class="page-shell">
      <ClientHeader
        :brand-name="publicClient?.brand?.display_name ?? ''"
        :theme="theme"
        :locale="locale"
        :messages="messages"
        @toggle-theme="toggleTheme"
        @set-locale="setLocale"
      />
      <div v-if="isClientLoading" class="state-panel loading-state" role="status">
        <span class="loading-indicator" aria-hidden="true" />
        <p>{{ messages.loadingClient }}</p>
      </div>
      <div v-else-if="clientError" class="state-panel error-state" role="alert">
        <div class="state-content">
          <p>{{ clientError }}</p>
          <div class="state-actions">
            <button type="button" class="state-action" @click="retryClientLoad">
              {{ messages.retryClientLoad }}
            </button>
            <button
              v-if="clientName && availableClients.length > 1"
              type="button"
              class="state-action"
              @click="backToClientSelection"
            >
              {{ messages.backToClientSelection }}
            </button>
          </div>
        </div>
      </div>
      <section
        v-else-if="requiresClientSelection"
        class="client-selection"
        aria-labelledby="client-selection-title"
      >
        <p class="client-selection__prompt">
          {{ messages.clientSelectionPrompt }}
        </p>
        <h2 id="client-selection-title">
          {{ messages.clientSelectionTitle }}
        </h2>
        <div class="client-selection__list">
          <button
            v-for="client in availableClients"
            :key="client.name"
            type="button"
            class="client-selection__option"
            @click="selectClient(client.name)"
          >
            <span class="client-selection__name">{{ client.display_name }}</span>
            <span class="client-selection__id">{{ client.name }}</span>
          </button>
        </div>
      </section>
      <div
        v-else-if="noConfiguredClients"
        class="state-panel empty-state"
        role="status"
      >
        <p>{{ messages.noConfiguredClients }}</p>
      </div>
      <template v-else>
        <ChatHistory
          :turns="chatTurns"
          :loading="isHistoryLoading"
          :load-failed="historyLoadFailed"
          :load-error-detail="historyLoadErrorDetail"
          :active-turn-id="activeTurnId"
          :pending-approval="pendingApproval"
          :busy="isBusy"
          :messages="messages"
          @retry="retryHistory"
          @select-turn="selectTurn"
          @resolve-approval="resolveApproval"
        />

        <section class="request-section" :aria-label="messages.requestSection">
          <RequestForm
            :placeholder="messages.requestPlaceholder"
            :messages="messages"
            :max-attachment-kb="
              publicClient?.limits?.max_attachment_kb ??
              CLIENT_CONFIG_DEFAULTS.limits.max_attachment_kb
            "
            :form-style="publicClient?.ui.form_style ?? 'flat'"
            :error-message="errorMessage"
            :busy="isBusy"
            :approval-pending="pendingApproval !== null || isHistoryLoading"
            @submit="handleSubmit"
            @clear-error="clearError"
          />
        </section>

        <footer>
          {{ messages.footer }}
        </footer>
      </template>
    </div>
  </main>
</template>

<style>
:root {
  color-scheme: light;
  --paper: #faf9f6;
  --surface: #fff;
  --ink: #111827;
  --accent: #1a365d;
  --accent-foreground: #fff;
  --accent-hover: #142b4a;
  --alert-accent: #c2410c;
  --muted: #4b5563;
  --line: #e5e7eb;
  --code: #374151;
  --error: #7f1d1d;
  --surface-hover: #f3f4f6;
  --micro-shadow: var(
    --client-micro-shadow-light,
    0 1px 3px rgb(17 24 39 / 7%)
  );
  --radius: 2px;
  --font-body: "Manrope", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  font-family: var(--font-body), serif;
  color: var(--ink);
  background: var(--paper);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

[data-theme="dark"] {
  color-scheme: dark;
  --paper: #111827;
  --surface: #1f2937;
  --ink: #f9fafb;
  --accent: #60a5fa;
  --accent-foreground: #111827;
  --accent-hover: #93c5fd;
  --alert-accent: #fb923c;
  --muted: #d1d5db;
  --line: #374151;
  --code: #e5e7eb;
  --error: #fecaca;
  --surface-hover: #374151;
  --micro-shadow: var(
    --client-micro-shadow-dark,
    0 1px 3px rgb(0 0 0 / 24%)
  );
}

* {
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
}

body {
  min-height: 0;
  overflow: hidden;
  min-width: 320px;
  margin: 0;
  background: var(--paper);
}

button,
input,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

button:disabled,
input:disabled,
textarea:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

h1,
h2,
p {
  margin-top: 0;
}

.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
  padding: 22px 24px 12px;
  font-family: var(--font-body), serif;
}

.page-shell {
  display: flex;
  width: min(100%, 768px);
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  margin-inline: auto;
}

.request-section {
  flex: 0 0 auto;
  min-width: 0;
  margin-top: 12px;
}

.state-panel {
  display: flex;
  min-height: 176px;
  align-items: center;
  gap: 13px;
  padding: 22px;
  border: 1px dashed var(--line);
  color: var(--muted);
  background: var(--surface);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(5px);
}

.state-panel {
  width: min(100%, 720px);
  min-height: 140px;
  margin: 12px auto;
  justify-content: center;
}

.state-panel p {
  margin: 0;
  line-height: 1.55;
}

.state-content {
  display: grid;
  justify-items: center;
  gap: 14px;
}

.state-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.state-action {
  min-height: 40px;
  padding: 8px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  color: var(--ink);
  background: var(--surface);
}

.state-action:hover {
  background: var(--surface-hover);
}

.state-action:focus-visible,
.client-selection__option:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.client-selection {
  width: min(100%, 720px);
  margin: 18px auto;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--micro-shadow);
}

.client-selection__prompt {
  margin-bottom: 8px;
  color: var(--muted);
  font-size: 14px;
}

.client-selection h2 {
  margin-bottom: 18px;
  font-size: 20px;
  line-height: 1.3;
}

.client-selection__list {
  display: grid;
  gap: 10px;
}

.client-selection__option {
  display: flex;
  width: 100%;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  color: var(--ink);
  background: var(--surface);
  text-align: left;
  transition: background-color 120ms ease, border-color 120ms ease;
}

.client-selection__option:hover {
  border-color: var(--accent);
  background: var(--surface-hover);
}

.client-selection__name {
  font-weight: 700;
}

.client-selection__id {
  color: var(--muted);
  font-family: var(--font-mono), serif;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.loading-indicator {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 850ms linear infinite;
}

.error-state {
  border-style: solid;
  border-left: 4px solid var(--alert-accent);
  color: var(--error);
  background: var(--surface);
}

footer {
  flex: 0 0 auto;
  margin-top: 8px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .page {
    padding: 16px 18px 10px;
  }
}

@media (max-width: 420px) {
  .page {
    padding: 12px 12px 8px;
  }
}

@media (max-height: 580px) {
  .page {
    padding-top: 8px;
  }

  .request-section {
    margin-top: 6px;
  }

  footer {
    margin-top: 6px;
    padding-top: 5px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }

  .fade-enter-active,
  .fade-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
