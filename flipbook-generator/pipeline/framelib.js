// Per-frame flipbook pipeline (see frames.js for the CLI, and the Vite
// /api/animate endpoint in ../scrubber-demo for the in-app path).
//
// Frame 1 is the user's sketch itself. Every later frame is one model call
// with two reference images: the original sketch (sole style authority) and
// the previous frame (pose continuity), plus an explicit story beat for that
// frame from the shotlist, stretched across the frames. Frames are generated
// sequentially because each one continues from the last.
//
// Compared with the sprite-sheet pipeline (sheetlib.js): full-resolution
// frames, no slicing, any frame count — at N-1 calls instead of one, and with
// the model's cross-call consistency doing the work that a single sheet's
// shared attention did for free.
//
// Output goes to a temp dir and is swapped into outDir only once every frame
// has generated, so a failed run leaves the previous flipbook untouched.

import fs from 'node:fs'
import path from 'node:path'
import Replicate from 'replicate'
import { buildInput, resolveModel } from './models.js'

const RETRIES = 2

const STYLE_NOTE = `Style: match the original drawing's line quality exactly (same stroke weight, same simple black lines on white, same character design and proportions). Keep it as loose and simple as the original; do not add shading, texture, or scenery.`

const FRAME_NOTE = `Framing: same camera, same scale, same facing direction as the previous frame. Anything static in the scene stays exactly where it was. ONE single frame on a white background — no grid, no sequence, no text, no border.`

// Stretch the shotlist across frames 2..N so any shotlist length maps onto any
// frame count; beat i belongs to frame i+2.
export function beatsForFrames(shotlist, frames) {
  const count = frames - 1
  if (!shotlist?.length) return Array(count).fill(null)
  return Array.from({ length: count }, (_, i) =>
    shotlist[Math.round((i / Math.max(1, count - 1)) * (shotlist.length - 1))])
}

function framePrompt({ k, frames, motion, beat }) {
  const step = beat
    ? `This frame: ${beat}`
    : `Advance the motion by one even step (1/${frames - 1} of the whole action past the previous frame). Do not finish early: the action completes exactly at frame ${frames}.`
  return `Draw frame ${k} of ${frames} of a flipbook animation of the attached drawing. The animation: ${motion}.
Image 1 is the original drawing (frame 1): it is the ONLY style reference. Image 2 is frame ${k - 1}, the previous frame: continue directly from its pose.
${step}
The pose must be clearly different from the previous frame — this is a flipbook page, so the motion has to visibly progress. Include the splashes, ripples, bubbles and other effects the action calls for, in the same simple line style.
${STYLE_NOTE}
${FRAME_NOTE}`
}

async function outputToBuffer(output) {
  const item = Array.isArray(output) ? output[0] : output
  if (item && typeof item.blob === 'function') {
    return Buffer.from(await (await item.blob()).arrayBuffer())
  }
  const url = typeof item === 'string' ? item : item.url()
  const res = await fetch(url)
  return Buffer.from(await res.arrayBuffer())
}

const frameName = (k) => `frame-${String(k).padStart(2, '0')}.png`

// Runs the full pipeline: sketch buffer -> N frames + manifest in outDir.
// Throws on failure; outDir is only replaced after every frame generated.
// Returns the manifest object.
export async function buildFlipbookFrames({
  sketch, motion, outDir, model, shotlist = null, frames = 16, aspect = '1:1', log = console.log,
}) {
  if (frames < 2) throw new Error('frames must be at least 2')
  const MODEL = resolveModel(model)
  const replicate = new Replicate()
  log(`model: ${MODEL}, ${frames} frames`)
  const startedAt = Date.now()

  const tmpDir = `${outDir}.tmp`
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  fs.writeFileSync(path.join(tmpDir, frameName(1)), sketch)

  async function generateFrame(k, prompt, images) {
    let lastErr
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      const t0 = Date.now()
      try {
        const output = await replicate.run(MODEL, { input: buildInput(MODEL, { prompt, images, aspect }) })
        const buf = await outputToBuffer(output)
        log(`frame ${k}/${frames}: ${((Date.now() - t0) / 1000).toFixed(1)}s`)
        return buf
      } catch (err) {
        lastErr = err
        log(`frame ${k}/${frames} attempt ${attempt} failed: ${err.message ?? err}`)
      }
    }
    throw new Error(`frame ${k}: ${lastErr?.message ?? lastErr} (previous output untouched)`)
  }

  const beats = beatsForFrames(shotlist, frames)
  let prev = sketch
  for (let k = 2; k <= frames; k++) {
    // the original drawing rides along on EVERY call as the style reference
    prev = await generateFrame(k, framePrompt({ k, frames, motion, beat: beats[k - 2] }), [sketch, prev])
    fs.writeFileSync(path.join(tmpDir, frameName(k)), prev)
  }

  fs.rmSync(outDir, { recursive: true, force: true })
  fs.renameSync(tmpDir, outDir)

  const generatedAt = new Date().toISOString()
  // version query defeats browser caching of the reused frame filenames
  const v = Date.parse(generatedAt)
  const manifest = {
    frames: Array.from({ length: frames }, (_, i) => `/frames/${frameName(i + 1)}?v=${v}`),
    motion,
    model: MODEL,
    mode: 'per-frame',
    total: frames,
    keyframes: frames,
    generatedAt,
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

  log(`done: ${frames} frames from ${frames - 1} calls in ${((Date.now() - startedAt) / 1000).toFixed(0)}s → ${outDir}`)
  return manifest
}
