import { nextTick } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import { useLocale } from '../src/composables/useLocale.js';

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = '';
  document.title = '';
});

describe('useLocale', () => {
  it('loads the stored English locale and updates document metadata', () => {
    window.localStorage.setItem('ykassa-configurator-locale', 'en');

    const { locale, messages } = useLocale();

    expect(locale.value).toBe('en');
    expect(messages.value.pageTitle).toBe('Client configurator');
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe('YooKassa · Client configurator');
  });

  it('switches to English and persists the selected locale', async () => {
    const { locale, messages, setLocale } = useLocale();

    expect(locale.value).toBe('ru');
    expect(messages.value.pageTitle).toBe('Конфигуратор клиента');
    setLocale('en');
    await nextTick();

    expect(locale.value).toBe('en');
    expect(messages.value.pageTitle).toBe('Client configurator');
    expect(document.documentElement.lang).toBe('en');
    expect(
      window.localStorage.getItem('ykassa-configurator-locale'),
    ).toBe('en');
  });
});
