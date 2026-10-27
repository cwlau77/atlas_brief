# Story Tab Order and Clearer Tension Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the tension index below the timeline, state each tension's relationship in words, write actors as words, and name each row's linked developments instead of drawing squares.

**Architecture:** The backend `Tension` gains an optional closed-enum `relationship` that the signals section call emits. The frontend maps it to fixed words. The tension index row is reshaped in place: a relationship line plus a "Ties to" list of buttons that reuse the Story tab's `scrollToStory`. The index moves below the timeline inside `.kd-main`, so the sticky globe stays beside it.

**Tech Stack:** FastAPI + Pydantic (Python 3.11), React 19 + TypeScript + Vite, vitest, pytest.

**Spec:** `docs/superpowers/specs/2026-10-27-story-tension-index-design.md`

## Global Constraints

- Work in worktree `/Users/camlau/Developer/atlas-story-tensions` on branch `story/tension-index`. Never push.
- Python is `/Users/camlau/Developer/atlas/.venv/bin/python`; run backend tests from the worktree root.
- Relationship enum values (exact): `in_conflict`, `rivalry`, `competing_claims`, `pressure`, `negotiating`, `uneasy_partners`.
- Shown words (exact): In open conflict · Rivals, no clash yet · Competing claims · Pressure and pushback · Negotiating · Uneasy partners. Contradiction phrase: "Same event, different accounts". List label: "Ties to". Empty state: "Not tied to one development in this brief".
- Design tokens only from `frontend/src/styles/tokens.css`. No new colours, and no red or amber outside the existing contradiction marker.
- All motion respects `prefers-reduced-motion`.
- Saved briefings without `relationship` and with `A ↔ B` actors must render.
- Leave the `httpx`/`httpcore` loggers alone.

## Review Focus

- **A model reply with `"relationship": "war"`, `null`, `7` or the key missing:** the tension still parses with `relationship=None`, and the signals section neither retries nor fails. Pinned in Task 1.
- **A saved briefing whose actors are `"A ↔ B ↔ C"`:** it shows "A, B and C" in the index, route titles and Archive. Pinned in Task 2.
- **A tension linked to nothing (`related_developments: []`):** it shows the empty-state text, not an empty "Ties to" list. Pinned in Task 4.
- **Clicking a "Ties to" button inside a pinned row:** it jumps to the card and leaves the pin alone. The document click-outside handler must not clear the pin either, because the button is inside the index section. Pinned in Task 4.
- **The card tag pinning a row that sits behind "Show N more":** the row is revealed, then scrolled into view and focused. Pinned in Task 5.

---

### Task 1: Backend `relationship` on tensions

**Files:**
- Modify: `backend/models.py` (`Tension`)
- Modify: `backend/synthesis/briefing.py` (`_SECTION_SHAPES["signals"]`, `briefing_from_data`)
- Test: `backend/tests/test_synthesis.py`

**Interfaces:**
- Produces: `Tension.relationship: Optional[Literal["in_conflict","rivalry","competing_claims","pressure","negotiating","uneasy_partners"]] = None`. The API JSON key is `relationship`.

- [ ] **Step 1: Write failing tests** in `backend/tests/test_synthesis.py`:

```python
def _tension_data(relationship):
    t = {"description": "D", "actors": ["A", "B"], "sources": [1]}
    if relationship is not ...:
        t["relationship"] = relationship
    return {"emerging_tensions": [t]}

def test_known_relationship_parses(make_article):
    b = briefing_from_data(_tension_data("in_conflict"), "f", [make_article()])
    assert b.emerging_tensions[0].relationship == "in_conflict"

@pytest.mark.parametrize("value", ["war", None, 7, ...])
def test_unknown_or_missing_relationship_is_none(make_article, value):
    b = briefing_from_data(_tension_data(value), "f", [make_article()])
    assert b.emerging_tensions[0].relationship is None

def test_signals_prompt_lists_every_relationship():
    from backend.synthesis.briefing import _SECTION_SHAPES
    for v in ("in_conflict", "rivalry", "competing_claims", "pressure", "negotiating", "uneasy_partners"):
        assert v in _SECTION_SHAPES["signals"]

def test_fallback_tensions_have_no_relationship(make_article):
    b = _fallback_briefing("Aden port", [make_article(title="Strike near Aden port in Yemen")])
    assert all(t.relationship is None for t in b.emerging_tensions)
```

- [ ] **Step 2: Run** `.venv/bin/python -m pytest backend/tests/test_synthesis.py -q -k "relationship"`. Expected: FAIL (`Tension` has no `relationship`).

