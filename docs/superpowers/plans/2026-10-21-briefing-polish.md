# Briefing Page Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the briefing page feel solid: one control system, whole-row tension index targets with a visible pin, AI-stated tension-to-development links, a noticeable "From the archive", and no dead-feeling clicks.

**Architecture:** The backend adds one Haiku linking call (`backend/synthesis/links.py`) that runs once the developments and signals sections exist, overlapping historical context and Commons. It writes `related_developments` onto tensions and contradictions. The frontend carries those links through `normalize.ts` into `linkBriefing`. `globe/follow.ts` replaces the touch-only `tappedDev` with a `{ dev, seq }` request that region tags (on every device) and `scrollToStory` share. A shared `TextButton` plus one chip style replaces the four text-button variants.

**Tech Stack:** FastAPI + Pydantic + pytest-asyncio (backend), React + TypeScript + Vitest + Testing Library (frontend), plain CSS with tokens from `frontend/src/styles/tokens.css`.

**Spec:** `docs/superpowers/specs/2026-10-21-briefing-polish-design.md`. It amends `docs/superpowers/specs/2026-10-20-briefing-page-design.md`, which still holds for anything not listed in it.

## Global Constraints

- Reshape, don't rebuild: evolve the existing components; no wholesale replacement.
- Tokens come only from `frontend/src/styles/tokens.css`. Ultramarine `--accent` is the single highlight. Red and amber are for heat only.
- Motion lives only under `@media (prefers-reduced-motion: no-preference)`.
- Every control on the briefing page: `:focus-visible` gives `outline: 2px solid var(--accent); outline-offset: 2px`. Control transitions use `--dur-quick`. Exceptions: card dim and lit stay on `--dur-mid`, and the glyph rotation is 250ms ease.
- Interactive targets have min-height 24px (WCAG 2.5.8).
- Labels are sentence case: "More", "Less", "Show 4 more", "Read background", "Show less".
- No change to page order, the timeline, the globe engine, images or Read first content. Other pages keep their controls; `.btn-primary` is untouched.
- Dwell 250ms and leave 400ms in `follow.ts` stay. A pin moves the globe at once.
- Backend: the link call never fails the briefing. Its budget is 6s, applied to that call only.
- Python: `/Users/camlau/Developer/atlas/.venv/bin/python` (this worktree has no `.venv`). Run Bash commands one at a time, never chained with `&&` or `;`.

## Review Focus

1. **Pin and jump in the same click.** Clicking a Top stories card while a row is pinned clears the pin (document click) and issues a jump request in the same render. The jump must win. Test in Task 3: `a request that arrives with a pin change wins`.
2. **Same tag twice.** Clicking a region tag, hovering another card, then clicking the first tag again must zoom again. Test in Task 3: `re-requesting the same dev after it was retired emits it again`.
3. **Model returns garbage links.** Indexes that are bools, strings, negative or out of range; wrong-length lists; inner non-lists. Each is dropped or set to `None`, and nothing raises. Tests in Task 1: `test_parse_links_*`.
4. **Old saved briefings.** A briefing in localStorage from before this change has no `relatedDevelopments`. It must still link by region and render. Test in Task 2: `withDefaults fills relatedDevelopments with null`.
5. **Double-click on a row.** A quick double-click leaves the row pinned, not unpinned. A keyboard Enter (`detail === 0`) still toggles. Test in Task 5: `ignores the second click of a double-click`.

---

### Task 1: Backend tension linking

**Files:**
- Modify: `backend/models.py` (`Tension`, `Contradiction`)
- Create: `backend/synthesis/links.py`
- Modify: `backend/synthesis/briefing.py` (`synthesize_briefing`)
- Create: `backend/tests/test_links.py`
- Modify: `backend/tests/test_synthesis.py`

**Interfaces:**
- Produces: `Tension.related_developments: Optional[list[int]] = None` and `Contradiction.related_developments: Optional[list[int]] = None`. These are zero-based indexes into `Briefing.key_developments`, serialized as `related_developments` in the `/briefing` JSON.
- Produces, in `backend/synthesis/links.py`:
  - `LINK_SYSTEM_PROMPT: str`
  - `LINK_BUDGET_S: float = 6.0`
  - `parse_links(data: dict, n_devs: int, n_tensions: int, n_contradictions: int) -> tuple[list[list[int] | None], list[list[int] | None]]`. It always returns lists of length `n_tensions` and `n_contradictions`.
  - `async link_signals(devs: list[KeyDevelopment], tensions: list[Tension], contradictions: list[Contradiction]) -> tuple[list[list[int] | None], list[list[int] | None]]`. It never raises. On a skip or a failure it returns all-`None` lists of the right lengths.

