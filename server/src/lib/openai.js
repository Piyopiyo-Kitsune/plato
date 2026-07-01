/**
 * OpenAI (and OpenAI-compatible) provider for the coach.
 *
 * Plato's client speaks the Anthropic Messages API shape, so this module
 * translates Anthropic-style requests into OpenAI Chat Completions and maps the
 * responses (and streaming text deltas) back into the shape the client expects:
 *   - invoke():       { content: [{ type:'text', text }], usage, stop_reason }
 *   - invokeStream(): yields { type:'content_block_delta', delta:{ type:'text_delta', text } }
 *
 * Configurable for any OpenAI-compatible endpoint (OpenAI, Azure OpenAI, Groq,
 * OpenRouter, local servers, …) via OPENAI_BASE_URL / OPENAI_MODEL / OPENAI_API_KEY.
 */

const FINISH_MAP = {
  stop: 'end_turn',
  length: 'max_tokens',
  content_filter: 'end_turn',
  tool_calls: 'tool_use',
};

/**
 * Translate one Anthropic message `content` (string or block array) into the
 * OpenAI Chat Completions content shape. Text-only collapses to a string;
 * messages with images use the multimodal array form.
 */
export function translateContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  const hasImage = content.some((b) => b?.type === 'image');
  if (!hasImage) {
    return content.filter((b) => b?.type === 'text').map((b) => b.text).join('\n');
  }

  return content
    .map((b) => {
      if (b?.type === 'text') return { type: 'text', text: b.text };
      if (b?.type === 'image' && b.source?.type === 'base64') {
        return {
          type: 'image_url',
          image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` },
        };
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Build an OpenAI Chat Completions request body from an Anthropic-style body.
 */
export function toOpenAIRequest(model, body) {
  const messages = [];
  if (body.system) messages.push({ role: 'system', content: body.system });
  for (const m of body.messages || []) {
    messages.push({ role: m.role, content: translateContent(m.content) });
  }
  return {
    model,
    max_tokens: body.max_tokens || 1024,
    messages,
  };
}

/**
 * Map an OpenAI Chat Completions response into the Anthropic Messages shape the
 * client's parseResponse() reads.
 */
export function toAnthropicResponse(resp) {
  const choice = (resp?.choices && resp.choices[0]) || {};
  const text = choice.message?.content || '';
  return {
    id: resp?.id || 'msg',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    stop_reason: FINISH_MAP[choice.finish_reason] || 'end_turn',
    usage: {
      input_tokens: resp?.usage?.prompt_tokens ?? 0,
      output_tokens: resp?.usage?.completion_tokens ?? 0,
    },
  };
}

/**
 * Extract the incremental text from one OpenAI streaming chunk (or '' if none).
 */
export function streamDeltaText(event) {
  return event?.choices?.[0]?.delta?.content || '';
}

/**
 * Construct an OpenAI-compatible provider. `fetchImpl` is injectable for tests.
 */
export function makeOpenAIProvider({
  apiKey = process.env.OPENAI_API_KEY,
  baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  model = process.env.OPENAI_MODEL || 'gpt-4o-mini',
  fetchImpl = fetch,
} = {}) {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const headers = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  });

  async function fail(res) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error ${res.status}`);
  }

  return {
    async invoke(_model, body) {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(toOpenAIRequest(model, body)),
      });
      if (!res.ok) return fail(res);
      return toAnthropicResponse(await res.json());
    },

    async *invokeStream(_model, body) {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ ...toOpenAIRequest(model, body), stream: true }),
      });
      if (!res.ok) return fail(res);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') return;
          let event;
          try { event = JSON.parse(data); } catch { continue; }
          const text = streamDeltaText(event);
          if (text) {
            yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } };
          }
        }
      }
    },
  };
}

export default makeOpenAIProvider();