- [ ] **Step 3: Implement.**
  - Add the field to `Tension` and export a module constant `RELATIONSHIPS: tuple[str, ...]` in `models.py`, with the six values in the order above.
  - In the signals shape, add `"relationship": "one of: in_conflict | rivalry | competing_claims | pressure | negotiating | uneasy_partners"` to the tension object. Add one constraint line per value with the spec's meanings, e.g. `- relationship: in_conflict = fighting, strikes or attacks between the actors; …`.
  - In `briefing_from_data`, pass `relationship=t.get("relationship") if t.get("relationship") in RELATIONSHIPS else None`.
  - `_fallback_briefing` needs no change (the default is `None`).

- [ ] **Step 4: Run** `.venv/bin/python -m pytest backend/tests -q`. Expected: all pass.

- [ ] **Step 5: Commit** `feat(synthesis): tensions carry a relationship type`.

---

### Task 2: Frontend data: relationship and actors as words

**Files:**
- Modify: `frontend/src/lib/types.ts` (`Tension`)
- Modify: `frontend/src/lib/normalize.ts` (`ViewTension`, the tension mapping, new exports)
- Modify: `frontend/src/lib/routes.ts:50` (tension route title)
- Modify: `frontend/src/routes/ArchivePage.tsx:32`
- Test: `frontend/src/lib/normalize.test.ts`, `frontend/src/lib/routes.test.ts` (if present, else `normalize.test.ts`), `frontend/src/routes/ArchivePage.test.tsx`

**Interfaces:**
- Produces, from `lib/normalize.ts`:
  - `export type TensionRelationship = 'in_conflict' | 'rivalry' | 'competing_claims' | 'pressure' | 'negotiating' | 'uneasy_partners'`
  - `ViewTension.relationship?: TensionRelationship | null`. It's optional because older saved briefings lack it; readers treat `undefined` as `null`.
  - `export function actorsText(actors: string): string`: reformats a legacy `A ↔ B` string, and returns any other string unchanged.
- `types.ts` `Tension` gains `relationship?: string | null`.

- [ ] **Step 1: Write failing tests** (normalize.test.ts):

```ts
it('maps a known relationship and drops an unknown one', () => {
  // build an api briefing with two tensions: relationship 'rivalry' and 'war'
  expect(view.emergingTensions.map((t) => t.relationship)).toEqual(['rivalry', null])
})
it('writes actors as words', () => {
  // actors ['Egypt'], ['A','B'], ['A','B','C'], []
  expect(view.emergingTensions.map((t) => t.actors)).toEqual(['Egypt', 'A and B', 'A, B and C', 'Multiple actors'])
})
it('actorsText reformats a legacy arrow string', () => {
  expect(actorsText('A ↔ B ↔ C')).toBe('A, B and C')
  expect(actorsText('A and B')).toBe('A and B')
})
```

  Also add an ArchivePage test: a saved briefing with tension actors `'Houthi forces ↔ EU-US coalition'` shows `'Houthi forces and EU-US coalition'`. And a `buildRoutes` test: a tension route's `title` is the word form for a legacy arrow string.

- [ ] **Step 2: Run** `npx vitest run src/lib/normalize.test.ts src/routes/ArchivePage.test.tsx src/lib/routes.test.ts` in `frontend/`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - Use one module-level `Intl.ListFormat('en', { style: 'long', type: 'conjunction' })`. Check its output has no Oxford comma ("A, B and C"); if it has one, use `'en-GB'`.
  - `actorsText` splits on `/\s*↔\s*/` and list-formats when there are 2 or more parts.
  - `normalize` sets `relationship` only when it's one of the six values, else `null`.
  - `routes.ts` and `ArchivePage.tsx` wrap `actors` in `actorsText(...)`.

- [ ] **Step 4: Run** `npx vitest run`. Expected: all pass. Fix existing assertions that expected `↔` (e.g. in `test/fixtures.ts` consumers) to the word form.

- [ ] **Step 5: Commit** `feat(story): tension actors read as words; relationship in the view model`.

---

### Task 3: Index items carry the relation and named links

**Files:**
- Modify: `frontend/src/lib/tensionIndex.ts`
- Test: `frontend/src/lib/tensionIndex.test.ts`

**Interfaces:**
- Consumes: `TensionRelationship`, `actorsText` (Task 2).
- Produces, in `lib/tensionIndex.ts`:
  - `export const RELATIONSHIP_LABELS: Record<TensionRelationship, string>`, with the six shown words from Global Constraints;
  - `export const CONTRADICTION_RELATION = 'Same event, different accounts'`;
  - `IndexItem.relation: string | null`;
  - `IndexItem.linked: { dev: number; title: string; timestamp: string }[]`, in timeline order (the `order` argument), with `title = dev.title` and `timestamp = dev.timestamp` (raw; the component formats it);
  - `IndexItem.sides` for a tension is `actorsText(t.actors)`. `devs` is unchanged.

- [ ] **Step 1: Write failing tests:**

