# Atlas Brief — frontend

Vite + React + TypeScript SPA. Design system: **Midnight Signal** — near-black
layered surfaces, one chartreuse accent (`--signal`), Instrument Serif display
over Geist body with Geist Mono data. Dark-only; print styles force ink-on-paper.

## Dev

```bash
npm run dev        # proxies /api/* to http://127.0.0.1:8000 (local backend)
npm run dev:live   # proxies /api/* to the live Render backend
```

## Tests

```bash
npx vitest run
```

**Path caveat:** vitest cannot spawn workers from a directory whose path
contains a space (`… /Atlas Brief/ …`). Run it through a space-free symlink:

```bash
ln -sfn "$(cd .. && pwd)" /tmp/atlasbrief && cd /tmp/atlasbrief/frontend && npx vitest run
```

## Architecture notes

- `src/styles/tokens.css` is the single source of truth for color/type/motion.
- `.panel.spot` cards get a cursor-tracked spotlight via `lib/useSpotlight.ts`.
- The globe (`GlobeCanvas`) is lazy-loaded; hotspot markers are imperative DOM
  positioned by globe.gl, and their dropdowns scroll to `#dev-N` anchors in
  `KeyDevelopments`.
- Do not wrap the hero mode switch in `AnimatePresence mode="wait"` — exit
  waiting deadlocks when the leaving subtree contains the Suspense globe.
- All motion respects `prefers-reduced-motion` (global kill switch in base.css).