- [ ] **Step 1: Write failing parser tests in `backend/tests/test_links.py`**

```python
from backend.synthesis.links import parse_links

def test_parse_links_clamps_and_dedupes():
    data = {"tensions": [[0, 5, 0, -1, True, "1", 1]], "contradictions": [[2]]}
    assert parse_links(data, n_devs=3, n_tensions=1, n_contradictions=1) == ([[0, 1]], [[2]])

def test_parse_links_wrong_length_or_shape_leaves_none():
    data = {"tensions": [[0]], "contradictions": "x"}
    assert parse_links(data, 3, 2, 1) == ([None, None], [None])

def test_parse_links_inner_non_list_is_none_and_empty_is_kept():
    assert parse_links({"tensions": [[], "0"], "contradictions": []}, 3, 2, 0) == ([[], None], [])

def test_parse_links_missing_key_is_all_none():
    assert parse_links({}, 3, 1, 2) == ([None], [None, None])
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `/Users/camlau/Developer/atlas/.venv/bin/python -m pytest backend/tests/test_links.py -v`
Expected: FAIL with `ModuleNotFoundError: backend.synthesis.links`.

- [ ] **Step 3: Add the model fields and implement `parse_links`**

Add `related_developments: Optional[list[int]] = None` to `Tension` and `Contradiction`. In `parse_links`, keep only `int` values that are not `bool` and fall in `0 <= i < n_devs`. Dedupe while preserving order.

- [ ] **Step 4: Run the parser tests and confirm they pass**

Same command. Expected: 4 passed.

- [ ] **Step 5: Write failing `link_signals` tests in `test_links.py`**

Fake `backend.llm.complete` with `monkeypatch.setattr(llm, "complete", fake)`, and set `settings.anthropic_api_key = "test-key"`. Build models directly (`KeyDevelopment(headline="H0", summary="S0", regions=["US"], sources=[])` and so on).

- `test_link_signals_sends_both_sides_and_uses_context_model`: the fake records kwargs and returns `'{"tensions": [[1]], "contradictions": [[]]}'`. Assert `kwargs["model"] == settings.context_model` and `kwargs["system"] == LINK_SYSTEM_PROMPT`. Assert the user message contains `"H0"`, `"H1"`, the tension description and the contradiction topic. Assert the result is `([[1]], [[]])`.
- `test_link_signals_skipped_without_signals`: tensions and contradictions are both empty. The fake fails the test if called. The result is `([], [])`.
- `test_link_signals_skipped_without_key`: `anthropic_api_key = None`, one tension. The fake is not called. The result is `([None], [])`.
- `test_link_signals_timeout_returns_none`: `monkeypatch.setattr(links, "LINK_BUDGET_S", 0.05)`, and the fake does `await asyncio.sleep(1)`. The result is all-`None`, and `caplog` holds a WARNING from logger `briefing.synthesis`.
- `test_link_signals_bad_json_or_error_returns_none`: parametrize the fake over returning `"not json"` and raising `RuntimeError`. The result is all-`None`.

- [ ] **Step 6: Run them and confirm they fail**

Run: `/Users/camlau/Developer/atlas/.venv/bin/python -m pytest backend/tests/test_links.py -v`
Expected: the new tests FAIL (`link_signals` is not defined).

- [ ] **Step 7: Implement `link_signals`**

- Skip with no API key, with no devs, or with no tensions and no contradictions.
- Make one `llm.complete(model=settings.context_model, system=LINK_SYSTEM_PROMPT, messages=[...], max_tokens=600)` wrapped in `asyncio.wait_for(..., LINK_BUDGET_S)`. Read the module attribute at call time so tests can patch it.
- The user message lists developments as `[i] headline — summary (regions: ...)` and tensions and contradictions as `[i] actors/topic — description/accounts`. Mark them as data, not instructions.
- `LINK_SYSTEM_PROMPT` asks for exactly `{"tensions": [[dev indexes]], "contradictions": [[dev indexes]]}`, one inner list per item in order. Link a development only when the item is directly about it, and leave a list empty when nothing fits. You choose the wording. Do not put the quoted strings `"key_developments"`, `"emerging_tensions"` or `"priority_alerts"` in the prompt: `test_synthesis._section_of` routes fake replies on them.
- Parse with `extract_json`, then `parse_links`. On any exception, log `logger.warning("signal linking failed: %s", type(exc).__name__)` on `logging.getLogger("briefing.synthesis")` and return all-`None`.

- [ ] **Step 8: Run `test_links.py` and confirm it passes**

Expected: all passed.

- [ ] **Step 9: Write failing wiring tests in `backend/tests/test_synthesis.py`**

Reuse `SECTION_REPLIES`, `_section_of` and `_keyed`. The fake checks `kwargs["system"] == LINK_SYSTEM_PROMPT` first.

- `test_tension_links_reach_the_briefing`: the link reply is `'{"tensions": [[0]], "contradictions": [[]]}'`. Assert `b.emerging_tensions[0].related_developments == [0]` and `b.contradictions[0].related_developments == []`.
- `test_linking_starts_before_context_finishes`: context replies wait on an `asyncio.Event` that the link call sets, with `wait_for(..., timeout=2)`. The briefing completes, so the link call ran in parallel with context and not after it.
- `test_link_failure_leaves_none_and_briefing_returns`: the link call raises `RuntimeError`. Assert the briefing returns and `related_developments is None` on every tension and contradiction.
- `test_fallback_briefing_has_no_links`: with demo mode and no key, every tension's `related_developments is None`.

- [ ] **Step 10: Run them and confirm they fail**

Run: `/Users/camlau/Developer/atlas/.venv/bin/python -m pytest backend/tests/test_synthesis.py -v`
Expected: the new wiring tests FAIL. The existing tests still pass.

- [ ] **Step 11: Wire `link_signals` into `synthesize_briefing`**

Start signals as `signals_task = asyncio.create_task(_optional_section("signals", ...))`. Inside `developments()`, after the developments section is parsed, gather three things: `enrich_with_historical_context(partial)`, `commons_candidates(...)`, and a coroutine that awaits `signals_task`, builds tensions and contradictions with `briefing_from_data(signals, focus, articles)`, and calls `link_signals`. The top-level gather awaits `developments()`, `signals_task` and alerts. After `briefing_from_data({**signals, **alerts}, ...)`, zip the returned link lists onto `briefing.emerging_tensions` and `briefing.contradictions`.

- [ ] **Step 12: Run the whole backend suite**

Run: `/Users/camlau/Developer/atlas/.venv/bin/python -m pytest backend/tests -v`
Expected: all passed.

- [ ] **Step 13: Commit**

```bash
git add backend/models.py backend/synthesis/links.py backend/synthesis/briefing.py backend/tests/test_links.py backend/tests/test_synthesis.py
git commit -m "feat(synthesis): link tensions to developments with one Haiku call"
```

---

### Task 2: Frontend carries and prefers the AI links

**Files:**
- Modify: `frontend/src/lib/types.ts` (`Tension`, `Contradiction`)
- Modify: `frontend/src/lib/normalize.ts`
- Modify: `frontend/src/lib/timeline.ts` (`linkBriefing`)
- Test: `frontend/src/lib/normalize.test.ts`, `frontend/src/lib/timeline.test.ts`
- Modify as needed: `frontend/src/test/fixtures.ts` (add `relatedDevelopments: null` so fixtures type-check)

**Interfaces:**
- Consumes: `related_developments?: number[] | null` on API tensions and contradictions (Task 1).
- Produces: `ViewTension.relatedDevelopments: number[] | null`, plus `ViewContradiction`: `Omit<Contradiction, 'related_developments'> & { relatedDevelopments: number[] | null }`, used for `SavedBriefing.contradictions: ViewContradiction[]`. `linkBriefing`'s signature is unchanged.

- [ ] **Step 1: Write failing tests**

In `normalize.test.ts`:
- `carries related_developments as relatedDevelopments`: API tension `related_developments: [1, 0]` becomes `[1, 0]`. Contradiction `related_developments: []` becomes `[]`. A missing field becomes `null` on both.
- `withDefaults fills relatedDevelopments with null`: a saved briefing whose tension and contradiction objects lack the field gets `relatedDevelopments === null` on both.

In `timeline.test.ts` (`linkBriefing`):
- `prefers explicit links over region matching`: dev 0 has regions `['United States']`, and the tension text says "United States" with `relatedDevelopments: [1]`. Result: `tensions[0]` is `[1]`.
- `respects an explicit empty list`: same, with `relatedDevelopments: []`. Result: `[]`.
- `drops out-of-range and duplicate explicit indexes`: `[2, 0, 0, -1, 9]` with 3 devs gives `[2, 0]`.
- `falls back to region matching when null`: `relatedDevelopments: null` gives today's region result. Cover a contradiction too.

- [ ] **Step 2: Run them and confirm they fail**

Run (from `frontend/`): `npx vitest run src/lib/normalize.test.ts src/lib/timeline.test.ts`
Expected: the new tests FAIL.

- [ ] **Step 3: Implement**

- Add `related_developments?: number[] | null` to both API types.
- `normalizeBriefing` maps it to `relatedDevelopments` (`?? null`) on tensions, and maps contradictions to `ViewContradiction`, dropping the snake-case key.
- `withDefaults` adds `relatedDevelopments: x.relatedDevelopments ?? null` for both lists.
- `linkBriefing` uses explicit links when they are non-null: integer, in range, deduped, in their given order. Otherwise it region-matches as now. Update the file's header comment to say links come from the briefing first and region names second.

- [ ] **Step 4: Run all frontend tests and confirm they pass**

Run: `npx vitest run`, then `npx tsc -b`
Expected: all pass with no type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib frontend/src/test/fixtures.ts
git commit -m "feat(story): link tensions by the briefing's related_developments, region names as fallback"
```

