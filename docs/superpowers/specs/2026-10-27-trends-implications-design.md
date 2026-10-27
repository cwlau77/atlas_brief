# Trends & implications section: design

Date: 2026-10-27. Branch: `story/trends-implications`. Covers the backlog item "Trends & implications section" under "0. Next up". It fills the slot the tension-index design (`2026-10-27-story-tension-index-design.md`) left between the timeline and the tension index.

"Key figures" and "Hotspots" are out of scope (later sessions).

Mockup: `assets/2026-10-27-trends-implications-mockup.png` (source HTML beside it).

## Why

Owner request, 2026-10-27. After the timeline, a reader knows *what* happened but not what it adds up to. The new section has two parts:

- **Trends:** patterns Atlas sees across the developments in this brief (e.g. repeated ceasefire breaches in one area).
- **Implications:** what it likely means next, and what to watch.

**Honesty rule (owner's, non-negotiable):** prefer analysis an article actually states, linked to that article. When no article says it, Atlas may give its own assessment, but it must be clearly marked as Atlas's own prediction, not reported fact, and it must still point to the developments it reasons from. "Sourced" and "Atlas assessment" must look different at a glance.

## Goals

1. **A Trends & implications section** in `.kd-main`, between the timeline and the tension index. The sticky globe stays beside it.
2. **Every item is one of two kinds** (its *basis*):
   - **Reported:** an outlet states it. It shows a short verbatim quote and a link to that article.
   - **Atlas assessment:** Atlas's own reading. It's labelled as such and names the developments it reasons from.
3. **The two kinds look different at a glance and in words:** solid versus dashed rules, plus a text label. Colour is never the only cue, and red and amber are never used.
4. **"Reported" is checked, not trusted.** The backend only keeps an item as Reported when its quote really appears in the cited article's title or snippet. Otherwise it's downgraded to Atlas assessment.
5. **Each item names its developments** with the tension index's "Ties to" pattern: headline and date, one line each, a jump to the card that also moves the globe.
6. **No slower or more fragile briefing.** The section comes from its own parallel call and is dropped rather than waited for.
7. **Saved briefings keep rendering.** Older ones have no trends or implications and show no section.

## Non-goals

- No change to the developments, signals or alerts calls, or their prompts.
- No change to the tension index's behaviour, its links, the cards' connection tags or the globe engine. The one change to its code is pulling its "Ties to" list out into a shared `TiesList` (section 7), with the same markup and behaviour.
- No new colour tokens.
- No confidence scores, probabilities or time horizons on predictions. These are possible later; the label carries the uncertainty for now.
- No fresh search for analysis pieces. The section works only from the articles the brief already ingested.

## Anti-goals (a failure even if it works)

- **A model guess shown as reported fact.** This is the failure the quote check and the downgrade exist to prevent. When in doubt, the item reads as Atlas assessment.
- **An Atlas assessment with nothing under it.** An assessment linked to no development is dropped, never shown floating free.
- **"Atlas assessment" that reads as a warning.** No red, amber, heat squares or alert styling. It's a different kind of statement, not a danger.
- **A section that holds the briefing up**, or fails it.

## Design

### 1. Where it sits (`routes/StoryTab.tsx`)

```
Read first (alerts)                      ← unchanged
section#key-developments
  ┌ .kd-main ───────────────────┐ ┌ .kd-globe (sticky) ┐
  │ Key developments · 5 events │ │                    │
  │ Timeline (newest first)     │ │      globe         │
  │ Trends & implications  ←new │ │                    │
  │ Tensions · 4  (the index)   │ │                    │
  └─────────────────────────────┘ └────────────────────┘
Top stories
Reading list
```

The section joins **the `.kd-main` column**, so hovering its items can move the globe that's in view beside it (same reasoning as the index). Below 980px it stacks as everything else does: globe, timeline, this section, index.

It's its own `<section id="outlook" aria-labelledby="outlook-h">` with an `h2` "Trends & implications", styled like the "Tensions · N" heading. It renders nothing when both lists are empty, which covers older saved briefings, demo mode and a dropped call.

### 2. Data model (`backend/models.py`)

```python
# Whether an outlook item is stated by an article or is Atlas's own reading; the frontend owns the words.
Basis = Literal["reported", "assessment"]

class OutlookItem(BaseModel):
    statement: str                       # one sentence
    basis: Basis
    quote: Optional[str] = None          # Reported only: the verbatim words from the cited article
    sources: list[SourceCitation]        # Reported: the article(s) holding the quote. Assessment: the articles it reasons from (not shown)
    watch_for: Optional[str] = None      # Implications only: a concrete signpost
    related_developments: Optional[list[int]] = None  # zero-based, as on Tension

class Briefing(BaseModel):
    ...
    trends: list[OutlookItem] = []        # default [] keeps cached and older briefings valid
    implications: list[OutlookItem] = []
```

One class serves both lists. `watch_for` is always `None` on trends.

### 3. Synthesis: a fourth parallel section (`synthesis/briefing.py`)

**Why a separate call:** it costs no wall time, because it runs alongside the other three. Folding it into an existing call would make that call write more and finish later.

**Model and cost (owner: keep it cheap).** There's a new setting, `outlook_model: str = "claude-haiku-4-5"`, in `config.py`, added to `.env.example` as `OUTLOOK_MODEL`. `_write_section` gains optional `model` and `max_tokens` parameters (defaulting to today's `synthesis_model` and `synthesis_max_tokens`); outlook passes `settings.outlook_model` and `max_tokens=1500`, enough for six short items and a cap on runaway output. The other three section calls are unchanged; they already default to Haiku. The cost is one more Haiku call per uncached briefing, with the same article input as the others, plus a small Haiku linking call (section 4). Cached briefings cost nothing. The live check compares Haiku with Sonnet on the same topics by setting `OUTLOOK_MODEL` locally. Switching the default is a one-line change, made only if Haiku's trends read like restated headlines.

