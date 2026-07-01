import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  translateContent,
  toOpenAIRequest,
  toAnthropicResponse,
  streamDeltaText,
  makeOpenAIProvider,
} from '../../src/lib/openai.js';

describe('translateContent', () => {
  it('passes strings through', () => {
    assert.equal(translateContent('hello'), 'hello');
  });
  it('joins text-only block arrays into a string', () => {
    assert.equal(translateContent([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }]), 'a\nb');
  });
  it('builds a multimodal array when an image block is present', () => {
    const out = translateContent([
      { type: 'text', text: 'look' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
    ]);
    assert.deepEqual(out, [
      { type: 'text', text: 'look' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
    ]);
  });
});

describe('toOpenAIRequest', () => {
  it('prepends system and maps messages + max_tokens', () => {
    const req = toOpenAIRequest('gpt-4o-mini', {
      system: 'You are a coach.',
      max_tokens: 256,
      messages: [{ role: 'user', content: 'hi' }],
    });
    assert.equal(req.model, 'gpt-4o-mini');
    assert.equal(req.max_tokens, 256);
    assert.deepEqual(req.messages, [
      { role: 'system', content: 'You are a coach.' },
      { role: 'user', content: 'hi' },
    ]);
  });
  it('defaults max_tokens when absent', () => {
    assert.equal(toOpenAIRequest('m', { messages: [] }).max_tokens, 1024);
  });
});

describe('toAnthropicResponse', () => {
  it('maps content, usage, and stop_reason', () => {
    const out = toAnthropicResponse({
      id: 'abc',
      choices: [{ message: { content: 'Hello there' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 7, completion_tokens: 3 },
    });
    assert.equal(out.content[0].text, 'Hello there');
    assert.equal(out.stop_reason, 'end_turn');
    assert.equal(out.usage.input_tokens, 7);
    assert.equal(out.usage.output_tokens, 3);
  });
  it('maps length finish_reason to max_tokens', () => {
    assert.equal(toAnthropicResponse({ choices: [{ message: { content: '' }, finish_reason: 'length' }] }).stop_reason, 'max_tokens');
  });
});

describe('streamDeltaText', () => {
  it('extracts delta content', () => {
    assert.equal(streamDeltaText({ choices: [{ delta: { content: 'hi' } }] }), 'hi');
  });
  it('returns empty for role-only deltas', () => {
    assert.equal(streamDeltaText({ choices: [{ delta: { role: 'assistant' } }] }), '');
  });
});

function readerFrom(chunks) {
  let i = 0;
  const enc = new TextEncoder();
  return {
    getReader() {
      return {
        read: async () => (i < chunks.length ? { done: false, value: enc.encode(chunks[i++]) } : { done: true, value: undefined }),
      };
    },
  };
}

describe('makeOpenAIProvider.invoke', () => {
  it('sends a translated request and returns the Anthropic shape', async () => {
    let sent;
    const fetchImpl = async (url, opts) => {
      sent = { url, body: JSON.parse(opts.body), auth: opts.headers.Authorization };
      return { ok: true, json: async () => ({ id: 'x', choices: [{ message: { content: 'Hi!' }, finish_reason: 'stop' }], usage: { prompt_tokens: 4, completion_tokens: 1 } }) };
    };
    const ai = makeOpenAIProvider({ apiKey: 'sk-test', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', fetchImpl });
    const out = await ai.invoke('claude-haiku-4-5', { system: 'sys', max_tokens: 100, messages: [{ role: 'user', content: 'hi' }] });

    assert.match(sent.url, /\/chat\/completions$/);
    assert.equal(sent.auth, 'Bearer sk-test');
    assert.equal(sent.body.model, 'gpt-4o-mini'); // configured model, not the Claude id
    assert.equal(sent.body.messages[0].role, 'system');
    assert.equal(out.content[0].text, 'Hi!');
    assert.equal(out.usage.input_tokens, 4);
  });

  it('throws a useful error on a non-ok response', async () => {
    const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'bad key' } }) });
    const ai = makeOpenAIProvider({ apiKey: 'x', fetchImpl });
    await assert.rejects(() => ai.invoke('m', { messages: [{ role: 'user', content: 'hi' }] }), /bad key/);
  });
});

describe('makeOpenAIProvider.invokeStream', () => {
  it('yields Anthropic text_delta events from OpenAI SSE chunks', async () => {
    const sse =
      'data: {"choices":[{"delta":{"role":"assistant"}}]}\n' +
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n' +
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n' +
      'data: [DONE]\n';
    const fetchImpl = async () => ({ ok: true, body: readerFrom([sse]) });
    const ai = makeOpenAIProvider({ apiKey: 'x', fetchImpl });

    const texts = [];
    for await (const ev of ai.invokeStream('m', { messages: [{ role: 'user', content: 'hi' }] })) {
      assert.equal(ev.type, 'content_block_delta');
      assert.equal(ev.delta.type, 'text_delta');
      texts.push(ev.delta.text);
    }
    assert.deepEqual(texts, ['Hel', 'lo']);
  });
});
