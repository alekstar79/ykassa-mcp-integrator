<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';
import type { ClientUiConfig } from '@alekstar79/ykassa-contracts';
import { ACCENT_PALETTE } from '@alekstar79/ykassa-contracts/palette';
import { translations, type Locale } from '../i18n';

type Theme = 'light' | 'dark';

interface Props {
  displayName?: string;
  maxAttachmentKb: number;
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
const attachmentHint = computed(() =>
  messages.value.attachmentHint.replace(
    '{limit}',
    String(props.maxAttachmentKb),
  ),
);

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

    <div
      class="request-form"
      :class="{ 'form--card': ui.form_style === 'card' }"
    >
      <label class="field-label" for="preview-request">
        {{ messages.requestLabel }}
      </label>
      <textarea
        id="preview-request"
        class="preview-request"
        rows="4"
        :placeholder="messages.requestPlaceholder"
        readonly
        tabindex="-1"
      />

      <div class="file-drop-zone">
        <svg
          class="file-icon"
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="m8.5 12.5 6.8-6.8a3.1 3.1 0 0 1 4.4 4.4l-9.2 9.2a5 5 0 0 1-7.1-7.1l9.2-9.2"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.6"
          />
        </svg>
        <span class="file-copy">
          <strong>{{ messages.attachmentLabel }}</strong>
          <small>{{ attachmentHint }}</small>
        </span>
        <span class="file-action">{{ messages.chooseFile }}</span>
      </div>

      <button class="primary-button" type="button" disabled>
        {{ messages.send }}
      </button>
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
  gap: 13px;
  min-width: 0;
}

.request-form.form--card {
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: var(--radius, 2px);
  background: var(--surface);
  box-shadow: var(--micro-shadow);
}

.field-label {
  margin-top: 1px;
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
}

.preview-request {
  width: 100%;
  min-height: 154px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius, 2px);
  color: var(--ink);
  background: var(--surface);
  font: inherit;
  line-height: 1.6;
  resize: vertical;
}

.preview-request::placeholder {
  color: var(--muted);
  opacity: 0.8;
}

.file-drop-zone {
  display: flex;
  min-height: 82px;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px dashed var(--line);
  border-radius: var(--radius, 2px);
  background: transparent;
}

.file-icon {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  color: var(--accent);
}

.file-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.file-copy strong {
  overflow-wrap: anywhere;
  font-size: 14px;
  font-weight: 600;
}

.file-copy small {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}

.file-action {
  margin-left: auto;
  padding: 8px 0 8px 8px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.primary-button {
  width: 100%;
  min-height: 48px;
  margin-top: 6px;
  padding: 0 20px;
  border: 0;
  border-radius: var(--radius, 2px);
  color: var(--accent-foreground);
  background: var(--accent);
  font: inherit;
  font-weight: 600;
  opacity: 1;
  cursor: default;
}

.primary-button:disabled {
  opacity: 1;
  cursor: default;
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
  .file-drop-zone {
    gap: 8px;
    padding: 12px 9px;
  }

  .file-action {
    padding-left: 2px;
  }

  .preview-footer {
    margin-top: 30px;
  }
}
</style>
