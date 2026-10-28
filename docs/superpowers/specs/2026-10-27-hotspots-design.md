# Hotspots page: design

Date: 2026-10-27. Branch: `hotspots` (worktree `../atlas-hotspots`). This covers the backlog item "Hotspots tab" under "0. Next up", which is project 4 of the 2026-10-20 design review (`2026-10-20-newsprint-identity-design.md` §0 and §10).

Mockup: `assets/2026-10-27-hotspots-mockup.html`, which is version 8 of the brainstorm with the hairline back grid (option B) selected. Open it in a browser; its numbers are made up. The brainstorm went through eight versions, and the rejected directions are listed at the end so a builder doesn't bring them back.

## Why

The owner wants a visual tool that shows which countries the news is talking about most right now. You hover a country and see the main thing going on there, with a picture and a short blurb. It should be fun to use, the way the Home globe is, and look premium rather than like a template.

## Goals

1. **A new top-level page, `/hotspots`,** with a "Hotspots" nav link between the Briefing link and Archive in `NavBar.tsx`. (The nav has no Home link; the wordmark goes home.) It must fit at 375px beside "New brief". Tighten the existing ≤400px rule if needed (padding, gap), but don't add a menu or drop a link. *(My call.)*
2. **A flat world map drawn as a pixel grid.** Each country is a block of small square cells on a faint hairline grid. A country's cells take a colour from a continuous green → red heat ramp and grow in size with heat.
3. **A hover card** for countries that aren't quiet. It shows a photo, the flag, the name, the tier, the article count, a 24-hour sparkline, a headline, a one-sentence blurb, the countries most often named alongside it, and a "Brief me on…" link.
4. **A Top countries list** that slides out from the right on desktop: rank, flag, name, tier, bar and count.
5. **Honest numbers.** The page says what it counts and when it was counted, and never shows a number it can't stand behind.

## Non-goals

- A globe view, and heat markers on any globe. That was the owner's call ("whatever seems best"); I chose flat-only for now. Heat markers on the Home globe go to the backlog (section 12).
- Change against yesterday. Without a database we can't measure it honestly (section 3.4).
- A database, accounts or shared history. The backend stays one process with in-memory caches.
- Changing the briefing pipeline, the Home page or the briefing globe.

## Anti-goals (a failure even if it works)

- **Glitchy, constant motion.** The owner rejected the "liquid" dot map (cursor ripples, breathing dots, pulse rings, drag-to-spin) as "wayyy too glitchy". Motion happens once, in response to something the user did: load, hover, pin. Nothing loops.
- **Name tags on the map,** meaning country names or counts printed over the map. The owner rejected them.
- **Thick outlines and boxed chrome.** Rejected as "basic and cheap". Cards and the legend use corner brackets and a soft shadow, not a border.
- **Instrument chrome.** The owner tried and removed the rulers, crosshair and graticule. Only the small coordinate readout stays.
- **Heat shown by colour alone.** Cell size always carries heat too, and every tier is named in words in the legend, the list and the card.
- **A number with no source.** Every count is articles Atlas actually read, and every card headline and blurb is an outlet's own words.

## 1. Page layout (desktop, at least 820px)

Order, top to bottom, inside the normal `--maxw` container with the usual hairline rules between regions:

1. **Header,** matching other pages: the eyebrow "Hotspots · last 24 hours" with the accent square, the H1 "Where the news is now", and the lede "Countries shaded by how many of today's articles mention them. Hover one to see what's driving it." On the right, the meta: "**840 articles** from 14 world news desks" on one line, and "Updated 14:05 UTC · refreshes hourly" on the next. The time uses the user's chosen time zone, the same way other timestamps in Atlas do.
2. **The stage:** the map with the Top countries panel over its right edge, the legend in the bottom-left corner, and the coordinate readout below the legend.
3. **A short "How this is counted" note** under the stage, in the explanatory style of `HowAtlasReads`. It says what counts as naming a country, the 24-hour window, and the feed list, and that each card shows the most widely covered story in an outlet's own words.

The footer is unchanged.

## 2. The map

### 2.1 Projection and grid

