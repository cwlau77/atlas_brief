# Card photos: design

Date: 2026-10-26. Branch: `worktree-card-photos`. This covers the backlog item "Card photos: fall back to Commons when the outlet photo fails", widened by the owner to the larger goal: **more story cards on the briefing page show a photo.**

## Why

Many cards on the briefing page show no photo: development cards in the timeline, alert cells, and the Top stories strip. The owner wants most cards to carry a picture, as long as the picture's credit stays honest.

## What we measured (2026-10-26, live, before any change)

Nine live briefings across five focuses (Sudan ceasefire, Red Sea shipping, Taiwan chip export controls and UK housing policy twice each; Gaza aid deliveries once). Scratch scripts: `measure.py`, `referer.py` in the session scratchpad. They are not committed, and the plan re-creates what it needs.

| Card source | Developments (of 50) |
|---|---|
| Outlet photo | 13 (26%) |
| Commons file photo | 15 (30%) |
| Nothing | 22 (44%) |

The Top stories strip is worse than this table shows. Its cards ignore Commons entirely (see finding 4), so about 74% of top-story cards showed the grain gradient.

Findings, biggest lever first:

1. **Commons drops photos it already has.** `commons._lookup` runs the Wikipedia lead-image call (about 0.1s) and the Commons search together and waits for both. A search that Wikimedia hasn't cached can take seconds (Khartoum took 7.27s). The 1.5s budget then expires and the lead image, ready long before, is thrown away. In the first four briefings Commons attached **nothing**, even for London, El Fasher and Hsinchu. Later runs, with Wikimedia's cache warm, attached 15. Lead images alone came back for 5 of 6 places tested; the "Gaza Strip" lead image is filtered out as a map.
2. **The ranked pool is mostly image-less sources.** Google News made up about 64% of ranked articles and Tavily about 25%. Neither carries an image today. RSS and GDELT never reached the ranked pool in any run; GDELT also failed on connect from the dev machine. Filling their image fields would change almost nothing right now.
3. **Tavily already has the photos.** With `include_images: true`, each result carries its page's `images`. 29 of 35 results across three queries had one. It costs **no extra credits** (checked live with `include_usage`: 1 credit either way). It adds about 0.5–1.4s to the Tavily call (2.4–2.7s total, inside the 6s source timeout). GDELT is the slowest source in every run (4–5.5s), so this doesn't lengthen ingest. One sample image was a site banner PNG, not a photo.
4. **Top stories never use Commons.** `StoryCard` reads `dev.leadImage` (the first outlet image) and falls back to the grain gradient. It never looks at `commonsImage`.
5. **Outlet photos rarely fail, but when one fails nothing replaces it.** 1 of 13 outlet photos in the briefings failed with a 403. In a separate probe of 28 outlet images, 1 failed only because a Referer was sent and 1 failed either way. `StoryCard` already sets `referrerPolicy="no-referrer"`; `CardImage` doesn't.
6. **Already done:** `cardImage` already scans every cited source for an image, so "look past the first cited source" needs no work.
7. **Not worth it:** Google News citation URLs are encoded `news.google.com/rss/articles/…` redirects. Getting an image would need a fragile decode step. An og:image fetch on article URLs isn't needed, because Tavily hands us the image for free.

## Goals

1. **Commons keeps lead images.** A slow Commons search never discards a lead image that has already arrived.
2. **Tavily results carry their photo.** Credited "Photo: <outlet>" like every other outlet photo.
3. **Every card has a fallback chain.** If a photo fails to load, the card tries the next outlet photo, then the Commons photo, and only then shows no photo (timeline and alerts) or the gradient (Top stories).
4. **Top stories use the same chain**, so a top story with only a Commons photo shows it, credited as a file photo.
5. **Target:** across the same five focuses, cards with no photo drop from about 44% to **10% or less**, with no added briefing latency.

## Non-goals

- Images for RSS, GDELT, Google News or Alpha Vantage.
- og:image scraping of article pages.
- Any change to card layout, sizes or the design tokens. The changes are which picture shows and its credit text.
- Better relevance or source mix in the ranked pool.

## Anti-goals (a failure even if it technically works)

- A Commons photo credited as if it showed the event, or an outlet photo credited to the wrong outlet.
- A briefing that's noticeably slower, or one that fails because an image lookup failed.
- The same Commons photo on two cards in one briefing (the existing no-repeat rule stays).
- Logos, banners or placeholder graphics showing up as "photos".

## Constraints (owner's rules)

- Reshape, don't rebuild: evolve `tavily_source.py`, `commons.py`, `cardImage.ts`, `CardImage.tsx` and `StoryCard.tsx` rather than adding parallel machinery.
- `httpx`/`httpcore` loggers stay at WARNING. Tavily sends its key in a header, but the rule still stands.
- The backend stays a single process; in-memory caches and background tasks are fine.
- Credits: an outlet photo is "Photo: <outlet>"; a Commons photo is "File photo: <author>, <license>, Wikimedia Commons".
- Design tokens live only in `tokens.css`. No new motion is planned; anything added respects `prefers-reduced-motion`.
- Never push; the owner merges and pushes.

