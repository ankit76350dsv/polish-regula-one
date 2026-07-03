// Lightweight i18n — two dictionaries and one hook, no external library.
// Language lives in the Redux ui slice so every component re-renders on switch.
import { useSelector } from 'react-redux';
import en from './en';
import pl from './pl';

const DICTS = { en, pl };

/** Translate a key for a given language, falling back to English then the key. */
export function translate(lang, key) {
  return DICTS[lang]?.[key] ?? DICTS.en[key] ?? key;
}

/**
 * Hook used by every component:
 *   const { t, lang } = useT();
 *   t('nav.dashboard')          → dictionary lookup
 *   lang                        → 'pl' | 'en' for bilingual data labels (labelOf)
 */
export function useT() {
  const lang = useSelector((s) => s.ui.language);
  return { t: (key) => translate(lang, key), lang };
}
