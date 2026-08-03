# Flipbook Generator — Product & Technical Plan

Draw a quick sketch on a small canvas, type a motion prompt ("make the duck dive
under the water"), and get back a hand-drawn flipbook: a sequence of frames in your
sketch's style that animate the motion. The flipbook is played by **scrubbing a
slider** under the image — thumbnails below, and dragging left/right flips the pages,
just like thumbing a physical flipbook.

---

## 1. The core loop

```
draw (tiny canvas, black pencil) → prompt the motion → generate 8–12 frames
→ scrub the slider to flip → share / export
```

Two earlier ideas get repositioned around this loop:

- **Motion is the product.** The prompt describes *what happens* ("the duck dives"),
  so frames must actually progress — this is keyframe animation, not just jitter.
- **Wiggle/boil becomes free polish, not the product.** Hand-drawn-style AI frames
  already "boil" naturally (every frame is re-drawn). A cheap client-side noise-warp
  (see §6) remains useful as an instant-preview toy and to add life to held frames,
  but it's no longer the MVP centerpiece.

---

## 2. Input: the drawing canvas

Deliberately minimal — the constraint *is* the charm (this is the Draw Something /
skribbl.io aesthetic, and it keeps generation quality predictable):

- Small square canvas, e.g. **512×512 backing store displayed at ~320 px**, white
  background.
- **One tool:** black pencil, fixed ~4 px round-cap stroke. No colors, no eraser
  beyond **Undo** (pop last stroke) and **Clear**.
- Pointer Events so mouse/touch/stylus all work; strokes stored as point arrays and
  rendered with quadratic smoothing (midpoint method) so lines look decent.
- Export `canvas.toPNG()` as the generation input. Storing the stroke data too is
  cheap and enables later features (re-draw at higher res, vector jitter, remix).

Below the canvas: a single prompt field with placeholder text like
*"What happens next? e.g. 'the duck dives under the water'"* and a frame-count
choice (8 / 12). That's the whole input UI.

---

## 3. Frame generation: sketch + motion prompt → N coherent frames

This is the hard part. The frames must (a) stay in the user's sketch style, (b) keep
the subject consistent, and (c) actually progress through the described motion.
Ranked approaches:

### Approach 1 — Sprite-grid one-shot (primary for MVP)
Ask an instruction-following image model (Gemini image / gpt-image-1 / Flux Kontext
class — all take an input image + instruction) for **one image containing the whole
animation as a grid**:

> "Using this black-line pencil sketch as frame 1, draw a 2×4 grid of 8 sequential
> animation frames, same style, same character, white background, thin margins
> between cells: the duck dives under the water, ending fully submerged with ripples."

Then slice the grid into frames server-side.

- **Why it wins:** consistency *within a single generation* is far better than
  across independent generations — same style, same character, no drift. It's also
  **one** model call: cheapest (~$0.03–0.08 total) and fastest (one round-trip).
- **Weaknesses & mitigations:** models are sloppy about grid geometry. Request fixed
  aspect + margins, then slice robustly (project ink onto rows/columns to find
  gutters rather than trusting exact cell math; normalize each cell to the canvas
  size). Occasionally the model returns 7 or 9 cells — detect and retry, or pad by
  duplicating the last frame. Cap at 8–12 frames; ask for two grids if more.

### Approach 2 — Iterative edit chain (quality tier / fallback)
frame[n+1] = imageEdit(frame[n], "advance the animation one step: <motion>, step
n+1 of N, keep the exact same pencil style"). Modern edit models hold character
identity well frame-to-frame.

- Pros: each transition is smooth; frame count is exact; can go beyond 12 frames.
- Cons: N sequential calls (latency adds up — can't parallelize a chain), N× cost,
  and drift *accumulates* — mitigate by always passing frame 1 as a style/identity
  reference alongside frame n, and by prompting with "step n of N" so the model
  paces the motion instead of finishing it in frame 3.

### Approach 3 — Keyframes + interpolation
Generate 3–4 keyframes (start = user sketch, middle, end via image edit), then
in-between with a frame-interpolation model (FILM/RIFE). Cheap way to get 16–24
smooth frames — but interpolators produce ghosty cross-fades on sparse line art, so
treat as an experiment, not a dependency.

### Approach 4 — Image-to-video (v2 premium)
Start-image + motion-prompt video models (Kling / Veo / WAN class) → extract ~12
evenly spaced frames. Great motion physics, but weakest at *preserving pencil-sketch
style* (output tends photoreal/rendered), slower, and 5–15× the cost. Optionally
re-stylize extracted frames back to line art (edge-detect or img2img). Ship later as
the "smooth mode" upsell.

**MVP call:** Approach 1 with automatic retry, Approach 2 behind a "higher quality"
option. Always prepend the user's original sketch as frame 1 of the flipbook so the
animation visibly starts from *their* drawing.

---

## 4. The scrubber player (signature UI)

The flipbook isn't autoplayed video — it's **flipped by hand**. One component:

```
┌──────────────────────────┐
│                          │
│      current frame       │   ← big image, swaps instantly
│                          │
└──────────────────────────┘
 [▶]  ▁▂▃▄▅▆▇ filmstrip ▇▆▅▄▃▂▁
      ┌─┬─┬─┬─┬─┬─┬─┬─┐
      │1│2│3│4│5│6│7│8│      ← small thumbnails, current one highlighted
      └─┴─┴─┴─┴─┴─┴─┴─┘
            ▲ scrubber handle
```

- **Mapping:** the strip is a slider; pointer x → `frameIndex = floor(x / stripWidth
  * N)`, clamped. Scrubbing swaps a preloaded `<img>` (or draws to a canvas) — no
  video element, so frame changes are instant and frame-exact.
- **Feel is everything:**
  - Preload/decode all frames up front (they're small) so scrubbing never stutters.
  - **Flick momentum:** on release, take pointer velocity and keep advancing frames
    with decay (`requestAnimationFrame`), so a quick swipe "riffles" the pages like
    a real flipbook. This detail is the demo.
  - Optional page-flip flourish: a subtle corner-curl overlay + soft *fffp* paper
    sound on fast scrubs (respect mute).
  - Snap to nearest frame on release; arrow keys step ±1; `aria-valuenow` for a11y.
- A small **play button** for a normal 8–12 fps ping-pong loop (`1‥N‥1`) exists for
  people who just want to watch — but scrubbing is the primary interaction, and
  it's also what makes the embed/share page fun (recipients scrub it themselves).
- While generation runs, thumbnails fill in left-to-right as frames land (frame 1 —
  the user's own sketch — is there from the start), so the strip doubles as the
  progress indicator. Scrubbing already-arrived frames during generation is a
  delightful touch and hides latency.

---

## 5. UX flow (MVP)

1. **Create:** draw on the canvas → type motion prompt → pick 8 or 12 frames → Go.
2. **Generate:** scrubber appears immediately with frame 1 = the sketch; remaining
   thumbnails stream in (Approach 1 usually lands all at once after one call;
   Approach 2 streams frame by frame).
3. **Flip & tweak:** scrub to play. Buttons: *Regenerate* (same sketch, new seed),
   *Continue the story* (append: last frame becomes the new "frame 1" with a new
   prompt — flipbooks become multi-scene), *Add wiggle* (client-side boil, §6).
4. **Share/export:** publish to the public **library** (§5a) and/or share a direct
   link — both render the scrubber, GIF / MP4 export, and the **printable PDF
   flipbook** (n-up with cut/staple margins — physical flipbooks from your kid's
   duck doodle is the gift/classroom killer feature).

---

## 5a. The library (shareability engine)

A public, browsable gallery of everyone's flipbooks — this is the discovery surface
that makes the product self-marketing:

- **Card grid**, and every card is a *live mini-scrubber*: hovering (desktop) or a
  thumb-swipe on the card (mobile) riffles that flipbook right in the grid. Cards
  autoplaying on scroll-into-view is the cheaper fallback, but scrub-in-place is the
  memorable version. Cards show title, author, frame count, and flip/remix counts.
- **Browse tabs:** Newest / Trending (flips + remixes over a time window) / Staff
  picks. Search and tag filters (auto-tag from the prompt) can wait for v1.1.
- **Detail page** = the share page: full-size scrubber, the prompt, the original
  sketch (before/after is half the fun), author link, and the two growth buttons:
  - **Remix** — opens the *original sketch strokes* in your canvas with the prompt
    prefilled; edit either and regenerate. `parentId` already in the data model
    threads remix lineages ("see 12 remixes of this duck").
  - **Continue the story** — start a new scene from the last frame.
- **Publishing model:** creations are **private by default**; publishing to the
  library is an explicit action and requires an account (anonymous users can create
  and link-share, which keeps the try-it funnel frictionless while gating the public
  surface). Unlisted link-sharing stays available for people who don't want the
  gallery.
- **SEO/embeds:** each public flipbook gets an OG-image (animated GIF preview) and
  an oEmbed/iframe embed of the scrubber — flipbooks embedded in blogs/tweets link
  back to the library.
- **Moderation is the price of the library:** publish action runs prompt + image
  checks; report button on every card; simple review queue (approve/remove/ban)
  from day one — a kid-adjacent public gallery cannot launch without this.
- **Metrics that matter:** % of creations published, remix rate, and
  visitor→creator conversion from library pages (each card is a "make your own" ad).

---

## 6. Wiggle layer (kept, demoted to polish)

Client-side WebGL noise-warp (Perlin displacement, 1–3 px, per-frame seeds) from the
original plan stays as: (a) an instant "make it wiggle" toy on the bare sketch before
generation — something fun to look at during the wait, (b) optional boil on top of
generated frames, (c) the zero-cost free-tier fallback when a user is out of credits.
The vector-jitter variant (potrace + control-point wobble) is a nice later upgrade
since we already store stroke data.

---

## 7. Architecture

Full-stack **Wasp** app (React + Node + Prisma):

- **Client:** canvas component (pointer events + stroke stack), scrubber component
  (preloaded frames + momentum), WebGL wiggle shader, wasm-ffmpeg/gif.js for
  client-side GIF of small flipbooks.
- **Server:** Wasp action `createFlipbook(sketchPng, prompt, frameCount)` enqueues a
  **pg-boss job**: call image model (Approach 1) → slice grid (sharp: ink-projection
  gutter detection) → validate frame count (retry once on mismatch) → upload frames
  to S3/R2 → mark ready. Export jobs: ffmpeg (MP4/GIF), pdf-lib (print PDF).
- **Progress:** client polls a `getFlipbook` query (or WebSocket) and fills the strip.
- **Providers:** thin interface over fal.ai / Replicate / direct APIs so the
  grid-model and edit-model are swappable; log cost per generation from day one.
- **Moderation:** prompt filter + provider safety checker + private-by-default,
  report button on share pages.

### Data model sketch
```
User        (auth, credits)
Flipbook    (owner, title, prompt, frameCount, strokesJson, sketchUrl,
             mode[grid|chain|video], status,
             visibility[private|unlisted|published], publishedAt, tags,
             flipCount, remixCount, parentId → remixes/scenes)
Frame       (flipbookId, index, url, source[user_sketch|generated])
Export      (flipbookId, kind[gif|mp4|pdf], url)
Report      (flipbookId, reporter, reason, status)   — library moderation queue
```

---

## 8. Business model

- **Free:** a few flipbooks/day (Approach 1 is cheap enough to be generous),
  watermarked GIF, public share pages, unlimited wiggle-only.
- **Credits/Pro:** more generations, 12+ frames, quality mode (Approach 2), HD & PDF
  exports, private flipbooks, "continue the story" chains.
- **Later:** smooth-motion video tier, classroom/teams plans (this is a *very*
  kid/teacher-shaped product), printed-flipbook fulfillment, API/embeds.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Grid generation returns wrong count / messy cells | Ink-projection slicing, count validation, one auto-retry, pad-with-last-frame fallback |
| Motion finishes too early (duck underwater by frame 3) | Prompt with explicit pacing ("frame 8 of 8 is the first fully submerged frame"); retry regenerates pacing |
| Style drift from the user's pencil look | Include sketch as style reference in every call; keep canvas monochrome so style is easy to match |
| Chain mode latency (sequential calls) | Stream frames into the scrubber as they land; grid mode as default |
| Prompt/content abuse in a kid-adjacent product | Strict prompt filter, provider safety checks, private by default, report + review queue |
| Scrubber feels laggy on mobile | Predecode frames (`img.decode()`), small frame sizes for preview, render full-res only on export |

---

## 10. Milestones

1. **Weekend demo:** canvas → hardcoded model call (Approach 1) → slice → scrubber
   with momentum. No auth, no DB — prove the magic loop end-to-end.
2. **MVP (1–2 wks):** Wasp app, auth, jobs + provider interface, share pages, the
   **library** (Newest tab + publish flow + report/review queue), GIF export,
   cost logging.
3. **v1.1:** Remix + Trending, printable PDF, quality mode (edit chain),
   "continue the story", wiggle layer, credits/billing, search/tags.
4. **v2:** video-model smooth mode, embeds/oEmbed, classroom plan, API.

---

## 11. Open questions

- Frame size for generation: 512² is cheap and on-style for sketches — is it enough
  for the PDF print path, or do we upscale at export (esrgan-style or vector re-draw
  from stored strokes)?
- Which instruction model is most reliable at grid layout + line-art style? (Bench
  Gemini image vs gpt-image-1 vs Flux Kontext on ~20 sketch+motion pairs before
  committing.)
- Does "continue the story" belong in MVP? It's the retention feature, but adds
  scene-chaining complexity.
- Sound on scrub: charming or annoying? Default off, A/B it.