## Design

### 1. Commons: lead image first, search fills in (`backend/synthesis/commons.py`)

- Per query, the lead image's result is recorded as soon as it lands. Search hits are appended (deduped by URL) when the search finishes inside the budget. When the 1.5s budget expires, a query keeps whatever has already arrived instead of returning `[]`.
- A search that overruns the budget keeps running in the background, capped at about 10s total. If both steps succeed, it writes the full result to the 24h cache, so the next briefing on that place gets the full candidate list. Background failures are only logged at INFO. Background tasks are kept in a module-level set so they aren't garbage-collected.
- Caching rule unchanged: only complete results (lead and search both succeeded) are cached.
- The shared `httpx.AsyncClient` from `briefing.py` is closed when synthesis returns, so background work needs its own client (or the lookup must otherwise outlive the request's client). Builder's call how.

### 2. Commons for every development (`briefing.py` `commons_candidates`, `commons.assign_images`)

- Look up a query for **every** development, not only those without outlet images. Same 1.5s budget; it already runs in parallel with historical context and signal links, which take longer, so it adds no time.
- `assign_images` hands out candidates in two passes. First to developments with no outlet photo, which need one most. Then to developments with an outlet photo, as their fallback. Alerts follow as today: photo-less alerts first, then alerts with an outlet photo. The no-repeat rule holds across all of them.
- `commons_image` on an item that also has an outlet photo now means "fallback". No model change.

### 3. Tavily images (`backend/ingestion/tavily_source.py`)

- Send `include_images: true`. Keep `search_depth: "basic"` explicit, so Tavily can't auto-upgrade to a 2-credit search.
- For each result, `image_url` is the first entry of `item["images"]` that passes a light filter: not `.svg`, `.gif` or `.ico`, and the URL path doesn't contain `logo`, `icon`, `avatar`, `placeholder`, `default`, `sprite` or `banner` (case-insensitive). `make_article` already keeps only https URLs and sets `image_outlet` to the outlet. The filter list is my call; the builder may tune it against live samples.
- Entries in `images` may be strings or objects with a `url` key, depending on API version, so handle both.

### 4. One fallback chain for every card (frontend)

- `lib/cardImage.ts`: add `cardImages(sources, commons): CardImage[]`. It returns every distinct outlet image from the cited sources, in citation order, then the Commons photo. Each entry carries its own credit, so the credit always matches the picture shown. `cardImage` stays as `cardImages(...)[0] ?? null` if anything still needs it.
- `CardImage.tsx`: take the list, show the first entry that hasn't failed, and step to the next on `onError`. Add `referrerPolicy="no-referrer"` to match `StoryCard`. With every entry failed, it renders nothing, as today.
- `StoryCard.tsx`: use the same list instead of `dev.leadImage`. Credit overlay: "Photo · <outlet>" for an outlet photo (as now). For a Commons photo it reads "File photo · <author>, <license>, Wikimedia Commons", trimmed with an ellipsis on overflow, with the full text in `title`. It isn't a link, because the whole card is a stretched button (`.story-card-open::after`); the same photo's linked credit is on its timeline card. In the compact variant the "File photo" prefix stays visible (only the outlet "Photo ·" prefix is hidden there). All entries failed → grain gradient, as now.
- Callers: `DevelopmentCard`, `AlertCallout`, `StoryCard`. `leadImage` stays in `normalize.ts` for saved briefings and other readers. Remove it only if nothing else uses it (builder checks).
- Saved briefings in `localStorage` keep working: older ones simply have `commonsImage` only on photo-less items.

## Tests

- **commons:**
  - A lead image arrives and the search hangs past the budget → the query gets the lead image.
  - The overrunning search later completes → the cache holds the full list.
  - A failing search in the background is logged, not raised.
  - Two-pass assignment order, and no repeats.
- **briefing:** commons queries include developments that have outlet images.
- **tavily:**
  - Request body has `include_images: true` and `search_depth: "basic"`.
  - The first passing image becomes `image_url`.
  - Logo, banner and svg URLs are skipped.
  - Images as strings and as objects are both handled.
  - No images → `None`.
- **cardImages:** order, dedupe of repeated outlet images, and the credits for outlet and Commons entries.
- **CardImage, StoryCard:**
  - On error, the card steps to the next image and the credit changes with it.
  - All failed → nothing (CardImage) or the gradient (StoryCard).
  - The Commons credit text and link.

## Verification

Re-run the measurement over the same five focuses after building. Report the outlet / Commons / none split for developments and for Top stories, against the table above. Spot-check a handful of Tavily images by eye for logos or banners. Run the backend and frontend test suites, `npm run build` and `npm run lint`.

## Calls I made (owner skipped the questions)

- When a card can only get a Commons place photo, it **shows it**, credited "File photo", as the timeline already does. This now applies to Top stories too.
- Tavily's image filter list (above).
- The background search cap (about 10s) and the two-pass Commons assignment.
- `referrerPolicy="no-referrer"` on `CardImage`.
