# Flipbook UI: canvas thumb-flip simulation — implementation plan

Replace the flat "current page in a box" viewer with a single 2D canvas that
draws a physical flipbook: a stack of pages bound at the top, and the page under
your thumb bowing, loading, and springing free as you drag or flick. The
existing interaction model (float page position, flick momentum, play loop,
keyboard stepping) stays; only the rendering and the release timing change.

Fallback point: commit `17b5696` on `claude/flipbook-animation-planning-k5wumf`.

**Status (2026-09-10): implemented.** All five milestones landed on
`claude/flipbook-canvas-flip-ui`; see §9 for what differs from the plan.

---

## 1. What "feels like a flipbook" — the behaviours to reproduce

1. **Stack with thickness.** The unflipped pages sit under the current one as
   a stack of thin edge lines at the bottom; the flipped pages pile up at the
   top, bent back over the binding. The two piles change size as you go.
2. **Load, then spring.** Dragging the thumb doesn't rotate the page like a
   door. The page *bows* (its free edge lags and curves) as tension builds,
   holds, then snaps past the thumb and slaps flat on the flipped pile with a
   small overshoot and settle.
3. **Riffle.** A fast flick releases pages in a rapid burst: several pages in
   flight at once, each a few frames behind the last, with a motion smear.
4. **Never lose the page.** At rest the current page is fully flat and
   unwarped — the image the user generated is always readable.

Everything else (shadows, paper texture, a drawn thumb) is polish.

---

## 2. Architecture

```
FlipbookPage.tsx
  └─ FlipbookCanvas            (new; replaces Scrubber's <div class="page-view">)
       ├─ useFlipPhysics()     (new; pure state machine, no rendering)
       ├─ page textures        (per-page offscreen canvases: image, boiled)
       └─ draw()               (rAF loop: stack → in-flight pages → current page)
  └─ filmstrip + play button   (kept from Scrubber, now just drives the physics)
```

- **`useFlipPhysics`** owns `pos` (float page index, as today), plus a list of
  *in-flight* pages `{ index, t, velocity }` where `t ∈ [0, 1]` is flip
  progress. It exposes `dragTo(pos)`, `release(velocity)`, `step(dt)`,
  `playAt(fps)`, `stop()`. It is pure TS with no canvas access, so it can be
  unit-tested with vitest.
- **`FlipbookCanvas`** subscribes to the physics state and draws. It never
  mutates physics.
- The filmstrip strip, play button, keyboard handler, speed and wobble sliders
  are unchanged from `Scrubber.tsx`; they now call the physics hook instead of
  `setPosition`.

### Files

| File | Change |
|---|---|
| `src/client/flip/physics.ts` | new — spring/tension state machine |
| `src/client/flip/physics.test.ts` | new — vitest coverage for load/release/riffle |
| `src/client/flip/bend.ts` | new — strip warping math (page image → bowed page) |
| `src/client/flip/textures.ts` | new — per-page offscreen canvases, boil pre-pass |
| `src/client/components/FlipbookCanvas.tsx` | new — canvas + rAF draw loop |
| `src/client/components/Scrubber.tsx` | slimmed: strip + play + keys drive physics; `page-view` replaced by `FlipbookCanvas` |
| `src/client/components/BoilCanvas.tsx` | kept for the shader; exposed as a render-to-texture helper instead of a component |
| `src/client/Main.css` | book sizing, remove `.page-view` aspect box |

---

## 3. The physics model (`physics.ts`)

State:

```ts
type FlipState = {
  pos: number;               // resting page index (float while scrubbing)
  tension: number;           // 0..1, how far the current page is bowed under the thumb
  inFlight: Flight[];        // pages that have released and are still moving
  mode: "idle" | "drag" | "riffle" | "play";
};
type Flight = { index: number; t: number; v: number; dir: 1 | -1 };
```

Rules (all tunable constants live in one `TUNING` object):

- **Drag → tension.** While dragging, `pos` follows the pointer as today, but
  the *rendered* page doesn't flip until the fractional part crosses
  `RELEASE_AT` (≈0.55). Below that, `tension = frac / RELEASE_AT` and the page
  bows. Crossing it converts tension into a `Flight` with initial velocity
  `RELEASE_V` and the page snaps over.
