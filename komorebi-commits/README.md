# komorebi commits 木漏れ日

Your GitHub contribution graph, rendered as **dappled light** — flat, dithered,
and slowly breathing.

Inspired by [“dappled light”](https://jzhao.xyz/posts/dappled-light) by Jacky
Zhao, and by the flat two-tone dithered aesthetic of jzhao.xyz itself.

## The idea

Every day you contributed is a gap in a tree canopy. Sunlight leaks through the
gaps and lands as patches of light; the breeze keeps the whole pattern
shifting. Here that light field is computed from your last year of commits
(53 weeks across, 7 weekdays down, patch size and brightness from contribution
count), then pushed through **8×8 Bayer ordered dithering** into three flat
tones — navy ground, periwinkle light, and a tunable band of gold — at chunky
pixel resolution. No gradients, no glow: just pixels, like a risograph print
that happens to be alive.

## Try it

A single self-contained HTML file — no build, no dependencies:

```
open index.html            # or serve it: python3 -m http.server
```

Type any GitHub username (or visit `?user=<name>`). Contributions are fetched
client-side from the public
[github-contributions-api](https://github-contributions-api.jogruber.de); if it
can't be reached the page falls back to an imagined, clearly-labeled demo year
(`?demo=1` forces this).

## Properties

The panel under the frame exposes the live parameters, and every one of them is
written into the URL — a shared link reproduces your exact tuning:

| property | what it does |
|---|---|
| `gold start` / `gold end` | the intensity band that renders gold — slide it to rim the patches, fill their cores, or remove gold entirely |
| `breeze` | wind strength: sway amplitude, speed, and flicker — also how fast the shade clouds cross |
| `shade` | canopy shade: large slow clouds of leaf-shadow in a fourth mid-blue tone that fill the dark ground and erode the light as they pass over it |
| `dapple` | how far each day's light spreads |
| `grain` | pixel size of the dither, 2–9px |

## Details

- **Hover** a patch for the date and contribution count.
- **Press `e`**: the essay's observation is that every gap between leaves is a
  pinhole camera projecting an image of the sun — so during an eclipse, dapples
  become crescents. For ~18 seconds the moon crosses, every patch is eaten to a
  sliver, and the light comes back.
- **copy link** shares user + all property values; **save image** exports a
  framed PNG with the caption, chunky pixels intact.
- Respects `prefers-reduced-motion` (still frame, properties still live).

## How it works

Canvas 2D at field resolution (viewport ÷ grain). Each active day splats a
quadratic radial kernel into a `Float32Array` intensity field; wind is layered
sinusoids with a shared gust envelope and per-day deterministic phase jitter.
A drifting octave of value noise seeds the dark ground with speckle, and a
second, much coarser two-octave noise field — advected sideways with the
breeze — forms the canopy shade: it subtracts from the light where it passes
and dithers into its own mid-blue tone over bare ground. Per pixel,
intensity + Bayer threshold picks ground vs shade vs light, and the gold band
claims intensities between `gold start` and `gold end`. The ImageData is drawn 1:1 and
upscaled with `image-rendering: pixelated`. The eclipse subtracts a second,
offset kernel per day — a bite of moon in every pinhole.
