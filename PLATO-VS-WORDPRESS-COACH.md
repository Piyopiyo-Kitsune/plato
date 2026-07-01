# Plato vs. WordPress Coach — feature comparison

**Plato** is the upstream open-source agentic microlearning platform (a standalone
React SPA + Node/Lambda backend). **WordPress Coach** is this fork: it reuses
Plato's coaching engine wholesale and adds WordPress integration plus a set of
learner-experience, localization, privacy, and branding enhancements.

Legend: ✓ = has it · ➖ = not applicable / absent · "reused" = provided by Plato and
surfaced by WordPress Coach unchanged.

## Coaching engine
| Capability | Plato | WordPress Coach |
|---|:--:|:--:|
| Agentic AI coach (conversational, exemplar-based) | ✓ | ✓ (reused) |
| 9 specialized AI agents (coach, lesson-owner, KB, profile, course-progress…) | ✓ | ✓ (reused) |
| Cross-lesson course memory (per learner, course-scoped) | ✓ | ✓ (scoped via SSO mapping) |
| Pacing & completion semantics | ✓ | ✓ (reused) |
| Coach guardrails: reading level, WordPress brand voice, safety/minors | ➖ | ✓ |

## Authoring
| Capability | Plato | WordPress Coach |
|---|:--:|:--:|
| Conversational lesson creation in-app | ✓ | ✓ (reused) |
| Author courses/modules/lessons in WordPress (CPTs) | ➖ | ✓ |
| Gutenberg authoring sidebar with native AI help (`wp_ai_client`) | ➖ | ✓ |
| "Publish Lesson" from WordPress → coach (signed bridge) | ➖ | ✓ |
| Sensei LMS integration (reuse Sensei courses/lessons) | ➖ | ✓ |

## Learner experience
| Capability | Plato | WordPress Coach |
|---|:--:|:--:|
| Courses home + lesson browser | ✓ | ✓ (enhanced) |
| Module-grouped course detail | ➖ (course-level only) | ✓ |
| Enrollment: All Courses / My Courses | ➖ | ✓ |
| Course cards with completion progress | ➖ | ✓ |
| Image + link attachments in chat | ✓ | ✓ (reused) |
| "Press Enter to send" toggle | ➖ | ✓ |
| Course-scoped navigation (no flat all-lessons page) | ➖ | ✓ |

## Embedding & delivery
| Capability | Plato | WordPress Coach |
|---|:--:|:--:|
| Standalone web app | ✓ | ✓ |
| Embed a single lesson in any WordPress page (block) | ➖ | ✓ |
| Full-app "courses home" embed in WordPress | ➖ | ✓ |
| Responsive iframe with height auto-sizing | ➖ | ✓ |

## Identity & access
| Capability | Plato | WordPress Coach |
|---|:--:|:--:|
| Own accounts (email/username/password) | ✓ | ✓ (standalone) |
| WordPress SSO — stable mapped user, no separate login | ➖ | ✓ |
| Hide Plato account UI in the embed | ➖ | ✓ |

## Trust, safety & privacy
| Capability | Plato | WordPress Coach |
|---|:--:|:--:|
| AI-built learner profile | ✓ | ✓ (reused) |
| "Your data & privacy" panel: view / edit / delete / opt out | ➖ | ✓ |
| One-time image-upload consent modal | ➖ | ✓ |
| WordPress privacy integration (policy text, exporters/erasers) | ➖ | ✓ |
| AI keys stay server-side (never in WordPress/browser) | ✓ | ✓ (enforced) |

## Localization
| Capability | Plato | WordPress Coach |
|---|:--:|:--:|
| Multilingual coach conversation | ➖ | ✓ |
| UI translation — 15 languages, instant switch | ➖ | ✓ |
| AI Learning Overview generated in the learner's language | ➖ | ✓ |
| Language resolution: explicit → WordPress locale → browser → English | ➖ | ✓ |

## Branding & design
| Capability | Plato | WordPress Coach |
|---|:--:|:--:|
| Per-classroom branding (color/logo from settings) | ✓ | ✓ (reused, layered on top) |
| WordPress Design Library theme by default (Blueberry, Inter/EB Garamond) | ➖ | ✓ |

## WordPress-native AI plumbing
| Capability | Plato | WordPress Coach |
|---|:--:|:--:|
| Provider abstraction (Anthropic / OpenAI / Bedrock) | ✓ | ✓ (reused) |
| Abilities API + MCP server exposing WP lesson/course context to the coach | ➖ | ✓ |
| WordPress.org knowledge over MCP (`mcp-context-wporg`) | partial (`wordpress-info` plugin) | ✓ (wired) |

---

*In short: WordPress Coach = Plato's coaching engine, delivered inside WordPress,
with enrollment, progress, module grouping, full localization, GDPR controls, image
consent, SSO, and the WordPress Design Library look — while the AI runtime, agents,
and course memory remain Plato's.*
