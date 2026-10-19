# Atlas UI vision, spec 2: palette, layout, footer, strings, archive, settings, icons

Date: 2026-10-19. Status: draft for review.

This is spec 2 of the three-part UI vision started in `2026-10-18-atlas-brand-identity-design.md`. Spec 1 (brand identity) shipped. That spec defined spec 2 as "spacing system, page layouts and footer". This document widens it to everything decided in the 2026-10-19 brainstorm: a palette change, the briefing page layout, the strings, the archive, settings and a custom icon set. Spec 3 (story timeline tuning, globe arcs, click-to-zoom, story carousel, article images) is still separate and is not covered here.

Mockups from the brainstorm are in `.superpowers/brainstorm/91501-1792390471/content/`, which is git-ignored and local only. They show direction, not pixel specs.

## 1. Why

The owner reads Atlas on a 13-inch laptop (a window of about 1470 × 956). Today:

- **The top of the briefing page is barren.** The masthead (kicker, 72 px title, meta line, tabs, floating ask box on contour lines) takes about the top 38% of the first screen. Only one priority alert fits, and the globe floats in the right half with empty space above it.
- **The briefing body is cluttered in some places and barren in others.** The first development card has about 180 px gaps inside it. It is a CSS grid stretched to the height of the linked-card column beside it (`story.css`, `.dev`, with no `align-self`). The right column is a dense stack of small text, then about 700 px of nothing. The "From the archive" paragraphs are often longer than the news they sit under.
- **Archive and Settings look unfinished.** Archive's empty state is a full-width card with its content in the left third. Settings uses a narrower column than the nav and footer, so the edges don't line up.
- **The brand green is wrong.** The owner wants a sea-glass/celadon green, not the forest-toned moss `#3D5A45` that spec 1 chose.

The goal is a site that looks production-ready and premium, keeps the storytelling devices the owner likes, and puts more of the actual briefing on the first screen.

## 2. Goals, non-goals, anti-goals

**Goals**
- Celadon replaces moss as the brand primary everywhere, including the logo and brand assets.
- The briefing's first screen shows two alerts and the start of the timeline on a 1470 × 956 window.
- No dead gaps inside cards, and no long empty column beside the timeline.
- The strings tying connected stories stay, redrawn as loose threads.
- The scroll progress fill on the timeline spine stays exactly as it works today (the owner called this out).
- A new footer on every page, using the owner's mountain painting.
- A "New brief" button reachable from every page.
- Archive becomes topic threads, and Settings lines up with the page grid and gains a "Your data" section.
- A small custom icon set in the folded-paper style of the logo.
- A written spacing scale that the new and changed CSS uses.

**Non-goals**
- Spec 3 items: globe arcs, click-to-zoom, story carousel, article images, timeline tuning beyond what's listed here.
- Phone-specific redesign. The owner uses a laptop. Phone layouts must keep working and must not regress, but they get no new design work beyond what falls out of these changes.
- Backend or prompt changes. The background paragraphs stay as long as the model writes them; they are folded, not shortened.
- Renaming deploy services. Dark mode.
- Retrofitting every existing CSS file onto the new spacing scale. Only files this work touches move onto it.

**Anti-goals** (failure even if it technically works)
- Generated imagery that looks photographic or "AI slop". The owner rejected three such images on 2026-10-18 and called low-poly triangle mountains slop on 2026-10-19. The only generated image that ships is the owner's own mountain painting.
- Losing the storytelling: removing the strings, or the timeline's scroll fill, to simplify the layout.
- Royal blue spreading beyond signal duty. It stays reserved for alerts, hotspots, focus rings, the active tab, the logo dot, and now the highlighted string.
- Celadon text that fails contrast (see section 3).

## 3. Palette: celadon replaces moss

Chosen by the owner from four options (moss, sea glass, jade, celadon).

