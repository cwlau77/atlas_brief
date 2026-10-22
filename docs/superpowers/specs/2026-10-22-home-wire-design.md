# Home page wire: design

Date: 2026-10-22. Branch: `home/wire-ticker`. This is roadmap project 3 (home page), narrowed by the owner to one piece for this round: the live ticker. The value-prop copy, the "13 sources" explanation and the loading-screen globe stay on the roadmap for later rounds.

## Why

Under the ask box, Home shows "Trending now" chips (`components/TopicChips.tsx`, fed by `GET /trending`). The owner says they feel **static and a little AI**:

- **The look:** a neat row of pill chips is a common AI-app pattern.
- **The wording:** the topics read like labels a model wrote, not the way a newsroom puts things.

The ticker's job is to be **a door into a briefing**. Someone watching it for a few seconds should want to click a line and get briefed on it.

## What it is (decided by the owner from mockups)

**Option B, "Wire":** a short, timestamped list styled like a news-agency feed. The owner chose it over a scrolling crawl and a one-at-a-time rotator.

- It replaces the chips in the same place, under the ask box.
- **Header row:** the label "On the wire", with the small hot square used for live/heat elsewhere, on the left. On the right, "Updated HH:MM" in the reader's time zone (the settings time zone Home's clock already uses).
- **Each line:** the time in mono, the topic (Plex 500), and a quiet "Brief me →" cue on the right. Lines are divided by `--rule` hairlines, and an `--ink` rule sits on top of the block, matching the Newsprint look.
- **Clicking a line** starts a briefing on that topic, exactly as clicking a chip does today: it prefills the ask box and calls `generate(topic, 'daily')`. Lines are disabled while a briefing is loading.
- **Topics are short, in newsroom style** (owner decision): short, specific and active, like "FAA clears 737 MAX 10", "Gaza truce talks resume" or "Fed holds rates". Not labels like "Global Trade Tensions" or "Middle East security developments". This is the same kind of content as today's chips, worded differently.

Reference mockup: `.superpowers/brainstorm/36213-1792643685/content/ticker-styles.html`, option B. It is git-ignored scratch, so the description here is the binding one.

## Goals

1. The wire replaces the chips under the ask box, with the look described above.
2. The topic wording reads like a newsroom wrote it.
3. The times are real: each line shows when the newest headline behind that topic was published.
4. The wire looks and reads live: real times, an "Updated" stamp, newest at the top. The list is still rebuilt hourly (owner decision, 2026-10-22), so it mostly changes between visits rather than during one. When a refresh does bring a new topic during a visit, that line gets a brief `--accent-wash` highlight that fades. With reduced motion it just appears.
5. A click on a line starts that briefing.

## Non-goals

- The value-prop copy, the "13 sources" explanation and the loading-screen globe.
- A new news source. Trending stays on Google News US top stories.
- Real headlines or outlet names on the wire (owner decision: short topic names).

## Anti-goals (a failure even if it technically works)

- It looks like chips again, or like a generic AI widget: pills, rounded corners, gradients, sparkle icons.
- It moves constantly or distractingly. The wire is calm. Only new topics animate, once.
- The times are fake or decorative, such as every line showing the fetch time.
- Home breaks or looks empty when the backend is asleep, has no key, or fails.

## Behaviour details

