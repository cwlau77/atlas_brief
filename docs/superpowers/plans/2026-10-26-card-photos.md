# Card Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** More briefing cards show a photo. Commons keeps lead images, Tavily supplies outlet photos, and every card (timeline, alerts, Top stories) falls back through outlet photos, then the Commons photo.

**Architecture:**
- **Backend:** reshape three existing pieces.
  - `commons.py`: a query keeps partial results when the budget runs out, a background backfill fills the cache, and candidates are handed out in two passes.
  - `briefing.py`: Commons queries go out for every development.
  - `tavily_source.py`: requests images and picks the first one that passes a filter.
- **Frontend:** `cardImage.ts` returns an ordered list of candidates. `CardImage` and `StoryCard` both step through the list when an image errors.

**Tech Stack:** Python 3.11, FastAPI, httpx, pytest + respx / httpx.MockTransport. React 18 + TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-card-photos-design.md`

**Commands:**
- Python: `/Users/camlau/Developer/atlas/.venv/bin/python`, referred to as `PY` below.
- Run backend commands from the worktree root.
- Run frontend commands from `frontend/`.

## Global Constraints

- **Credits:** an outlet photo is "Photo: <outlet>" (StoryCard: "Photo · <outlet>"). A Commons photo is "File photo: <author>, <license>, Wikimedia Commons" (StoryCard: "File photo · …").
- An image lookup never fails a briefing and adds no latency on the critical path. The Commons budget stays 1.5s.
- `httpx`/`httpcore` loggers stay at WARNING (`backend/main.py`, untouched).
- The backend is a single process; module-level caches and background tasks are fine.
- The no-repeat rule holds: one Commons photo per briefing, at most once.
- Design tokens only from `tokens.css`. No new motion.
- Commit on `worktree-card-photos`. Never push. End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Compact StoryCard with a file photo:** the "File photo" prefix must stay visible; only the outlet prefix is hidden in compact. Covered by a Task 5 test.
2. **Two briefings overrunning on the same place at once:** only one backfill for that query is in flight. Covered by a Task 1 test.
3. **Tavily `images` missing, `null`, not a list, or holding non-string / non-dict entries:** `image_url` is `None` and nothing crashes. Covered by a Task 3 test.
4. **The same photo URL cited by two sources:** it is tried once, not twice. Covered by a Task 4 test.
5. **Every candidate fails:** CardImage renders nothing and StoryCard shows the gradient with no credit. Covered by Task 4 and Task 5 tests.

---

### Task 1: Commons keeps what arrived, and backfills overruns

**Files:**
- Modify: `backend/synthesis/commons.py` (`_lookup`, `fetch_candidates`, new `_backfill`, `_new_client`)
- Test: `backend/tests/test_commons.py`

**Interfaces:**
- Produces:
  - `fetch_candidates(queries: list[str], client: httpx.AsyncClient, budget_s: float = 1.5) -> dict[str, list[CommonsImage]]` (signature unchanged). Every query that is unfinished when the budget runs out schedules a backfill.
  - `BACKFILL_S = 10.0`
  - `_new_client() -> httpx.AsyncClient`: an AsyncClient with timeout 3.0 and `User-Agent: USER_AGENT`. Tests monkeypatch it.
  - `async def _backfill(query: str) -> None`: runs `_lookup(query, client)` inside `_new_client()` with `asyncio.wait_for(..., BACKFILL_S)`. Caches the result only when complete. Never raises; failures are logged at INFO.
  - Module state: `_backfilling: set[str]` (queries in flight) and `_tasks: set[asyncio.Task]` (strong refs; each task discards itself when done).

- [ ] **Step 1: Write the failing tests**

  1. Add an autouse fixture that clears `_backfilling` and cancels any `_tasks` at teardown.
  2. Add a `client_for` variant with separate `lead_delay` / `search_delay`: the Wikipedia host and `titles=` Commons requests sleep `lead_delay`; the `gsrsearch` request sleeps `search_delay`.
  3. Add a fixture `no_backfill` that monkeypatches `commons._new_client` to a mock client that answers nothing useful.
  4. Make the existing `test_budget_exceeded_returns_empty` use `no_backfill`, so it never touches the network.

```python
async def test_slow_search_keeps_the_lead_image(no_backfill):
    async with client_for([page("File:A.jpg")], lead="B.jpg", lead_page=page("File:B.jpg"), search_delay=3) as c:
        t = time.monotonic()
        out = await commons.fetch_candidates(["Cairo"], c, budget_s=0.3)
    assert time.monotonic() - t < 0.6
    assert names(out["Cairo"]) == ["File:B.jpg"]
    assert "Cairo" not in commons._cache  # partial, so not cached

