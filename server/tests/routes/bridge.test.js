import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';

// Configure the bridge BEFORE importing the route/middleware, so config.js
// snapshots a non-empty shared secret (each test file runs in its own process).
process.env.BRIDGE_SHARED_SECRET = 'test-bridge-secret';
process.env.BRIDGE_ALLOWED_SITES = '';
process.env.BRIDGE_CLOCK_SKEW_SECONDS = '300';
process.env.BRIDGE_CODE_TTL_SECONDS = '90';

const { default: bridge, deriveBridgeIdentity } = await import('../../src/routes/bridge.js');
const { signBridgeRequest } = await import('../../src/middleware/bridgeAuth.js');
const { default: db } = await import('../../src/lib/db.js');

const SECRET = 'test-bridge-secret';

function req(app, method, path, body) {
  return app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function signedTokenBody(overrides = {}) {
  const fields = {
    siteId: 'https://learn.example.org',
    wpUserId: '42',
    lessonId: 'lesson-abc',
    ts: Math.floor(Date.now() / 1000),
    ...overrides,
  };
  return { ...fields, email: null, displayName: 'Ada', sig: signBridgeRequest(SECRET, fields) };
}

describe('deriveBridgeIdentity', () => {
  it('is deterministic and namespaced per site', () => {
    const a = deriveBridgeIdentity('siteA', '1');
    const b = deriveBridgeIdentity('siteA', '1');
    const c = deriveBridgeIdentity('siteB', '1');
    assert.equal(a.email, b.email);
    assert.notEqual(a.email, c.email);
    assert.match(a.email, /@wp-bridge\.invalid$/);
    assert.match(a.username, /^wp-[0-9a-f]{16}$/);
  });
});

describe('POST /v1/bridge/token', () => {
  let created;
  let storedCode;
  beforeEach(() => {
    created = null;
    storedCode = null;
    db.getUserByEmail = async () => null;
    db.createUser = async (u) => { created = u; };
    db.putSyncData = async (uid, key, data) => { storedCode = { key, data }; };
  });

  it('provisions a learner and returns a single-use code for a valid signature', async () => {
    const app = new Hono();
    app.route('/', bridge);
    const res = await req(app, 'POST', '/v1/bridge/token', signedTokenBody());
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.code.startsWith('brc_'));
    assert.equal(data.lessonId, 'lesson-abc');
    assert.ok(created, 'createUser called');
    assert.match(created.email, /@wp-bridge\.invalid$/);
    assert.equal(created.role, 'user');
    assert.equal(storedCode.key, `bridge-code:${data.code}`);
    assert.equal(storedCode.data.userId, created.userId);
  });

  it('reuses an existing learner without re-creating', async () => {
    db.getUserByEmail = async () => ({ userId: 'usr_existing', role: 'user' });
    db.createUser = async () => { throw new Error('should not create'); };
    const app = new Hono();
    app.route('/', bridge);
    const res = await req(app, 'POST', '/v1/bridge/token', signedTokenBody());
    assert.equal(res.status, 200);
    assert.equal(storedCode.data.userId, 'usr_existing');
  });

  it('rejects a missing signature', async () => {
    const app = new Hono();
    app.route('/', bridge);
    const body = signedTokenBody();
    delete body.sig;
    const res = await req(app, 'POST', '/v1/bridge/token', body);
    assert.equal(res.status, 400);
  });

  it('rejects a bad signature', async () => {
    const app = new Hono();
    app.route('/', bridge);
    const body = signedTokenBody();
    body.sig = 'deadbeef';
    const res = await req(app, 'POST', '/v1/bridge/token', body);
    assert.equal(res.status, 401);
  });

  it('rejects an expired timestamp', async () => {
    const app = new Hono();
    app.route('/', bridge);
    const res = await req(app, 'POST', '/v1/bridge/token', signedTokenBody({ ts: Math.floor(Date.now() / 1000) - 10000 }));
    assert.equal(res.status, 401);
  });
});

describe('POST /v1/bridge/exchange', () => {
  it('trades a valid code for tokens and consumes it', async () => {
    let deleted = null;
    db.getSyncData = async () => ({ data: { userId: 'usr_1', lessonId: 'lesson-abc', expiresAt: Math.floor(Date.now() / 1000) + 60 } });
    db.deleteSyncData = async (uid, key) => { deleted = key; };
    db.getUserById = async () => ({ userId: 'usr_1', username: 'wp-x', name: 'Ada', role: 'user' });
    db.storeRefreshToken = async () => {};
    const app = new Hono();
    app.route('/', bridge);
    const res = await req(app, 'POST', '/v1/bridge/exchange', { code: 'brc_abc' });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.accessToken);
    assert.ok(data.refreshToken);
    assert.equal(data.lessonId, 'lesson-abc');
    assert.equal(data.user.userId, 'usr_1');
    assert.equal(deleted, 'bridge-code:brc_abc');
  });

  it('rejects a missing code', async () => {
    const app = new Hono();
    app.route('/', bridge);
    const res = await req(app, 'POST', '/v1/bridge/exchange', {});
    assert.equal(res.status, 400);
  });

  it('rejects an unknown code', async () => {
    db.getSyncData = async () => null;
    const app = new Hono();
    app.route('/', bridge);
    const res = await req(app, 'POST', '/v1/bridge/exchange', { code: 'brc_nope' });
    assert.equal(res.status, 401);
  });

  it('rejects (and consumes) an expired code', async () => {
    let deleted = false;
    db.getSyncData = async () => ({ data: { userId: 'usr_1', expiresAt: Math.floor(Date.now() / 1000) - 5 } });
    db.deleteSyncData = async () => { deleted = true; };
    const app = new Hono();
    app.route('/', bridge);
    const res = await req(app, 'POST', '/v1/bridge/exchange', { code: 'brc_old' });
    assert.equal(res.status, 401);
    assert.ok(deleted, 'expired code is still deleted');
  });
});
