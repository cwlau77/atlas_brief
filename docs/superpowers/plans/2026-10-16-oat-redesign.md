# Oat Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark "Midnight Signal" UI with the light "Oat" design: a multi-page app (Home, Briefing with Story/Signals tabs, Archive, Settings), a custom liquid-grain three.js globe with interactive region hotspots, a scroll-drawn storytelling timeline, refined analytics, a time-zone setting, and a coordinate-lens cursor.

**Architecture:** React Router (declarative `BrowserRouter`) splits the app into pages; one `AppStateProvider` owns saved briefings, the session briefing, settings and toasts. Pure, unit-tested modules hold all logic that can be wrong quietly (time formatting, settings parsing, briefing lookup, region mapping, branch linking, signals summary). The globe is an imperative `GlobeEngine` class (three.js only) wrapped by a lazily loaded `GlobeView` React component.

**Tech Stack:** Vite 8, React 19, TypeScript ~6.0 (`verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`), react-router 7, three 0.185, vitest 4 (jsdom), oxlint.

**Spec:** `docs/superpowers/specs/2026-10-16-oat-redesign-design.md`

## Global Constraints

- Work on branch `redesign/oat`. Commit at the end of every task; every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- localStorage keys stay exactly `savedBriefingsV2`, `starredBriefings`, `userProfileV1`, `userSettingsV1`; the `SavedBriefing` shape in `src/lib/normalize.ts` does not change.
- Palette hex values are exactly: oat `#EEE8DC`, oat-deep `#E4DCCB`, paper `#F8F4EB`, ink `#1C231F`, ink-2 `#48524B`, ink-3 `#646A60`, rule `#D6CDBA`, rule-soft `#E2DACA`, moss `#3D5A45`, sage `#9AAA92`, sand `#C7B89C`, terra `#B5532E`, terra-ink `#93421F`, ochre `#9C7026`.
- Fonts are only Hanken Grotesk (300–800), Fraunces (italic, `SOFT` 100), IBM Plex Mono (400, 500), loaded from Google Fonts.
- Severity is always shape plus text: ▲ high (terra), ■ medium (ochre), ○ low (ink-3). Never color alone.
- Under `prefers-reduced-motion: reduce`: no intro, no rotating words or typewriter, no liquid globe response, no auto-spin, native cursor, instant transitions.
- Bundle targets: entry JS for `/` ≤ 110 KB gzip; globe chunk 150–200 KB gzip (down from ~580 KB).
- TypeScript: use `import type` for type-only imports; no enums, no constructor parameter properties (`erasableSyntaxOnly`).
- Lint: `npm run lint` must report no new warnings. Files that export a React component export only components (plus types and constants).
- UI copy: plain, active voice, no em-dash asides.

**Environment notes (read before Task 1):**
- The repo lives in an iCloud-synced folder. Before any Node command, confirm files are local: `ls -lO frontend/node_modules/typescript/lib/typescript.js` must not show `dataless`, and `df -h /System/Volumes/Data` should show at least 15 GB free. If files are dataless, run `brctl download "<repo path>"` and wait, or reinstall with `rm -rf node_modules && npm ci`.
- vitest cannot start from a path containing a space. Run tests through a symlink:
  ```bash
  ln -sfn "/Users/camlau/Desktop/cs/personal/Atlas Brief" /tmp/atlasbrief
  cd /tmp/atlasbrief/frontend && npx vitest run
  ```
  Every "Run tests" step below assumes `cd /tmp/atlasbrief/frontend`. Build and lint run from the real path: `cd "/Users/camlau/Desktop/cs/personal/Atlas Brief/frontend"`.

## Review Focus

1. **A briefing whose region names resolve to no coordinates** (all free-text regions unknown to `centroids.ts`): the Story tab must render, the globe shows no hotspots, the camera does not try to focus anything, and screen readers hear "No mapped regions in this briefing". Pinned by `regions.test.ts` ("returns no points when no region resolves") in Task 6.
2. **Developments with a missing or unparseable timestamp:** they sort after timed ones in original order and show "Time unknown", never "Invalid Date". Pinned by `time.test.ts` (Task 2) and `timeline.test.ts` (Task 8).
3. **Old or corrupted browser storage** (settings saved before `timeZone` existed, wrong types, invalid zone names, a corrupted session briefing): the app loads with sensible defaults instead of crashing. Pinned by `settings.test.ts` and `resolveBriefing.test.ts` (Task 3).
4. **Region names containing regex characters, diacritics, or that appear inside other words** ("U.S.", "Côte d'Ivoire", "Iran" inside "Tirana"): branch matching neither throws nor links falsely. Pinned by `timeline.test.ts` (Task 8).
5. **Signals for a briefing with empty or all-zero breakdowns:** the summary sentence and each chart show a clear empty state instead of `NaN%` or a blank. Pinned by `signals.test.ts` (Task 10).

---

## File Structure

```
frontend/
  index.html                       (modify: fonts, theme color, title)
  package.json                     (modify: add react-router; remove react-globe.gl, chart.js, framer-motion; build:land script)
  scripts/build-land-points.mjs    (create: generates src/globe/landPoints.ts)
  src/
    main.tsx                       (modify: BrowserRouter)
    App.tsx                        (rewrite: shell + routes)
    app.css                        (rewrite: shell, page scaffolding)
    styles/tokens.css              (rewrite: Oat tokens, temporary legacy aliases)
    styles/base.css                (rewrite: light base, grain, print)
    state/
      context.ts                   (create: AppStateValue type + context)
      AppState.tsx                 (create: provider)
      hooks.ts                     (create: useAppState, useSettings)
      settings.ts (+ .test.ts)     (create: UserSettings/UserProfile parsing)
      resolveBriefing.ts (+ .test) (create: findBriefing, latestBriefingId, isSavedBriefing)
      useGenerateBriefing.ts       (create: API call → session → navigate)
    test/fixtures.ts               (create: shared ApiBriefing/SavedBriefing fixtures)
    lib/
      time.ts (+ .test.ts)         (create: zone-aware formatting)
      timeline.ts (+ .test.ts)     (create: sortDevelopments, mentionsRegion, linkBriefing)
      signals.ts (+ .test.ts)      (create: shares, topEntries, summarizeSignals)
      intro.ts (+ .test.ts)        (create: once-per-session intro flag)
      useClock.ts                  (create)
      useMediaQuery.ts             (create: useMediaQuery, usePrefersReducedMotion)
      useRouteFocus.ts             (create: focus + scroll restoration on navigation)
      usePrintOnLoad.ts            (create: ?print=1 handling)
      useTypewriter.ts             (create)
    globe/
      landPoints.ts                (generated)
      regions.ts (+ .test.ts)      (create: toVec3, decodeLandPoints, buildRegionPoints, topRegion)
      engine.ts                    (create: GlobeEngine)
      controls.ts                  (create: drag rotation)
      GlobeView.tsx                (create: lazy React wrapper, hotspots, panels)
      Globe.tsx                    (create: lazy loader + fallback)
      StaticGlobe.tsx              (create: no-WebGL fallback)
      globe.css                    (create)
    routes/
      HomePage.tsx, home.css
      BriefingLayout.tsx, briefing-layout.css, briefingContext.ts
      StoryTab.tsx, SignalsTab.tsx, signals.css
      ArchivePage.tsx, archive.css
      SettingsPage.tsx, settings.css
      UnsavedBriefing.tsx, NotFound.tsx
    components/
      NavBar.tsx, navbar.css       (rewrite)
      AskForm.tsx, askform.css     (create; replaces BriefingForm)
      RotatingHeadline.tsx         (create)
      Contours.tsx                 (create)
      TimeZonePicker.tsx, timezone.css (create)
      CursorLens.tsx, cursor.css, cursorBus.ts (create)
      Toast.tsx, toast.css         (rewrite: CSS-only)
      briefing/
        Timeline.tsx, DevelopmentCard.tsx, LinkedCards.tsx, AlertCallout.tsx,
        PriorityMark.tsx, ReadingList.tsx, SourceChips.tsx, story.css
  Deleted over the plan: AmbientBackdrop, ambient.css, StandByClock(+css), GlobeHero, GlobeCanvas,
  globehero.css, AnalyticsPanel, analytics.css, BriefingView, analyticsChunk.ts, BriefingForm,
  briefingform.css, ProfilePage, profile.css, SavedPage, saved.css, KeyDevelopments, Tensions,
  Contradictions, PriorityAlerts, briefing.css, Reveal, useSpotlight.
```

---

### Task 1: Visual foundation (tokens, fonts, light base)

**Files:**
- Modify: `frontend/index.html`
- Rewrite: `frontend/src/styles/tokens.css`, `frontend/src/styles/base.css`
- Modify: `frontend/src/App.tsx` (remove `AmbientBackdrop`)
- Modify: `frontend/src/components/GlobeCanvas.tsx:26-28` (temporary light colors)
- Delete: `frontend/src/components/AmbientBackdrop.tsx`, `frontend/src/components/ambient.css`

**Interfaces:**
- Produces: CSS custom properties listed in Global Constraints as `--oat … --ochre`, plus `--terra-wash`, `--font-sans`, `--font-serif`, `--font-mono`, `--serif-vars`, `--radius`, `--radius-sm`, `--shadow-lift`, `--ease-out`, `--dur-quick`, `--dur-mid`, `--dur-enter`, `--gutter`, `--maxw`. Utility classes `.wrap`, `.serif`, `.mono`, `.label`, `.visually-hidden`, `.btn`, `.btn-primary`, `.btn-quiet`. Legacy aliases (`--signal`, `--bg-0`, `--text-hi`, …) exist only until Task 14.

This task has no unit test; it is verified by build, existing tests, and a visual check.

- [ ] **Step 1: Replace fonts and head metadata in `index.html`**

Replace the whole `<head>` contents with:

```html
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/compass.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Atlas Brief turns global news into a briefing: what changed, where it happened, and what to read next." />
    <meta name="theme-color" content="#EEE8DC" />
    <title>Atlas Brief</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@300..800&family=Fraunces:ital,opsz,wght,SOFT@0,9..144,300..700,0..100;1,9..144,300..700,0..100&family=IBM+Plex+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
```

- [ ] **Step 2: Rewrite `src/styles/tokens.css`**

```css
/* Atlas Brief design tokens: "Oat". Light only. */
:root {
  color-scheme: light;

  --oat: #EEE8DC;
  --oat-deep: #E4DCCB;
  --paper: #F8F4EB;
  --ink: #1C231F;
  --ink-2: #48524B;
  --ink-3: #646A60;
  --rule: #D6CDBA;
  --rule-soft: #E2DACA;
  --moss: #3D5A45;
  --sage: #9AAA92;
  --sand: #C7B89C;
  --terra: #B5532E;
  --terra-ink: #93421F;
  --terra-wash: rgba(181, 83, 46, 0.10);
  --ochre: #9C7026;

  --font-sans: 'Hanken Grotesk', 'Helvetica Neue', Arial, sans-serif;
  --font-serif: 'Fraunces', Georgia, 'Times New Roman', serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, Menlo, monospace;
  --serif-vars: 'SOFT' 100, 'opsz' 120;

  --radius: 14px;
  --radius-sm: 10px;
  --shadow-lift: 0 20px 40px -30px rgba(60, 50, 30, 0.45);

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-quick: 150ms;
  --dur-mid: 300ms;
  --dur-enter: 900ms;

  --gutter: clamp(16px, 4vw, 56px);
  --maxw: 1240px;

  /* Legacy aliases so not-yet-migrated components stay readable. Task 14 deletes this block. */
  --bg-0: var(--oat);
  --bg-1: var(--paper);
  --bg-2: var(--oat-deep);
  --surface: rgba(28, 35, 31, 0.03);
  --border: var(--rule-soft);
  --border-hi: var(--rule);
  --text-hi: var(--ink);
  --text-mid: var(--ink-2);
  --text-low: var(--ink-3);
  --signal: var(--terra);
  --signal-dim: var(--terra-ink);
  --signal-glow: var(--terra-wash);
  --signal-ink: #FBF6EE;
  --haze: var(--sage);
  --haze-glow: rgba(154, 170, 146, 0.15);
  --alert-critical: var(--terra);
  --alert-high: var(--ochre);
  --alert-elevated: var(--moss);
  --grid-line: transparent;
  --grid-line-hi: transparent;
  --glass-bg: var(--paper);
  --glass-border: var(--rule);
  --font-display: var(--font-sans);
  --font-body: var(--font-sans);
  --shadow-card: none;
  --shadow-float: var(--shadow-lift);
  --glow-signal: none;
  --ease-expo: var(--ease-out);
  --dur-reveal: 500ms;
}
```

- [ ] **Step 3: Rewrite `src/styles/base.css`**

```css
/* Atlas Brief base: reset, type, shared primitives, print. */
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  color-scheme: light;
  background: var(--oat);
  scroll-behavior: smooth;
}

body {
  background: var(--oat);
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  overflow-x: hidden;
}

/* Paper grain: one static turbulence tile multiplied over the page. */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 90;
  pointer-events: none;
  opacity: 0.32;
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.24 0 0 0 0 0.22 0 0 0 0 0.17 0 0 0 0.55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 220px 220px;
}

h1, h2, h3, h4 {
  font-family: var(--font-sans);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.15;
  color: var(--ink);
  text-wrap: balance;
}

a {
  color: inherit;
  text-underline-offset: 3px;
  text-decoration-color: var(--sand);
}
a:hover { text-decoration-color: var(--terra); }

button { font: inherit; color: inherit; cursor: pointer; }
input, select, textarea { font: inherit; color: inherit; }

:focus-visible {
  outline: 2px solid var(--terra);
  outline-offset: 3px;
  border-radius: 4px;
}

::selection { background: rgba(181, 83, 46, 0.22); color: var(--ink); }

.wrap {
  width: 100%;
  max-width: var(--maxw);
  margin-inline: auto;
  padding-inline: var(--gutter);
}

.serif {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 380;
  font-variation-settings: var(--serif-vars);
}

.mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

/* Small uppercase mono label: eyebrows, tags, timestamps. */
.label {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  padding: 12px 20px;
  border-radius: 999px;
  border: 1px solid transparent;
  text-decoration: none;
  transition: background-color var(--dur-quick) var(--ease-out), color var(--dur-quick) var(--ease-out),
    border-color var(--dur-quick) var(--ease-out), transform var(--dur-quick) var(--ease-out);
}
.btn:active { transform: scale(0.97); }
.btn-primary { background: var(--terra); color: #FBF6EE; }
.btn-primary:hover { background: var(--terra-ink); }
.btn-primary:disabled { background: var(--oat-deep); color: var(--ink-3); cursor: not-allowed; }
.btn-quiet { background: transparent; color: var(--ink-2); border-color: var(--rule); }
.btn-quiet:hover { border-color: var(--moss); color: var(--ink); }
.btn-quiet:disabled { opacity: 0.5; cursor: not-allowed; }

/* Legacy primitives used by not-yet-migrated components. Task 14 deletes them. */
.panel { position: relative; background: var(--paper); border: 1px solid var(--rule-soft); border-radius: var(--radius); }
.panel.spot::before { display: none; }
.glass { background: var(--paper); border: 1px solid var(--rule); border-radius: var(--radius); }
.signal-label {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--terra-ink);
  display: flex;
  gap: 0.7rem;
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

@media print {
  html, body { background: #fff; color: #000; }
  body::after { display: none; }
  .nav, .footer, .ask, .tabs, .story-globe, .globe-view, .cur, .toast-host, .skip-link, .chips { display: none !important; }
  .dev, .link-card, .alert { break-inside: avoid; box-shadow: none !important; border: 1px solid #ccc; }
  a { color: #000; }
}
```

- [ ] **Step 4: Remove the ambient backdrop**

In `src/App.tsx`, delete the line `import { AmbientBackdrop } from './components/AmbientBackdrop'` and the JSX line `<AmbientBackdrop ring={!docked} />`. Then:

```bash
git rm src/components/AmbientBackdrop.tsx src/components/ambient.css
```

- [ ] **Step 5: Give the old globe temporary light colors**

In `src/components/GlobeCanvas.tsx`, replace the three color constants with:

```ts
const LAND_COLOR = 'rgba(61, 90, 69, 0.6)'
const SEA_COLOR = '#E4DCCB'
const ATMOSPHERE = '#B5532E'
```

(This file is deleted in Task 7; this only keeps the app presentable until then.)

- [ ] **Step 6: Verify build, lint and existing tests**

Run (real path): `npm run build && npm run lint`
Expected: build succeeds; no new lint warnings.
Run tests (symlink path): `npx vitest run`
Expected: 18 tests pass.
Run `npm run dev`, open the printed URL: the page is oat-colored with Hanken Grotesk text and no grid backdrop.

- [ ] **Step 7: Commit**

```bash
git add -A frontend/index.html frontend/src
git commit -m "feat(ui): Oat tokens, fonts and light base styles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Time-zone formatting (`lib/time.ts`)

**Files:**
- Create: `frontend/src/lib/time.ts`
- Test: `frontend/src/lib/time.test.ts`

**Interfaces:**
- Produces:
  - `AUTO_ZONE: 'auto'`, `UNKNOWN_TIME: 'Time unknown'`
  - `deviceTimeZone(): string`
  - `isValidTimeZone(tz: string): boolean`
  - `resolveTimeZone(tz: string | null | undefined): string` (`'auto'`, empty or invalid → device zone)
  - `formatTime(value: string | Date | null | undefined, tz: string): string` → `"14:32 EDT"` or `UNKNOWN_TIME`
  - `formatDate(value, tz): string` → `"16 Oct 2026"` or `"Date unknown"`
  - `formatDateTime(value, tz): string` → `"16 Oct 2026, 14:32 EDT"` or `UNKNOWN_TIME`
  - `formatClock(now: Date, tz: string): { day: string; time: string }` → `{ day: 'Friday 16 Oct 2026', time: '18:32 UTC' }`
  - `zoneLabel(tz: string, now?: Date): string` → `"New York · UTC-04:00"`
  - `listTimeZones(): string[]` (always contains `'UTC'`)

- [ ] **Step 1: Write the failing tests** in `src/lib/time.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import {
  AUTO_ZONE, UNKNOWN_TIME, deviceTimeZone, formatClock, formatDate, formatDateTime, formatTime,
  isValidTimeZone, listTimeZones, resolveTimeZone, zoneLabel,
} from './time'

const AUTUMN = '2026-10-16T18:32:00Z'
const WINTER = '2026-01-15T18:32:00Z'

describe('formatTime', () => {
  it('formats Eastern daylight time', () => {
    expect(formatTime(AUTUMN, 'America/New_York')).toBe('14:32 EDT')
  })
  it('switches to Eastern standard time in winter', () => {
    expect(formatTime(WINTER, 'America/New_York')).toBe('13:32 EST')
  })
  it('formats UTC', () => {
    expect(formatTime(AUTUMN, 'UTC')).toBe('18:32 UTC')
  })
  it('shows midnight as 00, not 24', () => {
    expect(formatTime('2026-10-16T04:00:00Z', 'America/New_York')).toBe('00:00 EDT')
  })
  it('accepts Date objects', () => {
    expect(formatTime(new Date(AUTUMN), 'UTC')).toBe('18:32 UTC')
  })
  it('falls back to the device zone for an invalid zone', () => {
    expect(formatTime(AUTUMN, 'Mars/Olympus_Mons')).toBe(formatTime(AUTUMN, deviceTimeZone()))
  })
  it('treats auto as the device zone', () => {
    expect(formatTime(AUTUMN, AUTO_ZONE)).toBe(formatTime(AUTUMN, deviceTimeZone()))
  })
  it('returns a readable label for missing or unparseable timestamps', () => {
    expect(formatTime(null, 'UTC')).toBe(UNKNOWN_TIME)
    expect(formatTime('', 'UTC')).toBe(UNKNOWN_TIME)
    expect(formatTime('not a date', 'UTC')).toBe(UNKNOWN_TIME)
  })
})

describe('formatDate and formatDateTime', () => {
  it('formats the calendar date in the zone', () => {
    expect(formatDate(AUTUMN, 'UTC')).toBe('16 Oct 2026')
    expect(formatDate(null, 'UTC')).toBe('Date unknown')
  })
  it('joins date and time', () => {
    expect(formatDateTime(AUTUMN, 'America/New_York')).toBe('16 Oct 2026, 14:32 EDT')
  })
  it('uses the zone date when UTC has already rolled over', () => {
    expect(formatDateTime('2026-10-17T02:00:00Z', 'America/New_York')).toBe('16 Oct 2026, 22:00 EDT')
  })
  it('returns the unknown label for bad input', () => {
    expect(formatDateTime('garbage', 'UTC')).toBe(UNKNOWN_TIME)
  })
})

describe('formatClock', () => {
  it('returns weekday date and time', () => {
    expect(formatClock(new Date(AUTUMN), 'UTC')).toEqual({ day: 'Friday 16 Oct 2026', time: '18:32 UTC' })
  })
})

describe('zoneLabel', () => {
  it('labels a city zone with its offset', () => {
    expect(zoneLabel('America/New_York', new Date(WINTER))).toBe('New York · UTC-05:00')
  })
  it('handles half-hour offsets', () => {
    expect(zoneLabel('Asia/Kolkata', new Date(AUTUMN))).toBe('Kolkata · UTC+05:30')
  })
  it('names UTC in words', () => {
    expect(zoneLabel('UTC', new Date(AUTUMN))).toBe('Coordinated Universal Time · UTC+00:00')
  })
})

