# Atlas UI Spec 2 (Celadon, Layout, Footer, Strings, Archive, Settings, Icons) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Atlas frontend to celadon. On briefing pages, add a compact header, inline folded developments and loose-thread strings. Add a painted footer, topic-thread archive, re-laid-out settings and a custom faceted icon set.

**Architecture:** Frontend only (`frontend/`). The work is split into these pieces:
- **Pure logic** gets unit tests, in two new modules: `lib/archive.ts` (filing policy, topic threads) and `lib/threads.ts` (thread pairs and wobble paths). It also includes new helpers in `lib/storage.ts`.
- **React components** get light DOM tests using the repo's existing pattern: `createRoot` + `act` + `MemoryRouter` + `AppStateProvider`.
- **CSS** moves onto a new spacing scale in `styles/tokens.css`.

There are no new runtime dependencies.

**Tech Stack:** React 19, react-router 7, TypeScript 6, Vite 8, Vitest 4 (jsdom, threads pool), oxlint. Plain CSS files per component.

**Spec:** `docs/superpowers/specs/2026-10-19-ui-layout-polish-design.md`. Read it before starting any task. Section numbers below (§) refer to it.

## Global Constraints

- Run commands from `frontend/`. Node lives at `~/.local/node/bin`, so prefix with `PATH="$HOME/.local/node/bin:$PATH"` if `npm` is not found.
- Celadon tokens are `--celadon-light #B4CCBE`, `--celadon #5E8A79`, `--celadon-deep #3A5F52`, `--celadon-wash rgba(94, 138, 121, 0.10)`. `--moss*` tokens are removed, not aliased.
- **`--celadon` (#5E8A79) is never used for text.** Text, links, button fills and the wordmark use `--celadon-deep`.
- Royal blue `--signal #3358C7` is only for signal duty: alerts, hotspots, focus rings, the active tab, the logo dot and highlighted threads.
- Spacing scale: `--space-1: 4px` `--space-2: 8px` `--space-3: 12px` `--space-4: 16px` `--space-5: 24px` `--space-6: 32px` `--space-7: 48px` `--space-8: 64px` `--space-9: 96px`. Any CSS rule you touch uses these.
- Every new motion has a `prefers-reduced-motion` instant equivalent. Use `usePrefersReducedMotion()` from `lib/useMediaQuery`.
- Interactive elements are real `button`/`a` elements with accessible names. Disclosures set `aria-expanded`. Decorative SVG is `aria-hidden="true"`.
- No `window.confirm`/`alert`/`prompt` anywhere.
- All `localStorage` access goes through `lib/storage.ts`.
- Spec 3 items are out of scope: globe arcs, zoom, carousel, article images.
- Do not change backend code, API types or prompts.
- Commit after each task with a conventional message ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Re-running a topic you've starred four times.** Filing a fifth briefing must not silently drop a starred one while an unstarred one exists (Task 7, `fileInto` tests).
2. **Topic names that differ only by case or spacing** ("Red Sea shipping" vs "red sea  shipping") must land on the same thread and count toward the same 4-per-topic cap (Task 7).
3. **A briefing with no tensions, contradictions or historical context** must render cards with no empty tab row, no "Read background" control and no threads (Tasks 5 and 6).
4. **Clearing the archive with storage disabled or full.** The clear must still update the UI, show the error toast that `usePersist` raises, and keep settings and profile (Task 9).
5. **Opening an old briefing link after its briefing was dropped by the cap** still shows the existing `UnsavedBriefing` page, not a crash. This is unchanged behaviour, but the cap makes it more common (Task 7 test).

---

### Task 1: Celadon palette, spacing scale and brand assets

**Files:**
- Modify: `src/styles/tokens.css`, `src/styles/base.css`, `src/components/briefing/story.css`, `src/globe/globe.css`, `src/globe/engine.ts`, `src/components/Contours.tsx`, `src/components/AtlasMark.tsx`, every CSS file referencing `--moss*` (find with `grep -rln -- '--moss' src`)
- Modify: `public/brand/atlas-mark.svg`, `atlas-mark-reversed.svg`, `atlas-lockup.svg`, `atlas-lockup-reversed.svg`, `favicon.svg`. Regenerate `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`, `og-card.png`.
- Modify: `scripts/brand/og-card.html`, `scripts/brand/outline_wordmark.py` (colour constants only)
- Test: `src/components/AtlasMark.test.tsx`, `src/brand.test.ts`, Create: `src/palette.test.ts`

**Interfaces:**
- Produces: the CSS tokens `--celadon-light`, `--celadon`, `--celadon-deep`, `--celadon-wash`, `--space-1`…`--space-9`. `ATLAS_MARK_PALETTES.default = { left: '#B4CCBE', centre: '#5E8A79', right: '#3A5F52', fix: '#3358C7' }`. `ATLAS_MARK_PALETTES.reversed` gets light celadon tints you pick, with `fix: '#8FA9F2'` unchanged.

- [ ] **Step 1: Write the failing tests**

In `AtlasMark.test.tsx`, change the expected fills to `#B4CCBE`, `#5E8A79`, `#3A5F52` and `#3358C7`. Create `src/palette.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

const files = import.meta.glob(['./**/*.{ts,tsx,css}', '!./**/*.test.*'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const MOSS = /3D5A45|6F8A6F|2A3F31|61,\s?90,\s?69|9AAA92|C9D2C0|--moss/i

describe('celadon palette', () => {
  it('leaves no moss colour or token in source', () => {
    const offenders = Object.entries(files).filter(([, src]) => MOSS.test(src)).map(([f]) => f)
    expect(offenders).toEqual([])
  })
  it('defines the celadon tokens and spacing scale', () => {
    const tokens = files['./styles/tokens.css']
    for (const t of ['--celadon-light: #B4CCBE', '--celadon: #5E8A79', '--celadon-deep: #3A5F52', '--space-1: 4px', '--space-9: 96px']) expect(tokens).toContain(t)
  })
})
```

In `brand.test.ts`, add a case asserting that `public/brand/atlas-mark.svg` (imported `?raw`) contains `#5E8A79` and not `#3D5A45`. Update the favicon reversed-colour expectations to the new reversed tints.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/palette.test.ts src/components/AtlasMark.test.tsx src/brand.test.ts`
Expected: FAIL. The offenders list names the moss files, and the fills show the old hex values.

- [ ] **Step 3: Replace the palette**

Make these changes in `tokens.css`:
- Swap the moss tokens for the celadon ones (§3).
- Add the spacing scale.
- Re-tint or remove `--sage`.
- Add `--celadon-press: #2F4E43` for the pressed and hover state of primary buttons.

Rewrite every `var(--moss…)` reference by job:
- text and controls → `--celadon-deep`
- graphics → `--celadon`
- light fills → `--celadon-light`
- tints → `--celadon-wash`

Convert hard-coded moss values (`::selection`, globe land dots in `engine.ts`, `Contours.tsx` stroke, `story.css` node glow) to their celadon equivalents. Update the SVGs and `og-card.html`. Re-render the PNGs:

```bash
cd scripts/brand && ./render.sh ../../public/brand/favicon.svg ../../public/brand/favicon-32.png 32 32 transparent
./render.sh ../../public/brand/favicon.svg ../../public/brand/favicon-16.png 16 16 transparent
./render.sh ../../public/brand/atlas-mark.svg ../../public/brand/apple-touch-icon.png 180 180
./render.sh og-card.html ../../public/brand/og-card.png 1200 630
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run` (the whole suite, since every test should still pass) and `npm run lint`.
Expected: all PASS, and lint is clean.

- [ ] **Step 5: Commit**

`git add -A src public scripts && git commit -m "feat(brand): celadon replaces moss; add spacing scale"`

---

### Task 2: Faceted icon set

**Files:**
- Modify: `src/components/icons.tsx` (replace its contents)
- Create: `src/components/icons.test.tsx`
- Modify: the call sites of `StarIcon`, `ExternalIcon`, `TrashIcon`, `PrintIcon` if their props change (keep the existing names and props)

**Interfaces:**
- Produces: these named exports, each `(props: { size?: number; className?: string }) => JSX.Element`, rendering `<svg viewBox="0 0 24 24" aria-hidden="true">` in `currentColor`:
  - `StarIcon` (extra prop `filled?: boolean`)
  - `ExternalIcon`, `TrashIcon`, `PrintIcon`
  - `NewBriefIcon`, `ExpandIcon` (extra prop `open?: boolean`, which flips it)
  - `TensionIcon`, `DisagreeIcon`
  - `AlertCriticalIcon`, `AlertHighIcon`, `AlertElevatedIcon`
  - `ProfileIcon`, `TimeIcon`, `ReadingIcon`, `DataIcon`
  - `ExportIcon`, `ClearIcon`
- Also export `ICONS: Record<string, (p: IconProps) => JSX.Element>` listing all of them, for the test.

- [ ] **Step 1: Write the failing test**

`icons.test.tsx`: for each entry of `ICONS`, render it at size 20 and assert:
- `svg.getAttribute('viewBox') === '0 0 24 24'`
- `width` and `height` are `'20'`
- `aria-hidden` is `'true'`
- every `path`/`polygon` fill is `currentColor` or `none`
- at least 2 shapes exist (facets)

Also assert that `ICONS` has exactly the 17 names above.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/icons.test.tsx`
Expected: FAIL, because `ICONS` is not exported.

- [ ] **Step 3: Draw the icons**

Follow §10. Each icon is 2 or 3 flat planes, drawn as `polygon` with `fill="currentColor"` and `fill-opacity` stepped between 1, 0.7 and 0.45, echoing the G5 mark's three folds. Stick to whole and half pixel coordinates on the 24 grid so edges stay crisp at 16, 20 and 24 px. There are no outline strokes, except where an icon is unreadable without one (for example, the clock hands in `TimeIcon`).

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/components/icons.test.tsx`
Expected: PASS. Then view the icons at 16 and 24 px in the dev server (`npm run dev`) on any page that uses them, and fix any mushy edges.

- [ ] **Step 5: Commit**

`git commit -am "feat(ui): faceted icon set in the G5 fold style"` (add the test file first).

---

### Task 3: Nav "New brief" button and focus on arrival

**Files:**
- Modify: `src/components/NavBar.tsx`, `src/components/navbar.css`, `src/routes/HomePage.tsx`
- Test: `src/components/NavBar.test.tsx`, Create: `src/lib/useFocusOnArrival.ts` + `src/lib/useFocusOnArrival.test.tsx`

**Interfaces:**
- Consumes: `NewBriefIcon` (Task 2).
- Produces: `useFocusOnArrival(inputId: string): void`. When `useLocation().state?.focusAsk === true`, it focuses `document.getElementById(inputId)` once after mount.

- [ ] **Step 1: Write the failing tests**

In `NavBar.test.tsx`, add:
- `it('offers New brief linking home with focus state')`: there is an `a.nav-new` with text `New brief` and `href="/"`.
- `it('no longer shows the clock')`: `container.querySelector('.nav-clock')` is `null`.

In `useFocusOnArrival.test.tsx`, render a component using the hook inside `MemoryRouter initialEntries={[{ pathname: '/', state: { focusAsk: true } }]}` with `<input id="home-ask" />`. Assert `document.activeElement.id === 'home-ask'`. Without the state, assert it isn't focused.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/NavBar.test.tsx src/lib/useFocusOnArrival.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Make these changes:
- In the nav, replace the clock `Link` with `<Link className="btn btn-primary nav-new" to="/" state={{ focusAsk: true }}><NewBriefIcon size={16} /> New brief</Link>`.
- Remove the `useClock` import if it's now unused.
- Call `useFocusOnArrival('home-ask')` in `HomePage`.
- Style `.nav-new` as a `--celadon-deep` pill.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/components/NavBar.test.tsx src/lib/useFocusOnArrival.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(nav): New brief button replaces the clock"`

---

### Task 4: Compact briefing header and Story first screen

**Files:**
- Modify: `src/routes/BriefingLayout.tsx`, `src/routes/briefing-layout.css`, `src/components/briefing/story.css` (`.story-lead`), `src/routes/SignalsTab.tsx` (plural fix)
- Create: `src/routes/BriefingLayout.test.tsx`, `src/lib/plural.ts` + `src/lib/plural.test.ts`

**Interfaces:**
- Produces: `plural(n: number, one: string, many?: string): string`. It returns, for example, `'1 article'` or `'16 articles'`, with `many` defaulting to `one + 's'`.

- [ ] **Step 1: Write the failing tests**

- `plural.test.ts`: `plural(1, 'article') === '1 article'`, `plural(16, 'article') === '16 articles'`, `plural(0, 'article') === '0 articles'`.
- `BriefingLayout.test.tsx`: seed `localStorage` key `savedBriefingsV2` with `[makeBriefing()]` (from `src/test/fixtures.ts`), then render `<MemoryRouter initialEntries={['/brief/b-1']}><AppStateProvider><Routes><Route path="/brief/:id" element={<BriefingLayout />} /></Routes></AppStateProvider></MemoryRouter>`. Assert:
  - the `h1` text is `red sea shipping`
  - there's no `form` inside `.masthead`
  - there's no `.masthead-kicker` and no `.contours` element
  - `.masthead-meta` contains `214 articles`
  - there are 2 links in `nav.tabs`

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/plural.test.ts src/routes/BriefingLayout.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Make these changes:
- Drop `AskForm`, `Contours`, `useGenerateBriefing` and the kicker from `BriefingLayout`.
- The header is a `.masthead-row` containing the `h1` (about 48 px, `clamp(36px, 4vw, 48px)`) with the meta line right-aligned on the same baseline (`display:flex; align-items:baseline; justify-content:space-between; flex-wrap:wrap`). The tabs go directly below.
- Spacing to the first content is `--space-5`.
- Change `.story-lead` to `align-items: start`.
- Use `plural` for the article counts in `SignalsTab`.
- In `AlertCallout`/`PriorityMark`, replace the square and triangle marks with `AlertCriticalIcon`, `AlertHighIcon` and `AlertElevatedIcon` (Task 2), mapped from `ViewAlert.type` (`urgent`, `warning`, `info`) and dev `priority` (`high`, `medium`, `low`).
- `.briefing.compact` steps the header and story spacing down one notch on the scale.

- [ ] **Step 4: Run them to see them pass, then check the first screen**

Run: `npx vitest run`. Expected: PASS.

Then, with `npm run dev:live` running, use agent-browser at viewport 1470×956 on a generated briefing. Confirm that two alert cards and the "Key developments" label are visible without scrolling, and save a screenshot to the scratchpad.

- [ ] **Step 5: Commit**

`git commit -m "feat(briefing): compact masthead; first screen shows alerts and timeline"`

---

### Task 5: Development cards with folded background and linked tabs

**Files:**
- Modify: `src/components/briefing/DevelopmentCard.tsx`, `src/components/briefing/LinkedCards.tsx`, `src/components/briefing/Timeline.tsx` (render the tabs and drop the right column), `src/components/briefing/story.css`
- Create: `src/components/briefing/LinkedTabs.tsx`, `src/components/briefing/DevelopmentCard.test.tsx`
- Modify: `src/lib/timeline.ts` + `src/lib/timeline.test.ts`

**Interfaces:**
- Consumes: `linkBriefing`, `sortDevelopments` (existing). Icons `ExpandIcon`, `TensionIcon`, `DisagreeIcon` (Task 2).
- Produces:
  - `type LinkRef = { kind: 'tension' | 'contradiction'; i: number; key: string }`, where `key` is `` `${kind}-${i}` `` (this matches today's `LinkedItem.key`).
  - `linksByDevelopment(links: BriefingLinks): Map<number, LinkRef[]>` in `lib/timeline.ts`. It maps development index → its linked items, tensions first and then contradictions, each in source order.
  - `DevelopmentCard` gains props `links: LinkRef[]`, `briefing: Pick<SavedBriefing, 'emergingTensions' | 'contradictions'>`, `openKeys: Set<string>`, `onToggleLink(key: string): void` and `onHoverLink(key: string | null): void`.
  - `TensionCard`/`ContradictionCard` gain a `variant?: 'card' | 'inline'` prop. `inline` drops the outer card chrome and is used inside expanded tabs. The "Also in this briefing" section keeps `card`.

- [ ] **Step 1: Write the failing tests**

- `timeline.test.ts`: `linksByDevelopment(linkBriefing(makeBriefing()))` equals `new Map([[0, [{kind:'tension',i:0,key:'tension-0'},{kind:'contradiction',i:0,key:'contradiction-0'}]], [2, [{kind:'tension',i:1,key:'tension-1'}]]])`.
- `DevelopmentCard.test.tsx`, using fixture dev 0:
  - It renders a `button` named `Read background` with `aria-expanded="false"`. The full `historicalContext` text isn't in a visible `.dev-context-full`. Clicking the button sets `aria-expanded="true"` and shows the full text, and its name becomes `Show less`.
  - Two tab buttons whose text includes `Tension · High` and `Sources disagree · 2 accounts`. Clicking one calls `onToggleLink('tension-0')`.
  - With `openKeys = new Set(['contradiction-0'])`, `Account A` and `Account B` render inside the card.
  - For a dev with `historicalContext: ''` and `links: []`, there's no `Read background` button and no `.dev-links` element (Review Focus 3).
  - With `showContext={false}`, there's no background teaser at all.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/timeline.test.ts src/components/briefing/DevelopmentCard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

These are the rules from §6.3:
- **Teaser:** a one-line `text-overflow: ellipsis` clip of the background paragraph, plus the toggle button. Folded is the default and state is local.
- **Tab row:** sits under a hairline. Each tab shows the kind icon, a mono label (`TENSION · HIGH`, `SOURCES DISAGREE · 2 ACCOUNTS`) and a title, which is `tension.actors` for a tension or `contradiction.topic` for a disagreement. Each tab sets `aria-expanded` and fires `onHoverLink` on mouseenter, mouseleave, focus and blur.
- **Expanded tabs** render below the row in `variant="inline"`. Disagreement accounts are side by side, stacking below 640 px.
- **Timeline:** the grid becomes `84px 28px minmax(0,1fr)`. Remove the `.t-links` column and the `byRow` placement. `Timeline` owns `openKeys` and the hovered key as state and passes them down. Keep "Also in this briefing" for unlinked items.
- **Stretch fix:** give `.dev` `align-self: start`. Its internal gap is `--space-3`.
- **Remove** the old `.branches` SVG and its layout code here. Keep `.spine`, `--fill` and node `.on` logic exactly as they are.
- **Print:** in `@media print`, show the full background and every linked item expanded, and hide the toggle buttons.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run`. Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(story): inline folded background and linked tabs; remove right column"`

---

### Task 6: Loose-thread strings with scroll draw-in and highlight

**Files:**
- Create: `src/lib/threads.ts`, `src/lib/threads.test.ts`
- Modify: `src/components/briefing/Timeline.tsx`, `src/components/briefing/story.css`

**Interfaces:**
- Consumes: `LinkRef` and `linksByDevelopment` (Task 5), `TimelineEntry` (existing).
- Produces:
  - `interface ThreadSpec { key: string; linkKey: string; from: number; to: number; lane: number }`. `from` and `to` are development indexes, `from` is earlier in timeline order, `key` is `` `${linkKey}:${from}-${to}` ``, and `lane` is the 0-based offset for parallel threads between the same two developments.
  - `buildThreads(links: BriefingLinks, order: TimelineEntry[]): ThreadSpec[]`. For each tension or contradiction linked to two or more developments, it chains them in timeline order (consecutive pairs).
  - `threadPath(x: number, y1: number, y2: number, lane: number, seed: string): string`. It returns an SVG path `d` for a soft arc bulging left of `x` from `y1` to `y2`, with a deterministic wobble seeded by `seed`.

- [ ] **Step 1: Write the failing tests**

`threads.test.ts`:
- `buildThreads(linkBriefing(makeBriefing()), sortDevelopments(makeBriefing().keyDevelopments))` equals `[]` (the fixture links each item to one development only).
- With tension 0 edited to mention `Red Sea` (it then links devs 0 and 1, as the existing `timeline.test.ts` case shows), the result has one thread, `{ linkKey: 'tension-0', from: <the earlier of 0 and 1 in order>, to: <the later>, lane: 0 }`.
- An item linked to three developments yields two threads chained in timeline order.
- Two items both linking the same pair yield lanes 0 and 1.
- `threadPath(100, 10, 200, 0, 'a')` is deterministic: the same output on repeated calls, a different output for seed `'b'`. It starts with `M100 10` and ends at `100 200`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/threads.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the threads and draw them**

In `threads.ts`, the wobble is a small string hash (FNV-1a is fine) driving offsets of at most 6 px on the two cubic control points. The bulge depth is `28 + lane * 8` px, capped so it stays inside the 112 px gutter. `Timeline` draws threads into a gutter SVG (`.threads`, `aria-hidden`), from each card's left edge at `min(44, height/2)`:
- Each thread is a track path at `stroke: var(--celadon)` with `opacity: .55` and `stroke-width: 1.4`.
- A knot is a 3 px circle where the thread meets each card.
- Draw-in on scroll reuses today's mechanism: `strokeDasharray`/`strokeDashoffset` driven when the `from` card's top crosses `READING_LINE`. Threads already passed on load appear drawn with `transition: none`.
- **Highlight:** threads whose `linkKey` is hovered or in `openKeys` get class `lit` (`stroke: var(--signal)`, `stroke-width: 1.7`, opacity 1). When any thread is lit, the others get `dim` (opacity .25).
- With reduced motion, there's no dash animation and highlight transitions are instant.
- Hide `.threads` in the existing single-column media query and in print.

- [ ] **Step 4: Run the tests to see them pass, then check by eye**

Run: `npx vitest run`. Expected: PASS.

In the dev server, on a briefing where a tension links two or more developments, confirm these four things:
- threads draw as you scroll
- hovering a tab turns its thread blue and dims the others
- the spine progress fill still fills as before
- with macOS "Reduce motion" on, threads appear instantly

- [ ] **Step 5: Commit**

`git commit -m "feat(story): loose-thread strings between linked developments"`

---

### Task 7: Archive filing policy and topic threads (logic)

**Files:**
- Create: `src/lib/archive.ts`, `src/lib/archive.test.ts`
- Modify: `src/state/AppState.tsx`, `src/state/context.ts`, `src/state/AppState.test.tsx`

**Interfaces:**
- Produces:
  - `topicKey(area: string): string`: lower-cases, trims and collapses whitespace.
  - `PER_TOPIC_LIMIT = 4`, `ARCHIVE_LIMIT = 24`.
  - `fileInto(saved: SavedBriefing[], briefing: SavedBriefing, starred: string[]): SavedBriefing[]`. It puts the new briefing first, enforces the per-topic cap and then the total cap, and when trimming drops the oldest unstarred briefing first, falling back to the oldest overall.
  - `interface TopicThread { key: string; area: string; briefings: SavedBriefing[] }`. `briefings` are oldest to newest, and `area` is the newest briefing's spelling.
  - `groupThreads(saved: SavedBriefing[]): TopicThread[]`, sorted by newest briefing first.
  - `hasHighAlert(b: SavedBriefing): boolean`: true if any alert's `type` is `'urgent'` or `'warning'`.
  - On `AppStateValue`: `clearArchive: () => void` empties `saved` and `starred` only.

- [ ] **Step 1: Write the failing tests**

`archive.test.ts`, using `makeBriefing({ id, area, generatedAt })`:
- `topicKey('  Red Sea   Shipping ') === 'red sea shipping'`.
- A fifth "Red Sea shipping" briefing with no stars drops the oldest of that topic and keeps 4.
- With the oldest two starred, the fifth drops the oldest *unstarred* one (Review Focus 1).
- With all four starred, the fifth drops the oldest.
- `'Red Sea shipping'` and `'red sea  shipping'` count toward one cap (Review Focus 2).
- A 25th briefing across many topics drops the oldest unstarred overall.
- `groupThreads` groups case- and whitespace-insensitively, orders each thread oldest to newest, and sorts threads by their newest briefing.
- `hasHighAlert` is true for fixture alerts (critical, which maps to `'urgent'`).

`AppState.test.tsx`:
- Filing two same-topic briefings keeps both (replacing the old "replaces same-topic entry" expectation).
- `clearArchive()` empties `saved` and `starred` but leaves `settings` and `profile`.
- A briefing dropped by the cap no longer resolves via `findBriefing` (Review Focus 5). The route then renders `UnsavedBriefing`, as it does today.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/archive.test.ts src/state/AppState.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`fileBriefing` becomes `setSaved((prev) => fileInto(prev, briefing, starredRef.current))`, with `starredRef` kept in sync with `starred` via an effect, so the updater stays pure. Delete the old `ARCHIVE_LIMIT` constant from `AppState.tsx` and import it from `lib/archive.ts`.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run`. Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(archive): keep 4 per topic / 24 total, starred kept first; topic threads"`

---

### Task 8: Archive page UI and painted footer

These two ship together because the archive's empty state reuses the footer painting asset.

**Files:**
- Create: `src/components/Footer.tsx`, `src/components/footer.css`, `src/components/Footer.test.tsx`, `public/brand/mountains.webp`, `public/brand/mountains@2x.webp`, `public/brand/mountains.jpg`
- Modify: `src/App.tsx` (swap in `<Footer />`), `src/app.css` (remove the old `.footer`), `src/routes/ArchivePage.tsx` + its CSS, `brandkit/prompts.md`
- Create: `src/routes/ArchivePage.test.tsx`

**Interfaces:**
- Consumes: `groupThreads`, `hasHighAlert`, `topicKey` (Task 7). `AtlasMark` (Task 1). Icons (Task 2).
- Produces: `Footer(): JSX.Element` and `MountainBand({ height }: { height: 'footer' | 'empty' }): JSX.Element`, both in `Footer.tsx`. The band is the `<picture>` with WebP 1x/2x, a JPEG fallback, `alt=""` and `loading="lazy"`.

- [ ] **Step 1: Prepare the image**

Source: `~/Downloads/image_7eb343f5.jpg` (1584×672). Crop out the bottom-right Gemini sparkle and the sky:
- `sips -c 300 1584 --cropOffset 290 0 <src> --out /tmp/band.jpg`. Check visually that the sparkle (at about x 1525, y 610) is gone. If it isn't, reduce the crop height.
- Produce `mountains.jpg` (quality 80).
- Produce `mountains@2x.webp` at native width and `mountains.webp` at 792 px wide with `sips -s format webp`. If sips can't write WebP, ship the JPEG only and note it in the commit message.

Add a "Footer painting" section to `brandkit/prompts.md` recording:
- the source: the owner's Nano Banana generation
- the prompt from the 2026-10-19 brainstorm, copied from §7's context
- the crop

- [ ] **Step 2: Write the failing tests**

`Footer.test.tsx` (render inside `MemoryRouter`):
- Column headings `Read`, `You`, `Project`.
- Links: `New brief` → `/`, `Archive` → `/archive`, `Starred` → `/archive?filter=starred`, `Settings` → `/settings`, `Time zone` → `/settings#time`, and `GitHub` → `https://github.com/cwlau77/atlas_brief` with `target="_blank"` and `rel` containing `noopener`.
- An `a[aria-label="Atlas home"]` containing the mark.
- The note text "Analysis is model-written. Check it against the cited sources."
- The `picture img` has `alt=""`.

`ArchivePage.test.tsx`: seed 3 briefings, 2 sharing a topic with different case, then check:
- 2 thread rows.
- The shared row has 2 bead links whose accessible names include the topic and date, with `href`s `/brief/<id>`.
- `?filter=starred` with one starred briefing shows 1 row with 1 bead.
- With an empty archive, the text "No threads yet" and a `Start a brief` link appear.
- The page states "Up to 4 briefings per topic and 24 in total are kept in this browser."
- After clicking "Compare two" and selecting two beads, `Side by side` appears.

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run src/components/Footer.test.tsx src/routes/ArchivePage.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implement**

**Footer, per §7.** Columns, then the edge-to-edge lockup (`font-size: clamp(120px, 15vw, 260px)`, `--celadon-deep`, mark at 0.92em with a 0.28em gap, a soft `--celadon-wash` radial glow), then `MountainBand` fading from paper. The footer bottom line reads "© 2026 Atlas" and "13 sources · last 24 hours" in light text. Check AA contrast against the band and add a bottom scrim gradient if it fails.

**Archive, per §8:**
- The filter is read and written with `useSearchParams`.
- Each thread row is a paper card: name, count and since-date, then an SVG string of beads (radius `5 + min(5, articles/5)`, `--signal` if `hasHighAlert`, else `--celadon`, with a paper ring on the newest), then the latest article count.
- Beads are `Link`s. On hover or focus, a popover shows the issued time plus Star, Open, Print and Delete buttons (the existing handlers).
- "Compare two" toggles selection mode, where beads become toggle buttons (`aria-pressed`) feeding the existing `selected` and `CompareColumn`.
- The empty state is `MountainBand height="empty"`, the "No threads yet" heading and the Start a brief link.
- The page header follows §11: title with right-aligned meta (the thread count and storage note) on one row, then `--space-5` to the first content.

Hide `MountainBand` in `@media print`.

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run`. Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat(ui): painted footer and topic-thread archive"`

---

### Task 9: Settings layout and Your data

**Files:**
- Modify: `src/routes/SettingsPage.tsx`, `src/routes/settings.css`, `src/lib/storage.ts`, `src/lib/storage.test.ts`
- Create: `src/components/ConfirmDialog.tsx`, `src/routes/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: `clearArchive` (Task 7). Icons (Task 2).
- Produces:
  - In `lib/storage.ts`: `storageSummary(): { briefings: number; starred: number; bytes: number }`. Here `bytes` is the summed `length * 2` of the four `KEYS` raw strings, and every read is try/catch guarded.
  - `exportBlob(): Blob`: `application/json` containing `{ exportedAt, saved, starred, settings, profile }`.
  - `ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel })` uses a native `<dialog>` opened with `showModal()`. It's not `window.confirm`.

- [ ] **Step 1: Write the failing tests**

`storage.test.ts`:
- With 2 saved and 1 starred seeded, `storageSummary()` returns `{ briefings: 2, starred: 1, bytes: >0 }`.
- With `localStorage.getItem` throwing, it returns zeros (Review Focus 4).
- `exportBlob()` is JSON whose keys are exactly `exportedAt, saved, starred, settings, profile`.

`SettingsPage.test.tsx`:
- The section index has links `Profile`, `Time`, `Reading` and `Your data` to `#profile`, `#time`, `#reading` and `#data`.
- The section `#time` exists.
- The profile header shows initials from the saved profile.
- The "Edit profile" button reveals the 4 inputs.
- The "Your data" section shows `2 briefings · 1 starred`.
- Clicking "Clear archive" opens a dialog. Cancel keeps the data. Confirm calls through to an empty archive, shows a toast, and keeps settings.

