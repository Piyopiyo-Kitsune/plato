/**
 * Embed mode — the Plato client is running inside the WordPress Coach iframe,
 * where the learner is already authenticated as their WordPress user via the SSO
 * bridge. In embed mode we hide Plato's own account management (email, username,
 * password, sign-out) because the WordPress account is the identity. The learner
 * still keeps their data-rights controls ("Your data & privacy").
 *
 * See SUGGESTED-IMPROVEMENTS 7a.
 *
 * Embed mode latches for the SPA session: `?embed=1` in the URL (or an explicit
 * markEmbedded() from the embed entry point) is remembered in sessionStorage so
 * it survives client-side navigation, which drops query params. It never changes
 * mid-session, so callers can read isEmbedded() synchronously during render.
 */

const STORAGE_KEY = 'plato_embed';

let _embedded = null;

/** Latch embed mode on for the rest of this SPA session. */
export function markEmbedded() {
  try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch { /* private mode / disabled */ }
  _embedded = true;
}

/** Whether the client is running embedded in the WordPress Coach. */
export function isEmbedded() {
  if (_embedded !== null) return _embedded;
  let latched = false;
  try { latched = sessionStorage.getItem(STORAGE_KEY) === '1'; } catch { /* ignore */ }
  let fromUrl = false;
  try { fromUrl = new URLSearchParams(window.location.search).get('embed') === '1'; } catch { /* ignore */ }
  if (fromUrl) markEmbedded();
  _embedded = latched || fromUrl;
  return _embedded;
}
