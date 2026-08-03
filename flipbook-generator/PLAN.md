# Flipbook Generator — Product & Technical Plan

Turn a prompt and/or an input image (photo or line drawing) into a short, looping
"flipbook" animation: a series of near-identical frames with subtle variation so the
result wiggles like a hand-drawn boiling-line cartoon (think *Squigglevision* /
Ed, Edd n Eddy / A-ha "Take On Me").

---

## 1. The core insight

There are really **two different products** hiding in this idea, and it's worth being
explicit about which one the MVP is:

1. **Wiggle / boiling-line animation** — the *content* of the image doesn't change,
   only the line quality jitters frame to frame. 3–6 frames looped at ~8–12 fps is
   enough. This is what makes static drawings feel "alive."
2. **Motion flipbook** — the subject actually *moves* (a bird flaps, a character
   walks). This needs 12–60 coherent frames and is a much harder consistency problem.

**Recommendation: build #1 first.** It's cheap, fast, has a magical demo moment, and
— crucially — a big part of it can be done *without any AI at all*, which changes the
economics completely. #2 becomes a premium tier powered by video models later.

---

## 2. Frame-generation approaches (the heart of the product)

### Approach A — Deterministic warp ("fake" boiling line) — no AI, nearly free
Take one image and produce N variants by displacing pixels with smooth noise:

- Generate 3–6 frames by warping the source image with low-amplitude, low-frequency
  **simplex/Perlin noise displacement maps** (different noise seed per frame,
  amplitude ~1–3 px). This is exactly how boiling-line effects are faked in After
  Effects (Turbulent Displace).
- Runs client-side in **WebGL/canvas** (a tiny fragment shader) or server-side with
  sharp/ffmpeg (`ffmpeg -vf displace`).
- Works *especially* well on line drawings and cel-shaded images; on photos it reads
  as a "jelly" effect, so expose amplitude/frequency sliders.
- Instant preview, zero marginal cost, fully deterministic (great for re-rendering at
  export resolution).

**Variant for line drawings (A2):** vectorize with `potrace`, then jitter the Bézier
control points per frame and re-rasterize with slightly varied stroke width. This
gives *true* line-quality variation (lines get thicker/thinner, wobble independently)
rather than a global warp — much closer to real hand-drawn boil. More work, but a
strong differentiator.

### Approach B — AI re-draw (img2img, per-frame) — the "real" AI wiggle
Each frame is the model *re-drawing* the same image, so every line is genuinely
re-interpreted — this is the authentic hand-drawn feel:

- **img2img at low denoise strength (0.15–0.35)** with the same prompt, different
  seed per frame. Structure survives, details vary.
- Lock composition with **ControlNet** (canny/lineart/scribble conditioned on the
  *original* image for every frame) so the subject doesn't drift across frames —
  without it, frame 4 can have a different face than frame 1.
- For line-drawing input: ControlNet-scribble + prompt is also how you offer
  "turn my doodle into a rendered style, then wiggle it."
- Serve via **fal.ai or Replicate** (SDXL/Flux + ControlNet endpoints). ~$0.01–0.04
  per frame → roughly $0.05–0.25 per flipbook at 4–8 frames. Latency: a few seconds
  per frame, parallelizable.

### Approach C — Video models (motion tier, later)
For real motion: image-to-video models (Kling, Runway, Luma, Veo, WAN, SVD) →
generate 2–4 s clip → extract frames → optionally re-stylize. Expensive
(~$0.05–0.50+/clip), slower, less controllable, but it's the obvious "pro" upsell.
Frame interpolation models (RIFE/FILM) can also inflate 4 keyframes into smooth
in-betweens.

### How they compose in the product
```
prompt only          → text2img base image → (A or B) wiggle frames
image upload         → (A or B) wiggle frames
line drawing upload  → A2 vector jitter, or B with ControlNet-scribble (+style prompt)
"make it move" (v2)  → C video model → frames
```
Pipeline everything through the same post-process: normalize size → assemble frames →
loop (ping-pong ordering `1-2-3-2` hides seams) → export.

---

## 3. UX flow (MVP)