- **Projection:** plate carrée (`geoEquirectangular`), cropped to roughly 58°S to 80°N, with Antarctica dropped. The square cells only look right on a cylindrical projection. *(My call, carried over from the mockups the owner approved.)*
- **Geometry:** `world-atlas` `countries-110m`, which the frontend already depends on through `globe/landPoints.ts`. A small number of tiny countries that no cell centre falls inside (Singapore, Bahrain, most small islands) must still be reachable. They're reached through the list (section 5). The builder may also give any country with no cells one cell at its centroid. *(Builder's call.)*
- **Cells:** a square grid of about 132 columns across the map width at desktop sizes, and coarser on mobile (section 8). A cell belongs to the country its centre falls in. Rendering cells by sampling an offscreen index canvas, as the mockup does, is fine, and so are cell lists precomputed per country (`npm run build:...`, like `landPoints.ts`). *(Builder's call. Precomputing is lighter at runtime.)*
- **Cell size by heat:** the side of each drawn square is `s × (0.50 + 0.38 × t)`, where `s` is the cell pitch and `t ∈ [0,1]` is the country's position on the heat scale (section 2.2). Quiet countries draw small cells and High ones nearly fill their squares.
- **Back grid:** hairlines on every cell boundary across the whole map panel (land and sea), in `--ink` at about 5.5% opacity, 0.5px. This was the owner's choice, option B in the mockup. The panel has no frame, sphere outline or graticule.
- **Glow:** High countries get a soft halo under their cells: the country shape filled in its ramp colour, blurred about 7px, at about 35% opacity. It's static, not animated.

### 2.2 Heat scale and colour

- **The measure:** `n`, the number of articles in the window that name the country (section 3).
- **The scale:** log-based and anchored to the tier cutoffs, so each tier gets an equal share of the ramp: `t = scaleLinear(domain = log1p([0, c_active, c_elevated, c_high, n_max]), range = [0, .25, .5, .75, 1])`, clamped. `n_max` is the day's largest count.
- **Tier cutoffs** are a share of the day's articles, not fixed numbers, so a thin news day isn't all grey and a heavy one isn't all red. They start at **Active ≥ 1.5%**, **Elevated ≥ 4%** and **High ≥ 8%** of `total_articles`, each with a floor of 3, 8 and 15 articles. The builder calibrates these against a few real snapshots and records the values in the plan (section 11). Below Active is **Quiet**.
- **The ramp** is green → red. This was the owner's choice, made after I advised against it because of colour-blind readers; the second cue is the cell size. The stops, in Lab interpolation, are: t=0 `#5E9F6E`, .25 `#A3BF63`, .45 `#E2BE4E`, .62 `#E08A2A`, .80 `#E2381B` (the existing `--hot`), 1.0 `#A3200B`. New tokens `--heat-0` to `--heat-5` go in `tokens.css` with a comment saying they belong only to the Hotspots heat ramp.
- **Where green may appear:** only on this map's heat ramp and in the swatches of its legend, list and card. It is not an Atlas UI colour. The identity spec's rule that red and amber mean heat is unchanged, and the ramp's orange and red stops are heat.
- **Text** never wears ramp colours. Tier labels use the existing text tokens: High in `--hot-ink`, Elevated in `--warm-ink`, Active and Quiet in `--ink-2`, each with a square swatch in the ramp colour beside it.

### 2.3 Legend

Bottom-left of the map, with corner brackets and a near-opaque paper background. It contains:
- the title "Mentions, last 24 hours";
- the subtitle "Articles naming the country · bigger, redder cells, more mentions";
- a gradient bar of the ramp, with the real cutoff counts placed at their positions (0, then the three cutoffs, then `n_max`);
- tier names under the bar;
- one sample cell per tier at its drawn size.

It scales with the viewport (font roughly 0.68–0.78rem) and moves under the map below 820px.

### 2.4 Coordinate readout

The latitude and longitude under the pointer (for example "48.20° N  31.40° E"), shown bottom-left only while the pointer is over the map, in `--ink-3` with tabular figures and `aria-hidden`. It works like the globe's readout, and `globe/readout.ts` can be reused if it fits.

## 3. Data: what is counted, and how

### 3.1 Endpoint

`GET /hotspots` (proxied as `/api/hotspots`) returns a snapshot:

```
Hotspots {
  generated_at: ISO datetime
  window_hours: 24
  coverage_hours: int        # how far back the counts reach, ≤ 24 (section 3.3)
  total_articles: int        # deduped articles in the window
  feeds: int                 # feeds that answered
  cutoffs: { active, elevated, high }   # article counts
  countries: [CountryHeat]   # every country with n ≥ 1, sorted by n desc
}
CountryHeat {
  iso2, iso_numeric: str     # iso_numeric matches world-atlas ids
  name: str                  # display name ("United States", not "United States of America")
  n: int
  tier: "quiet" | "active" | "elevated" | "high"
  hourly: [int] × 24         # articles per hour by publish time, oldest first
  with: [iso2] (≤ 3)         # co-mentioned countries, ≥ 3 shared articles
  story: Story | null        # only for active and above
}
Story {
  headline: str              # the outlet's own title
  blurb: str | null          # the outlet's own snippet, first sentence
  article: { title, url, outlet, published_at, image_url | null }
  image: { url, credit } | null  # the article's image, else a Commons file photo
}
```

The builder may adjust field names. The meanings stay as written.

### 3.2 Sources

- **The 14 world desks in `RSS_FEEDS`, and nothing else** (owner decision, 2026-10-27): BBC World, Al Jazeera, The Guardian World, NPR World, The Hindu, Deutsche Welle, France 24, AllAfrica, Straits Times, CNN World, Fox News World, New York Times World, ABC News International and CBS News World. They're fetched with no keyword filter. The US domestic, tech and finance desks and Google News US top stories are left out, because about half of the full feed list is US domestic and the United States would rank High every day. With world desks only, the US shows up where world news involves it. Define the list in `hotspots.py` as names drawn from `RSS_FEEDS`, so the URLs live in one place. Reuse the fetch helper (`_fetch_feed_text`), but parse with a Hotspots-only parser. The existing `_parse_feed` caps each feed at `max_articles_per_source` (15) and doesn't read images. The Hotspots parser takes every entry and reads the entry image from `media:content`, `media:thumbnail` or an image `enclosure`. The shared briefing path (`rss_source.fetch`, `_entry_to_article`) is not changed. *(My call. Putting feed images on briefing cards too is a backlog item.)*
- **No keyed APIs.** NewsAPI, GNews and the other keyed sources have daily quotas, and an hourly crawl would eat them. GDELT is rate-limited and paced in-process, so it's left out too.
- A feed that fails is skipped and logged, the same as in a briefing. The snapshot's `feeds` count shows how many answered.
- Keep the `httpx`/`httpcore` loggers at WARNING (`main.py`). None of these feeds use keys, but the rule stands.

### 3.3 Window, dedupe and matching

- **Window:** articles published in the last 24 hours. Articles with no publish date are dropped, because we can't place them in the window.
- **Feed depth, and being honest about it:** many feeds hold well under 24 hours of entries, which would make older hours look quiet and every sparkline rise toward "now". So:
  - **Accumulate across refreshes.** The backend keeps a rolling in-memory store of the articles it has seen in the last 24 hours, deduped by URL. Each rebuild adds that fetch's entries and drops anything older than 24 hours. While the process stays up, coverage fills out to a full day. After a restart or a Render sleep it starts again from one fetch.
  - **Measure coverage.** For each feed that answered, record its oldest entry. `coverage_hours` is how far back at least half of those feeds reach: the median of their oldest entries, merged with the store's own history, in whole hours, capped at 24.
  - **Say it.** When `coverage_hours` < 24, the eyebrow, legend title and card read "last N hours" instead of "last 24 hours". The sparkline spans only the covered hours, with its left caption reading "Nh ago". The "How this is counted" note explains why.
  *(My call.)*
- **Dedupe:** exact URL, then near-identical titles (normalised, so the same wire story from two outlets counts once). Reuse `processing/` helpers where they fit. Embedding dedupe isn't needed.
- **Matching:** an article names a country if its title or snippet contains, as whole words, the country's name or an alias ("US", "U.S.", "UK", "Britain"), its demonym ("Ukrainian", "Ukrainians"), or its capital ("Kyiv"). This is deterministic, with no model involved. The gazetteer is a new data file, `backend/data/countries.csv`, holding ISO2, ISO numeric, display name, aliases, demonyms and capital. The aliases in `places.py` (`_COUNTRY_ALIASES`) are the starting point. Gaza and the West Bank map to Palestine (`PS`), as `places.py` already does.
- **Ambiguous names** need explicit rules and tests. My starting list:
  - Turkey/turkey: count "Türkiye", "Turkish", "Ankara" and capitalised "Turkey" only when it isn't the first word of a food or holiday context. Simplest is to count "Turkey" only with a capital T, mid-sentence or in a title.
  - Georgia: the US state vs. the country. Count only "Tbilisi", "Georgian government" and the like, or "Georgia" with no US context word nearby.
  - Jordan (a person's name), Chad (a first name), Niger, Guinea (several countries), Congo (two countries: DRC aliases go to `CD`, a plain "Congo" goes to `CD` unless "Brazzaville" or "Republic of the Congo" appears), Dominica vs. Dominican Republic, and "Washington" (the US government, not the state). The builder settles these with tests, choosing false negatives over false positives.
- **Counting:** an article counts once per country it names. One article naming Ukraine and Russia counts for both. `n` is the number of distinct articles.
- **Co-mentions (`with`):** for each country, the other countries that appear in the same articles, ranked by shared-article count, keeping the top 3 with at least 3 shared articles.
- **Hourly series:** articles per hour by `published_at` over the 24-hour window, oldest hour first.

### 3.4 Why there's no "change on yesterday"

The mockups showed "▲ 38% on yesterday". That's cut: we keep no history across restarts, Render's process sleeps, and RSS feeds rarely hold 48 hours of entries. The sparkline shows the shape of the last 24 hours instead. The list's right column shows the count only. *(My call.)*

### 3.5 The card's story (no model call)

**Owner decision, 2026-10-27: no LLM call.** An earlier draft used one Haiku call per refresh (about $6 a month at most), and the owner rejected it as too expensive. The page costs nothing to run beyond the feed fetches.

- **Countries:** every country at Active and above gets a story.
- **Representative article:** in the country's set of articles, the one whose title shares the most content words (stopwords and the country's own names removed) with the country's other titles. That's the story most outlets are covering. Ties go to the newer article.
- **Headline:** that article's own title, word for word, with the trailing " - Outlet" suffix stripped as `trending.py` does.
- **Blurb:** that article's own snippet, HTML stripped and trimmed to its first sentence (at most about 30 words, cut at a word boundary with an ellipsis), or null if it has none. It's never rewritten.
- **Attribution:** the outlet and age ("BBC World · 2h ago"), linking to the article.
- **Cost: $0.**

### 3.6 Images

- Use the representative article's image when its feed gives one (the Hotspots parser reads it, section 3.2), credited to its outlet. RSS articles have no image in the shared briefing path today, so this only works through the Hotspots parser.
- Otherwise use a Wikimedia Commons file photo for the story headline (or the country name), via `synthesis/commons.py`, which has an in-memory 24-hour cache and a background backfill. It's credited "File photo · Wikimedia Commons". Give the lookups a short total budget (about 2s) so a slow Commons call doesn't hold the snapshot up. A miss means no image.
- **No image:** the card drops the photo block entirely, rather than showing a placeholder.

### 3.7 Caching and refresh

- **In-process cache** like `trending.py`: one snapshot, a lock so only one rebuild runs at a time, and a TTL of `hotspots_ttl_minutes = 60`. A failed rebuild keeps serving the last good snapshot if there is one; with nothing to serve it returns 503, so the frontend shows its fallback (section 7). Failures are retried after `FAILURE_TTL_SECONDS`, the same as trending.
- **Stale-while-revalidate:** once a snapshot exists and has expired, the request that notices gets the stale snapshot immediately and starts a rebuild in the background. Only a cold start (no snapshot at all) waits for the build. *(My call, so a visitor never waits on 14 feeds once the process is warm.)*
- **Rate limit:** the per-IP limiter in `main.py` should not count `/hotspots` against the briefing quota. Give it the same treatment as `/trending`.

## 4. Hover and pin

The motion follows the mockup (`setHover` in the mockup file is the reference implementation). Every duration below is skipped under `prefers-reduced-motion`, where the final state appears instantly.

- **Quiet country:** no lift and no card. A small paper tooltip above the country's centre shows the flag, the name and "· N articles".
- **Active and above, on hover:**
  1. The country **lifts**: its cells (redrawn on top) translate up 12px and scale to 1.07 over 450ms with `cubic-bezier(0.2, 0.8, 0.2, 1)`, the curve taken from the owner's Product Space reference. A blurred ink copy of the shape fades in to 30% opacity, offset (6px, 12px). A faint slot (`--ink` at 7%) stays at the original position. The rest of the map fades to 40% opacity. On leaving, the country settles back over the same 450ms and is removed after.
  2. At 320ms a **point** pops onto the lifted country's anchor point (its centroid, with hand-set anchors for the US, France, Russia, Canada and Australia, as in the mockup), and a ring ripples out from it once.
  3. At 500ms the **leader line** draws from the point to the card over 300ms (an elbow: the point, then halfway across, then the card edge).
  4. At 780ms the **card** slides in from the leader's side over 450ms, and its count ticks up from 0 to `n` over 700ms.
  5. From 950ms, ultramarine (`--accent`) **arcs** draw once to each co-mentioned country, 140ms apart, over 700ms each. Each ends in a small ring. There's no travelling spark and no loop.
- **Hit testing** uses flat, invisible country shapes that never move, so a rising tile can't make the hover flicker. The mockup's `#hits` layer does this.
- **Card placement:** try right, left, below and above the country. Score each by how many other non-quiet countries and arc points it would cover, and take the lowest. The card must stay inside the map area and clear of the open panel. The mockup's `score` function is the reference.
- **Pin:** clicking a non-quiet country, pressing Enter on it, or clicking or pressing Enter on a list row **pins** it. The card stays and becomes interactive (pointer events on), so its links work, and hovering other countries doesn't replace it. Esc, clicking empty map, or clicking the card's close button (×, top-right) unpins. While a card is pinned, hovering another country does nothing.
- **Keyboard:** the map itself isn't a tab stop. The Top countries list rows are the keyboard path: focusing a row behaves like hovering its country, and Enter pins it.

### 4.1 The card

It's 288px wide on a paper background with corner brackets (top-left and bottom-right, ink, 10px) and a soft shadow: `0 30px 50px -28px rgba(14,17,22,.55)` plus a hairline ring at 6%. The soft shadow is a deliberate, local exception to the identity spec's no-shadow rule, used only on the Hotspots lift, card and tooltip. *(My call. The owner asked for the float.)*

Contents, top to bottom:
1. **Photo,** 112px tall, cover-fit, with its credit in small text over the bottom-left. It's dropped when there's no image.
2. **Flag, name and tier tag** (tier word in its text token, with a ramp swatch).
3. **Stat row:** the count in large type (about 1.7rem, 600) with "articles in 24 hours" under it, and beside it a 24-hour sparkline (an `--ink` line over a light area, with its last point in the country's ramp colour) captioned "24h ago" and "now".
4. **Headline** (1rem, 600).
5. **Blurb** (0.82rem, `--ink-2`).
6. **Attribution line,** `--ink-3`: the outlet and age ("BBC World · 2h ago"), linking to the article. Under it, "1 of 23 articles naming Ukraine".
7. **"Often named with"** and up to three flags and names, if any.
8. **"Brief me on {headline} →"** in `--accent` (section 6).

### 4.2 Flags

Rectangular 4:3 flags from the `flag-icons` package (MIT), not emoji. Import only the SVGs needed, through a small `Flag` component keyed by ISO2, rather than its full stylesheet of 250+ flags. *(Builder's call: copying the needed SVGs into `public/` is also fine.)* Each flag gets a 1px inset ring at 14% ink so white flags hold their edge.

## 5. Top countries panel

- **Desktop:** a 300px panel over the right of the stage, open by default. The map is fitted to the width left beside it, and refits when the panel toggles. A paper tab ("Top countries ›") on its left edge toggles it, and the panel slides in and out over 350ms with the lift curve. The panel's header reads "Top countries", with "By articles mentioning them, last 24 hours" under it.
- **Rows:** the top 15 by `n`. Each row has its rank, flag, name, tier tag, a 3px bar (width ∝ `n / n_max`, in the ramp colour, growing in once on load with a 45ms stagger), and the count. There's no change column (section 3.4).
- **Interaction:** hovering or focusing a row equals hovering its country, and clicking or Enter pins it. A pinned or hovered row gets the `--accent-wash` background.
- It's a real list of buttons and the accessible path to all the data (section 9).

## 6. "Brief me on…"

It starts a normal briefing with **the card's headline as the focus**, for example "Drone strikes hit Kyiv power grid", not just "Ukraine". *(My call, because a story focus gives a much better briefing than a country name.)* It navigates to Home with the focus passed in router state, and Home starts generating as if the user had submitted it, so the loading ledger and globe run as usual. That needs a small, reshaping change to `HomePage` that reads the state once and then clears it, so Back or a refresh doesn't start it again.

## 7. Loading, cold start and failure

- **Browser cache:** keep the last snapshot in `localStorage` under its own key (with versioning like `atlasTrendingV2`), read with try/catch. Paint it immediately on load, with the meta line reading "As of 14:05 · refreshing…" until the fetch lands.
- **First visit, nothing cached:** draw the full grid as a **skeleton**: every land cell in a neutral grey at the quiet size, with no ramp and no glow. Over the map, the line "Waking the server… this can take up to a minute." The Render free instance sleeps. The list shows 8 skeleton rows.
- **Fetch fails or times out** (allow about 60s for a cold Render start): with a cached snapshot, keep it and change the meta to "As of 14:05 · couldn't refresh" with a Retry link. With nothing cached, show an empty state in the map ("Hotspots are unavailable right now.") with Retry.
- **Fewer than 5 feeds answered,** or fewer than 100 articles: render as normal, but the meta adds "· partial coverage".
- **Re-fetch** only when the page is opened, or when the tab becomes visible after the snapshot's `generated_at` is more than 60 minutes old. No polling.
- **On load, the cells settle in once:** each country fades and drops 12px over 900ms, Quiet first and High last (the mockup's `enter` animation). Skipped under reduced motion.

## 8. Mobile (below 820px)

- The map takes the full width at a coarser grid (about 72 columns), so cells stay at least about 4px.
- There's no hover. **Tapping** a non-quiet country pins it, and the card opens as a **bottom sheet** (full width, with the same contents and a × close button) instead of floating beside the country, with no leader line. The lift and arcs still play. Tapping a quiet country shows its tooltip for 2 seconds.
- The legend sits under the map as a block, and the Top countries list sits below the legend, always open, with no tab.
- There's no coordinate readout, since there's no pointer.
- Check it at 375px.

## 9. Accessibility

- The map SVG gets `role="img"` and an `aria-label` that summarises it: "World map of news mentions in the last 24 hours. Highest: Ukraine, 412 articles; Russia, 336; China, 298." The cells are decorative.
- The Top countries list is the accessible path to the data. Rows are buttons with accessible names like "Ukraine, High, 412 articles". The pinned card is labelled `role="dialog"` with `aria-modal="false"` and takes focus when pinned; Esc returns focus to the row or the map.
- The tier is always named in words next to every swatch.
- Contrast: tier text uses the existing `-ink` tokens. Check the ramp stops against the paper background as UI graphics (3:1) where they have to stand alone. Small cells are always backed by the legend and the list, so the lightest green stop may fall below 3:1 (as with the dataviz rule's "contrast WARN obligates labels or a table"); the list is that table.
- All motion respects `prefers-reduced-motion` (sections 4 and 7).

## 10. Architecture notes for the builder

- **Backend:** a new module `backend/hotspots.py`, modelled on `trending.py` (fetch, count, pick stories, cache), plus `backend/data/countries.csv` and an `@app.get("/hotspots")` route in `main.py`. Response models go in `models.py` or local to the module, following `trending.py`. The one new setting, `hotspots_ttl_minutes`, goes in `config.py`. Nothing needs adding to `.env.example` unless a toggle like `HOTSPOTS_ENABLED` is added. If one is, the backlog's off switch is the builder's call.
- **Frontend:**
  - A route `src/routes/HotspotsPage.tsx` plus a CSS file, and a nav entry in `NavBar.tsx`.
  - `src/lib/hotspots.ts` holds the fetch, the localStorage cache and the scale and tier helpers, modelled on `lib/trending.ts`.
  - The map is a component under `src/components/hotspots/` that uses `d3-geo` and `topojson-client`. Check which of these the frontend already has. `d3-geo` may need adding: it's small, and the briefing globe doesn't use it. Adding a dependency is a decision, so note it in the plan.
  - The mockup is plain DOM and d3. The build should be React-rendered SVG, with d3 only for projection and paths. *(Builder's call where the boundary falls.)*
- **Reshape, don't rebuild:**
  - Reuse `Toast`, the existing tag and eyebrow styles, the `upperFirst` helper, `timezone` formatting, and the globe's readout formatting where they fit.
  - The only change to Home is reading the focus passed in router state (section 6).
  - The briefing globe, `engine.ts` and `StaticGlobe.tsx` are untouched.
- **Saved briefings in localStorage keep rendering.** Nothing here touches their shape.

## 11. Tests and verification

- **Backend (`backend/tests/test_hotspots.py`):**
  - Country matching: names, aliases, demonyms and capitals, plus every ambiguous case in 3.3 with both a should-match and a should-not-match example.
  - Counting once per article per country; dedupe; the 24-hour window and dropping undated articles; the hourly series; co-mention thresholds; cutoffs and tiers from shares and floors.
  - Representative-article choice, title suffix stripping, and the snippet trim to one sentence.
  - Cache, lock and stale-while-revalidate behaviour; 503 with no snapshot.
  - Feeds are mocked; no network in tests.
- **Calibration:** run the real snapshot builder a few times against live feeds and record the article totals, the top 10 counts and the resulting cutoffs in the plan. Adjust the share cutoffs (2.2) if High covers more than about 6 countries or none.
- **Frontend (vitest):**
  - Scale and tier helpers, and the ramp endpoints.
  - The cell-size formula.
  - Snapshot caching (including localStorage throwing).
  - Card placement scoring.
  - The list renders and pins from the keyboard.
  - The skeleton, failure and partial states.
  - Reduced motion skips the animations.
  - Every new colour lives in `tokens.css` (extend `palette.test.ts`).
- `npx tsc -b`, `npm run lint` (3 pre-existing warnings), `npx vitest run`, `npm run build`, and `.venv/bin/python -m pytest backend/tests -q` all pass.
- **Live check** with the backend running locally and real feeds: desktop and 375px, hover, pin, Esc, the panel toggle, the skeleton (block `/api/hotspots`), failure, and reduced motion.

## 12. Backlog additions

- Heat markers from `/hotspots` on the Home hero globe (the `--hot` and `--warm` marker split the identity spec deferred).
- "Change on yesterday" once there's storage (backlog §4, Supabase).
- Multilingual feeds, so coverage isn't only English-language outlets.
- Feed images (`media:content`, `media:thumbnail`, `enclosure`) for briefing cards through the shared `rss_source.py`.

## Calls I made (for the owner to check)

1. Flat map only, with no globe view (the owner said "whatever seems best").
2. Tier cutoffs as a share of the day's articles, with floors, rather than fixed counts.
3. "Change on yesterday" cut. The sparkline stays.
4. Capitals and demonyms count as naming a country.
5. Cards show the most widely covered article's own headline and snippet, with no model call (owner: "too expensive").
6. "Brief me on…" uses the card's headline as the focus, not the country name.
7. Stale-while-revalidate caching on the backend.
8. A soft shadow on the lift, card and tooltip, as a Hotspots-only exception to the no-shadow rule.
9. Green appears only in the heat ramp and its swatches.
10. Feed depth handled by accumulating articles in memory and labelling the real coverage ("last N hours").
11. A Hotspots-only feed parser that reads feed images. The briefing path is unchanged.
12. Nav placement between Briefing and Archive, fitting at 375px without a menu.

## Rejected in brainstorming (don't bring back)

- The liquid dot map (cursor ripples, breathing dots, pulse rings, the dots' fly-in intro, drag-to-spin, the globe fold): "too glitchy".
- Engraved lines, halftone and the tilted 3D relief.
- Instrument rulers, crosshair and graticule.
- Heat-terrain contours, the shaded-relief stone texture, hex cells and the dark night panel.
- Flat tiles with thick black outlines.
- Emoji flags.
- Name and count tags on the map.