async def test_overrun_backfills_the_cache(monkeypatch):
    monkeypatch.setattr(commons, "_new_client", lambda: client_for([page("File:A.jpg")], lead="B.jpg", lead_page=page("File:B.jpg")))
    async with client_for([page("File:A.jpg")], lead="B.jpg", lead_page=page("File:B.jpg"), search_delay=3) as c:
        await commons.fetch_candidates(["Cairo"], c, budget_s=0.2)
    await asyncio.gather(*list(commons._tasks))
    assert names(commons._cache["Cairo"][1]) == ["File:B.jpg", "File:A.jpg"]
    assert "Cairo" not in commons._backfilling

async def test_one_backfill_per_query(monkeypatch):
    made = []
    def factory():
        made.append(1)
        return client_for([page("File:A.jpg")], search_delay=0.2)
    monkeypatch.setattr(commons, "_new_client", factory)
    async with client_for([], search_delay=3) as c:
        await asyncio.gather(commons.fetch_candidates(["Cairo"], c, budget_s=0.1),
                             commons.fetch_candidates(["Cairo"], c, budget_s=0.1))
    await asyncio.gather(*list(commons._tasks))
    assert len(made) == 1

async def test_backfill_failure_is_swallowed(monkeypatch, caplog):
    def boom():
        raise RuntimeError("down")
    monkeypatch.setattr(commons, "_new_client", boom)
    async with client_for([], search_delay=3) as c:
        await commons.fetch_candidates(["Cairo"], c, budget_s=0.1)
    await asyncio.gather(*list(commons._tasks))
    assert "Cairo" not in commons._cache and "Cairo" not in commons._backfilling
```

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `PY -m pytest backend/tests/test_commons.py -v`
  Expected: the four new tests fail (`_new_client` / `_tasks` are missing, or the lead image is lost). The existing tests still pass.

- [ ] **Step 3: Implement**

  **The approach:**
  - Inside `one(q)` in `fetch_candidates`, start the lead lookup and the search as two tasks.
  - Write `result[q]` as soon as the lead lands. Write the merged lead + hits when the search lands; the dedupe and order stay as in `_lookup`.
  - Track the queries that finish. After `wait_for` times out, call `_schedule_backfill(q)` for every query that didn't finish completely. It skips a query that is already in `_cache` or `_backfilling`.
  - Cancel the inner tasks on timeout, so nothing outlives the caller's client.
  - Keep `_lookup` as the single "both steps, merge, complete flag" helper, and have `one` and `_backfill` share its merge logic, so it isn't written twice. A small `_merge(lead, hits) -> list[CommonsImage]` helper is fine.
  - Update the module docstring with one sentence about backfill.

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `PY -m pytest backend/tests/test_commons.py -v`
  Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/synthesis/commons.py backend/tests/test_commons.py
git commit -m "fix(commons): keep the lead image when the search overruns; backfill the cache"
```

---

### Task 2: Commons candidates for every development

**Files:**
- Modify: `backend/synthesis/briefing.py` (`commons_candidates`, around line 462)
- Modify: `backend/synthesis/commons.py` (`assign_images`)
- Test: `backend/tests/test_commons.py`, `backend/tests/test_synthesis.py`

**Interfaces:**
- Consumes: `fetch_candidates` from Task 1.
- Produces: `assign_images(briefing: Briefing, candidates: dict[str, list[CommonsImage]]) -> None` (signature unchanged).
  - **New order:**
    1. Developments with no outlet photo, in index order.
    2. Developments with an outlet photo.
    3. Alerts with no outlet photo.
    4. Alerts with an outlet photo.
  - An alert still borrows the query of the first development that shares a source URL with it.
  - No candidate URL is used twice.

- [ ] **Step 1: Write the failing tests**

