// Core of the sprite-sheet flipbook pipeline (see sheets.js for the CLI).
//
// Two model calls total:
//   1. keyframe sheet   — 3:4 sheet of 16 cells (4x4), from the base sketch
//   2. in-between sheet — 3:4 sheet of 16 cells, from the keyframe sheet;
//      cell i is the 50% pose between keyframes i and i+1, cell 16 repeats
//      keyframe 16
//
// Both sheets are sliced (ffmpeg, small inset to drop grid lines) on whatever
// grid the model actually drew (measured, not assumed) and interleaved
// k1,b1,k2,b2,... into 2x flipbook pages.
// The previous output is only wiped after both sheets have generated.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import Replicate from 'replicate'

export const MODEL = 'google/nano-banana-2'
const INSET = 5 // px trimmed from each cell edge to drop the grid lines
const RETRIES = 3

const GRID_NOTE = `The sprite sheet is a 4x4 grid: 16 equal cells, 4 columns by 4 rows, read left-to-right, top-to-bottom, separated by thin grid lines.`

const STYLE_NOTE = `The original drawing is the sole style authority: every frame must adhere EXACTLY to its style and form — same line quality, same character design, same proportions, same level of detail. Do not clean up, refine, or beautify anything.`

const sheet1Prompt = (motion) => `create a sprite sheet of 16 images equi-distant apart using the base image as a reference and preserving the exact style. In the sprite sheet the sequence should be of ${motion}. The base image is the original drawing. ${STYLE_NOTE} ${GRID_NOTE}`

const sheet2Prompt = `With these 16 frames in image 1 as keyframes, generate a new sprite sheet that creates the in-between frames (e.g. frame 1 of the new sprite sheet should be 50% between frame 1 and 2, and so forth). For the last frame just repeat frame 16 from image 1. Image 2 is the original drawing that image 1's frames were generated from. ${STYLE_NOTE} ${GRID_NOTE}`

async function outputToBuffer(output) {
  const item = Array.isArray(output) ? output[0] : output
  if (item && typeof item.blob === 'function') {
    return Buffer.from(await (await item.blob()).arrayBuffer())
  }
  const url = typeof item === 'string' ? item : item.url()
  const res = await fetch(url)
  return Buffer.from(await res.arrayBuffer())
}

async function generateSheet(replicate, prompt, images) {
  const output = await replicate.run(MODEL, {
    input: { prompt, image_input: images, aspect_ratio: '3:4', output_format: 'png' },
  })
  return outputToBuffer(output)
}

function sheetSize(sheetPath) {
  const probe = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', sheetPath,
  ]).toString().trim()
  const [W, H] = probe.split('x').map(Number)
  return { W, H }
}

// The model doesn't always honor the requested grid, so measure what it actually
// drew: divider lines are near-continuous dark rows/columns, so score each
// candidate grid by how dark the sheet is along its internal divider positions.
export function detectGrid(sheetPath) {
  const { W, H } = sheetSize(sheetPath)
  const raw = execFileSync('ffmpeg', [
    '-loglevel', 'error', '-i', sheetPath, '-f', 'rawvideo', '-pix_fmt', 'gray', '-',
  ], { maxBuffer: 128 * 1024 * 1024 })
  const colDark = new Float64Array(W)
  const rowDark = new Float64Array(H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (raw[y * W + x] < 100) { colDark[x]++; rowDark[y]++ }
    }
  }
  for (let x = 0; x < W; x++) colDark[x] /= H
  for (let y = 0; y < H; y++) rowDark[y] /= W
  const lineScore = (fracs, size, count) => {
    let sum = 0
    for (let i = 1; i < count; i++) {
      const at = Math.round((i / count) * size)
      let best = 0
      for (let d = -3; d <= 3; d++) best = Math.max(best, fracs[at + d] ?? 0)
      sum += best
    }
    return sum / (count - 1)
  }
  let bestGrid = { cols: 4, rows: 3, score: 0 }
  for (const [cols, rows] of [[4, 3], [4, 4], [3, 4], [3, 3], [4, 6], [6, 4]]) {
    const score = (lineScore(colDark, W, cols) + lineScore(rowDark, H, rows)) / 2
    if (score > bestGrid.score) bestGrid = { cols, rows, score }
  }

  // Sheets are sometimes ragged (e.g. one row drawn with 3 cells instead of
  // 4). Verify every row band has a divider near each internal column
  // position; a band with a missing divider means the sheet can't be sliced
  // on a uniform grid.
  const { cols, rows } = bestGrid
  let uniform = true
  for (let r = 0; r < rows && uniform; r++) {
    const y0 = Math.round((r / rows) * H)
    const y1 = Math.round(((r + 1) / rows) * H)
    for (let c = 1; c < cols; c++) {
      const at = Math.round((c / cols) * W)
      let best = 0
      for (let d = -3; d <= 3; d++) {
        const x = at + d
        if (x < 0 || x >= W) continue
        let dark = 0
        for (let y = y0; y < y1; y++) if (raw[y * W + x] < 100) dark++
        best = Math.max(best, dark / (y1 - y0))
      }
      if (best < 0.5) { uniform = false; break }
    }
  }
  return { ...bestGrid, uniform }
}

