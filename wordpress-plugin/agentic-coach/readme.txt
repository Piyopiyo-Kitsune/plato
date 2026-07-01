=== WordPress Coach ===
Contributors: plato
Tags: ai, learning, lms, coach, mcp
Requires at least: 6.5
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Embed a Plato-powered agentic learning coach into WordPress lessons.

== Description ==

WordPress Coach connects WordPress to a Plato deployment so you can:

* Author coaching courses, modules, and lessons in WordPress.
* Embed a live, Plato-powered agentic coach into any lesson with the **WordPress Coach** block — similar in spirit to embedding WordPress Playground.
* Get lightweight in-editor AI help while drafting lessons (via the WordPress AI Client on WordPress 7.0+).
* Let the coach read live lesson/course context over MCP (via the WordPress MCP Adapter and Abilities API).

Plato remains the authoritative coaching runtime: the AI coach, lesson engine,
per-course progress memory, and learner state all live in Plato. WordPress is the
authoring and embedding surface. The connection secret is held server-side and is
never exposed to the browser.

== Architecture ==

* The learner block renders a sandboxed iframe of Plato's lesson chat. A one-time,
  single-use embed code is minted server-side via a signed bridge request, so each
  WordPress learner maps to a stable Plato learner and their chat history and
  course memory persist.
* Course progress memory is per-learner and scoped to a course; it never crosses
  into other courses (this is Plato's `courseProgress` behavior).
* WordPress talks only to Plato; it never calls external knowledge services directly.

== Privacy ==

A pseudonymous identifier derived from the WordPress user is sent to Plato. The
user's email is only shared when the administrator opts in
(`agentic_coach_send_email`). The plugin integrates with WordPress's personal-data
export and erasure tools; erasure asks Plato to delete the learner's data.

== Frequently Asked Questions ==

= Does this require WordPress 7.0? =

The block, admin, and REST proxy work on WordPress 6.5+. The Abilities API, MCP
Adapter, and AI Client integrations activate on WordPress 7.0+ (or with the
corresponding feature plugins) and are no-ops otherwise.

== Changelog ==

= 0.1.0 =
* Initial release: settings, course/module/lesson content types, learner block,
  authoring sidebar, REST proxy, Abilities/MCP exposure, and GDPR integration.