```ts
it('names linked developments in timeline order', () => {
  // tension related_developments [0, 2]; order newest-first puts 2 before 0
  expect(items[0].linked.map((l) => l.dev)).toEqual([2, 0])
  expect(items[0].linked[0].title).toBe(b.keyDevelopments[2].title)
})
it('relation is the label for a tension and fixed for a contradiction', () => {
  // tension relationship 'competing_claims', a second tension with none, one contradiction
  expect(byKey('tension-0').relation).toBe('Competing claims')
  expect(byKey('tension-1').relation).toBeNull()
  expect(byKey('contradiction-0').relation).toBe('Same event, different accounts')
})
it('legacy arrow actors become words in sides', () => {
  expect(byKey('tension-0').sides).toBe('A and B') // from actors 'A ↔ B'
})
```

- [ ] **Step 2: Run** `npx vitest run src/lib/tensionIndex.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** in `buildTensionIndex`: `linked = order.filter((e) => devs.includes(e.index)).map(...)`.
- [ ] **Step 4: Run** `npx vitest run src/lib`. Expected: pass. Update the `ITEMS` fixture in `TensionIndex.test.tsx` to carry `relation` and `linked`, so `tsc` stays clean.
- [ ] **Step 5: Commit** `feat(story): index items carry the relationship and their named developments`.

---

### Task 4: Reshape the index row

**Files:**
- Modify: `frontend/src/components/briefing/TensionIndex.tsx`
- Modify: `frontend/src/components/briefing/story.css` (index rules, print block)
- Test: `frontend/src/components/briefing/TensionIndex.test.tsx`, `frontend/src/components/briefing/storyCss.test.ts`

**Interfaces:**
- Consumes: `IndexItem.relation`, `IndexItem.linked` (Task 3); `formatDate` from `lib/time.ts`.
- Produces, as the new props: `TensionIndex({ id, items, highlight, timeZone, onOpen }: { id?: string; items: IndexItem[]; highlight: IndexHighlight; timeZone: string; onOpen: (anchorId: string) => void })`. The `devCount` and `order` props are removed.

- [ ] **Step 1: Write failing tests** (TensionIndex.test.tsx). Replace the "strip fills linked developments" test, and pass `timeZone="UTC"` and `onOpen={open}` (a `vi.fn()`) in the Harness:

```ts
it('shows the relationship under the actors', () => {
  expect(rows()[0].querySelector('.index-relation')!.textContent).toBe('In open conflict')
})
it('has no square strip', () => {
  expect(container.querySelector('.index-strip')).toBeNull()
})
it('names linked developments and opens one without touching the pin', () => {
  act(() => pinFromOutside('tension-0'))
  const ties = [...container.querySelectorAll<HTMLButtonElement>('li:first-child .index-ties button')]
  expect(ties.map((t) => t.getAttribute('aria-label'))).toEqual(['Go to development: Second', 'Go to development: First'])
  act(() => ties[0].click())
  expect(open).toHaveBeenCalledWith('dev-2')
  expect(current.pinned).toBe('tension-0')
})
it('says when a row ties to no development', () => {
  // ITEMS 'tension-2' has linked: []
  expect(lastRow.querySelector('.index-ties')!.textContent).toContain('Not tied to one development in this brief')
  expect(lastRow.querySelectorAll('.index-ties button')).toHaveLength(0)
})
it('row name includes the relationship', () => {
  expect(rows()[0].textContent).toContain('In open conflict')
})
```

  In storyCss.test.ts, assert the `@media print` block unclamps `.index-ties` titles, and that no `.index-strip` rule remains.

- [ ] **Step 2: Run** `npx vitest run src/components/briefing/TensionIndex.test.tsx src/components/briefing/storyCss.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **Row button:** kind marker, actors (`.index-sides`), then `<span className="index-relation">` when `relation` isn't null. It goes on its own grid row under the actors, in column 2 of the existing 3-column `.index-row` grid.
  - **Why text:** unchanged.
  - **Ties list:** after the why text and More toggle, add `<div className="index-ties">`:
    - a `.label` "Ties to";
    - a `<ul>` of `<li><button type="button" aria-label={`Go to development: ${title}`} onClick={() => onOpen(`dev-${dev}`)}><span className="index-tie-title">{title}</span> <time dateTime={timestamp}>{formatDate(timestamp, timeZone)}</time></button></li>`;
    - or, when `linked` is empty, a `<p>` with the empty-state copy instead of the list.
  - **CSS:**
    - remove the `.index-strip` rules and drop it from the transition rule;
    - `.index-relation` uses `color: var(--ink-2)`;
    - `.index-ties` spans `grid-column: 1 / -1`, with the same 12px inline padding as `.index-why`;
    - `.index-tie-title` is a one-line ellipsis;
    - tie buttons get an underline on hover/focus-visible in `--accent`, with any transition inside `@media (prefers-reduced-motion: no-preference)`;
    - the empty state is `--ink-3`;
    - in `@media print`, `.index-tie-title` unclamps (`white-space: normal; overflow: visible`).

