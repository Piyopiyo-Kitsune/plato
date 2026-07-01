/**
 * Bridge + publish integration test against a running Plato server.
 *
 * Usage:
 *   PLATO_URL=http://localhost:3000 BRIDGE_SECRET=test-secret-123 \
 *   SITE_ID=https://learn.example.org node qa/bridge-integration.mjs
 *
 * Verifies the full WordPress-embed path Plato-side: signature rejection,
 * token -> single-use code -> token exchange, stable learner identity, and
 * publish-to-Plato landing a lesson with its course association (the link that
 * scopes cross-lesson coach memory to a course).
 */
import { createHmac } from 'node:crypto';

const BASE = process.env.PLATO_URL || 'http://localhost:3000';
const SECRET = process.env.BRIDGE_SECRET || 'test-secret-123';
const SITE = process.env.SITE_ID || 'https://learn.example.org';

const sign = (siteId, wpUserId, lessonId, ts) =>
  createHmac('sha256', SECRET).update([siteId, wpUserId, lessonId ?? '', String(ts)].join('\n')).digest('hex');
const post = async (path, body) => {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok  -', msg); };
const now = () => Math.floor(Date.now() / 1000);

let r = await post('/v1/bridge/token', { siteId: SITE, wpUserId: '7', lessonId: 'x', ts: now(), sig: 'deadbeef' });
assert(r.status === 401, `bad signature rejected (${r.status})`);

let ts = now();
r = await post('/v1/bridge/token', { siteId: SITE, wpUserId: '7', lessonId: 'wp-l-1', displayName: 'Ada', ts, sig: sign(SITE, '7', 'wp-l-1', ts) });
assert(r.status === 200 && r.json.code, 'signed token -> code');
const code = r.json.code;

r = await post('/v1/bridge/exchange', { code });
assert(r.status === 200 && r.json.accessToken, 'exchange -> tokens');
const token = r.json.accessToken;
const userId = r.json.user.userId;

r = await post('/v1/bridge/exchange', { code });
assert(r.status === 401, 'code is single-use');

ts = now();
r = await post('/v1/bridge/token', { siteId: SITE, wpUserId: '7', lessonId: 'wp-l-1', ts, sig: sign(SITE, '7', 'wp-l-1', ts) });
r = await post('/v1/bridge/exchange', { code: r.json.code });
assert(r.json.user.userId === userId, 'same WP user -> same stable Plato learner');

ts = now();
const md = '# Hooks 101\nLearn hooks.\n\n## Learning Objectives\n- Use add_action\n\n## Exemplar\nA working hook.';
r = await post('/v1/bridge/lesson', {
  siteId: SITE, wpUserId: 'publish', lessonId: 'wp-c-l-1', ts, sig: sign(SITE, 'publish', 'wp-c-l-1', ts),
  platoLessonId: 'wp-c-l-1', name: 'Hooks 101', markdown: md, status: 'public', courseId: 'wp-c-1', courseName: 'WordPress Basics',
});
assert(r.status === 200, 'publish lesson');

const lessons = await (await fetch(BASE + '/v1/lessons', { headers: { Authorization: `Bearer ${token}` } })).json();
const found = Array.isArray(lessons) && lessons.find((l) => l.lessonId === 'wp-c-l-1');
assert(found && found.course && found.course.id === 'wp-c-1', 'published lesson carries its course (cross-lesson memory link)');

console.log('\nALL BRIDGE + PUBLISH CHECKS PASSED');
