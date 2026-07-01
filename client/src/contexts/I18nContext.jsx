import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { getPreferences, savePreferences } from '../../js/storage.js';
import { resolveLanguageCode } from '../lib/language.js';
import { CATALOGS } from '../lib/i18n/catalogs.js';

/**
 * App-wide UI language (multilingual Phase 2).
 *
 * Holds the active language and a `t(key, vars)` translator backed by static
 * catalogs (client/src/lib/i18n/catalogs.js). Changing the language here updates
 * every consumer instantly AND persists to `preferences.language`, so the coach
 * and the AI-generated lesson overview (which read the same preference) follow on
 * their next turn/start.
 *
 * Lookup falls back to English, then to the raw key, so a missing translation
 * degrades gracefully rather than blanking the UI.
 */
const I18nContext = createContext({ lang: 'en', setLanguage: () => {}, t: (k) => k });

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState('en');

  useEffect(() => {
    (async () => setLang(resolveLanguageCode(await getPreferences())))();
  }, []);

  const setLanguage = useCallback(async (code) => {
    setLang(code);
    const prefs = (await getPreferences()) || {};
    await savePreferences({ ...prefs, language: code });
  }, []);

  const t = useCallback((key, vars) => {
    const table = CATALOGS[lang] || CATALOGS.en;
    const value = (table && table[key] != null) ? table[key] : CATALOGS.en[key];
    return interpolate(value != null ? value : key, vars);
  }, [lang]);

  const value = useMemo(() => ({ lang, setLanguage, t }), [lang, setLanguage, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Access the translator: `const t = useT();  t('courses.all')`. */
export function useT() {
  return useContext(I18nContext).t;
}

/** Access the active language + setter (for the switcher). */
export function useLanguage() {
  const { lang, setLanguage } = useContext(I18nContext);
  return { lang, setLanguage };
}
