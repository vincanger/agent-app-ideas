// Sequential (edit-chain) flipbook frame generation via Replicate.
//
//   node generate.js --sketch sketch.png --prompt "the duck dives under the water" \
//     --frames 12 [--shotlist duck-shotlist.json] [--out ../scrubber-demo/public/frames]
//
// Frame 1 is the sketch itself. Each subsequent frame is generated from the
// previous frame + the original sketch (style/identity anchor, drift mitigation).

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import Replicate from 'replicate'

const MODEL = 'google/nano-banana-2'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}

const sketchPath = arg('sketch')
const motion = arg('prompt')
const N = Number(arg('frames', '12'))
const outDir = path.resolve(arg('out', '../scrubber-demo/public/frames'))
const shotlistPath = arg('shotlist')

if (!process.env.REPLICATE_API_TOKEN) {
  console.error('Missing REPLICATE_API_TOKEN (put it in pipeline/.env)')
  process.exit(1)
}
if (!sketchPath || !motion) {
  console.error('Usage: node generate.js --sketch <png> --prompt "<motion>" [--frames 12] [--shotlist <json>] [--out <dir>]')
  process.exit(1)
}

// Optional storyboard: JSON array of story beats. If its length isn't exactly
// N-1, the beats are stretched proportionally across frames 2..N, so one
// storyboard works for any frame count.
const beats = shotlistPath ? JSON.parse(fs.readFileSync(shotlistPath, 'utf8')) : null

function shotFor(n) {
  if (!beats) return null
  if (N === 2) return beats[beats.length - 1]
  const idx = Math.round(((n - 2) / (N - 2)) * (beats.length - 1))
  return beats[idx]
}

const STYLE_RULES = `STYLE — this is the most important rule: the drawing must look poorly drawn, because that is the artist's style. Match the FIRST image's exact line quality: wobbly, uneven, naive, quickly-scribbled amateur pencil lines, awkward proportions and all. DO NOT clean up, refine, smooth, straighten, or beautify anything. DO NOT improve the anatomy or the line work. Every frame must look like the same untrained hand drew it in the same hurried sitting as the FIRST image. If your frame looks more skillful than the FIRST image, it is wrong.
Other rules: white background; no shading; no text; no borders or frame edges; ONE single frame, not a grid or sequence.
The waterline stays at exactly the same height as in the reference images. The subject stays exactly the same size and same character design. When the subject is underwater, draw it in lighter gray lines.`

function framePrompt(n) {
  const shot = shotFor(n)
  return `Animation: ${motion}
You are drawing frame ${n} of a ${N}-frame flipbook animation.
The FIRST attached image is frame 1: the original sketch. It is the ONLY style authority.
The SECOND attached image is the previous frame (frame ${n - 1}): use it ONLY for pose and motion continuity, NOT for style.
Draw the next frame: advance the motion by exactly 1/${N} of the total action — a very small, even step past the previous frame. Do not finish the action early; the motion completes exactly at frame ${N}.${shot ? `\nThis part of the motion: ${shot}` : ''}
${STYLE_RULES}`
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

const replicate = new Replicate()
fs.mkdirSync(outDir, { recursive: true })

const sketch = fs.readFileSync(sketchPath)
const frameFile = (n) => path.join(outDir, `frame-${String(n).padStart(2, '0')}.png`)

function writeManifest(count) {
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
    frames: Array.from({ length: count }, (_, i) => `/frames/frame-${String(i + 1).padStart(2, '0')}.png`),
    motion,
    model: MODEL,
    mode: 'sequential-edit-chain',
    total: N,
    generatedAt: new Date().toISOString(),
  }, null, 2))
}

// frame 1 = the sketch itself
fs.writeFileSync(frameFile(1), sketch)
console.log(`frame 01/${String(N).padStart(2, '0')}  (sketch)`)

// resume: skip frames that already exist on disk (--resume)
let start = 2
if (process.argv.includes('--resume')) {
  while (start <= N && fs.existsSync(frameFile(start))) start++
  if (start > 2) console.log(`resuming at frame ${start} (frames 2..${start - 1} already exist)`)
}

let prev = start > 2 ? fs.readFileSync(frameFile(start - 1)) : sketch
const startedAt = Date.now()
for (let n = start; n <= N; n++) {
  const t0 = Date.now()
  const output = await replicate.run(MODEL, {
    input: {
      prompt: framePrompt(n),
      image_input: [sketch, prev],
      aspect_ratio: '1:1',
      output_format: 'png',
    },
  })
  const buf = await outputToBuffer(output)
  fs.writeFileSync(frameFile(n), buf)
  writeManifest(n) // manifest tracks progress so partial runs are viewable/resumable
  prev = buf
  console.log(`frame ${String(n).padStart(2, '0')}/${String(N).padStart(2, '0')}  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}

writeManifest(N)
console.log(`\ndone: ${N} frames in ${((Date.now() - startedAt) / 1000).toFixed(0)}s → ${outDir}`)