| Token (new name) | Value | Replaces | Job |
| --- | --- | --- | --- |
| `--celadon-light` | `#B4CCBE` | `--moss-light` `#6F8A6F` | logo light fold, hover fills, string tracks, secondary data |
| `--celadon` | `#5E8A79` | `--moss` `#3D5A45` | brand graphics: logo centre fold, timeline fill, data bars, nodes, glows. **Not for text.** |
| `--celadon-deep` | `#3A5F52` | `--moss-deep` `#2A3F31` | **all celadon text and controls**: links, primary buttons, wordmark, mono headings, active states |
| `--celadon-wash` | `rgba(94, 138, 121, 0.10)` | `--moss-wash` | tints |

Contrast, measured: `#5E8A79` on paper is 3.55:1 and on oat 3.19:1, which fails AA for body text. `#3A5F52` on paper is 6.51:1 and on oat 5.86:1, which passes. So **text, links and button fills use `--celadon-deep`**, and `--celadon` is only for non-text graphics (3:1 is enough there). Primary buttons are `--celadon-deep` with paper text, and pressed/hover goes one step darker (builder's choice, for example `#2F4E43`).

Unchanged: oat, oat-deep, paper, ink, ink-2, ink-3, rule, rule-soft, sand, ochre, and royal blue `--signal` `#3358C7`. `--sage` `#9AAA92` should be re-tinted toward celadon, or retired if nothing still needs it (builder's call).

**The logo changes too.** Folds are `#B4CCBE` / `#5E8A79` / `#3A5F52` with the blue dot. Reversed versions need new light celadon tints, picked so they read on `--celadon-deep` (builder picks and checks them). Files to update:
- `public/brand/*.svg`
- favicons
- the touch icon
- the OG share card (re-render with `scripts/brand/render.sh`)
- `AtlasMark.tsx` and its test
- `outline_wordmark.py` constants

Moss colours are also hard-coded outside `tokens.css`, and every one moves to celadon. A repo search for `3D5A45|6F8A6F|2A3F31|61, ?90, ?69|9AAA92|C9D2C0` finds them in:
- `story.css`, `base.css` (`::selection`), `globe.css`
- `globe/engine.ts` (land dot colour)
- `Contours.tsx`
- `og-card.html`

Rename the tokens rather than keep "moss" names holding celadon values. That's my call; it matches spec 1 renaming `--terra` to `--signal`.

## 4. Spacing system

Add a spacing scale to `tokens.css` and use it in every file this work changes:

`--space-1: 4px · --space-2: 8px · --space-3: 12px · --space-4: 16px · --space-5: 24px · --space-6: 32px · --space-7: 48px · --space-8: 64px · --space-9: 96px`

Rules:
- Inside a card, use 12 to 24 px.
- Between cards in a list, use 12 to 16 px.
- Between page sections, use 48 to 64 px.
- Between the page header and first content, use 24 to 32 px.

`--gutter` and `--maxw` (1240 px) stay. Every page uses the same content width as the nav and footer, which fixes Settings.

The existing "Compact layout" setting (`.briefing.compact`) keeps working. It should step the briefing's spacing down one notch on the scale.

## 5. Nav and the New brief button

- A **New brief** button sits at the right end of the nav on every page: a filled `--celadon-deep` pill with the new "new brief" icon. It goes to Home (`/`) and focuses the ask input. That's my call: it's simpler than an in-place panel, and Home has the topic chips.
- The nav clock moves out of the nav to make room. On briefing pages the time is already in the meta line, and the clock remains reachable in Settings → Time. That's my call.
- The floating ask box on briefing pages is removed (`AskForm compact` in `BriefingLayout.tsx`). Generating from a briefing page now goes through New brief.

## 6. Briefing page

### 6.1 Compact header (owner chose option A)

- The title drops from about 72 px to about 48 px (Jost 500). It shares one baseline row with the meta line ("Issued …, cadence, N articles, N sources"), which is right-aligned in mono.
- The tabs (Story, Signals) sit directly below. The total header is about 140 px, down from about 345 px.
- The "BRIEFING" kicker label is removed, and the masthead contours are removed from briefing pages. Contours stay on Home only.
- On narrow screens, the meta line wraps under the title.

### 6.2 Story tab first screen

- Alerts and the globe start directly under the tabs, in the existing `story-lead` two-column layout (alerts left, globe right). Change `align-items: center` to `start` so the globe sits at the top of its column, not floating in the middle.
- **Acceptance check:** on a 1470 × 956 window, the first screen shows two alerts and the start of the "Key developments" section.

### 6.3 Development cards (owner chose option A, everything inline and folded)

- **The right-hand linked column is removed.** The timeline grid becomes `time | node | card`, so cards gain the freed width.
- **Fix the stretch bug.** Cards must size to their content (`align-self: start`, or `align-content: start` on the card grid).
- **Background ("From the archive")** shows as a one-line teaser: the first line of the paragraph, clipped with an ellipsis, followed by a "Read background" control. Activating it expands the full paragraph in place, and "Show less" collapses it. It starts folded on every visit and the state isn't remembered (my call). The control is a real `button` with `aria-expanded`. The existing "Historical context" setting still hides background entirely.
- **Linked tensions and source disagreements** become small tabs in a row at the bottom of the card, divided from the body by a hairline. Each tab shows its kind and level in mono (for example "TENSION · MEDIUM", "SOURCES DISAGREE · 2 ACCOUNTS"), then the title.
  - Activating a tab expands its full content in place, below the row. Several can be open at once.
  - A tension expands to its description, actors and sources. A disagreement expands to account A and account B side by side, each with its source chips. Below about 640 px they stack.
- A tension or disagreement linked to several developments shows a tab on each of them. Opening one doesn't open the others (my call).
- Tensions and disagreements that match no development keep the existing "Also in this briefing" section after the timeline. Nothing is attached to a card at random; this is the existing rule in `lib/timeline.ts`.
- Card order, priority marks, region tags and source chips are unchanged.

### 6.4 Strings (owner chose option B, loose thread)

The strings stay. With the right column gone, each string now ties **development to development**: two developments are strung together when they share a tension or a disagreement. The links are the existing `linkBriefing` output, turned into pairs of developments per tension or disagreement.

- **Drawing.** One soft, slightly uneven thread per pair, in the gutter left of the spine. It's an SVG cubic path whose control points get a small deterministic wobble (seeded from the pair, so it's stable across renders and resizes). There's a small knot (a dot of about 3 px) where the thread meets each card's edge.
  - Resting colour is `--celadon` at reduced opacity, with a stroke of about 1.4 px.
  - A tension or disagreement linked to more than two developments chains through them in timeline order.
  - One linked to a single development has no thread. Its tab alone shows the link.
  - Two developments sharing several tensions get one thread per tension, offset slightly so they don't overlap exactly.
- **Scroll behaviour** keeps today's feel. A thread draws itself in (stroke-dashoffset) when its earlier development crosses the reading line (60% of the viewport). Threads already passed on load appear drawn, with no replay. This reuses the existing `branch-lit` mechanism.
- **Highlight.** Hovering or focusing a tension or disagreement tab, or opening one, turns its thread(s) royal blue at about 1.7 px, and the other threads fade. Hover is transient. An open tab keeps its thread lit until it's closed.
- **The progress fill stays unchanged.** The spine fill (`.spine b`, `--fill`) and node `.on` states keep working exactly as now.
- **Reduced motion.** Threads appear drawn instantly, and highlighting is an instant colour change.
- **Phone.** Below the existing single-column breakpoint the gutter is too narrow, so threads are hidden (as the branches are today) and the tabs alone carry the links.
- The threads are decorative (`aria-hidden`). The tabs carry the same information accessibly.

### 6.5 Signals tab

Signals gets the compact header only, plus the shared spacing scale. Fix the "1 ARTICLES" plural in the source-mix legend.

## 7. Footer (owner chose option 2, "lockup, then band")

It replaces the current two-line footer in `App.tsx` on every page. From top to bottom:

1. **Link columns** on paper, with mono headings in `--celadon-deep`:
   - **Read:** New brief, Archive, Starred (`/archive?filter=starred`)
   - **You:** Settings, Time zone (`/settings#time`)
   - **Project:** GitHub (the public repo `https://github.com/cwlau77/atlas_brief`, opens in a new tab)
   - A fourth column holds the note "Analysis is model-written. Check it against the cited sources."

   Links that need a page that doesn't exist are dropped, not stubbed, so the mockups' "How it works" and "Sources" are dropped (my call). The archive reads its All/Starred filter from the `filter` query parameter so the Starred link works. Today the filter lives only in component state.
2. **The lockup:** the G5 mark plus lowercase "atlas" in Jost 500, using spec 1's proportions (mark height 0.92 × font size, 0.28em gap). It's set edge to edge across the content width, very large (about 200 px or more at 1470 wide, scaling with the viewport), in `--celadon-deep`, and its bottom is slightly cropped by the band. It's a link to Home with the accessible name "Atlas home". A soft celadon radial glow sits behind its base.
3. **The painting band:** the owner's mountain painting with its sky cropped off. It fades in from paper at the top. "© 2026 Atlas" and "13 sources · last 24 hours" sit in light text on the dark foreground ridge.

**Image asset:**
- The source is the owner's Nano Banana image (`~/Downloads/image_7eb343f5.jpg`, 1584 × 672).
- Crop out the Gemini sparkle watermark in the bottom-right.
- The owner will supply a re-export at about 3000 px wide. Until then, ship the current one.
- Export it as WebP at 1x and 2x (`srcset`), aiming for 200 KB or less at 2x, with a JPEG fallback and a solid `--celadon-deep` background colour behind it.
- Use `loading="lazy"` and `alt=""`, since it's decorative.
- Commit it under `frontend/public/brand/` with a note in `brandkit/prompts.md` recording its source and prompt.

Footer text must pass AA on whatever sits behind it. Check the light text against the darkest and lightest parts of the ridge under it, and add a subtle scrim if needed.

## 8. Archive: topic threads

The archive page becomes a list of **topic threads**.

- Saved briefings are grouped by normalised focus (case-insensitive, whitespace-collapsed `area`). Each group is one row, a paper card, showing:
  - **Left:** the topic name, the briefing count, the date of the first briefing, and a star if any briefing in it is starred.
  - **Middle:** a horizontal string with one bead per briefing in date order. Bead size scales with article count. A bead is royal blue if that briefing had a critical or high alert, otherwise `--celadon`. The newest bead has a paper ring. Dates sit under the beads in mono. Each bead is a link to that briefing, keyboard-focusable, with an accessible name like "Red Sea shipping, 17 Oct, 16 articles, high alert".
  - **Right:** the article count of the latest briefing.
- Rows are sorted by most recent briefing. A topic with one briefing shows a one-bead thread.
- **The existing features stay:**
  - The All/Starred filter, now synced to `?filter=`. Starred shows only starred beads and hides threads with none.
  - Star and delete per briefing. A bead's focus or hover shows a small popover with the briefing's issued time and its star, open and delete actions. The builder may choose a different pattern if the popover fights keyboard use.
  - Compare two. "Compare two" is a toggle that switches beads into selection mode. The existing compare panel (`compare-col`) is reused as is.
- **Storage policy changes (owner's decision, 2026-10-19).** Today `fileBriefing` replaces any saved briefing with the same `area`, so a topic could never have more than one bead. Instead, filing keeps history:
  - Up to **4 briefings per topic** (matched by the normalised focus above) and **24 in total**, newest first.
  - When either cap is exceeded, the oldest unstarred briefing is dropped. **Starred briefings are never dropped** (amended after review, 2026-10-19). When only starred briefings could make room, the new briefing is not archived. It stays open in the current session, and a toast explains why.
  - The page says "Up to 4 briefings per topic and 24 in total are kept in this browser."
- **Empty state:** the mountain painting band (cropped, smaller) with "No threads yet" and a "Start a brief" button.

## 9. Settings

- It uses the same content width as every page.
- A sticky section index on the left (Profile, Time, Reading, Your data) sits beside the sections on the right. The index highlights the section in view and links to it. Below about 820 px the index becomes a horizontal row of links at the top.
- **Profile** gets a header card with the initials in a celadon disc (`--celadon` fill, paper text, large type, so contrast is fine), the name and field of study, and an "Edit profile" button. That button reveals the existing form fields (first name, last name, email, field of study) with Save. "Stored only in this browser" stays.
- **Time** is the existing time-zone control, unchanged.
- **Reading** holds the existing toggles (save automatically, historical context, compact layout), renamed from "Preferences".
- **Your data** is new. It shows what's stored in this browser: the number of saved briefings, the number starred, and approximate storage used (measured from the stored strings' length). Two actions:
  - **Export:** downloads one JSON file containing the saved briefings, stars, settings and profile.
  - **Clear archive:** asks for confirmation in an in-page dialog (not `window.confirm`), then removes saved briefings and stars only. Settings and profile stay. It also shows a toast. All reads and writes go through `lib/storage.ts`.

## 10. Icons

These are custom inline SVG React components in `components/icons.tsx`. They replace the four current ones (star, external, trash, print) and add:
- new brief
- read background (expand and collapse)
- tension
- disagreement
- alert levels (critical, high, elevated)
- Settings index icons (profile, time, reading, your data)
- export
- clear

Style: the folded-paper language of the G5 mark. Built from 2 or 3 flat faceted planes in `currentColor` at stepped opacities, rather than outline strokes, with crisp edges at 16, 20 and 24 px on a 24 px grid. No gradients. Hand-drawn in SVG, not generated. Decorative icons are `aria-hidden`, and icon-only buttons get an accessible name.

## 11. Home, Archive and Settings layout details

- **Home** is unchanged except for the new nav, the footer, the palette and the scale. It already fills the laptop screen.
- **Page headers** on Archive and Settings use the same compact pattern as the briefing: title plus right-aligned meta on one row, 24 to 32 px to first content.

## 12. Constraints

- Frontend only. There are no changes to the API, `models.Briefing` or prompts.
- Keep `prefers-reduced-motion` behaviour everywhere. New motion (thread draw, expand/collapse) gets instant equivalents.
- Keep keyboard and screen-reader parity: tabs, folds and beads are real buttons or links with names and `aria-expanded` where relevant.
- No new runtime dependencies.
- Google Fonts stay as they are.
- Light theme only. Print styles keep forcing ink-on-paper. In print, folds print expanded, threads are hidden, and the footer painting is hidden.
- Existing tests keep passing. The tests that assert moss colours (`AtlasMark.test.tsx`) and the linked-column layout (`timeline.test.ts` and similar) are updated, not deleted.

## 13. Left to the builder

- Exact type sizes within the ranges given, card radii, shadow, and the popover-versus-other pattern for archive bead actions.
- The reversed-logo celadon tints, the pressed-button shade, and `--sage`'s fate.
- The wobble algorithm for threads, as long as it's deterministic and subtle.
- Breakpoints, as long as the 1470 × 956 acceptance check holds and phones don't regress.

## 14. Done when

- A repo search finds no moss hex or rgba values outside git history and archived docs.
- The logo, favicons, touch icon and share card are celadon.
- On a 1470 × 956 window, the Story tab's first screen shows two alerts and the start of Key developments, with no gaps over 32 px inside any card.
- Threads draw on scroll, highlight on tab hover/focus/open, and the spine progress fill behaves as before.
- The footer appears on every page with the cropped, watermark-free painting.
- The archive groups by topic with keyboard-operable beads.
- Settings has the index and Your data, with export and confirmed clear.
- `npm run build`, `npm run lint` and `npx vitest run` pass. A manual pass at 1470 × 956 and 390 × 844 shows no layout regressions.
