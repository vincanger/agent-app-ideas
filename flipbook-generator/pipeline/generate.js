// Flipbook frame generation via Replicate (google/nano-banana-2).
//
// Modes:
//   chain  — every frame generated sequentially from the previous one
//   hybrid — a short sequential chain of K keyframes, then all remaining
//            frames as in-betweens pinned between adjacent keyframe pairs
//            (parallelized; in-betweens can't drift because both endpoints
//            anchor pose and the sketch anchors style)
//
//   node generate.js --sketch sketch.png --prompt "the duck dives under the water" \
//     --frames 36 [--mode hybrid] [--keyframes 12] [--shotlist duck-shotlist.json] \
//     [--out ../scrubber-demo/public/frames] [--resume]
//
// EVERY model call — keyframe or in-between — passes the original sketch as the
// FIRST image: it is the sole style authority on every generation.

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import Replicate from 'replicate'

const MODEL = 'google/nano-banana-2'
const CONCURRENCY = 3

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}

const sketchPath = arg('sketch')
const motion = arg('prompt')
const N = Number(arg('frames', '36'))
const mode = arg('mode', 'hybrid')
const K = mode === 'hybrid' ? Number(arg('keyframes', '12')) : N
const outDir = path.resolve(arg('out', '../scrubber-demo/public/frames'))
const shotlistPath = arg('shotlist')
const resume = process.argv.includes('--resume')

if (!process.env.REPLICATE_API_TOKEN) {
  console.error('Missing REPLICATE_API_TOKEN (put it in pipeline/.env)')
  process.exit(1)
}
if (!sketchPath || !motion) {
  console.error('Usage: node generate.js --sketch <png> --prompt "<motion>" [--frames 36] [--mode chain|hybrid] [--keyframes 12] [--shotlist <json>] [--out <dir>] [--resume]')
  process.exit(1)
}
if (mode === 'hybrid' && (K < 3 || K > N)) {
  console.error(`--keyframes must be between 3 and --frames (got K=${K}, N=${N})`)
  process.exit(1)
}

// Storyboard beats stretched proportionally across the keyframes.
const beats = shotlistPath ? JSON.parse(fs.readFileSync(shotlistPath, 'utf8')) : null
function beatFor(k) { // k = keyframe number 2..K
  if (!beats) return null
  if (K === 2) return beats[beats.length - 1]
  return beats[Math.round(((k - 2) / (K - 2)) * (beats.length - 1))]
}

const STYLE_RULES = `STYLE — this is the most important rule: the drawing must look poorly drawn, because that is the artist's style. Match the FIRST image's exact line quality: wobbly, uneven, naive, quickly-scribbled amateur pencil lines, awkward proportions and all. DO NOT clean up, refine, smooth, straighten, or beautify anything. DO NOT improve the anatomy or the line work. Every frame must look like the same untrained hand drew it in the same hurried sitting as the FIRST image. If your frame looks more skillful than the FIRST image, it is wrong.
Other rules: white background; no shading; no text; no borders or frame edges; ONE single frame, not a grid or sequence.
The waterline stays at exactly the same height as in the reference images. The subject stays exactly the same size, same character design, and keeps facing the SAME DIRECTION. When the subject is underwater, draw it in lighter gray lines.`

function keyframePrompt(k) {
  const shot = beatFor(k)
  return `Animation: ${motion}
You are drawing keyframe ${k} of ${K} in a flipbook animation.
The FIRST attached image is frame 1: the original sketch. It is the ONLY style authority.
The SECOND attached image is the previous keyframe (${k - 1}): use it ONLY for pose and motion continuity, NOT for style.
Draw the next keyframe: advance the motion by exactly 1/${K} of the total action — a small, even step past the previous keyframe. Do not finish the action early; the motion completes exactly at keyframe ${K}.${shot ? `\nThis part of the motion: ${shot}` : ''}
${STYLE_RULES}`
}

