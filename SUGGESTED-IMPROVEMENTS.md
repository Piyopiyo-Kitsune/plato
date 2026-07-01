# WordPress Coach — Suggested Improvements

Backlog of larger features and design decisions captured during the build, with
recommended approaches. WordPress Coach is intended to work **two ways**, and
these items should preserve both:

1. **Standalone "Agentic Coach LMS"** — no other LMS installed; WordPress Coach's
   own course/module/lesson CPTs structure the content.
2. **Complement to an LMS (Sensei today)** — the LMS owns courses/lessons; WordPress
   Coach adds the coaching layer + embed and maps the LMS structure to Plato.

---

## 1. Hide our own Course/Module/Lesson menus when an LMS is active

**Status:** deferred by request (we want to demo both modes for now).

When Sensei (or a future supported LMS) is active, our `agentic_course` /
`agentic_module` / `agentic_lesson` CPTs duplicate the LMS's structures and can
confuse authors. Proposed behavior:

- When a supported LMS is detected, **hide the WordPress Coach CPT submenus**
  (Courses/Modules/Lessons) and keep only Settings + the how-to + the coaching
  layer. Surface them only when no LMS is detected.
- Add a setting — **"Always show built-in content types"** — to force them back on
  (for sites that want both).
- Keep the CPTs *registered* (so existing content isn't lost), just hidden via
  `show_in_menu`.

---

## 2. Enrolled vs. all courses + enrollment ✅ DONE (Plato-native); Sensei mapping = follow-up

Learners need to distinguish **courses they're enrolled in** from **all available
courses**, and be able to enroll.

**Shipped (Plato-native enrollment):** the Courses landing page (`CoursesList.jsx`)
now has a **welcome header** plus an **All Courses / My Courses** segmented toggle
with distinct copy per view. Enrollment is a per-learner list of course ids stored
in sync-data (`enrollments` key; `getEnrollments`/`saveEnrollments` in
`client/js/storage.js`). Each All-Courses card has an **Enroll / Enrolled** toggle
button (`aria-pressed`); My Courses shows only the enrolled subset with an empty
state that links back to All Courses. Uncategorized is never enrollable.

**Follow-up — map to WordPress/Sensei enrollment (the notes below still apply):**
today enrollment is Plato-local. To make WordPress the source of truth, seed/merge
`enrollments` from Sensei via the bridge at token-exchange, and delegate the Enroll
button to a WordPress REST route. Until then, enrolling in the embed does not
enroll the learner in Sensei.

**With Sensei:** use Sensei's enrollment as the source of truth.
- Read enrollment via `Sensei_Course_Enrolment::get_instance( $course_id )->is_enrolled( $user_id )` (or `Sensei()->course->get_learner_courses()`).
- Enroll via Sensei's manual enrolment provider (`Sensei_Course_Enrolment_Manual_Provider`).
- The WordPress Coach "enroll" button calls a REST route that delegates to Sensei.

**Standalone:** WordPress Coach needs its own lightweight enrollment.
- Store enrolled course ids per user (user meta `_agentic_enrolled_courses`, or a
  small table). Provide REST `POST /agentic-coach/v1/enroll` + `/unenroll`.
- The coach UI shows **"My courses"** (enrolled) vs **"All courses"** (browse +
  enroll), with an Enroll button on un-enrolled courses.

**Where the state lives for the coach UI (Plato):** the simplest path is to pass
the learner's enrolled course ids from WordPress into the embed (or have Plato
query a WordPress REST endpoint over the bridge) so the Plato Courses landing can
split Enrolled vs. All. Plato has no enrollment concept today, so this is the main
new data flow to design.

---

## 3. Course detail grouped by module ✅ DONE

In the course-detail view (Courses → a course), lessons are grouped under module
headers, ordered. Implemented end-to-end and verified with a live bridge round-trip:
- **Publish** sends the lesson's module name + order + lesson order to Plato
  (`class-sync.php` → `class-plato-client.php::publish_lesson` → `/v1/bridge/lesson`).
  CPT: `_agentic_module` title + `_agentic_order`. Sensei: the `module` taxonomy term,
  with the course's `module_order` meta for display order (`class-sensei.php`).
