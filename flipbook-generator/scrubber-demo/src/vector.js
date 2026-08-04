// Vector stroke utilities: simplification, per-frame transforms, rendering.
// The whole point of this pipeline: frames are re-rendered from the user's own
// stroke data with the same brush, so the style *cannot* drift.

export const CANVAS_SIZE = 512

// Ramer–Douglas–Peucker simplification to keep LLM token counts sane
export function simplify(pts, epsilon = 2) {
  if (pts.length < 3) return pts
  const [first, last] = [pts[0], pts[pts.length - 1]]
  let maxDist = 0
  let index = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], first, last)
    if (d > maxDist) { maxDist = d; index = i }
  }
  if (maxDist > epsilon) {
    const left = simplify(pts.slice(0, index + 1), epsilon)
    const right = simplify(pts.slice(index), epsilon)
    return left.slice(0, -1).concat(right)
  }
  return [first, last]
}

function perpDist(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len
}

// Apply an op {translate, rotate (deg), pivot, scale} to a stroke's points.
// Transforms are absolute relative to the ORIGINAL frame-1 geometry.
// `rotate` uses standard math convention (positive = counterclockwise in a
// y-up frame); on the y-down canvas that means negating the angle. LLMs
// reliably reason in math convention, so the renderer adapts, not the model.
export function transformPts(pts, op) {
  const [tx, ty] = op.translate ?? [0, 0]
  const rot = (-(op.rotate ?? 0) * Math.PI) / 180
  const scale = op.scale ?? 1
  const [px, py] = op.pivot ?? centroid(pts)
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  return pts.map(([x, y]) => {
    let dx = (x - px) * scale
    let dy = (y - py) * scale
    const rx = dx * cos - dy * sin
    const ry = dx * sin + dy * cos
    return [px + rx + tx, py + ry + ty]
  })
}

export function centroid(pts) {
  let sx = 0
  let sy = 0
  for (const [x, y] of pts) { sx += x; sy += y }
  return [sx / pts.length, sy / pts.length]
}

// Build the full page list: frame 1 = base strokes; frames 2..N from LLM ops.
// Each frame spec: { ops: [{id, translate, rotate, pivot, scale}], add: [{id, pts}], remove: [ids] }
export function framesFromOps(baseStrokes, frameSpecs) {
  const pages = [baseStrokes.map((s) => ({ ...s }))]
  for (const spec of frameSpecs) {
    const removed = new Set(spec.remove ?? [])
    const opById = new Map((spec.ops ?? []).map((op) => [op.id, op]))
    const strokes = []
    for (const s of baseStrokes) {
      if (removed.has(s.id)) continue
      const op = opById.get(s.id)
      strokes.push({ id: s.id, pts: op ? transformPts(s.pts, op) : s.pts })
    }
    for (const added of spec.add ?? []) {
      if (added?.pts?.length >= 2) strokes.push({ id: added.id, pts: added.pts })
    }
    pages.push(strokes)
  }
  return pages
}

// Render one frame's strokes to a dataURL with the standard pencil brush.
// jitterSeed > 0 applies control-point jitter (vector boil — same idea as the
// pixel warp, but on the true stroke geometry).
export function renderFrame(strokes, { size = CANVAS_SIZE, jitterSeed = 0, jitterAmp = 0 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const stroke of strokes) {
    let pts = stroke.pts
    if (jitterAmp > 0) {
      pts = pts.map(([x, y], i) => [
        x + jitterAmp * pseudoNoise(jitterSeed, stroke.id, i, 0),
        y + jitterAmp * pseudoNoise(jitterSeed, stroke.id, i, 1),
      ])
    }
    drawSmooth(ctx, pts)
  }
  return canvas.toDataURL('image/png')
}

function pseudoNoise(seed, id, i, axis) {
  const h = Math.sin(seed * 374761 + hashStr(String(id)) * 668265 + i * 951 + axis * 217) * 43758.5453
  return (h - Math.floor(h)) * 2 - 1
}

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

// Midpoint quadratic smoothing — same brush for live drawing and playback
export function drawSmooth(ctx, pts) {
  if (pts.length < 2) return
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2
    const my = (pts[i][1] + pts[i + 1][1]) / 2
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my)
  }
  ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1])
  ctx.stroke()
}
