import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

// NOTE: the model was asked for 4 cols x 3 rows but returned 3 cols x 4 rows —
// grid layout must be detected, not trusted (see PLAN.md "grid geometry")
const COLS = 3
const ROWS = 4
// crop this fraction of each cell edge to remove the drawn grid border lines
const INSET = 0.02

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

// Find the cell regions along one axis by locating the drawn border lines:
// a border row/column is a run of positions where nearly the whole cross-axis
// is dark ink. Returns `expected` [start, end] regions, or null to fall back.
function findRegions(counts, crossSpan, expected, axisLen) {
  const thresh = crossSpan * 0.8
  const bands = []
  let s = null
  for (let i = 0; i <= axisLen; i++) {
    const dark = i < axisLen && counts[i] > thresh
    if (dark && s === null) s = i
    if (!dark && s !== null) { bands.push([s, i - 1]); s = null }
  }
  const regions = []
  let prev = 0
  for (const [a, b] of bands) {
    if (a - prev > (axisLen / expected) * 0.4) regions.push([prev, a - 1])
    prev = b + 1
  }
  if (axisLen - prev > (axisLen / expected) * 0.4) regions.push([prev, axisLen - 1])
  return regions.length === expected ? regions : null
}

function equalRegions(axisLen, n) {
  return Array.from({ length: n }, (_, i) => [
    Math.round((i * axisLen) / n),
    Math.round(((i + 1) * axisLen) / n) - 1,
  ])
}

async function sliceGrid(url) {
  const img = await loadImage(url)
  const W = img.width
  const H = img.height
  const probe = document.createElement('canvas')
  probe.width = W
  probe.height = H
  const pctx = probe.getContext('2d', { willReadFrequently: true })
  pctx.drawImage(img, 0, 0)
  const data = pctx.getImageData(0, 0, W, H).data
  const colCounts = new Float32Array(W) // dark pixels per column
  const rowCounts = new Float32Array(H) // dark pixels per row
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      if (lum < 80) { colCounts[x]++; rowCounts[y]++ }
    }
  }
  const colRegions = findRegions(colCounts, H, COLS, W) ?? equalRegions(W, COLS)
  const rowRegions = findRegions(rowCounts, W, ROWS, H) ?? equalRegions(H, ROWS)

  const frames = []
  let aspect = 1
  for (const [ry0, ry1] of rowRegions) {
    for (const [cx0, cx1] of colRegions) {
      const padX = (cx1 - cx0) * INSET
      const padY = (ry1 - ry0) * INSET
      const sx = cx0 + padX
      const sy = ry0 + padY
      const sw = cx1 - cx0 - 2 * padX
      const sh = ry1 - ry0 - 2 * padY
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(sw)
      canvas.height = Math.round(sh)
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
      frames.push(canvas.toDataURL('image/png'))
      aspect = canvas.width / canvas.height
    }
  }
  return { frames, aspect }
}

// k1 b1 k2 b2 ... b11 k12  (b12 is the model's "repeat last frame" filler — dropped)
function interleave(keys, betweens) {
  const pages = []
  keys.forEach((k, i) => {
    pages.push({ src: k, keyIndex: i })
    if (i < keys.length - 1) pages.push({ src: betweens[i], keyIndex: null })
  })
  return pages
}

// ---------- boil layer: seeded-noise displacement, pure client-side WebGL ----------

const VERT = `
attribute vec2 a;
varying vec2 v;
void main() {
  v = vec2(a.x * 0.5 + 0.5, 0.5 - a.y * 0.5);
  gl_Position = vec4(a, 0.0, 1.0);
}`

const FRAG = `
precision mediump float;
varying vec2 v;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_amp;   // displacement amplitude in px
uniform float u_seed;  // discrete boil seed — steps, never glides
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1, 0)), f.x),
    mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x),
    f.y
  );
}
float fbm(vec2 p) { return noise(p) * 0.65 + noise(p * 2.3) * 0.35; }
void main() {
  vec2 px = v * u_res;
  float sc = 0.035; // ~30px noise features
  vec2 off = vec2(
    fbm(px * sc + vec2(u_seed * 13.7, u_seed * 71.3)) - 0.5,
    fbm(px * sc + vec2(u_seed * 41.9 + 100.0, u_seed * 7.1 + 100.0)) - 0.5
  ) * 2.0 * u_amp;
  gl_FragColor = texture2D(u_tex, clamp((px + off) / u_res, 0.0, 1.0));
}`

