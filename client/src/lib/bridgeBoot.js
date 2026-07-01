import { saveAuthTokens, saveAuthUser } from '../../js/storage.js';

/**
 * Exchange a one-time WordPress bridge code for Plato tokens and seed them into
 * storage (so the learner is logged in as their stable, WordPress-mapped Plato
 * user). Shared by both embed entry points — the single-lesson embed
 * (`EmbedLessonChat`) and the full-app "courses home" embed (`EmbedHome`).
 *
 * Returns the exchange payload (includes `lessonId`, which is null for a home
 * embed). Throws a learner-facing message when the code is spent/expired.
 */
export async function exchangeBridgeCode(code) {
  const res = await fetch('/v1/bridge/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    throw new Error('This coaching session link has expired. Please reload the page.');
  }
  const data = await res.json();
  await saveAuthTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  if (data.user) await saveAuthUser(data.user);
  return data;
}