describe('zone validation', () => {
  it('accepts real zones and rejects others', () => {
    expect(isValidTimeZone('Europe/London')).toBe(true)
    expect(isValidTimeZone('')).toBe(false)
    expect(isValidTimeZone('Not/AZone')).toBe(false)
  })
  it('resolves auto, empty and invalid zones to the device zone', () => {
    expect(resolveTimeZone('Europe/London')).toBe('Europe/London')
    expect(resolveTimeZone(AUTO_ZONE)).toBe(deviceTimeZone())
    expect(resolveTimeZone(undefined)).toBe(deviceTimeZone())
    expect(resolveTimeZone('Not/AZone')).toBe(deviceTimeZone())
  })
  it('lists zones including UTC', () => {
    const zones = listTimeZones()
    expect(zones).toContain('UTC')
    expect(zones).toContain('America/New_York')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/time.test.ts`
Expected: FAIL, "Failed to resolve import ./time".

- [ ] **Step 3: Write `src/lib/time.ts`**

```ts
// Zone-aware formatting. Every clock time the app displays goes through here,
// so the Settings time zone applies everywhere at once.

export const AUTO_ZONE = 'auto'
export const UNKNOWN_TIME = 'Time unknown'

const FALLBACK_ZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Africa/Cairo',
  'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Shanghai',
  'Asia/Tokyo', 'Australia/Sydney',
]

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function resolveTimeZone(tz: string | null | undefined): string {
  return tz && tz !== AUTO_ZONE && isValidTimeZone(tz) ? tz : deviceTimeZone()
}

const cache = new Map<string, Intl.DateTimeFormat>()

function formatter(tz: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${tz}|${JSON.stringify(opts)}`
  let f = cache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz })
    cache.set(key, f)
  }
  return f
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function parts(d: Date, tz: string, opts: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of formatter(tz, opts).formatToParts(d)) out[p.type] = p.value
  return out
}

const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }
const DATE_OPTS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
const DAY_OPTS: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }

export function formatTime(value: string | Date | null | undefined, tz: string): string {
  const d = toDate(value)
  if (!d) return UNKNOWN_TIME
  const p = parts(d, resolveTimeZone(tz), TIME_OPTS)
  return `${p.hour}:${p.minute} ${p.timeZoneName}`
}

export function formatDate(value: string | Date | null | undefined, tz: string): string {
  const d = toDate(value)
  if (!d) return 'Date unknown'
  const p = parts(d, resolveTimeZone(tz), DATE_OPTS)
  return `${p.day} ${p.month} ${p.year}`
}

export function formatDateTime(value: string | Date | null | undefined, tz: string): string {
  const d = toDate(value)
  if (!d) return UNKNOWN_TIME
  return `${formatDate(d, tz)}, ${formatTime(d, tz)}`
}

export function formatClock(now: Date, tz: string): { day: string; time: string } {
  const p = parts(now, resolveTimeZone(tz), DAY_OPTS)
  return { day: `${p.weekday} ${p.day} ${p.month} ${p.year}`, time: formatTime(now, tz) }
}

export function zoneLabel(tz: string, now: Date = new Date()): string {
  const zone = resolveTimeZone(tz)
  const raw = parts(now, zone, { timeZoneName: 'longOffset' }).timeZoneName ?? 'GMT'
  const offset = raw === 'GMT' ? 'UTC+00:00' : raw.replace('GMT', 'UTC')
  const city = zone === 'UTC' ? 'Coordinated Universal Time' : (zone.split('/').pop() ?? zone).replace(/_/g, ' ')
  return `${city} · ${offset}`
}

export function listTimeZones(): string[] {
  let zones = FALLBACK_ZONES
  try {
    const fn = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf
    if (fn) zones = fn('timeZone')
  } catch {
    // older engines: keep the short fallback list
  }
  return zones.includes('UTC') ? zones : ['UTC', ...zones]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/time.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/time.ts frontend/src/lib/time.test.ts
git commit -m "feat(time): zone-aware time formatting helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Settings parsing, briefing lookup, shared fixtures

**Files:**
- Create: `frontend/src/state/settings.ts`, `frontend/src/state/resolveBriefing.ts`, `frontend/src/test/fixtures.ts`
- Test: `frontend/src/state/settings.test.ts`, `frontend/src/state/resolveBriefing.test.ts`

**Interfaces:**
- Consumes: `AUTO_ZONE`, `isValidTimeZone` from `src/lib/time.ts`; `normalizeBriefing`, `SavedBriefing` from `src/lib/normalize.ts`.
- Produces:
  - `interface UserSettings { timeZone: string; autoSave: boolean; showHistoricalContext: boolean; compactMode: boolean }` (`timeZone` is `'auto'` or an IANA name)
  - `DEFAULT_SETTINGS: UserSettings`, `parseSettings(raw: unknown): UserSettings`
  - `interface UserProfile { firstName: string; lastName: string; emailAddress: string; fieldOfStudy: string }`
  - `EMPTY_PROFILE: UserProfile`, `parseProfile(raw: unknown): UserProfile`
  - `findBriefing(id: string | undefined, session: SavedBriefing | null, saved: SavedBriefing[]): SavedBriefing | null`
  - `latestBriefingId(session: SavedBriefing | null, saved: SavedBriefing[]): string | null`
  - `isSavedBriefing(value: unknown): value is SavedBriefing`
  - Test helpers: `API_FIXTURE: ApiBriefing`, `makeBriefing(overrides?: Partial<SavedBriefing>): SavedBriefing` (id `'b-1'`)

- [ ] **Step 1: Create the shared fixture** `src/test/fixtures.ts`

```ts
// Shared test data: a small Red Sea briefing that exercises regions, links,
// untimed sources and an unmatched tension.
import { normalizeBriefing, type SavedBriefing } from '../lib/normalize'
import type { ApiBriefing } from '../lib/types'

export const API_FIXTURE: ApiBriefing = {
  focus: 'red sea shipping',
  generated_at: '2026-10-16T14:32:00Z',
  key_developments: [
    {
      headline: 'Drone strike damages tanker near Bab el-Mandeb',
      summary: 'A tanker reported a fire after a drone hit its port side.',
      regions: ['Yemen', 'Red Sea'],
      sources: [
        { outlet: 'Reuters', url: 'https://r.eu/1', published_at: '2026-10-16T02:10:00Z' },
        { outlet: "Lloyd's List", url: 'https://ll.com/2', published_at: '2026-10-16T02:40:00Z' },
      ],
      historical_context: 'First confirmed hit since June.',
    },
    {
      headline: 'Carriers extend Cape of Good Hope routing',
      summary: 'Two carriers extend routing around Africa through the first quarter.',
      regions: ['Red Sea', 'South Africa'],
      sources: [{ outlet: 'Financial Times', url: 'https://ft.com/3', published_at: '2026-10-16T05:45:00Z' }],
      historical_context: null,
    },
    {
      headline: 'Suez Canal revenue falls 41%',
      summary: 'Monthly figures show transits down sharply.',
      regions: ['Egypt'],
      sources: [{ outlet: 'Ahram Online', url: 'https://ahram.eg/4', published_at: null }],
      historical_context: null,
    },
  ],
  emerging_tensions: [
    { description: 'Escort rules are under review after the strike off Yemen.', actors: ['Houthi forces', 'EU-US coalition'], sources: [] },
    { description: 'Cairo presses carriers to return with toll discounts.', actors: ['Egypt', 'Container lines'], sources: [] },
    { description: 'Grain exporters weigh insurance costs.', actors: ['Ukraine', 'Insurers'], sources: [] },
  ],
  contradictions: [
    { topic: 'Tanker damage off Yemen', account_a: 'Minor damage.', account_b: 'Hull breach.', sources_a: [], sources_b: [] },
  ],
  priority_alerts: [
    { severity: 'critical', headline: 'Strike ends four-month lull', rationale: 'Shipping risk rises.', sources: [] },
  ],
  recommended_readings: [
    { title: 'Why the Cape route costs more', outlet: 'The Economist', url: 'https://econ.com/5', why: 'Explains the cost math.' },
  ],
  article_count: 214,
  source_breakdown: { newsapi: 98, gdelt: 66, rss: 50 },
}

export function makeBriefing(overrides: Partial<SavedBriefing> = {}): SavedBriefing {
  return { ...normalizeBriefing(API_FIXTURE, 'daily'), id: 'b-1', ...overrides }
}
```

- [ ] **Step 2: Write the failing tests** `src/state/settings.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, EMPTY_PROFILE, parseProfile, parseSettings } from './settings'

describe('parseSettings', () => {
  it('returns defaults for missing data', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings([])).toEqual(DEFAULT_SETTINGS)
  })
  it('defaults to following the device time zone', () => {
    expect(DEFAULT_SETTINGS.timeZone).toBe('auto')
  })
  it('keeps legacy settings saved before timeZone existed', () => {
    expect(parseSettings({ compactMode: true, autoSave: false, showHistoricalContext: false })).toEqual({
      timeZone: 'auto', compactMode: true, autoSave: false, showHistoricalContext: false,
    })
  })
  it('ignores values of the wrong type', () => {
    expect(parseSettings({ compactMode: 'yes', autoSave: 1, timeZone: 42 })).toEqual(DEFAULT_SETTINGS)
  })
  it('keeps a valid zone and drops an invalid one', () => {
    expect(parseSettings({ timeZone: 'America/New_York' }).timeZone).toBe('America/New_York')
    expect(parseSettings({ timeZone: 'Not/AZone' }).timeZone).toBe('auto')
    expect(parseSettings({ timeZone: 'auto' }).timeZone).toBe('auto')
  })
})

describe('parseProfile', () => {
  it('returns an empty profile for missing data', () => {
    expect(parseProfile(null)).toEqual(EMPTY_PROFILE)
  })
  it('keeps string fields and drops others', () => {
    expect(parseProfile({ firstName: 'Ana', lastName: 7, emailAddress: 'a@b.co' })).toEqual({
      ...EMPTY_PROFILE, firstName: 'Ana', emailAddress: 'a@b.co',
    })
  })
})
```

- [ ] **Step 3: Write the failing tests** `src/state/resolveBriefing.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { makeBriefing } from '../test/fixtures'
import { findBriefing, isSavedBriefing, latestBriefingId } from './resolveBriefing'

const a = makeBriefing({ id: 'a' })
const b = makeBriefing({ id: 'b' })
const s = makeBriefing({ id: 's' })

describe('findBriefing', () => {
  it('prefers the session briefing', () => {
    expect(findBriefing('s', s, [a, b])).toBe(s)
  })
  it('finds a saved briefing', () => {
    expect(findBriefing('b', s, [a, b])).toBe(b)
  })
  it('returns null for unknown or missing ids', () => {
    expect(findBriefing('zzz', s, [a, b])).toBeNull()
    expect(findBriefing(undefined, s, [a])).toBeNull()
    expect(findBriefing('a', null, [])).toBeNull()
  })
})

describe('latestBriefingId', () => {
  it('uses the session first, then the newest saved, then null', () => {
    expect(latestBriefingId(s, [a])).toBe('s')
    expect(latestBriefingId(null, [a, b])).toBe('a')
    expect(latestBriefingId(null, [])).toBeNull()
  })
})

describe('isSavedBriefing', () => {
  it('accepts a real briefing', () => {
    expect(isSavedBriefing(a)).toBe(true)
  })
  it('rejects corrupted values', () => {
    expect(isSavedBriefing(null)).toBe(false)
    expect(isSavedBriefing('x')).toBe(false)
    expect(isSavedBriefing({ id: 1, area: 'x', keyDevelopments: [] })).toBe(false)
    expect(isSavedBriefing({ id: 'x', area: 'x' })).toBe(false)
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run src/state`
Expected: FAIL, "Failed to resolve import ./settings" and "./resolveBriefing".

- [ ] **Step 5: Write `src/state/settings.ts`**

```ts
// Persisted user settings and profile. Parsing is defensive: storage may hold
// entries from older app versions or be hand-edited.
import { AUTO_ZONE, isValidTimeZone } from '../lib/time'

export interface UserSettings {
  /** 'auto' follows the device; otherwise an IANA zone such as 'America/New_York'. */
  timeZone: string
  autoSave: boolean
  showHistoricalContext: boolean
  compactMode: boolean
}

export const DEFAULT_SETTINGS: UserSettings = {
  timeZone: AUTO_ZONE,
  autoSave: true,
  showHistoricalContext: true,
  compactMode: false,
}

export interface UserProfile {
  firstName: string
  lastName: string
  emailAddress: string
  fieldOfStudy: string
}

export const EMPTY_PROFILE: UserProfile = { firstName: '', lastName: '', emailAddress: '', fieldOfStudy: '' }

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
}

export function parseSettings(raw: unknown): UserSettings {
  const r = asRecord(raw)
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
  const tz = typeof r.timeZone === 'string' && (r.timeZone === AUTO_ZONE || isValidTimeZone(r.timeZone))
    ? r.timeZone
    : AUTO_ZONE
  return {
    timeZone: tz,
    autoSave: bool(r.autoSave, DEFAULT_SETTINGS.autoSave),
    showHistoricalContext: bool(r.showHistoricalContext, DEFAULT_SETTINGS.showHistoricalContext),
    compactMode: bool(r.compactMode, DEFAULT_SETTINGS.compactMode),
  }
}

export function parseProfile(raw: unknown): UserProfile {
  const r = asRecord(raw)
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  return {
    firstName: str(r.firstName),
    lastName: str(r.lastName),
    emailAddress: str(r.emailAddress),
    fieldOfStudy: str(r.fieldOfStudy),
  }
}
```

- [ ] **Step 6: Write `src/state/resolveBriefing.ts`**

```ts
import type { SavedBriefing } from '../lib/normalize'

export function findBriefing(
  id: string | undefined,
  session: SavedBriefing | null,
  saved: SavedBriefing[],
): SavedBriefing | null {
  if (!id) return null
  if (session?.id === id) return session
  return saved.find((b) => b.id === id) ?? null
}

/** The briefing the nav's "Briefing" link opens: this session's, else the newest saved. */
export function latestBriefingId(session: SavedBriefing | null, saved: SavedBriefing[]): string | null {
  return session?.id ?? saved[0]?.id ?? null
}

/** Minimal shape check for briefings read back from storage. */
export function isSavedBriefing(value: unknown): value is SavedBriefing {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.area === 'string' && Array.isArray(v.keyDevelopments)
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/state`
Expected: all PASS. Then `npx vitest run` — every test passes.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/state frontend/src/test
git commit -m "feat(state): settings/profile parsing, briefing lookup, test fixtures

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Router, shared state and pages

**Files:**
- Modify: `frontend/package.json` (add `react-router`), `frontend/src/main.tsx`
- Rewrite: `frontend/src/App.tsx`, `frontend/src/app.css`, `frontend/src/components/NavBar.tsx`, `frontend/src/components/navbar.css`
- Create: `src/state/context.ts`, `src/state/AppState.tsx`, `src/state/hooks.ts`, `src/state/useGenerateBriefing.ts`, `src/lib/useClock.ts`, `src/lib/useRouteFocus.ts`, `src/lib/usePrintOnLoad.ts`, `src/components/AskForm.tsx`, `src/components/askform.css`, `src/routes/HomePage.tsx`, `src/routes/home.css`, `src/routes/BriefingLayout.tsx`, `src/routes/briefing-layout.css`, `src/routes/briefingContext.ts`, `src/routes/StoryTab.tsx`, `src/routes/SignalsTab.tsx`, `src/routes/ArchivePage.tsx`, `src/routes/SettingsPage.tsx`, `src/routes/UnsavedBriefing.tsx`, `src/routes/NotFound.tsx`
- Delete: `src/components/BriefingView.tsx`, `src/lib/analyticsChunk.ts`, `src/components/ProfilePage.tsx`, `src/components/SavedPage.tsx`, `src/components/BriefingForm.tsx`, `src/components/briefingform.css`, `src/components/StandByClock.tsx`, `src/components/standbyclock.css`

**Interfaces:**
- Consumes: Task 2 `formatClock`, `formatDateTime`; Task 3 `parseSettings`, `parseProfile`, `findBriefing`, `latestBriefingId`, `isSavedBriefing`, `UserSettings`, `UserProfile`.
- Produces:
  - `useAppState(): AppStateValue` with `saved, starred, session, settings, profile, toasts, fileBriefing(b), removeBriefing(id), toggleStar(id), setSession(b), updateSettings(patch: Partial<UserSettings>), saveProfile(p): boolean, pushToast(message, tone?, ttl?), dismissToast(id)`
  - `useSettings(): { settings: UserSettings; updateSettings(patch): void }`
  - `useGenerateBriefing(): { generate(focus: string, frequency: string): Promise<void>; retry(): void; loading: boolean; error: string | null }`
  - `useBriefing(): SavedBriefing` (inside `/brief/:id` routes)
  - `useClock(tz: string, intervalMs?: number): { day: string; time: string }`
  - `AskForm` props: `{ id: string; compact?: boolean; loading: boolean; error: string | null; onGenerate(focus, frequency): void; onRetry(): void; placeholder?: string }`
  - Route paths: `/`, `/brief/:id`, `/brief/:id/signals`, `/archive`, `/settings`, `*`
  - Element ids `dev-N` (N = index in `briefing.keyDevelopments`) remain the scroll targets.

- [ ] **Step 1: Install react-router**

Run (real path): `npm install react-router@^7`
Expected: `package.json` dependencies gain `"react-router": "^7.x"`.

- [ ] **Step 2: Wrap the app in a router** — replace `src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './styles/tokens.css'
import './styles/base.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 3: Create the state context** `src/state/context.ts`

```ts
import { createContext } from 'react'
import type { ToastItem } from '../components/Toast'
import type { SavedBriefing } from '../lib/normalize'
import type { UserProfile, UserSettings } from './settings'

export interface AppStateValue {
  saved: SavedBriefing[]
  starred: string[]
  session: SavedBriefing | null
  settings: UserSettings
  profile: UserProfile
  toasts: ToastItem[]
  fileBriefing: (briefing: SavedBriefing) => void
  removeBriefing: (id: string) => void
  toggleStar: (id: string) => void
  setSession: (briefing: SavedBriefing) => void
  updateSettings: (patch: Partial<UserSettings>) => void
  saveProfile: (profile: UserProfile) => boolean
  pushToast: (message: string, tone?: ToastItem['tone'], ttl?: number) => void
  dismissToast: (id: number) => void
}

export const AppStateContext = createContext<AppStateValue | null>(null)
```

- [ ] **Step 4: Create the provider** `src/state/AppState.tsx`

```tsx
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { ToastItem } from '../components/Toast'
import type { SavedBriefing } from '../lib/normalize'
import { KEYS, loadJSON, saveJSON } from '../lib/storage'
import { AppStateContext, type AppStateValue } from './context'
import { isSavedBriefing } from './resolveBriefing'
import { parseProfile, parseSettings, type UserProfile, type UserSettings } from './settings'

const SESSION_KEY = 'atlasSessionBriefing'
const ARCHIVE_LIMIT = 12
let toastSeq = 0

function loadSession(): SavedBriefing | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    const value: unknown = raw ? JSON.parse(raw) : null
    return isSavedBriefing(value) ? value : null
  } catch {
    return null
  }
}

function storeSession(briefing: SavedBriefing): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(briefing))
  } catch {
    // session copy is a convenience; the in-memory state still works
  }
}

function loadSaved(): SavedBriefing[] {
  const value = loadJSON<unknown>(KEYS.saved, [])
  return Array.isArray(value) ? value.filter(isSavedBriefing) : []
}

function loadStarred(): string[] {
  const value = loadJSON<unknown>(KEYS.starred, [])
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<SavedBriefing[]>(loadSaved)
  const [starred, setStarred] = useState<string[]>(loadStarred)
  const [session, setSessionState] = useState<SavedBriefing | null>(loadSession)
  const [settings, setSettings] = useState<UserSettings>(() => parseSettings(loadJSON<unknown>(KEYS.settings, null)))
  const [profile, setProfile] = useState<UserProfile>(() => parseProfile(loadJSON<unknown>(KEYS.profile, null)))
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const pushToast = useCallback((message: string, tone: ToastItem['tone'] = 'info', ttl = 3000) => {
    const id = ++toastSeq
    setToasts((t) => [...t, { id, message, tone }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl)
  }, [])
  const storageFailed = useCallback(
    () => pushToast("Couldn't save in this browser. Storage is full or turned off.", 'error', 4000),
    [pushToast],
  )

  const fileBriefing = useCallback((briefing: SavedBriefing) => {
    // Replace any same-topic entry, newest first, keep twelve (legacy behavior).
    const next = [briefing, ...saved.filter((b) => b.area !== briefing.area)].slice(0, ARCHIVE_LIMIT)
    setSaved(next)
    if (!saveJSON(KEYS.saved, next)) storageFailed()
  }, [saved, storageFailed])

  const removeBriefing = useCallback((id: string) => {
    const nextSaved = saved.filter((b) => b.id !== id)
    const nextStarred = starred.filter((s) => s !== id)
    setSaved(nextSaved)
    setStarred(nextStarred)
    if (!saveJSON(KEYS.saved, nextSaved) || !saveJSON(KEYS.starred, nextStarred)) storageFailed()
  }, [saved, starred, storageFailed])

  const toggleStar = useCallback((id: string) => {
    const next = starred.includes(id) ? starred.filter((s) => s !== id) : [...starred, id]
    setStarred(next)
    if (!saveJSON(KEYS.starred, next)) storageFailed()
  }, [starred, storageFailed])

  const setSession = useCallback((briefing: SavedBriefing) => {
    setSessionState(briefing)
    storeSession(briefing)
  }, [])

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    if (!saveJSON(KEYS.settings, next)) storageFailed()
  }, [settings, storageFailed])

  const saveProfile = useCallback((next: UserProfile) => {
    setProfile(next)
    const ok = saveJSON(KEYS.profile, next)
    if (!ok) storageFailed()
    return ok
  }, [storageFailed])

  const value = useMemo<AppStateValue>(() => ({
    saved, starred, session, settings, profile, toasts,
    fileBriefing, removeBriefing, toggleStar, setSession, updateSettings, saveProfile, pushToast, dismissToast,
  }), [saved, starred, session, settings, profile, toasts,
    fileBriefing, removeBriefing, toggleStar, setSession, updateSettings, saveProfile, pushToast, dismissToast])

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
```

- [ ] **Step 5: Create hooks** `src/state/hooks.ts`

```ts
import { useContext } from 'react'
import { AppStateContext, type AppStateValue } from './context'

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext)
  if (!value) throw new Error('useAppState must be used inside AppStateProvider')
  return value
}

export function useSettings() {
  const { settings, updateSettings } = useAppState()
  return { settings, updateSettings }
}
```

- [ ] **Step 6: Create the generate hook** `src/state/useGenerateBriefing.ts`

```ts
import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { requestBriefing } from '../lib/api'
import { normalizeBriefing } from '../lib/normalize'
import { useAppState } from './hooks'

export function useGenerateBriefing() {
  const { settings, setSession, fileBriefing, pushToast } = useAppState()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const last = useRef<{ focus: string; frequency: string } | null>(null)

  const generate = useCallback(async (focus: string, frequency: string) => {
    last.current = { focus, frequency }
    setLoading(true)
    setError(null)
    try {
      const api = await requestBriefing(focus, AbortSignal.timeout(120_000))
      const briefing = normalizeBriefing(api, frequency)
      setSession(briefing)
      if (settings.autoSave) fileBriefing(briefing)
      pushToast(settings.autoSave ? 'Briefing ready and saved to your archive' : 'Briefing ready', 'success', 2600)
      navigate(`/brief/${briefing.id}`)
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === 'TimeoutError'
          ? 'The request timed out. The free-tier backend may still be waking up. Try again in a moment.'
          : err instanceof Error
            ? err.message
            : 'Something went wrong while generating the briefing.',
      )
    } finally {
      setLoading(false)
    }
  }, [settings.autoSave, setSession, fileBriefing, pushToast, navigate])

  const retry = useCallback(() => {
    if (last.current) void generate(last.current.focus, last.current.frequency)
  }, [generate])

  return { generate, retry, loading, error }
}
```

- [ ] **Step 7: Create small hooks** `src/lib/useClock.ts`, `src/lib/useRouteFocus.ts`, `src/lib/usePrintOnLoad.ts`

`src/lib/useClock.ts`:

```ts
import { useEffect, useState } from 'react'
import { formatClock } from './time'

export function useClock(tz: string, intervalMs = 15_000): { day: string; time: string } {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs])
  return formatClock(now, tz)
}
```

`src/lib/useRouteFocus.ts`:

```ts
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router'

/**
 * On navigation: Back/Forward restores the previous scroll position, other
 * navigations start at the top, and focus moves to the new page's heading
 * so screen readers announce it. React Router's ScrollRestoration needs a
 * data router, which this app doesn't use.
 */
export function useRouteFocus(): void {
  const location = useLocation()
  const navType = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const first = useRef(true)

  useEffect(() => {
    window.history.scrollRestoration = 'manual'
  }, [])

  useEffect(() => {
    const key = location.key
    const save = () => positions.current.set(key, window.scrollY)
    window.addEventListener('scroll', save, { passive: true })
    return () => {
      save()
      window.removeEventListener('scroll', save)
    }
  }, [location.key])

  useLayoutEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    window.scrollTo(0, navType === 'POP' ? positions.current.get(location.key) ?? 0 : 0)
    const heading = document.querySelector<HTMLElement>('main h1, main h2')
    if (heading) {
      heading.setAttribute('tabindex', '-1')
      heading.focus({ preventScroll: true })
    }
  }, [location.key, navType])
}
```

`src/lib/usePrintOnLoad.ts`:

```ts
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

/** `?print=1` opens the print dialog once the page has painted, then drops the parameter. */
export function usePrintOnLoad(): void {
  const [params, setParams] = useSearchParams()
  const wantsPrint = params.get('print') === '1'
  useEffect(() => {
    if (!wantsPrint) return
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        setParams((p) => {
          p.delete('print')
          return p
        }, { replace: true })
        window.print()
      })
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [wantsPrint, setParams])
}
```

- [ ] **Step 8: Create `src/components/AskForm.tsx` and `askform.css`**

`src/components/AskForm.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react'
import './askform.css'

export const FREQUENCIES = ['daily', 'twice-daily', 'weekly'] as const

// The free-tier backend sleeps when idle and synthesis takes tens of seconds. Say so.
const STAGES: { after: number; text: string }[] = [
  { after: 0, text: 'Contacting Atlas…' },
  { after: 8, text: 'Waking the backend. Free hosting sleeps when idle, so this can take up to a minute…' },
  { after: 25, text: 'Still working: gathering sources, removing duplicates, writing the brief…' },
]

function useStagedMessage(active: boolean): string {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!active) {
      setElapsed(0)
      return
    }
    const t = window.setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [active])
  return ([...STAGES].reverse().find((s) => elapsed >= s.after) ?? STAGES[0]).text
}

export function AskForm({ id, compact = false, loading, error, onGenerate, onRetry, placeholder = 'about the Strait of Hormuz' }: {
  id: string
  compact?: boolean
  loading: boolean
  error: string | null
  onGenerate: (focus: string, frequency: string) => void
  onRetry: () => void
  placeholder?: string
}) {
  const [focus, setFocus] = useState('')
  const [frequency, setFrequency] = useState<string>('daily')
  const stage = useStagedMessage(loading)
  const trimmed = focus.trim()
  const valid = trimmed.length >= 2 && trimmed.length <= 200

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (valid && !loading) onGenerate(trimmed, frequency)
  }

  return (
    <form className={`ask ${compact ? 'ask-compact' : ''}`} onSubmit={submit}>
      <div className="ask-field">
        <label className="ask-label label" htmlFor={id}>Ask Atlas</label>
        <input
          id={id}
          type="text"
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder={placeholder}
          minLength={2}
          maxLength={200}
          disabled={loading}
          autoComplete="off"
          data-cursor="text"
        />
        {!compact && (
          <select aria-label="Briefing cadence" value={frequency} onChange={(e) => setFrequency(e.target.value)} disabled={loading}>
            {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        )}
        <button type="submit" className="btn btn-primary" disabled={!valid || loading} data-cursor="link">
          {loading ? 'Briefing…' : 'Brief me'}
        </button>
      </div>
      {loading && (
        <p className="ask-stage label" role="status">
          <span className="ask-beacon" aria-hidden="true" />
          {stage}
        </p>
      )}
      {error && !loading && (
        <div className="ask-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-quiet" onClick={onRetry} data-cursor="link">Try again</button>
        </div>
      )}
    </form>
  )
}
```

`src/components/askform.css`:

```css
.ask { display: grid; gap: 10px; max-width: 600px; }
.ask-field {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 7px 7px 20px;
  background: var(--paper);
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px var(--rule), 0 18px 40px -24px rgba(60, 50, 30, 0.35);
  transition: box-shadow var(--dur-mid) var(--ease-out);
}
.ask-field:focus-within { box-shadow: inset 0 0 0 1.5px var(--moss), 0 18px 40px -22px rgba(60, 50, 30, 0.4); }
.ask-label { color: var(--terra-ink); white-space: nowrap; }
.ask-field input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  font-size: 1.02rem;
  padding: 12px 4px;
  outline: none;
}
.ask-field input::placeholder { color: var(--ink-3); }
.ask-field select {
  border: 0;
  background: transparent;
  color: var(--ink-2);
  font-size: 0.86rem;
  padding: 8px;
  border-radius: 8px;
}
.ask-field select:hover { background: var(--oat); }
.ask-stage { display: flex; align-items: center; gap: 10px; color: var(--ink-2); text-transform: none; letter-spacing: 0.02em; }
.ask-beacon { width: 7px; height: 7px; border-radius: 50%; background: var(--terra); animation: ask-pulse 1.4s ease-in-out infinite; }
@keyframes ask-pulse { 50% { opacity: 0.3; } }
.ask-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--terra-wash);
  color: var(--ink);
}
.ask-error p { flex: 1 1 260px; }
.ask-compact { max-width: 460px; width: 100%; }
.ask-compact .ask-field { padding: 4px 4px 4px 16px; }
.ask-compact .ask-field input { padding: 8px 4px; font-size: 0.95rem; }
.ask-compact .btn { padding: 9px 16px; }
@media (max-width: 640px) {
  .ask-field { flex-wrap: wrap; border-radius: 22px; padding: 12px; }
  .ask-field input { flex-basis: 100%; order: 2; }
  .ask-field select { order: 3; }
  .ask-field .btn { order: 4; flex: 1; }
}
```

- [ ] **Step 9: Rewrite `src/components/NavBar.tsx` and `navbar.css`**

`src/components/NavBar.tsx`:

```tsx
import { Link, NavLink, useLocation } from 'react-router'
import { useClock } from '../lib/useClock'
import { useAppState } from '../state/hooks'
import { latestBriefingId } from '../state/resolveBriefing'
import './navbar.css'

const linkClass = ({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'active' : ''}`

export function NavBar() {
  const { session, saved, settings } = useAppState()
  const clock = useClock(settings.timeZone, 30_000)
  const { pathname } = useLocation()
  const latest = latestBriefingId(session, saved)
  const onBriefing = pathname.startsWith('/brief/')

  return (
    <header className="nav">
      <div className="nav-inner wrap">
        <Link className="wordmark" to="/" aria-label="Atlas Brief home" data-cursor="link">
          <b>Atlas</b>
          <i>Brief</i>
        </Link>
        <nav className="nav-links" aria-label="Primary">
          <Link
            className={`nav-link ${onBriefing ? 'active' : ''}`}
            to={latest ? `/brief/${latest}` : '/'}
            aria-current={onBriefing ? 'page' : undefined}
            data-cursor="link"
          >
            Briefing
          </Link>
          <NavLink className={linkClass} to="/archive" data-cursor="link">Archive</NavLink>
          <NavLink className={linkClass} to="/settings" data-cursor="link">Settings</NavLink>
        </nav>
        <Link className="nav-clock label" to="/settings" title="Change the time zone in Settings" data-cursor="link">
          {clock.time}
        </Link>
      </div>
    </header>
  )
}
```

`src/components/navbar.css`:

```css
.nav { position: relative; z-index: 20; }
.nav-inner { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding-block: 20px; }
.wordmark { display: flex; align-items: baseline; gap: 8px; text-decoration: none; color: var(--ink); }
.wordmark b { font-weight: 700; font-size: 1.2rem; letter-spacing: -0.03em; }
.wordmark i { font-family: var(--font-serif); font-variation-settings: var(--serif-vars); font-size: 1.2rem; color: var(--terra-ink); }
.nav-links { display: flex; gap: 4px; }
.nav-link {
  text-decoration: none;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 0.92rem;
  color: var(--ink-2);
  transition: background-color var(--dur-quick), color var(--dur-quick);
}
.nav-link:hover { color: var(--ink); background: rgba(248, 244, 235, 0.6); }
.nav-link.active { color: var(--ink); background: var(--paper); box-shadow: inset 0 0 0 1px var(--rule); }
.nav-clock { text-decoration: none; color: var(--ink-3); }
.nav-clock:hover { color: var(--terra-ink); }
@media (max-width: 640px) {
  .nav-inner { gap: 12px; }
  .nav-link { padding: 8px 10px; }
  .nav-clock { display: none; }
}
```

- [ ] **Step 10: Create the briefing outlet context** `src/routes/briefingContext.ts`

```ts
import { useOutletContext } from 'react-router'
import type { SavedBriefing } from '../lib/normalize'

export interface BriefingOutletContext {
  briefing: SavedBriefing
}

export function useBriefing(): SavedBriefing {
  return useOutletContext<BriefingOutletContext>().briefing
}
```

- [ ] **Step 11: Create Home** `src/routes/HomePage.tsx` and `src/routes/home.css`

`src/routes/HomePage.tsx` (Task 7 swaps the globe, Task 12 adds the hero motion):

```tsx
import { AskForm } from '../components/AskForm'
import { GlobeHero } from '../components/GlobeHero'
import { useGenerateBriefing } from '../state/useGenerateBriefing'
import './home.css'

const SUGGESTIONS = ['Red Sea shipping', 'Sahel security', 'Chip export controls', 'Climate finance']

export function HomePage() {
  const { generate, retry, loading, error } = useGenerateBriefing()
  return (
    <section className="home">
      <div className="home-inner wrap">
        <div className="home-copy">
          <p className="eyebrow label"><span>Global intelligence</span></p>
          <h1 className="home-title">
            <span className="l1">Brief me on</span>
            <span className="rot"><span className="rot-word serif">anything.</span></span>
          </h1>
          <p className="home-lede">
            Atlas reads NewsAPI, GDELT and fifteen wire services, then tells you{' '}
            <em className="serif">what changed, where it happened,</em> and what to read next.
          </p>
          <div className="home-ask">
            <AskForm id="home-ask" loading={loading} error={error} onGenerate={generate} onRetry={retry} />
            <div className="chips" aria-label="Suggested topics">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => void generate(s, 'daily')} disabled={loading} data-cursor="link">
                  {s}
                </button>
              ))}
            </div>
          </div>
          <p className="provenance label">
            <span>NewsAPI</span><span>GDELT 2.0</span><span>15 wire feeds</span><span>Model-written, source-cited</span>
          </p>
        </div>
        <div className="home-globe">
          <GlobeHero regionCounts={null} />
        </div>
      </div>
    </section>
  )
}
```

`src/routes/home.css`:

```css
.home { position: relative; overflow: hidden; }
.home-inner {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.02fr) minmax(0, 1fr);
  align-items: center;
  gap: 24px;
  padding-block: 24px 64px;
}
.home-copy { display: grid; gap: 28px; position: relative; z-index: 2; align-content: center; }
.eyebrow { display: flex; flex-wrap: wrap; gap: 10px 18px; color: var(--ink-3); }
.eyebrow span + span::before { content: '·'; margin-right: 18px; color: var(--sand); }
.home-title {
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 0.96;
  font-size: clamp(3rem, 7.4vw, 6.6rem);
}
.home-title .l1 { display: block; }
.rot { display: block; position: relative; height: 1.12em; color: var(--terra-ink); }
.rot-word { position: absolute; left: 0; top: 0; white-space: nowrap; letter-spacing: -0.02em; }
.rot-word.in { animation: rot-in 0.75s var(--ease-out) both; }
.rot-word.out { animation: rot-out 0.45s cubic-bezier(0.5, 0, 0.75, 0) both; }
@keyframes rot-in { from { opacity: 0; transform: translateY(0.45em); filter: blur(10px); } to { opacity: 1; transform: none; filter: blur(0); } }
@keyframes rot-out { to { opacity: 0; transform: translateY(-0.35em); filter: blur(8px); } }
.home-lede { max-width: 34em; font-size: 1.12rem; color: var(--ink-2); text-wrap: pretty; }
.home-lede em { color: var(--ink); }
.home-ask { display: grid; gap: 12px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  font-size: 0.86rem;
  color: var(--ink-2);
  background: transparent;
  border: 1px solid var(--rule);
  border-radius: 999px;
  padding: 7px 13px;
  transition: border-color var(--dur-quick), color var(--dur-quick), background-color var(--dur-quick);
}
.chip:hover:not(:disabled) { border-color: var(--moss); color: var(--ink); background: rgba(248, 244, 235, 0.7); }
.chip:disabled { opacity: 0.5; cursor: not-allowed; }
.provenance { display: flex; flex-wrap: wrap; gap: 16px; color: var(--ink-3); }
.home-globe { position: relative; width: 108%; margin-right: -8%; max-width: 700px; justify-self: end; }

