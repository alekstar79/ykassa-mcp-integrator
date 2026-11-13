<script setup lang="ts">
import type { Locale, Messages } from '../i18n';

defineProps<{
  brandName: string;
  theme: 'light' | 'dark';
  locale: Locale;
  messages: Messages;
}>();

const emit = defineEmits<{
  toggleTheme: [];
  setLocale: [locale: Locale];
}>();
</script>

<template>
  <header class="header">
    <div class="header-copy">
      <p class="eyebrow">{{ brandName }}</p>
      <h1>{{ messages.title }}</h1>
    </div>
    <div class="header-controls">
      <div
        class="language-switch"
        role="group"
        :aria-label="messages.languageSwitcher"
      >
        <button
          type="button"
          :aria-pressed="locale === 'ru'"
          @click="emit('setLocale', 'ru')"
        >
          RU
        </button>
        <button
          type="button"
          :aria-pressed="locale === 'en'"
          @click="emit('setLocale', 'en')"
        >
          EN
        </button>
      </div>
      <button
        class="theme-toggle"
        type="button"
        :aria-label="
          theme === 'dark' ? messages.switchToLight : messages.switchToDark
        "
        :aria-pressed="theme === 'dark'"
        @click="emit('toggleTheme')"
      >
        {{ theme === 'dark' ? '🌞' : '🌙' }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 48px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--line);
}

.header-copy {
  flex: 1;
  min-width: 0;
}

.eyebrow {
  margin: 0 0 13px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  line-height: 1.4;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: var(--h1-size, clamp(1.8rem, 4vw, 2.5rem));
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.15;
}

.header-controls {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.language-switch {
  display: flex;
  height: 44px;
  border: 1px solid var(--line);
  border-radius: var(--radius, 2px);
  background: var(--surface);
}

.language-switch button,
.theme-toggle {
  display: grid;
  place-items: center;
  border-radius: var(--radius, 2px);
  color: var(--ink);
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  transition: background-color 120ms ease, box-shadow 120ms ease;
}

.language-switch button {
  min-width: 42px;
  min-height: 42px;
  padding: 0 9px;
  border: 0;
  color: var(--muted);
}

.language-switch button + button {
  border-left: 1px solid var(--line);
}

.language-switch button[aria-pressed="true"] {
  color: var(--accent);
  background: var(--surface-hover);
}

.theme-toggle {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  border: 1px solid var(--line);
  background: var(--surface);
  font-size: 19px;
  line-height: 1;
}

.language-switch button:hover,
.theme-toggle:hover {
  background: var(--surface-hover);
  box-shadow: var(--micro-shadow);
}

.language-switch button:focus-visible,
.theme-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
