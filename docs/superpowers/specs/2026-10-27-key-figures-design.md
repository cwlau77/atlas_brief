# Key figures on development cards: design

Date: 2026-10-27. Branch: `key-figures` (worktree `../atlas-key-figures`). Covers the backlog item "Key figures and charts on development cards, each figure sourced" under "0. Next up".

Hotspots and the six deferred minors from the Trends & implications review are out of scope.

Mockup: `assets/2026-10-27-key-figures-mockup.html` (published as https://claude.ai/artifact/N85G9FVhMDyXeYVKwZdhKa). The owner chose layout **A1**: rows, with bars when the figures are comparable. Tiles (option B) were rejected.

## Why

Owner request, 2026-10-27. Analysts need to know which article a statistic came from. Each development card gets a **Key figures** list: the figure, what it measures, and a link to the article Atlas took it from. Where a card has comparable figures, they're drawn as a small bar chart; the owner rates visual data highly.

**Sourcing rule (owner's, non-negotiable):** every figure comes from a cited article. Atlas never computes, converts, rounds or invents one. Each figure keeps its unit, its date and its outlet. A figure Atlas can't trace to an article is not shown.

## What the experiment found (2026-10-27)

Before designing, three live focuses ("Red Sea shipping", "US China tariffs", "Sudan humanitarian crisis") went through the real pipeline: plan, ingest, dedupe and rank. Then the developments call was run once as it is today and once with a `key_figures` field added to its shape. Script: scratchpad `figs_exp.py`; about $0.15 of Haiku.

1. **Figures are sparse.** 7 of 16 developments got any figure, with 1–3 each. Only 20 of 57 articles had a digit anywhere in their title or snippet. Cards without figures are the normal case, not an edge case.
2. **The verbatim check works.** 10 of 11 figures were found word for word in the cited article's title or snippet using `_normalise_quote` and `_find_whole`. The one miss (an "8 million" not in its snippet) would rightly have been dropped.
3. **Haiku drops hedges.** CEPR wrote "rose from around 8% to roughly 20%… remained below 10%". The model returned "8%", "20%" and "10%". All three pass a plain verbatim check, but "10%" turns a ceiling into a value. The backend must restore the article's own qualifier (section 3).
4. **Folding figures into the developments call makes the briefing slower.** That call got slower by 1.0s, 2.3s and 1.1s (one sample each). A full-synthesis timing on the same articles showed developments is the **last** section to land (Red Sea: alerts 6.7s, outlook 8.5s, signals 9.3s, developments 11.9s, done at 14.9s; Sudan similar). Every second added to it is a second added to the briefing.
5. **Figures often come from articles the development doesn't cite** (3 of 11). Section 4 deals with this.

Finding 4 is why this design does **not** follow the owner's stated preference for extending the developments call. See "Decision for the owner" at the end.

## Goals

1. **A Key figures block on development cards** (`DevelopmentCard`), under the summary: up to three figures, each with the figure, what it measures, and its outlet and date as a link to the article.
2. **Comparable figures become a chart in the same rows**: bars on one scale from zero for counts and money, 0–100% meters for percentage levels. One figure, or figures of different kinds, are a plain list.
3. **Every shown figure is verified.** Its text (number, unit and any hedge) is found word for word in the title or snippet of an article that the card itself cites. Anything else is dropped silently.
4. **No slower or more fragile briefing.** Figures come from their own parallel call that starts with the other sections. A late, failed or malformed figures call leaves cards without figures and never fails or retries anything else.
5. **Saved briefings keep rendering.** Older ones have no `key_figures` and show no block, exactly as today.

## Non-goals

- No figures on alerts, tensions, contradictions, outlook items, Top stories photo cards or the carousel. Development cards only.
- No change to the developments, signals, alerts or outlook prompts.
- No fetching of full article text. Atlas only sees titles and snippets, so figures deeper in an article are out of reach and stay out.
- No time-series or line charts. The model sees a few snippets, not a series, so there is nothing honest to plot over time.
- No new colour tokens, and no animation.

## Anti-goals (a failure even if it works)

- **A number Atlas made.** A converted currency, a rounded figure, a sum, a percentage computed from two counts, or a figure "remembered" from training data. The verbatim check exists to catch these.
- **A bound shown as a value.** "below 10%" drawn as a 10% bar, or shown as "10%".
- **A chart that implies a comparison the sources don't support.** Two different kinds of measure on one scale; a growth rate next to a level; a percentage of one base next to a count.
- **A figure on the wrong card.** A figure from an article the card doesn't cite.
- **Red or amber in a chart.** They're reserved for heat.

## Design

### 1. Data shape (`backend/models.py`)

```python
# What kind of quantity a figure is; decides which figures may share a chart. Never shown.
FigureKind = Literal["people", "money", "share", "change", "count", "other"]
FIGURE_KINDS: tuple[str, ...] = get_args(FigureKind)


class KeyFigure(BaseModel):
    figure: str                        # verbatim from the source, hedge included: "nearly 14 million"
    label: str                         # Atlas's words: what it measures, <= 8 words
    kind: Optional[FigureKind] = None  # unknown values become None, which never charts
    period: Optional[str] = None       # verbatim from the same article ("in 2025"), else None
    source: SourceCitation             # the one article it was copied from


class KeyDevelopment(BaseModel):
    ...
    key_figures: list[KeyFigure] = []  # absent in older briefings
```

`kind` follows the closed-vocabulary pattern of `RELATIONSHIPS` and `Basis`. It is not displayed, so the frontend needs no label table for it. It only decides comparability:

| kind | means | charts as |
|---|---|---|
| `people` | numbers of people: killed, displaced, in need, employed | bars |
| `money` | sums of money | bars (same currency only) |
| `share` | a percentage level or share of a whole: a tariff rate, a vote share, capacity share | 0–100% meters |
| `change` | a rise or fall: growth, a % increase, a price change | never |
| `count` | other counted things: ships, hospitals, barrels | bars (same noun only) |
| `other` | anything else: ratios, temperatures, ranks | never |

The figure's date is its article's `published_at`, carried in `source`. When the article has no date, the row shows the outlet alone and nothing is guessed.

### 2. The figures call (`backend/synthesis/briefing.py`)

A fifth section, `"figures"`, added to `_SECTION_SHAPES`. It uses the same system prompt, the same article block and the same `_COMMON_RULES`:

```
{
  "key_figures": [
    {
      "figure": "the number with its unit, copied exactly from the article's title or snippet, including any word like 'nearly', 'about', 'more than' or 'below' just before it",
      "label": "what it measures, <= 8 words, in your words",
      "kind": "people | money | share | change | count | other",
      "period": "the time it covers, copied exactly from the same article, or null",
      "source": article number
    }
  ]
}

Constraints:
- 0-12 key_figures, the most important to the area of focus first.
- Copy each figure exactly as written. Never compute, convert, round, combine or restate a number; skip a figure you cannot copy exactly.
- kind: people = numbers of people; money = sums of money; share = a percentage level or share of a whole;
  change = a rise or fall; count = other counted things; other = anything else.
```

**When it runs.** It starts at the same moment as signals, alerts and outlook, on a new `figures_model` setting (default `claude-haiku-4-5`, in `config.py` and `.env.example` as `FIGURES_MODEL`), with `max_tokens=1200`. It's awaited inside the same grace window as outlook: once developments, signals and alerts are done, figures and outlook share the one `OUTLOOK_GRACE_S` (3s) wait, measured from the same moment. Figures never extend that window. In the timings above, developments finished last by 2–5s, so figures will almost always have landed already. A late call is cancelled and logged as `synthesis section=figures status=late`.

**It never fails the briefing.** It goes through `_write_section` like the other optional sections (one shared retry for transient errors or bad JSON). A failure or a malformed reply means no figures. Its parse is per-item lenient: a bad item is dropped, and only a reply that isn't an object with a `key_figures` list counts as a shape error. It emits **no** stream `section` event, so `lib/ledger.ts` and the loading ledger are unchanged. It also adds nothing to `_fallback_briefing` (demo mode).

A kill switch, `key_figures_enabled: bool = True` (`KEY_FIGURES_ENABLED`), skips the call entirely, following `commons_images_enabled`.

**Cost.** One more Haiku call per uncached briefing, with the same article input as the other sections: about 1.2k–3.3k input tokens (measured) plus at most a few hundred output tokens. At Haiku 4.5's $1 / $5 per million tokens, that's **about half a cent per briefing** (≈$0.002–0.005). Cached briefings cost nothing. No linking call: section 4 attaches figures deterministically.

### 3. Verification (`_parse_figures`, next to `_parse_outlook`)

Each item is kept only if all of these hold:

1. `source` resolves through `_article_at` (ints only). Legacy URL dicts are not accepted.
2. `figure` is a string of at most 40 characters containing at least one digit. Written-out numbers ("thousands", "two dozen") are dropped. `label` is a non-empty string. It is trimmed, and capped at 80 characters on a word boundary.
3. **Found as whole words.** The normalised figure is found in the normalised `title + snippet` of that article with `_find_whole` (start boundary), **plus a new end-boundary check**. The character after the match must not be alphanumeric, and must not be a `.` or `,` followed by a digit. This stops "4.5%" matching inside "14.5%" and "20" matching inside "200" or "20.5". Both checks go in one helper (`_find_figure`), so `_find_whole`'s existing behaviour for quotes is untouched.
4. **The hedge comes back.** If the one or two normalised words just before the match are in a closed qualifier list, and the figure doesn't already start with them, those words are prepended to the figure as the article has them.
   - Approximations: `about, around, roughly, nearly, almost, approximately, some, an estimated, estimated`.
   - Bounds: `more than, over, above, at least, upwards of, less than, fewer than, under, below, at most, up to`.

   This is restoring the article's words, not editing them. So "8%" becomes "around 8%", and "10%" becomes "below 10%".
5. `kind` outside `FIGURE_KINDS` becomes `None`. `period` is kept only if it's a string found whole-word in the **same** article (`_find_whole`); otherwise it's `None`.
6. Duplicates (same article, same normalised figure) keep the first.

The shown text is the verified figure string, with surrounding quote marks stripped as in `_parse_outlook`. Matching is case-insensitive, so the displayed casing is the model's. That's acceptable, because the words and digits are the article's.

Log once per briefing, mirroring outlook: `figures asked=N verified=M attached=K`, where asked is raw items, verified passed this section, and attached passed section 4.

### 4. Attaching figures to cards (`attach_figures(devs, figures)`)

Runs once developments and figures both exist, before `assign_images`.

- A figure can go only on a development that **cites its article** (the figure's `source.url` is in that development's source URLs). This is the owner's rule in its strict form: the article is already a source chip on the card. A figure whose article no development cites is dropped. This loses some good figures (finding 5), and that's the price of the rule.
- If several developments cite the article, the figure goes to the one whose headline and summary share the most content words with the figure's label (lower-cased words of 4+ letters). Ties go to the earlier development. A figure goes on one card only.
- Each card keeps at most **3**, in the model's order, which is importance to the focus.

`enforce_url_allowlist` gains one rule. After filtering a development's `sources`, it drops any figure whose `source.url` is not allowed, **or** is no longer among that development's source URLs. A stripped source can never leave a figure behind.

### 5. Comparability and the chart (frontend, `lib/keyFigures.ts`)

Pure functions, unit-tested. **The one place Atlas reads a number:** `parseFigure` turns the verbatim text into a value **only to set a bar's length**. The value is never displayed, rounded, converted or combined. The text on screen is always the verbatim figure.

`parseFigure(text)` returns `{ value, unit, bound }` or `null`:

- A leading qualifier from the list in section 3. A bound sets `bound: true`.
- An optional currency symbol or code (`$ US$ £ € ¥ ₹`, or `USD EUR GBP` …), then one number with `,` thousands separators and an optional decimal. Then an optional scale word (`thousand k million m mn billion bn trillion tn`, case-insensitive). Then an optional `%`, `percent` or `per cent`, and an optional trailing noun.
- `unit` is `percent`, `money:<currency>` or `count:<noun, or empty>`.
- Anything else returns `null`: ranges ("10–15%"), two numbers, fractions, written-out scales the parser doesn't know.

`figureGroups(figures)` returns the card's chart group, if any, and the remaining plain rows. A **chart group** is the largest set of 2+ figures on the card where all of these hold:

- The same `kind`, and that kind is one of `people`, `money`, `count` or `share`.
- Every one parses, and none is a bound.
- The same unit, with these rules:
  - `people` ignores the noun ("34 million people" sits with "19.5 million").
  - `money` needs the same currency.
  - `count` needs the same noun.
  - `share` needs `percent`, with every value ≤ 100.

A figure in a group's kind that is a bound, or doesn't parse, stays in the group's rows with no bar. Its bar cell reads "a limit, not charted" for a bound, or nothing at all when it doesn't parse. With at most three figures there is at most one group. **Same source and same period are not required.** Each row names its own outlet and date, and the caption states the outlet count and date span, so a cross-outlet chart is visibly cross-outlet.

Bar lengths:

- **bars** (people / money / count): `value / max × 100%` of the track, one scale from zero, with a hairline baseline at zero.
- **meters** (share): `value%` of a 0–100% track drawn in `--rule`, so every bar shows its own whole.

### 6. The card (`components/briefing/KeyFigures.tsx`, `DevelopmentCard.tsx`, `story.css`)

`KeyFigures` renders inside `.dev-main`, directly after `.dev-body` and before "From the archive". It renders nothing when the card has no figures.

```
KEY FIGURES                                   ← .label, ink, 600
34 million people   ██████████████████████    ← figure (600, ~1.12rem) │ bar cell
need humanitarian support · news.un.org, 21 Oct ↗   ← label, then link (outlet, date)
19.5 million        █████████████
face acute hunger · allAfrica.com, 26 Oct ↗
Nearly 14 million   █████████
forced from their homes · elon.edu, 21 Oct ↗
People · one scale from zero · 3 outlets, 21–26 Oct   ← caption, only under a chart
```

- **Markup:** a `<div class="kf">` with the `.label` heading, then a `<ul aria-label="Key figures">`. Each `<li>` holds the figure, an `aria-hidden` bar cell, and a line with the label, the period (ink-3, after a `·`) and the source link. The list itself is the chart's table twin. Every value is on screen as text, so no tooltip is needed and nothing is gated behind hover.
- **Grid:** two columns, `minmax(0, 11em)` for the figure and `1fr` for the bar. The label/source line spans both. Plain rows (no group) use one column. Below 640px the figure column narrows to `8.5em`. Long figures wrap and never clip.
- **Order:** the chart group's rows first, in model order, then the caption, then the plain rows.
- **Caption** (ink-3, small): `<Kind> · one scale from zero · N outlets, <date span>` for bars, and `Shares of 100% · N outlets, <date span>` for meters. Kind words are `People`, `Money`, `Count`. A single date reads `26 Oct`, and "1 outlet" is singular. Dates use `formatDayMonth` in the reader's time zone.
- **Link:** text `outlet, 21 Oct ↗`, or `outlet ↗` when undated. `target="_blank" rel="noopener noreferrer"`, `aria-label="Read in <outlet>: <figure> <label>"`. Styling follows the outlook source link (ink-3, with a `--rule-strong` underline that turns `--accent` on hover and focus).
- **Colour (my call):** bars and meter fills are `--ink-2`, and the meter track is `--rule`. Ultramarine stays the interaction colour, so a bar never looks clickable, and ink bars suit the newsprint identity. No red or amber. Square ends, matching `--radius: 0` (Atlas geometry over the dataviz default of rounded ends). Bars are 10px thick.
- **Dim and lit states:** under `.dev.is-dim`, bars and figure text go to `--ink-3` / `--rule-strong`, like the rest of the card. `.is-lit` changes nothing here.
- **Motion:** none, so `prefers-reduced-motion` is satisfied by construction.
- **Tokens:** only existing tokens from `tokens.css`. No literals.

### 7. Types and saved briefings (`lib/types.ts`, `lib/normalize.ts`)

- `types.ts`: `interface KeyFigure { figure: string; label: string; kind?: string | null; period?: string | null; source: SourceCitation }`, and `KeyDevelopment.key_figures?: KeyFigure[]`.
- `normalize.ts`: `ViewDevelopment.keyFigures: ViewKeyFigure[]` (camelCase, `kind` narrowed to the six values or `null`). The API → view mapping fills it from `key_figures ?? []`. `withDefaults` sets `keyFigures: d.keyFigures ?? []`, so every saved briefing renders with no block. No storage migration.

## Testing

Backend (`backend/tests/`):

- `_parse_figures` must:
  - keep a verbatim figure;
  - drop one not in the article, one with no digit, and one cited by URL dict or an out-of-range number;
  - reject "4.5%" inside "14.5%" and "20" inside "200" / "20.5";
  - restore "around" and "below" (the CEPR snippet as a fixture);
  - keep a verified `period` and drop an unverified one;
  - map an unknown kind to `None`;
  - dedupe;
  - never raise on a bad item.
- `attach_figures`:
  - only on citing cards;
  - the tie-break;
  - a cap of 3;
  - a figure from an uncited article is dropped.
- `enforce_url_allowlist`: drops a figure whose source is stripped or no longer cited by its card.
- `synthesize_briefing`, with mocked calls:
  - a figures call that fails, returns junk, or lands after the grace window gives a briefing without figures, with no change to the other sections;
  - developments are never retried because of figures;
  - `key_figures_enabled=False` makes no call.
- `Briefing` round-trips through JSON with and without `key_figures`.

Frontend (vitest):

- `parseFigure`: the formats in section 5, ranges and fractions as `null`, bounds flagged.
- `figureGroups`:
  - the people group ignores the noun;
  - money with mixed currencies doesn't chart;
  - `change` / `other` never chart;
  - a share over 100 doesn't chart;
  - a bound stays in the group's rows without a bar;
  - a single figure gives no group.
- `KeyFigures`: renders nothing for `[]`; the caption text and date span; the undated link; the bar widths for the Sudan and CEPR fixtures; the `aria-label`.
- `withDefaults`: a saved briefing without `keyFigures` normalises to `[]`, and `DevelopmentCard` renders unchanged.

Live check: run the three experiment focuses plus one finance focus through `/briefing/stream` locally. Confirm:

- end-to-end time is within noise of `main`;
- the `figures asked/verified/attached` log lines look sane;
- the cards match the A1 mockup at desktop and 390px;
- an old saved briefing still renders.

## Docs

Update `CLAUDE.md`'s pipeline paragraph (the figures call, its grace, `attach_figures`, the allowlist rule) and its Story tab paragraph (the Key figures block). Move the backlog item to done, per the usual practice.

## Calls I made (check these while reading)

1. **A separate parallel figures call instead of extending the developments call.** The owner preferred the developments call. The timing in finding 4 shows that it lengthens every briefing by 1–2s, which breaks the owner's other rule. The separate call adds about half a cent per briefing instead. If the owner would rather pay in time than in money, the swap is contained: the shape moves into `developments` and `attach_figures` goes away.
2. **A figure must sit on a card that cites its article.** This is the strict reading of "comes from a cited article". It's not enough for the figure to name any article Atlas ingested.
3. **Comparable = same kind + same unit**, with no requirement for the same source or period. The caption and the per-row outlet and date make mixed sources visible. Requiring one source would leave almost no charts, since only the CEPR card in the experiment would qualify.
4. **Hedges are restored from the article**, and bounds are listed but never charted.
5. **Bars are ink, not ultramarine**, with square ends.
6. **Up to 3 per card**, 12 per briefing.
7. **The frontend parses numbers only for bar length.** This is the one place Atlas reads a value, and nothing it computes is ever shown.