---

### Task 3: One-off globe requests (region tags on desktop, jumps that don't freeze)

**Files:**
- Modify: `frontend/src/globe/follow.ts`, `frontend/src/globe/follow.test.ts`
- Modify: `frontend/src/routes/StoryTab.tsx`, `frontend/src/routes/StoryTab.test.tsx`
- Modify: `frontend/src/components/briefing/DevelopmentCard.tsx`, `DevelopmentCard.test.tsx`

**Interfaces:**
- Produces: `export type FollowRequest = { dev: number; seq: number } | null`. `FollowInput.tappedDev` is replaced by `request: FollowRequest`, and every other field stays. Task 5 does not touch this.

Rules (spec §5):
- On every device, a non-retired request is the card target. It beats focus and hover.
- A request is retired, by remembering its `seq`, in three cases: when a pin or preview changes in an update where the request's `seq` did not change; on desktop, when `hoveredDev` changes to a non-null dev other than `request.dev`; and when the carousel opens. For the carousel, StoryTab sets the request to `null`, as today.
- `hoveredDev` becoming `null` does not retire it.
- A new `seq` is never retired by the update that brings it.
- Touch mode still ignores hover.

- [ ] **Step 1: Rewrite the tap tests in `follow.test.ts` and add new ones**

Rename `tappedDev` to `request` in `IDLE` and in the existing touch tests (use `request: { dev: 1, seq: 1 }`). Add these under `describe('createFollow')`:
- `a desktop request emits at once and beats focus and hover`: `set({ hoveredDev: 0, focusedDev: 0 })`, advance 300ms, then `set({ request: { dev: 2, seq: 1 } })`. The last target is `one(2)` with no timer advance.
- `leaving the card keeps the request`: after a request for dev 2, `set({ hoveredDev: null })` and advance 2000ms. The last target is still `one(2)`.
- `hovering a different card retires the request`: request dev 2, then `set({ hoveredDev: 1 })`, advance 250ms. The last target is `one(1)`.
- `hovering the requested card keeps it`: request dev 2 while `hoveredDev: 2`. Advancing 2000ms leaves `one(2)` as the last target.
- `re-requesting the same dev after it was retired emits it again`: request `{2,1}`, hover 1 for 250ms, then request `{2,2}`. The last target is `one(2)`.
- `a pin change retires the request`: request dev 2, then `set({ pinnedItem: 'tension-1' })`. The last target is `one(1)`.
- `a request that arrives with a pin change wins`: with `pinnedItem: 'tension-1'` set, `set({ pinnedItem: null, request: { dev: 2, seq: 1 } })`. The last target is `one(2)`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/globe/follow.test.ts`
Expected: FAIL (type errors or wrong targets).

- [ ] **Step 3: Implement the request in `follow.ts`**

Replace `staleTap` with `staleSeq` (`-1` is none). In `compute`, `card = request ?? (touch ? null : focusedDev ?? dwelledHover)`, where `request` is `input.request` unless its `seq === staleSeq`. Update the header comment.

- [ ] **Step 4: Run follow tests and confirm they pass**

Same command. Expected: PASS.

- [ ] **Step 5: Write failing component tests**

`DevelopmentCard.test.tsx`:
- `focus moved onto the card itself does not count as reader focus`: `card.focus()` on the article (give it `tabIndex={-1}` in the test via `setAttribute`). `onFocusChange` is not called with `true`.
- `keyboard focus on a chip still counts`: focusing a region tag button calls `onFocusChange(true)`. If this test already exists, keep it.
- `region tag click calls onRegionTap on desktop`: no `touch` dependency in the card.

`StoryTab.test.tsx`:
- `a story jump removes the tabindex it added once the card loses focus`: trigger the Top stories open for dev 0. The `#dev-0` article has `tabindex="-1"` and is focused. Blur it (focus another button), and the article no longer has a `tabindex` attribute.