- **Release / flick.** On pointer-up with velocity `v` (pages/ms, already
  measured in `Scrubber.tsx`), momentum continues as today, and every page
  boundary crossed spawns a `Flight`. Flights spawn no faster than
  `MIN_FLIGHT_GAP` ms apart so a riffle reads as a burst, not a blur of one
  frame.
- **Flight integration.** Each flight: `t += v·dt; v += SPRING·(1 − t)·dt −
  DAMP·v·dt` so it accelerates toward flat, overshoots slightly past `t = 1`
  (rendered as the page pressing into the pile), and settles. Flights are
  removed when `|t − 1| < ε` and `|v| < ε`.
- **Backwards.** Dragging left lifts pages off the flipped pile with `dir =
  -1`; same math mirrored. Momentum backwards riffles the top pile.
- **Play.** `playAt(fps)` advances `pos` at `fps` pages/s and spawns a flight
  per page, so the play loop *looks* flipped, not cross-faded. At high fps
  (> ~14) flights overlap into a natural riffle.
- **Clamping.** `pos` clamps to `[0, n−1]` as today; at the ends the page bows
  but can't release (a little "resistance" feel for free).

Vitest cases: drag below threshold bows and springs back on release; drag past
threshold releases exactly one flight; a flick at velocity `v` spawns
`floor(distance)` flights spaced ≥ `MIN_FLIGHT_GAP`; play at 12 fps produces
12 flights/s; flights always settle; clamps hold at both ends.

---

## 4. Rendering (`FlipbookCanvas.tsx`, `bend.ts`)

Canvas sized to the book's display size × `devicePixelRatio`. Draw order each
frame:

1. **Board and bottom pile.** A rounded rect for the book, then one thin line
   per unflipped page along the bottom edge, offset 1 px each (cap the drawn
   count at ~24; beyond that, scale the offset). This gives thickness and shows
   progress.
2. **Top pile.** Flipped pages drawn as a compressed stack of edge lines above
   the binding, bent back (a short curved strip per page).
3. **Current page, flat.** `drawImage` of the page texture, full size. If the
   page is bowing (tension > 0) it is drawn via the strip warp instead.
4. **In-flight pages**, oldest first, each via the strip warp at its `t`.
5. **Binding.** Two staples or a spiral drawn over the top edge, so pages
   visibly hinge from something.

### The strip warp (`bend.ts`)

A page hinged at the top with progress `t` and bow amount `b`:

- Split the page image into `N` horizontal strips (N ≈ 32; fewer while
  riffling, more at rest-with-tension).
