<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';
import type { ClientUiConfig } from '@alekstar79/ykassa-contracts';
import { ACCENT_PALETTE } from '@alekstar79/ykassa-contracts/palette';
import { translations, type Locale } from '../i18n';

type Theme = 'light' | 'dark';

interface Props {
  displayName?: string;
  ui: ClientUiConfig;
  locale: Locale;
  theme: Theme;
}

type PreviewStyle = CSSProperties & {
  '--accent': string;
  '--accent-foreground': string;
  '--accent-hover': string;
  '--font-body': string;
  '--h1-size': string;
  '--micro-shadow': string;
  '--radius': string;
};

const props = withDefaults(defineProps<Props>(), {
  displayName: '',
});
const messages = computed(() => translations[props.locale]);
const resolvedDisplayName = computed(() => props.displayName?.trim() ?? '');
const activeTurnIndex = 1;

const previewStyle = computed<PreviewStyle>(() => {
  const accent = ACCENT_PALETTE[props.ui.accent][props.theme];
  const h1Sizes = {
    s: 'clamp(1.5rem, 3.2vw, 2rem)',
    m: 'clamp(1.8rem, 4vw, 2.5rem)',
    l: 'clamp(2.2rem, 5vw, 3rem)',
  };
  const microShadow =
    props.ui.shadow === 'none'
      ? 'none'
      : props.ui.shadow === 'medium'
        ? props.theme === 'dark'
          ? '0 3px 10px rgb(0 0 0 / 32%)'
          : '0 3px 10px rgb(17 24 39 / 12%)'
        : props.theme === 'dark'
          ? '0 1px 3px rgb(0 0 0 / 24%)'
          : '0 1px 3px rgb(17 24 39 / 7%)';

  return {
    '--accent': accent.bg,
    '--accent-foreground': accent.fg,
    '--accent-hover': accent.hover,
    '--font-body':
      props.ui.font_pair === 'inter+jetbrains'
        ? '"Inter", sans-serif'
        : '"Manrope", sans-serif',
    '--h1-size': h1Sizes[props.ui.h1_size],
    '--micro-shadow': microShadow,
    '--radius': `${props.ui.radius}px`,
  };
});
</script>

<template>
  <article
    class="preview-shell"
    :style="previewStyle"
    :aria-label="messages.previewTitle"
  >
    <header class="preview-header">
      <div class="preview-header-copy">
        <p
          class="preview-eyebrow"
          :class="{ 'is-placeholder': !resolvedDisplayName }"
        >
          {{ resolvedDisplayName || messages.previewBrandFallback }}
        </p>
        <h1 class="preview-title">{{ messages.previewManagerTitle }}</h1>
      </div>
      <div class="preview-header-controls" aria-hidden="true">
        <div class="preview-language-switch">
          <span :class="{ 'is-selected': locale === 'ru' }">RU</span>
          <span :class="{ 'is-selected': locale === 'en' }">EN</span>
        </div>
        <span class="preview-theme-toggle">
          {{ theme === 'dark' ? '🌞' : '🌙' }}
        </span>
      </div>
    </header>

    <section
      class="preview-history"
      :aria-label="messages.previewHistoryLabel"
    >
      <div class="preview-history-scroll">
        <div class="preview-turns">
          <article
            v-for="turn in messages.previewTurns"
            :key="turn.request"
            class="preview-turn"
          >
            <div class="preview-user-message">
              <p class="preview-message-role">
                {{ messages.previewUserLabel }}
              </p>
              <p class="preview-message-copy">{{ turn.request }}</p>
            </div>

            <div class="preview-assistant-message">
              <p class="preview-message-role">
                {{ messages.previewAssistantLabel }}
              </p>
              <p class="preview-message-copy">{{ turn.response }}</p>
              <span
                class="preview-detail"
                :class="`preview-detail--${turn.detailType}`"
              >
                {{ turn.detail }}
              </span>
            </div>
          </article>
        </div>
      </div>

      <nav
        class="preview-history-nav"
        :aria-label="messages.previewNavigationLabel"
        aria-hidden="true"
      >
        <ol class="preview-history-dots">
          <li
            v-for="(_, index) in messages.previewTurns"
            :key="index"
            :class="{ 'is-active': index === activeTurnIndex }"
          >
            <span />
          </li>
        </ol>
        <div class="preview-history-popover">
          <ol>
            <li
              v-for="(turn, index) in messages.previewTurns"
              :key="turn.request"
              :class="{ 'is-current': index === activeTurnIndex }"
            >
              {{ turn.request }}
            </li>
          </ol>
        </div>
      </nav>
    </section>

    <div class="request-form">
      <div
        class="chat-input-container"
        :class="{
          'chat-input-container--flat': ui.form_style === 'flat',
          'chat-input-container--card': ui.form_style === 'card',
        }"
      >
        <textarea
          id="preview-request"
          class="chat-textarea"
          rows="1"
          :aria-label="messages.requestLabel"
          :placeholder="messages.requestPlaceholder"
          readonly
          tabindex="-1"
        />

        <div class="chat-actions">
          <span class="add-menu-button" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-width="2"
              />
            </svg>
          </span>
          <span class="chat-send-button" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M12 19V5m0 0L6 11m6-6 6 6"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              />
            </svg>
          </span>
        </div>
      </div>
    </div>

    <footer class="preview-footer">
      {{ messages.footer }}
    </footer>
  </article>
</template>

