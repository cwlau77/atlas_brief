# Atlas — frontend

Vite + React + TypeScript SPA. Design system: **Oat**, a warm paper surface
(oat, oat-deep, paper) with ink text and celadon as the primary colour (logo,
primary buttons, links, timeline, data), with royal blue reserved for
signals — globe hotspots, high-priority alerts, focus rings, the active tab,
highlighted story threads and the logo dot. `--celadon` (#5E8A79) is for
graphics only; text, links and button fills use `--celadon-deep` (#3A5F52)
for contrast. Spacing uses the `--space-1`…`--space-9` scale. Type is Jost for headings, Hanken Grotesk for body text, and IBM Plex
Mono for labels and data, all loaded from Google Fonts. Light-only; print
styles force ink-on-paper.

## Dev

```bash
npm run dev        # proxies /api/* to http://127.0.0.1:8000 (local backend)
npm run dev:live   # proxies /api/* to the live Render backend
```

## Tests

```bash
npx vitest run
```

Tests load CSS (`test.css: true` in `vite.config.ts`) so `palette.test.ts`
can check stylesheets for stray colours.

## Globe land data

`src/globe/landPoints.ts` is generated from `world-atlas` by
`npm run build:land`. Re-run it only after upgrading `world-atlas`, and
commit the regenerated file.

## Bot check (Cloudflare Turnstile)

Set `VITE_TURNSTILE_SITE_KEY` (public) in Vercel's environment and redeploy. The
app then gets a Turnstile token before each `POST /api/briefing` and sends it as
`X-Turnstile-Token`; the backend checks it once `TURNSTILE_SECRET_KEY` is set on
Render. Without the site key nothing loads from Cloudflare. For local testing,
Cloudflare's always-pass test site key is `1x00000000000000000000AA`.

## Architecture notes

- `src/styles/tokens.css` is the single source of truth for color, type and
  motion tokens (the oat/terracotta/moss palette, font stacks, spacing).
- Pages live in `src/routes/`: `HomePage` (ask form, rotating headline,
  intro), the Briefing view's `StoryTab` and `SignalsTab`, `ArchivePage` and
  `SettingsPage`. Routing is plain `react-router` (no data router), with
  scroll and focus handled by `lib/useRouteFocus.ts`.
- `src/globe/` is a custom three.js globe, not globe.gl: `engine.ts` owns the
  THREE.WebGLRenderer, shaders and animation loop; `controls.ts` handles
  pointer drag and momentum; `GlobeView.tsx` is the lazy-loaded React wrapper
  that reads hotspot screen positions each frame and renders the hotspot
  panel and a visually-hidden list for screen readers. `StaticGlobe.tsx` is
  the no-WebGL fallback. Hotspot selection scrolls to `#dev-N` anchors
  rendered by `components/briefing/Timeline.tsx` / `DevelopmentCard.tsx`.
- Briefing globes (not Home) zoom: clicking a point calls `engine.zoomTo`
  (which also lifts the point above centre) and `StoryTab` floats
  `StoryCarousel` over the bottom of the zoomed map with that point's stories
  (newest first, one centred compact card). It slides up on open and down on
  close; Back, Esc or an ocean click zooms out. The page never scrolls, so
  the zoom stays in view.
  Points come from `globe/regions.ts`: a development with a named `place`
  (resolved server-side from GeoNames) sits only at its city point.
- `StoryCard` is shared by the carousel and the Top stories strip
  (`TopStories`, ranked by `lib/topStories.ts`). A missing or failed lead
  image falls back to a grainy brand-palette gradient (`.story-card-grain`).
- Routes (`lib/routes.ts`) are tensions or source disagreements linked to two
  or more developments. Up to five get a lane in the timeline gutter (fixed
  width, so the spine never moves), a key entry, a colour dot on their tabs
  and a globe arc (`globe/arcs.ts`). `state/useRouteHighlight.ts`, owned by
  `StoryTab`, lights a route everywhere at once.
- `src/state/` holds shared app state: `AppState.tsx` is the provider
  (saved briefings, starred ids, session briefing, settings, profile,
  toasts, all persisted to `localStorage`/`sessionStorage` with functional
  state updates so overlapping writes never read stale state); `hooks.ts`
  exposes `useAppState`/`useSettings`; `settings.ts` parses and defaults
  user settings, including the time-zone setting (`"auto"` or an IANA zone)
  used to format every timestamp in the app.
- All motion respects `prefers-reduced-motion`: no intro, no rotating
  headline or typewriter prompts, no globe auto-spin or liquid cursor
  response, instant transitions instead of eased ones.