- [ ] **Step 6: Run them and confirm they fail**

Run: `npx vitest run src/components/briefing/DevelopmentCard.test.tsx src/routes/StoryTab.test.tsx`
Expected: the new tests FAIL.

- [ ] **Step 7: Implement in `DevelopmentCard.tsx` and `StoryTab.tsx`**

- `DevelopmentCard`: `onFocus` counts only keyboard focus on a descendant (`!byPointer && e.target !== e.currentTarget`). Update the comment.
- `StoryTab`:
  - Replace `tappedDev` with `const [request, setRequest] = useState<FollowRequest>(null)` plus a `seq` ref. Add `requestDev(dev)` that sets `{ dev, seq: ++seqRef.current }`.
  - `onTagTap` keeps the touch-only scroll-into-view and then calls `requestDev(dev)` on every device.
  - `scrollToStory` parses the dev index from `anchorId` (`dev-N`) and calls `requestDev`. If it added `tabindex`, it registers a one-time `blur` listener (`{ once: true }`) that removes the attribute.
  - Delete the effect that clears the tap on `[pinned, previewed]`, since follow retires it now. Keep `if (carouselOpen) setRequest(null)`.
  - Pass `request` in `followRef.current?.update(...)` and its deps. Update the follow comment above `touch`.

- [ ] **Step 8: Run all frontend tests, types and lint**