1. **Input step:** upload image / draw on a small canvas / type a prompt (prompt-only
   generates a base image first, style presets: "ink sketch", "crayon", "comic",
   "watercolor").
2. **Wiggle step:** live preview using Approach A in-browser *immediately* (instant
   gratification while any AI frames generate in the background). Controls: frame
   count (3–8), fps (6–14), wobble amount, "AI redraw" toggle (Approach B).
3. **Export step:** GIF, MP4/WebM, sprite sheet — and the sleeper feature: a
   **printable PDF flipbook** (frames laid out n-up with cut/staple margins so you
   can make a physical flipbook). Nobody does this well; it's shareable and giftable.

Gallery of public creations + one-click "remix" for growth.

---

## 4. Architecture

Full-stack **Wasp** app (React + Node + Prisma) — fits the stack we know, and gives
auth, jobs, and DB out of the box.

- **Client:** React; WebGL shader for Approach-A live preview; `gif.js`/wasm ffmpeg
  for client-side GIF export of non-AI flipbooks (zero server cost for free tier).
- **Server:** Node actions kick off **Wasp jobs (pg-boss)** for AI generation:
  `generateBaseImage` → `generateFrames` (fan out, one job per frame, parallel) →
  `assembleExport` (ffmpeg for MP4/GIF, pdf-lib for print PDF).
- **Storage:** S3/R2 for uploads, frames, exports. Postgres for users/flipbooks/jobs.
- **AI providers:** fal.ai (fast SDXL/Flux + ControlNet) behind a thin provider
  interface so models are swappable; Replicate as fallback.
- **Realtime progress:** poll job status or WebSocket; frames appear in the preview
  strip as they finish.
- **Moderation:** provider safety checkers + prompt filter on upload/generation
  (user uploads + a public gallery makes this non-optional).

### Data model sketch
```
User        (auth, credits)
Flipbook    (owner, title, sourceType[prompt|upload|drawing], prompt, stylePreset,
             baseImageUrl, settings{frames,fps,amplitude,mode}, visibility)
Frame       (flipbookId, index, url, seed, generator[warp|img2img|video])
Export      (flipbookId, kind[gif|mp4|pdf|sprite], url)
```

---

## 5. Business model

- **Free:** non-AI wiggle (Approach A), watermarked GIF export, public gallery.
  Marginal cost ≈ $0 → free tier can be genuinely generous.
- **Credits/Pro:** AI redraw frames, prompt-to-flipbook, HD/MP4/PDF exports, private
  flipbooks. Credits map ~1:1 to model spend with margin (e.g. 1 credit = 1 AI frame).
- **Later:** motion tier (video models), API/embed widget, physical printed flipbook
  fulfillment (print-on-demand partner).

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Frame drift in AI mode (subject changes between frames) | ControlNet on the original image every frame; low denoise; fixed prompt; ping-pong loop hides residual jumps |
| AI cost/latency kills the demo | Approach A gives instant free preview; AI frames stream in after |
| Photos look "melty" not "hand-drawn" with warp | Offer stylize-first (img2img to sketch style) then wiggle |
| Moderation (uploads + gallery) | Provider NSFW checks, prompt filters, report button, private-by-default for uploads |
| GIF exports are huge | Default to MP4/WebM; GIF capped at 512 px |

---

## 7. Milestones

1. **Weekend demo:** upload image → WebGL noise-warp wiggle → GIF export. (All
   client-side; this alone is tweet-worthy.)
2. **MVP (1–2 wks):** Wasp app + auth + prompt→base image + AI redraw frames via
   fal.ai + jobs/queue + MP4/GIF export + gallery.
3. **v1.1:** printable PDF flipbook, line-drawing vector jitter (A2), style presets,
   credits/billing.
4. **v2:** motion tier via image-to-video, remix/gallery growth loops, API.

---

## 8. Open questions

- Canvas drawing in-app for MVP, or upload-only first? (Upload-only is less work;
  a tiny drawing pad is a big share-ability win though.)
- Which style presets convert best for the "stylize then wiggle" flow?
- Is the physical-flipbook PDF a headline feature or a nice-to-have? Worth testing
  in the landing copy.
