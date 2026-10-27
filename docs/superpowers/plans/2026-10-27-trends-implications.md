# Trends & Implications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Story-tab "Trends & implications" section. Every item is either Reported (a verbatim quote checked against the cited article, with a link) or an Atlas assessment (labelled, and linked to the developments it reasons from). It comes from a cheap parallel Haiku call that can never slow or fail the briefing.

**Architecture:**
- A fourth optional section call, `outlook`, runs alongside developments, signals and alerts. It's capped at 3s past the rest, then dropped.
- `_parse_outlook` applies the quote check, downgrading an item to an assessment when it fails.
- `link_outlook` (a sibling of `link_signals`) plus a citation-overlap fallback sets `related_developments`; an assessment with no links is dropped. `enforce_url_allowlist` re-applies both rules.
- Frontend: `lib/outlook.ts` builds rows, and `OutlookSection` renders them in `.kd-main` between the timeline and the tension index. It shares a `TiesList` extracted from `TensionIndex`, and hover moves the globe via `highlight.preview`.

**Tech Stack:** FastAPI, Pydantic v2 and pytest (asyncio) for the backend; React, TypeScript, Vite and vitest with Testing Library for the frontend.

**Spec:** `docs/superpowers/specs/2026-10-27-trends-implications-design.md`

## Global Constraints

- Work in `/Users/camlau/Developer/atlas-trends` (branch `story/trends-implications`). Never push.
- Python: `/Users/camlau/Developer/atlas/.venv/bin/python`. Backend tests: `.venv/bin/python -m pytest backend/tests -q`, run from the worktree root with that interpreter.
- Frontend checks, in `frontend/`: `npx vitest run`, `npx tsc -b`, `npm run lint` (3 pre-existing warnings), `npm run build`.
- `outlook_model: str = "claude-haiku-4-5"`; outlook `max_tokens=1500`; `OUTLOOK_GRACE_S = 3.0`; `LINK_BUDGET_S = 6.0` (reuse it).
- Counts: 0–3 trends, 0–3 implications. Quotes need at least 4 words; the prompt asks for at most 30.
- Copy, exactly:
  - "Trends & implications", "Trends", "Implications"
  - "Reported", "Atlas assessment"
  - "Builds on", "Reasoned from", "Watch for"
  - legend: "Reported: an outlet says it, quoted and linked" and "Atlas assessment: Atlas's own reading, not reported fact"
  - empty list: "Not tied to one development in this brief"
  - ledger label: "Trends"