```python
def test_photo_less_developments_pick_first():
    with_photo = dev("Cairo", "u0", image_url="https://o/i.jpg")
    bare = dev("Cairo", "u1")
    commons.assign_images(briefing([with_photo, bare], []), {"Cairo": [img(1), img(2)]})
    assert bare.commons_image.url.endswith("/1.jpg")
    assert with_photo.commons_image.url.endswith("/2.jpg")  # fallback

def test_alert_with_outlet_photo_gets_a_fallback_after_bare_alerts():
    d0 = dev("Cairo", "u0")
    a_photo = PriorityAlert(severity="high", headline="h", rationale="r", sources=[cite("u0", "https://o/a.jpg")])
    a_bare = alert("u0")
    commons.assign_images(briefing([d0], [a_photo, a_bare]), {"Cairo": [img(1), img(2), img(3)]})
    assert (d0.commons_image.url[-5:], a_bare.commons_image.url[-5:], a_photo.commons_image.url[-5:]) == ("1.jpg", "2.jpg", "3.jpg")
```

  - In `test_assign_distinct_and_alert_borrows_place`, `d2` (which has an outlet photo) now receives a fallback. Update that test's expectations to match the new order.
  - **test_synthesis.py:** add `test_commons_queries_include_developments_with_outlet_photos`. It sets up the fast LLM with a development whose source carries `image_url`, and has a fake `fetch_candidates` record its `queries`. It asserts that the development's place or region query is among them.

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `PY -m pytest backend/tests/test_commons.py backend/tests/test_synthesis.py -v`
  Expected: the new tests fail.

- [ ] **Step 3: Implement**

  - `briefing.py`: build `queries` from every development (drop the `not any(s.image_url ...)` filter). Update the comment to "Place photos for every development: the primary photo when there's no outlet image, a fallback when there is."
  - `commons.py`: `assign_images` runs the two passes described in Interfaces. Update the docstring.

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `PY -m pytest backend/tests -q`
  Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/synthesis/briefing.py backend/synthesis/commons.py backend/tests/test_commons.py backend/tests/test_synthesis.py
git commit -m "feat(commons): a fallback place photo for every development and alert"
```

---

### Task 3: Tavily results carry their photo

**Files:**
- Modify: `backend/ingestion/tavily_source.py`
- Test: `backend/tests/test_search_sources.py`

**Interfaces:**
- Produces:
  - `NOT_PHOTO = re.compile(r"\.(svg|gif|ico)$|logo|icon|avatar|placeholder|default|sprite|banner", re.I)`, matched against `urlsplit(url).path`.
  - `first_photo(images: object) -> str | None`: the first entry of a list whose URL (a string, or a dict's `"url"`) is a string and doesn't match `NOT_PHOTO`. Anything else → `None`. `make_article` already enforces https.

- [ ] **Step 1: Write the failing tests**

```python
def test_tavily_first_photo_skips_non_photos():
    assert tavily_source.first_photo([
        "https://cdn.ex/site-logo.png", {"url": "https://cdn.ex/icons/x.jpg"}, "https://cdn.ex/a.svg",
        {"url": "https://cdn.ex/photo.jpg?w=800"}, "https://cdn.ex/later.jpg",
    ]) == "https://cdn.ex/photo.jpg?w=800"

@pytest.mark.parametrize("images", [None, "https://x/a.jpg", {}, [None, 3, {"nourl": 1}], []])
def test_tavily_first_photo_tolerates_junk(images):
    assert tavily_source.first_photo(images) is None
```

  Extend `test_tavily_posts_news_topic_with_bearer_key`:
  - Give the `TAVILY` fixture result `"images": ["https://img.ex/t.jpg"]`.
  - Assert `a.image_url == "https://img.ex/t.jpg"` and `a.image_outlet == "news.example.org"`.
  - Assert `body["include_images"] is True and body["search_depth"] == "basic"`.

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `PY -m pytest backend/tests/test_search_sources.py -v`
  Expected: the new tests fail.

- [ ] **Step 3: Implement**

  Add `"include_images": True` to the request body. Pass `image_url=first_photo(item.get("images"))` to `make_article`.

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `PY -m pytest backend/tests -q`
  Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/ingestion/tavily_source.py backend/tests/test_search_sources.py
git commit -m "feat(tavily): take each result's own photo"
```

---

### Task 4: One fallback chain for timeline and alert cards

**Files:**
- Modify: `frontend/src/lib/cardImage.ts`, `frontend/src/components/briefing/CardImage.tsx`, `DevelopmentCard.tsx:39,60`, `AlertCallout.tsx:24`
- Test: `frontend/src/lib/cardImage.test.ts`, `frontend/src/components/briefing/CardImage.test.tsx` (and update `DevelopmentCard.test.tsx` / `AlertCallout.test.tsx` only if they break)

