import { computed, ref, watch } from 'vue';
import { translations, type Locale } from '../i18n';

const LOCALE_STORAGE_KEY = 'ykassa-configurator-locale';

export function useLocale() {
  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  const locale = ref<Locale>(storedLocale === 'en' ? 'en' : 'ru');
  const messages = computed(() => translations[locale.value]);

  watch(
    locale,
    (nextLocale) => {
      document.documentElement.lang = nextLocale;
      document.title = translations[nextLocale].documentTitle;
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    },
    { immediate: true },
  );

  function setLocale(nextLocale: Locale): void {
    locale.value = nextLocale;
  }

  return { locale, messages, setLocale };
}
