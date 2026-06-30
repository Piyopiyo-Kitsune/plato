import { Hono } from 'hono';
import { createHash, randomBytes } from 'node:crypto';
import db from '../lib/db.js';
import { generateUserId, generateRefreshToken, hashToken } from '../lib/crypto.js';
import { hashPassword } from '../lib/password.js';
import { signAccessToken } from '../lib/jwt.js';
import { emit as emitHook } from '../lib/plugins/hooks.js';
import { BRIDGE_CODE_TTL_SECONDS } from '../config.js';
import { bridgeAuth } from '../middleware/bridgeAuth.js';

/**
 * WordPress companion-plugin bridge.
 *
 * Lets the WordPress "Agentic Coach" plugin embed Plato's lesson chat for a
 * WordPress-authenticated learner without that learner needing a Plato password.
 *
 * Flow:
 *   1. WordPress (server-side) signs an HMAC request and POSTs /v1/bridge/token.
 *      We provision-or-look-up a passwordless Plato user that is **stable** for
 *      that WordPress user, and return a single-use, short-lived embed code.
 *   2. The browser iframe loads Plato's embed view, which POSTs the code to
 *      /v1/bridge/exchange and receives normal Plato access/refresh tokens.
 *
 * Because the Plato user is stable per WordPress user, lesson chat history and
 * per-course progress memory persist across visits automatically.
 *
 * Token minting for arbitrary provisioned users is privileged, so this lives in
 * core (not a plugin — plugins may only mount under /v1/plugins/<id>/ and can't
 * issue auth tokens).
 */

const bridge = new Hono();

const CODE_PREFIX = 'brc_';
const SYNTHETIC_EMAIL_DOMAIN = 'wp-bridge.invalid'; // RFC 2606 reserved TLD — never a real address.

/**
 * Derive the stable, deterministic Plato identity for a WordPress user.
 * Keyed by `wp:<siteId>:<wpUserId>` so the same learner always maps to the same
 * Plato account, and different WordPress sites never collide.
 */
export function deriveBridgeIdentity(siteId, wpUserId) {
  const externalId = `wp:${siteId}:${wpUserId}`;
  const hash16 = createHash('sha256').update(externalId).digest('hex').slice(0, 16);
  return {
    externalId,
    email: `wp-${hash16}@${SYNTHETIC_EMAIL_DOMAIN}`,
    username: `wp-${hash16}`,
  };
}

/**
 * Provision-or-look-up the Plato user for a bridge identity. The returned user
 * is passwordless (an unguessable bcrypt hash blocks password login); it is only
 * reachable through a signed bridge request.
 */
async function ensureBridgeUser({ siteId, wpUserId, displayName }) {
  const { email, username, externalId } = deriveBridgeIdentity(siteId, wpUserId);
  const existing = await db.getUserByEmail(email);
  if (existing) return existing;

  const userId = generateUserId();
  const passwordHash = await hashPassword(randomBytes(24).toString('base64url'));
  await db.createUser({
    userId,
    email,
    username,
    passwordHash,
    name: displayName || 'WordPress Learner',
    role: 'user',
  });
  await emitHook('userCreated', { userId, email, role: 'user', source: 'wp-bridge', externalId });
  return { userId, email, username, name: displayName || 'WordPress Learner', role: 'user' };
}

// POST /v1/bridge/token — signed, server-to-server (WordPress → Plato).
// Provisions the learner and returns a single-use embed code.
bridge.post('/v1/bridge/token', bridgeAuth, async (c) => {
  const { siteId, wpUserId, displayName, lessonId } = c.get('bridge');

  let user;
  try {
    user = await ensureBridgeUser({ siteId, wpUserId, displayName });
  } catch (err) {
    return c.json({ error: 'Failed to provision learner', detail: err.message }, 500);
  }

  const code = CODE_PREFIX + randomBytes(32).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + BRIDGE_CODE_TTL_SECONDS;
  await db.putSyncData('_system', `bridge-code:${code}`, {
    userId: user.userId,
    lessonId: lessonId || null,
    siteId,
    expiresAt,
  });

  return c.json({ code, lessonId: lessonId || null, ttl: BRIDGE_CODE_TTL_SECONDS });
});

// POST /v1/bridge/exchange — called by the embedded iframe (browser).
// Trades a single-use code for normal Plato access/refresh tokens.
bridge.post('/v1/bridge/exchange', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  const code = body?.code;
  if (!code || typeof code !== 'string') {
    return c.json({ error: 'code is required' }, 400);
  }

  const key = `bridge-code:${code}`;
  const rec = await db.getSyncData('_system', key);
  if (!rec?.data) {
    return c.json({ error: 'Invalid or expired code' }, 401);
  }

  // Single-use: delete before issuing tokens so a replay can't reuse it.
  await db.deleteSyncData('_system', key);

  if (rec.data.expiresAt && rec.data.expiresAt < Math.floor(Date.now() / 1000)) {
    return c.json({ error: 'Invalid or expired code' }, 401);
  }

  const user = await db.getUserById(rec.data.userId);
  if (!user) {
    return c.json({ error: 'Learner not found' }, 401);
  }

  const accessToken = await signAccessToken(user.userId, user.role);
  const refreshToken = generateRefreshToken();
  await db.storeRefreshToken(hashToken(refreshToken), user.userId);

  return c.json({
    accessToken,
    refreshToken,
    lessonId: rec.data.lessonId || null,
    user: { userId: user.userId, username: user.username, name: user.name, role: user.role },
  });
});

// POST /v1/bridge/forget — signed, server-to-server. GDPR erasure: deletes the
// mapped Plato learner and all of their sync data (chat, progress, profile).
bridge.post('/v1/bridge/forget', bridgeAuth, async (c) => {
  const { siteId, wpUserId } = c.get('bridge');
  const { email } = deriveBridgeIdentity(siteId, wpUserId);
  const user = await db.getUserByEmail(email);
  if (!user) {
    return c.json({ ok: true, deleted: false });
  }

  const items = await db.getAllSyncData(user.userId);
  for (const item of items) {
    await db.deleteSyncData(user.userId, item.dataKey);
  }
  await db.deleteUser(user.userId);

  return c.json({ ok: true, deleted: true });
});

export default bridge;
