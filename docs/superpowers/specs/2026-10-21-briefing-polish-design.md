# Briefing page polish: design

Date: 2026-10-21. Branch: `story/briefing-page` (unmerged). This is a follow-up to `2026-10-20-briefing-page-design.md`. That spec still holds; this one changes only what is listed here.

## Why

The owner tried the built page on a real briefing ("Boeing") and reported four things:

- the "more/less" buttons look cheap
- "From the archive" seemed to be missing
- buttons are inconsistent and sometimes don't react when clicking around quickly
- the hover highlight on tension rows covers only part of the row

Debugging traced each of these to a cause. Each cause is below with its fix. The goal is a page that feels solid and deliberate, like the rest of the Newsprint identity, and an index that actually shows which developments each tension connects. After this pass the branch merges to local main.

The binding rules still apply:

- Reshape, don't rebuild.
- Tokens come only from `tokens.css`.
- Ultramarine is the single highlight.
- Red and amber are for heat only.
- Motion is welcome; reduced motion applies only when the OS asks for it.

## Goals

1. One control system across the briefing page: **option A**, chosen by the owner from a mockup.
2. Tension index rows that respond as whole rows, with a clearly visible pinned state.
3. Tension-to-development links that come from the AI, not from region-name matching.
4. "From the archive" is noticeable on every card.
5. No dead-feeling clicks:
   - region tags work on desktop
   - jumping to a story never freezes the globe
   - double-clicks don't undo pins
   - nothing jumps around

## Non-goals

- No changes to page order, the timeline, the globe engine, images or Read first content.
- No new settings.
- Other pages keep their controls. Only `.btn-primary` is shared, and it is not touched here.

## 1. Control system A, decided by the owner

**Text buttons.** One shared class (say `.text-btn`, in `story.css` or a shared stylesheet; the builder decides) replaces `.index-more`, `.index-show`, `.alerts-show` and `.dev-context-toggle`.

- **Look:** IBM Plex Sans 500, about 14px (0.875rem), `--ink`. No underline and no background. A trailing plus glyph with about 6px gap. Labels are sentence case: "More", "Less", "Show 4 more", "Read background", "Show less".
- **Hover:** text turns `--accent` and the plus rotates 90°.
- **Open state:** when the control is expanded ("Less", "Show less"), the glyph is a minus. Reuse `PlusIcon` or `ExpandIcon` from `components/icons.tsx` rather than adding a new icon if one fits.
- **Size:** min-height 24px (WCAG 2.5.8). The Read first "Show N more" previously used 44px; drop it to the shared size.
- **Focus:** `:focus-visible` gives a 2px `--accent` outline with a 2px offset.
- **Motion:** colour uses `--dur-quick` (150ms); the glyph rotation is about 250ms, ease. Both apply only under `prefers-reduced-motion: no-preference`.
- **Placement:** the box hugs its label, so the left edge of the text lines up with the text above it. There is no lopsided padding.

**Chips.** One chip style for source chips (links), region tags and the card connection tag:

- 1px `--rule` border, no fill, `--ink-2` text, Plex 500 at about 0.8rem, padding about 3px 8px, square corners.
- Hover: border `--ink` and text `--ink`.
- The connection tag keeps its lit state: `--accent` border and text when its card is lit.
- The `.dev.is-dim` rules keep working: dim chips show a `--rule` border with `--ink-3` text.
- Source chips keep their time and external-link icon.

**One focus ring and one timing.** Every interactive control on the briefing page uses the same `:focus-visible` ring (2px `--accent`, 2px offset). Every control transition uses `--dur-quick`. Exceptions: the card dim and lit transitions stay on `--dur-mid`, and the glyph rotation is about 250ms.

## 2. Tension index rows

Today the row button covers only the top part of the `li`, so the reason text and "More" sit outside the hover and click target.

- **Whole row is the target.** Hover preview starts and ends on the whole `li`, not just the button.
  - Clicking anywhere in the row pins it, except on the More/Less control. The row's reason text is plain text with no links today. As a safeguard, the row handler ignores clicks that land on any nested `button` or `a`.
  - The `<button class="index-row" aria-pressed>` stays the semantic pin control for keyboard and screen readers.
  - A click elsewhere in the row calls the same handler.
- **Padding.** Rows get horizontal padding of about 12–14px on both sides, so the wash and the pinned edge don't touch the text.
- **Focus ring.** When the row button has `:focus-visible`, the ring goes around the whole `li`, for example via `:has()`.
- **Pinned style.**
  - A pinned row shows a 3px `--ink` inset edge on the left plus a `--paper-deep` background, exactly as in the mockup.
  - That style stays on the pinned row while the pointer hovers other rows. The hovered row gets the accent wash, so both are visible at once.
  - The cards and globe still follow the preview while hovering, as before: `active = previewed ?? pinned`.
- **Double-click.** A second click in the same gesture (`event.detail > 1`) is ignored, so a quick double-click leaves the row pinned.
- **Revealed rows stay revealed.** If a pin from elsewhere expanded the list past the top 3, clearing the pin does not collapse the list again. Treat it as if "Show N more" was pressed.
- **Connection tag.**
  - A card's connection tag pins that card's first linked row, as now.
  - If that row is already pinned, pressing the tag unpins it.
  - The tag still focuses the pinned row afterwards (from the earlier fix).

## 3. Tension linking from the AI (decided by the owner: the AI states the links)

Today `linkBriefing` links a tension to a development only when the tension text contains one of the development's region names exactly. On the Boeing briefing ("US FAA" against "United States") that links nothing. On single-country stories it links everything. Shared cited articles were checked as an alternative and also link everything on Boeing, so they are not a fix.

