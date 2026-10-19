# Atlas UI vision, spec 3: globe zoom and story carousel, top stories, routes, arcs, named cities, article images

Date: 2026-10-19. Status: draft for review.

This is spec 3 of the UI vision (spec 1: `2026-10-18-atlas-brand-identity-design.md`; spec 2: `2026-10-19-ui-layout-polish-design.md`, shipped). The original spec 3 placeholder was "story timeline tuning, globe arcs, click-to-zoom, story carousel, article images". The brainstorm on 2026-10-19 turned that into the parts below. Unlike spec 2, this one has **backend** work: article images and named cities.

Mockups are in `.superpowers/brainstorm/39590-1792438702/content/` (git-ignored, local).

## 1. Why

- **The globe is decorative after the first glance.** Its points show a region name and a count, but you can't dive into a place. The owner wants to click a point, zoom in and browse that place's stories.
- **The briefing has no visual entry point.** It's all text, and a strip of photo cards would make the top stories scannable.
- **The strings read as decoration** (owner, after spec 2): "it is unclear the connections between the stories … the strings look like more decoration than meaning." Connections must say what they are.
- **Points sit on country centres.** A Yemen story about Aden shows as a dot in the middle of Yemen.

## 2. Goals, non-goals, anti-goals

**Goals**
- Clicking a globe point zooms to it and opens a carousel of that place's developments, with photos.
- A "Top stories" photo strip on the Story tab.
- Spec 2's loose threads are replaced by **transit-style routes** with a key, colour-matched to tabs and to new **globe arcs**, plus explain-on-hover.
- Developments are pinned to a **named city** when the story has one.
- **Article images** are captured from the sources that provide them.

**Non-goals**
- The Home globe stays as it is: no zoom, arcs or carousel there.
- No trending topics on Home. That's a separate backlog item (`docs/BACKLOG.md`, "Home: trending topics").
- Spec 2 work isn't revisited beyond what the routes replace.
- Don't store or proxy images. Don't generate any imagery.
- No places finer than a city (no ports, straits or addresses).

**Anti-goals**
- Connections that still read as decoration: every route must be explained by its key and its hover note.
- Invented coordinates. A city's position always comes from the bundled city list, never from the model.
- Broken-image icons or grey boxes. A missing or failed image always shows the designed fallback.
- Breaking older saved briefings, which have no images or cities.
- Royal blue spreading: it stays for signals and highlights only (spec 2 rule).

## 3. Backend: article images

- `models.Article` gains `image_url: Optional[str] = None`. `make_article(...)` gains an `image_url` keyword that keeps only `https://` URLs (anything else becomes `None`).
- `models.SourceCitation` gains `image_url: Optional[str] = None`. `synthesis/briefing.py` `_parse_citations` copies it from the cited `Article`. The fallback briefing does the same.
- **Sources** pass their image field through. Builder: confirm each field name against the API docs and the existing test fixtures.

  | Source | Field |
  | --- | --- |
  | NewsAPI | `urlToImage` |
  | GNews | `image` |
  | NewsData | `image_url` |
  | Guardian | `fields.thumbnail` (add `thumbnail` to `show-fields`) |
  | Brave | `thumbnail.src` |
  | Marketaux | `image_url` |
  | Finnhub | `image` |
  | Exa | `image`, if present |

  RSS, GDELT, Google News, Tavily and Alpha Vantage provide no image. Their articles get none, and that's expected.
- **Dedupe:** when two articles merge, keep an image if either has one.
- There's no change to the response shape apart from the optional fields, so older clients ignore them.

## 4. Backend: named cities (owner chose "AI names it, a city list places it")

- **Prompt.** In the synthesis JSON schema, each `key_developments` item gains `"city": "City, Country"`. That's the most specific city the story happens in, or `null` when there isn't one or it's unclear. One added schema line and one instruction line ("Name a city only if the cited articles place the events there; otherwise null"). There's no extra model call.
- **Lookup.** New `backend/places.py`, loaded once at import, reading `backend/data/cities.csv`. That file is generated from GeoNames `cities15000`, filtered to population ≥ 100,000, with columns `name, ascii_name, alt_names (a few common ones), country_code, country_name, lat, lng, population`.
  - Matching is case- and accent-insensitive on the city name, constrained to the named country when one is given. When several match, the highest population wins.
  - It's checked against the development's `regions`: if the city's country isn't among them and none of the regions is a sea or supranational name, the city is dropped.
  - On no match, `place` is `None`.
