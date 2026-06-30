/**
 * MCP client for Automattic's `mcp-context-wporg` sidecar.
 *
 * Adds Make WordPress / WordPress GitHub / Trac context to lesson enrichment by
 * calling the sidecar over MCP Streamable HTTP. Strictly fail-open: any config
 * gap, network error, timeout, or unexpected shape yields `[]` so lesson start
 * and the embedded coach are never blocked.
 *
 * Configuration (env, since this plugin is intentionally settings-free):
 *   MCP_CONTEXT_WPORG_URL   HTTP endpoint of the sidecar (e.g. http://localhost:3001/mcp)
 *   MCP_BEARER_TOKEN        Bearer token the sidecar expects
 *   MCP_SEARCH_TOOL         Tool name to call (default: 'search')
 *   MCP_SEARCH_ARG          Argument name for the query text (default: 'query')
 *
 * The tool name/arg are configurable because mcp-context-wporg exposes its
 * capabilities through versioned meta-tools; confirm the exact names against the
 * running sidecar (`tools/list`) during deployment/QA.
 */

const TIMEOUT_MS = 8000;
const MAX_RESULTS = 5;

/**
 * Whether the MCP sidecar is configured.
 * @returns {boolean}
 */
export function isMcpConfigured() {
  return !!(process.env.MCP_CONTEXT_WPORG_URL && process.env.MCP_BEARER_TOKEN);
}

function endpoint() {
  return process.env.MCP_CONTEXT_WPORG_URL;
}

function authHeaders() {
  return {
    'Authorization': `Bearer ${process.env.MCP_BEARER_TOKEN}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };
}

/**
 * Parse a Streamable-HTTP response body that may be JSON or SSE.
 * @param {Response} res
 * @returns {Promise<object|null>}
 */
async function parseRpcBody(res) {
  const text = await res.text();
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream')) {
    // Last JSON `data:` line wins.
    let parsed = null;
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:')) {
        try {
          parsed = JSON.parse(trimmed.slice(5).trim());
        } catch {
          /* ignore non-JSON keep-alives */
        }
      }
    }
    return parsed;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Make a single JSON-RPC call to the MCP endpoint.
 * @param {object} options
 * @param {string} options.method JSON-RPC method.
 * @param {object} [options.params] JSON-RPC params.
 * @param {string} [options.sessionId] MCP session id from initialize.
 * @param {AbortSignal} [options.signal] Abort signal.
 * @returns {Promise<{ body: object|null, sessionId: string|null }>}
 */
async function rpc({ method, params, sessionId, signal }) {
  const headers = authHeaders();
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;

  const res = await fetch(endpoint(), {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params: params || {} }),
    signal,
  });
  return {
    body: res.ok ? await parseRpcBody(res) : null,
    sessionId: res.headers.get('mcp-session-id') || sessionId || null,
  };
}

/**
 * Normalize an MCP tools/call result into [{ url, title, excerpt }].
 * Handles the common shapes: structuredContent arrays, a `content` array of
 * text blocks containing JSON, or already-shaped item arrays.
 * @param {object|null} body JSON-RPC response body.
 * @returns {Array<{url: string, title: string, excerpt: string}>}
 */
export function normalizeToolResult(body) {
  const result = body?.result;
  if (!result) return [];

  // Prefer structured content when present.
  let items = result.structuredContent?.results
    || result.structuredContent?.items
    || (Array.isArray(result.structuredContent) ? result.structuredContent : null);

  // Fall back to text content blocks that contain JSON.
  if (!items && Array.isArray(result.content)) {
    for (const block of result.content) {
      if (block?.type === 'text' && typeof block.text === 'string') {
        try {
          const parsed = JSON.parse(block.text);
          items = parsed.results || parsed.items || (Array.isArray(parsed) ? parsed : null);
          if (items) break;
        } catch {
          /* not JSON — skip */
        }
      }
    }
  }

  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      url: item.url || item.link || item.html_url || '',
      title: (item.title || item.name || '').toString().trim(),
      excerpt: (item.excerpt || item.summary || item.description || '').toString().trim(),
    }))
    .filter((r) => r.url && r.title)
    .slice(0, MAX_RESULTS);
}

/**
 * Query the WordPress.org/Make/GitHub/Trac context sidecar for one query.
 * Fail-open: returns [] on any problem.
 * @param {string} query Search text.
 * @returns {Promise<Array<{url: string, title: string, excerpt: string}>>}
 */
export async function queryWordPressContext(query) {
  if (!isMcpConfigured() || !query) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const init = await rpc({
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'plato-wordpress-info', version: '1.0.0' },
      },
      signal: controller.signal,
    });
    const sessionId = init.sessionId;

    // Best-effort initialized notification (servers that don't need it ignore it).
    try {
      await rpc({ method: 'notifications/initialized', sessionId, signal: controller.signal });
    } catch {
      /* optional */
    }

    const toolName = process.env.MCP_SEARCH_TOOL || 'search';
    const argName = process.env.MCP_SEARCH_ARG || 'query';
    const call = await rpc({
      method: 'tools/call',
      params: { name: toolName, arguments: { [argName]: query } },
      sessionId,
      signal: controller.signal,
    });

    return normalizeToolResult(call.body);
  } catch {
    return []; // fail open
  } finally {
    clearTimeout(timer);
  }
}