Run: `npx vitest run`, then `npx tsc -b`, then `npm run lint`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/globe frontend/src/routes/StoryTab.tsx frontend/src/routes/StoryTab.test.tsx frontend/src/components/briefing/DevelopmentCard.tsx frontend/src/components/briefing/DevelopmentCard.test.tsx
git commit -m "fix(story): region tags zoom the globe on desktop; story jumps no longer hold it"
```

---

### Task 4: Control system A and "From the archive"

**Files:**
- Modify: `frontend/src/components/icons.tsx` (`PlusIcon`), `frontend/src/components/icons.test.tsx`
- Create: `frontend/src/components/briefing/TextButton.tsx`
- Modify: `frontend/src/components/briefing/AlertCallout.tsx`, `DevelopmentCard.tsx`, `TensionIndex.tsx` (the More/Less and "Show N more" controls only)
- Modify: `frontend/src/components/briefing/story.css`, `storyCss.test.ts`
- Modify as needed: `AlertCallout.test.tsx`, `DevelopmentCard.test.tsx`, `TensionIndex.test.tsx`, `Timeline.test.tsx` (selectors and labels)

**Interfaces:**
- Produces:
  - `PlusIcon({ size, className, open }: IconProps & { open?: boolean })`. When `open`, it draws only the horizontal stroke (a minus). The default stays a plus, so `.btn-primary` is unchanged.
  - `TextButton(props: ButtonHTMLAttributes<HTMLButtonElement> & { open?: boolean })` renders `<button type="button" className="text-btn ...">{children}<PlusIcon size={10} className="text-btn-glyph" open={open} /></button>`, passing other props through (`aria-expanded`, `aria-controls`, `aria-label`, `onClick`, an extra `className`).
- Class names that Task 5 relies on: `.text-btn` (any control), `.index-more` and `.index-show` (kept as extra classes for layout only), `.chip`.

CSS (in `story.css`; values from spec §1):
- `.text-btn`: inline-flex, centre-aligned, `gap: 6px`, `min-height: 24px`, `padding: 0`, no border, no background, IBM Plex 500 at `0.875rem`, `color: var(--ink)`, no underline. Hover: `color: var(--accent)`, and `.text-btn:not([aria-expanded="true"]):hover .text-btn-glyph { transform: rotate(90deg) }`. Focus ring per Global Constraints. Under no-preference: `color var(--dur-quick)` and glyph `transform 250ms ease`.
- `.chip` covers `.source-chip`, `.tags button` and `.dev-conn`. Give all three elements the `chip` class and remove their old fills. Style: `border: 1px solid var(--rule)`, no fill, `color: var(--ink-2)`, 500 at `0.8rem`, `padding: 3px 8px`, `border-radius: 0`, min-height 24px. Hover: `border-color: var(--ink); color: var(--ink)`. Keep the `.dev-conn` lit state (`--accent` border and text on `.dev.is-lit`). Rewrite the `.dev.is-dim` chip rule as `border-color: var(--rule); color: var(--ink-3)`. Source chips keep the time and the external icon.
- `.dev-context`: `border-left: 2px solid var(--ink)`, keeping the padding. The label is `color: var(--ink); font-weight: 600`. `.dev-context-teaser` uses the 2-line clamp, replacing the nowrap ellipsis. Print shows the teaser unclamped and hides the toggle.
- Drop the old `.index-more`, `.index-show`, `.alerts-show` and `.dev-context-toggle` visual rules. Keep any layout rules (`justify-self: start`, and the More button's grid placement under the reason text). Padding must not shift the text off the left edge of the text above it.
- Every briefing-page control (row button, chips, text buttons, carousel excepted) gets the shared focus ring. Control transitions use `--dur-quick`.

- [ ] **Step 1: Write failing tests**

- `icons.test.tsx`: `PlusIcon open draws only the horizontal stroke`. The `path` `d` attribute contains no `v` segment when `open`, and it does when closed.
- `storyCss.test.ts` (keep the helpers and replace the old control tests):
  - `gives text buttons a 24px target, the shared focus ring and no underline`: `rulesFor(css, '.text-btn')` matches `min-height: 24px` and has no `text-decoration: underline`. The `.text-btn:focus-visible` rule contains `outline: 2px solid var(--accent)` and `outline-offset: 2px`.
  - `motions text buttons only without reduced-motion`: the substring after `@media (prefers-reduced-motion: no-preference)` mentions `.text-btn` and `250ms`, and the top-level `.text-btn` rules have no `transition`.
  - `styles chips as hairline boxes with 24px targets`: `.chip` has `border: 1px solid var(--rule)`, `min-height: 24px` and no `background: var(--paper-deep)`.
  - `makes From the archive an ink rule with a two-line teaser`: `.dev-context` has `border-left: 2px solid var(--ink)`, and `.dev-context-teaser` contains `line-clamp: 2`.
  - Update the print test: the hidden-in-print list becomes `.text-btn`, `.dev-conn`. The unclamped list adds `.dev-context-teaser`.
  - Keep `gives the reason toggle and region tags 24px targets`, pointed at `.text-btn` and `.tags button` / `.chip`.
- `DevelopmentCard.test.tsx`: `the archive toggle reads Read background, then Show less`. Its role is button and it has class `text-btn`. `aria-expanded` flips.
- `TensionIndex.test.tsx`: the toggle's visible text is `More`, then `Less`. Its accessible name starts with `More: ` (label in name). "Show 2 more" is a `.text-btn`.
- `AlertCallout.test.tsx`: "Show 1 more" is a `.text-btn`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/components`
Expected: the new tests FAIL.

