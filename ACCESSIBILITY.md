# Accessibility — WCAG 2.2 AA

This is the accessibility standard for WordPress Coach (the Plato learner UI and
the WordPress companion plugin) and a record of the audit. **Target: WCAG 2.2
Level AA.** Build every new UI through this lens; update this file when criteria
status changes.

## How this was audited

- **Code review** of the learner-facing Plato UI and the WordPress plugin admin/
  editor/block UI against the WCAG 2.2 AA success criteria.
- **Static checks:** ESLint (jsx-a11y via `@wordpress/eslint-plugin` on the plugin),
  and Plato's own a11y conventions (documented in `CLAUDE.md`).
- **Still to do (needs a running browser + AT):** an automated axe-core pass on a
  live lesson page, and a manual screen-reader + keyboard pass (NVDA/VoiceOver).
  Tracked below as open items.

## New in WCAG 2.2 (delta from 2.1) — status

| SC | Level | Status | Notes |
|----|-------|--------|-------|
| 2.4.11 Focus Not Obscured (Min) | AA | ✅ Fixed | Added `scroll-pt-16 scroll-pb-32` to the chat scroll containers (AppShell + embed) so a Tab-focused element is never hidden behind the pinned header or fixed compose bar. |
| 2.4.12 Focus Not Obscured (Enhanced) | AAA | ➖ | AAA — not targeted, but the 2.4.11 fix helps. |
| 2.4.13 Focus Appearance | AAA | ➖ | AAA. Focus ring is a 3px `--ring` outline w/ 2px offset (strong, but AAA thickness/contrast not formally verified). |
| 2.5.7 Dragging Movements | AA | ✅ Pass | No drag-only interactions in the learner UI. (If lesson/module reordering ever uses drag, provide a non-drag alternative.) |
| 2.5.8 Target Size (Min) | AA | ✅ Pass | All icon buttons ≥24px: `icon-xs`=24px (remove chips), `icon-sm`=28px (upload/link/send), `icon`=32px. |
| 3.2.6 Consistent Help | A | ✅ Pass | Help affordances (Lesson Overview, "?" objectives) are consistently placed. |
| 3.3.7 Redundant Entry | A | ✅ Pass | No repeated data entry. In the embed, identity comes from WordPress (no re-login). |
| 3.3.8 Accessible Authentication (Min) | AA | ✅ Pass | Embedded learners authenticate via WordPress SSO (no cognitive test). Standalone login is email+password (password managers allowed; no puzzles). |
| 3.3.9 Accessible Authentication (Enhanced) | AAA | ➖ | AAA. |

## Existing strengths (carried from Plato conventions)

- Chat log uses `role="log"` `aria-live="off"`; new-message announcements use a
  separate auto-clearing `role="status"` region (no re-reading history).
- Streaming assistant messages are `aria-hidden` and drop `tabIndex` so focus/
  Alt+Arrow nav never lands on them; persisted messages carry sr-only speaker
  prefixes for navigation.
- Every interactive control has a visible focus indicator (SC 2.4.7): 3px
  `--ring` outline, 2px offset.
- Icon-only buttons have `aria-label`s; the compose bar's upload/link/send and
  remove-chip buttons are all labeled.
- Dialogs (objectives, image consent, confirm) use Radix — focus trap, Escape to
  close, `aria-modal`, and title/description wiring for free.
- Lists/grids use `role="list"` with `aria-label`; course/module grouping uses
  semantic `<section>` + `<h2>` headings.

## Image-consent dialog (new) — a11y notes

- Radix Dialog (focus trap, Escape, `aria-modal`, labelled title/description).
- Focus moves to the agreement checkbox on open; returns to the message box on
  cancel/agree (no focus loss to `document.body`).
- "Continue" is disabled until the checkbox is ticked; the checkbox has a real
  `<label>` and a visible focus ring.

## Color contrast (SC 1.4.3) — verified

Computed against white/card backgrounds — all pass AA (≥4.5:1 text, ≥3:1 UI):

- White text on `#3858E9` button: **5.61:1** ✅
- `#213FD4` link on white: **7.70:1** ✅ (also meets AAA 7:1)
- `#3858E9` on white (header/border): **5.61:1** ✅
- Dark-mode link `#8ea2f0` on `#252525` card: **6.26:1** ✅

## Open items (need verification, not yet closed)

- **Automated axe-core pass** on a live embedded lesson page.
- **Manual screen-reader pass** (VoiceOver + NVDA): the streaming chat, the
  compose bar, the consent dialog, and the courses → module → lesson flow.
- **Reduced motion (SC 2.3.3, AAA / good practice):** card fade/slide-in and the
  loading spinner honor `prefers-reduced-motion` in most places; audit remaining
  animations.
- **WordPress plugin admin** (settings, panels, admin columns, how-to page):
  spot-checked (labels, headings, nonce forms); do a focused pass on the block
  editor panels' keyboard operability.

## The standard, going forward

Every new UI must, before it ships:
1. Be fully keyboard operable, with a visible focus indicator and logical order.
2. Give every control an accessible name; use semantic elements (headings, lists,
   landmarks) over visual styling.
3. Keep interactive targets ≥24×24px and ensure focus is never obscured by
   sticky/fixed UI (add `scroll-padding`).
4. Announce dynamic changes through a polite live region, not by moving focus.
5. Not rely on color alone; meet 4.5:1 text / 3:1 UI contrast.
6. Respect `prefers-reduced-motion`.