/* First-load intro (Task 12 toggles .intro). Ends fully visible. */
.intro .home-copy > * { animation: settle var(--dur-enter) var(--ease-out) both; }
.intro .home-copy > *:nth-child(2) { animation-delay: 0.12s; }
.intro .home-copy > *:nth-child(3) { animation-delay: 0.24s; }
.intro .home-copy > *:nth-child(4) { animation-delay: 0.36s; }
.intro .home-copy > *:nth-child(5) { animation-delay: 0.48s; }
@keyframes settle { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }

@media (max-width: 980px) {
  .home-inner { grid-template-columns: minmax(0, 1fr); padding-block: 8px 48px; }
  .home-globe { width: 100%; margin: 0 auto; max-width: 520px; justify-self: center; order: -1; }
}
```

- [ ] **Step 12: Create the briefing layout** `src/routes/BriefingLayout.tsx` and `briefing-layout.css`

`src/routes/BriefingLayout.tsx`:

```tsx
import { NavLink, Outlet, useParams } from 'react-router'
import { AskForm } from '../components/AskForm'
import { formatDateTime } from '../lib/time'
import { useAppState } from '../state/hooks'
import { findBriefing } from '../state/resolveBriefing'
import { useGenerateBriefing } from '../state/useGenerateBriefing'
import type { BriefingOutletContext } from './briefingContext'
import { UnsavedBriefing } from './UnsavedBriefing'
import './briefing-layout.css'

const tabClass = ({ isActive }: { isActive: boolean }) => `tab ${isActive ? 'active' : ''}`

export function BriefingLayout() {
  const { id } = useParams()
  const { session, saved, settings } = useAppState()
  const { generate, retry, loading, error } = useGenerateBriefing()
  const briefing = findBriefing(id, session, saved)
  if (!briefing) return <UnsavedBriefing />

  const context: BriefingOutletContext = { briefing }
  return (
    <div className={`briefing ${settings.compactMode ? 'compact' : ''}`}>
      <header className="masthead wrap">
        <div className="masthead-top">
          <p className="masthead-kicker label">Briefing</p>
          <AskForm id="brief-ask" compact loading={loading} error={error} onGenerate={generate} onRetry={retry} placeholder="a new topic" />
        </div>
        <h1 className="masthead-title">{briefing.area}</h1>
        <p className="masthead-meta label">
          Issued {formatDateTime(briefing.generatedAt, settings.timeZone)} · {briefing.frequency} ·{' '}
          {briefing.stats.articles} articles · {briefing.stats.sources} sources
        </p>
        <nav className="tabs" aria-label="Briefing sections">
          <NavLink end to={`/brief/${briefing.id}`} className={tabClass} data-cursor="link">Story</NavLink>
          <NavLink to={`/brief/${briefing.id}/signals`} className={tabClass} data-cursor="link">Signals</NavLink>
        </nav>
      </header>
      <Outlet context={context} />
    </div>
  )
}
```

`src/routes/briefing-layout.css`:

```css
.briefing { padding-bottom: 56px; }
.masthead { position: relative; display: grid; gap: 14px; padding-block: 24px 0; }
.masthead-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; position: relative; z-index: 1; }
.masthead-kicker { color: var(--terra-ink); }
.masthead-title {
  position: relative;
  z-index: 1;
  font-size: clamp(2.4rem, 5.4vw, 4.4rem);
  letter-spacing: -0.035em;
  line-height: 1;
}
.masthead-title::first-letter { text-transform: uppercase; }
.masthead-meta { color: var(--ink-3); position: relative; z-index: 1; }
.tabs { display: flex; gap: 4px; margin-top: 10px; border-bottom: 1px solid var(--rule); position: relative; z-index: 1; }
.tab {
  padding: 12px 16px;
  text-decoration: none;
  color: var(--ink-2);
  font-weight: 600;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color var(--dur-quick), border-color var(--dur-quick);
}
.tab:hover { color: var(--ink); }
.tab.active { color: var(--ink); border-color: var(--terra); }
```

- [ ] **Step 13: Create the tabs** `src/routes/StoryTab.tsx` and `src/routes/SignalsTab.tsx` (interim; Tasks 7, 9, 11 replace their insides)

`src/routes/StoryTab.tsx`:

```tsx
import { useMemo } from 'react'
import { Contradictions } from '../components/briefing/Contradictions'
import { KeyDevelopments } from '../components/briefing/KeyDevelopments'
import { PriorityAlerts } from '../components/briefing/PriorityAlerts'
import { ReadingList } from '../components/briefing/ReadingList'
import { Tensions } from '../components/briefing/Tensions'
import '../components/briefing/briefing.css'
import { GlobeHero } from '../components/GlobeHero'
import { usePrintOnLoad } from '../lib/usePrintOnLoad'
import { useSettings } from '../state/hooks'
import { useBriefing } from './briefingContext'

export function StoryTab() {
  const briefing = useBriefing()
  const { settings } = useSettings()
  usePrintOnLoad()
  const developments = settings.showHistoricalContext
    ? briefing.keyDevelopments
    : briefing.keyDevelopments.map((d) => ({ ...d, historicalContext: '' }))
  const anchors = useMemo(
    () => briefing.keyDevelopments.map((d, i) => ({ headline: d.title, regions: d.regions, anchorId: `dev-${i}` })),
    [briefing],
  )
  return (
    <div className="story wrap">
      <div className="story-globe">
        <GlobeHero regionCounts={briefing.regionCounts} developments={anchors} />
      </div>
      <PriorityAlerts alerts={briefing.alerts} />
      <KeyDevelopments developments={developments} />
      <Tensions tensions={briefing.emergingTensions} />
      <Contradictions contradictions={briefing.contradictions} />
      <ReadingList readings={briefing.readingList} />
    </div>
  )
}
```

`src/routes/SignalsTab.tsx`:

```tsx
import { Suspense, lazy } from 'react'
import { useBriefing } from './briefingContext'

// chart.js stays out of the entry chunk until Task 11 replaces this panel.
const AnalyticsPanel = lazy(() => import('../components/AnalyticsPanel').then((m) => ({ default: m.AnalyticsPanel })))

