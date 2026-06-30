import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isMcpConfigured, normalizeToolResult, queryWordPressContext } from './mcp-client.js';

const realFetch = globalThis.fetch;

function mockFetch(handler) {
  globalThis.fetch = handler;
}

function sseResponse(obj, sessionId) {
  return {
    ok: true,
    headers: new Map([
      ['content-type', 'text/event-stream'],
      ['mcp-session-id', sessionId || 'sess-1'],
    ]),
    text: async () => `event: message\ndata: ${JSON.stringify(obj)}\n\n`,
  };
}

function jsonResponse(obj, sessionId) {
  const headers = new Map([['content-type', 'application/json']]);
  if (sessionId) headers.set('mcp-session-id', sessionId);
  return {
    ok: true,
    headers,
    text: async () => JSON.stringify(obj),
  };
}

describe('normalizeToolResult', () => {
  it('reads structuredContent.results', () => {
    const out = normalizeToolResult({
      result: { structuredContent: { results: [{ url: 'https://wp.org/a', title: 'A', excerpt: 'x' }] } },
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].url, 'https://wp.org/a');
  });

  it('reads JSON embedded in a text content block', () => {
    const out = normalizeToolResult({
      result: { content: [{ type: 'text', text: JSON.stringify({ items: [{ link: 'https://make.wp.org/x', name: 'X' }] }) }] },
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].url, 'https://make.wp.org/x');
    assert.equal(out[0].title, 'X');
  });

  it('drops items without url or title and returns [] for junk', () => {
    assert.deepEqual(normalizeToolResult(null), []);
    assert.deepEqual(normalizeToolResult({ result: {} }), []);
    assert.deepEqual(
      normalizeToolResult({ result: { structuredContent: { results: [{ excerpt: 'no url' }] } } }),
      []
    );
  });
});

describe('isMcpConfigured', () => {
  afterEach(() => {
    delete process.env.MCP_CONTEXT_WPORG_URL;
    delete process.env.MCP_BEARER_TOKEN;
  });

  it('is false without both env vars', () => {
    assert.equal(isMcpConfigured(), false);
    process.env.MCP_CONTEXT_WPORG_URL = 'http://localhost:3001/mcp';
    assert.equal(isMcpConfigured(), false);
  });

  it('is true with both env vars', () => {
    process.env.MCP_CONTEXT_WPORG_URL = 'http://localhost:3001/mcp';
    process.env.MCP_BEARER_TOKEN = 'secret';
    assert.equal(isMcpConfigured(), true);
  });
});

describe('queryWordPressContext', () => {
  beforeEach(() => {
    process.env.MCP_CONTEXT_WPORG_URL = 'http://localhost:3001/mcp';
    process.env.MCP_BEARER_TOKEN = 'secret';
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.MCP_CONTEXT_WPORG_URL;
    delete process.env.MCP_BEARER_TOKEN;
  });

  it('returns [] when not configured', async () => {
    delete process.env.MCP_CONTEXT_WPORG_URL;
    const out = await queryWordPressContext('gutenberg');
    assert.deepEqual(out, []);
  });

  it('returns normalized results from a tools/call (SSE transport)', async () => {
    let call = 0;
    mockFetch(async () => {
      call += 1;
      if (call === 1) {
        return sseResponse({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18' } });
      }
      if (call === 2) {
        return sseResponse({ jsonrpc: '2.0' }); // initialized notification ack
      }
      return sseResponse({
        jsonrpc: '2.0',
        id: 3,
        result: { structuredContent: { results: [{ url: 'https://make.wordpress.org/core/x', title: 'Core note' }] } },
      });
    });

    const out = await queryWordPressContext('block bindings');
    assert.equal(out.length, 1);
    assert.equal(out[0].url, 'https://make.wordpress.org/core/x');
  });

  it('fails open to [] on fetch error', async () => {
    mockFetch(async () => {
      throw new Error('network down');
    });
    const out = await queryWordPressContext('hooks');
    assert.deepEqual(out, []);
  });

  it('fails open to [] on non-ok response', async () => {
    mockFetch(async () => ({ ok: false, headers: new Map(), text: async () => 'error' }));
    const out = await queryWordPressContext('hooks');
    assert.deepEqual(out, []);
  });

  it('accepts JSON transport too', async () => {
    let call = 0;
    mockFetch(async () => {
      call += 1;
      if (call <= 2) return jsonResponse({ jsonrpc: '2.0', result: {} }, 'sess-9');
      return jsonResponse({ result: { content: [{ type: 'text', text: JSON.stringify([{ url: 'https://core.trac.wordpress.org/t/1', title: 'Ticket' }]) }] } });
    });
    const out = await queryWordPressContext('trac');
    assert.equal(out.length, 1);
    assert.equal(out[0].title, 'Ticket');
  });
});