In jsdom, stub `HTMLDialogElement.prototype.showModal` and `close` if they're missing.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/storage.test.ts src/routes/SettingsPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Follow §9:
- Use the page width, with a two-column grid of a 180 px sticky index and the sections.
- Below 820 px, the index becomes a horizontal row.
- The index highlights the section in view via `IntersectionObserver`, guarded when that API is absent.
- Rename "Preferences" to "Reading".
- The page header follows §11, the same pattern as Archive.
- Each index link carries its icon (`ProfileIcon`, `TimeIcon`, `ReadingIcon`, `DataIcon`).
- Export uses `URL.createObjectURL(exportBlob())` and a temporary `<a download="atlas-data.json">`.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run`. Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(settings): section index, profile header, Your data with export and clear"`

---

### Task 10: Whole-site verification and docs

**Files:**
- Modify: `frontend/README.md` (design-system paragraph: celadon instead of moss, royal blue as the signal colour; drop the space-in-path vitest caveat), `docs/BACKLOG.md` (mark "Rebrand to Atlas" and "Clear way back to Home" done; add spec 3 as next up), `.claude/launch.json` (the path to `~/Developer/atlas/frontend`), the root `CLAUDE.md` stale-spots section if it's committed by then

- [ ] **Step 1: Run the full checks**

Run, in `frontend/`: `npm run build && npm run lint && npx vitest run`
Expected: all succeed with 0 failures.

- [ ] **Step 2: Manual pass at 1470×956 and 390×844**

With `npm run dev:live` running, use agent-browser to screenshot Home, a generated briefing's Story and Signals tabs, Archive (empty and with at least 2 same-topic briefings) and Settings at both sizes. Check against §14 "Done when":
- no card gap is over 32 px
- the footer shows on every page, with no watermark
- threads behave as described
- phones show no overflow or horizontal scroll

Fix any regressions before continuing.

- [ ] **Step 3: Update the docs and commit**

`git commit -am "docs: celadon design notes, backlog and launch config refreshed"`
