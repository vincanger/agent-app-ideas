# komorebi commits 木漏れ日

Your GitHub contribution graph, rendered as **dappled light** — sunlight leaking
through a tree canopy onto a wall.

Inspired by [“dappled light”](https://jzhao.xyz/posts/dappled-light) by Jacky Zhao.

## The idea

Instead of drawing the commit graph as a grid of green cells, each day you
contributed becomes a *gap in the leaves*. The wall behind is in shadow; light
leaks through wherever you shipped something. Brighter, larger patches mean more
contributions that day. The canopy sways in the wind — patches drift, flicker,
and gust together — while soft foliage shadows frame the scene.

The 53-week × 7-day shape of the graph stays readable, but it reads as weather,
not data.

## Try it

It's a single self-contained HTML file — no build, no dependencies:

```
open index.html            # or serve it: python3 -m http.server
```

- Type any GitHub username (or visit `?user=<name>`) to load their last year of
  contributions, fetched client-side from the public
  [github-contributions-api](https://github-contributions-api.jogruber.de).
- If the API can't be reached, it falls back to an imagined (clearly labeled)
  demo year, so the page always shows something alive. `?demo=1` forces this.

## Details worth hovering over

- **Hover** any light patch to see the date and contribution count.
- **☾ eclipse** (or press `e`): during a solar eclipse, every gap between
  leaves acts as a pinhole camera and projects a crescent sun — the observation
  at the heart of the essay. For ~25 seconds the moon slides across, the world
  darkens, and every patch of your year becomes a crescent.
- **copy link** gives a shareable `?user=` URL; **save image** downloads the
  current frame as a PNG, caption included.
- Respects `prefers-reduced-motion` (renders a still frame of the light).

## How the light works

Canvas 2D, ~365 radial-gradient blobs composited with `lighter` onto an
offscreen light layer, then `screen`-blended over a shadowed plaster wall.
Wind is layered sinusoids: a global gust envelope modulates per-blob sway
amplitude and flicker, with deterministic per-day phase/frequency jitter so the
motion is organic but reproducible. Crescents are cut per-blob with a
`destination-out` punch on a scratch canvas. Foliage shadows are large
multiply-composited soft masses with their own slower sway; film grain and a
vignette finish it.