**Interfaces:**
- Produces:
  - `interface CardImage { src: string; credit: string; by: string; href: string | null; filePhoto: boolean }`. `by` is the credit without its prefix: the outlet name, or `"<author>, <license>, Wikimedia Commons"`.
  - `cardImages(sources: SourceCitation[], commons: CommonsImage | null): CardImage[]`: each distinct `image_url` in citation order, then the Commons photo if present and not a duplicate src. `cardImage` is removed; its callers move to `cardImages`.
  - `<CardImage images={CardImage[]} variant="side" | "top" />`: shows the first entry whose src hasn't failed. `onError` adds the src to a failed set. With no entries left it renders `null`. `<img>` gains `referrerPolicy="no-referrer"`.

- [ ] **Step 1: Write the failing tests**

  **cardImage.test.ts.** Rewrite it for `cardImages`. Keep the existing value expectations (credits, href, filePhoto) and add `by`.

```ts
it('lists every distinct outlet photo in citation order, then the Commons photo', () => {
  const list = cardImages([
    src({ image_url: 'https://img/1.jpg' }),
    src({ outlet: 'BBC', url: 'https://b.bc/1', image_url: 'https://img/1.jpg' }),
    src({ outlet: 'AP', url: 'https://ap/1', image_url: 'https://img/2.jpg' }),
  ], commons)
  expect(list.map((i) => i.src)).toEqual(['https://img/1.jpg', 'https://img/2.jpg', commons.url])
  expect(list.map((i) => i.by)).toEqual(['Reuters', 'AP', 'Jane Doe, CC BY-SA 4.0, Wikimedia Commons'])
})
it('is empty with neither', () => { expect(cardImages([src()], null)).toEqual([]) })
```

  **CardImage.test.tsx.**
  - `render` takes a list.
  - Replace "hides on error" with the cases below.
  - Add `expect(img.getAttribute('referrerpolicy')).toBe('no-referrer')` to the lazy-image test.

```ts
it('steps to the next picture on error, credit and all', () => {
  render([OUTLET, COMMONS])
  act(() => { container.querySelector('img')!.dispatchEvent(new Event('error')) })
  expect(container.querySelector('img')!.getAttribute('src')).toBe(COMMONS.src)
  expect(container.querySelector('.card-img-credit')!.textContent).toBe(COMMONS.credit)
  expect(container.querySelector('.card-img-label')!.textContent).toBe('File photo')
})
it('renders nothing once every picture has failed', () => {
  render([OUTLET, COMMONS])
  for (let i = 0; i < 2; i++) act(() => { container.querySelector('img')!.dispatchEvent(new Event('error')) })
  expect(container.innerHTML).toBe('')
})
```

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `npx vitest run src/lib/cardImage.test.ts src/components/briefing/CardImage.test.tsx`
  Expected: FAIL.

- [ ] **Step 3: Implement** `cardImages` and the list-based `CardImage`. Update the two callers: `DevelopmentCard` uses `cardImages(dev.sources, dev.commonsImage)`, and `AlertCallout` passes `images={cardImages(a.sources, a.commonsImage)}`. Update the file header comments.

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npx vitest run`
  Expected: all pass. Fix any `DevelopmentCard` / `AlertCallout` test that relied on the old prop.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/cardImage.ts frontend/src/lib/cardImage.test.ts frontend/src/components/briefing/CardImage.tsx frontend/src/components/briefing/CardImage.test.tsx frontend/src/components/briefing/DevelopmentCard.tsx frontend/src/components/briefing/AlertCallout.tsx
git commit -m "feat(cards): fall back through outlet photos, then the Commons photo"
```

---

### Task 5: Top stories use the same chain

**Files:**
- Modify: `frontend/src/components/briefing/StoryCard.tsx`, `frontend/src/components/briefing/cards.css`
- Test: `frontend/src/components/briefing/StoryCard.test.tsx`

**Interfaces:**
- Consumes: `cardImages`, `CardImage.by` and `CardImage.filePhoto` from Task 4.
- Produces:
  - StoryCard shows the first non-failed entry of `cardImages(dev.sources, dev.commonsImage)` (memoized). It no longer reads `dev.leadImage`; that field stays in `normalize.ts` for saved briefings.
  - **Credit markup:** `<span class="story-card-credit label[ story-card-credit-file]" title={filePhoto ? credit : undefined}><span class="story-card-credit-prefix">{filePhoto ? 'File photo · ' : 'Photo · '}</span>{by}</span>`. It is not a link (see spec).