- Strip `i` at normalized height `y = i/N` maps to a point on a curve. Model
  the page as a quarter-cylinder of radius `r = R0 + (1 − b)·R1` peeling from
  the hinge: the flat portion of the page stays in place; beyond the peel point
  the strip's vertical position folds back with `y' = hinge + sin(θ)·r`,
  scale `sy = cos(θ)`, where `θ = t·π·min(1, y / peel)`.
- Draw each strip with `drawImage(src, 0, sy0, w, sh, 0, dy, w, dh)` where
  `dh = sh·sy` (vertical squash gives the foreshortening; horizontal stays 1
  because the hinge is horizontal). Strips with `sy < 0` are the back of the
  page: draw them as blank paper with a light gradient rather than a mirrored
  image (real flipbook backs are blank).
- Shade: a vertical gradient overlay whose darkness follows `1 − cos(θ)`, so
  the curl reads as depth without any 3D.
- Motion smear during riffle: draw in-flight pages with `globalAlpha` scaled
  by `1 / (1 + |v|·SMEAR)` and, at very high `v`, draw two strips of the same
  page at `t` and `t − v·dt` for a cheap blur.

Performance target: 60 fps at 1024 px pages on a mid phone. Strips are
`drawImage` calls (GPU-backed), 32 strips × ≤ 4 in-flight pages ≈ 160
draws/frame. Cache each page's texture as an offscreen canvas once.

### Boil layer

The boil is currently a WebGL fragment shader on the visible page. Keep the
shader, but run it as a **pre-pass**: `textures.ts` renders each page through
the shader to an offscreen canvas at a stepped seed, producing the boiled
texture the 2D canvas then warps. Re-render the current page's texture every
~110 ms (the existing boil clock); in-flight pages use their last texture (they
move too fast for the boil to read anyway). This keeps wobble and flip
independent and avoids a second GL context.

---

## 5. Milestones

1. **Physics + tests** (½ day). `physics.ts`, `physics.test.ts`, `TUNING`.
   Nothing visual yet; `wasp test client` green.
2. **Flat canvas book** (½ day). `FlipbookCanvas` draws board, piles, current
   page flat, binding. Wire scrubber/play/keys to physics. At this point the
   app already looks like a book, just without the flip motion.
3. **Strip warp + flights** (1 day). `bend.ts`, in-flight rendering, tension
   bow on drag, overshoot settle. Tune `TUNING` by hand on the duck.
4. **Riffle + smear + boil pre-pass** (½ day). Burst spacing, smear, boil
   texture pass. Wobble slider works again.
5. **Polish** (½ day). Shadow under the lifting page, paper edge shading,
   draft-frame treatment while generating (drafts render slightly greyed so
   the "rough cut" reads as such), reduced-motion preference (skip flights,
   just swap pages), mobile touch check.

Total ≈ 3 days. Each milestone is independently shippable behind the current
viewer: `FlipbookCanvas` can be toggled against the old `page-view` with a
query flag until milestone 3 lands.

---

## 6. Tuning constants (starting values)

```ts
export const TUNING = {
  RELEASE_AT: 0.55,      // fraction of a page-drag at which the page snaps
  RELEASE_V: 6,          // flip progress per second at release
  SPRING: 40,            // acceleration toward flat
  DAMP: 9,               // velocity damping
  OVERSHOOT: 0.08,       // how far past flat a page presses before settling
  MIN_FLIGHT_GAP: 28,    // ms between spawned flights in a riffle
  STRIPS_REST: 32,
  STRIPS_RIFFLE: 12,
  SMEAR: 0.6,
  BOW_MAX: 0.35,         // max bow (0 = rigid card, 1 = full curl) at tension 1
  EDGE_PX: 1,            // pile thickness per page
  MAX_EDGE_LINES: 24,
};
```

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Flip reads as a rotating card, not paper | Bow amount and back-of-page shading are the key knobs; milestone 3 ends with a side-by-side against a real flipbook video |
| Riffle at 24 fps turns to mush | `MIN_FLIGHT_GAP` + smear; above ~18 pages/s only every other page needs a full flight |
| Mobile frame drops | Lower strip count while riffling; cap in-flight pages at 4, older ones snap flat |
| Boil + warp double cost | Boil pre-pass only for the resting page; flights reuse cached textures |
| Accessibility regression (canvas is opaque) | Keep the filmstrip `role="slider"` with `aria-valuenow`, keyboard stepping, and `prefers-reduced-motion` swap mode |

---

## 8. Out of scope for this branch

Sound on flip, a drawn thumb, printable PDF export, and any change to
generation. Those stack cleanly on top once the canvas book is in.

---

## 9. As built

- Files landed as planned, except `BoilCanvas.tsx` was removed rather than
  kept: its shader now lives in `flip/textures.ts` as `BoilRenderer`, a
  render-to-texture helper the 2D book draws from.
- Physics differences: time is in ms throughout, the `TUNING` values were
  rescaled accordingly (see `physics.ts`), and the covers allow a partial
  bow (95% of a release) so pulling at either end has resistance.
- The page *underneath* a lifting page is drawn, so a bow reveals the next
  frame the way a real flipbook does.
- Riffle smear is a ghost of the same page one frame behind at 45% alpha,
  plus alpha that falls with flight speed; it kicks in above 6 flips/s.
- Verified headlessly with puppeteer-core against the running app: rest,
  loaded bow, flight, landing, riffle, play, backward flight, mobile-width
  touch riffle, and the boil pre-pass (frames differ with wobble on and are
  identical with it off). Vitest covers the physics (14 cases).
- Not done: a side-by-side against a real flipbook video (milestone 3's
  tuning check) — the constants were tuned by eye on the duck only.