- **Bridge** stores `module` / `moduleOrder` / `order` on the `_system:lesson:<id>`
  record (`bridge.js`); `content.js` passes them through to `/v1/lessons` via `...data`.
- **Client** (`LessonsList`, route-locked course view) renders one `<section>` +
  `<h2>` per module, modules ordered by `moduleOrder`, lessons within a module by
  `order` (name fallback). Lessons with no module fall under "Other" last; when every
  lesson is unassigned the lone "Other" heading is suppressed in favor of a flat grid.

---

## 4. Multilingual coaching — recommendation

**Recommendation: explicit preference → account/WP locale → browser language →
site default, with a visible language switcher as override. Do NOT use geo/region
detection.**

Rationale:
- **Geo/region is a bad proxy for language** (someone in Japan may prefer English)
  and adds privacy concerns. Avoid IP/region detection.
- **Resolve the language from explicit signals, in priority order:**
  1. Learner's explicit choice (a switcher in the coach UI; persisted).
  2. The WordPress user's locale (`get_user_locale()`), forwarded via the bridge.
  3. Browser `navigator.language` / `Accept-Language`.
  4. Site/classroom default.
- **Always provide a visible language switcher** as the override/fallback.

**How the coach actually speaks the language (cheap, high-quality):** pass the
resolved language into the **coach's system context** as a directive
("Respond in {language} unless the learner writes in another language"). The LLM
(Claude/GPT) handles multilingual responses natively — no translated prompt set
needed. The *conversation* adapts immediately; authored lesson content
(objectives/exemplar) stays as written.

**Phasing:**
- **Phase 1 (high value, low cost):** language directive in the coach context +
  switcher + locale/browser detection. The coaching *conversation* becomes
  multilingual.
- **Phase 2:** localize the Plato UI chrome (buttons, labels) with an i18n library
  (e.g. react-i18next) and translation catalogs.
- **Phase 3 (optional):** offer to auto-translate authored lesson content, or let
  authors provide per-language variants.

---

## 5. Generalize the LMS integration