- [ ] **Step 1: Write the failing tests**

  Keep the existing tests: outlet credit "Photo · AP", the gradient on error, and the gradient with no image.

```ts
const COMMONS = { url: 'https://upload.wikimedia.org/a.jpg', page_url: 'https://commons.wikimedia.org/wiki/File:A.jpg', author: 'Jane Doe', license: 'CC BY-SA 4.0', source: 'commons' as const }

it('shows the Commons file photo, credited as one, when there is no outlet photo', () => {
  act(() => root.render(<StoryCard dev={{ ...briefing.keyDevelopments[1], commonsImage: COMMONS }} index={1} timeZone="UTC" onOpen={() => {}} />))
  expect(container.querySelector('img')!.getAttribute('src')).toBe(COMMONS.url)
  const credit = container.querySelector('.story-card-credit')!
  expect(credit.textContent).toBe('File photo · Jane Doe, CC BY-SA 4.0, Wikimedia Commons')
  expect(credit.getAttribute('title')).toBe('File photo: Jane Doe, CC BY-SA 4.0, Wikimedia Commons')
  expect(credit.classList.contains('story-card-credit-file')).toBe(true)
})

it('falls back from a failed outlet photo to the file photo', () => {
  act(() => root.render(<StoryCard dev={{ ...briefing.keyDevelopments[0], commonsImage: COMMONS }} index={0} timeZone="UTC" onOpen={() => {}} />))
  act(() => { container.querySelector('img')!.dispatchEvent(new Event('error')) })
  expect(container.querySelector('img')!.getAttribute('src')).toBe(COMMONS.url)
  expect(container.querySelector('.story-card-credit')!.textContent).toContain('File photo')
})
```

  Also add a CSS test in the style of `storyCss.test.ts` (read that file for the pattern). It asserts that `cards.css` has a `.story-card-compact .story-card-credit-file .story-card-credit-prefix` rule that shows the prefix (`display: inline`), so a compact file photo keeps "File photo".

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `npx vitest run src/components/briefing/StoryCard.test.tsx src/components/briefing/storyCss.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement**

  **StoryCard:** a failed-src set, like `CardImage`.

  **cards.css:**
  - `.story-card-credit` gains `max-width: calc(100% - 2 * var(--space-2)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`
  - Add `.story-card-compact .story-card-credit-file .story-card-credit-prefix { display: inline; }` after the compact rule that hides the prefix.

- [ ] **Step 4: Run the full frontend checks**

  Run: `npx vitest run && npm run build && npm run lint`
  Expected: all pass, with no lint errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/briefing/StoryCard.tsx frontend/src/components/briefing/StoryCard.test.tsx frontend/src/components/briefing/cards.css frontend/src/components/briefing/storyCss.test.ts
git commit -m "feat(top-stories): Commons file photos and the outlet-photo fallback chain"
```

---

### Task 6: Measure and record

**Files:**
- Modify: `docs/superpowers/specs/2026-10-26-card-photos-design.md` (append an "After" section)
- Modify: `docs/BACKLOG.md` (remove the "Card photos" item, or mark it shipped, matching how the file handles shipped items)
- Modify: `CLAUDE.md` Story-tab paragraph: one line saying card images fall back through outlet photos, then Commons, and that Commons now runs for every development.

- [ ] **Step 1: Re-run the measurement** over the same five focuses: Sudan ceasefire, Red Sea shipping, Taiwan chip export controls, UK housing policy, Gaza aid deliveries.
  - Run the pipeline in-process with `PYTHONPATH=.`, wrapping `backend.main.synthesize_briefing` to capture the articles.
  - For each development, classify:
    - **outlet:** any source with `image_url`;
    - **commons:** `commons_image` set and no outlet photo;
    - **none.**
  - Also count `topStories` order (priority, then newest, top 5).
  - Note per-briefing wall time against the earlier runs.
  - Spot-check 10 Tavily `image_url`s by opening them, and note any logos or banners.
  - Expected: "none" is 10% or less of developments.

- [ ] **Step 2: Run all the suites**

  Run: `PY -m pytest backend/tests -q` and, in `frontend/`, `npx vitest run && npm run build && npm run lint`
  Expected: all green.

- [ ] **Step 3: Write the "After" table and notes** into the spec, and update BACKLOG and CLAUDE.md.

- [ ] **Step 4: Commit**

```bash
git add docs CLAUDE.md
git commit -m "docs(photos): after-measurement, backlog and CLAUDE.md"
```
