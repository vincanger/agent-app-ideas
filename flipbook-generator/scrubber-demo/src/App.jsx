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

async function sliceGrid(url) {
  const img = await loadImage(url)
  const cw = img.width / COLS
  const ch = img.height / ROWS
  const outW = Math.round(cw * (1 - 2 * INSET))
  const outH = Math.round(ch * (1 - 2 * INSET))
  const frames = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, outW, outH)
      ctx.drawImage(
        img,
        c * cw + cw * INSET,
        r * ch + ch * INSET,
        cw * (1 - 2 * INSET),
        ch * (1 - 2 * INSET),
        0, 0, outW, outH,
      )
      frames.push(canvas.toDataURL('image/png'))
    }
  }
  return { frames, aspect: outW / outH }
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

export default function App() {
  const [pages, setPages] = useState(null)
  const [aspect, setAspect] = useState(1)
  const [pos, setPos] = useState(0) // float page position
  const [playing, setPlaying] = useState(false)

  const stripRef = useRef(null)
  const posRef = useRef(0)
  const velRef = useRef(0)
  const lastMove = useRef(null)
  const rafRef = useRef(null)
  const playDir = useRef(1)

  useEffect(() => {
    Promise.all([sliceGrid('/keyframes.png'), sliceGrid('/inbetweens.png')])
      .then(([keys, betweens]) => {
        setAspect(keys.aspect)
        setPages(interleave(keys.frames, betweens.frames))
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
        {/* keep all pages mounted so swaps are instant */}
        {pages.map((p, i) => (
          <img key={i} src={p.src} alt="" className={i === current ? 'visible' : ''} draggable={false} />
        ))}
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
      <p className="hint">drag or flick the strip · space to play · ←/→ to step</p>
    </div>
  )
}