- No new tokens; colours come only from `frontend/src/styles/tokens.css` variables. No `--hot`, `--warm` or their `-ink` variants in outlook CSS. Any transition sits inside `@media (prefers-reduced-motion: no-preference)`.
- Keep the `httpx`/`httpcore` loggers at WARNING (don't touch `main.py` logging). The backend stays a single process.
- Saved briefings without `trends` or `implications` must render (no section).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Citations that aren't ints** (`"3"`, `3.0`, a dict). They must never count as Reported, because `_article_at` rejects them. An assessment with nothing usable is dropped unless the link call links it. Test in Task 1.
2. **A quote across the title/snippet seam, or one ending in "…" or quoted with curly quotes.** It should verify when the words are there. Test in Task 1.
3. **A new frontend on an old backend** (deploys aren't atomic). The ledger must still finish writing without an `outlook` event. `written` waits only for developments, signals and alerts; the Trends line ticks when its event comes. This is a deliberate narrowing of spec §8. Test in Task 6.
4. **`published_at` null on a Reported source.** The link shows the outlet only, with no "· date" and no "Invalid Date". Test in Task 5.
5. **A saved briefing re-read through `withDefaults` with only one of the two lists, or an unknown `basis` string.** It renders, and the unknown basis reads as an assessment. Test in Task 4.

---

### Task 1: Outlook model, config and parsing with the quote check

**Files:**
- Modify: `backend/models.py` (add `Basis`, `OutlookItem`; `Briefing.trends`, `Briefing.implications`)
- Modify: `backend/config.py` (add `outlook_model` after `context_model`), `backend/.env.example` (`OUTLOOK_MODEL=claude-haiku-4-5` after `CONTEXT_MODEL`)
- Modify: `backend/synthesis/briefing.py` (`_normalise_quote`, `_parse_outlook`, used in `briefing_from_data`)
- Create: `backend/tests/test_outlook.py`

**Interfaces:**
- Produces:
  - `models.Basis = Literal["reported", "assessment"]`
  - `models.OutlookItem(statement: str, basis: Basis, quote: Optional[str] = None, sources: list[SourceCitation], watch_for: Optional[str] = None, related_developments: Optional[list[int]] = None)`
  - `Briefing.trends: list[OutlookItem] = []`, `Briefing.implications: list[OutlookItem] = []`
  - `briefing._parse_outlook(raw: list, articles: list[Article], *, implications: bool) -> list[OutlookItem]` (a shape error, such as a missing `statement`, raises `KeyError`/`TypeError` so `_write_section` retries)
  - `briefing_from_data` reads `data.get("trends", [])` and `data.get("implications", [])`

- [ ] **Step 1: Write failing tests** in `backend/tests/test_outlook.py`, using the `make_article` fixture with explicit `title`/`snippet`:
  - `test_reported_quote_found_in_cited_article_stays_reported`: article 1's snippet is `“Premiums are likely to remain elevated well into 2027,” brokers said.` and the item quote is `premiums are  likely to remain elevated well into 2027…`. Expect `basis == "reported"`, the quote kept as the model wrote it but stripped, and `len(sources) == 1`.
  - `test_quote_spanning_title_and_snippet_verifies`: the last two words of the title plus the first two of the snippet. Expect Reported.
  - `test_reported_sources_narrowed_to_matching_article`: it cites `[1, 2]` and only 2 holds the quote. Expect `[s.url for s in sources] == [article2.url]`.
  - `test_paraphrase_is_downgraded` (parametrize):
    - a paraphrase;
    - a 3-word quote that matches;
    - a quote present only in an uncited article 2;
    - `quote: None`;
    - citations `["1"]`;
    - citations `[1.0]`.
    
    Expect `basis == "assessment"` and `quote is None`. Expect sources to be kept when they resolved: the paraphrase, 3-word and uncited cases have 1 source; the string and float citation cases have 0.
  - `test_unknown_basis_is_assessment`: `basis: "rumour"` becomes `"assessment"`.
  - `test_watch_for_only_on_implications`: `watch_for` is dropped from a trend and kept on an implication; `""` becomes `None`.
  - `test_missing_statement_is_shape_error`: `briefing_from_data({"trends": [{"basis": "assessment"}]}, ...)` raises `KeyError`.
  - `test_older_briefing_dict_without_outlook_validates`: `Briefing.model_validate(<dict without trends/implications>)` gives `.trends == []`.
  - `test_fallback_briefing_has_no_outlook`: `_fallback_briefing(...)` has `trends == implications == []`.
  - `test_config_outlook_model_defaults_to_haiku`: `Settings().outlook_model == "claude-haiku-4-5"` (follow `test_config.py`'s pattern for constructing settings without the `.env`).

- [ ] **Step 2: Run** `.venv/bin/python -m pytest backend/tests/test_outlook.py -q`. Expected: FAIL (import or attribute errors).

- [ ] **Step 3: Implement the models and config, then `_normalise_quote(text: str) -> str` and `_parse_outlook` in `briefing.py`.**

  `_normalise_quote` does the following, in order:
  1. casefold;
  2. map `‘ ’ ‚ ‛ ′` to `'` and `“ ” „ ‟ ″` to `"`, and `– — ‒ ―` to `-`;
  3. drop `…` and `...`;
  4. collapse whitespace to single spaces;
  5. strip whitespace plus `"'.,;:!?-`.

  Rules for `_parse_outlook`:
  - **Haystack:** `_normalise_quote(f"{a.title} {a.snippet}")`.
  - **Word count:** count the words of the normalised quote.
  - **Citations:** resolve only through `_article_at` (ints), deduped and in order. Legacy dicts are ignored for outlook.
  - **Statement:** `statement = str(item["statement"]).strip()`. An empty string raises `KeyError("statement")`.
  - Keep one line of comment per rule, matching the file's density.

- [ ] **Step 4: Run** the new file, then the whole suite. Expected: PASS. The existing `test_synthesis.py` still passes, since nothing calls outlook yet.

- [ ] **Step 5: Commit** `feat(synthesis): outlook items with a checked quote for Reported`.

### Task 2: Linking outlook items to developments

**Files:**
- Modify: `backend/synthesis/links.py` (add `OUTLOOK_LINK_PROMPT`, `_outlook_prompt`, `link_outlook`)
- Modify: `backend/synthesis/briefing.py` (add `settle_outlook`)
- Test: `backend/tests/test_links.py`, `backend/tests/test_outlook.py`

**Interfaces:**
- Consumes: `OutlookItem`, `KeyDevelopment` (Task 1); the existing `_side`, `_indexes`, `LINK_BUDGET_S`.
- Produces:
  - `links.link_outlook(devs: list[KeyDevelopment], trends: list[OutlookItem], implications: list[OutlookItem]) -> tuple[list[list[int] | None], list[list[int] | None]]`. It never raises, and is skipped (all `None`) without a key, without devs, or with no items.
  - `briefing.settle_outlook(items: list[OutlookItem], devs: list[KeyDevelopment]) -> list[OutlookItem]`. It applies the citation-overlap fallback to items whose `related_developments is None`, downgrades a Reported item with no sources, and drops assessments whose list is empty. It's idempotent.

- [ ] **Step 1: Write failing tests.**

  In `test_links.py`, mirroring the `link_signals` tests:
  - `test_link_outlook_sends_both_lists_and_uses_context_model`: asserts `model == settings.context_model`, and that the prompt contains `TRENDS:` and `IMPLICATIONS:` with the statements.
  - `test_link_outlook_skipped_without_items`
  - `test_link_outlook_timeout_returns_none`
  - `test_link_outlook_bad_json_returns_none`

  The reply shape is `{"trends": [[...]], "implications": [[...]]}`.

  In `test_outlook.py`:
  - `test_overlap_fallback_links_devs_sharing_a_source_url`: the item's `related_developments=None`, and dev 1 shares a URL. Expect `[1]`.
  - `test_link_result_wins_over_overlap`: `related_developments=[0]` is left alone even when dev 1 shares a URL.
  - `test_unlinked_assessment_dropped_unlinked_reported_kept`
  - `test_reported_without_sources_downgraded_then_dropped_if_unlinked`

- [ ] **Step 2: Run** both files. Expected: FAIL.

- [ ] **Step 3: Implement `link_outlook`**, reusing `_side` and the 6s budget.
  - The system prompt follows `LINK_SYSTEM_PROMPT`'s wording, but for "trends and implications". Each statement is shown as `[i] <statement>` under `TRENDS:` and `IMPLICATIONS:`, inside the same BEGIN/END DATA fence. Use `max_tokens=400`. The user prompt must not contain the literal `"trends"` (quoted), because the test fake in `test_synthesis.py` routes prompts by that key.
  - Log failures as `"outlook linking failed: %s"`.
  - Implement `settle_outlook` in `briefing.py`.

- [ ] **Step 4: Run** both files. Expected: PASS.

- [ ] **Step 5: Commit** `feat(synthesis): link outlook items to developments`.

### Task 3: Wire the outlook section into synthesis, the allowlist and the ledger event

**Files:**
- Modify: `backend/synthesis/briefing.py`:
  - `_SECTION_SHAPES["outlook"]`;
  - `_write_section` gains `model: str | None = None, max_tokens: int | None = None`, and `_optional_section` passes them through;
  - `synthesize_briefing` (an outlook task, the grace period, the link task, the report);
  - `enforce_url_allowlist`.
- Modify: `CLAUDE.md`:
  - the pipeline paragraph says the section calls run on `synthesis_model` (Haiku by default), not Sonnet;
  - add a sentence on the outlook section after the links sentence: what it is, `outlook_model`, the 3s grace, the quote check, `link_outlook`.
- Test: `backend/tests/test_synthesis.py`, `backend/tests/test_outlook.py`

**Interfaces:**
- Consumes: `_parse_outlook`, `settle_outlook` (Tasks 1–2), `link_outlook` (Task 2).
- Produces: briefings with `trends` and `implications` filled; an `on_section("outlook")` report in every case.

- [ ] **Step 1: Write failing tests.**

  In `test_synthesis.py`, add `"trends"` to `SECTION_REPLIES`:

  ```python
  "trends": {"trends": [{"statement": "TS", "basis": "assessment", "quote": None, "sources": [1]}],
             "implications": [{"statement": "IS", "basis": "assessment", "quote": None,
                               "watch_for": "W", "sources": [1]}]},
  ```

  Then:
  - In `test_sections_are_written_by_separate_calls_and_merged`, the expected `seen` set gains `"trends"`. Assert `b.trends[0].statement == "TS"`, `b.implications[0].watch_for == "W"`, and `b.trends[0].related_developments == [0]`: the fake's context replies aren't link JSON, so this comes from the overlap fallback, since both cite article 1.
  - `test_outlook_uses_outlook_model_and_small_max_tokens`: capture kwargs for the outlook prompt and assert `model == settings.outlook_model` and `max_tokens == 1500`. The other sections still use `settings.synthesis_model`.
  - `test_outlook_failure_leaves_lists_empty`: the outlook reply is garbage twice. The briefing returns with `trends == []` and the rest intact.
  - `test_slow_outlook_is_dropped_after_grace` (`@pytest.mark.asyncio`): monkeypatch `briefing.OUTLOOK_GRACE_S` to `0.05`, and make the outlook fake `await asyncio.sleep(5)`. Assert the call returns in under 1s, with `trends == []`, and a log record containing `section=outlook status=late`.
  - `test_outlook_reports_its_section_in_every_case` (parametrize ok, fail, late): `on_section` collects names, and `"outlook"` is among them exactly once.
  - `test_outlook_links_do_not_wait_for_signals`: the signals fake sleeps 0.3s, and the outlook link call (identified by `TRENDS:` in the prompt) records `time.monotonic()`. Assert it started before signals finished.

  In `test_outlook.py`:
  - `test_allowlist_downgrades_reported_that_lost_its_source`: build a `Briefing` with a Reported trend whose only source URL isn't allowed and which has `related_developments=[0]`. After `enforce_url_allowlist`, expect `basis == "assessment"` and the item kept.
  - `test_allowlist_drops_unlinked_reported_that_lost_its_source`: same, but with `related_developments=[]`. Expect it dropped.

- [ ] **Step 2: Run** both files. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **The prompt:** `_SECTION_SHAPES["outlook"]` is the spec §3 block verbatim. Its JSON keys are `"trends"` and `"implications"`; the test fake keys on `"trends"`.
  - **`synthesize_briefing`:**
    1. Start `outlook_task = asyncio.create_task(reported("outlook", model=settings.outlook_model, max_tokens=1500))` beside `signals_task`. Extend `reported` to forward those keyword arguments to `_optional_section`.
    2. Start `outlook_links = asyncio.create_task(...)`, which awaits developments (via an `asyncio.Future`/`Event` set inside `developments()` once `partial` exists) and `outlook_task`, then runs `link_outlook`.
    3. After the main `gather`, await `asyncio.wait_for(asyncio.shield(outlook_links), OUTLOOK_GRACE_S)`.
    4. On `TimeoutError`, cancel `outlook_task` and `outlook_links`, log a warning `synthesis section=outlook status=late`, and call `report("outlook")` if outlook hadn't reported.
    5. Track "reported" with a flag so the report happens exactly once.
  - **Assembly:** parse the outlook data with `_parse_outlook`, assign the links, and run `settle_outlook` against `devs`. On any exception in this step, log it and leave the lists empty.
  - **Cancellation:** the existing `except BaseException` cancel path also cancels the two outlook tasks.
  - **Logging:** log `outlook reported=%d assessment=%d downgraded=%d dropped=%d`. Have `_parse_outlook` count downgrades through a small counter argument, or derive them; builder's choice.
  - **`enforce_url_allowlist`:** `_keep` sources on both lists, then `briefing.trends = settle_outlook(briefing.trends, briefing.key_developments)`, and the same for implications.

- [ ] **Step 4: Run** the full backend suite. Expected: all PASS.

- [ ] **Step 5: Commit** `feat(synthesis): outlook section in parallel, dropped after a 3s grace`.

### Task 4: Frontend types, normalisation and `buildOutlook`

**Files:**
- Modify: `frontend/src/lib/types.ts` (add `OutlookItem`; `ApiBriefing.trends?`, `ApiBriefing.implications?`)
- Modify: `frontend/src/lib/normalize.ts` (add `OutlookBasis`, `ViewOutlook`; `SavedBriefing.trends?`, `SavedBriefing.implications?`; map them in `normalizeBriefing` and `withDefaults`)
- Create: `frontend/src/lib/outlook.ts`, `frontend/src/lib/outlook.test.ts`
- Test: `frontend/src/lib/normalize.test.ts`

**Interfaces:**
- Produces:
  - `type OutlookBasis = 'reported' | 'assessment'`
  - `interface ViewOutlook { statement: string; basis: OutlookBasis; quote: string | null; sources: SourceCitation[]; watchFor: string | null; relatedDevelopments: number[] | null }`
  - `BASIS_LABELS: Record<OutlookBasis, string>` = `{ reported: 'Reported', assessment: 'Atlas assessment' }`
  - `interface OutlookRow { key: string; kind: 'trend' | 'implication'; basis: OutlookBasis; statement: string; quote: string | null; source: SourceCitation | null; watchFor: string | null; devs: number[]; linked: { dev: number; title: string; timestamp: string }[] }`
  - `buildOutlook(b: Pick<SavedBriefing, 'keyDevelopments' | 'trends' | 'implications'>, order: TimelineEntry[]): { trends: OutlookRow[]; implications: OutlookRow[] }`. Keys are `trend-${i}` and `implication-${i}`, where `i` is the item's index in its saved list. Rows are sorted with Reported first, then by that index. Assessments with empty `linked` are removed. `devs` is the valid indexes from `relatedDevelopments ?? []`.

- [ ] **Step 1: Write failing tests.**
  - `normalize.test.ts`:
    - API `trends` and `implications` map to the view shape (`watch_for` becomes `watchFor`, null-safe);
    - `basis: 'rumour'` becomes `'assessment'`;
    - an API briefing without the fields gives `trends: []`, `implications: []`;
    - `withDefaults` on a saved briefing lacking both, or holding only `trends`, gives arrays, and maps an unknown basis to `'assessment'` (Review Focus 5).
  - `outlook.test.ts`:
    - Reported first;
    - `linked` in timeline (newest-first) order;
    - an unlinked assessment is hidden and an unlinked Reported item is kept;
    - out-of-range dev indexes are ignored;
    - keys keep the saved index after sorting.

- [ ] **Step 2: Run** `npx vitest run src/lib/normalize.test.ts src/lib/outlook.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Build `linked` the same way as in `buildTensionIndex` (filter `order`).

- [ ] **Step 4: Run** the same command plus `npx tsc -b`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(story): outlook view model and rows`.

### Task 5: `TiesList` extraction and `OutlookSection`

**Files:**
- Create: `frontend/src/components/briefing/TiesList.tsx`, `frontend/src/components/briefing/OutlookSection.tsx`, `frontend/src/components/briefing/OutlookSection.test.tsx`
- Modify: `frontend/src/components/briefing/TensionIndex.tsx` (its `.index-ties` block becomes `<TiesList label="Ties to" …/>`)
- Modify: `frontend/src/components/briefing/story.css` (add an `/* Trends & implications */` block after the tension index rules; extend the print block)
- Test: `frontend/src/components/briefing/TensionIndex.test.tsx` (unchanged; it must still pass), `storyCss.test.ts`

**Interfaces:**
- Consumes: `OutlookRow`, `BASIS_LABELS` (Task 4); `IndexHighlight['preview']`; `formatDayMonth` (`lib/time`).
- Produces:
  - `TiesList({ label, linked, timeZone, onJump }: { label: string; linked: { dev: number; title: string; timestamp: string }[]; timeZone: string; onJump: (dev: number) => void })`. It renders today's `.index-ties` markup exactly. `onJump` is called inside the button click; `TensionIndex` passes `(dev) => { preview(null); onOpen(\`dev-${dev}\`) }`.
  - `OutlookSection({ trends, implications, timeZone, preview, onOpen }: { trends: OutlookRow[]; implications: OutlookRow[]; timeZone: string; preview: (key: string | null) => void; onOpen: (anchorId: string) => void })`. It returns `null` when both lists are empty.

- [ ] **Step 1: Write failing tests** in `OutlookSection.test.tsx`:
  - It renders the `h2` "Trends & implications", the legend text (both strings verbatim) and `h3` "Trends"/"Implications". An `h3` is omitted when its list is empty.
  - A Reported row shows "Reported", the quote in a `q`, and a link with `href` equal to the source URL, accessible name `Read in Reuters: <statement>`, text `Reuters · 26 Oct`, `target="_blank"` and `rel` containing `noopener`.
  - A Reported row whose source has `published_at: null` shows link text `Reuters` only (Review Focus 4).
  - An assessment row shows "Atlas assessment", with no `q` and no link.
  - "Builds on" appears on Reported rows and "Reasoned from" on assessments.
  - "Watch for" appears only when `watchFor` is set.
  - Clicking a ties button calls `onOpen('dev-2')` and `preview(null)`.
  - `mouseenter`/`focus` on an item calls `preview('trend-0')`, and `mouseleave`/`blur` calls `preview(null)`.
  - Both lists empty renders nothing.
  - Row classes are `outlook-item reported` and `outlook-item assessment`.

  In `storyCss.test.ts`:
  - the outlook rules use no `--hot` or `--warm`;
  - `.outlook-item.assessment` has a `dashed` border;
  - every `transition` sits inside the reduced-motion block (follow the file's existing assertions).

- [ ] **Step 2: Run** `npx vitest run src/components/briefing`. Expected: the new tests FAIL and `TensionIndex.test.tsx` PASSES.

- [ ] **Step 3: Implement.**
  - Extract `TiesList` first and re-run `TensionIndex.test.tsx` (expect PASS), then build `OutlookSection`.
  - Markup: `section#outlook.outlook` with `aria-labelledby="outlook-h"`; the `h2` uses `className="section-label label label-mark"`, then the legend `<p class="outlook-legend">`. Each list is a `ul.outlook-list` with `li.outlook-item.{basis}`, and the `li` takes the preview handlers. Use `onFocus`/`onBlur` with `relatedTarget` containment, so tabbing between a row's own buttons doesn't flicker the preview.
  - CSS per spec §7, using only `--ink`, `--ink-2`, `--ink-3`, `--rule`, `--rule-strong`, `--accent`, `--accent-wash` and `--space-*`:
    - Reported: `border: 1px solid var(--rule); border-left: 3px solid var(--ink)`.
    - Assessment: `border: 1px dashed var(--rule-strong)`; its tag is `border: 1px dashed var(--ink-3)`.
    - Hover: `background: var(--accent-wash)`.
  - Print: the ties titles are unclamped (add `.outlook .index-tie-title` to the existing print rule).

- [ ] **Step 4: Run** `npx vitest run src/components/briefing`, then `npx tsc -b`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(story): Trends & implications section; Ties to list shared`.

### Task 6: Story tab wiring, globe follow and ledger

**Files:**
- Modify: `frontend/src/routes/StoryTab.tsx` (`buildOutlook` memo; render `<OutlookSection>` between `<Timeline>` and `<TensionIndex>`; `createFollow`'s `itemDevs` looks in index items, then outlook rows)
- Modify: `frontend/src/lib/ledger.ts` (`SectionName` gains `'outlook'`)
- Modify: `frontend/src/components/LoadingLedger.tsx`:
  - `SECTIONS` gains `{ name: 'outlook', label: 'Trends' }` after Signals;
  - `written` checks only `CORE_SECTIONS = ['developments', 'signals', 'alerts']`, with a one-line comment: an older backend never sends `outlook`.
- Modify: `docs/BACKLOG.md`: strike the item through, as for the tension index: `### ~~Trends & implications section~~ (done 2026-10-27)` plus a one-line note pointing at the spec.
- Test: `frontend/src/routes/StoryTab.test.tsx`, `frontend/src/components/LoadingLedger.test.tsx`, `frontend/src/lib/ledger.test.ts`

**Interfaces:**
- Consumes: `buildOutlook`, `OutlookSection` (Tasks 4–5), `highlight.preview`, `scrollToStory`.

- [ ] **Step 1: Write failing tests.**
  - `StoryTab.test.tsx`: with a briefing fixture that has one trend, the DOM order inside `.kd-main` is the timeline, then `#outlook`, then `#tension-index`. A fixture without outlook fields has no `#outlook`. Hovering an outlook item makes the globe follow its dev (assert through whatever seam the existing follow test in this file uses; mirror the index-row hover test).
  - `ledger.test.ts`: a `section` event with `name: 'outlook'` adds it to `sections`.
  - `LoadingLedger.test.tsx`: the list shows "Trends". With developments, signals and alerts done but no outlook, the Write row reads "Adding context and photos…" (Review Focus 3). The Trends item's `data-done` turns true on its event.

- [ ] **Step 2: Run** those three files. Expected: FAIL.

- [ ] **Step 3: Implement** as listed under Files.

- [ ] **Step 4: Run** the full frontend checks: `npx vitest run`, `npx tsc -b`, `npm run lint` (3 pre-existing warnings, no new ones), `npm run build`. Expected: all pass.

- [ ] **Step 5: Commit** `feat(story): outlook between timeline and index; ledger lists Trends`.

### Task 7: Live check

**Files:** none, unless a defect turns up (fix it in the owning task's files with a test first).

- [ ] **Step 1:** Start the backend from the worktree root: `/Users/camlau/Developer/atlas/.venv/bin/python -m uvicorn backend.main:app --reload --port 8000`. Start the frontend with `npm run dev` in `frontend/`.
- [ ] **Step 2:** Generate three briefings, for example "Red Sea shipping", "Sudan ceasefire" and "EU tariffs". For each, record from the backend log:
  - `synthesis_ms` and `elapsed_ms` (target: within today's 22–29s; outlook never adds more than 3s);
  - the `outlook reported= assessment= downgraded= dropped=` line;
  - any `status=late`.
- [ ] **Step 3:** In the browser (Chrome extension, or headless CDP per the memory note), check:
  - the order;
  - the legend;
  - a Reported link opens the right article;
  - "Builds on" jumps to the card and the globe follows;
  - hovering an item moves the globe;
  - phone width (390px) stacks;
  - print preview shows everything;
  - an older saved briefing in the Archive renders with no section.
- [ ] **Step 4:** Haiku/Sonnet comparison: restart with `OUTLOOK_MODEL=claude-sonnet-5-5` (environment only, no code change; if that ID is rejected, use the newest Sonnet ID the account accepts) and re-run the same three topics. Record the same counts plus a one-line judgement per topic: are the trends real cross-event patterns, or restated headlines?
- [ ] **Step 5:** Report the numbers and screenshots to the owner. Don't change the default model without their word.
