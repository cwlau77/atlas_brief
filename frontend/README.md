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
