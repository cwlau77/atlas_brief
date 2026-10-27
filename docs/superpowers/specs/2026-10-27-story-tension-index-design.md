# Story tab order and a clearer tension index: design

Date: 2026-10-27. Branch: `story/tension-index`. Covers two backlog items under "0. Next up" as one design pass, since both reshape the same component:

- "Story tab: timeline first, tensions below it"
- "Tension index: say what the relationship is"

"Trends & implications", "Key figures" and "Hotspots" are out of scope (later sessions). This design leaves a slot for Trends & implications but builds nothing for it.

## Why

Owner feedback, 2026-10-27:

1. Readers meet the tension index before they know what happened. The timeline should come first.
2. At first glance an index row is unclear:
   - **The squares** (one per development, filled when linked) don't say *which* events a tension ties to.
   - **The arrows** between actors (`Houthi forces ↔ EU-US coalition`) don't say whether the actors are fighting, competing, negotiating, or just caught up in the same event.

The owner wants both fixes: the relationship stated in words, and the linked developments named.

## Goals

1. **New Story tab order:** Read first (alerts, only when there are any), then the timeline with its sticky globe, then *(later: Trends & implications)*, then the tension index, then Top stories, then the reading list.
2. **Each tension row states the relationship in words.** One short fixed phrase per tension, such as "In open conflict", chosen by synthesis from a closed vocabulary.
3. **Actors read as words, not arrows:** "Houthi forces and EU-US coalition", "Egypt, Container lines and Insurers".
4. **Each row names its linked developments** (headline and date) as links that jump to the card. These replace the squares.
5. **Everything that works today still works across the longer distance** between the index and the cards: hover/pin lighting, globe follow, the card's connection tag, Escape and click-outside to unpin, "Show N more", and printing.
6. **Saved briefings keep rendering.** Older ones have no relationship and store actors as an `A ↔ B` string. They show no relationship line, and their actors are reformatted into words.

## Non-goals

- No change to how links are computed (`related_developments`, `synthesis/links.py`, the region-name fallback in `linkBriefing`).
- No change to the timeline cards, the globe engine, Top stories or the reading list beyond what's listed here.
- No new colours. Red and amber stay reserved for heat; the contradiction marker keeps its existing `--hot` square.
- No Trends & implications section.

## Anti-goals (a failure even if it works)

- A relationship phrase the model made up that the UI then shows as fact in an unbounded style. The vocabulary is closed. An unknown value shows nothing.
- Losing the globe link: hovering or pinning a row must still move the sticky globe to that tension's developments.
- A row that gets so tall the index stops being an index. The why text keeps its two-line clamp, and the linked-development list stays to one line per development.

## Design

### 1. Page order (`routes/StoryTab.tsx`)

`<TensionIndex>` moves from above `<Timeline>` to below it, **inside `.kd-main`** (the left column of `section#key-developments`). The sticky globe in `.kd-globe` stretches to the bottom of `.kd-cols`, so it stays in view beside the index. Hovering an index row keeps moving the globe exactly as today (`follow.ts` `previewItem` / `pinnedItem`, unchanged).

```
Read first (alerts)                      ← unchanged, only when alerts exist
section#key-developments
  ┌ .kd-main ───────────────────┐ ┌ .kd-globe (sticky) ┐
  │ Key developments · 5 events │ │                    │
  │ Timeline (newest first)     │ │      globe         │
  │ [later: Trends & implic.]   │ │                    │
  │ Tensions · 4  (the index)   │ │                    │
  └─────────────────────────────┘ └────────────────────┘
Top stories
Reading list
```

Below 980px the layout is as today: globe above, not sticky, then the timeline, then the index.

Builder's call: the index keeps its own `<section id="tension-index">` and its "Tensions · N" `h2` (unchanged), with the existing `.kd-main` gap above it.

### 2. Relationship in words (backend)

**Model** (`backend/models.py`): `Tension` gains

