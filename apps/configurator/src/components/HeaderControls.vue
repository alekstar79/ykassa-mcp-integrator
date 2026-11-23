<script setup lang="ts">
import type { Locale, Messages } from '../i18n';
import type { ClientMode, Theme, ViewMode } from '../types';

defineProps<{
  locale: Locale;
  theme: Theme;
  viewMode: ViewMode;
  clientMode: ClientMode;
  messages: Messages;
}>();

const emit = defineEmits<{
  'set-locale': [locale: Locale];
  'toggle-theme': [];
  'toggle-view-mode': [];
}>();
</script>

<template>
  <div class="header-controls">
    <div class="language-switch" role="group" :aria-label="messages.languageLabel">
      <button
        v-for="option in (['ru', 'en'] as const)"
        :key="option"
        type="button"
        :aria-pressed="locale === option"
        @click="emit('set-locale', option)"
      >
        {{ option.toUpperCase() }}
      </button>
    </div>
    <button
      class="theme-toggle"
      type="button"
      :aria-label="messages.themeLabel"
      @click="emit('toggle-theme')"
    >
      {{ theme === 'dark' ? messages.switchToLight : messages.switchToDark }}
    </button>
    <button
      class="view-toggle"
      type="button"
      :aria-label="
        viewMode === 'settings'
          ? messages.previewViewLabel
          : messages.settingsViewLabel
      "
      :title="
        clientMode !== 'reference-ui' ? messages.previewUnavailable : undefined
      "
      :disabled="clientMode !== 'reference-ui'"
      @click="emit('toggle-view-mode')"
    >
      <svg
        v-if="viewMode === 'settings'"
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z"
        />
        <circle cx="12" cy="12" r="2.8" />
      </svg>
      <svg
        v-else
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="m10.4 2.8-.4 2a7.3 7.3 0 0 0-1.6.9L6.5 5l-2 3.4L6 9.9a7.6 7.6 0 0 0 0 2.2l-1.5 1.5 2 3.4 1.9-.7a7.3 7.3 0 0 0 1.6.9l.4 2h3.2l.4-2a7.3 7.3 0 0 0 1.6-.9l1.9.7 2-3.4-1.5-1.5a7.6 7.6 0 0 0 0-2.2l1.5-1.5-2-3.4-1.9.7a7.3 7.3 0 0 0-1.6-.9l-.4-2z"
        />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  </div>
</template>