function sliceSheet(sheetPath, destDir, prefix, { cols, rows }) {
  const { W, H } = sheetSize(sheetPath)
  const cellW = Math.floor(W / cols)
  const cellH = Math.floor(H / rows)
  const files = []
  let n = 1
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const file = path.join(destDir, `${prefix}-${String(n).padStart(2, '0')}.png`)
      execFileSync('ffmpeg', [
        '-loglevel', 'error', '-y', '-i', sheetPath,
        '-vf', `crop=${cellW - 2 * INSET}:${cellH - 2 * INSET}:${col * cellW + INSET}:${row * cellH + INSET}`,
        file,
      ])
      files.push(file)
      n++
    }
  }
  return files
}

// Runs the full pipeline: sketch buffer -> two sheets -> sliced, interleaved
// frames + manifest in outDir. Throws on failure; the previous outDir contents
// are only wiped after both sheets validate. Returns the manifest object.
export async function buildFlipbook({ sketch, motion, outDir, sheetsDir, log = console.log }) {
  const replicate = new Replicate()
  const startedAt = Date.now()
  fs.mkdirSync(sheetsDir, { recursive: true })

  async function generateValidSheet(name, prompt, images) {
    const file = path.join(sheetsDir, name)
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      const t0 = Date.now()
      const buf = await generateSheet(replicate, prompt, images)
      fs.writeFileSync(file, buf)
      const grid = detectGrid(file)
      const secs = ((Date.now() - t0) / 1000).toFixed(1)
      log(`${name} attempt ${attempt}: ${grid.cols}x${grid.rows} grid, uniform=${grid.uniform}  ${secs}s`)
      if (grid.uniform) return { buf, grid, file }
    }
    throw new Error(`${name}: no uniform grid after ${RETRIES} attempts (previous output untouched)`)
  }

  // the original drawing rides along on EVERY call as the style reference
  const keySheet = await generateValidSheet('keyframes.png', sheet1Prompt(motion), [sketch])
  const betweenSheet = await generateValidSheet('inbetweens.png', sheet2Prompt, [keySheet.buf, sketch])

  const keys = sliceSheet(keySheet.file, sheetsDir, 'key', keySheet.grid)
  const betweens = sliceSheet(betweenSheet.file, sheetsDir, 'between', betweenSheet.grid)

  fs.mkdirSync(outDir, { recursive: true })
  for (const f of fs.readdirSync(outDir)) {
    if (/^frame-\d+\.png$/.test(f) || f === 'manifest.json') fs.unlinkSync(path.join(outDir, f))
  }
  const K = Math.min(keys.length, betweens.length)
  const total = 2 * K
  const frameFile = (p) => path.join(outDir, `frame-${String(p).padStart(2, '0')}.png`)
  for (let i = 0; i < K; i++) {
    fs.copyFileSync(keys[i], frameFile(2 * i + 1))
    fs.copyFileSync(betweens[i], frameFile(2 * i + 2))
  }

  const generatedAt = new Date().toISOString()
  // version query defeats browser caching of the reused frame filenames
  const v = Date.parse(generatedAt)
  const manifest = {
    frames: Array.from({ length: total }, (_, i) => `/frames/frame-${String(i + 1).padStart(2, '0')}.png?v=${v}`),
    motion,
    model: MODEL,
    mode: 'sheets',
    total,
    keyframes: K,
    generatedAt,
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

  log(`done: ${total} pages (${K} keyframes + ${K} in-betweens) from 2 sheet calls in ${((Date.now() - startedAt) / 1000).toFixed(0)}s → ${outDir}`)
  return manifest
}