export function SignalsTab() {
  const briefing = useBriefing()
  return (
    <div className="signals wrap">
      <Suspense fallback={null}>
        <AnalyticsPanel briefing={briefing} />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 14: Create the Archive page** `src/routes/ArchivePage.tsx`

```tsx
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PrintIcon, StarIcon, TrashIcon } from '../components/icons'
import type { SavedBriefing } from '../lib/normalize'
import { relativeTime } from '../lib/relativeTime'
import { formatDateTime } from '../lib/time'
import { useAppState } from '../state/hooks'
import '../components/saved.css'

function CompareColumn({ briefing, timeZone }: { briefing: SavedBriefing; timeZone: string }) {
  return (
    <div className="compare-col">
      <h3 className="compare-title">{briefing.area}</h3>
      <p className="compare-issued label">{formatDateTime(briefing.generatedAt, timeZone)}</p>
      <div className="compare-block">
        <span className="label">Developments</span>
        <ul>{briefing.keyDevelopments.slice(0, 4).map((d, i) => <li key={i}>{d.title}</li>)}</ul>
      </div>
      <div className="compare-block">
        <span className="label">Alerts</span>
        {briefing.alerts.length
          ? <ul>{briefing.alerts.map((a, i) => <li key={i}><strong>{a.label}</strong>: {a.title}</li>)}</ul>
          : <p className="compare-none">None issued.</p>}
      </div>
      <div className="compare-block">
        <span className="label">Tensions</span>
        {briefing.emergingTensions.length
          ? <ul>{briefing.emergingTensions.map((t, i) => <li key={i}>{t.actors}</li>)}</ul>
          : <p className="compare-none">None surfaced.</p>}
      </div>
    </div>
  )
}

export function ArchivePage() {
  const { saved, starred, toggleStar, removeBriefing, pushToast, settings } = useAppState()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | 'starred'>('all')

  const visible = useMemo(
    () => (filter === 'starred' ? saved.filter((b) => starred.includes(b.id)) : saved),
    [saved, starred, filter],
  )
  const pair = useMemo(
    () => selected.map((id) => saved.find((b) => b.id === id)).filter((b): b is SavedBriefing => !!b),
    [selected, saved],
  )
  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev.slice(-1), id]))
  const onDelete = (id: string) => {
    if (!window.confirm('Remove this briefing from the archive?')) return
    removeBriefing(id)
    setSelected((prev) => prev.filter((s) => s !== id))
    pushToast('Briefing removed', 'info', 2000)
  }

  return (
    <div className="page wrap archive">
      <header className="page-head">
        <p className="page-kicker label">Archive</p>
        <h1 className="page-title">Saved briefings</h1>
        <p className="page-lede">The newest twelve briefings are kept in this browser.</p>
      </header>

      {saved.length === 0 ? (
        <div className="saved-empty">
          <h2>The archive is empty</h2>
          <p>Generate a briefing and it is saved here automatically.</p>
          <Link className="btn btn-primary" to="/" data-cursor="link">Start a brief</Link>
        </div>
      ) : (
        <>
          <div className="saved-toolbar">
            <p className="label">{visible.length} filed</p>
            <div className="saved-filters" role="group" aria-label="Filter briefings">
              <button type="button" className={`btn btn-quiet saved-filter ${filter === 'all' ? 'on' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')} data-cursor="link">All</button>
              <button type="button" className={`btn btn-quiet saved-filter ${filter === 'starred' ? 'on' : ''}`} aria-pressed={filter === 'starred'} onClick={() => setFilter('starred')} data-cursor="link">Starred</button>
            </div>
          </div>

          <div className="saved-grid">
            {visible.map((b) => {
              const isStarred = starred.includes(b.id)
              const checked = selected.includes(b.id)
              return (
                <article key={b.id} className={`saved-card ${checked ? 'selected' : ''}`}>
                  <header className="saved-card-head">
                    <div>
                      <h2 className="saved-card-title">{b.area}</h2>
                      <span className="saved-card-date label">Filed {relativeTime(b.generatedAt)}</span>
                    </div>
                    <button
                      type="button"
                      className={`star-btn ${isStarred ? 'on' : ''}`}
                      onClick={() => toggleStar(b.id)}
                      aria-label={isStarred ? 'Unstar briefing' : 'Star briefing'}
                      aria-pressed={isStarred}
                      data-cursor="link"
                    >
                      <StarIcon size={17} filled={isStarred} />
                    </button>
                  </header>
                  <p className="saved-card-lede">{b.keyDevelopments[0]?.title ?? 'Saved briefing ready to review.'}</p>
                  <p className="saved-card-stats label">{b.stats.articles} articles · {b.stats.regions} regions · {b.stats.alerts} alerts</p>
                  <footer className="saved-card-actions">
                    <button type="button" className="btn btn-primary saved-view" onClick={() => navigate(`/brief/${b.id}`)} data-cursor="link">Open</button>
                    <button type="button" className="btn btn-quiet" onClick={() => navigate(`/brief/${b.id}?print=1`)} aria-label={`Print ${b.area}`} data-cursor="link">
                      <PrintIcon size={14} /> Print
                    </button>
                    <button type="button" className="btn btn-quiet" onClick={() => onDelete(b.id)} aria-label={`Delete ${b.area}`} data-cursor="link">
                      <TrashIcon size={14} />
                    </button>
                    <label className="compare-check">
                      <input type="checkbox" checked={checked} onChange={() => toggleSelect(b.id)} aria-label={`Select ${b.area} for comparison`} />
                      Compare
                    </label>
                  </footer>
                </article>
              )
            })}
          </div>

          {pair.length === 2 && (
            <section className="compare-panel" aria-labelledby="compare-h">
              <h2 id="compare-h" className="label">Side by side</h2>
              <div className="compare-split">
                <CompareColumn briefing={pair[0]} timeZone={settings.timeZone} />
                <CompareColumn briefing={pair[1]} timeZone={settings.timeZone} />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 15: Create the Settings page** `src/routes/SettingsPage.tsx`

```tsx
import { useState, type ChangeEvent } from 'react'
import { useAppState } from '../state/hooks'
import type { UserProfile, UserSettings } from '../state/settings'
import '../components/profile.css'

type ToggleKey = Exclude<keyof UserSettings, 'timeZone'>

const TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  { key: 'autoSave', label: 'Save briefings automatically', hint: 'Add each new briefing to your archive.' },
  { key: 'showHistoricalContext', label: 'Historical context', hint: 'Show the "from the archive" background paragraphs.' },
  { key: 'compactMode', label: 'Compact layout', hint: 'Tighter spacing across briefing pages.' },
]

function initialsFor(p: UserProfile): string {
  return `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase() || 'AB'
}

export function SettingsPage() {
  const { profile, saveProfile, settings, updateSettings } = useAppState()
  const [draft, setDraft] = useState<UserProfile>(profile)
  const [savedFlash, setSavedFlash] = useState(false)

  const field = (key: keyof UserProfile) => (e: ChangeEvent<HTMLInputElement>) =>
    setDraft((p) => ({ ...p, [key]: e.target.value }))
  const persist = () => {
    if (saveProfile(draft)) {
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 1600)
    }
  }

  return (
    <div className="page wrap settings">
      <header className="page-head">
        <p className="page-kicker label">Settings</p>
        <h1 className="page-title">Settings</h1>
      </header>

      <section className="settings-card" aria-labelledby="profile-h">
        <h2 id="profile-h" className="label">Analyst profile</h2>
        <div className="profile-row">
          <div className="profile-avatar mono" aria-hidden="true">{initialsFor(draft)}</div>
          <div className="profile-name-block">
            <span className="profile-display-name">{`${draft.firstName} ${draft.lastName}`.trim() || 'Unnamed analyst'}</span>
            <span className="profile-display-email mono">{draft.emailAddress || 'No email saved'}</span>
          </div>
        </div>
        <div className="profile-fields">
          <label>First name<input type="text" value={draft.firstName} onChange={field('firstName')} autoComplete="given-name" data-cursor="text" /></label>
          <label>Last name<input type="text" value={draft.lastName} onChange={field('lastName')} autoComplete="family-name" data-cursor="text" /></label>
          <label>Email<input type="email" value={draft.emailAddress} onChange={field('emailAddress')} autoComplete="email" data-cursor="text" /></label>
          <label>Field of study<input type="text" value={draft.fieldOfStudy} onChange={field('fieldOfStudy')} placeholder="e.g. International Relations" data-cursor="text" /></label>
        </div>
        <button type="button" className="btn btn-primary" onClick={persist} data-cursor="link">{savedFlash ? 'Saved' : 'Save profile'}</button>
        <p className="profile-note label">Stored only in this browser.</p>
      </section>

      <section className="settings-card" aria-labelledby="prefs-h">
        <h2 id="prefs-h" className="label">Preferences</h2>
        <ul className="settings-list">
          {TOGGLES.map(({ key, label, hint }) => (
            <li key={key} className="settings-item">
              <div>
                <span className="settings-label">{label}</span>
                <span className="settings-hint">{hint}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings[key]}
                aria-label={label}
                className={`switch ${settings[key] ? 'on' : ''}`}
                onClick={() => updateSettings({ [key]: !settings[key] } as Partial<UserSettings>)}
                data-cursor="link"
              >
                <span className="switch-knob" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 16: Create the empty states** `src/routes/UnsavedBriefing.tsx` and `src/routes/NotFound.tsx`

`src/routes/UnsavedBriefing.tsx`:

```tsx
import { Link } from 'react-router'

export function UnsavedBriefing() {
  return (
    <section className="page wrap empty-state">
      <p className="page-kicker label">Briefing not found</p>
      <h1 className="page-title">This briefing isn't saved on this device</h1>
      <p className="page-lede">
        Briefings are stored in this browser. It may have been removed from your archive, or the link came from another device.
      </p>
      <div className="actions">
        <Link className="btn btn-primary" to="/" data-cursor="link">Start a new brief</Link>
        <Link className="btn btn-quiet" to="/archive" data-cursor="link">Open the archive</Link>
      </div>
    </section>
  )
}
```

`src/routes/NotFound.tsx`:

```tsx
import { Link } from 'react-router'

export function NotFound() {
  return (
    <section className="page wrap empty-state">
      <p className="page-kicker label">404</p>
      <h1 className="page-title">Page not found</h1>
      <p className="page-lede">That address doesn't match any page in Atlas Brief.</p>
      <div className="actions">
        <Link className="btn btn-primary" to="/" data-cursor="link">Go to Home</Link>
      </div>
    </section>
  )
}
```

- [ ] **Step 17: Rewrite `src/App.tsx` and `src/app.css`**

`src/App.tsx`:

```tsx
import { useEffect } from 'react'
import { Route, Routes } from 'react-router'
import { NavBar } from './components/NavBar'
import { ToastHost } from './components/Toast'
import { warmBackend } from './lib/api'
import { useRouteFocus } from './lib/useRouteFocus'
import { ArchivePage } from './routes/ArchivePage'
import { BriefingLayout } from './routes/BriefingLayout'
import { HomePage } from './routes/HomePage'
import { NotFound } from './routes/NotFound'
import { SettingsPage } from './routes/SettingsPage'
import { SignalsTab } from './routes/SignalsTab'
import { StoryTab } from './routes/StoryTab'
import { AppStateProvider } from './state/AppState'
import { useAppState } from './state/hooks'
import './app.css'

function Shell() {
  useRouteFocus()
  useEffect(() => warmBackend(), [])
  const { toasts, dismissToast } = useAppState()
  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <NavBar />
      <main id="main" className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/brief/:id" element={<BriefingLayout />}>
            <Route index element={<StoryTab />} />
            <Route path="signals" element={<SignalsTab />} />
          </Route>
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="footer">
        <div className="wrap">
          <span>Atlas Brief · NewsAPI, GDELT and fifteen wire services</span>
          <span>Analysis is model-written. Check it against the cited sources.</span>
        </div>
      </footer>
      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default function App() {
  return (
    <AppStateProvider>
      <Shell />
    </AppStateProvider>
  )
}
```

`src/app.css`:

```css
.app { min-height: 100vh; display: flex; flex-direction: column; }
.main { flex: 1; }
.skip-link {
  position: absolute;
  left: 16px;
  top: -60px;
  z-index: 200;
  background: var(--ink);
  color: var(--paper);
  padding: 10px 14px;
  border-radius: 8px;
  text-decoration: none;
}
.skip-link:focus { top: 12px; }

.page { padding-block: 40px 72px; display: grid; gap: 32px; align-content: start; }
.page-head { display: grid; gap: 10px; }
.page-kicker { color: var(--terra-ink); }
.page-title { font-size: clamp(2.2rem, 4.6vw, 3.6rem); letter-spacing: -0.035em; line-height: 1.02; }
.page-lede { color: var(--ink-2); max-width: 60ch; }
.empty-state { justify-items: start; max-width: 680px; }
.empty-state .actions { display: flex; flex-wrap: wrap; gap: 10px; }
.section-label { color: var(--terra-ink); margin-bottom: 20px; }

.footer { border-top: 1px solid var(--rule); padding-block: 32px 48px; color: var(--ink-3); }
.footer .wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 32px;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
```

- [ ] **Step 18: Delete replaced files**

```bash
cd frontend
git rm src/components/BriefingView.tsx src/lib/analyticsChunk.ts src/components/ProfilePage.tsx \
  src/components/SavedPage.tsx src/components/BriefingForm.tsx src/components/briefingform.css \
  src/components/StandByClock.tsx src/components/standbyclock.css
```

- [ ] **Step 19: Verify**

Run (real path): `npm run build && npm run lint`
Expected: build succeeds with no TypeScript errors; no new lint warnings.
Run tests: `npx vitest run` — all pass.
Run `npm run dev` and check each item:
- `/` shows the hero and Ask form; Archive and Settings nav links work and highlight.
- `/brief/does-not-exist` shows "This briefing isn't saved on this device".
- `/nope` shows "Page not found".
- Generating a briefing (with the backend running or `npm run dev:live`) lands on `/brief/<id>`; the Signals tab URL ends in `/signals`; the browser Back button returns to Story at the same scroll position.
- In Archive, Print opens the print dialog on the briefing page.

- [ ] **Step 20: Commit**

```bash
git add -A frontend
git commit -m "feat(app): multi-page router, shared app state, Home/Briefing/Archive/Settings pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Time-zone setting

**Files:**
- Create: `frontend/src/components/TimeZonePicker.tsx`, `frontend/src/components/timezone.css`
- Modify: `frontend/src/routes/SettingsPage.tsx` (add a "Time" section)

**Interfaces:**
- Consumes: Task 2 `AUTO_ZONE`, `deviceTimeZone`, `isValidTimeZone`, `listTimeZones`, `resolveTimeZone`, `zoneLabel`; Task 4 `useAppState().updateSettings`.
- Produces: `TimeZonePicker` props `{ value: string; onChange(tz: string): void }` where `tz` is `'auto'` or a valid IANA name.

- [ ] **Step 1: Create `src/components/TimeZonePicker.tsx`**

```tsx
import { useId, useMemo, useState } from 'react'
import { AUTO_ZONE, deviceTimeZone, isValidTimeZone, listTimeZones, resolveTimeZone, zoneLabel } from '../lib/time'
import './timezone.css'

export function TimeZonePicker({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const listId = useId()
  const options = useMemo(() => listTimeZones().map((z) => ({ zone: z, label: zoneLabel(z) })), [])
  const zoneSet = useMemo(() => new Set(options.map((o) => o.zone)), [options])
  const [draft, setDraft] = useState(value === AUTO_ZONE ? '' : value)
  const [error, setError] = useState<string | null>(null)

  const commit = (next: string) => {
    const tz = next.trim()
    if (!tz) return
    if (isValidTimeZone(tz)) {
      setError(null)
      onChange(tz)
    } else {
      setError('Choose a zone from the list, for example America/New_York.')
    }
  }

  const status = error
    ?? (value === AUTO_ZONE
      ? `Following this device: ${zoneLabel(deviceTimeZone())}`
      : `Showing times in ${zoneLabel(resolveTimeZone(value))}`)

  return (
    <div className="tz">
      <label className="tz-label" htmlFor="tz-input">Time zone</label>
      <div className="tz-row">
        <input
          id="tz-input"
          list={listId}
          value={draft}
          placeholder="Search a zone, e.g. America/New_York"
          autoComplete="off"
          aria-describedby="tz-status"
          aria-invalid={error ? true : undefined}
          data-cursor="text"
          onChange={(e) => {
            setDraft(e.target.value)
            if (zoneSet.has(e.target.value)) commit(e.target.value)
          }}
          onBlur={() => {
            if (draft && draft !== value) commit(draft)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit(draft)
            }
          }}
        />
        <button
          type="button"
          className="btn btn-quiet"
          disabled={value === AUTO_ZONE}
          onClick={() => {
            setDraft('')
            setError(null)
            onChange(AUTO_ZONE)
          }}
          data-cursor="link"
        >
          Use my device's time zone
        </button>
      </div>
      <datalist id={listId}>
        {options.map((o) => <option key={o.zone} value={o.zone}>{o.label}</option>)}
      </datalist>
      <p id="tz-status" className={`tz-status ${error ? 'tz-error' : ''}`} role={error ? 'alert' : undefined}>{status}</p>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/timezone.css`**

```css
.tz { display: grid; gap: 10px; }
.tz-label { font-weight: 600; }
.tz-row { display: flex; flex-wrap: wrap; gap: 10px; }
.tz-row input {
  flex: 1 1 260px;
  min-width: 0;
  padding: 11px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--rule);
  background: var(--paper);
}
.tz-row input:focus-visible { outline: 2px solid var(--moss); outline-offset: 1px; }
.tz-status { color: var(--ink-3); font-size: 0.92rem; }
.tz-error { color: var(--terra-ink); }
```

- [ ] **Step 3: Add the Time section to Settings**

In `src/routes/SettingsPage.tsx`, add the import:

```tsx
import { TimeZonePicker } from '../components/TimeZonePicker'
```

and insert this section between the profile section and the preferences section:

```tsx
      <section className="settings-card" aria-labelledby="time-h">
        <h2 id="time-h" className="label">Time</h2>
        <TimeZonePicker value={settings.timeZone} onChange={(tz) => updateSettings({ timeZone: tz })} />
      </section>
```

- [ ] **Step 4: Verify**

Run (real path): `npm run build && npm run lint` — succeed, no new warnings.
In `npm run dev`: open Settings, type `America/Los` and pick `America/Los_Angeles`. The nav clock changes to Pacific time immediately (e.g. `07:32 PDT`). Open a briefing: the masthead "Issued" time uses PDT. Type `Nowhere/Land` and press Enter: the error text appears and times don't change. Click "Use my device's time zone": the status reads "Following this device".

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TimeZonePicker.tsx frontend/src/components/timezone.css frontend/src/routes/SettingsPage.tsx
git commit -m "feat(settings): time-zone picker applied app-wide

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Land points and region mapping

**Files:**
- Create: `frontend/scripts/build-land-points.mjs`, `frontend/src/globe/landPoints.ts` (generated), `frontend/src/globe/regions.ts`
- Test: `frontend/src/globe/regions.test.ts`
- Modify: `frontend/package.json` (script `build:land`)

**Interfaces:**
- Consumes: `resolveRegion` from `src/lib/centroids.ts`; `SavedBriefing` from normalize; Task 3 `makeBriefing`.
- Produces:
  - `LAND_POINT_COUNT: number`, `LAND_POINTS_B64: string` (in `landPoints.ts`; import only from the lazy globe chunk)
  - `interface Vec3 { x: number; y: number; z: number }`
  - `toVec3(lat: number, lng: number, r?: number): Vec3` — `x = cos(lat)·sin(lng)·r`, `y = sin(lat)·r`, `z = cos(lat)·cos(lng)·r`
  - `decodeLandPoints(b64: string): Float32Array` (xyz triples on the unit sphere)
  - `interface RegionStory { anchorId: string; title: string; timestamp: string; sources: SourceCitation[] }`
  - `interface RegionPoint { name: string; lat: number; lng: number; count: number; stories: RegionStory[] }`
  - `buildRegionPoints(b: Pick<SavedBriefing, 'regionCounts' | 'keyDevelopments'>): RegionPoint[]` sorted by count desc, then name
  - `topRegion(points: RegionPoint[]): RegionPoint | null`

- [ ] **Step 1: Write the generator** `frontend/scripts/build-land-points.mjs`

```js
#!/usr/bin/env node
// Builds src/globe/landPoints.ts: points of a Fibonacci sphere that fall on
// land (world-atlas land-110m), packed as Int16 [lat*100, lng*100] pairs and
// base64-encoded. Run with `npm run build:land` after upgrading world-atlas.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { feature } = require('topojson-client')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const topo = JSON.parse(readFileSync(resolve(root, 'node_modules/world-atlas/land-110m.json'), 'utf8'))
const land = feature(topo, topo.objects.land)

const polys = []
for (const f of land.features) {
  const g = f.geometry
  const list = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  for (const rings of list) {
    let minX = 180, maxX = -180, minY = 90, maxY = -90
    for (const [x, y] of rings[0]) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
    polys.push({ rings, bbox: [minX, minY, maxX, maxY] })
  }
}

const inRing = (x, y, ring) => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const isLand = (lng, lat) => polys.some(({ rings, bbox }) =>
  lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3] &&
  inRing(lng, lat, rings[0]) && !rings.slice(1).some((hole) => inRing(lng, lat, hole)))

const SAMPLES = 60000
const golden = Math.PI * (3 - Math.sqrt(5))
const out = []
for (let i = 0; i < SAMPLES; i++) {
  const y = 1 - (i / (SAMPLES - 1)) * 2
  const r = Math.sqrt(1 - y * y)
  const theta = golden * i
  const lat = (Math.asin(y) * 180) / Math.PI
  const lng = (((Math.atan2(Math.sin(theta) * r, Math.cos(theta) * r) * 180) / Math.PI) + 540) % 360 - 180
  if (lat < -60) continue // skip Antarctica
  if (isLand(lng, lat)) out.push(Math.round(lat * 100), Math.round(lng * 100))
}

const b64 = Buffer.from(new Int16Array(out).buffer).toString('base64')
const count = out.length / 2
writeFileSync(
  resolve(root, 'src/globe/landPoints.ts'),
  `// Generated by scripts/build-land-points.mjs. Do not edit by hand.\n` +
    `// ${count} points as Int16 [lat*100, lng*100] pairs, little-endian, base64.\n` +
    `export const LAND_POINT_COUNT = ${count}\n` +
    `export const LAND_POINTS_B64 =\n  '${b64}'\n`,
)
console.log(`Wrote ${count} land points to src/globe/landPoints.ts`)
```

- [ ] **Step 2: Add the script and generate**

In `frontend/package.json` `"scripts"`, add `"build:land": "node scripts/build-land-points.mjs"`. Then run (real path):

```bash
npm run build:land
```

Expected: `Wrote 15896 land points to src/globe/landPoints.ts` (the exact number may differ slightly by world-atlas version; it must be between 14000 and 18000).

- [ ] **Step 3: Write the failing tests** `src/globe/regions.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { makeBriefing } from '../test/fixtures'
import { buildRegionPoints, decodeLandPoints, toVec3, topRegion } from './regions'

function encode(values: number[]): string {
  const bytes = new Uint8Array(new Int16Array(values).buffer)
  let s = ''
  bytes.forEach((b) => { s += String.fromCharCode(b) })
  return btoa(s)
}

describe('toVec3', () => {
  it('puts lat 0, lng 0 on +z and the north pole on +y', () => {
    const a = toVec3(0, 0)
    expect(a.x).toBeCloseTo(0); expect(a.y).toBeCloseTo(0); expect(a.z).toBeCloseTo(1)
    const n = toVec3(90, 0)
    expect(n.y).toBeCloseTo(1)
  })
  it('puts lng 90 on +x', () => {
    expect(toVec3(0, 90).x).toBeCloseTo(1)
  })
})

describe('decodeLandPoints', () => {
  it('decodes packed lat/lng pairs into unit vectors', () => {
    const out = decodeLandPoints(encode([1000, 2000, -4500, 17999]))
    expect(out).toHaveLength(6)
    const first = toVec3(10, 20)
    expect(out[0]).toBeCloseTo(first.x); expect(out[1]).toBeCloseTo(first.y); expect(out[2]).toBeCloseTo(first.z)
    const second = toVec3(-45, 179.99)
    expect(out[3]).toBeCloseTo(second.x); expect(out[5]).toBeCloseTo(second.z)
  })
})

describe('buildRegionPoints', () => {
  it('maps resolvable regions with their stories, busiest first', () => {
    const points = buildRegionPoints(makeBriefing())
    expect(points.map((p) => p.name)).toEqual(['Red Sea', 'Egypt', 'South Africa', 'Yemen'])
    expect(points[0].count).toBe(2)
    expect(points[0].stories.map((s) => s.anchorId)).toEqual(['dev-0', 'dev-1'])
    expect(points[0].stories[0].title).toBe('Drone strike damages tanker near Bab el-Mandeb')
  })
  it('matches story regions case-insensitively', () => {
    const b = makeBriefing()
    b.keyDevelopments[2] = { ...b.keyDevelopments[2], regions: ['  egypt '] }
    const egypt = buildRegionPoints(b).find((p) => p.name === 'Egypt')
    expect(egypt?.stories.map((s) => s.anchorId)).toEqual(['dev-2'])
  })
  it('drops regions that cannot be placed', () => {
    const points = buildRegionPoints(makeBriefing({ regionCounts: { Atlantis: 3, Egypt: 1 } }))
    expect(points.map((p) => p.name)).toEqual(['Egypt'])
  })
  it('returns no points when no region resolves', () => {
    const points = buildRegionPoints(makeBriefing({ regionCounts: { Atlantis: 2, Narnia: 1 } }))
    expect(points).toEqual([])
    expect(topRegion(points)).toBeNull()
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run src/globe/regions.test.ts`
Expected: FAIL, "Failed to resolve import ./regions".

- [ ] **Step 5: Write `src/globe/regions.ts`**

```ts
// Pure geometry and briefing-to-globe mapping. No three.js here: this module is
// imported by the Story tab in the main chunk.
import { resolveRegion } from '../lib/centroids'
import type { SavedBriefing } from '../lib/normalize'
import type { SourceCitation } from '../lib/types'

export interface Vec3 { x: number; y: number; z: number }

export interface RegionStory {
  anchorId: string
  title: string
  timestamp: string
  sources: SourceCitation[]
}

export interface RegionPoint {
  name: string
  lat: number
  lng: number
  count: number
  stories: RegionStory[]
}

const DEG = Math.PI / 180

export function toVec3(lat: number, lng: number, r = 1): Vec3 {
  const la = lat * DEG, lo = lng * DEG
  return { x: Math.cos(la) * Math.sin(lo) * r, y: Math.sin(la) * r, z: Math.cos(la) * Math.cos(lo) * r }
}

export function decodeLandPoints(b64: string): Float32Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const ll = new Int16Array(bytes.buffer)
  const out = new Float32Array((ll.length / 2) * 3)
  for (let i = 0, j = 0; i < ll.length; i += 2, j += 3) {
    const v = toVec3(ll[i] / 100, ll[i + 1] / 100)
    out[j] = v.x; out[j + 1] = v.y; out[j + 2] = v.z
  }
  return out
}

export function buildRegionPoints(b: Pick<SavedBriefing, 'regionCounts' | 'keyDevelopments'>): RegionPoint[] {
  const points: RegionPoint[] = []
  for (const [name, count] of Object.entries(b.regionCounts)) {
    const geo = resolveRegion(name)
    if (!geo || count <= 0) continue
    const key = name.trim().toLowerCase()
    const stories = b.keyDevelopments.flatMap((d, i) =>
      d.regions.some((r) => r.trim().toLowerCase() === key)
        ? [{ anchorId: `dev-${i}`, title: d.title, timestamp: d.timestamp, sources: d.sources }]
        : [])
    points.push({ name, lat: geo.lat, lng: geo.lng, count, stories })
  }
  return points.sort((a, z) => z.count - a.count || a.name.localeCompare(z.name))
}

export function topRegion(points: RegionPoint[]): RegionPoint | null {
  return points[0] ?? null
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/globe/regions.test.ts`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/scripts frontend/src/globe frontend/package.json
git commit -m "feat(globe): build-time land points and region mapping

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Liquid-grain globe (engine, controls, view) replacing react-globe.gl

**Files:**
- Create: `frontend/src/globe/engine.ts`, `frontend/src/globe/controls.ts`, `frontend/src/globe/GlobeView.tsx`, `frontend/src/globe/Globe.tsx`, `frontend/src/globe/StaticGlobe.tsx`, `frontend/src/globe/globe.css`, `frontend/src/lib/useMediaQuery.ts`
- Modify: `frontend/src/routes/HomePage.tsx`, `frontend/src/routes/StoryTab.tsx`, `frontend/package.json`
- Delete: `frontend/src/components/GlobeHero.tsx`, `frontend/src/components/GlobeCanvas.tsx`, `frontend/src/components/globehero.css`

**Interfaces:**
- Consumes: Task 6 `decodeLandPoints`, `toVec3`, `topRegion`, `RegionPoint`, `LAND_POINTS_B64`; Task 2 `formatTime`.
- Produces:
  - `class GlobeEngine` with `onFrame: ((info: FrameInfo) => void) | null`, `setSize(w, h)`, `setPointer(ndc: { x: number; y: number } | null)`, `setHotspots(list: GlobeHotspot[])`, `focusOn(lat, lng)`, `rotateBy(dYaw, dPitch)`, `release(vYaw, vPitch)`, `setHold(on)`, `setScanning(on)`, `setRunning(on)`, `dispose()`. `FrameInfo = { hotspots: { x: number; y: number; visible: boolean }[]; readout: string | null }`.
  - `attachDrag(el: HTMLElement, engine: Pick<GlobeEngine, 'rotateBy' | 'release'>): () => void`
  - `Globe` component (main chunk) with `GlobeViewProps`: `{ mode: 'hero' | 'briefing'; label: string; regions?: RegionPoint[]; timeZone?: string; playIntro?: boolean; scanning?: boolean; onSelectStory?: (anchorId: string) => void }`
  - `useMediaQuery(query: string): boolean`, `usePrefersReducedMotion(): boolean`

The WebGL code has no unit tests (jsdom has no WebGL); it is verified by build, bundle size and the browser checklist in Step 11.

- [ ] **Step 1: Create `src/lib/useMediaQuery.ts`**

```ts
import { useCallback, useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {}
    const m = window.matchMedia(query)
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [query])
  return useSyncExternalStore(
    subscribe,
    () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches,
    () => false,
  )
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}
```

- [ ] **Step 2: Create `src/globe/engine.ts`**

```ts
// Particle globe renderer: grain land and ocean, liquid cursor response,
// pulsing hotspots, drag momentum and auto-spin. Framework-free; GlobeView
// owns its lifecycle and reads hotspot screen positions via onFrame.
import * as THREE from 'three'
import { LAND_POINTS_B64 } from './landPoints'
import { decodeLandPoints, toVec3 } from './regions'

export interface GlobeHotspot { lat: number; lng: number; count: number }
export interface HotspotScreen { x: number; y: number; visible: boolean }
export interface FrameInfo { hotspots: HotspotScreen[]; readout: string | null }
export interface EngineOptions { reducedMotion: boolean; playIntro: boolean; baseSpin: number }

const CAMERA_Z = 5
const BASE_PITCH = 0.32
const PITCH_LIMIT = 0.6
const IDLE_RESUME_MS = 4000
const INTRO_MS = 1900
const OCEAN_POINTS = 5200
const DEG = Math.PI / 180

const VERT = /* glsl */ `
  attribute vec3 aRand;
  uniform float uTime, uIntro, uHover, uSize, uPR, uAlpha, uLiquid;
  uniform vec3 uMouse;
  varying float vAlpha, vFall;
  void main() {
    vec3 p = position;
    float n = sin(p.x * 5.0 + uTime * 0.35) * sin(p.y * 6.0 - uTime * 0.27) * sin(p.z * 4.5 + uTime * 0.21);
    vec3 base = p * (1.0 + n * 0.018);
    float d = distance(p, uMouse);
    float fall = exp(-d * d / 0.03) * uHover * uLiquid;
    vec3 t = p - uMouse; t = t - p * dot(t, p);
    base += p * fall * 0.11 + normalize(t + 1e-5) * fall * 0.05;
    base += p * sin(d * 30.0 - uTime * 4.2) * exp(-d * 4.5) * 0.010 * uHover * uLiquid;
    float k = clamp(uIntro * 1.45 - aRand.y * 0.45, 0.0, 1.0);
    k = 1.0 - pow(1.0 - k, 3.0);
    vec3 scattered = normalize(p + (aRand - 0.5) * 2.4) * (1.7 + aRand.z * 1.6);
    vec3 pos = mix(scattered, base, k);
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    float facing = dot(normalize(wp.xyz), normalize(cameraPosition - wp.xyz));
    vAlpha = uAlpha * mix(0.55, 1.0, k) * smoothstep(-0.05, 0.45, facing);
    vFall = fall;
    vec4 mv = viewMatrix * wp;
    gl_PointSize = uSize * uPR * (1.0 + fall * 1.3) * (5.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`

const FRAG = /* glsl */ `
  uniform vec3 uColor, uHot;
  varying float vAlpha, vFall;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.18, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(uColor, uHot, clamp(vFall * 1.4, 0.0, 1.0)), a);
  }`

const HOT_VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime, uPR, uShow;
  varying float vPulse, vFace;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vFace = smoothstep(0.0, 0.3, dot(normalize(wp.xyz), normalize(cameraPosition - wp.xyz)));
    vPulse = fract(uTime * 0.45 + aSeed);
    vec4 mv = viewMatrix * wp;
    gl_PointSize = (22.0 + 26.0 * vPulse) * aSize * uPR * uShow;
    gl_Position = projectionMatrix * mv;
  }`

const HOT_FRAG = /* glsl */ `
  varying float vPulse, vFace;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.13, 0.09, d);
    float ringR = 0.12 + vPulse * 0.36;
    float ring = smoothstep(0.03, 0.0, abs(d - ringR)) * (1.0 - vPulse);
    float a = (core + ring * 0.8) * vFace;
    if (a < 0.01) discard;
    gl_FragColor = vec4(0.71, 0.325, 0.18, a);
  }`

interface Shared {
  uTime: THREE.IUniform<number>
  uIntro: THREE.IUniform<number>
  uHover: THREE.IUniform<number>
  uMouse: THREE.IUniform<THREE.Vector3>
  uPR: THREE.IUniform<number>
  uLiquid: THREE.IUniform<number>
}

/** A color whose components reach the shader as-is (our shaders do no color-space conversion). */
function rawColor(hex: number): THREE.Color {
  return new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace)
}

function randomSphere(n: number): Float32Array {
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u)
    out[i * 3] = s * Math.cos(th); out[i * 3 + 1] = u; out[i * 3 + 2] = s * Math.sin(th)
  }
  return out
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const fmtCoord = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`

export class GlobeEngine {
  onFrame: ((info: FrameInfo) => void) | null = null

  private readonly opts: EngineOptions
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
  private readonly globe = new THREE.Group()
  private readonly uniforms: Shared
  private readonly hotGeo = new THREE.BufferGeometry()
  private readonly hotMat: THREE.ShaderMaterial
  private readonly disposables: { dispose(): void }[] = []
  private readonly mouseLocal = new THREE.Vector3(9, 9, 9)
  private readonly ray = new THREE.Raycaster()
  private readonly sphere = new THREE.Sphere(new THREE.Vector3(), 1)
  private readonly hit = new THREE.Vector3()
  private hotVecs: THREE.Vector3[] = []
  private yaw = -0.6
  private pitch = BASE_PITCH
  private spinVel = 0
  private vyaw = 0
  private vpitch = 0
  private target: { yaw: number; pitch: number } | null = null
  private lastInteraction = -Infinity
  private hold = false
  private scanning = false
  private running = true
  private disposed = false
  private pointer: THREE.Vector2 | null = null
  private overSphere = false
  private width = 1
  private height = 1
  private raf = 0
  private last = performance.now()
  private readonly introStart = performance.now()
  private introDone: boolean

  constructor(canvas: HTMLCanvasElement, opts: EngineOptions) {
    this.opts = opts
    this.introDone = !opts.playIntro || opts.reducedMotion
    // Throws when WebGL is unavailable; GlobeView catches and shows StaticGlobe.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setClearColor(0x000000, 0)
    const pr = Math.min(window.devicePixelRatio || 1, 2)
    this.renderer.setPixelRatio(pr)
    this.camera.position.set(0, 0, CAMERA_Z)
    this.globe.rotation.order = 'XYZ'
    this.scene.add(this.globe)

    this.uniforms = {
      uTime: { value: 0 },
      uIntro: { value: this.introDone ? 1 : 0 },
      uHover: { value: 0 },
      uMouse: { value: this.mouseLocal.clone() },
      uPR: { value: pr },
      uLiquid: { value: opts.reducedMotion ? 0 : 1 },
    }

    const occluderGeo = new THREE.SphereGeometry(0.975, 48, 48)
    const occluderMat = new THREE.MeshBasicMaterial({ colorWrite: false })
    const occluder = new THREE.Mesh(occluderGeo, occluderMat)
    occluder.renderOrder = -1
    this.globe.add(occluder)
    this.disposables.push(occluderGeo, occluderMat)

    this.globe.add(this.cloud(randomSphere(OCEAN_POINTS), 0x9AAA92, 1.5, 0.5))
    this.globe.add(this.cloud(decodeLandPoints(LAND_POINTS_B64), 0x3D5A45, 2.5, 0.92))

    this.hotMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: this.uniforms.uTime, uPR: this.uniforms.uPR, uShow: { value: this.introDone ? 1 : 0 } },
      vertexShader: HOT_VERT,
      fragmentShader: HOT_FRAG,
    })
    this.disposables.push(this.hotGeo, this.hotMat)
    const hotPoints = new THREE.Points(this.hotGeo, this.hotMat)
    hotPoints.frustumCulled = false
    this.globe.add(hotPoints)

    this.raf = requestAnimationFrame(this.loop)
  }

  setSize(w: number, h: number): void {
    this.width = Math.max(1, w)
    this.height = Math.max(1, h)
    this.renderer.setSize(this.width, this.height, false)
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
  }

  setPointer(ndc: { x: number; y: number } | null): void {
    this.pointer = ndc ? new THREE.Vector2(ndc.x, ndc.y) : null
  }

  setHotspots(list: GlobeHotspot[]): void {
    const max = Math.max(1, ...list.map((h) => h.count))
    this.hotVecs = list.map((h) => {
      const v = toVec3(h.lat, h.lng, 1.012)
      return new THREE.Vector3(v.x, v.y, v.z)
    })
    this.hotGeo.setAttribute('position', new THREE.Float32BufferAttribute(this.hotVecs.flatMap((v) => [v.x, v.y, v.z]), 3))
    this.hotGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(list.map((h) => 0.7 + 0.6 * (h.count / max)), 1))
    this.hotGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(list.map((_, i) => i * 1.7), 1))
  }

  /** Ease the view so (lat, lng) faces the camera. */
  focusOn(lat: number, lng: number): void {
    this.target = { yaw: -lng * DEG, pitch: clamp(lat * DEG, -PITCH_LIMIT, PITCH_LIMIT) }
    this.lastInteraction = performance.now()
  }

  rotateBy(dYaw: number, dPitch: number): void {
    this.target = null
    this.yaw += dYaw
    this.pitch = clamp(this.pitch + dPitch, -PITCH_LIMIT, PITCH_LIMIT)
    this.spinVel = 0
    this.vyaw = 0
    this.vpitch = 0
    this.lastInteraction = performance.now()
  }

  release(vYaw: number, vPitch: number): void {
    this.vyaw = vYaw
    this.vpitch = vPitch
    this.lastInteraction = performance.now()
  }

  setHold(on: boolean): void { this.hold = on }
  setScanning(on: boolean): void { this.scanning = on }
  setRunning(on: boolean): void { this.running = on }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.onFrame = null
    for (const d of this.disposables) d.dispose()
    this.renderer.dispose()
  }

  private cloud(positions: Float32Array, color: number, size: number, alpha: number): THREE.Points {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const rnd = new Float32Array(positions.length)
    for (let i = 0; i < rnd.length; i++) rnd[i] = Math.random()
    geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 3))
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        ...this.uniforms,
        uSize: { value: size },
        uAlpha: { value: alpha },
        uColor: { value: rawColor(color) },
        uHot: { value: rawColor(0xB5532E) },
      },
    })
    this.disposables.push(geo, mat)
    return new THREE.Points(geo, mat)
  }

  private loop = (now: number): void => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    if (!this.running || document.hidden) return

    const u = this.uniforms
    u.uTime.value += dt
    if (!this.introDone) {
      const p = Math.min(1, (now - this.introStart) / INTRO_MS)
      u.uIntro.value = p
      if (p >= 1) this.introDone = true
    }
    const show = this.hotMat.uniforms.uShow as THREE.IUniform<number>
    show.value += ((u.uIntro.value > 0.85 ? 1 : 0) - show.value) * Math.min(1, dt * 5)

    const idle = !this.hold && !this.overSphere && now - this.lastInteraction > IDLE_RESUME_MS
    if (this.target) {
      const k = Math.min(1, dt * 3)
      const dy = wrapAngle(this.target.yaw - this.yaw)
      this.yaw += dy * k
      this.pitch += (this.target.pitch - this.pitch) * k
      if (Math.abs(dy) < 0.002 && Math.abs(this.target.pitch - this.pitch) < 0.002) this.target = null
    } else {
      this.yaw += this.vyaw * dt
      this.pitch += this.vpitch * dt
      const decay = Math.pow(0.05, dt)
      this.vyaw *= decay
      this.vpitch *= decay
      const want = this.opts.reducedMotion ? 0 : this.scanning ? 0.6 : idle ? this.opts.baseSpin : 0
      this.spinVel += (want - this.spinVel) * Math.min(1, dt * 2)
      this.yaw += this.spinVel * dt
    }
    this.pitch = clamp(this.pitch, -PITCH_LIMIT, PITCH_LIMIT)
    this.globe.rotation.set(this.pitch, this.yaw, 0)
    this.globe.updateMatrixWorld()

    this.overSphere = false
    let readout: string | null = null
    if (this.pointer) {
      this.ray.setFromCamera(this.pointer, this.camera)
      if (this.ray.ray.intersectSphere(this.sphere, this.hit)) {
        this.overSphere = true
        const local = this.globe.worldToLocal(this.hit.clone()).normalize()
        this.mouseLocal.lerp(local, 0.18)
        readout = `${fmtCoord(Math.asin(local.y) / DEG, 'N', 'S')}  ${fmtCoord(Math.atan2(local.x, local.z) / DEG, 'E', 'W')}`
      }
    }
    u.uHover.value += ((this.overSphere ? 1 : 0) - u.uHover.value) * Math.min(1, dt * 4)
    u.uMouse.value.copy(this.mouseLocal)

    const camDir = this.camera.position.clone().normalize()
    const hotspots = this.hotVecs.map((v) => {
      const w = v.clone().applyMatrix4(this.globe.matrixWorld)
      const visible = w.clone().normalize().dot(camDir) > 0.2 && show.value > 0.5
      w.project(this.camera)
      return { x: ((w.x + 1) / 2) * this.width, y: ((1 - w.y) / 2) * this.height, visible }
    })

    this.renderer.render(this.scene, this.camera)
    this.onFrame?.({ hotspots, readout })
  }
}
```

- [ ] **Step 3: Create `src/globe/controls.ts`**

```ts
import type { GlobeEngine } from './engine'