- [ ] **Step 3: Implement**

Write `PlusIcon` `open`, `TextButton`, and switch the four controls to `TextButton`. Add `chip` to the source chip `<a>`, the region tag buttons and `.dev-conn`. Rewrite the CSS as above. Remove the `ExpandIcon` import from `DevelopmentCard` if it is now unused. Leave `ExpandIcon` itself alone, since other code uses it.

- [ ] **Step 4: Run all frontend tests, types and lint**

Run: `npx vitest run`, then `npx tsc -b`, then `npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components
git commit -m "feat(story): one text button and chip style; From the archive gets an ink rule and two lines"
```

---

### Task 5: Tension index rows

**Files:**
- Modify: `frontend/src/components/briefing/TensionIndex.tsx`, `TensionIndex.test.tsx`
- Modify: `frontend/src/components/briefing/Timeline.tsx` (`onTag`), `Timeline.test.tsx`
- Modify: `frontend/src/components/briefing/story.css`, `storyCss.test.ts`

**Interfaces:**
- Consumes: `IndexHighlight` from `state/useIndexHighlight.ts` (unchanged): `pin(key)` toggles, and `preview(key | null)`. Also `TextButton` and `.text-btn` from Task 4.
- Produces: `li.index-item` gets class `is-pinned` when `pinned === item.key`.