<style scoped>
.preview-shell {
  display: flex;
  --h1-size: clamp(1.8rem, 4vw, 2.5rem);
  width: min(100%, 768px);
  height: clamp(360px, 68vh, 620px);
  min-width: 0;
  min-height: 360px;
  flex-direction: column;
  margin-inline: auto;
  color: var(--ink);
  background: var(--paper);
  font-family: var(--font-body), serif;
}

.preview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex: 0 0 auto;
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}

.preview-header-copy {
  flex: 1;
  min-width: 0;
}

.preview-eyebrow {
  margin: 0 0 13px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  line-height: 1.4;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}

.preview-eyebrow.is-placeholder {
  opacity: 0.55;
}

.preview-title {
  margin: 0;
  font-size: var(--h1-size, clamp(1.8rem, 4vw, 2.5rem));
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.preview-header-controls {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.preview-language-switch {
  display: flex;
  height: 36px;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: var(--radius, 2px);
  background: var(--surface);
}

.preview-language-switch span {
  display: grid;
  min-width: 36px;
  height: 34px;
  place-items: center;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
}

.preview-language-switch span.is-selected {
  color: var(--accent);
  background: var(--surface-hover);
}

.preview-theme-toggle {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: var(--radius, 2px);
  background: var(--surface);
  font-size: 16px;
}

.preview-history {
  position: relative;
  min-height: 0;
  flex: 1 1 auto;
  overflow: visible;
}

.preview-history-scroll {
  height: 100%;
  overflow-y: auto;
  padding: 2px 0 12px;
  scrollbar-width: none;
}

.preview-history-scroll::-webkit-scrollbar {
  display: none;
}

.preview-turns {
  display: grid;
  width: min(100%, 768px);
  gap: 18px;
  margin-inline: auto;
}

.preview-turn {
  display: grid;
  min-width: 0;
  gap: 10px;
}

.preview-user-message {
  width: fit-content;
  max-width: min(86%, 680px);
  justify-self: end;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius, 2px);
  background: var(--surface-hover);
  overflow-wrap: anywhere;
}

@media (max-width: 600px) {
  .preview-user-message {
    width: 100%;
    max-width: 100%;
    justify-self: stretch;
  }
}

.preview-assistant-message {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.preview-message-role {
  margin: 0;
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.preview-message-copy {
  margin: 0;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.preview-detail {
  width: fit-content;
  max-width: 100%;
  color: var(--muted);
  font-size: 12px;
}

.preview-detail--link {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.preview-detail--status {
  font-family: var(--font-mono), monospace;
}

.preview-detail--approval {
  color: var(--accent);
  font-weight: 600;
}

.preview-history-nav {
  position: absolute;
  z-index: 3;
  top: 50%;
  right: -48px;
  display: flex;
  align-items: center;
  transform: translateY(-50%);
}

.preview-history-dots {
  display: grid;
  width: 42px;
  gap: 4px;
  margin: 0;
  padding: 8px 0;
  list-style: none;
}

.preview-history-dots li {
  display: grid;
  height: 24px;
  place-items: center;
}

.preview-history-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--muted);
}

.preview-history-dots li.is-active span {
  background: var(--accent);
  transform: scale(1.4);
}

.preview-history-popover {
  position: absolute;
  top: 50%;
  right: calc(100% - 10px);
  width: min(230px, calc(100vw - 112px));
  padding: 5px;
  border: 1px solid var(--line);
  border-radius: var(--radius, 2px);
  background: var(--surface);
  box-shadow: var(--micro-shadow);
  transform: translateY(-50%);
}

.preview-history-popover ol {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.preview-history-popover li {
  min-width: 0;
  overflow: hidden;
  padding: 8px 9px;
  border-radius: var(--radius, 2px);
  color: var(--ink);
  font-size: 11px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-history-popover li.is-current {
  color: var(--accent);
  background: var(--surface-hover);
}

.request-form {
  display: grid;
  gap: 8px;
  flex: 0 0 auto;
  min-width: 0;
  margin-top: 12px;
}

.chat-input-container {
  display: grid;
  gap: 0;
  min-width: 0;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius, 2px);
  background: var(--surface);
}

.chat-input-container--flat {
  box-shadow: none;
}

.chat-input-container--card {
  box-shadow: var(--micro-shadow);
}

.chat-textarea {
  width: 100%;
  min-height: 26px;
  max-height: 160px;
  padding: 14px 20px 8px;
  border: 0;
  border-radius: 0;
  color: var(--ink);
  background: transparent;
  font: inherit;
  line-height: 1.5;
  resize: none;
  overflow-y: hidden;
}

.chat-textarea::placeholder {
  color: var(--muted);
  opacity: 0.85;
}

.chat-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px 12px;
}

.add-menu-button,
.chat-send-button {
  display: grid;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
}

.add-menu-button {
  color: var(--ink);
  background: var(--surface-hover);
}

.chat-send-button {
  color: var(--accent-foreground);
  background: var(--accent);
  opacity: 0.42;
}

.add-menu-button svg,
.chat-send-button svg {
  width: 21px;
  height: 21px;
}

.preview-footer {
  flex: 0 0 auto;
  margin-top: 8px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 600px) {
  .preview-history-nav {
    display: none;
  }
}

@media (max-width: 600px) {
  .preview-shell {
    height: clamp(360px, 70vh, 620px);
  }

  .preview-header {
    flex-wrap: wrap;
    gap: 10px;
  }

  .preview-header-controls {
    margin-left: auto;
  }

  .preview-history-popover {
    width: min(210px, calc(100vw - 104px));
  }
}
</style>
