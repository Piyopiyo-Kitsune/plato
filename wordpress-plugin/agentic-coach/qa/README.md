# Agentic Coach — QA

Reproducible checks for the WordPress ↔ Plato integration. The first two need no
running services; the third needs a local Plato server.

## 1. Plugin boot smoke test (no services)

Loads the real plugin against a stubbed WordPress API, fires `init` /
`rest_api_init`, and asserts it boots with no fatals and registers the CPTs, REST
routes, block, GDPR eraser, and settings menu.

```bash
php qa/boot-smoke.php
```

## 2. WordPress Coding Standards

```bash
composer install
composer run lint        # phpcs (WordPress ruleset) — expected: clean
npm install
npm run lint:js          # @wordpress/eslint-plugin
npm run lint:css         # @wordpress/stylelint-config
```

## 3. Bridge + publish integration (needs a local Plato server)

```bash
# In the plato/ checkout:
cd ../../server
BRIDGE_SHARED_SECRET=test-secret-123 ANTHROPIC_API_KEY=sk-ant-dummy node dev-sqlite.js &

# Back in this plugin:
PLATO_URL=http://localhost:3000 BRIDGE_SECRET=test-secret-123 \
  node qa/bridge-integration.mjs
```

Verifies signature rejection, token → single-use code → exchange, stable learner
identity, and publish-to-Plato landing a lesson **with its course association** —
the link that scopes per-learner cross-lesson coach memory to a course.

## 4. Full WordPress runtime QA (needs Docker)

Not yet automated here — requires `@wordpress/env` (Docker). Steps:

```bash
# Start Docker, then from this plugin directory:
npx @wordpress/env start
```

Then, in the wp-env site (`http://localhost:8888`, admin/password):

- Activate **Agentic Coach**; confirm no PHP notices with `WP_DEBUG` on.
- Settings → Agentic Coach: set the Plato URL + shared secret (network admin on
  multisite, Administrator on single-site). Confirm the secret is masked.
- Create a Course, then a Lesson; assign the lesson to the course; in the editor
  sidebar click **Publish to Plato** and confirm "linked to its course".
- Add the **Agentic Coach** block to a page, pick the course + lesson, preview as
  a logged-in learner, and complete a chat. Confirm only block pages load coach
  assets.
- Cross-lesson memory: complete lesson 1 of course A, open lesson 2 of course A
  (coach can reference lesson 1), open a course B lesson (no course-A memory), and
  sign in as a second user (sees none of the first user's history).
- Accessibility: keyboard + screen-reader pass on the block and the embedded chat.

## Staged Learn fixture

Use `WordPress/Learn` (Docker/wp-env; prerequisites include Docker, Node, Yarn,
Composer, **SVN**) as the canonical staging fixture, mount this plugin, and run
its `yarn lint` / `lint:js` / `lint:css` / `lint:php` suites.