- [ ] **Step 1: Write failing tests in `TensionIndex.test.tsx`**

- `previews when the pointer enters anywhere on the row`: `fireEvent.mouseEnter` on the `li`, not the button, calls `preview(key)`. `mouseLeave` on the `li` calls `preview(null)`.
- `clicking the reason text pins the row`: a click on `.index-why` calls `pin(key)` once.
- `clicking More does not pin`: a click on the More toggle leaves `pin` uncalled.
- `ignores the second click of a double-click`: `fireEvent.click(row, { detail: 2 })` does not call `pin`. A `detail: 1` click does. A `detail: 0` (keyboard) click does.
- `marks the pinned row`: with `pinned` set, that `li` has class `is-pinned`, and its button has `aria-pressed="true"`.
- `keeps revealed rows after the pin clears`: render with 5 items and `pinned` = the 5th, then rerender with `pinned: null`. All 5 `li` have no `is-overflow`, and "Show 2 more" is absent.

In `Timeline.test.tsx`:
- `the connection tag unpins its row when already pinned`: with `pinned` set to the card's first linked key, clicking the tag calls `pin(thatKey)`. That toggles, so it unpins.
- Keep the existing test that pinning via the tag focuses the pinned row.

In `storyCss.test.ts`:
- `pins with an ink edge on paper-deep and rings the whole row`: a rule for `.index-item.is-pinned` contains `inset 3px 0 0 var(--ink)` and `var(--paper-deep)`. Some rule selector includes `.index-item:has(.index-row:focus-visible)` with `outline: 2px solid var(--accent)`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/components/briefing`
Expected: the new tests FAIL.

- [ ] **Step 3: Implement**

- `TensionIndex`:
  - Move `onMouseEnter` and `onMouseLeave` to the `li`. Focus and blur stay on the button.
  - One handler, `onRow(e, key)`, returns early on `e.detail > 1`. On the `li`, return early when `(e.target as Element).closest('button, a')` is inside the `li`. The button's own `onClick` calls the same handler.
  - Unpinning still calls `preview(null)` first.
  - Add `is-pinned`.
  - Latch the reveal: an effect sets `showAll` to `true` whenever `pinnedHidden` is true.
- `Timeline.onTag`: when `pinned === first.key`, call `pin(first.key)` to unpin and don't move focus. Otherwise keep today's path (scroll, `focusAfterPin`, pin). Update the comment ("Never unpins" no longer holds).
- CSS:
  - Give `.index-row` horizontal padding of 12px on both sides, and give `.index-why` and the More control the same left inset, so the text keeps one left edge.
  - `.index-item.is-pinned { background: var(--paper-deep); box-shadow: inset 3px 0 0 var(--ink); }`, placed after the hover and active wash rule so a previewed other row keeps its wash while the pin stays visible. A hovered pinned row shows the wash and keeps the ink edge.
  - Use `.index-item:has(.index-row:focus-visible)` for the ring, and set `.index-row:focus-visible { outline: none }`.
  - The `li` gets `cursor: pointer`.
  - Change the row transition to `--dur-quick`.

- [ ] **Step 4: Run all frontend tests, types and lint**

Run: `npx vitest run`, then `npx tsc -b`, then `npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/briefing
git commit -m "fix(story): whole-row index targets, visible pin, double-click safe, reveal sticks"
```

---

## After the tasks (controller)

1. Run the full backend and frontend suites, lint and `npm run build`.
2. Live check against the Done-when list in the spec, on a freshly generated Boeing briefing (the saved `boeing.json` predates `related_developments`):
   - rows light only the linked developments
   - hovering anywhere on a row previews it
   - a pinned row stays visibly pinned while hovering others
   - region tags zoom the globe with a mouse
   - hovering cards moves the globe after a Top stories jump
3. Whole-branch review, then merge `story/briefing-page` into local `main` (no push).