function compile(gl, type, src) {
  const s = gl.createShader(type)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
  return s
}

function BoilCanvas({ src, amp }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const [tick, setTick] = useState(0)

  // boil clock: new noise seed ~9x/sec, stepped — lines jump, they don't glide
  useEffect(() => {
    if (amp <= 0) return
    const id = setInterval(() => setTick((t) => (t + 1) % 10000), 110)
    return () => clearInterval(id)
  }, [amp])

  useEffect(() => {
    if (stateRef.current) return // StrictMode double-mount guard
    const canvas = canvasRef.current
    const gl = canvas.getContext('webgl', { premultipliedAlpha: false })
    const prog = gl.createProgram()
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    stateRef.current = {
      gl, prog,
      uRes: gl.getUniformLocation(prog, 'u_res'),
      uAmp: gl.getUniformLocation(prog, 'u_amp'),
      uSeed: gl.getUniformLocation(prog, 'u_seed'),
      textures: new Map(), // src -> {tex, w, h}
    }
  }, [])

  useEffect(() => {
    const st = stateRef.current
    if (!st || !src) return
    const { gl } = st
    const draw = (entry) => {
      const canvas = canvasRef.current
      if (!canvas) return
      if (canvas.width !== entry.w) { canvas.width = entry.w; canvas.height = entry.h }
      gl.viewport(0, 0, entry.w, entry.h)
      gl.bindTexture(gl.TEXTURE_2D, entry.tex)
      gl.uniform2f(st.uRes, entry.w, entry.h)
      gl.uniform1f(st.uAmp, amp)
      gl.uniform1f(st.uSeed, tick % 97)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    const cached = st.textures.get(src)
    if (cached) { draw(cached); return }
    const img = new Image()
    img.onload = () => {
      const tex = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      const entry = { tex, w: img.naturalWidth, h: img.naturalHeight }
      st.textures.set(src, entry)
      draw(entry)
    }
    img.src = src
  }, [src, amp, tick])

  return <canvas ref={canvasRef} className="boil-canvas" />
}

export default function App() {
  const [pages, setPages] = useState(null)
  const [aspect, setAspect] = useState(1)
  const [pos, setPos] = useState(0) // float page position
  const [playing, setPlaying] = useState(false)
  const [wobble, setWobble] = useState(1.5) // boil amplitude in px (0 = off)

  const stripRef = useRef(null)
  const posRef = useRef(0)
  const velRef = useRef(0)
  const lastMove = useRef(null)
  const rafRef = useRef(null)
  const playDir = useRef(1)

  useEffect(() => {
    // in-between grid is optional — keyframes-only flipbook until it exists
    Promise.all([sliceGrid('/keyframes.png'), sliceGrid('/inbetweens.png').catch(() => null)])
      .then(([keys, betweens]) => {
        setAspect(keys.aspect)
        setPages(betweens
          ? interleave(keys.frames, betweens.frames)
          : keys.frames.map((src, i) => ({ src, keyIndex: i })))
      })
  }, [])

  const setPosition = useCallback((p, n) => {
    const clamped = Math.max(0, Math.min(n - 1, p))
    posRef.current = clamped
    setPos(clamped)
  }, [])

  const stopAnimations = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    setPlaying(false)
  }, [])

  // --- scrubbing ---
  const posFromEvent = useCallback((e) => {
    const rect = stripRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    return (x / rect.width) * (pages.length - 1)
  }, [pages])

  const onPointerDown = useCallback((e) => {
    stopAnimations()
    stripRef.current.setPointerCapture(e.pointerId)
    setPosition(posFromEvent(e), pages.length)
    lastMove.current = { t: performance.now(), p: posRef.current }
    velRef.current = 0
  }, [pages, posFromEvent, setPosition, stopAnimations])

  const onPointerMove = useCallback((e) => {
    if (!stripRef.current?.hasPointerCapture?.(e.pointerId)) return
    const p = posFromEvent(e)
    const now = performance.now()
    const prev = lastMove.current
    if (prev && now > prev.t) velRef.current = (p - prev.p) / (now - prev.t) // pages/ms
    lastMove.current = { t: now, p }
    setPosition(p, pages.length)
  }, [pages, posFromEvent, setPosition])

  const onPointerUp = useCallback((e) => {
    stripRef.current.releasePointerCapture(e.pointerId)
    // flick momentum: keep riffling with decay
    let v = velRef.current * 16 // pages per ~frame
    let last = performance.now()
    const step = (now) => {
      const dt = (now - last) / 16
      last = now
      v *= Math.pow(0.94, dt)
      const next = posRef.current + v * dt
      setPosition(next, pages.length)
      if (Math.abs(v) > 0.02 && next > 0 && next < pages.length - 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        setPosition(Math.round(posRef.current), pages.length) // snap
      }
    }
    if (Math.abs(v) > 0.05) rafRef.current = requestAnimationFrame(step)
    else setPosition(Math.round(posRef.current), pages.length)
  }, [pages, setPosition])

  // --- play button: ping-pong at ~12 pages/sec ---
  const togglePlay = useCallback(() => {
    if (playing) { stopAnimations(); return }
    setPlaying(true)
    let last = performance.now()
    const step = (now) => {
      const dt = (now - last) / 1000
      last = now
      let next = posRef.current + playDir.current * 12 * dt
      if (next >= pages.length - 1) { next = pages.length - 1; playDir.current = -1 }
      if (next <= 0) { next = 0; playDir.current = 1 }
      setPosition(next, pages.length)
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
  }, [playing, pages, setPosition, stopAnimations])

  useEffect(() => {
    if (!pages) return
    const onKey = (e) => {
      if (e.key === 'ArrowRight') { stopAnimations(); setPosition(Math.round(posRef.current) + 1, pages.length) }
      if (e.key === 'ArrowLeft') { stopAnimations(); setPosition(Math.round(posRef.current) - 1, pages.length) }
      if (e.key === ' ') { e.preventDefault(); togglePlay() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pages, setPosition, stopAnimations, togglePlay])

  if (!pages) return <div className="loading">slicing grids…</div>

  const current = Math.round(pos)
  const keyframes = pages.filter((p) => p.keyIndex !== null)
  const handlePct = (pos / (pages.length - 1)) * 100

  return (
    <div className="app">
      <h1>flipbook scrubber</h1>
      <div className="page-view" style={{ aspectRatio: aspect }}>
        <BoilCanvas src={pages[current].src} amp={wobble} />
        <div className="page-num">{current + 1} / {pages.length}</div>
      </div>

      <div className="controls">
        <button className="play" onClick={togglePlay} aria-label="play/pause">
          {playing ? '⏸' : '▶'}
        </button>
        <div
          className="strip"
          ref={stripRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          role="slider"
          aria-valuemin={1}
          aria-valuemax={pages.length}
          aria-valuenow={current + 1}
          tabIndex={0}
        >
          {keyframes.map((k) => (
            <img
              key={k.keyIndex}
              src={k.src}
              alt=""
              className={pages[current].keyIndex === k.keyIndex ? 'thumb active' : 'thumb'}
              draggable={false}
            />
          ))}
          <div className="handle" style={{ left: `${handlePct}%` }} />
        </div>
      </div>
      <label className="wobble">
        wobble
        <input
          type="range"
          min="0"
          max="3"
          step="0.5"
          value={wobble}
          onChange={(e) => setWobble(Number(e.target.value))}
        />
        {wobble === 0 ? 'off' : `${wobble}px`}
      </label>
      <p className="hint">drag or flick the strip · space to play · ←/→ to step</p>
    </div>
  )
}
