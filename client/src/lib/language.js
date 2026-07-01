/**
 * Multilingual coaching (Phase 1).
 *
 * The coach LLM responds in whatever language we hand it via the lesson context
 * (`responseLanguage`), so "supporting" a language is just: let the learner pick
 * it, resolve a sensible default, and pass its English name to the coach. The
 * authored lesson content (objectives/exemplar) stays as written — only the
 * conversation adapts.
 *
 * Resolution priority (highest first):
 *   1. The learner's explicit choice (persisted in `preferences.language`).
 *   2. The WordPress account locale, forwarded via the SSO bridge and stored as
 *      `preferences.wpLocale` (embedded learners get their WP language by default).
 *   3. The browser's language (`navigator.languages`).
 *   4. Site default — English.
 *
 * We deliberately do NOT use geo/IP detection (a poor, privacy-unfriendly proxy
 * for language).
 */

// `code` is the short tag we persist and match against browser locales; `label`
// is what the learner sees (endonym); `coachName` is the English name handed to
// the coach LLM.
export const LANGUAGES = [
  { code: 'en', label: 'English', coachName: 'English' },
  { code: 'es', label: 'Español', coachName: 'Spanish' },
  { code: 'fr', label: 'Français', coachName: 'French' },
  { code: 'de', label: 'Deutsch', coachName: 'German' },
  { code: 'pt', label: 'Português', coachName: 'Portuguese' },
  { code: 'it', label: 'Italiano', coachName: 'Italian' },
  { code: 'nl', label: 'Nederlands', coachName: 'Dutch' },
  { code: 'ru', label: 'Русский', coachName: 'Russian' },
  { code: 'ja', label: '日本語', coachName: 'Japanese' },
  { code: 'zh', label: '中文', coachName: 'Chinese' },
  { code: 'ko', label: '한국어', coachName: 'Korean' },
  { code: 'hi', label: 'हिन्दी', coachName: 'Hindi' },
  { code: 'ar', label: 'العربية', coachName: 'Arabic' },
  { code: 'id', label: 'Bahasa Indonesia', coachName: 'Indonesian' },
  { code: 'vi', label: 'Tiếng Việt', coachName: 'Vietnamese' },
];

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));

/** Reduce a raw locale (e.g. "pt-BR", "en_US") to a supported code, or null. */
export function normalizeLanguageCode(raw) {
  if (!raw) return null;
  const base = String(raw).toLowerCase().split(/[-_]/)[0];
  return BY_CODE.has(base) ? base : null;
}

/** Resolve the learner's language: explicit → WP locale → browser → English. */
export function resolveLanguageCode(prefs) {
  const explicit = normalizeLanguageCode(prefs?.language);
  if (explicit) return explicit;
  const wp = normalizeLanguageCode(prefs?.wpLocale);
  if (wp) return wp;
  if (typeof navigator !== 'undefined') {
    const candidates = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language];
    for (const l of candidates) {
      const code = normalizeLanguageCode(l);
      if (code) return code;
    }
  }
  return 'en';
}

/** The English language name to hand the coach LLM for a given code. */
export function coachLanguageName(code) {
  return BY_CODE.get(code)?.coachName || 'English';
}
