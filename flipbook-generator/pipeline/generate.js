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

// Optional per-frame storyboard: JSON array of N-1 strings describing frames 2..N.
// Without it, pacing relies on the generic "1/N increment" rule alone.
const shots = shotlistPath ? JSON.parse(fs.readFileSync(shotlistPath, 'utf8')) : null
if (shots && shots.length !== N - 1) {
  console.error(`Shotlist has ${shots.length} entries; need ${N - 1} (frames 2..${N})`)
  process.exit(1)
}

const STYLE_RULES = `Rules: identical hand-drawn black-line pencil sketch style as the reference images; white background; no shading; no text; no borders; ONE single frame, not a grid or sequence.
The waterline stays at exactly the same height as in the reference images. The subject stays exactly the same size and same character design. When the subject is underwater, draw it in lighter gray lines.`

function framePrompt(n) {
  const shot = shots ? `\nThis frame shows: ${shots[n - 2]}` : ''
  return `Animation: ${motion}
You are drawing frame ${n} of a ${N}-frame flipbook animation.
The FIRST attached image is the previous frame (frame ${n - 1}). The SECOND attached image is frame 1, the original sketch — match its exact drawing style and character design.
Draw the next frame: advance the motion by exactly 1/${N} of the total action — a small, even step past the previous frame. Do not finish the action early; the motion completes exactly at frame ${N}.${shot}
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

// frame 1 = the sketch itself
fs.writeFileSync(frameFile(1), sketch)
console.log(`frame 01/${String(N).padStart(2, '0')}  (sketch)`)

let prev = sketch
const startedAt = Date.now()
for (let n = 2; n <= N; n++) {
  const t0 = Date.now()
  const output = await replicate.run(MODEL, {
    input: {
      prompt: framePrompt(n),
      image_input: [prev, sketch],
      aspect_ratio: '1:1',
      output_format: 'png',
    },
  })
  const buf = await outputToBuffer(output)
  fs.writeFileSync(frameFile(n), buf)
  prev = buf
  console.log(`frame ${String(n).padStart(2, '0')}/${String(N).padStart(2, '0')}  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}

const manifest = {
  frames: Array.from({ length: N }, (_, i) => `/frames/frame-${String(i + 1).padStart(2, '0')}.png`),
  motion,
  model: MODEL,
  mode: 'sequential-edit-chain',
  generatedAt: new Date().toISOString(),
}
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`\ndone: ${N} frames in ${((Date.now() - startedAt) / 1000).toFixed(0)}s → ${outDir}`)
