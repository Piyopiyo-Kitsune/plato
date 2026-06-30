import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BRIDGE_SHARED_SECRET,
  BRIDGE_ALLOWED_SITES,
  BRIDGE_CLOCK_SKEW_SECONDS,
} from '../config.js';

/**
 * Canonical string that the WordPress plugin signs (and we re-sign to verify).
 * Only the security-critical identity fields are signed; advisory fields like
 * `email`/`displayName` are intentionally excluded so they can be omitted for
 * GDPR data minimization without breaking the signature.
 */
export function bridgeSigningString({ siteId, wpUserId, lessonId, ts }) {
  return [siteId, wpUserId, lessonId ?? '', ts].join('\n');
}

export function signBridgeRequest(secret, fields) {
  return createHmac('sha256', secret).update(bridgeSigningString(fields)).digest('hex');
}

function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

function allowedSites() {
  return BRIDGE_ALLOWED_SITES.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Authenticate a WordPress → Plato bridge request.
 *
 * Verifies an HMAC-SHA256 signature over the identity fields using the shared
 * secret, enforces a replay/clock-skew window, and (optionally) an allowlist of
 * WordPress siteIds. Fails closed when no shared secret is configured.
 *
 * On success, sets `c.var.bridge` to `{ siteId, wpUserId, email, displayName,
 * lessonId, ts }` for the route handler.
 */
export async function bridgeAuth(c, next) {
  if (!BRIDGE_SHARED_SECRET) {
    return c.json({ error: 'WordPress bridge is not configured' }, 503);
  }

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { siteId, wpUserId, email, displayName, lessonId, ts, sig } = body || {};
  if (!siteId || !wpUserId || !ts || !sig) {
    return c.json({ error: 'siteId, wpUserId, ts, and sig are required' }, 400);
  }

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) {
    return c.json({ error: 'Invalid ts' }, 400);
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > BRIDGE_CLOCK_SKEW_SECONDS) {
    return c.json({ error: 'Request expired' }, 401);
  }

  const sites = allowedSites();
  if (sites.length > 0 && !sites.includes(String(siteId))) {
    return c.json({ error: 'Site not allowed' }, 403);
  }

  const expected = signBridgeRequest(BRIDGE_SHARED_SECRET, { siteId, wpUserId, lessonId, ts });
  if (!safeEqualHex(expected, String(sig))) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  c.set('bridge', {
    siteId: String(siteId),
    wpUserId: String(wpUserId),
    email: email ? String(email) : null,
    displayName: displayName ? String(displayName) : null,
    lessonId: lessonId ? String(lessonId) : null,
    ts: tsNum,
  });
  await next();
}
