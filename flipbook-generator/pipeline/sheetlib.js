// Core of the sprite-sheet flipbook pipeline (see sheets.js for the CLI).
//
// One model call per 16 keyframes: a 3:4 sheet with a 4x4 grid, drawn from the
// base sketch, where each cell gets an explicit story beat from the shotlist
// (stretched across the cells). Asking for 32 frames chains a second sheet
// that continues from the last cell of the first.
//
// There is deliberately NO in-between sheet: image models re-render rather than
// interpolate, so a "50% between" sheet comes back as the same poses at slight
// offsets, and interleaving it just makes every other page jitter. Extra page
// count comes from the client-side boil variants instead.
//
// Sheets are sliced (ffmpeg, small inset to drop grid lines) on whatever grid
// the model actually drew (measured, not assumed). The previous output is only
// wiped after every sheet has generated and validated.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import Replicate from 'replicate'
import { buildInput, resolveModel } from './models.js'

const INSET = 5 // px trimmed from each cell edge to drop the grid lines
const RETRIES = 3
const COLS = 4
const ROWS = 4
const CELLS = COLS * ROWS

const GRID_NOTE = `Layout: a ${COLS}x${ROWS} grid of ${CELLS} equal cells, ${COLS} columns by ${ROWS} rows, read left-to-right then top-to-bottom, separated by thin grid lines. Every cell shows the whole scene at the same framing: same waterline height, same subject size.`

const STYLE_NOTE = `Style: match the original drawing's line quality exactly (same stroke weight, same simple black lines on white, same character design and proportions). Keep it as loose and simple as the original; do not add shading, texture, or scenery.`

// Stretches the shotlist across the cells that need a beat, so any length of
// shotlist maps onto any number of cells.
function beatsForCells(shotlist, count) {
  if (!shotlist?.length) return Array(count).fill(null)
  return Array.from({ length: count }, (_, i) =>
    shotlist[Math.round((i / Math.max(1, count - 1)) * (shotlist.length - 1))])
}

function beatLines(beats, firstCell) {
  return beats.map((b, i) => `Cell ${firstCell + i}: ${b}`).join('\n')
}

function firstSheetPrompt(motion, shotlist) {
  const beats = beatsForCells(shotlist, CELLS - 1)
  const cells = shotlist?.length
    ? `Cell 1: the original drawing's pose, exactly as drawn.\n${beatLines(beats, 2)}`
    : `Cell 1 is the original drawing's pose; the motion advances by an equal, clearly visible step in every cell and completes in cell ${CELLS}.`
  return `Draw a sprite sheet of ${CELLS} sequential animation frames of the attached drawing. The animation: ${motion}.
Each cell must be a clearly different pose from its neighbours — this is a flipbook, so the motion has to visibly progress from cell to cell. Include the splashes, ripples, bubbles and other effects the beats call for, drawn in the same simple line style.
${cells}
${STYLE_NOTE}
${GRID_NOTE}`
}

function nextSheetPrompt(motion, shotlist, offset) {
  const beats = beatsForCells(shotlist, CELLS)
  const cells = shotlist?.length
    ? beatLines(beats, offset + 1)
    : `The motion continues in equal, clearly visible steps and completes in the last cell.`
  return `Image 1 is the previous sprite sheet of an animation of the attached drawing (image 2). Draw the NEXT sprite sheet: frames ${offset + 1} to ${offset + CELLS}, continuing seamlessly from the last cell of image 1. The animation: ${motion}.
Each cell must be a clearly different pose from its neighbours.
${cells}
${STYLE_NOTE}
${GRID_NOTE}`
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

async function generateSheet(replicate, model, prompt, images) {
  const output = await replicate.run(model, {
    input: buildInput(model, { prompt, images, aspect: '3:4' }),
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

// Runs the full pipeline: sketch buffer -> one or two sheets -> sliced frames
// + manifest in outDir. Throws on failure; the previous outDir contents are
// only wiped after every sheet validates. Returns the manifest object.
export async function buildFlipbook({
  sketch, motion, outDir, sheetsDir, model, shotlist = null, frames = CELLS, log = console.log,
}) {
  const MODEL = resolveModel(model)
  const replicate = new Replicate()
  log(`model: ${MODEL}`)
  const startedAt = Date.now()
  fs.mkdirSync(sheetsDir, { recursive: true })
  const sheetCount = Math.max(1, Math.ceil(frames / CELLS))

  async function generateValidSheet(name, prompt, images) {
    const file = path.join(sheetsDir, name)
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      const t0 = Date.now()
      const buf = await generateSheet(replicate, MODEL, prompt, images)
      fs.writeFileSync(file, buf)
      const grid = detectGrid(file)
      const secs = ((Date.now() - t0) / 1000).toFixed(1)
      log(`${name} attempt ${attempt}: ${grid.cols}x${grid.rows} grid, uniform=${grid.uniform}  ${secs}s`)
      if (grid.uniform) return { buf, grid, file }
    }
    throw new Error(`${name}: no uniform grid after ${RETRIES} attempts (previous output untouched)`)
  }

  // Per-sheet shotlist slices, so a chained run walks the whole story once.
  const beatsPerSheet = shotlist?.length
    ? Array.from({ length: sheetCount }, (_, s) => {
        const from = Math.floor((s / sheetCount) * shotlist.length)
        const to = Math.floor(((s + 1) / sheetCount) * shotlist.length)
        return shotlist.slice(from, Math.max(from + 1, to))
      })
    : Array(sheetCount).fill(null)

  // the original drawing rides along on EVERY call as the style reference
  const sheets = []
  for (let s = 0; s < sheetCount; s++) {
    const name = `keyframes-${s + 1}.png`
    const prompt = s === 0
      ? firstSheetPrompt(motion, beatsPerSheet[0])
      : nextSheetPrompt(motion, beatsPerSheet[s], s * CELLS)
    const images = s === 0 ? [sketch] : [sheets[s - 1].buf, sketch]
    sheets.push(await generateValidSheet(name, prompt, images))
  }

  const files = sheets.flatMap((sheet, s) => sliceSheet(sheet.file, sheetsDir, `key-${s + 1}`, sheet.grid))

  fs.mkdirSync(outDir, { recursive: true })
  for (const f of fs.readdirSync(outDir)) {
    if (/^frame-\d+\.png$/.test(f) || f === 'manifest.json') fs.unlinkSync(path.join(outDir, f))
  }
  const total = files.length
  files.forEach((f, i) => fs.copyFileSync(f, path.join(outDir, `frame-${String(i + 1).padStart(2, '0')}.png`)))

  const generatedAt = new Date().toISOString()
  // version query defeats browser caching of the reused frame filenames
  const v = Date.parse(generatedAt)
  const manifest = {
    frames: Array.from({ length: total }, (_, i) => `/frames/frame-${String(i + 1).padStart(2, '0')}.png?v=${v}`),
    motion,
    model: MODEL,
    mode: 'sheets',
    total,
    keyframes: total,
    sheets: sheetCount,
    generatedAt,
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

  log(`done: ${total} keyframes from ${sheetCount} sheet call${sheetCount > 1 ? 's' : ''} in ${((Date.now() - startedAt) / 1000).toFixed(0)}s → ${outDir}`)
  return manifest
}