```python
relationship: Optional[Literal["in_conflict", "rivalry", "competing_claims", "pressure", "negotiating", "uneasy_partners"]] = None
```

**Prompt** (`_SECTION_SHAPES["signals"]` in `synthesis/briefing.py`): each tension gets a `"relationship"` key with the six values and one-line meanings:

| Value | Shown as | Meaning given to the model |
|---|---|---|
| `in_conflict` | In open conflict | fighting, strikes or attacks between the actors |
| `rivalry` | Rivals, no clash yet | hostile posturing, build-ups or threats with no direct incident |
| `competing_claims` | Competing claims | rival claims to territory, resources, rights or authority |
| `pressure` | Pressure and pushback | one side pressing the other through sanctions, tariffs, tolls, legal or diplomatic action |
| `negotiating` | Negotiating | talks, ceasefire or deal-making under strain |
| `uneasy_partners` | Uneasy partners | allies or partners whose interests are pulling apart |

**Parsing** (`briefing_from_data`): an unknown, missing or non-string value becomes `None`. It never raises, so a bad relationship never costs the signals section its retry or fails it.

**Fallback briefing** (`_fallback_briefing`, demo mode): `relationship=None`.

**Links call** (`synthesis/links.py`): unchanged.

Owner-facing words live **only in the frontend** (a label map in `lib/tensionIndex.ts`). The API carries the enum value.