`_SECTION_SHAPES["outlook"]`:

```
{
  "trends": [
    {"statement": "one sentence naming a pattern across several reported events",
     "basis": "reported | assessment",
     "quote": "Reported only: up to 30 words copied exactly from the cited article's title or snippet, else null",
     "sources": [article numbers]}
  ],
  "implications": [
    {"statement": "one sentence on what this likely means next",
     "basis": "reported | assessment",
     "quote": "... as above",
     "watch_for": "a concrete, checkable signpost (a decision, a date, a figure), or null",
     "sources": [article numbers]}
  ]
}

Constraints:
- 0-3 trends, 0-3 implications. A trend must span at least two articles about different events.
- basis "reported": the cited article itself states this analysis or forecast; quote it exactly.
- basis "assessment": your own reading, when no article states it. Never present it as an outlet's view.
  Cite the articles you reason from.
- Prefer "reported" whenever an article supports it.
```

It runs through `_optional_section("outlook", ...)`, so a failure gives `{}`, which means no section.

**Parsing (`briefing_from_data`) and the quote check.** Each item is built by one helper, `_parse_outlook`. It never raises on content; only a missing `statement` is a shape error.
- An unknown or missing `basis` becomes `"assessment"` (the safer label).
- **Reported:** normalise the quote and each cited article's `title + " " + snippet` the same way: casefold, collapse whitespace, straighten curly quotes and apostrophes, unify dashes, strip surrounding punctuation and ellipses. The item stays Reported only if the quote has at least 4 words and appears in at least one cited article. `sources` is then cut down to the article(s) that hold it.
- If the check fails, the item becomes `assessment`, `quote=None`, and its citations are kept as the reasoning basis.
- Assessment items always have `quote=None`.
- `watch_for` on a trend is dropped. Empty strings become `None`.