- **How many lines:** up to 5 visible. The backend already caps topics at 6 (`MAX_TOPICS`); the builder may keep 6 and show 5, or lower the cap.
- **Which topics:** the model still picks the most significant topics, up to the cap, as today.
- **Order (designer's call):** newest first on screen, by each topic's time, because a wire reads top-down as newest. Undated topics go last, in the model's order. Their time column stays the same width and is left blank, never filled with a fake time.
- **Fallback:** with no topics (backend asleep, no key, failure), the wire shows the fixed `SUGGESTIONS` from `HomePage.tsx`. Fallback lines have no times and no "Updated" stamp, and the header reads "Suggested", the way the chips switch labels today. Home must never show an empty or broken block.
- **Refresh while open:** both caches stay as they are (owner decision): 60 minutes on the backend (`trending_ttl_minutes`) and 30 minutes in `sessionStorage` (`lib/trending.ts`).
  - While Home is open and the tab is visible, the page checks about every 10 minutes. It refetches only once the session copy has expired, so an open page picks up the next hourly list without extra model calls.
  - It does not check while the tab is hidden.
  - A failed refresh keeps the current lines.
- **"Updated HH:MM" (designer's call):** the backend's `generated_at`, the time the list was built, shown as originally stamped even when served from the session cache. It may be later than every line's time; that's correct, since it says when the list was checked. Fallback mode has no stamp.
- **New-topic highlight:** a topic whose text wasn't in the previous list counts as new.
  - It gets the wash highlight for about 1–2 seconds, and only under `prefers-reduced-motion: no-preference`.
  - A new topic outside the visible cap gets no highlight.
  - On first load, nothing highlights. Lines can use the same gentle entrance the chips have today, guarded the same way.
- **Accessibility:**
  - The wire is a labelled list (`aria-label` "On the wire" or "Suggested topics").
  - Each line is one real `button`, with an accessible name such as "Brief me on FAA clears 737 MAX 10, 08:41". The visible topic comes first in the name (label in name).
  - Targets are at least 24px high, and the focus ring is 2px `--accent` with a 2px offset.
  - New topics are not announced through a live region, because that would be noisy. A polite announcement is optional and the builder's call.
- **Phone width:** lines stay one row. The topic may wrap. The "Brief me →" cue can hide below about 480px, since the whole line is the target.

## Backend changes

In `backend/trending.py`:

- **Headline times:** `_headlines()` also keeps each entry's published time (feedparser's `published_parsed`). Entries without one count as undated.
- **The model call:** the prompt numbers the headlines. For each topic, the model returns the topic text and the numbers of the headlines it groups, for example `{"topics": [{"topic": "FAA clears 737 MAX 10", "headlines": [3, 11]}]}`. The topic's time is the newest published time among those headlines, or none if all are undated or the numbers are invalid. Out-of-range numbers are ignored.
- **The wording instructions** change to newsroom style:
  - a short headline-like phrase, about 3–6 words
  - present tense and active, with a specific actor or place
  - no generic categories
  - no sport, celebrity or entertainment
  - the `MAX_TOPIC_CHARS` limit still holds
  - keep the untrusted-data guard
  The exact wording is the builder's call. A few examples in the prompt help.
- **One list, two views (designer's call):** dedupe on topic text, the same way `_clean` does now, and apply the cap. The surviving items produce both `items` and `topics`, so they can never disagree. Two topics may cite the same headlines; both stay.
- **Response shape:** keep `topics: list[str]` exactly as it is. Vercel and Render deploy separately, so an older frontend may meet a newer backend. Add `items: list[{topic: str, published_at: str | null}]` with ISO-8601 UTC times, in the same order as `topics`, and keep `generated_at`. The frontend uses `generated_at` for "Updated HH:MM".
- **Parsing fallback:** if the model returns the old shape (plain strings), accept it with `published_at: null`.
- **Caching and failure behaviour:** unchanged (60-minute cache, 5-minute failure cache, never raises).

## Frontend changes

- **A new wire component** (for example `components/TopicWire.tsx`) replaces `TopicChips` in `HomePage.tsx`, with the same `fallback`, `onPick` and `disabled` props. Remove `TopicChips`, its test, and the `.chips` and `.chip` rules in `routes/home.css`.
  - Removing `.chip` from `home.css` matters beyond tidiness. The briefing page's `components/briefing/story.css` also defines a global `.chip` (its source, region and connection chips), and the two collide once both stylesheets have loaded in the SPA. Don't reintroduce a global `.chip` on Home: use wire-specific class names.
- **`lib/trending.ts`:** `loadTrending` returns items `{ topic, publishedAt: string | null }` plus `generatedAt`. It reads `items` when present and falls back to `topics` with null times. Bump the session cache key (for example `atlasTrendingV2`) so an old cached string list isn't misread.
- **Styles** go in `home.css` (or a stylesheet next to the component), using tokens from `tokens.css` only:
  - IBM Plex Sans and IBM Plex Mono only, as the rest of the app uses.
  - Ultramarine only for hover (topic text turns `--accent`) and focus.
  - The hot square in the header is the only heat colour.
  - All motion inside `prefers-reduced-motion: no-preference`.
- **Times format:** HH:MM in the reader's settings time zone. *Designer's call:* a topic from before today's local calendar day (the feed can carry yesterday's stories) shows a short day as well, such as "Tue 21:10", rather than a misleading bare time. Tests use a fixed clock.

## Tests

- **Backend:**
  - parsing of the new shape
  - picking the newest time among a topic's headlines
  - undated headlines and invalid numbers
  - the old plain-string reply still works
  - the response still carries `topics` alongside `items`
  - failures still return empty lists
- **Frontend:**
  - the wire renders lines with times and the "Updated" stamp
  - fallback mode shows the suggestions with no times and the "Suggested" label
  - clicking a line calls `onPick` with the topic
  - lines are disabled while loading
  - a refresh that adds a topic marks only that line as new
  - `loadTrending` reads `items` and falls back to `topics`
  - the cache key change
  - CSS tests for the 24px target, the focus ring and reduced-motion guarding, in the style of the existing CSS tests

## Left to the builder

- Component and class names; the file layout of styles.
- The cap of 5 or 6.
- The exact prompt wording.
- The highlight duration (about 1–2 seconds), and whether to add a polite live-region announcement.

## Done when

- The backend and frontend test suites pass, and lint and build pass.
- With the backend running, Home shows the wire with real times and newsroom-style topics, and clicking a line starts that briefing.
- With the backend stopped, Home shows the fallback suggestions in the same wire style.
- After visiting a briefing and returning Home, neither page's chips or lines pick up the other page's styles.