const SENSITIVITY = 0.005 // radians per pixel
const MAX_FLING = 6 // radians per second

/** Pointer-drag rotation with momentum. Returns a cleanup function. */
export function attachDrag(el: HTMLElement, engine: Pick<GlobeEngine, 'rotateBy' | 'release'>): () => void {
  let dragging = false
  let pointerId = -1
  let lastX = 0, lastY = 0, lastT = 0, vx = 0, vy = 0

  const down = (e: PointerEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button, a, .globe-panel')) return
    dragging = true
    pointerId = e.pointerId
    el.setPointerCapture(pointerId)
    lastX = e.clientX; lastY = e.clientY; lastT = performance.now()
    vx = 0; vy = 0
    el.classList.add('dragging')
  }
  const move = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pointerId) return
    const now = performance.now()
    const dt = Math.max(1, now - lastT) / 1000
    const dx = (e.clientX - lastX) * SENSITIVITY
    const dy = (e.clientY - lastY) * SENSITIVITY
    engine.rotateBy(dx, dy)
    vx = dx / dt; vy = dy / dt
    lastX = e.clientX; lastY = e.clientY; lastT = now
  }
  const up = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pointerId) return
    dragging = false
    try { el.releasePointerCapture(pointerId) } catch { /* already released */ }
    el.classList.remove('dragging')
    const stale = performance.now() - lastT > 80
    const clampFling = (v: number) => Math.max(-MAX_FLING, Math.min(MAX_FLING, v))
    engine.release(stale ? 0 : clampFling(vx), stale ? 0 : clampFling(vy))
  }

  el.addEventListener('pointerdown', down)
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
  return () => {
    el.removeEventListener('pointerdown', down)
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
  }
}
```

- [ ] **Step 4: Create `src/globe/StaticGlobe.tsx`**

```tsx
import type { RegionPoint } from './regions'