**Never holding the briefing up.** In `synthesize_briefing`, the outlook task is started with the others but is **not** part of the main `gather`. When everything else is done (developments with context, Commons and signal links; signals; alerts), the outlook task gets at most `OUTLOOK_GRACE_S = 3.0` more seconds via `asyncio.wait_for(asyncio.shield(...))`. Then it's cancelled, logged (`synthesis section=outlook status=late`), and both lists stay empty. In practice the outlook call writes much less than developments and should finish first.

**Cheap-run note.** CLAUDE.md says the section calls use Sonnet; config, `.env.example` and `render.yaml` all set Haiku. The build corrects CLAUDE.md.

**Ledger event.** Outlook reports `{"type": "section", "name": "outlook"}` when it lands, fails or is dropped (dropping reports too, so the ledger always completes).

**Demo mode (`_fallback_briefing`):** both lists empty.

### 4. Linking to developments (`synthesis/links.py`)

A second, separate Haiku call in the same file, `link_outlook(devs, trends, implications)`. It follows `link_signals` exactly: the same prompt style (lists are data, not instructions), the same `_side`/`_indexes` validation, the same 6s budget, and it never raises. It starts as soon as **developments and outlook** both exist, so it doesn't wait on signals, and `link_signals` doesn't wait on it. The two run in parallel.