The Sensei adapter (`class-sensei.php`) is a clean pattern. Generalize to other
LMSes via the same approach (detect → register coaching meta on the LMS lesson CPT
→ resolve the lesson's course → publish to Plato → auto-embed):
- **LearnDash** (`sfwd-courses` / `sfwd-lessons`, course via `lesson_associate`),
- **LifterLMS** (`course` / `lesson`),
- **TutorLMS** (`courses` / `lesson`).
Extract a small `Lms_Adapter` interface so each is ~50 lines.

---

## 6. Design-system alignment

Adopt the **WordPress Design Library** and **WordPress Design System** (the Figma
sources) for Plato's learner-facing UI:
- **Done:** hyperlinks now use **Blueberry `#213FD4`** (a WordPress design token).
- **Next:** align the type scale + font pairing, spacing, button and card styles,
  and the focus/active states to the WordPress Design System; map them onto Plato's
  existing CSS-variable theme (`client/src/index.css`) so they theme cleanly.
- Keep classroom branding (primary color from settings) layered on top.

---

## 7. Trust, safety & privacy (learner-facing)

Several of these are compliance-relevant because **the coach may be used by minors**.
A first layer now lives in the coach prompt (`client/prompts/coach.md` → Guardrails:
reading level, safety/minors, source-of-truth, WordPress brand). The remaining items
are UI/data features:

### 7a. Single sign-on — don't ask embedded learners for a Plato account ✅ DONE
In the WordPress embed the learner is already authenticated as their WordPress user
(the bridge maps them to a stable Plato user), so Plato's own login / account
management is now **hidden in the embed**. Shipped:
- Embed-awareness helper `client/src/lib/embed.js` (`isEmbedded()` / `markEmbedded()`).
  `?embed=1` latches to sessionStorage so it survives client-side navigation;
  `EmbedLessonChat` also latches it on mount, and the WordPress `embed_url()` now
  appends `&embed=1`.
- `AppShell`: in embed mode the account dropdown (email + **User Settings** +
  **Sign Out**) is replaced by a "Hi, {WordPress name}" greeting and a single
  **"Your data & privacy"** link. The header still links to the courses home.
- `Settings`: in embed mode the **Account** card (email/username/password) is hidden
  and replaced by a "signed in through WordPress" note; the **Your data & privacy**
  panel (GDPR view/edit/delete/opt-out) stays reachable — we don't hide data rights.
- The display name already flows from WordPress via the bridge (`user.name`), so the
  greeting uses it.
- The standalone Plato app is unaffected (not embedded) and keeps its own accounts.

**Full-app "courses home" embed ✅ DONE.** The WordPress Coach block now has a
**Show: A single lesson / Courses home** option. In home mode it mints a bridge code
with no lesson and embeds `/embed/home?code=…&embed=1`; the new `EmbedHome` page
boots the session and hands off to the normal authenticated app at `/courses`
with the embed-aware AppShell (WordPress identity, no sign-out). The one-time
bridge-code exchange is now shared by both embeds (`client/src/lib/bridgeBoot.js`),
and the bridge already tolerated `lessonId: null`. In-iframe reload lands on
`/courses` and re-hydrates from persisted tokens (no fresh code needed).

### 7b. GDPR — learner control over their stored profile ✅ DONE
Plato keeps a per-learner profile + chat history + course progress. Learners now have
explicit control and a clear notice, in Settings → **"Your data & privacy"**:
- **View / edit** the stored learner-profile summary (`saveLearnerProfileSummary`),
  **delete** it (`deleteProfile` + `deleteProfileSummary`, with a confirm dialog), and
  **opt out** of profile/personalization tracking — coach still works, just without the
  profile.
- Opt-out is a `preferences.profileOptOut` flag. Enforced in two places:
  `profileQueue.js` (`isProfileTrackingEnabled()` guards `ensureProfileExists` and all
  three update paths, so no profile is created or updated) and `lessonEngine.js` (the
  `profileSummary` fed into `buildContext` is nulled when opted out, so the coach never
  sees it).
- A plain-language privacy notice sits at the top of the panel: what's stored, why, that
  it's only for coaching / never sold, and how to turn it off or delete it.

Follow-up (not yet wired): connect **delete** to the server-side bridge erasure
(`POST /v1/bridge/forget`) so deleting also clears the synced record, not just local +
debounced sync. Today deletion removes the profile locally and syncs the empty state.

### 7c. Image-upload consent (first use)
Before the first image upload, show a consent modal the learner must accept. Draft copy:
> **Before you share an image**
> - **What it's for:** images you upload are used only to help the coach review your
>   lesson work.
> - **Who can see it:** your coaching session and the people who run this learning
>   program. It is processed by the connected AI service to give you feedback.
> - **How long it's kept:** images are retained with your lesson conversation and are
>   deleted when your data is deleted.
> - **Please don't** upload anything inappropriate, offensive, or that isn't your own
>   lesson work.
> - **Note:** this coach may be used by learners of all ages, including minors.
> [ ] I understand and agree.  ( Cancel / Continue )

Persist acceptance per learner so it's shown once. Pair with the coach-prompt guardrail
that already declines inappropriate images.

---

## 8. Smaller follow-ups

- **Granular provider errors:** surface quota/rate/auth errors from the AI provider
  to the learner clearly instead of a generic 500 (map OpenAI/Anthropic status).
- **Course cards with progress:** show "N of M lessons completed" on course cards.
- **Signed publish payloads:** the bridge `/v1/bridge/lesson` authenticates the
  site (HMAC) but doesn't sign the content body; sign it if payload integrity is
  required.
- **Accessibility pass:** full screen-reader/keyboard audit of the embedded chat.
