# mcp-context-wporg sidecar

[Automattic/mcp-context-wporg](https://github.com/Automattic/mcp-context-wporg)
is an MCP server that exposes Make WordPress blogs, the WordPress / wp-cli GitHub
repos, and WordPress/bbPress/BuddyPress Trac as MCP tools and resources.

Plato's `plugins/wordpress-info` plugin calls this sidecar over MCP **Streamable
HTTP** to enrich WordPress-related lessons with current community context. The
integration is **fail-open**: if the sidecar is unreachable or misconfigured,
lesson enrichment silently falls back to the plugin's direct wordpress.org / Make
/ GitHub queries, and lesson start is never blocked.

WordPress never talks to this sidecar directly — only Plato does.

## Run it (Node 18+)

```bash
npx -y @automattic/mcp-context-wporg
```

Environment for the sidecar:

| Variable             | Required | Purpose                                              |
| -------------------- | -------- | ---------------------------------------------------- |
| `MCP_TRANSPORT=http` | yes      | Serve over HTTP (Streamable HTTP) rather than stdio. |
| `MCP_BEARER_TOKEN`   | yes      | Bearer token Plato must present.                     |
| `GITHUB_TOKEN`       | no       | Raises GitHub API rate limits.                       |
| `WPORG_TRAC_COOKIE`  | no       | Access to protected Trac views.                      |

Confirm the exact package name, default port/path, and tool names against the
upstream repo and a live `tools/list` call.

## Point Plato at it

In `server/.env` (or your deploy's parameter store):

```
MCP_CONTEXT_WPORG_URL=http://localhost:3001/mcp
MCP_BEARER_TOKEN=<same token as the sidecar>
# Optional — match the sidecar's actual tool/argument names (verify via tools/list):
MCP_SEARCH_TOOL=search
MCP_SEARCH_ARG=query
```

The client lives at `plugins/wordpress-info/server/mcp-client.js`; the tool name
and argument are env-configurable because mcp-context-wporg exposes capabilities
through versioned meta-tools.

## Production note

Plato's API runs on AWS Lambda, which can't host a long-running Node process. Run
this sidecar as a **separately hosted, always-on service** (container / App Runner
/ small instance) and set `MCP_CONTEXT_WPORG_URL` to its URL. Lambda calls it over
HTTP per request, with the bearer token. In local dev, just run the `npx` command
above alongside `node dev-sqlite.js`.