- [ ] **Step 4: Run** `npx vitest run src/components/briefing`. Expected: pass. (`StoryTab.tsx` won't type-check until Task 5; that's fine before running `tsc`.)

- [ ] **Step 5: Commit** `feat(story): index rows say the relationship and name their developments`.

---

### Task 5: Page order and the card tag scrolling to its row

**Files:**
- Modify: `frontend/src/routes/StoryTab.tsx`
- Modify: `frontend/src/components/briefing/Timeline.tsx` (`onTag`, the focus-after-pin effect)
- Modify: `docs/BACKLOG.md` (mark both items done)
- Test: `frontend/src/routes/StoryTab.test.tsx`, `frontend/src/components/briefing/Timeline.test.tsx`

**Interfaces:**
- Consumes: the new `TensionIndex` props (Task 4); `scrollToStory` in `StoryTab`.

- [ ] **Step 1: Write failing tests.**
  - **StoryTab.test.tsx:** change the order assertion so the timeline precedes `#tension-index` inside `.kd-main`. That is, `timeline.compareDocumentPosition(index) & Node.DOCUMENT_POSITION_FOLLOWING` is truthy.
  - **StoryTab.test.tsx:** add "a Ties to button jumps to its card". Clicking `#tension-index .index-ties button` focuses `#dev-N` (stub `scrollIntoView` on the cards, as the existing jump test does).
  - **Timeline.test.tsx:** replace "tag click pins first linked item" so it asserts the scroll lands on the pinned row, not the section:

```ts
it('tag click pins the first linked item and scrolls its row into view', () => {
  const scroll = vi.fn()
  render()
  // stub scrollIntoView on every .index-item and on #t-index (to prove the section is not used)
  act(() => tag.click())
  expect(current.pinned).toBe('tension-0')
  expect(rowScroll).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }))
  expect(sectionScroll).not.toHaveBeenCalled()
})
it('tag scroll to a row behind "Show N more" happens after it is revealed', () => { /* a briefing with 4+ items where the card's first item ranks 4th */ })
```

  The Timeline test harness renders `TensionIndex` with the new props.

- [ ] **Step 2: Run** `npx vitest run src/routes/StoryTab.test.tsx src/components/briefing/Timeline.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **StoryTab:** move `<TensionIndex …>` after `<Timeline …>` in `.kd-main`. Pass `timeZone={settings.timeZone}` and `onOpen={scrollToStory}`. Drop `devCount` and `order` (remove `indexOrder` if it's now unused).
  - **Timeline `onTag`:** stop scrolling the section. Let the existing `focusAfterPin` effect find the pinned `.index-row`, call `closest('.index-item').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })`, then `focus({ preventScroll: true })`. The unpin path is unchanged (no scroll).
  - **Docs:** update the comment at the top of the `.kd-cols` CSS ("the index and timeline on the left") to read timeline then index.
  - **BACKLOG:** strike through both items as "(done 2026-10-27)", each with a one-line summary pointing to the spec.

- [ ] **Step 4: Run all checks** in `frontend/`: `npx vitest run`, `npm run lint` (expect the 3 pre-existing warnings only), `npm run build`. Then run `.venv/bin/python -m pytest backend/tests -q` from the root. Expected: all green.

- [ ] **Step 5: Commit** `feat(story): the timeline comes first, the tension index below it`.

---

### Task 6: Live check

- [ ] **Step 1:** Start the backend (`.venv/bin/python -m uvicorn backend.main:app --port 8000` from the worktree root) and the frontend (`npm run dev` in `frontend/`).
- [ ] **Step 2:** Generate one real briefing on a conflict-heavy focus (e.g. "Red Sea shipping"). Confirm:
  - the order is Read first, timeline, tensions, Top stories, reading list;
  - fresh tensions show a relationship line;
  - actors have no arrows;
  - "Ties to" buttons jump to their cards and move the globe;
  - hovering an index row moves the sticky globe while the timeline is scrolled out of view;
  - a card tag scrolls to and focuses its row;
  - reduced motion jumps instead of smooth-scrolling.
- [ ] **Step 3:** Open a saved briefing from before this change (Archive). Confirm no relationship line, actors in words, and "Ties to" filled. Print preview shows every row and full "Ties to" titles.
- [ ] **Step 4:** Report the findings with screenshots. Fix anything broken in the task that owns it, then commit.
- [ ] **Step 5:** Merge `story/tension-index` into local `main` (fast-forward) only after the owner OKs the live check. Never push.
