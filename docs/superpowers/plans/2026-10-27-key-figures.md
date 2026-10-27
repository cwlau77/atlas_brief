# Key Figures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each development card shows up to three verified, sourced Key figures. Comparable figures are drawn as ink bars or 0–100% meters in the same rows.

**Architecture:** A fifth parallel Haiku section call (`figures`) extracts figures from the article list. `_parse_figures` keeps only figures found word for word in the cited article (restoring hedges like "around" and "below"). `attach_figures` puts each one on a development that cites its article. The figures call shares outlook's grace window and never fails the briefing. On the frontend, `lib/keyFigures.ts` parses the verbatim text **only for bar length** and groups comparable figures. `KeyFigures.tsx` renders the A1 rows inside `DevelopmentCard`.

**Tech Stack:** Python 3.11, FastAPI, pydantic, pytest (asyncio); React 18 + TypeScript, vitest, plain CSS with tokens.

**Spec:** `docs/superpowers/specs/2026-10-27-key-figures-design.md` (mockup `docs/superpowers/specs/assets/2026-10-27-key-figures-mockup.html`, layout A1). Read it before starting any task.

## Global Constraints

- Work in the worktree `/Users/camlau/Developer/atlas-key-figures`, branch `key-figures`. Never push.
- Python is `/Users/camlau/Developer/atlas/.venv/bin/python`. Backend tests: `.venv/bin/python -m pytest backend/tests -q`, run from the worktree root with the main checkout's venv: `/Users/camlau/Developer/atlas/.venv/bin/python -m pytest backend/tests -q`.
- Frontend checks (in `frontend/`): `npx vitest run`, `npx tsc -b`, `npm run lint` (3 pre-existing warnings are fine), `npm run build`.
- Every model call defaults to Haiku: `figures_model: str = "claude-haiku-4-5"`.
- Atlas never computes, converts, rounds or invents a figure. The displayed figure text is always the verified verbatim string.
- A figure is shown only on a card whose development cites the figure's article.
- At most 3 figures per card; the prompt asks for 0–12 per briefing.
- The figures call never fails, retries or delays developments, signals, alerts or outlook. It shares the single `OUTLOOK_GRACE_S` (3.0s) wait and emits **no** stream `section` event.
- Keep the `httpx`/`httpcore` loggers at WARNING (don't touch `main.py` logging).
- Design tokens only from `frontend/src/styles/tokens.css`; no new tokens, no literal colours, no red/amber in figures, no animation.
- Saved briefings without `keyFigures` must render exactly as today.
- Reshape existing components: `DevelopmentCard` gains one child; nothing is rewritten.

## Review Focus

1. **A figure inside a longer number:** "4.5%" against "14.5%", "20" against "200" or "20.5", "1,200" against "1,2000". Expect drop. Tested in Task 1.
2. **A hedge or bound the model left out:** "10%" when the article says "below 10%". Expect the figure to come back as "below 10%" and never be charted. Tested in Task 1 (restore) and Task 5 (no bar).
3. **The article cited by two cards, or by none:** expect one card only, and a drop when no card cites it. Tested in Task 2.
4. **A figures reply that is late, garbage or a JSON list, or a single malformed item among good ones:** expect the briefing to be unchanged except for missing figures, with the good items kept. Tested in Task 3 and Task 1.
5. **Undated article and mixed-unit figures** ("$5 billion" next to "€3bn", "43 hospitals" next to "8 ships"): expect an outlet-only link and no chart. Tested in Tasks 5 and 6.

---

### Task 1: KeyFigure model and verification

**Files:**
- Modify: `backend/models.py` (after `KeyDevelopment` / near `Relationship`)
- Modify: `backend/synthesis/briefing.py` (new helpers beside `_parse_outlook`)
- Test: `backend/tests/test_figures.py` (new)

**Interfaces:**
- Produces:
  - `FigureKind` and `FIGURE_KINDS` in `models.py`.
  - `class KeyFigure(BaseModel)` with fields `figure: str`, `label: str`, `kind: Optional[FigureKind] = None`, `period: Optional[str] = None`, `source: SourceCitation`.
  - `KeyDevelopment.key_figures: list[KeyFigure] = []`.
  - `_find_figure(hay: str, needle: str) -> int` in `briefing.py`: the start index of a whole-word match at both ends, or -1. Both arguments are already normalised.
  - `_parse_figures(raw: list, articles: list[Article]) -> list[KeyFigure]` in `briefing.py`. It never raises on a bad item. It raises `TypeError` only when `raw` is not a list.
  - `_FIGURE_QUALIFIERS: tuple[str, ...]`, holding the approximation words and the bound words from spec §3. Multi-word entries come first so "more than" wins over "than".

- [ ] **Step 1: Write the failing tests** in `backend/tests/test_figures.py`, using the `make_article` fixture:

```python
CEPR = ("China's average tariff on US goods rose from around 8% to roughly 20%, "
        "while its tariffs on other origins remained below 10%.")

def test_verbatim_figure_kept(make_article):
    a = make_article(title="Sudan: 19.5 Million Face Acute Hunger", snippet="")
    [f] = _parse_figures([{"figure": "19.5 Million", "label": "face acute hunger", "kind": "people", "source": 1}], [a])
    assert f.figure == "19.5 Million" and f.kind == "people" and f.source.url == a.url

@pytest.mark.parametrize("figure,text", [("4.5%", "growth of 14.5%"), ("20", "about 200 ships"),
                                         ("20", "rose 20.5 points"), ("1,200", "1,2000 units")])
def test_figure_inside_longer_number_dropped(make_article, figure, text):
    assert _parse_figures([{"figure": figure, "label": "x", "kind": "count", "source": 1}],
                          [make_article(title=text, snippet="")]) == []

@pytest.mark.parametrize("given,shown", [("8%", "around 8%"), ("20%", "roughly 20%"), ("10%", "below 10%")])
def test_hedge_restored_from_article(make_article, given, shown):
    [f] = _parse_figures([{"figure": given, "label": "tariff", "kind": "share", "source": 1}],
                         [make_article(title="Tariff evasion", snippet=CEPR)])
    assert f.figure == shown

def test_hedge_not_doubled(make_article):
    [f] = _parse_figures([{"figure": "around 8%", "label": "t", "kind": "share", "source": 1}],
                         [make_article(snippet=CEPR)])
    assert f.figure == "around 8%"

@pytest.mark.parametrize("item", [
    {"figure": "thousands", "label": "x", "source": 1},             # no digit
    {"figure": "34 million", "label": "x", "source": 1},            # not in article
    {"figure": "8%", "label": "x", "source": 9},                    # out of range
    {"figure": "8%", "label": "x", "source": {"url": "https://e"}}, # legacy dict
    {"figure": "8%", "label": "", "source": 1},                     # empty label
    {"figure": "8" * 41, "label": "x", "source": 1},                # too long
    "not a dict",
])
def test_bad_item_dropped_never_raises(make_article, item):
    assert _parse_figures([item], [make_article(snippet=CEPR)]) == []

def test_good_items_survive_a_bad_neighbour(make_article):
    a = make_article(snippet=CEPR)
    out = _parse_figures([{"figure": "8%", "label": "t", "source": 1}, None, {"figure": "20%", "label": "t", "source": 1}], [a])
    assert [f.figure for f in out] == ["around 8%", "roughly 20%"]

def test_period_kept_only_when_verbatim(make_article):
    a = make_article(snippet="Beginning in 2018 the tariff rose to roughly 20%.")
    [f] = _parse_figures([{"figure": "20%", "label": "t", "period": "in 2018", "source": 1}], [a])
    [g] = _parse_figures([{"figure": "20%", "label": "t", "period": "since 2016", "source": 1}], [a])
    assert f.period == "in 2018" and g.period is None

def test_unknown_kind_becomes_none_and_duplicates_collapse(make_article):
    a = make_article(snippet=CEPR)
    out = _parse_figures([{"figure": "8%", "label": "a", "kind": "ratio", "source": 1},
                          {"figure": "around 8%", "label": "b", "kind": "share", "source": 1}], [a])
    assert len(out) == 1 and out[0].kind is None

def test_label_capped_at_80_on_word_boundary(make_article):
    [f] = _parse_figures([{"figure": "8%", "label": "word " * 30, "source": 1}], [make_article(snippet=CEPR)])
    assert len(f.label) <= 80 and not f.label.endswith(" ")

def test_non_list_is_shape_error(make_article):
    with pytest.raises(TypeError):
        _parse_figures({"figure": "8%"}, [make_article()])

def test_key_development_without_figures_validates():
    d = KeyDevelopment(headline="h", summary="s", regions=[], sources=[])
    assert d.key_figures == []
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `/Users/camlau/Developer/atlas/.venv/bin/python -m pytest backend/tests/test_figures.py -q`
Expected: FAIL with an ImportError for `_parse_figures` / `KeyFigure`.

- [ ] **Step 3: Add the models.** In `backend/models.py`, add `FigureKind`, `FIGURE_KINDS`, `KeyFigure` and `KeyDevelopment.key_figures` exactly as in spec §1, with the spec's one-line comments.

- [ ] **Step 4: Implement `_find_figure` and `_parse_figures`** in `briefing.py`, following spec §3 in order:
  1. `_article_at` for the source.
  2. Digit and length checks.
  3. Find the figure with `_find_figure` on `_normalise_quote(title + " " + snippet)`.
  4. Restore the qualifier from the 1–2 normalised words just before the match.
  5. `kind` must be in `FIGURE_KINDS`.
  6. Keep `period` only if `_find_whole` finds it in the same article.
  7. Dedupe on `(url, _normalise_quote(final figure))`.

  The end-boundary check rejects a next character that is alphanumeric, or a `.`/`,` followed by a digit. Build the citation with `_fallback_citations([article])[0]`. Strip surrounding quote marks from the figure as `_parse_outlook` does.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `/Users/camlau/Developer/atlas/.venv/bin/python -m pytest backend/tests/test_figures.py backend/tests/test_outlook.py -q`
Expected: PASS. The outlook tests stay green, because `_find_whole` is unchanged.

- [ ] **Step 6: Commit**

```bash
git add backend/models.py backend/synthesis/briefing.py backend/tests/test_figures.py
git commit -m "feat(synthesis): KeyFigure model; figures verified word for word, hedges restored"
```

---

### Task 2: Attach figures to cards; allowlist rule

**Files:**
- Modify: `backend/synthesis/briefing.py` (`attach_figures`, `enforce_url_allowlist`)
- Test: `backend/tests/test_figures.py`

**Interfaces:**
- Consumes: `KeyFigure`, `_parse_figures` (Task 1).
- Produces: `attach_figures(devs: list[KeyDevelopment], figures: list[KeyFigure]) -> int`. It sets each development's `key_figures` in place and returns how many figures it attached, for the log line.

- [ ] **Step 1: Write the failing tests.** Build developments and figures directly as pydantic objects, citing URLs `u1`, `u2`, `u3`:

```python
def test_figure_goes_only_to_a_citing_card():          # dev0 cites u1, dev1 cites u2; figure from u2 → dev1 only
def test_figure_from_uncited_article_dropped():        # figure from u3 → attached count 0, no dev has it
def test_shared_article_goes_to_best_word_overlap():   # both cite u1; label "acute hunger" overlaps dev1 summary → dev1
def test_overlap_tie_goes_to_earlier_card():           # both cite u1, no overlap → dev0
def test_at_most_three_per_card_in_model_order():      # five figures for dev0 → first three kept
def test_allowlist_drops_figure_whose_source_is_stripped():   # figure source url not in allowed → removed
def test_allowlist_drops_figure_no_longer_cited_by_its_card(): # dev.sources loses u1 to the allowlist → its u1 figure removed
```

- [ ] **Step 2: Run them and confirm they fail.** Run `/Users/camlau/Developer/atlas/.venv/bin/python -m pytest backend/tests/test_figures.py -q`. Expected: FAIL (`attach_figures` is not defined).

- [ ] **Step 3: Implement `attach_figures`.** The rules are in spec §4. Content words are lower-cased `[a-z]{4,}` tokens of the label, compared against `headline + " " + summary`. In `enforce_url_allowlist`, right after `dev.sources = _keep(dev.sources)`, keep a figure only if its `source.url` is in `allowed` and in `{s.url for s in dev.sources}`.

- [ ] **Step 4: Run them and confirm they pass.** Run the same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(synthesis): figures attach only to cards citing their article"
```

---

### Task 3: The figures section call

**Files:**
- Modify: `backend/synthesis/briefing.py` (`_SECTION_SHAPES["figures"]`, `synthesize_briefing`)
- Modify: `backend/config.py`, `backend/.env.example`
- Test: `backend/tests/test_synthesis.py`, `backend/tests/test_config.py` (or `test_figures.py` for the config default, following `test_outlook.py::test_config_outlook_model_defaults_to_haiku`)

**Interfaces:**
- Consumes: `_parse_figures`, `attach_figures`.
- Produces:
  - Settings `figures_model: str = "claude-haiku-4-5"` and `key_figures_enabled: bool = True`.
  - `.env.example` lines `FIGURES_MODEL=claude-haiku-4-5` and `KEY_FIGURES_ENABLED=true`, each with a one-line comment in the file's style.
  - The developments returned by `synthesize_briefing` carry `key_figures`.

- [ ] **Step 1: Add the fixture reply and write the failing tests.** In `test_synthesis.py`, add `"key_figures"` to `SECTION_REPLIES`. Use an article whose snippet holds "19.5 million". The reply is `{"key_figures": [{"figure": "19.5 million", "label": "face acute hunger", "kind": "people", "source": 1}]}`. Then add these tests:
  - `test_figures_attached_to_developments`: the briefing's `key_developments[0].key_figures[0].figure == "19.5 million"`.
  - `test_figures_call_uses_figures_model_and_cap`: the `key_figures` call has `model == settings.figures_model` and `max_tokens == 1200`.
  - `test_figures_failure_or_junk_leaves_cards_without_figures` (parametrised `"garbage"`, `"[]"`, `'{"key_figures": "x"}'`): every other section is intact, `key_figures == []`, and the developments call was made exactly once.
  - `test_slow_figures_dropped_within_shared_grace`: `OUTLOOK_GRACE_S = 0.05`, the figures call sleeps 5s, the briefing still finishes in under 1s, and the log has `section=figures status=late`.
  - `test_figures_and_outlook_share_one_grace_window`: both sleep 5s, and the total stays under 1s, not two grace periods.
  - `test_figures_emits_no_section_event`: `"figures"` is not among the `on_section` names.
  - `test_figures_disabled_makes_no_call`: with `key_figures_enabled=False`, no prompt contains `"key_figures"`.
  - `test_config_figures_model_defaults_to_haiku`.

  Update `test_sections_are_written_by_separate_calls_and_merged` (and any other test that counts calls) for the fifth call.

- [ ] **Step 2: Run them and confirm they fail.** Run `/Users/camlau/Developer/atlas/.venv/bin/python -m pytest backend/tests/test_synthesis.py -q`. Expected: the new tests FAIL.

- [ ] **Step 3: Implement.**
  1. Add the `figures` shape and constraints to `_SECTION_SHAPES`, verbatim from spec §2.
  2. In `synthesize_briefing`, start a figures task at the same point as `outlook_task` (only when `settings.key_figures_enabled`). It calls `_write_section("figures", …, parse=lambda d: _parse_figures(d["key_figures"], articles), model=settings.figures_model, max_tokens=1200)` and catches every exception, returning `[]` with a `synthesis section=figures status=failed` warning.
  3. Replace the single `wait_for(shield(outlook_links), OUTLOOK_GRACE_S)` with one wait over both tasks under the same deadline (e.g. `asyncio.wait({…}, timeout=OUTLOOK_GRACE_S)`). Then handle each one: done gives its result; pending is cancelled and logged as `status=late`. Keep outlook's existing `report("outlook")` and exception behaviour exactly.
  4. Call `attach_figures(devs, figures)` before `assign_images`.
  5. Log `figures asked=%d verified=%d attached=%d`.
  6. Cancel the figures task in the existing `except BaseException` cleanup.

- [ ] **Step 4: Run the whole backend suite and confirm it passes.** Run `/Users/camlau/Developer/atlas/.venv/bin/python -m pytest backend/tests -q`. Expected: everything PASSES, including the existing outlook grace tests.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(synthesis): parallel Haiku figures call within outlook's grace window"
```

---

### Task 4: Frontend types and saved-briefing defaults

**Files:**
- Modify: `frontend/src/lib/types.ts`, `frontend/src/lib/normalize.ts`, `frontend/src/test/fixtures.ts` (`makeBriefing`: `keyFigures: []` on each development)
- Test: `frontend/src/lib/normalize.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `interface KeyFigure { figure: string; label: string; kind?: string | null; period?: string | null; source: SourceCitation }`, plus `KeyDevelopment.key_figures?: KeyFigure[]`.
  - `normalize.ts`: `type FigureKind = 'people' | 'money' | 'share' | 'change' | 'count' | 'other'` and `interface ViewKeyFigure { figure: string; label: string; kind: FigureKind | null; period: string | null; source: SourceCitation }`.
  - `ViewDevelopment.keyFigures: ViewKeyFigure[]`.

- [ ] **Step 1: Write the failing tests** in `normalize.test.ts`:
  - The API → view mapping maps `key_figures` to `keyFigures` and turns an unknown `kind` (`"ratio"`) into `null`.
  - A missing `key_figures` gives `[]`.
  - `withDefaults` on a saved briefing whose developments have no `keyFigures` gives `keyFigures: []`, and every other field is unchanged.

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run src/lib/normalize.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Make the field mapping beside `historicalContext` (normalize.ts:178). In `withDefaults`, add `keyFigures: d.keyFigures ?? []` to the per-development spread. Narrow `kind` with a `FIGURE_KINDS` list, following `RELATIONSHIPS`.

- [ ] **Step 4: Run them and confirm they pass.** Run `npx vitest run && npx tsc -b`. Expected: PASS, and tsc is clean.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(story): key figures in the view model; saved briefings default to none"
```

---

### Task 5: Parsing for bar length and grouping

**Files:**
- Create: `frontend/src/lib/keyFigures.ts`
- Test: `frontend/src/lib/keyFigures.test.ts`

**Interfaces:**
- Consumes: `ViewKeyFigure` (Task 4).
- Produces:
  - `parseFigure(text: string): { value: number; unit: string; bound: boolean } | null`.
  - `figureGroups(figures: ViewKeyFigure[], timeZone: string)`, which returns:

    ```ts
    {
      chart: {
        scale: 'bars' | 'meter'
        rows: { figure: ViewKeyFigure; width: number | null; note: string | null }[]
        caption: string
      } | null
      plain: ViewKeyFigure[]
    }
    ```

    `width` is a percentage from 0 to 100, or `null` for no bar. `note` is `'a limit, not charted'` for a bound and `null` otherwise.
  - A file-top comment stating that the parsed value only sets bar length and is never shown.

- [ ] **Step 1: Write the failing tests:**

```ts
it.each([
  ['34 million people', 34e6, 'count:people', false], ['19.5 million', 19.5e6, 'count:', false],
  ['Nearly 14 million', 14e6, 'count:', false], ['$5 billion', 5e9, 'money:$', false],
  ['US$2.3bn', 2.3e9, 'money:US$', false], ['around 8%', 8, 'percent', false],
  ['below 10%', 10, 'percent', true], ['at least 43 hospitals', 43, 'count:hospitals', true],
  ['1,200 troops', 1200, 'count:troops', false], ['12 per cent', 12, 'percent', false],
])('parseFigure(%s)', (t, value, unit, bound) => expect(parseFigure(t)).toEqual({ value, unit, bound }))
it.each(['10–15%', '3/4', 'two dozen', '5 to 7 million'])('parseFigure(%s) is null', (t) => expect(parseFigure(t)).toBeNull())
```

  `figureGroups` cases:
  - **Sudan:** three `people` figures from three outlets dated 21, 26 and 21 Oct. Expect bars with widths `[100, 57.35…, 41.17…]` and the caption `'People · one scale from zero · 3 outlets, 21–26 Oct'`.
  - **CEPR:** around 8%, roughly 20% and below 10% (`share`, one outlet, 26 Oct). Expect a meter with widths `[8, 20, null]`, the last row's note `'a limit, not charted'`, and the caption `'Shares of 100% · 1 outlet, 26 Oct'`.
  - **Money with mixed currencies** ("$5 billion", "€3bn"): `chart` is null and both figures are plain.
  - **`count` with different nouns** ("43 hospitals", "8 ships"): no chart.
  - **`change` or `other` kinds, a share over 100 ("120%"), or a single figure:** no chart.
  - **Three figures where two are people and one is money:** a two-row chart, with the money figure in `plain`.

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run src/lib/keyFigures.test.ts`. Expected: FAIL (the module is missing).

- [ ] **Step 3: Implement**, following spec §5:
  - The qualifier lists mirror backend `_FIGURE_QUALIFIERS`.
  - People ignore the noun when comparing units.
  - The date span uses `formatDayMonth` (`lib/time.ts`) on each figure's `source.published_at`; undated figures don't count toward the span.
  - Group rows keep model order, and the group is the largest qualifying same-kind set.
  - Use `plural` from `lib/plural` for "outlet".

- [ ] **Step 4: Run them and confirm they pass.** Run `npx vitest run src/lib/keyFigures.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/keyFigures.ts frontend/src/lib/keyFigures.test.ts
git commit -m "feat(story): figure grouping; numbers parsed only for bar length"
```

---

### Task 6: KeyFigures block on the development card

**Files:**
- Create: `frontend/src/components/briefing/KeyFigures.tsx`, `frontend/src/components/briefing/KeyFigures.test.tsx`
- Modify: `frontend/src/components/briefing/DevelopmentCard.tsx` (render `<KeyFigures figures={dev.keyFigures} timeZone={timeZone} />` directly after `<p className="dev-body">`), `frontend/src/components/briefing/story.css`, `frontend/src/components/briefing/DevelopmentCard.test.tsx`

**Interfaces:**
- Consumes: `figureGroups` (Task 5), `ViewKeyFigure` (Task 4), `formatDayMonth`.
- Produces: `KeyFigures({ figures, timeZone }: { figures: ViewKeyFigure[]; timeZone: string })`.

- [ ] **Step 1: Write the failing tests** in `KeyFigures.test.tsx`, using the `createRoot`/`act` pattern from `DevelopmentCard.test.tsx`:
  - It renders nothing for `[]`.
  - Sudan fixture:
    - the heading is `Key figures`;
    - there is a `ul[aria-label="Key figures"]` with 3 `li`;
    - the bar widths are `100%`, `57.35…%` and `41.17…%`;
    - the bar cells are `aria-hidden="true"`;
    - the caption text matches Task 5;
    - the links have `target="_blank"` and `rel="noopener noreferrer"`, text `news.un.org, 21 Oct ↗`, and `aria-label="Read in news.un.org: 34 million people need humanitarian support"`.
  - CEPR fixture: the third row shows `a limit, not charted`, and the period is shown after the label.
  - An undated source renders link text `thediplomat.com ↗`.
  - A single figure renders with no bar cell and no caption.

  In `DevelopmentCard.test.tsx`, a development with `keyFigures: []` renders no `.kf`, and one with figures renders `.kf` after `.dev-body`.

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run src/components/briefing`. Expected: FAIL.

- [ ] **Step 3: Implement the component and CSS.** Follow the markup, grid, colours, caption and states in spec §6 and mockup A1. Port the `.kf*` rules from the mockup's `<style>` into `story.css`, using only token variables. Bars are `--ink-2`, the meter track is `--rule`, and bars have square ends. The zero baseline is a 1px `--ink-3` hairline. Under `.dev.is-dim`, figure text and bars go to `--ink-3` / `--rule-strong`. Below 640px the figure column is `8.5em`. There is no transition.

- [ ] **Step 4: Run every frontend check and confirm it passes.** Run `npx vitest run && npx tsc -b && npm run lint && npm run build` in `frontend/`. Expected: PASS, with only the 3 pre-existing lint warnings.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/briefing
git commit -m "feat(story): Key figures rows on development cards, bars when comparable"
```

---

### Task 7: Docs and live check

**Files:**
- Modify: `CLAUDE.md`. In the pipeline paragraph, cover the figures call, the shared grace, `_parse_figures`, `attach_figures` and the allowlist rule. In the Story tab paragraph, cover the Key figures block and that `lib/keyFigures.ts` parses only for bar length.
- Modify: `docs/BACKLOG.md`. Remove the item from "0. Next up" and record it as shipped the way earlier items were.

- [ ] **Step 1: Update both docs** in the existing voice, one or two sentences each.
- [ ] **Step 2: Live check.**
  1. Stop anything on ports 8000 and 5173.
  2. Run the backend (`/Users/camlau/Developer/atlas/.venv/bin/python -m uvicorn backend.main:app --reload --port 8000` from the worktree root) and `npm run dev` in `frontend/`.
  3. Generate "Sudan humanitarian crisis", "US China tariffs", "Red Sea shipping" and "Nvidia earnings".
  4. Confirm:
     - each end-to-end time is within about 2s of the 25–27s baseline;
     - every briefing logs a `figures asked=… verified=… attached=…` line;
     - cards match mockup A1 at desktop and at 390px wide;
     - an older saved briefing from the history still renders.

  Use headless Chrome over CDP if the extension isn't connected (memory note "Live check via headless Chrome"). Costs about 5¢ per briefing.
- [ ] **Step 3: Commit**

```bash
git commit -am "docs: key figures in CLAUDE.md; backlog item shipped"
```