/** Shown while the globe chunk loads and when WebGL is unavailable. */
export function StaticGlobe({ label, regions = [], onSelectStory }: {
  label: string
  regions?: RegionPoint[]
  onSelectStory?: (anchorId: string) => void
}) {
  return (
    <div className="globe-static">
      <div className="globe-static-disc" role="img" aria-label={label} />
      {regions.length > 0 && (
        <ul className="globe-static-list">
          {regions.map((r) => (
            <li key={r.name}>
              <span className="label">{r.name} · {r.count}</span>
              <ul>
                {r.stories.map((s) => (
                  <li key={s.anchorId}>
                    <button type="button" className="link-button" onClick={() => onSelectStory?.(s.anchorId)}>{s.title}</button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create `src/globe/GlobeView.tsx`**

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { formatTime } from '../lib/time'
import { usePrefersReducedMotion } from '../lib/useMediaQuery'
import { attachDrag } from './controls'
import { GlobeEngine, type GlobeHotspot } from './engine'
import { topRegion, type RegionPoint } from './regions'
import { StaticGlobe } from './StaticGlobe'
import './globe.css'

// Decorative hero points: Bab el-Mandeb, Suez, Rotterdam, Singapore.
const HERO_HOTSPOTS: GlobeHotspot[] = [
  { lat: 12.6, lng: 43.3, count: 3 },
  { lat: 30.0, lng: 32.5, count: 2 },
  { lat: 51.9, lng: 4.4, count: 2 },
  { lat: 1.3, lng: 103.8, count: 2 },
]
const NO_REGIONS: RegionPoint[] = []
const CLOSE_DELAY_MS = 160
const LABELED_COUNT = 5

export interface GlobeViewProps {
  mode: 'hero' | 'briefing'
  label: string
  regions?: RegionPoint[]
  timeZone?: string
  playIntro?: boolean
  scanning?: boolean
  onSelectStory?: (anchorId: string) => void
}

export default function GlobeView({
  mode, label, regions = NO_REGIONS, timeZone = 'auto', playIntro = false, scanning = false, onSelectStory,
}: GlobeViewProps) {
  const reduced = usePrefersReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const hotRefs = useRef<(HTMLButtonElement | null)[]>([])
  const engineRef = useRef<GlobeEngine | null>(null)
  const size = useRef({ w: 1, h: 1 })
  const live = useRef({ active: null as number | null, pinned: false })
  const closeTimer = useRef(0)
  const playIntroRef = useRef(playIntro)
  const [engineVersion, setEngineVersion] = useState(0)
  const [failed, setFailed] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  const [pinned, setPinned] = useState(false)

  const spots: GlobeHotspot[] = mode === 'hero' ? HERO_HOTSPOTS : regions.map((r) => ({ lat: r.lat, lng: r.lng, count: r.count }))
  const spotsKey = spots.map((s) => `${s.lat},${s.lng},${s.count}`).join('|')

  useEffect(() => {
    live.current.active = active
    live.current.pinned = pinned
  }, [active, pinned])

  // Create the engine. Recreated only when the mode or reduced-motion preference changes.
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    let engine: GlobeEngine
    try {
      engine = new GlobeEngine(canvas, { reducedMotion: reduced, playIntro: playIntroRef.current, baseSpin: mode === 'hero' ? 0.045 : 0.03 })
    } catch {
      setFailed(true)
      return
    }
    engineRef.current = engine

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      size.current = { w: width, h: height }
      engine.setSize(width, height)
    })
    ro.observe(wrap)
    const io = new IntersectionObserver(([entry]) => engine.setRunning(entry.isIntersecting))
    io.observe(wrap)
    const detach = attachDrag(wrap, engine)
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      engine.setPointer({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 })
    }
    const onLeave = () => engine.setPointer(null)
    wrap.addEventListener('pointermove', onMove, { passive: true })
    wrap.addEventListener('pointerleave', onLeave)

    engine.onFrame = ({ hotspots }) => {
      hotspots.forEach((h, i) => {
        const el = hotRefs.current[i]
        if (!el) return
        el.style.transform = `translate3d(${h.x.toFixed(1)}px, ${h.y.toFixed(1)}px, 0)`
        el.dataset.visible = String(h.visible)
      })
      const panel = panelRef.current
      const a = live.current.active
      if (panel && a !== null && hotspots[a]) {
        const h = hotspots[a]
        const flipX = h.x > size.current.w * 0.55
        const flipY = h.y > size.current.h * 0.6
        panel.style.transform =
          `translate3d(${(flipX ? h.x - 18 : h.x + 18).toFixed(1)}px, ${(flipY ? h.y + 12 : h.y - 12).toFixed(1)}px, 0) ` +
          `translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})`
        panel.dataset.visible = String(h.visible || live.current.pinned)
      }
    }
    setEngineVersion((v) => v + 1)

    return () => {
      ro.disconnect()
      io.disconnect()
      detach()
      wrap.removeEventListener('pointermove', onMove)
      wrap.removeEventListener('pointerleave', onLeave)
      engine.dispose()
      engineRef.current = null
    }
  }, [mode, reduced])

  // Push hotspots whenever they change (or the engine was recreated).
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.setHotspots(spots)
    hotRefs.current.length = spots.length
    const top = mode === 'briefing' ? topRegion(regions) : null
    if (top) engine.focusOn(top.lat, top.lng)
    setActive(null)
    setPinned(false)
    // spots and regions are read through spotsKey, which changes whenever they do.
  }, [spotsKey, engineVersion, mode])

  useEffect(() => { engineRef.current?.setScanning(scanning) }, [scanning, engineVersion])
  useEffect(() => { engineRef.current?.setHold(pinned) }, [pinned, engineVersion])

  const open = useCallback((i: number) => {
    window.clearTimeout(closeTimer.current)
    setActive(i)
  }, [])
  const scheduleClose = useCallback(() => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setActive(null), CLOSE_DELAY_MS)
  }, [])
  const closeAll = useCallback(() => {
    window.clearTimeout(closeTimer.current)
    setPinned(false)
    setActive(null)
  }, [])
  const togglePin = (i: number) => {
    window.clearTimeout(closeTimer.current)
    if (pinned && active === i) closeAll()
    else {
      setActive(i)
      setPinned(true)
    }
  }
  const select = (anchorId: string) => {
    closeAll()
    onSelectStory?.(anchorId)
  }

  useEffect(() => {
    if (!pinned) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAll() }
    const onDown = (e: PointerEvent) => { if (!wrapRef.current?.contains(e.target as Node)) closeAll() }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [pinned, closeAll])

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  if (failed) return <StaticGlobe label={label} regions={mode === 'briefing' ? regions : []} onSelectStory={onSelectStory} />

  const current = active !== null ? regions[active] : undefined

  return (
    <div className={`globe-view globe-${mode}`} ref={wrapRef}>
      <canvas ref={canvasRef} className="globe-canvas" role="img" aria-label={label} />
      {mode === 'briefing' && (
        <>
          <div className="globe-hotspots">
            {regions.map((r, i) => (
              <button
                key={r.name}
                ref={(el) => { hotRefs.current[i] = el }}
                type="button"
                className={`globe-hotspot ${i < LABELED_COUNT ? 'labeled' : ''}`}
                data-visible="false"
                data-cursor="link"
                aria-label={`${r.name}, ${r.count} mention${r.count === 1 ? '' : 's'}. Show stories.`}
                aria-expanded={active === i}
                aria-controls="globe-panel"
                onPointerEnter={() => { if (!pinned) open(i) }}
                onPointerLeave={() => { if (!pinned) scheduleClose() }}
                onFocus={() => { if (!pinned) open(i) }}
                onBlur={(e) => { if (!pinned && !wrapRef.current?.contains(e.relatedTarget as Node)) scheduleClose() }}
                onClick={() => togglePin(i)}
              >
                <span className="globe-hotspot-label label">{r.name}<b>{r.count}</b></span>
              </button>
            ))}
          </div>
          {current && (
            <div
              id="globe-panel"
              ref={panelRef}
              className="globe-panel"
              data-visible="false"
              role="dialog"
              aria-label={`Stories in ${current.name}`}
              onPointerEnter={() => window.clearTimeout(closeTimer.current)}
              onPointerLeave={() => { if (!pinned) scheduleClose() }}
            >
              <div className="globe-panel-head label">
                <span>{current.name}</span>
                <span>{current.count} mention{current.count === 1 ? '' : 's'}</span>
              </div>
              {current.stories.length > 0 ? (
                <ul>
                  {current.stories.map((s) => (
                    <li key={s.anchorId}>
                      <button type="button" onClick={() => select(s.anchorId)} data-cursor="link">
                        <span className="gp-title">{s.title}</span>
                        <span className="gp-meta mono">
                          {formatTime(s.timestamp, timeZone)}
                          {s.sources.length > 0 && ` · ${s.sources.slice(0, 3).map((x) => x.outlet).join(', ')}`}
                          {s.sources.length > 3 && ` +${s.sources.length - 3}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="gp-none">Tagged in this briefing's regions without a linked story.</p>
              )}
              {pinned && <p className="gp-hint label">Pinned · Esc to close</p>}
            </div>
          )}
          <div className="visually-hidden">
            <h3>Regions on the globe</h3>
            {regions.length === 0 ? (
              <p>No mapped regions in this briefing.</p>
            ) : (
              <ul>
                {regions.map((r) => (
                  <li key={r.name}>
                    {r.name}, {r.count} mention{r.count === 1 ? '' : 's'}
                    <ul>
                      {r.stories.map((s) => (
                        <li key={s.anchorId}><button type="button" onClick={() => select(s.anchorId)}>{s.title}</button></li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Create `src/globe/Globe.tsx`**

```tsx
import { Suspense, lazy } from 'react'
import type { GlobeViewProps } from './GlobeView'
import { StaticGlobe } from './StaticGlobe'

// three.js and the land data live in this lazy chunk; pages without a globe never load them.
const GlobeView = lazy(() => import('./GlobeView'))

export function Globe(props: GlobeViewProps) {
  return (
    <Suspense fallback={<StaticGlobe label={props.label} />}>
      <GlobeView {...props} />
    </Suspense>
  )
}
```

- [ ] **Step 7: Create `src/globe/globe.css`**

```css
.globe-view { position: relative; width: 100%; aspect-ratio: 1; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
.globe-view.dragging { cursor: grabbing; }
.globe-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }

.globe-hotspots { position: absolute; inset: 0; pointer-events: none; }
.globe-hotspot {
  position: absolute;
  left: 0;
  top: 0;
  width: 30px;
  height: 30px;
  margin: -15px 0 0 -15px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  pointer-events: auto;
  transition: opacity var(--dur-mid);
}
.globe-hotspot[data-visible="false"] { opacity: 0; pointer-events: none; }
.globe-hotspot:focus-visible { outline: 2px solid var(--terra); outline-offset: 2px; }
.globe-hotspot-label {
  position: absolute;
  left: 26px;
  top: 50%;
  transform: translateY(-50%);
  display: none;
  gap: 6px;
  align-items: center;
  white-space: nowrap;
  color: var(--ink);
  pointer-events: none;
}
.globe-hotspot-label b { color: var(--terra-ink); font-weight: 500; }
.globe-hotspot.labeled .globe-hotspot-label,
.globe-hotspot:hover .globe-hotspot-label,
.globe-hotspot:focus-visible .globe-hotspot-label,
.globe-hotspot[aria-expanded="true"] .globe-hotspot-label { display: flex; }

.globe-panel {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 3;
  width: min(320px, 82%);
  padding: 14px 16px;
  background: var(--paper);
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px var(--rule), 0 24px 50px -28px rgba(50, 40, 20, 0.5);
  transition: opacity 0.2s;
}
.globe-panel[data-visible="false"] { opacity: 0; pointer-events: none; }
.globe-panel-head { display: flex; justify-content: space-between; gap: 12px; color: var(--terra-ink); margin-bottom: 8px; }
.globe-panel ul { list-style: none; display: grid; gap: 2px; }
.globe-panel li button {
  display: grid;
  gap: 2px;
  width: 100%;
  padding: 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
}
.globe-panel li button:hover,
.globe-panel li button:focus-visible { background: var(--oat); }
.gp-title { font-weight: 600; font-size: 0.92rem; line-height: 1.3; color: var(--ink); }
.gp-meta { font-size: 0.72rem; color: var(--ink-3); }
.gp-none { font-size: 0.86rem; color: var(--ink-3); }
.gp-hint { margin-top: 8px; color: var(--ink-3); }

.globe-static { display: grid; gap: 20px; }
.globe-static-disc {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(rgba(61, 90, 69, 0.35) 1px, transparent 1.5px) 0 0 / 9px 9px,
    radial-gradient(circle at 35% 30%, var(--paper), var(--oat-deep) 72%);
  box-shadow: inset 0 0 0 1px var(--rule);
}
.globe-static-list { list-style: none; display: grid; gap: 14px; }
.globe-static-list ul { list-style: none; display: grid; gap: 4px; margin-top: 6px; }
.link-button {
  border: 0;
  background: none;
  padding: 0;
  text-align: left;
  text-decoration: underline;
  text-decoration-color: var(--sand);
  text-underline-offset: 3px;
}
```

- [ ] **Step 8: Use the globe on Home and Story**

In `src/routes/HomePage.tsx`: replace `import { GlobeHero } from '../components/GlobeHero'` with `import { Globe } from '../globe/Globe'`, and replace `<GlobeHero regionCounts={null} />` with:

```tsx
          <Globe
            mode="hero"
            scanning={loading}
            label="A globe of the world drawn in fine grain, slowly turning."
          />
```

In `src/routes/StoryTab.tsx`: replace the imports of `useMemo` and `GlobeHero` and the `anchors` block so the file reads:

```tsx
import { useCallback, useMemo } from 'react'
import { Contradictions } from '../components/briefing/Contradictions'
import { KeyDevelopments } from '../components/briefing/KeyDevelopments'
import { PriorityAlerts } from '../components/briefing/PriorityAlerts'
import { ReadingList } from '../components/briefing/ReadingList'
import { Tensions } from '../components/briefing/Tensions'
import '../components/briefing/briefing.css'
import { Globe } from '../globe/Globe'
import { buildRegionPoints } from '../globe/regions'
import { usePrefersReducedMotion } from '../lib/useMediaQuery'
import { usePrintOnLoad } from '../lib/usePrintOnLoad'
import { useSettings } from '../state/hooks'
import { useBriefing } from './briefingContext'

export function StoryTab() {
  const briefing = useBriefing()
  const { settings } = useSettings()
  const reduced = usePrefersReducedMotion()
  usePrintOnLoad()
  const regions = useMemo(() => buildRegionPoints(briefing), [briefing])
  const scrollToStory = useCallback((anchorId: string) => {
    document.getElementById(anchorId)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
  }, [reduced])
  const developments = settings.showHistoricalContext
    ? briefing.keyDevelopments
    : briefing.keyDevelopments.map((d) => ({ ...d, historicalContext: '' }))
  return (
    <div className="story wrap">
      <div className="story-globe">
        <Globe
          mode="briefing"
          regions={regions}
          timeZone={settings.timeZone}
          onSelectStory={scrollToStory}
          label={`Globe marking ${regions.length} region${regions.length === 1 ? '' : 's'} from this briefing. Hover or focus a point to see its stories.`}
        />
      </div>
      <PriorityAlerts alerts={briefing.alerts} />
      <KeyDevelopments developments={developments} />
      <Tensions tensions={briefing.emergingTensions} />
      <Contradictions contradictions={briefing.contradictions} />
      <ReadingList readings={briefing.readingList} />
    </div>
  )
}
```

- [ ] **Step 9: Remove react-globe.gl and the old globe**

Run (real path):

```bash
npm uninstall react-globe.gl
npm install -D world-atlas topojson-client
git rm src/components/GlobeHero.tsx src/components/GlobeCanvas.tsx src/components/globehero.css
```

Expected: `react-globe.gl` gone from dependencies; `world-atlas` and `topojson-client` now under devDependencies (only the build script uses them). `three` stays in dependencies.

- [ ] **Step 10: Build, lint, test and measure**

Run (real path): `npm run build && npm run lint`
Expected: success, no new warnings. Then:

```bash
for f in dist/assets/*.js; do printf "%s %s KB gzip\n" "$f" "$(( $(gzip -c "$f" | wc -c) / 1024 ))"; done
```

Expected: a `GlobeView-*.js` chunk between 150 and 200 KB gzip; no remaining ~570 KB `GlobeCanvas` chunk.
Run tests: `npx vitest run` — all pass.

- [ ] **Step 11: Browser checklist** (`npm run dev`)

- Home: grain globe renders in moss and sage on oat, slowly spinning; hovering it makes the grain ripple and push away and tint terracotta; spin slows while hovering; drag rotates with momentum; vertical page scroll still works on a touch device.
- Open a briefing: the globe eases to the busiest region; terracotta hotspots pulse; the top five show labels.
- Hover a hotspot: the panel lists that region's stories with times in your time zone and source names; moving the pointer into the panel keeps it open; clicking a story scrolls to its card.
- Click a hotspot: it pins (auto-spin stops); Escape or clicking outside unpins.
- Tab reaches each hotspot; focus opens its panel.
- In DevTools, disable WebGL (or block `GlobeView-*.js`): the static disc appears instead of a crash.
- With reduced motion on: no spin, no liquid response; drag still works.

- [ ] **Step 12: Commit**

```bash
git add -A frontend
git commit -m "feat(globe): custom liquid-grain three.js globe with region hotspot panels

Replaces react-globe.gl; globe chunk drops from ~580 KB to under 200 KB gzip.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Timeline ordering and branch linking (`lib/timeline.ts`)

**Files:**
- Create: `frontend/src/lib/timeline.ts`
- Test: `frontend/src/lib/timeline.test.ts`

**Interfaces:**
- Consumes: `SavedBriefing`, `ViewDevelopment` from normalize; Task 3 `makeBriefing`.
- Produces:
  - `interface TimelineEntry { index: number; dev: ViewDevelopment; time: number | null }`
  - `sortDevelopments(devs: ViewDevelopment[]): TimelineEntry[]` (ascending time; untimed last; ties keep original order)
  - `mentionsRegion(text: string, region: string): boolean` (case-insensitive, whole word, Unicode-aware, regex-safe)
  - `interface BriefingLinks { tensions: number[][]; contradictions: number[][] }` (development indexes per item)
  - `linkBriefing(b: Pick<SavedBriefing, 'keyDevelopments' | 'emergingTensions' | 'contradictions'>): BriefingLinks`
  - `firstLinkedRow(devIndexes: number[], order: TimelineEntry[]): number | null` (smallest row position among linked developments)

- [ ] **Step 1: Write the failing tests** `src/lib/timeline.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { makeBriefing } from '../test/fixtures'
import type { ViewDevelopment } from './normalize'
import { firstLinkedRow, linkBriefing, mentionsRegion, sortDevelopments } from './timeline'

const dev = (timestamp: string, title = timestamp): ViewDevelopment => ({
  title, content: '', historicalContext: '', priority: 'low', regions: [], sources: [], timestamp,
})

describe('sortDevelopments', () => {
  it('orders by time, oldest first, keeping original indexes', () => {
    const order = sortDevelopments([dev('2026-10-16T09:00:00Z'), dev('2026-10-16T03:00:00Z'), dev('2026-10-16T06:00:00Z')])
    expect(order.map((e) => e.index)).toEqual([1, 2, 0])
  })
  it('puts missing or invalid timestamps last in original order', () => {
    const order = sortDevelopments([dev(''), dev('2026-10-16T06:00:00Z'), dev('garbage'), dev('2026-10-16T01:00:00Z')])
    expect(order.map((e) => e.index)).toEqual([3, 1, 0, 2])
    expect(order[2].time).toBeNull()
  })
  it('keeps original order for equal times', () => {
    const t = '2026-10-16T06:00:00Z'
    expect(sortDevelopments([dev(t, 'a'), dev(t, 'b')]).map((e) => e.dev.title)).toEqual(['a', 'b'])
  })
})

describe('mentionsRegion', () => {
  it('matches whole words case-insensitively', () => {
    expect(mentionsRegion('Strike off yemen today', 'Yemen')).toBe(true)
    expect(mentionsRegion('Talks in Tirana', 'Iran')).toBe(false)
  })
  it('handles regex characters in region names', () => {
    expect(mentionsRegion('A U.S. destroyer responded', 'U.S.')).toBe(true)
    expect(mentionsRegion('US forces', 'U.S.')).toBe(false)
    expect(() => mentionsRegion('anything', 'a(b')).not.toThrow()
  })
  it('handles diacritics and punctuation around the name', () => {
    expect(mentionsRegion("Exports from Côte d'Ivoire rose", "Côte d'Ivoire")).toBe(true)
    expect(mentionsRegion('Aid convoy (Gaza) delayed', 'Gaza')).toBe(true)
  })
  it('never matches an empty region', () => {
    expect(mentionsRegion('anything', '  ')).toBe(false)
    expect(mentionsRegion('', 'Egypt')).toBe(false)
  })
})

describe('linkBriefing', () => {
  it('links tensions and contradictions to developments sharing a region', () => {
    expect(linkBriefing(makeBriefing())).toEqual({
      tensions: [[0], [2], []],
      contradictions: [[0]],
    })
  })
  it('links one item to several developments', () => {
    const b = makeBriefing()
    b.emergingTensions[0] = { ...b.emergingTensions[0], description: 'Red Sea escorts strained.' }
    expect(linkBriefing(b).tensions[0]).toEqual([0, 1])
  })
})

describe('firstLinkedRow', () => {
  it('returns the earliest row among linked developments', () => {
    const order = sortDevelopments([dev('2026-10-16T09:00:00Z'), dev('2026-10-16T03:00:00Z')])
    expect(firstLinkedRow([0, 1], order)).toBe(0) // index 1 sits in row 0
    expect(firstLinkedRow([0], order)).toBe(1)
    expect(firstLinkedRow([], order)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/timeline.test.ts`
Expected: FAIL, "Failed to resolve import ./timeline".

- [ ] **Step 3: Write `src/lib/timeline.ts`**

```ts
// Story-tab logic: chronological order and which tensions/contradictions
// relate to which developments. Links require a shared region by name;
// anything unmatched is shown separately, never attached at random.
import type { SavedBriefing, ViewDevelopment } from './normalize'

export interface TimelineEntry {
  index: number
  dev: ViewDevelopment
  time: number | null
}

export function sortDevelopments(devs: ViewDevelopment[]): TimelineEntry[] {
  return devs
    .map((dev, index) => {
      const t = Date.parse(dev.timestamp)
      return { index, dev, time: Number.isNaN(t) ? null : t }
    })
    .sort((a, b) => {
      if (a.time === null || b.time === null) {
        if (a.time === b.time) return a.index - b.index
        return a.time === null ? 1 : -1
      }
      return a.time - b.time || a.index - b.index
    })
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function mentionsRegion(text: string, region: string): boolean {
  const name = region.trim()
  if (!name || !text) return false
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(name)}(?=$|[^\\p{L}\\p{N}])`, 'iu')
  return pattern.test(text)
}

export interface BriefingLinks {
  tensions: number[][]
  contradictions: number[][]
}

export function linkBriefing(
  b: Pick<SavedBriefing, 'keyDevelopments' | 'emergingTensions' | 'contradictions'>,
): BriefingLinks {
  const match = (text: string) =>
    b.keyDevelopments.flatMap((d, i) => (d.regions.some((r) => mentionsRegion(text, r)) ? [i] : []))
  return {
    tensions: b.emergingTensions.map((t) => match(`${t.actors} ${t.description}`)),
    contradictions: b.contradictions.map((c) => match(`${c.topic} ${c.account_a} ${c.account_b}`)),
  }
}

export function firstLinkedRow(devIndexes: number[], order: TimelineEntry[]): number | null {
  let best: number | null = null
  order.forEach((entry, row) => {
    if (devIndexes.includes(entry.index) && (best === null || row < best)) best = row
  })
  return best
}
```

Note on the `U.S.` vs `US` test: `escapeRegExp` turns the dots into literal dots, so `US` does not match `U.S.`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/timeline.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/timeline.ts frontend/src/lib/timeline.test.ts
git commit -m "feat(story): chronological ordering and region-based branch linking

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Story tab timeline UI

**Files:**
- Create: `frontend/src/components/briefing/Timeline.tsx`, `DevelopmentCard.tsx`, `LinkedCards.tsx`, `AlertCallout.tsx`, `PriorityMark.tsx`, `story.css`
- Rewrite: `frontend/src/components/briefing/ReadingList.tsx`, `frontend/src/components/briefing/SourceChips.tsx`, `frontend/src/routes/StoryTab.tsx`
- Delete: `frontend/src/components/briefing/KeyDevelopments.tsx`, `Tensions.tsx`, `Contradictions.tsx`, `PriorityAlerts.tsx`, `briefing.css`

**Interfaces:**
- Consumes: Task 8 `sortDevelopments`, `linkBriefing`, `firstLinkedRow`; Task 2 `formatTime`, `UNKNOWN_TIME`; Task 7 `Globe`; Task 6 `buildRegionPoints`.
- Produces: `Timeline` props `{ briefing: SavedBriefing; timeZone: string; showContext: boolean; reduced: boolean }`. Development cards keep `id="dev-N"` with N = original index; linked cards use `id="link-tension-N"` / `id="link-contradiction-N"`.

- [ ] **Step 1: Create `PriorityMark.tsx`**

```tsx
type Priority = 'high' | 'medium' | 'low'

const LABELS: Record<Priority, string> = { high: 'High priority', medium: 'Medium priority', low: 'Low priority' }

/** Shape plus text, so severity never depends on color alone. */
export function PriorityMark({ priority, label }: { priority: Priority; label?: string }) {
  return (
    <span className={`prio prio-${priority} label`}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        {priority === 'high' && <path d="M5 0.5 L9.6 9.5 H0.4 Z" />}
        {priority === 'medium' && <rect x="1" y="1" width="8" height="8" />}
        {priority === 'low' && <circle cx="5" cy="5" r="3.8" strokeWidth="1.6" />}
      </svg>
      {label ?? LABELS[priority]}
    </span>
  )
}
```

- [ ] **Step 2: Rewrite `SourceChips.tsx`**

```tsx
import type { SourceCitation } from '../../lib/types'
import { relativeTime } from '../../lib/relativeTime'
import { ExternalIcon } from '../icons'

export function SourceChips({ sources }: { sources: SourceCitation[] }) {
  if (!sources.length) return null
  return (
    <ul className="source-chips" aria-label="Sources">
      {sources.map((s, i) => (
        <li key={`${s.url}-${i}`}>
          <a className="source-chip" href={s.url} target="_blank" rel="noopener noreferrer" data-cursor="link">
            <span>{s.outlet}</span>
            {s.published_at && <span className="source-chip-time mono">{relativeTime(s.published_at)}</span>}
            <ExternalIcon size={11} className="source-chip-ext" />
          </a>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: Create `DevelopmentCard.tsx`**

```tsx
import type { CSSProperties } from 'react'
import type { ViewDevelopment } from '../../lib/normalize'
import { PriorityMark } from './PriorityMark'
import { SourceChips } from './SourceChips'

export function DevelopmentCard({ dev, index, showContext, style }: {
  dev: ViewDevelopment
  index: number
  showContext: boolean
  style?: CSSProperties
}) {
  const titleId = `dev-${index}-title`
  return (
    <article className="dev" id={`dev-${index}`} style={style} aria-labelledby={titleId}>
      <div className="dev-top">
        <PriorityMark priority={dev.priority} />
        {dev.regions.length > 0 && (
          <ul className="tags label" aria-label="Regions">
            {dev.regions.map((r) => <li key={r}>{r}</li>)}
          </ul>
        )}
      </div>
      <h3 id={titleId} className="dev-title">{dev.title}</h3>
      <p className="dev-body">{dev.content}</p>
      {showContext && dev.historicalContext && (
        <p className="dev-context">
          <span className="label">From the archive</span>
          {dev.historicalContext}
        </p>
      )}
      <SourceChips sources={dev.sources} />
    </article>
  )
}
```

- [ ] **Step 4: Create `LinkedCards.tsx`**

```tsx
import type { ViewTension } from '../../lib/normalize'
import type { Contradiction } from '../../lib/types'
import { SourceChips } from './SourceChips'

const LEVELS: Record<ViewTension['level'], string> = { high: 'High', medium: 'Medium', low: 'Low' }

export function TensionCard({ id, tension }: { id: string; tension: ViewTension }) {
  return (
    <article className="link-card" id={id}>
      <p className="link-kind label"><span>Emerging tension</span><span>{LEVELS[tension.level]}</span></p>
      <h3 className="link-title">{tension.actors}</h3>
      <p className="link-body">{tension.description}</p>
      <SourceChips sources={tension.sources} />
    </article>
  )
}

export function ContradictionCard({ id, contradiction }: { id: string; contradiction: Contradiction }) {
  return (
    <article className="link-card contra" id={id}>
      <p className="link-kind label"><span>Sources disagree</span><span>2 accounts</span></p>
      <h3 className="link-title">{contradiction.topic}</h3>
      <div className="contra-accounts">
        <div>
          <span className="label">Account A</span>
          <p className="link-body">{contradiction.account_a}</p>
          <SourceChips sources={contradiction.sources_a} />
        </div>
        <div>
          <span className="label">Account B</span>
          <p className="link-body">{contradiction.account_b}</p>
          <SourceChips sources={contradiction.sources_b} />
        </div>
      </div>
    </article>
  )
}
```

- [ ] **Step 5: Create `AlertCallout.tsx`**

```tsx
import type { ViewAlert } from '../../lib/normalize'
import { PriorityMark } from './PriorityMark'
import { SourceChips } from './SourceChips'

const PRIORITY: Record<ViewAlert['type'], 'high' | 'medium' | 'low'> = { urgent: 'high', warning: 'medium', info: 'low' }

export function AlertCallout({ alerts }: { alerts: ViewAlert[] }) {
  if (!alerts.length) return <p className="story-note">No priority alerts in this briefing.</p>
  return (
    <section className="alerts" aria-labelledby="alerts-h">
      <h2 id="alerts-h" className="section-label label">Priority alerts · read first</h2>
      <ul className="alert-list">
        {alerts.map((a, i) => (
          <li key={`${a.title}-${i}`} className={`alert alert-${a.type}`}>
            <PriorityMark priority={PRIORITY[a.type]} label={a.label} />
            <h3 className="alert-title">{a.title}</h3>
            <p className="alert-body">{a.description}</p>
            <SourceChips sources={a.sources} />
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 6: Rewrite `ReadingList.tsx`**

```tsx
import type { ViewReading } from '../../lib/normalize'
import { ExternalIcon } from '../icons'

export function ReadingList({ readings }: { readings: ViewReading[] }) {
  if (!readings.length) return null
  return (
    <section className="reading" aria-labelledby="reading-h">
      <h2 id="reading-h" className="section-label label">Read next</h2>
      <ol className="reading-list">
        {readings.map((r, i) => (
          <li key={`${r.link}-${i}`} className="reading-item">
            <span className="reading-index label">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <a className="reading-title" href={r.link} target="_blank" rel="noopener noreferrer" data-cursor="link">
                {r.title} <ExternalIcon size={12} />
              </a>
              <p className="reading-meta"><span className="label">{r.publication}</span> {r.why}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
```

- [ ] **Step 7: Create `Timeline.tsx`**

```tsx
import { Fragment, useLayoutEffect, useMemo, useRef } from 'react'
import type { SavedBriefing } from '../../lib/normalize'
import { formatTime, UNKNOWN_TIME } from '../../lib/time'
import { firstLinkedRow, linkBriefing, sortDevelopments } from '../../lib/timeline'
import { DevelopmentCard } from './DevelopmentCard'
import { ContradictionCard, TensionCard } from './LinkedCards'

const SVG_NS = 'http://www.w3.org/2000/svg'
const READING_LINE = 0.6 // fraction of viewport height

interface LinkedItem { key: string; kind: 'tension' | 'contradiction'; i: number }
interface Branch { from: string; to: string }

export function Timeline({ briefing, timeZone, showContext, reduced }: {
  briefing: SavedBriefing
  timeZone: string
  showContext: boolean
  reduced: boolean
}) {
  const order = useMemo(() => sortDevelopments(briefing.keyDevelopments), [briefing])
  const links = useMemo(() => linkBriefing(briefing), [briefing])

  // Each linked card sits in the row of its earliest related development.
  const { byRow, unlinked, branches } = useMemo(() => {
    const byRow = new Map<number, LinkedItem[]>()
    const unlinked: LinkedItem[] = []
    const branches: Branch[] = []
    const place = (kind: LinkedItem['kind'], list: number[][]) => {
      list.forEach((devs, i) => {
        const item = { key: `${kind}-${i}`, kind, i }
        const row = firstLinkedRow(devs, order)
        if (row === null) {
          unlinked.push(item)
          return
        }
        byRow.set(row, [...(byRow.get(row) ?? []), item])
        for (const d of devs) branches.push({ from: `dev-${d}`, to: `link-${item.key}` })
      })
    }
    place('tension', links.tensions)
    place('contradiction', links.contradictions)
    return { byRow, unlinked, branches }
  }, [links, order])

  const rootRef = useRef<HTMLDivElement>(null)
  const spineRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current, spine = spineRef.current, svg = svgRef.current
    if (!root || !spine || !svg) return
    let alive = true
    let raf = 0
    const geometry = { top: 0, bottom: 0 }
    const line = () => window.innerHeight * READING_LINE

    const update = () => {
      const tr = root.getBoundingClientRect()
      const fill = Math.max(0, Math.min(geometry.bottom - geometry.top, line() - (tr.top + geometry.top)))
      spine.style.setProperty('--fill', `${fill}px`)
      root.querySelectorAll<HTMLElement>('.t-node').forEach((n) => {
        const dot = n.firstElementChild?.getBoundingClientRect()
        if (dot) n.classList.toggle('on', dot.top + dot.height / 2 < line())
      })
      svg.querySelectorAll<SVGPathElement>('.branch-lit').forEach((p) => {
        const dev = document.getElementById(p.dataset.from ?? '')
        if (dev && dev.getBoundingClientRect().top < line()) p.style.strokeDashoffset = '0'
      })
    }

    const layout = () => {
      if (!alive) return
      const tr = root.getBoundingClientRect()
      const dots = root.querySelectorAll<HTMLElement>('.t-node span')
      if (dots.length) {
        const a = dots[0].getBoundingClientRect(), b = dots[dots.length - 1].getBoundingClientRect()
        geometry.top = a.top + a.height / 2 - tr.top
        geometry.bottom = b.top + b.height / 2 - tr.top
        spine.style.top = `${geometry.top}px`
        spine.style.height = `${Math.max(0, geometry.bottom - geometry.top)}px`
      }
      svg.replaceChildren()
      if (getComputedStyle(svg).display !== 'none') {
        svg.setAttribute('viewBox', `0 0 ${tr.width} ${tr.height}`)
        for (const br of branches) {
          const from = document.getElementById(br.from), to = document.getElementById(br.to)
          if (!from || !to) continue
          const fa = from.getBoundingClientRect(), ta = to.getBoundingClientRect()
          const x1 = fa.right - tr.left, y1 = fa.top + Math.min(44, fa.height / 2) - tr.top
          const x2 = ta.left - tr.left, y2 = ta.top + Math.min(30, ta.height / 2) - tr.top
          const mx = (x1 + x2) / 2
          const d = `M${x1.toFixed(1)} ${y1.toFixed(1)} C${mx.toFixed(1)} ${y1.toFixed(1)}, ${mx.toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`
          const track = document.createElementNS(SVG_NS, 'path')
          track.setAttribute('d', d)
          track.setAttribute('class', 'branch-track')
          const lit = document.createElementNS(SVG_NS, 'path')
          lit.setAttribute('d', d)
          lit.setAttribute('class', 'branch-lit')
          lit.dataset.from = br.from
          svg.append(track, lit)
          const len = lit.getTotalLength()
          lit.style.strokeDasharray = `${len}`
          // Already-passed branches appear drawn without replaying the animation.
          const passed = reduced || fa.top < line()
          if (passed) lit.style.transition = 'none'
          lit.style.strokeDashoffset = passed ? '0' : `${len}`
        }
      }
      update()
    }

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }
    layout()
    const ro = new ResizeObserver(layout)
    ro.observe(root)
    document.fonts?.ready.then(layout)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', layout)
    return () => {
      alive = false
      ro.disconnect()
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', layout)
    }
  }, [branches, reduced, showContext])

  const renderLinked = (item: LinkedItem) =>
    item.kind === 'tension'
      ? <TensionCard key={item.key} id={`link-${item.key}`} tension={briefing.emergingTensions[item.i]} />
      : <ContradictionCard key={item.key} id={`link-${item.key}`} contradiction={briefing.contradictions[item.i]} />

  if (!order.length) return <p className="story-note">This briefing has no key developments.</p>

  return (
    <div className="timeline-wrap">
      <div className="timeline" ref={rootRef}>
        <div className="spine" ref={spineRef} aria-hidden="true"><i /><b /></div>
        <svg className="branches" ref={svgRef} aria-hidden="true" />
        {order.map((entry, row) => (
          <Fragment key={entry.index}>
            <div className="t-time label" style={{ gridRow: row + 1 }}>
              {entry.time === null
                ? UNKNOWN_TIME
                : <time dateTime={entry.dev.timestamp}>{formatTime(entry.dev.timestamp, timeZone)}</time>}
            </div>
            <div className="t-node" style={{ gridRow: row + 1 }} aria-hidden="true"><span /></div>
            <DevelopmentCard dev={entry.dev} index={entry.index} showContext={showContext} style={{ gridRow: row + 1 }} />
            {byRow.has(row) && (
              <div className="t-links" style={{ gridRow: row + 1 }}>
                {byRow.get(row)!.map(renderLinked)}
              </div>
            )}
          </Fragment>
        ))}
      </div>
      {unlinked.length > 0 && (
        <section className="also" aria-labelledby="also-h">
          <h2 id="also-h" className="section-label label">Also in this briefing</h2>
          <div className="also-grid">{unlinked.map(renderLinked)}</div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 8: Create `story.css`**

```css
.story { display: grid; gap: 56px; padding-top: 32px; }
.story-lead { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 520px); gap: 40px; align-items: center; }
.story-lead-copy { display: grid; gap: 16px; align-content: center; }
.story-globe { width: 100%; max-width: 520px; justify-self: end; }
.story-note { color: var(--ink-3); }

.alerts { display: grid; }
.alert-list { list-style: none; display: grid; gap: 12px; }
.alert {
  display: grid;
  gap: 8px;
  padding: 18px 20px;
  background: var(--paper);
  border-radius: var(--radius);
  box-shadow: inset 0 0 0 1px var(--rule-soft);
}
.alert-urgent { box-shadow: inset 3px 0 0 var(--terra), inset 0 0 0 1px var(--rule-soft); }
.alert-title { font-size: 1.12rem; }
.alert-body { color: var(--ink-2); }

.prio { display: inline-flex; align-items: center; gap: 7px; color: var(--ink-2); }
.prio svg { flex: none; }
.prio-high svg { fill: var(--terra); }
.prio-medium svg { fill: var(--ochre); }
.prio-low svg { fill: none; stroke: var(--ink-3); }

.timeline-wrap { display: grid; gap: 48px; }
.timeline {
  position: relative;
  display: grid;
  grid-template-columns: 84px 28px minmax(0, 1fr) minmax(250px, 320px);
  column-gap: 20px;
  row-gap: 22px;
}
.spine { position: absolute; left: calc(84px + 20px + 13px); width: 2px; pointer-events: none; }
.spine i { position: absolute; inset: 0; background: var(--rule); border-radius: 2px; }
.spine b { position: absolute; left: 0; top: 0; width: 2px; height: var(--fill, 0px); background: var(--moss); border-radius: 2px; }
.branches { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
.branch-track { fill: none; stroke: var(--sand); stroke-width: 1.2; }
.branch-lit { fill: none; stroke: var(--terra); stroke-width: 1.2; transition: stroke-dashoffset 1.1s var(--ease-out); }
.t-time { grid-column: 1; padding-top: 24px; text-align: right; color: var(--ink-3); }
.t-node { grid-column: 2; padding-top: 26px; display: flex; justify-content: center; position: relative; z-index: 1; }
.t-node span {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--oat);
  box-shadow: inset 0 0 0 2px var(--sand);
  transition: background-color 0.4s, box-shadow 0.4s;
}
.t-node.on span { background: var(--moss); box-shadow: inset 0 0 0 2px var(--moss), 0 0 0 5px rgba(61, 90, 69, 0.14); }

.dev {
  grid-column: 3;
  position: relative;
  z-index: 1;
  display: grid;
  gap: 10px;
  padding: 22px 24px;
  background: var(--paper);
  border-radius: var(--radius);
  box-shadow: inset 0 0 0 1px var(--rule-soft);
  scroll-margin-top: 24px;
  transition: box-shadow var(--dur-mid), transform var(--dur-mid) var(--ease-out);
}
.dev:hover { box-shadow: inset 0 0 0 1px var(--sand), var(--shadow-lift); transform: translateY(-2px); }
.dev-top { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; }
.tags { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; color: var(--ink-3); }
.tags li { padding: 3px 8px; border-radius: 6px; background: var(--oat); }
.dev-title { font-size: 1.28rem; letter-spacing: -0.015em; line-height: 1.25; }
.dev-body { color: var(--ink-2); max-width: 64ch; }
.dev-context {
  display: grid;
  gap: 4px;
  padding-left: 12px;
  border-left: 2px solid var(--rule);
  font-family: var(--font-serif);
  font-style: italic;
  font-variation-settings: var(--serif-vars);
  color: var(--ink-2);
}
.dev-context .label { font-style: normal; color: var(--ink-3); }

.t-links { grid-column: 4; position: relative; z-index: 1; display: grid; gap: 14px; align-content: start; }
.link-card { display: grid; gap: 6px; padding: 16px 18px; border-radius: 12px; box-shadow: inset 0 0 0 1px var(--rule); background: var(--oat); }
.link-card.contra { background: var(--terra-wash); box-shadow: none; }
.link-kind { display: flex; justify-content: space-between; gap: 8px; color: var(--terra-ink); }
.link-title { font-size: 1.02rem; letter-spacing: -0.01em; line-height: 1.3; }
.link-body { font-size: 0.92rem; color: var(--ink-2); }
.contra-accounts { display: grid; gap: 10px; }
.contra-accounts .label { color: var(--ink-3); }

.also-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }

.source-chips { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
.source-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  border-radius: 999px;
  background: var(--oat);
  color: var(--ink-2);
  font-size: 0.8rem;
  text-decoration: none;
}
.source-chip:hover { color: var(--ink); background: var(--oat-deep); }
.source-chip-time { font-size: 0.7rem; color: var(--ink-3); }
.source-chip-ext { opacity: 0.6; }

.reading { display: grid; }
.reading-list { list-style: none; border-top: 1px solid var(--rule); }
.reading-item { display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--rule); }
.reading-index { color: var(--terra-ink); padding-top: 3px; }
.reading-title { font-weight: 600; text-decoration: none; }
.reading-title:hover { text-decoration: underline; }
.reading-meta { color: var(--ink-2); font-size: 0.92rem; }
.reading-meta .label { color: var(--ink-3); margin-right: 6px; }

.compact .story { gap: 36px; }
.compact .timeline { row-gap: 12px; }
.compact .dev { padding: 16px 18px; gap: 6px; }

@media (max-width: 980px) {
  .story-lead { grid-template-columns: minmax(0, 1fr); }
  .story-globe { justify-self: center; max-width: 440px; order: -1; }
  .timeline { grid-template-columns: minmax(0, 1fr); row-gap: 12px; }
  .timeline > * { grid-column: 1 !important; grid-row: auto !important; }
  .spine, .t-node, .branches { display: none; }
  .t-time { text-align: left; padding-top: 12px; }
  .t-links { padding-left: 16px; border-left: 2px solid var(--rule); }
}
```

- [ ] **Step 9: Rewrite `src/routes/StoryTab.tsx`**

```tsx
import { useCallback, useMemo } from 'react'
import { AlertCallout } from '../components/briefing/AlertCallout'
import { ReadingList } from '../components/briefing/ReadingList'
import { Timeline } from '../components/briefing/Timeline'
import '../components/briefing/story.css'
import { Globe } from '../globe/Globe'
import { buildRegionPoints } from '../globe/regions'
import { usePrefersReducedMotion } from '../lib/useMediaQuery'
import { usePrintOnLoad } from '../lib/usePrintOnLoad'
import { useSettings } from '../state/hooks'
import { useBriefing } from './briefingContext'

export function StoryTab() {
  const briefing = useBriefing()
  const { settings } = useSettings()
  const reduced = usePrefersReducedMotion()
  usePrintOnLoad()
  const regions = useMemo(() => buildRegionPoints(briefing), [briefing])
  const scrollToStory = useCallback((anchorId: string) => {
    document.getElementById(anchorId)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
  }, [reduced])
  const count = briefing.keyDevelopments.length

  return (
    <div className="story">
      <div className="story-lead wrap">
        <div className="story-lead-copy">
          <AlertCallout alerts={briefing.alerts} />
        </div>
        <div className="story-globe">
          <Globe
            mode="briefing"
            regions={regions}
            timeZone={settings.timeZone}
            onSelectStory={scrollToStory}
            label={`Globe marking ${regions.length} region${regions.length === 1 ? '' : 's'} from this briefing. Hover or focus a point to see its stories.`}
          />
        </div>
      </div>
      <section className="wrap" aria-labelledby="timeline-h">
        <h2 id="timeline-h" className="section-label label">
          Key developments · {count} event{count === 1 ? '' : 's'}
        </h2>
        <Timeline briefing={briefing} timeZone={settings.timeZone} showContext={settings.showHistoricalContext} reduced={reduced} />
      </section>
      <div className="wrap">
        <ReadingList readings={briefing.readingList} />
      </div>
    </div>
  )
}
```

- [ ] **Step 10: Delete the old section components**

```bash
cd frontend
git rm src/components/briefing/KeyDevelopments.tsx src/components/briefing/Tensions.tsx \
  src/components/briefing/Contradictions.tsx src/components/briefing/PriorityAlerts.tsx \
  src/components/briefing/briefing.css
```

- [ ] **Step 11: Verify**

Run (real path): `npm run build && npm run lint` — success, no new warnings. Tests: `npx vitest run` — all pass.
Browser (`npm run dev`, open a briefing):
- Developments appear oldest first with times in your zone; an untimed one reads "Time unknown" at the end.
- Scrolling fills the moss spine; nodes turn moss as they pass 60% of the viewport; terracotta branch curves draw from a development to each tension or contradiction that names one of its regions.
- Tensions with no region match appear under "Also in this briefing".
- Clicking a story in a globe panel scrolls its card to the middle of the screen.
- Settings → Historical context off hides the "From the archive" paragraphs; Compact layout tightens spacing.
- At 375px width: one column, no spine or curves, linked cards indented beneath their development.

- [ ] **Step 12: Commit**

```bash
git add -A frontend/src
git commit -m "feat(story): scroll-drawn timeline with branch links to tensions and contradictions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Signals math and summary (`lib/signals.ts`)

**Files:**
- Create: `frontend/src/lib/signals.ts`
- Test: `frontend/src/lib/signals.test.ts`

**Interfaces:**
- Consumes: `SavedBriefing`; Task 3 `makeBriefing`.
- Produces:
  - `SOURCE_LABELS: Record<string, string>` (`newsapi → NewsAPI`, `gdelt → GDELT`, `rss → Wire feeds`)
  - `interface Share { key: string; label: string; count: number; pct: number }`
  - `shares(record: Record<string, number>, labels?: Record<string, string>): Share[]` — positive counts only, sorted by count desc then label; integer `pct` summing to exactly 100 (largest remainder)
  - `topEntries(record: Record<string, number>, n: number): [string, number][]` — positive counts, desc, then name
  - `summarizeSignals(b: Pick<SavedBriefing, 'regionCounts' | 'sourceBreakdown'>): string`

- [ ] **Step 1: Write the failing tests** `src/lib/signals.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { makeBriefing } from '../test/fixtures'
import { SOURCE_LABELS, shares, summarizeSignals, topEntries } from './signals'

describe('shares', () => {
  it('returns labeled shares that sum to 100', () => {
    const s = shares({ newsapi: 98, gdelt: 66, rss: 50 }, SOURCE_LABELS)
    expect(s.map((x) => [x.label, x.count, x.pct])).toEqual([
      ['NewsAPI', 98, 46], ['GDELT', 66, 31], ['Wire feeds', 50, 23],
    ])
  })
  it('fixes rounding so thirds still sum to 100', () => {
    const s = shares({ a: 1, b: 1, c: 1 })
    expect(s.reduce((t, x) => t + x.pct, 0)).toBe(100)
  })
  it('drops zero and negative counts and handles empty input', () => {
    expect(shares({ a: 0, b: -2 })).toEqual([])
    expect(shares({})).toEqual([])
  })
  it('breaks count ties by label', () => {
    expect(shares({ zeta: 2, alpha: 2 }).map((x) => x.label)).toEqual(['alpha', 'zeta'])
  })
})

describe('topEntries', () => {
  it('returns the n largest positive entries', () => {
    expect(topEntries({ a: 1, b: 5, c: 0, d: 3 }, 2)).toEqual([['b', 5], ['d', 3]])
  })
})

describe('summarizeSignals', () => {
  it('names the top region and leading source type', () => {
    expect(summarizeSignals(makeBriefing())).toBe(
      'Coverage is concentrated on Red Sea, with 40% of regional mentions, and NewsAPI supplied 46% of articles.',
    )
  })
  it('handles a single region', () => {
    expect(summarizeSignals({ regionCounts: { Egypt: 3 }, sourceBreakdown: {} })).toBe('Every regional mention in this briefing is of Egypt.')
  })
  it('handles sources without regions', () => {
    expect(summarizeSignals({ regionCounts: {}, sourceBreakdown: { gdelt: 3, rss: 1 } })).toBe('GDELT supplied 75% of the 4 articles.')
  })
  it('handles empty and all-zero data without NaN', () => {
    const text = summarizeSignals({ regionCounts: { X: 0 }, sourceBreakdown: { newsapi: 0 } })
    expect(text).toBe('This briefing has no regional or source data to summarize.')
    expect(text).not.toContain('NaN')
  })
})
```

The fixture's regions are Red Sea 2, Yemen 1, South Africa 1, Egypt 1 (total 5), so Red Sea is 40%.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/signals.test.ts`
Expected: FAIL, "Failed to resolve import ./signals".

- [ ] **Step 3: Write `src/lib/signals.ts`**

```ts
// Signals tab math. The summary sentence is a template over the data; no model call.
import type { SavedBriefing } from './normalize'

export const SOURCE_LABELS: Record<string, string> = {
  newsapi: 'NewsAPI',
  gdelt: 'GDELT',
  rss: 'Wire feeds',
}

export interface Share {
  key: string
  label: string
  count: number
  pct: number
}

export function shares(record: Record<string, number>, labels: Record<string, string> = {}): Share[] {
  const items = Object.entries(record)
    .filter(([, v]) => v > 0)
    .map(([key, count]) => ({ key, label: labels[key] ?? key, count }))
    .sort((a, z) => z.count - a.count || a.label.localeCompare(z.label))
  const total = items.reduce((t, x) => t + x.count, 0)
  if (!total) return []
  // Largest-remainder rounding so the integer percentages sum to exactly 100.
  const raw = items.map((x) => (x.count / total) * 100)
  const floors = raw.map(Math.floor)
  let remaining = 100 - floors.reduce((t, x) => t + x, 0)
  const byRemainder = raw.map((r, i) => ({ i, rem: r - floors[i] })).sort((a, z) => z.rem - a.rem || a.i - z.i)
  for (const { i } of byRemainder) {
    if (remaining <= 0) break
    floors[i] += 1
    remaining -= 1
  }
  return items.map((x, i) => ({ ...x, pct: floors[i] }))
}

export function topEntries(record: Record<string, number>, n: number): [string, number][] {
  return Object.entries(record)
    .filter(([, v]) => v > 0)
    .sort((a, z) => z[1] - a[1] || a[0].localeCompare(z[0]))
    .slice(0, n)
}

export function summarizeSignals(b: Pick<SavedBriefing, 'regionCounts' | 'sourceBreakdown'>): string {
  const regions = shares(b.regionCounts)
  const sources = shares(b.sourceBreakdown, SOURCE_LABELS)
  const topRegion = regions[0]
  const topSource = sources[0]
  if (regions.length === 1 && !topSource) return `Every regional mention in this briefing is of ${topRegion.label}.`
  if (topRegion && topSource) {
    const regionPart = regions.length === 1
      ? `Every regional mention is of ${topRegion.label}`
      : `Coverage is concentrated on ${topRegion.label}, with ${topRegion.pct}% of regional mentions`
    return `${regionPart}, and ${topSource.label} supplied ${topSource.pct}% of articles.`
  }
  if (topRegion) return `Coverage is concentrated on ${topRegion.label}, with ${topRegion.pct}% of regional mentions.`
  if (topSource) {
    const total = sources.reduce((t, x) => t + x.count, 0)
    return `${topSource.label} supplied ${topSource.pct}% of the ${total} articles.`
  }
  return 'This briefing has no regional or source data to summarize.'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/signals.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/signals.ts frontend/src/lib/signals.test.ts
git commit -m "feat(signals): share math and template summary sentence

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Signals tab UI (remove chart.js)

**Files:**
- Rewrite: `frontend/src/routes/SignalsTab.tsx`
- Create: `frontend/src/routes/signals.css`
- Delete: `frontend/src/components/AnalyticsPanel.tsx`, `frontend/src/components/analytics.css`
- Modify: `frontend/package.json` (remove chart.js)

**Interfaces:**
- Consumes: Task 10 `SOURCE_LABELS`, `shares`, `topEntries`, `summarizeSignals`; Task 4 `useBriefing`.

- [ ] **Step 1: Rewrite `src/routes/SignalsTab.tsx`**

```tsx
import { SOURCE_LABELS, shares, summarizeSignals, topEntries } from '../lib/signals'
import { useBriefing } from './briefingContext'
import './signals.css'

const SEGMENT_COLORS = ['var(--moss)', 'var(--sage)', 'var(--sand)', 'var(--ochre)', 'var(--ink-3)']

function RankRows({ rows, emptyText }: { rows: [string, number][]; emptyText: string }) {
  if (!rows.length) return <p className="viz-empty">{emptyText}</p>
  const max = rows[0][1]
  return (
    <ol className="rows">
      {rows.map(([name, value]) => (
        <li key={name} className="row">
          <span className="row-name">{name}</span>
          <span className="bar" aria-hidden="true"><i style={{ width: `${((value / max) * 100).toFixed(1)}%` }} /></span>
          <span className="row-n mono">{value}</span>
        </li>
      ))}
    </ol>
  )
}

export function SignalsTab() {
  const b = useBriefing()
  const sources = shares(b.sourceBreakdown, SOURCE_LABELS)
  const sourceTotal = sources.reduce((t, x) => t + x.count, 0)
  const stats: [string, number][] = [
    ['Articles', b.stats.articles],
    ['Sources', b.stats.sources],
    ['Regions', b.stats.regions],
    ['Alerts', b.stats.alerts],
  ]

  return (
    <div className="signals wrap">
      <p className="insight">{summarizeSignals(b)}</p>

      <dl className="stat-strip">
        {stats.map(([k, v]) => (
          <div className="stat" key={k}>
            <dt className="label">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <div className="viz">
        <section aria-labelledby="mix-h">
          <h2 id="mix-h" className="viz-title">Source mix <span className="label">{sourceTotal} articles</span></h2>
          {sources.length ? (
            <>
              <div className="stack" role="img" aria-label={sources.map((s) => `${s.label} ${s.pct} percent`).join(', ')}>
                {sources.map((s, i) => (
                  <span key={s.key} style={{ width: `${s.pct}%`, background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
                ))}
              </div>
              <div className="stack-legend">
                {sources.map((s, i) => (
                  <div key={s.key}>
                    <span className="sw"><i style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />{s.label}</span>
                    <span className="pct">{s.pct}%</span>
                    <span className="n label">{s.count} articles</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="viz-empty">No source breakdown came back with this briefing.</p>
          )}
        </section>

        <section aria-labelledby="regions-h">
          <h2 id="regions-h" className="viz-title">Most-mentioned regions <span className="label">Mentions</span></h2>
          <RankRows rows={topEntries(b.regionCounts, 8)} emptyText="No regions were tagged in this briefing." />
        </section>

        <section aria-labelledby="outlets-h">
          <h2 id="outlets-h" className="viz-title">Most-cited outlets <span className="label">Citations</span></h2>
          <RankRows rows={topEntries(b.outletCounts, 8)} emptyText="No outlet citations in this briefing." />
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/routes/signals.css`**

```css
.signals { display: grid; gap: 40px; padding-top: 36px; }
.insight { font-size: clamp(1.25rem, 2.3vw, 1.7rem); line-height: 1.35; letter-spacing: -0.015em; max-width: 34em; text-wrap: pretty; }

.stat-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-block: 1px solid var(--rule); }
.stat { display: grid; gap: 4px; padding: 22px 24px 22px 0; }
.stat + .stat { padding-left: 24px; border-left: 1px solid var(--rule); }
.stat dt { color: var(--ink-3); }
.stat dd { font-size: clamp(2rem, 3.6vw, 2.9rem); font-weight: 560; letter-spacing: -0.04em; line-height: 1; font-variant-numeric: tabular-nums; }

.viz { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 48px 56px; }
.viz-title { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 18px; font-size: 1rem; }
.viz-title .label { color: var(--ink-3); font-weight: 400; }
.viz-empty { color: var(--ink-3); }

.stack { display: flex; gap: 2px; height: 14px; border-radius: 4px; overflow: hidden; }
.stack span { display: block; height: 100%; }
.stack-legend { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 14px; margin-top: 16px; }
.stack-legend div { display: grid; gap: 2px; }
.sw { display: flex; align-items: center; gap: 8px; font-size: 0.92rem; }
.sw i { width: 10px; height: 10px; border-radius: 2px; }
.pct { font-size: 1.5rem; font-weight: 560; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.stack-legend .n { color: var(--ink-3); }

.rows { list-style: none; display: grid; gap: 11px; }
.row { display: grid; grid-template-columns: minmax(0, 9rem) minmax(0, 1fr) 3rem; gap: 14px; align-items: center; font-size: 0.94rem; }
.row-name { overflow-wrap: anywhere; }
.bar { height: 6px; border-radius: 3px; background: var(--rule-soft); overflow: hidden; }
.bar i { display: block; height: 100%; border-radius: 3px; background: var(--moss); }
.row:first-child .bar i { background: var(--terra); }
.row-n { text-align: right; color: var(--ink-2); font-size: 0.8rem; }

.compact .signals { gap: 28px; }

@media (max-width: 640px) {
  .stat-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .stat:nth-child(3) { padding-left: 0; border-left: 0; }
  .stat:nth-child(n + 3) { border-top: 1px solid var(--rule); }
}
```

- [ ] **Step 3: Remove chart.js and the old panel**

Run (real path):

```bash
npm uninstall chart.js
git rm src/components/AnalyticsPanel.tsx src/components/analytics.css
```

- [ ] **Step 4: Verify**

Run (real path): `npm run build && npm run lint` — success, no new warnings; no `AnalyticsPanel-*.js` chunk in `dist/assets`. Tests: `npx vitest run` — all pass.
Browser: open a briefing's Signals tab. The summary sentence names the top region; the stats strip has four figures divided by hairlines; the stacked bar percentages sum to 100; region and outlet lists show up to eight rows with the first in terracotta. Open a briefing with no source breakdown (edit one in DevTools localStorage to `"sourceBreakdown":{}`): the "No source breakdown" message shows.

- [ ] **Step 5: Commit**

```bash
git add -A frontend
git commit -m "feat(signals): refined analytics tab in SVG/CSS; remove chart.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Hero motion (rotating headline, typewriter, contours, intro)

**Files:**
- Create: `frontend/src/lib/intro.ts`, `frontend/src/lib/intro.test.ts`, `frontend/src/lib/useTypewriter.ts`, `frontend/src/components/RotatingHeadline.tsx`, `frontend/src/components/Contours.tsx`
- Modify: `frontend/src/routes/HomePage.tsx`, `frontend/src/routes/BriefingLayout.tsx`, `frontend/src/routes/briefing-layout.css`

**Interfaces:**
- Consumes: Task 7 `Globe` (`playIntro`, `scanning`), `usePrefersReducedMotion`; Task 4 `useClock`, `AskForm` `placeholder` prop.
- Produces: `shouldPlayIntro(reduced: boolean): boolean`, `markIntroPlayed(): void`; `useTypewriter(prompts: readonly string[], opts: { enabled: boolean; pauseWhenFocusedId?: string }): string`; `Contours` props `{ centers: { x: number; y: number; rings: number; step: number; seed: number }[] }` (x, y as fractions of the box).

- [ ] **Step 1: Write the failing test** `src/lib/intro.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  window.sessionStorage.clear()
  vi.resetModules()
})

describe('intro', () => {
  it('plays once per browser session', async () => {
    const first = await import('./intro')
    expect(first.shouldPlayIntro(false)).toBe(true)
    expect(first.shouldPlayIntro(false)).toBe(true) // stable within one page load until marked
    first.markIntroPlayed()
    expect(first.shouldPlayIntro(false)).toBe(false)
    vi.resetModules()
    const reloaded = await import('./intro')
    expect(reloaded.shouldPlayIntro(false)).toBe(false)
  })
  it('never plays with reduced motion', async () => {
    const m = await import('./intro')
    expect(m.shouldPlayIntro(true)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/intro.test.ts`
Expected: FAIL, "Failed to resolve import ./intro".

- [ ] **Step 3: Write `src/lib/intro.ts`**

```ts
// First-load intro: once per browser session, never with reduced motion.
// The decision is memoized per page load so StrictMode double renders agree.
const KEY = 'atlasIntroSeen'
let decision: boolean | null = null

export function shouldPlayIntro(reduced: boolean): boolean {
  if (decision === null) {
    let seen = true
    try {
      seen = window.sessionStorage.getItem(KEY) === '1'
    } catch {
      seen = true
    }
    decision = !reduced && !seen
  }
  return decision
}

export function markIntroPlayed(): void {
  decision = false
  try {
    window.sessionStorage.setItem(KEY, '1')
  } catch {
    // storage blocked: the intro may replay next load, which is harmless
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/intro.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `src/lib/useTypewriter.ts`**

```ts
import { useEffect, useState } from 'react'

/** Types and deletes example prompts in a placeholder. Pauses while the target input is focused or filled. */
export function useTypewriter(prompts: readonly string[], opts: { enabled: boolean; pauseWhenFocusedId?: string }): string {
  const { enabled, pauseWhenFocusedId } = opts
  const [text, setText] = useState(prompts[0] ?? '')
  useEffect(() => {
    if (!enabled || prompts.length === 0) {
      setText(prompts[0] ?? '')
      return
    }
    let pi = 0, ci = prompts[0].length, dir = -1, hold = 40
    const t = window.setInterval(() => {
      const el = pauseWhenFocusedId ? (document.getElementById(pauseWhenFocusedId) as HTMLInputElement | null) : null
      if (el && (document.activeElement === el || el.value)) return
      if (hold > 0) { hold--; return }
      ci += dir
      if (ci <= 0) { dir = 1; pi = (pi + 1) % prompts.length; ci = 0; hold = 3 }
      if (ci >= prompts[pi].length) { dir = -1; ci = prompts[pi].length; hold = 45 }
      setText(prompts[pi].slice(0, ci) + (ci < prompts[pi].length ? '▍' : ''))
    }, 55)
    return () => window.clearInterval(t)
  }, [enabled, prompts, pauseWhenFocusedId])
  return text
}
```

- [ ] **Step 6: Create `src/components/RotatingHeadline.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '../lib/useMediaQuery'

const TOPICS = ['the Red Sea.', 'chip controls.', 'the Sahel.', 'climate finance.', 'Taiwan Strait.', 'Black Sea grain.']

export function RotatingHeadline({ intervalMs = 3200 }: { intervalMs?: number }) {
  const reduced = usePrefersReducedMotion()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (reduced) return
    const t = window.setInterval(() => setTick((n) => n + 1), intervalMs)
    return () => window.clearInterval(t)
  }, [reduced, intervalMs])
  const index = tick % TOPICS.length
  const prev = (index - 1 + TOPICS.length) % TOPICS.length

  return (
    <h1 className="home-title" aria-label="Brief me on any place or policy">
      <span className="l1" aria-hidden="true">Brief me on</span>
      <span className="rot" aria-hidden="true">
        {reduced ? (
          <span className="rot-word serif">{TOPICS[0]}</span>
        ) : (
          <>
            {tick > 0 && <span key={`out-${tick}`} className="rot-word serif out">{TOPICS[prev]}</span>}
            <span key={`in-${tick}`} className="rot-word serif in">{TOPICS[index]}</span>
          </>
        )}
      </span>
    </h1>
  )
}
```

- [ ] **Step 7: Create `src/components/Contours.tsx`**

```tsx
import { useEffect, useRef } from 'react'

export interface ContourCenter { x: number; y: number; rings: number; step: number; seed: number }

/** Faint topographic rings drawn once per resize. Decorative. */
export function Contours({ centers }: { centers: ContourCenter[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const draw = () => {
      const r = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(r.width * dpr)
      canvas.height = Math.round(r.height * dpr)
      const g = canvas.getContext('2d')
      if (!g) return
      g.scale(dpr, dpr)
      g.lineWidth = 1
      for (const c of centers) {
        const cx = r.width * c.x, cy = r.height * c.y
        for (let k = 1; k <= c.rings; k++) {
          const base = k * c.step
          g.strokeStyle = `rgba(61, 90, 69, ${k % 5 === 0 ? 0.16 : 0.075})`
          g.beginPath()
          for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.04) {
            const w = Math.sin(a * 3 + c.seed + k * 0.21) * 0.07 + Math.sin(a * 5 - c.seed * 1.3 + k * 0.13) * 0.035 + Math.sin(a * 2 + k * 0.4) * 0.05
            const rad = base * (1 + w)
            const x = cx + Math.cos(a) * rad * 1.18, y = cy + Math.sin(a) * rad
            if (a === 0) g.moveTo(x, y)
            else g.lineTo(x, y)
          }
          g.closePath()
          g.stroke()
        }
      }
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [centers])
  return <canvas ref={ref} className="contours" aria-hidden="true" />
}
```

Add to `src/styles/base.css` (after `.visually-hidden`):

```css
.contours { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
```

- [ ] **Step 8: Rewrite `src/routes/HomePage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { AskForm } from '../components/AskForm'
import { Contours, type ContourCenter } from '../components/Contours'
import { RotatingHeadline } from '../components/RotatingHeadline'
import { Globe } from '../globe/Globe'
import { markIntroPlayed, shouldPlayIntro } from '../lib/intro'
import { useClock } from '../lib/useClock'
import { usePrefersReducedMotion } from '../lib/useMediaQuery'
import { useTypewriter } from '../lib/useTypewriter'
import { useSettings } from '../state/hooks'
import { useGenerateBriefing } from '../state/useGenerateBriefing'
import './home.css'

const SUGGESTIONS = ['Red Sea shipping', 'Sahel security', 'Chip export controls', 'Climate finance']
const PROMPTS = ['about the Strait of Hormuz', 'about lithium supply in the Andes', 'about the ECB rate decision', 'about Sudan’s ceasefire talks'] as const
const CONTOURS: ContourCenter[] = [
  { x: 0.74, y: 0.48, rings: 22, step: 26, seed: 1.7 },
  { x: 0.08, y: 1.02, rings: 14, step: 30, seed: 4.1 },
]
const INTRO_MS = 2600

export function HomePage() {
  const reduced = usePrefersReducedMotion()
  const { settings } = useSettings()
  const clock = useClock(settings.timeZone, 15_000)
  const { generate, retry, loading, error } = useGenerateBriefing()
  const [intro, setIntro] = useState(() => shouldPlayIntro(reduced))
  const placeholder = useTypewriter(PROMPTS, { enabled: !reduced, pauseWhenFocusedId: 'home-ask' })

  useEffect(() => {
    if (!intro) return
    const end = () => {
      markIntroPlayed()
      setIntro(false)
    }
    const t = window.setTimeout(end, INTRO_MS)
    window.addEventListener('pointerdown', end, { once: true })
    window.addEventListener('keydown', end, { once: true })
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('pointerdown', end)
      window.removeEventListener('keydown', end)
    }
  }, [intro])

  return (
    <section className={`home ${intro ? 'intro' : ''}`}>
      <Contours centers={CONTOURS} />
      <div className="home-inner wrap">
        <div className="home-copy">
          <p className="eyebrow label"><span>{clock.day}</span><span>{clock.time}</span><span>Global intelligence</span></p>
          <RotatingHeadline />
          <p className="home-lede">
            Atlas reads NewsAPI, GDELT and fifteen wire services, then tells you{' '}
            <em className="serif">what changed, where it happened,</em> and what to read next.
          </p>
          <div className="home-ask">
            <AskForm id="home-ask" loading={loading} error={error} onGenerate={generate} onRetry={retry} placeholder={placeholder} />
            <div className="chips" aria-label="Suggested topics">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => void generate(s, 'daily')} disabled={loading} data-cursor="link">
                  {s}
                </button>
              ))}
            </div>
          </div>
          <p className="provenance label">
            <span>NewsAPI</span><span>GDELT 2.0</span><span>15 wire feeds</span><span>Model-written, source-cited</span>
          </p>
        </div>
        <div className="home-globe">
          <Globe
            mode="hero"
            playIntro={intro}
            scanning={loading}
            label="A globe of the world drawn in fine grain, slowly turning."
          />
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 9: Add contours behind the briefing masthead**

In `src/routes/BriefingLayout.tsx`, add `import { Contours, type ContourCenter } from '../components/Contours'` and a module constant:

```tsx
const MASTHEAD_CONTOURS: ContourCenter[] = [{ x: 0.86, y: 0.2, rings: 16, step: 24, seed: 2.6 }]
```

Wrap the `<header className="masthead wrap">…</header>` element in a band:

```tsx
      <div className="masthead-band">
        <Contours centers={MASTHEAD_CONTOURS} />
        <header className="masthead wrap">
          {/* existing masthead contents unchanged */}
        </header>
      </div>
```

Append to `src/routes/briefing-layout.css`:

```css
.masthead-band { position: relative; overflow: hidden; }
```

- [ ] **Step 10: Verify**

Run (real path): `npm run build && npm run lint` — success, no new warnings. Tests: `npx vitest run` — all pass.
Browser, in a fresh tab (new session):
- Home: grain particles gather into the globe over about two seconds while the headline lines settle in; a click or key skips it; reloading the page in the same tab does not replay it; a new tab does.
- The second headline line rotates every ~3 seconds with a blur slide; the Ask field placeholder types and deletes example prompts and stops while you type in it.
- Faint contour rings sit behind the hero and the briefing masthead.
- Submitting a brief speeds the globe up ("scanning") until the result arrives.
- With reduced motion on: no intro, static headline ("the Red Sea."), static placeholder.

- [ ] **Step 11: Commit**

```bash
git add -A frontend/src
git commit -m "feat(home): rotating headline, typewriter prompts, contours and first-load intro

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Coordinate-lens cursor

**Files:**
- Create: `frontend/src/components/cursorBus.ts`, `frontend/src/components/CursorLens.tsx`, `frontend/src/components/cursor.css`
- Modify: `frontend/src/globe/GlobeView.tsx` (publish readout), `frontend/src/App.tsx` (mount cursor)

**Interfaces:**
- Consumes: Task 7 `FrameInfo.readout`, `useMediaQuery`, `usePrefersReducedMotion`.
- Produces: `setGlobeReadout(text: string | null): void`, `subscribeGlobeReadout(listener: (text: string | null) => void): () => void`; `CursorLens` component. Cursor modes come from `data-cursor="link" | "text"` attributes or element type; `globe` mode while a readout is active.

- [ ] **Step 1: Create `src/components/cursorBus.ts`**

```ts
// Tiny pub/sub so the globe can feed live coordinates to the cursor
// without re-rendering React on every frame.
type Listener = (text: string | null) => void

const listeners = new Set<Listener>()
let current: string | null = null

export function setGlobeReadout(text: string | null): void {
  if (text === current) return
  current = text
  for (const l of listeners) l(text)
}

export function subscribeGlobeReadout(listener: Listener): () => void {
  listeners.add(listener)
  listener(current)
  return () => {
    listeners.delete(listener)
  }
}
```

- [ ] **Step 2: Publish the readout from the globe**

In `src/globe/GlobeView.tsx`, add `import { setGlobeReadout } from '../components/cursorBus'`. Change the frame callback's first line from `engine.onFrame = ({ hotspots }) => {` to:

```tsx
    engine.onFrame = ({ hotspots, readout }) => {
      setGlobeReadout(readout)
```

and add `setGlobeReadout(null)` as the first line of that effect's cleanup function (before `ro.disconnect()`).

- [ ] **Step 3: Create `src/components/CursorLens.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { useMediaQuery, usePrefersReducedMotion } from '../lib/useMediaQuery'
import { subscribeGlobeReadout } from './cursorBus'
import './cursor.css'

const INTERACTIVE = '[data-cursor], a, button, input, select, textarea, label'

/** A terracotta dot and trailing ring that adapts to what's under the pointer. */
export function CursorLens() {
  const reduced = usePrefersReducedMotion()
  const fine = useMediaQuery('(pointer: fine)')
  const enabled = fine && !reduced
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const readRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dot = dotRef.current, ring = ringRef.current, read = readRef.current
    if (!enabled || !dot || !ring || !read) return
    const root = document.documentElement
    root.classList.add('has-cursor')
    let x = -100, y = -100, rx = -100, ry = -100
    let inside = false
    let mode = ''
    let readout: string | null = null
    let raf = 0

    const setMode = (m: string) => {
      if (m === mode) return
      mode = m
      if (m) root.dataset.cursor = m
      else delete root.dataset.cursor
    }
    const pick = (target: EventTarget | null): string => {
      const el = (target as Element | null)?.closest?.(INTERACTIVE) as HTMLElement | null
      if (!el) return readout ? 'globe' : ''
      if (el.dataset.cursor) return el.dataset.cursor
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? 'text' : 'link'
    }
    const show = (on: boolean) => {
      for (const el of [dot, ring, read]) el.classList.toggle('hidden', !on)
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
      x = e.clientX
      y = e.clientY
      if (!inside) {
        inside = true
        rx = x
        ry = y
        show(true)
      }
      setMode(pick(e.target))
    }
    const onLeave = () => {
      inside = false
      show(false)
    }
    const unsubscribe = subscribeGlobeReadout((text) => {
      readout = text
      read.textContent = text ?? ''
      if (text && !mode) setMode('globe')
      if (!text && mode === 'globe') setMode('')
    })
    const loop = () => {
      rx += (x - rx) * 0.2
      ry += (y - ry) * 0.2
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
      read.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    window.addEventListener('pointermove', onMove, { passive: true })
    root.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      unsubscribe()
      window.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', onLeave)
      root.classList.remove('has-cursor')
      delete root.dataset.cursor
    }
  }, [enabled])

  if (!enabled) return null
  return (
    <>
      <div ref={ringRef} className="cur cur-ring hidden" aria-hidden="true" />
      <div ref={dotRef} className="cur cur-dot hidden" aria-hidden="true" />
      <div ref={readRef} className="cur cur-read label hidden" aria-hidden="true" />
    </>
  )
}
```

- [ ] **Step 4: Create `src/components/cursor.css`**

```css
.has-cursor, .has-cursor * { cursor: none !important; }
.cur { position: fixed; left: 0; top: 0; z-index: 100; pointer-events: none; will-change: transform; transition: opacity 0.2s; }
.cur.hidden { opacity: 0; }
.cur-dot { width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%; background: var(--terra); transition: opacity 0.2s, width 0.2s, height 0.2s, margin 0.2s; }
.cur-ring {
  width: 36px;
  height: 36px;
  margin: -18px 0 0 -18px;
  border-radius: 50%;
  border: 1px solid var(--terra);
  transition: width 0.35s var(--ease-out), height 0.35s var(--ease-out), margin 0.35s var(--ease-out),
    border-radius 0.35s var(--ease-out), background-color 0.3s, opacity 0.3s;
}
.cur-ring::before, .cur-ring::after { content: ''; position: absolute; background: var(--terra); opacity: 0; transition: opacity 0.3s; }
.cur-ring::before { left: 50%; top: -8px; bottom: -8px; width: 1px; margin-left: -0.5px; }
.cur-ring::after { top: 50%; left: -8px; right: -8px; height: 1px; margin-top: -0.5px; }
.cur-read { margin: 26px 0 0 30px; white-space: nowrap; color: var(--terra-ink); opacity: 0; transition: opacity 0.25s; }

html[data-cursor="link"] .cur-ring { width: 58px; height: 58px; margin: -29px 0 0 -29px; background: var(--terra-wash); }
html[data-cursor="link"] .cur-dot { opacity: 0; }
html[data-cursor="text"] .cur-ring { width: 2px; height: 26px; margin: -13px 0 0 -1px; border-radius: 1px; background: var(--terra); }
html[data-cursor="text"] .cur-dot { opacity: 0; }
html[data-cursor="globe"] .cur-ring { width: 70px; height: 70px; margin: -35px 0 0 -35px; border-style: dashed; }
html[data-cursor="globe"] .cur-ring::before, html[data-cursor="globe"] .cur-ring::after { opacity: 0.55; }
html[data-cursor="globe"] .cur-read:not(.hidden) { opacity: 1; }
html[data-cursor="globe"] .cur-dot { width: 4px; height: 4px; margin: -2px 0 0 -2px; }
```

- [ ] **Step 5: Mount the cursor**

In `src/App.tsx`, add `import { CursorLens } from './components/CursorLens'` and render `<CursorLens />` right after `<ToastHost … />` inside `.app`.

- [ ] **Step 6: Verify**

Run (real path): `npm run build && npm run lint` — success, no new warnings. Tests: `npx vitest run` — all pass.
Browser with a mouse:
- A terracotta dot follows the pointer with a trailing ring.
- Over buttons and links the ring grows with a light terracotta fill; over text fields it becomes a thin vertical bar.
- Over a globe the ring turns dashed with a crosshair and shows live coordinates such as `12.61°N  43.30°E`.
- Leaving the window hides it.
- With reduced motion on, or in DevTools touch emulation, the normal cursor shows and no custom cursor elements are rendered.

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src
git commit -m "feat(ui): coordinate-lens cursor with live globe coordinates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Archive and Settings styling, cleanup, final verification

**Files:**
- Create: `frontend/src/routes/archive.css`, `frontend/src/routes/settings.css`
- Rewrite: `frontend/src/components/Toast.tsx`, `frontend/src/components/toast.css`
- Modify: `frontend/src/routes/ArchivePage.tsx` (css import), `frontend/src/routes/SettingsPage.tsx` (css import), `frontend/src/styles/tokens.css` (remove legacy aliases), `frontend/src/styles/base.css` (remove legacy primitives), `frontend/README.md`, `frontend/package.json` (remove framer-motion)
- Delete: `frontend/src/components/saved.css`, `frontend/src/components/profile.css`, `frontend/src/components/Reveal.tsx`, `frontend/src/lib/useSpotlight.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: `ToastHost` with the same props as before (`{ toasts: ToastItem[]; onDismiss(id: number): void }`), without framer-motion.

- [ ] **Step 1: Create `src/routes/archive.css`** and point the Archive page at it

```css
.saved-empty { display: grid; gap: 12px; justify-items: start; padding: 32px; border-radius: var(--radius); background: var(--paper); box-shadow: inset 0 0 0 1px var(--rule-soft); }
.saved-empty h2 { font-size: 1.4rem; }
.saved-empty p { color: var(--ink-2); }

.saved-toolbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; }
.saved-toolbar .label { color: var(--ink-3); }
.saved-filters { display: flex; gap: 6px; }
.saved-filter { padding: 8px 14px; }
.saved-filter.on { background: var(--paper); color: var(--ink); border-color: var(--sand); }

.saved-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.saved-card {
  display: grid;
  gap: 12px;
  align-content: start;
  padding: 20px 22px;
  border-radius: var(--radius);
  background: var(--paper);
  box-shadow: inset 0 0 0 1px var(--rule-soft);
  transition: box-shadow var(--dur-mid), transform var(--dur-mid) var(--ease-out);
}
.saved-card:hover { box-shadow: inset 0 0 0 1px var(--sand), var(--shadow-lift); transform: translateY(-2px); }
.saved-card.selected { box-shadow: inset 0 0 0 1.5px var(--moss); }
.saved-card-head { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
.saved-card-title { font-size: 1.2rem; letter-spacing: -0.015em; }
.saved-card-title::first-letter { text-transform: uppercase; }
.saved-card-date { color: var(--ink-3); }
.star-btn { border: 0; background: transparent; padding: 6px; border-radius: 8px; color: var(--ink-3); }
.star-btn:hover { background: var(--oat); color: var(--ink); }
.star-btn.on { color: var(--ochre); }
.saved-card-lede { color: var(--ink-2); }
.saved-card-stats { color: var(--ink-3); }
.saved-card-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.saved-card-actions .btn { padding: 8px 14px; font-size: 0.86rem; }
.compare-check { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; font-size: 0.86rem; color: var(--ink-2); }
.compare-check input { accent-color: var(--moss); }

.compare-panel { display: grid; gap: 16px; padding: 24px; border-radius: var(--radius); background: var(--paper); box-shadow: inset 0 0 0 1px var(--rule-soft); }
.compare-panel > .label { color: var(--terra-ink); }
.compare-split { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 28px; }
.compare-col { display: grid; gap: 14px; align-content: start; }
.compare-title { font-size: 1.15rem; }
.compare-title::first-letter { text-transform: uppercase; }
.compare-issued { color: var(--ink-3); }
.compare-block { display: grid; gap: 6px; }
.compare-block > .label { color: var(--terra-ink); }
.compare-block ul { padding-left: 18px; display: grid; gap: 4px; color: var(--ink-2); }
.compare-none { color: var(--ink-3); }
```

In `src/routes/ArchivePage.tsx`, replace `import '../components/saved.css'` with `import './archive.css'`.

- [ ] **Step 2: Create `src/routes/settings.css`** and point the Settings page at it

```css
.settings { max-width: 860px; }
.settings-card { display: grid; gap: 18px; padding: 24px; border-radius: var(--radius); background: var(--paper); box-shadow: inset 0 0 0 1px var(--rule-soft); }
.settings-card > h2.label { color: var(--terra-ink); }
.profile-row { display: flex; align-items: center; gap: 16px; }
.profile-avatar { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; background: var(--moss); color: var(--paper); font-weight: 500; }
.profile-name-block { display: grid; gap: 2px; }
.profile-display-name { font-weight: 600; font-size: 1.1rem; }
.profile-display-email { color: var(--ink-3); font-size: 0.86rem; }
.profile-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
.profile-fields label { display: grid; gap: 6px; font-size: 0.86rem; color: var(--ink-2); }
.profile-fields input { padding: 11px 14px; border-radius: var(--radius-sm); border: 1px solid var(--rule); background: var(--oat); color: var(--ink); font-size: 1rem; }
.profile-fields input:focus-visible { outline: 2px solid var(--moss); outline-offset: 1px; }
.settings-card > .btn { justify-self: start; }
.profile-note { color: var(--ink-3); }
.settings-list { list-style: none; display: grid; }
.settings-item { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 14px 0; border-top: 1px solid var(--rule-soft); }
.settings-item:first-child { border-top: 0; }
.settings-label { display: block; font-weight: 600; }
.settings-hint { display: block; font-size: 0.9rem; color: var(--ink-3); }
.switch { flex: none; position: relative; width: 44px; height: 26px; border-radius: 999px; border: 0; background: var(--rule); transition: background-color var(--dur-mid); }
.switch.on { background: var(--moss); }
.switch-knob { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: var(--paper); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2); transition: transform var(--dur-mid) var(--ease-out); }
.switch.on .switch-knob { transform: translateX(18px); }
```

In `src/routes/SettingsPage.tsx`, replace `import '../components/profile.css'` with `import './settings.css'`.

- [ ] **Step 3: Make toasts CSS-only** — rewrite `src/components/Toast.tsx`

```tsx
import './toast.css'

export interface ToastItem {
  id: number
  message: string
  tone: 'success' | 'error' | 'info'
}

export function ToastHost({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          <span>{t.message}</span>
          <button type="button" className="toast-close" onClick={() => onDismiss(t.id)} aria-label="Dismiss notification" data-cursor="link">
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
```

and `src/components/toast.css`:

```css
.toast-host {
  position: fixed;
  right: 16px;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  z-index: 85;
  display: grid;
  gap: 8px;
  width: min(380px, calc(100vw - 32px));
}
.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px 12px 16px;
  border-radius: 12px;
  background: var(--ink);
  color: var(--paper);
  font-size: 0.92rem;
  box-shadow: 0 20px 40px -24px rgba(28, 35, 31, 0.6);
  animation: toast-in 0.3s var(--ease-out) both;
}
.toast span { flex: 1; }
.toast-success { box-shadow: inset 3px 0 0 var(--sage), 0 20px 40px -24px rgba(28, 35, 31, 0.6); }
.toast-error { box-shadow: inset 3px 0 0 var(--terra), 0 20px 40px -24px rgba(28, 35, 31, 0.6); }
.toast-close { border: 0; background: transparent; color: var(--paper); opacity: 0.7; font-size: 1.2rem; line-height: 1; padding: 2px 6px; border-radius: 6px; }
.toast-close:hover { opacity: 1; }
@keyframes toast-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
```

- [ ] **Step 4: Remove dead files and framer-motion**

Run (real path):

```bash
git rm src/components/saved.css src/components/profile.css src/components/Reveal.tsx src/lib/useSpotlight.ts
npm uninstall framer-motion
grep -rn "framer-motion\|useSpotlight\|Reveal\b" src || echo "no references"
```

Expected: `no references`.

- [ ] **Step 5: Remove the legacy token aliases and primitives**

First confirm nothing still uses them:

```bash
grep -rnE "var\(--(bg-[0-9]|surface|border(-hi)?|text-(hi|mid|low)|signal[a-z-]*|haze[a-z-]*|alert-[a-z]+|grid-line[a-z-]*|glass-[a-z]+|font-display|font-body|shadow-card|shadow-float|glow-signal|ease-expo|dur-reveal)\)" src
grep -rnE "class(Name)?=\"[^\"]*\b(panel|glass|signal-label)\b" src
```

Expected: no output from either command. If something matches, change that rule or element to the Oat tokens and classes before continuing.

Then delete the block starting `/* Legacy aliases` through the last alias line in `src/styles/tokens.css`, and delete the block starting `/* Legacy primitives` (the `.panel`, `.panel.spot::before`, `.glass`, `.signal-label` rules) in `src/styles/base.css`.

- [ ] **Step 6: Update `frontend/README.md`**

Add this section after the existing "Tests" section:

```markdown
## Globe land data

`src/globe/landPoints.ts` is generated from `world-atlas` by
`npm run build:land`. Re-run it only after upgrading `world-atlas`, and
commit the regenerated file.
```

- [ ] **Step 7: Full verification**

Run tests (symlink path): `npx vitest run`
Expected: all test files pass (storage, normalize, centroids, time, settings, resolveBriefing, regions, timeline, signals, intro).

Run (real path): `npm run build && npm run lint`
Expected: build succeeds; lint reports no warnings beyond those present before Task 1 (the pre-existing `only-export-components` warning on `GlobeCanvas` is gone with that file).

Measure bundles:

```bash
for f in dist/assets/*.js; do printf "%s %s KB gzip\n" "$f" "$(( $(gzip -c "$f" | wc -c) / 1024 ))"; done
```

Expected: `index-*.js` (entry) ≤ 110 KB gzip; `GlobeView-*.js` 150–200 KB gzip; no chart.js or react-globe.gl chunks.

Confirm no Midnight Signal leftovers:

```bash
grep -rniE "Geist|Instrument Serif|c6f135|chartreuse|Midnight Signal" src index.html || echo "clean"
```

Expected: `clean`.

- [ ] **Step 8: Manual browser pass** (`npm run dev`; also `npm run build && npm run preview` once for production routing)

- Direct-load each URL in a fresh tab: `/`, `/brief/<saved id>`, `/brief/<saved id>/signals`, `/archive`, `/settings`, `/brief/unknown`, `/nope`. Each renders its page; Back/Forward restore scroll.
- Briefing globe: hover, pin (click), Escape, click a story to scroll; drag with momentum.
- Cursor modes: default, link, text, globe readout.
- Time zone: switch to `Asia/Tokyo` in Settings; nav clock, masthead, timeline labels, globe panel times and Archive compare dates all show JST.
- Reduced motion (OS setting): no intro, rotating words, liquid effect, spin, or custom cursor.
- 375px width: Home, Story, Signals, Archive and Settings have no horizontal scroll.
- Print from Archive: the print preview shows ink-on-white briefing content without the nav, globe or Ask field.
- WebGL disabled: static globe fallback on Home and Story.

- [ ] **Step 9: Commit**

```bash
git add -A frontend
git commit -m "feat(ui): restyle Archive and Settings, CSS toasts, remove legacy tokens and framer-motion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
