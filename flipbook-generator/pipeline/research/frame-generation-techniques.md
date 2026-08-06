# Techniques for generating flipbook/GIF frames from a reference image with AI (research, Aug 2026)

Goal: reference drawing → 12–36 consistent animation frames. Findings from three research sweeps: (A) reference-conditioned image-editing models, (B) video-generation models, (C) diffusion/control + research-grade techniques.

---

## Family 1: Multi-reference image-editing models (Nano Banana, gpt-image, Flux Kontext, Qwen-Image-Edit, Seedream)

### 1a. Sprite-sheet-in-one-image (grid mode)
Prompt a single generation for an N×M grid of sequential frames, slice with Pillow, assemble GIF.

- Best writeup: Mike Esteban, "Animating GPT-4o image grids" — https://mikeesto.com/posts/animating-gpt4o-image-grids/ (code: https://github.com/mikeesto/gif4o)
  - Winning prompt phrasing (mimics OpenAI's "Organized Objects" style, ~85–90% grid compliance): *"A square image containing a 3 row by 4 column grid. Each cell in the grid is a sequential frame in an animation. The animation shows [X]"*
  - 1024×1536 → 3×4 grid = 12 frames at ~341×384px; ≈ $0.06/generation ≈ $0.005/frame (vs ~$0.04/frame sequential), one call instead of 12.
- Nano Banana sprite sheets work via direct prompting ("6-frame side-view walk cycle, horizontal sprite sheet, consistent proportions"). Guide: https://rosebud.ai/blog/how-to-create-a-sprite-sheet-with-ai-using-google-gemini-and-nano-banana-easy-guide — fix-up prompts: "Align all frames on the same baseline", "Match exact character proportions".
- Academic precedent: Sprite Sheet Diffusion (arXiv 2412.03685) generates all frames as one concatenated image *specifically* for consistency.
- Pros: single cheap call; shared global attention → no compounding drift. Cons: low per-frame resolution; ~12–16 frame cap; occasional grid non-compliance (validate cell count, retry); background/prop flicker between cells; cell misalignment jitter (crop ~5% margins, align baselines).

### 1b. Keyframe chaining (frame N = edit of frame N−1)
- Well-documented failure modes: cumulative identity drift after ~5–10 chained edits; Nano Banana specifically accumulates softening + yellow/warm tint over successive edits (https://www.dzine.ai/blog/fix-nano-banana-pro-issues/, https://discuss.ai.google.dev/t/nano-banana-pro-image-quality/134922).
- Mitigations: always pass the ORIGINAL reference alongside the previous frame; re-anchor the chain periodically; edit only the moving parts.

### 1c. Reference + predecessor jointly ("pair-pinning") — current best practice
Every frame conditioned on BOTH the fixed identity reference and an adjacent frame/bracketing keyframe pair — decouples time-invariant appearance from time-varying pose.

- **Academic validation: arXiv 2607.17985** "Keyframe-Anchored Identity Preservation for Sequential-Action Video Generation" (July 2026) — training-free 3-stage pipeline: (1) rewrite action captions to specify each keyframe's *terminal state*; (2) generate keyframes conditioned jointly on reference + predecessor; (3) synthesize in-betweens with multi-reference guidance. **This is essentially the architecture already in this repo's hybrid pipeline.**
- Pros: in-betweens parallelize; drift can't compound past a keyframe. Cons: models sometimes copy the reference pose too literally — describe the pose delta explicitly, state the reference is for identity/style only.

### 1d. Native sequence mode — Seedream 4.0/4.5 "Sequence Mode" (ByteDance)
The only first-class API for consistent image sets: up to 10 reference images in → up to 15 mutually-consistent full-res images out, one request. On fal, Replicate, Scenario, BytePlus ModelArk (`max_images` param, https://docs.byteplus.com/en/docs/ModelArk/1824121). A 24–36 frame book needs 2–3 chained sequence calls. Motion granularity is coarser (pose variation more than true in-betweening).

### Consistency tricks (cross-cutting)
- Multi-ref sweet spot for Nano Banana Pro: **4–6 clean references** (7+ causes feature-averaging). Refs ≥1024px, even lighting.
- Generate a **character reference sheet** (front/45°/90° in one image) first; use it as the persistent reference.
- **Token locking**: reuse verbatim descriptive tokens every frame ("jagged 2-inch scar across left cheekbone", never paraphrased). Define character fully once; later prompts describe only the pose delta.
- "Maintain exact same X, Y, Z" positive phrasing; these models handle negations poorly.
- Seed control: works on open-weight (Flux Kontext dev, Qwen-Image-Edit); not available/reliable on Gemini or gpt-image.
- Guides: https://prompting.systems/blog/nano-banana-pro-character-consistency-guide, https://help.apiyi.com/en/nano-banana-pro-face-consistency-guide-en.html

---

## Family 2: Video models → extract frames

### 2a. Image-to-video, then downsample
| Model | Notes | ~Cost |
|---|---|---|
| Kling 2.x/3.0 | Best price/quality; better than Veo for anime/stylized; start+end frame mode | ~$0.07–0.10/s |
| Veo 3/3.1 | Best raw quality but photorealism-biased (adds shading/texture to flat sketches) | $0.15–0.75/s |
| Runway Gen-4/4.5 | Motion brush + keyframe motion paths (fine gesture control); no end-frame pinning | ~$0.15/s |
| Wan 2.2–2.6 (open) | Best open-weight I2V; Apache 2.0 (2.2); handles stylized content well | ~$0.02–0.05/s hosted |
| LTX-Video/LTX-2 (open) | Fastest, very cheap; free commercial <$10M revenue | very cheap |
| CogVideoX-5B I2V | Native 8fps = flipbook-convenient (~48 frames, no downsampling); older quality | cheap/free |

Frame extraction: `ffmpeg -i clip.mp4 -vf "fps=6" frame-%02d.png`; dedupe held poses with `-vsync vfr -vf mpdecimate`; GIF via palettegen/paletteuse.

Artifacts on sketch input: line boiling (per-frame redraw jitter — sometimes desirable for the flipbook aesthetic), morphing over >5s clips, background hallucination, style enrichment on photoreal-biased models.

### 2b. First+last-frame conditioning (video-model pair-pinning)
- **Wan FLF2V** (open) — first/last-frame-to-video; fal: $0.20 (480p) / $0.40 (720p) per segment; free locally via ComfyUI (`video_wan2_2_14B_flf2v`).
- **Kling Start/End Frames** — https://kling.ai/quickstart/ai-video-start-end-frames
- **Pika 2.2 Pikaframes** — up to **5 chained keyframes in one job** with per-transition prompts/durations — the most flipbook-shaped commercial feature. fal: `fal-ai/pika/v2.2/pikaframes`.
- **Luma Dream Machine** keyframes (start and/or end image).

### 2c. ToonCrafter — cartoon-specific generative interpolation
SIGGRAPH Asia 2024; two toon keyframes → up to 16 frames at 512×320; optional sketch guidance of middles; the only model *trained on cartoon data* for this. **Replicate `fofr/tooncrafter` ≈ $0.027/run** — cheapest per-segment option found. Limits: low res (upscale after), 16 frames, occasional smearing. https://doubiiu.github.io/projects/ToonCrafter/

---

## Family 3: Diffusion/control + research-grade

### 3a. AnimateDiff + IP-Adapter + ControlNet (SD 1.5/SDXL)
Temporal-attention motion module denoises all ~16 frames jointly (extendable via sliding windows); IP-Adapter injects the reference identity; per-frame ControlNet (OpenPose/LineArt) dictates motion. Most mature in ComfyUI (AnimateDiff-Evolved); hosted: fal `fast-animatediff`, Replicate AnimateDiff→interpolator recipe. Best flicker-free consistency of SD-era methods and the most *controllable* open option for stylized loops, but SD1.5-centric, 512–768px, real workflow complexity.

### 3b. Per-frame ControlNet img2img loop
Author motion as pose skeletons/lineart per frame (Blender rigs, DWPose extraction), batch img2img with fixed seed + reference conditioning. Total authorial control over exact poses/frame count, but per-frame independence causes flicker unless combined with 3a.

### 3c. Flow-based interpolation multipliers: RIFE / FILM
Make 4–6 keyframes, interpolate 2–8× to fill. Replicate `google-research/frame-interpolation` (FILM — designed for large motion), fal `fal-ai/rife`, ComfyUI-Frame-Interpolation. Cheap, deterministic, zero identity drift — but flow models assume photographic continuity: on line art they ghost/break lines on large pose changes (the exact failure that motivated ToonCrafter). Best when keyframes are already close. DAIN is obsolete.

### 3d. Pixel-art/sprite-specific services
- **Retro Diffusion** (https://retrodiffusion.ai/) — pixel-art model family with animation product (walk cycles, 8-direction rotations, VFX), has an API.
- **PixelLab** (https://www.pixellab.ai/) — skeleton-based animation of generated characters, sprite-sheet export, Aseprite plugin.
- Seele AI sprite tool outputs PNG strips + JSON frame metadata.

### 3e. Vector/stroke-based (relevant to the existing vector-stroke experiment)
- **LiveSketch** (diffvg + score distillation from a video model) — animates a *user's vector sketch* directly; slow per-sketch optimization.
- **Chat2SVG** (CVPR 2025), **SOLA**, **LiveSVG** — LLM/video-distillation → animated SVG; research-grade.
- Direct LLM stroke transforms (what this repo already tries): works for rigid/affine motion, struggles with occlusion, 3D turns, organic deformation. Perfect consistency by construction; frame count free via path lerping.

### 3f. Sketch inbetweening research lineage (the frontier for exactly this problem)
- **AnimeInbet** (ICCV 2023) — vertex-graph matching of line art keyframes → clean vector-like in-betweens.
- **LVCD** (SIGGRAPH Asia 2024) — you author a lineart frame sequence + 1 colored reference; it colorizes the whole sequence consistently (pairs with 3b).
- **AniDoc** (CVPR 2025) — reference image + sketch sequence → colorized animation; sparse mode interpolates from just start/end sketches. Code: yihao-meng/AniDoc.
- **ToonComposer** (Tencent ARC, arXiv 2508.10881) — current SOTA "generative post-keyframing": 1 colored reference + sparse keyframe *sketches* (as few as one) → full consistent cartoon sequence, DiT-based with sketch injection. HuggingFace demo/code; not mainstream-hosted yet.

---

## Practicality ranking for this repo (single sketch → 12–36 frame flipbook)

1. **Current hybrid pipeline is independently validated** — arXiv 2607.17985 describes the same shape (reference-anchored keyframe chain + pinned in-betweens). Worth adopting from it: terminal-state keyframe prompt rewriting, token locking, ≤6 references.
2. **ToonCrafter between existing keyframes** — ~$0.03 per 16-frame segment on Replicate; cartoon-native; cheapest quality upgrade to in-betweening.
3. **Wan FLF2V or Kling start/end** — video-model pair-pinning, $0.20–0.40/segment; real temporal coherence at the cost of some art-style softening.
4. **Pika 2.2 Pikaframes** — 5 keyframes → whole sequence in one call.
5. **Grid mode (gpt-image / Nano Banana)** — cheap single-call fallback for 12-frame books; validate grid compliance programmatically.
6. **Seedream Sequence Mode** — 15 consistent separate images per call; good keyframe generator.
7. **Watch: ToonComposer / AniDoc** — reference + sparse sketches → full sequence; the research frontier, runnable but not hosted.

Scraped source dumps from the image-editing sweep are in `.firecrawl/`. Pricing figures are from aggregator blogs/platform pages — verify on the model page before budgeting.
