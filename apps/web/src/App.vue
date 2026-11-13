<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from 'vue';
import { CLIENT_CONFIG_DEFAULTS } from '@alekstar79/ykassa-contracts/defaults';
import { ACCENT_PALETTE } from '@alekstar79/ykassa-contracts/palette';
import ApprovalCard from './components/ApprovalCard.vue';
import ClientHeader from './components/ClientHeader.vue';
import RequestForm from './components/RequestForm.vue';
import ResponseCard from './components/ResponseCard.vue';
import ToolCallList from './components/ToolCallList.vue';
import { useClientApi } from './composables/useClientApi';
import { usePublicClient } from './composables/usePublicClient';
import { translations, type Locale } from './i18n';
import type { RequestPayload } from './types';

const THEME_STORAGE_KEY = 'yookassa-theme';
const LOCALE_STORAGE_KEY = 'yookassa-locale';
type Theme = 'light' | 'dark';

const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
const theme = ref<Theme>(storedTheme === 'dark' ? 'dark' : 'light');
const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
const locale = ref<Locale>(storedLocale === 'en' ? 'en' : 'ru');
const messages = computed(() => translations[locale.value]);
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
  publicClient,
  clientError,
  isClientLoading,
} = usePublicClient(locale);
const {
  apiReply,
  apiWarning,
  toolCalls,
  errorMessage,
  pendingApproval,
  isBusy,
  sendRequest,
  resolveApproval,
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
        :brand-name="publicClient?.brand?.display_name || messages.brandFallback"
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
        <p>{{ clientError }}</p>
      </div>
      <template v-else>
        <section class="request-section" :aria-label="messages.requestSection">
          <RequestForm
            :placeholder="messages.requestPlaceholder"
            :messages="messages"
            :max-attachment-kb="
              publicClient?.limits?.max_attachment_kb ??
              CLIENT_CONFIG_DEFAULTS.limits.max_attachment_kb
            "
            :form-style="
              publicClient?.ui?.form_style ??
              CLIENT_CONFIG_DEFAULTS.ui.form_style
            "
            :error-message="errorMessage"
            :busy="isBusy"
            :approval-pending="pendingApproval !== null"
            @submit="handleSubmit"
            @clear-error="clearError"
          />
        </section>

        <Transition name="fade" mode="out-in">
          <section
            v-if="apiReply || toolCalls.length > 0 || pendingApproval"
            key="results"
            class="results-section"
            :aria-label="messages.resultsSection"
          >
            <div class="results-content" aria-live="polite">
              <ResponseCard
                v-if="apiReply"
                :reply="apiReply"
                :warning="apiWarning"
                :messages="messages"
              />
              <ToolCallList
                v-if="toolCalls.length > 0"
                :calls="toolCalls"
                :messages="messages"
              />
              <ApprovalCard
                :approval="pendingApproval"
                :busy="isBusy"
                :messages="messages"
                @resolve="resolveApproval"
              />
            </div>
          </section>
        </Transition>

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
  --accent: var(--client-accent-light, #1a365d);
  --accent-foreground: var(--client-accent-foreground-light, #fff);
  --accent-hover: var(--client-accent-hover-light, #142b4a);
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
  --accent: var(--client-accent-dark, #60a5fa);
  --accent-foreground: var(--client-accent-foreground-dark, #111827);
  --accent-hover: var(--client-accent-hover-dark, #93c5fd);
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

body {
  min-width: 320px;
  min-height: 100vh;
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
  min-height: 100vh;
  padding: 44px 24px 32px;
  font-family: var(--font-body), serif;
}

.page-shell {
  width: min(100%, 800px);
  margin-inline: auto;
}

.request-section,
.results-section {
  min-width: 0;
}

.results-section {
  margin-top: 24px;
}

.results-content {
  display: grid;
  gap: 18px;
  min-width: 0;
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
  margin: 12vh auto 0;
  justify-content: center;
}

.state-panel p {
  margin: 0;
  line-height: 1.55;
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
  margin-top: 44px;
  padding-top: 13px;
  border-top: 1px solid var(--line);
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
    padding: 32px 20px 24px;
  }

  footer {
    margin-top: 30px;
  }
}

@media (max-width: 420px) {
  .page {
    padding: 26px 16px 20px;
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