function inbetweenPrompt(pct) {
  return `Animation: ${motion}
You are drawing an IN-BETWEEN frame for a flipbook animation.
The FIRST attached image is the original sketch. It is the ONLY style authority.
The SECOND attached image is the frame BEFORE this one. The THIRD attached image is the frame AFTER this one.
Draw the single frame exactly ${pct}% of the way from the SECOND image to the THIRD image: interpolate the pose, position, and any splash/ripple/bubble shapes between the two. Do not add new story events, do not copy either endpoint exactly, and do not advance past the THIRD image.
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

async function generate(prompt, images) {
  const output = await replicate.run(MODEL, {
    input: { prompt, image_input: images, aspect_ratio: '1:1', output_format: 'png' },
  })
  return outputToBuffer(output)
}

// ---------- layout: which flipbook page each keyframe lands on ----------
const gapCount = K - 1
const totalIB = N - K
const base = Math.floor(totalIB / gapCount)
const rem = totalIB % gapCount
const gapSizes = Array.from({ length: gapCount }, (_, i) => base + (i < rem ? 1 : 0))
const kfPage = [1]
for (let i = 0; i < gapCount; i++) kfPage.push(kfPage[i] + 1 + gapSizes[i])

// ---------- output helpers ----------
fs.mkdirSync(outDir, { recursive: true })
const frameFile = (p) => path.join(outDir, `frame-${String(p).padStart(2, '0')}.png`)

function wipeOldOutput() {
  for (const f of fs.readdirSync(outDir)) {
    if (/^frame-\d+\.png$/.test(f) || f === 'manifest.json') fs.unlinkSync(path.join(outDir, f))
  }
}

function writeManifestFromDisk() {
  const present = fs.readdirSync(outDir).filter((f) => /^frame-\d+\.png$/.test(f)).sort()
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
    frames: present.map((f) => `/frames/${f}`),
    motion, model: MODEL, mode, total: N, keyframes: K,
    generatedAt: new Date().toISOString(),
  }, null, 2))
}

const sketch = fs.readFileSync(sketchPath)
const startedAt = Date.now()
const log = (msg) => console.log(msg)

// ---------- phase 1: sequential keyframe chain ----------
// The first generation doubles as a preflight: only wipe the previous run's
// output once we know the API accepts calls (credit, auth, model all OK).
const kfBuf = [sketch]
let preflight = null
if (!resume) {
  const t0 = Date.now()
  preflight = await generate(keyframePrompt(2), [sketch, sketch])
  wipeOldOutput()
  log(`preflight OK  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}
fs.writeFileSync(frameFile(1), sketch)
log(`keyframe 1/${K} → page 1 (sketch)`)
for (let k = 2; k <= K; k++) {
  const page = kfPage[k - 1]
  if (k === 2 && preflight) {
    fs.writeFileSync(frameFile(page), preflight)
    kfBuf.push(preflight)
    writeManifestFromDisk()
    log(`keyframe 2/${K} → page ${page} (from preflight)`)
    continue
  }
  if (resume && fs.existsSync(frameFile(page))) {
    kfBuf.push(fs.readFileSync(frameFile(page)))
    log(`keyframe ${k}/${K} → page ${page} (exists, skipped)`)
    continue
  }
  const t0 = Date.now()
  const buf = await generate(keyframePrompt(k), [sketch, kfBuf[k - 2]])
  fs.writeFileSync(frameFile(page), buf)
  kfBuf.push(buf)
  writeManifestFromDisk()
  log(`keyframe ${k}/${K} → page ${page}  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}

// ---------- phase 2: in-betweens, pinned between keyframe pairs, parallel ----------
const jobs = []
for (let g = 0; g < gapCount; g++) {
  for (let t = 1; t <= gapSizes[g]; t++) {
    jobs.push({ g, t, page: kfPage[g] + t, pct: Math.round((t / (gapSizes[g] + 1)) * 100) })
  }
}
const pending = jobs.filter((j) => !(resume && fs.existsSync(frameFile(j.page))))
log(`\nin-betweens: ${pending.length} of ${jobs.length} to generate (concurrency ${CONCURRENCY})`)

let cursor = 0
async function worker() {
  while (cursor < pending.length) {
    const job = pending[cursor++]
    const t0 = Date.now()
    const buf = await generate(inbetweenPrompt(job.pct), [sketch, kfBuf[job.g], kfBuf[job.g + 1]])
    fs.writeFileSync(frameFile(job.page), buf)
    writeManifestFromDisk()
    log(`inbetween page ${job.page} (${job.pct}% of gap ${job.g + 1})  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker))

writeManifestFromDisk()
log(`\ndone: ${N} pages (${K} keyframes + ${totalIB} in-betweens) in ${((Date.now() - startedAt) / 1000).toFixed(0)}s → ${outDir}`)
