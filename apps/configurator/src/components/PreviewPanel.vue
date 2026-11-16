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
          :class="{ 'is-placeholder': !displayName.trim() }"
        >
          {{ displayName.trim() || messages.previewBrandFallback }}
        </p>
        <h1 class="preview-title">{{ messages.previewManagerTitle }}</h1>
      </div>
    </header>

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
  width: min(100%, 800px);
  min-width: 0;
  margin-inline: auto;
  color: var(--ink);
  font-family: var(--font-body), serif;
}

.preview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 48px;
  padding-bottom: 22px;
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

.request-form {
  display: grid;
  gap: 8px;
  min-width: 0;
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
  margin-top: 44px;
  padding-top: 13px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 380px) {
  .preview-footer {
    margin-top: 30px;
  }
}
</style>