Contradictions get no model change. Their relationship line is the fixed phrase **"Same event, different accounts"** (the owner's own wording).

### 3. Actors as words (frontend)

- `lib/types.ts`: `ApiTension` gains `relationship?: string | null`.
- `lib/normalize.ts`:
  - `ViewTension` gains `relationship: TensionRelationship | null`, where an unknown string becomes `null`.
  - `actors` becomes a word list built with `Intl.ListFormat('en', { type: 'conjunction' })`, e.g. "A, B and C", with "Multiple actors" when empty.
- A small pure helper, `actorsText(actors: string)`, turns a legacy `A ↔ B ↔ C` string from a saved briefing into the same word list. It's used wherever `actors` is displayed: the index (`buildTensionIndex`), route titles (`lib/routes.ts`) and the Archive (`routes/ArchivePage.tsx`). `linkBriefing`'s region matching works on either form, so it's unchanged.

### 4. The index row (`components/briefing/TensionIndex.tsx`, `lib/tensionIndex.ts`)

`IndexItem` gains:
- `relation: string | null`: the shown phrase. For a tension it's the label for its `relationship`, or `null`. For a contradiction it's always "Same event, different accounts".
- `linked: { dev: number; title: string; date: string }[]`: the linked developments in timeline order (newest first), built from `devs` and `order`.

`devs` stays, because follow, routes and card lighting use it.

Row layout, top to bottom (the square strip is removed):

```
■ TENSION   Houthi forces and EU-US coalition
            In open conflict
            Escort rules are under review after the strike off Yemen;
            insurers are pricing in a longer closure…            More
            Ties to  · Houthi strike hits tanker off Hodeidah   26 Oct
                     · Egypt cuts Suez tolls for returning…     25 Oct
```

- **Row button** (`.index-row`): the kind marker and label as today, then the actors (bold, as `.index-sides` today), then the relationship phrase on its own line in `--ink-2` (no colour, no label styling). The button's accessible name reads naturally, e.g. "Tension: Houthi forces and EU-US coalition, in open conflict". The row still pins on click and previews on hover/focus, unchanged.
- **Why text:** unchanged (two-line clamp, More/Less).
- **"Ties to" list:** sits *outside* the row button (buttons can't nest), under the why text, aligned to the same 12px inset.
  - Each linked development is a `<button>`: the headline clamped to one line with an ellipsis, then a short date in the reader's time zone (same formatter the cards use).
  - Clicking one calls the Story tab's `scrollToStory('dev-N')`. That already scrolls the card into view, focuses it and sends the globe a one-off request. It must not toggle the pin: the row's click handler already ignores clicks on inner buttons.
  - Accessible name: "Go to development: <headline>".
  - With no linked developments the list reads "Not tied to one development in this brief" in `--ink-3`, not as a button.
- `TensionIndex` takes new props, `onOpen: (anchorId: string) => void` and `timeZone: string`, from `StoryTab`. The `devCount` and `order` props it used only for the strip are dropped if nothing else needs them.
- The active/pinned washes, focus ring, top-3 + "Show N more", the latched reveal, Escape and click-outside behave exactly as today.
- CSS (`story.css`): remove the `.index-strip` rules and their transition, and add `.index-relation` and `.index-ties` using existing tokens only (`--ink-2`, `--ink-3`, `--rule`, spacing tokens). Any hover transition on the "Ties to" buttons sits inside `prefers-reduced-motion: no-preference`. In print, every "Ties to" list shows in full (headlines unclamped).

### 5. The card's connection tag across the distance (`Timeline.tsx`)

Today the tag scrolls to the *top* of the index (`block: 'start'`), then pins and focuses the row. With the index below the timeline, the tag scrolls to **the pinned row itself** (`block: 'center'`, `auto` under reduced motion), after the pin renders. That's the same effect that already moves focus there, so a row revealed from behind "Show N more" is found. Unpinning from the tag (tag pressed while its row is pinned) stays as today: no scroll.

### 6. Copy

- "Ties to" is the list's label (`.label` style, like other small labels).
- The relationship phrases are in the table above. The contradiction phrase is "Same event, different accounts".
- The empty state is "Not tied to one development in this brief".

## Saved briefings

| Briefing | Relationship line | Actors | Ties to |
|---|---|---|---|
| New | shown when synthesis gave a known value | word list | named |
| Older (no `relationship`, `A ↔ B` actors) | none | reformatted to a word list | named (same links as today, including region fallback) |

## Testing

- **Backend** (`backend/tests/test_synthesis.py`):
  - a known relationship parses;
  - an unknown, missing or non-string one becomes `None` without failing the section;
  - the signals prompt lists all six values;
  - the fallback briefing has `None`.
- **Frontend** (vitest):
  - `normalize` maps `relationship` and drops unknown values;
  - actors become a word list;
  - `actorsText` reformats a legacy `↔` string;
  - `buildTensionIndex` fills `relation` and `linked` in timeline order;
  - `TensionIndex` shows the relationship, names linked developments, calls `onOpen('dev-N')` without pinning, shows the empty state, and no longer renders the strip;
  - `StoryTab` renders the index after the timeline;
  - the card tag scrolls to the pinned row;
  - the existing TensionIndex, Timeline and storyCss tests keep passing (updated where they assert the strip).
- **Checks:** `.venv/bin/python -m pytest backend/tests -q`; `npx vitest run`, `npm run lint` (3 pre-existing warnings) and `npm run build` in `frontend/`.
- **Live check:** one real briefing on the dev servers, looking at:
  - the order;
  - relationship phrases on fresh tensions;
  - "Ties to" jumps;
  - the globe following an index hover while the timeline is scrolled away;
  - a saved older briefing.

## Left to the builder

- Exact spacing, type size and wrapping of the relationship line and the "Ties to" list, within the Newsprint tokens.
- Whether the "Ties to" date uses the card's existing date helper or a shared short-date helper (reuse what exists).
- Test file placement and names.

## Calls made without the owner (check these)

1. **A closed list of six relationship types, not a free phrase.** It's consistent, scannable, safe to render, and older or unknown values fail quietly. A free phrase would be more specific but unbounded.
2. **Contradictions use a fixed phrase** ("Same event, different accounts") with no model change.
3. **The named developments replace the squares** rather than sitting beside them.
4. **The index stays in the left column beside the sticky globe**, so index hover still moves a visible globe.
5. **The card tag scrolls to the pinned row,** not to the top of the index.