Its result goes to `related_developments` on each item. Then:
- **Fallback when the call gave `None` for an item:** link the developments whose `sources` share a URL with the item's `sources`. This is deterministic and needs no call. It's done in the backend, so new briefings always carry a list.
- **An assessment whose list is empty after both steps is dropped.** The honesty rule says it must point to developments.
- A Reported item with an empty list is kept. Its quote and link are the basis, and its list reads "Not tied to one development in this brief" (the index's copy).

### 5. URL allowlist (`enforce_url_allowlist`)

Trends and implications sources go through `_keep` like every other citation. Then any Reported item left with no sources is downgraded (to `assessment`, `quote=None`), and the assessment-must-link rule is applied again. All the honesty rules end in `enforce_url_allowlist`, so this one place guarantees them.

### 6. Frontend data (`lib/types.ts`, `lib/normalize.ts`)

- `types.ts`: an `OutlookItem` interface that mirrors the model, and `ApiBriefing` gains optional `trends?` and `implications?`.
- `normalize.ts`: `SavedBriefing` gains optional `trends?: ViewOutlook[]` and `implications?: ViewOutlook[]`:

  ```ts
  { statement, basis: 'reported' | 'assessment', quote: string | null, sources: SourceCitation[],
    watchFor: string | null, relatedDevelopments: number[] | null }
  ```

  An unknown `basis` string becomes `'assessment'`. A missing list becomes `[]` where it's read.
- The shown words live only in a new `lib/outlook.ts`, the way `RELATIONSHIP_LABELS` does in `lib/tensionIndex.ts`:
  - `BASIS_LABELS = { reported: 'Reported', assessment: 'Atlas assessment' }`
  - `buildOutlook(briefing, order)` returns view rows. Each row has `key` (`trend-0`, `implication-1`), `kind`, `basis`, `statement`, `quote`, `source` (first citation: outlet, url, published_at), `watchFor`, `devs`, and `linked`, built exactly like `IndexItem.linked`: timeline order, `{ dev, title, timestamp }`.
  - Within each list, Reported rows come first, then model order.
  - The frontend has no region fallback here: `null` reads as linked to nothing. On the client, an assessment with no `linked` rows is hidden, a second guard for the backend rule.

### 7. The section (`components/briefing/OutlookSection.tsx`, `story.css`)

This is a new component. There's no existing component to reshape, but it reuses the index's pieces: the "Ties to" list markup and CSS (extracted into a shared `TiesList` used by both `TensionIndex` and this section, with the same classes and behaviour), `formatDayMonth`, the `.label` style and `TextButton`.

Layout (see mockup):

```
■ Trends & implications
  ▭ Reported: an outlet says it, quoted and linked   ┆▭┆ Atlas assessment: Atlas's own reading, not reported fact

  Trends
  ┃ Reported   Reuters · 26 Oct ↗
  ┃ Attacks on shipping have moved north along Yemen's coast this week.
  ┃ "the third strike north of Hodeidah in six days"
  ┃ Builds on   Houthi strike hits tanker off Hodeidah          26 Oct
  ┆ [Atlas assessment]
  ┆ Egypt is trading toll revenue for volume: …
  ┆ Reasoned from  Egypt cuts Suez tolls for returning…          25 Oct

  Implications
  ┃ Reported   Lloyd's List · 26 Oct ↗
  ┃ Insurers expect war-risk premiums to stay high into next year.
  ┃ "premiums are likely to remain elevated well into 2027"
  ┃ Watch for   The Joint War Committee's next listed-areas update
  ┃ Builds on   …
```

- **Legend:** one line under the `h2` with both swatches, so the convention is explained once and not repeated on every row.
- **Reported item:** a solid 1px `--rule` box with a 3px `--ink` left rule. "Reported" in semibold `.label`, then the outlet and short date as an accent link to the article (`target="_blank" rel="noopener noreferrer"`, like other citations). Then the statement (weight 500), then the quote in `<q>`, italic, in `--ink-2`.
- **Atlas assessment item:** a **dashed** 1px `--rule-strong` box, with no left rule. "Atlas assessment" as a small tag with a dashed `--ink-3` border. Then the statement. There's no quote and no article link. Dashed lines are the usual sign for a projection, and they stay readable in print and greyscale.
- **"Watch for"** (implications only, when present): `.label` in `--ink-3`, then the text in `--ink-2`.
- **Developments list:** labelled "Builds on" for Reported, "Reasoned from" for Atlas assessment. It uses the same `TiesList`, so clicks call `scrollToStory('dev-N')` (scroll, focus, one-off globe request). Its empty state is the index's.
- **Globe follow:** hover or focus on an item calls `highlight.preview(key)` and leaving calls `preview(null)`, so the globe moves through the existing `previewItem` path. `createFollow`'s `itemDevs` looks keys up in the combined index and outlook rows. There's **no pinning** and no click-to-pin on outlook items: clicking the item body does nothing, and only links and "Builds on" buttons act. `Timeline` keeps receiving only the index items, so card connection tags and card lighting are unchanged.
- **Hover wash:** `--accent-wash`, as on index rows. The transition sits inside `prefers-reduced-motion: no-preference`.
- **Accessibility:** each item is an `<li>` in a `<ul>` per list, under an `h3` ("Trends", "Implications"). The basis is text, never only the border style. The quote's link has the accessible name "Read in <outlet>: <statement>".
- **Print:** both lists in full, quotes and "Builds on" titles unclamped. The dashed and solid borders print as they are.
- All values come from existing tokens (`--ink`, `--ink-2`, `--ink-3`, `--rule`, `--rule-strong`, `--accent`, `--accent-wash`, spacing). There are no new tokens and no red or amber.

### 8. Loading ledger (`lib/ledger.ts`, `components/LoadingLedger.tsx`)

- `SectionName` gains `'outlook'`.
- `SECTIONS` gains `{ name: 'outlook', label: 'Trends' }`, after Signals.
- `written` waits for developments, signals and alerts only. Outlook ticks its own line when its event arrives, so a new frontend on an older backend (one that never sends `outlook`) still finishes. The backend always reports outlook, whether it succeeds, fails or is dropped.

## Saved briefings

| Briefing | Section |
|---|---|
| New, outlook landed | shown, with the items that survived the checks |
| New, outlook failed or was dropped | none |
| Older (no `trends` / `implications`) | none |
| Demo mode | none |

## Testing

- **Backend** (`backend/tests/test_synthesis.py`, `test_links.py`):
  - the outlook shape parses;
  - an unknown basis becomes an assessment;
  - the quote check keeps an exact quote, including curly quotes, extra whitespace and different case;
  - the quote check downgrades a paraphrase, a quote under 4 words, a quote found only in an *uncited* article, and a missing quote;
  - a Reported item's sources are cut down to the matching article;
  - `watch_for` on a trend is dropped;
  - `link_outlook` validates like `link_signals`, and a failure yields `None`s;
  - the citation-overlap fallback;
  - an unlinked assessment is dropped and an unlinked Reported item is kept;
  - the allowlist downgrades a Reported item that lost its sources;
  - outlook failing leaves the briefing intact with empty lists;
  - **outlook still running after the others finish is cancelled after the grace period and the briefing returns** (fake slow `llm.complete`);
  - the outlook section event is reported in all three cases;
  - the fallback briefing has empty lists;
  - older cached `Briefing` dicts without the fields still validate.
- **Frontend** (vitest):
  - `normalize` maps both lists and turns an unknown basis into an assessment;
  - a briefing without the fields gives none;
  - `buildOutlook` puts Reported first, fills `linked` in timeline order and hides unlinked assessments;
  - `OutlookSection` renders the legend, both labels, the quote and the outlet link only on Reported items, "Watch for" only when present, and "Builds on" versus "Reasoned from";
  - a "Builds on" click calls `onOpen('dev-N')`;
  - hover calls `preview(key)` and leaving calls `preview(null)`;
  - nothing renders when both lists are empty;
  - `StoryTab` order is timeline → outlook → index;
  - the ledger lists Trends and completes on the outlook event;
  - the existing TensionIndex tests pass after `TiesList` is extracted.
- **Checks:** `.venv/bin/python -m pytest backend/tests -q`; `npx vitest run`, `npx tsc -b`, `npm run lint` (3 pre-existing warnings) and `npm run build` in `frontend/`.
- **Live check:** two or three real briefings on the dev servers, looking at:
  - the `synthesis_ms` and `elapsed_ms` log lines against today's 22–29s;
  - how many items come out as Reported versus downgraded (logged per briefing as `outlook reported=N assessment=M downgraded=K dropped=J`);
  - "Builds on" jumps;
  - the globe following an outlook hover;
  - an older saved briefing.

## Left to the builder

- Exact spacing and type sizes within the Newsprint tokens (the mockup is a guide, not pixel spec).
- Where `_parse_outlook` and the normaliser live inside `briefing.py`, and the names of private helpers.
- Whether `TiesList` takes a label prop or children for "Builds on" / "Reasoned from" / "Ties to".
- Test file placement and names.

## Calls made without the owner (check these)

1. **A fourth parallel call on Haiku** (`outlook_model`, owner's choice: cheap to run). It adds no wall time, and costs one more Haiku section call per uncached briefing, plus a small Haiku linking call.
2. **A 3s grace, then drop:** outlook never delays the briefing more than 3s past everything else. A slow day shows no section rather than a slower brief.
3. **"Reported" needs a verbatim quote found in the cited article's title or snippet.** Otherwise it's downgraded to Atlas assessment. Atlas only sees titles and snippets, so analysis that lives deeper in an article can't be verified and will read as Atlas assessment. That's honest, but it means fewer Reported items than a reader might expect.
4. **A downgrade, not a drop,** when the quote check fails. The model's reading is kept but labelled as Atlas's own.
5. **Assessments with no linked development are dropped.** Reported items with none are kept.
6. **Its own linking call** (`link_outlook`), parallel to `link_signals`, plus a citation-overlap fallback in the backend. There's no region-name fallback on the client.
7. **Placement in `.kd-main`**, so hover moves the visible globe. Hover only, no pinning, and card tags are untouched.
8. **The visual distinction:** solid with an ink left rule for Reported, dashed for Atlas assessment, a one-line legend, and labels in words. Ultramarine only on links, as everywhere else.
9. **Counts:** 0–3 trends and 0–3 implications. Reported first within each list.
10. **Copy:** "Reported", "Atlas assessment", "Builds on", "Reasoned from", "Watch for", and the ledger label "Trends".