The briefing is written by three parallel calls. The "signals" call writes tensions and contradictions without seeing the developments, so it can't name them. The fix is a small linking step that sees both:

- **Backend.** Add `related_developments: Optional[list[int]] = None` to `Tension` and `Contradiction` in `backend/models.py`. Use zero-based indexes into `key_developments`.
- **Linking call.**
  - After both the developments and signals sections are written, one Haiku call (`settings.context_model`) receives each development (index, headline, summary, regions) and each tension and contradiction (index, actors or topic, description or accounts).
  - It returns JSON in the form `{"tensions": [[dev indexes]], "contradictions": [[dev indexes]]}`. It is told to link a development only when the tension is directly about it, and to leave a list empty when nothing fits.
  - Parse through `llm_json.py`. Drop out-of-range and duplicate indexes. Lists of the wrong length leave the affected items as `None`.
- **Timing.** The call starts as soon as both sections exist and runs in parallel with whatever is still pending: historical context, Commons, alerts. That keeps the added wait near zero. It has a hard budget of about 6s. On timeout or any error it logs a warning and leaves every `related_developments` as `None`. It never fails the briefing.
- **Not run when:** in DEMO_MODE fallback, with no API key, or when there are no tensions and no contradictions.
- **Index order.** Indexes point into the `key_developments` array exactly as the developments section returns it. Nothing downstream reorders or drops developments: historical context, Commons and `assign_images` all mutate in place. So the call can start early. The frontend's `linkBriefing` already works in raw array order (the newest-first sort happens later), so the indexes line up.
- **Budget.** The 6s budget applies to this call only, not the whole briefing. Because the call overlaps steps that are already slower (historical context is a Haiku call per development, plus Commons with a 1.5s budget), it should rarely be the last thing finishing.
- **Frontend.**
  - `normalize.ts` carries `relatedDevelopments: number[] | null` on tensions and contradictions. Contradictions are currently passed through raw, so add the field there too.
  - `withDefaults` fills `null` for briefings saved before this change.
  - `linkBriefing` uses `relatedDevelopments` when it is non-null, keeping only indexes within range. It falls back to today's region matching only when it is `null`.
  - `[]` means "linked to nothing" and is respected.
  - Nothing else in `tensionIndex.ts`, the strip squares or `connectionLabel` changes. They already handle an item with no links: every strip square is empty, the item sorts last, and no card shows a connection tag for it (`connectionLabel` returns null). Hovering it lights no cards and leaves the globe where it is.
- **Tests.**
  - The backend parses and clamps the links.
  - A timeout or bad JSON leaves `None` and the briefing still returns.
  - Linking is skipped when there are no signals.
  - The frontend prefers explicit links, respects an explicit empty list, and falls back on `null` and on old saved briefings.

## 4. "From the archive" (decided by the owner: a labelled two-line preview)

- The block keeps its place on the card, and becomes a 2px `--ink` left rule (was `--rule-strong`) with padding.
- The label "From the archive" is `--ink`, 600 weight and small. It is no longer grey.
- The teaser shows **two lines** with a line clamp, replacing the one-line nowrap ellipsis. It stays `aria-hidden`, because the toggle opens the full text, as today.
- The toggle is the shared text button: "Read background +", and "Show less −" when open. It no longer looks like a link.
- Print shows the full text and hides the toggle, as now.

## 5. Dead-feeling clicks

- **Region tags work on desktop.**
  - Clicking a region tag zooms the globe to that development on every device, not only on touch.
  - In `follow.ts`, a tag click is a one-off request like a touch tap. It wins over hover and focus until the reader hovers a different card, a pin or preview changes, or the carousel opens. Clicking it again re-requests it.
  - The request survives the pointer leaving the card, or leaving the timeline altogether, the same way a touch tap does today. Only a newer intent replaces it.
  - A tag click on the card already under the pointer still counts as a fresh request.
  - Clicking the same tag twice must re-request. Carry a request counter or nonce alongside the dev index (for example `{ dev, seq }`), so that setting the same dev again registers as a change. The jump from `scrollToStory` uses the same mechanism.
  - The phone "scroll the globe into view" behaviour stays touch-only.
- **No globe freeze after a jump.**
  - A jump from Top stories, the globe carousel or the reading flow (`scrollToStory`) still moves focus to the card for accessibility.
  - That programmatic focus must not hold the globe. Treat the jump as a one-off request, the same as a tag click, so the globe shows that card. Hovering another card then takes over normally.
  - Remove the `tabindex="-1"` that the jump adds when the card loses focus, so clicking the card's body text later doesn't re-focus and re-lock it.
  - Real keyboard focus inside a card (tabbing to a chip or button) still counts, as today.
- **No layout shift.** Toggling More/Less, Show N more and Read background must not move the control sideways, and rows above it must not move. Clicking outside the index must not collapse anything (see §2).
- Dwell and leave timings (250ms and 400ms) stay. A pin moves the globe at once, as now.

## Left to the builder

- Class names, and whether the shared text-button and chip CSS lives in `story.css` or a shared file.
- The exact glyph component.
- How the row-wide click is wired: an `li` handler versus a stretched button.
- The linking prompt's wording.
- How the existing CSS tests in `storyCss.test.ts` are updated to the new classes. Rename them freely, but keep tests on 24px targets, the focus ring and print rules.
- The merge itself is not part of the build plan. The controller runs it after the whole-branch review (the owner has already chosen a local merge to main).

## Done when

- The frontend and backend test suites pass, and lint passes.
- On the Boeing briefing: tension rows light only the developments the AI linked; hovering anywhere on a row previews it; a pinned row stays visibly pinned while hovering others; region tags zoom the globe with a mouse; and after jumping from Top stories, hovering cards moves the globe again.
- A whole-branch review is clean, then the branch is merged to local main.