- **Model.** `KeyDevelopment` gains `place: Optional[Place]`, where `Place = {name: str, country: str, lat: float, lng: float}`. Only resolved places are returned. The raw model string is never passed through.
- **Licence.** GeoNames data is CC BY 4.0. Add an attribution line ("City data © GeoNames, CC BY 4.0") to the backend README and the footer's Project column.
- **Script.** Add `backend/scripts/build_cities.py`, which downloads `cities15000.zip` and writes the CSV, so the file can be regenerated. Commit the generated CSV; it's well under 1 MB.

## 5. Frontend data

- `lib/types.ts` mirrors the new optional fields. `lib/normalize.ts` gives each `ViewDevelopment`:
  - `leadImage: string | null`: the first source with an `image_url`, in citation order.
  - `place: { name, country, lat, lng } | null`.
- `isSavedBriefing` keeps accepting old briefings. Missing fields normalise to `null`.
- `globe/regions.ts`: a development with a `place` contributes a **city point** at that position, labelled with the city name. Developments without one keep using region centres, as today. City and region points coexist on the same globe.
  - *(my call)* A development with a city appears **only** at its city point, not also at its region points, so a carousel never shows the same story twice across neighbouring points.
  - *(my call)* A development's single **anchor** for arcs is its city point, or else its first region's centre.
- **Region map fallback** (`components/RegionMap.tsx`). A small SVG crop of the globe's land dots (`landPoints.ts`) around a lat/lng, in celadon on paper, with the place or region name. It's used whenever a card has no image or the image fails to load (`onError`).

## 6. Globe zoom and story carousel (owner chose layout A, with a centred carousel)

**Zoom**
- On a briefing globe, clicking or activating a point:
  1. calls the existing `focusOn(lat, lng)`
  2. eases the camera in, by moving `CAMERA_Z` closer or narrowing the FOV, to a regional view (roughly 1,500–2,500 km across; the builder tunes it)
  3. pauses auto-spin
- Drag still rotates while zoomed. "← Back to world", Esc, or clicking empty ocean eases back out.
- With reduced motion, the zoom is an instant cut.
- The point stays highlighted while zoomed.

**Carousel**
- It opens under the globe in the Story tab's lead area (layout A) and lists that point's developments, newest first.
- It's a horizontal scroller with CSS scroll-snap that centres one card. The centred card is full size and colour. Its neighbours are scaled to about 0.9 and faded to about 40% opacity, so more cards are clearly there.
- Navigation: trackpad or touch swipe, the left and right arrow keys while the carousel has focus, ‹ › buttons and dots. Clicking a faded card centres it.
- It opens on the newest card and doesn't loop. With reduced motion, centring jumps instead of scrolling.
- **Card:**
  - the lead image, or the region map fallback
  - a credit line naming the image's outlet
  - priority mark and time
  - headline
  - city or region
  - source count
  - "Read in timeline →"
- Clicking the card or the link scrolls to `#dev-N` (the existing `onSelectStory`), focuses it and leaves the zoom on.
- **Accessibility:** the carousel is a labelled region ("Stories in Aden, 3"). Cards are a list, the dots are buttons with names, and the centred card is announced. The globe's existing visually-hidden point list gets a button per point that opens the same carousel, so keyboard and screen-reader users have full access.
- **Images** load lazily with `referrerpolicy="no-referrer"` and `decoding="async"`. *(my call: limits what publishers learn about readers)*

## 7. Top stories strip

- **Placement:** on the Story tab, between the alerts/globe row and "Key developments" (owner's choice).
- **Content:** up to 5 developments ranked by priority (high, then medium, then low) and then newest first. The strip is hidden when the briefing has fewer than 2 developments.
- **Cards:** the same component as the carousel cards, in a horizontal row that scrolls on narrow screens. No centre-fade here; all cards are full strength. *(my call)*
- Clicking a card scrolls to that development.

## 8. Routes replace threads (owner chose transit lines, with colour-match and explain-on-hover)

This replaces spec 2 §6.4's loose threads (`lib/threads.ts`, `.threads` SVG, `threadPath`).

- A **route** is a tension or contradiction linked to **two or more** developments (`linkBriefing`). Links with a single development stay as a tab only, as today.
- **Lanes:** up to 5, placed in the gutter between the time labels and the spine. Each route is a straight vertical line in its own lane, from its first stop to its last.
  - A **stop** is a ring at the row of each development on the route, with a short horizontal connector to the card's edge.
  - Lanes are assigned busiest route first (most stops). Routes beyond 5 stay as tabs only.
  - The time column narrows or the gutter widens as lanes are added. The builder sizes this, but the spine and cards must not shift between briefings by more than the lane width.
- **Colours** at rest, from brand tokens, in assignment order: ochre `--ochre`, ink `--ink`, celadon `--celadon`, sand `--sand`, deep celadon `--celadon-deep`. Tensions are **solid** and disagreements are **dashed**.
- **Tabs** (spec 2) gain a dot in their route's colour, and so do the **key** entries.
- **Key:** a single row above the timeline listing each route as a coloured ring, a kind label and a title ("TENSION · Shipping lines ↔ Houthis"). Activating an entry scrolls to the route's first stop and lights it.
- **Explain on hover:**
  - Hovering or focusing a route line, a stop, a key entry or a tab lights that route in royal blue at full width. The matching tabs on every card get a blue outline, and the other routes fade to about 30%.
  - A small note appears beside the lit stop nearest the pointer: "3 stories share this tension: Shipping lines ↔ Houthis ↔ Yemen. Open ›". "Open" expands that link on the nearest card.
  - Opened tabs keep their route lit, as threads did.
- **Scroll:** the spine progress fill and node `.on` states are unchanged. Route segments draw downward as the reading line passes each stop. Already-passed segments appear drawn.
- **Phone** (single-column breakpoint): lanes and key are hidden, and the colour-dotted tabs carry the links.
- **Print:** lanes are hidden, and the key prints as a plain list.
- Routes are `aria-hidden`. The key entries and tabs are the accessible controls.

## 9. Globe arcs (owner confirmed)

- Each route also draws on the **briefing globe** as great-circle arcs in its colour, joining its developments' points (city point if present, otherwise the region centre) in timeline order.
- Arcs lift slightly above the surface and fade at the globe's limb.
- Hovering or lighting a route (timeline, key, tab or arc) lights it everywhere: the arc turns royal blue and the other arcs fade. Hovering an arc on the globe lights the route on the timeline too.
- Segments where both ends are the same point are skipped.
- Arcs appear on briefing globes only, and stay visible while zoomed.
- `StaticGlobe` (the no-WebGL fallback) shows no arcs.

## 10. Constraints

- Keep spec 2's rules: celadon tokens, `--celadon-deep` for text, the spacing scale, `prefers-reduced-motion` equivalents, real buttons and links, and no `window.confirm`.
- No new runtime dependencies in the frontend. The globe stays custom three.js.
- Backend: no new Python dependencies. The CSV is read with the stdlib `csv` module.
- The response stays backward compatible: every new field is optional.
- Existing tests keep passing. Thread tests are replaced by route tests, not deleted silently.
- Performance: the carousel and strip images lazy-load. The globe arcs are a few extra line objects and add no per-frame allocations.

## 11. Left to the builder

- Zoom distance and easing curve, the arc height, and the exact lane width and gutter sizing.
- How the hover note is positioned. It must not cover the card it refers to.
- The `RegionMap` crop radius and dot density.
- The exact alt names kept in the city CSV.

## 12. Done when

- A fresh live briefing returns `image_url` on some citations and `place` on some developments, and older saved briefings still render.
- Clicking a point on a briefing globe zooms in and opens the centred carousel. Esc, Back and ocean clicks zoom out. It works by keyboard via the hidden point list.
- The top-stories strip shows between the alerts row and the timeline.
- Routes, key, colour dots and hover notes replace threads. Spine fill is unchanged. Arcs on the globe match route colours and light together.
- A city story (for example Aden) shows a labelled city point instead of only the Yemen centre.
- No broken images anywhere. Missing ones show the region map.
- `pytest backend/tests`, `npm run build`, `npm run lint` and `npx vitest run` pass. A manual pass at 1470 × 956 and 390 × 844 shows no regressions.
