import { useCallback, useRef, useState } from 'react'
import { CANVAS_SIZE, drawSmooth, simplify, framesFromOps, renderFrame } from './vector.js'

// Minimal drawing pad: one black pencil, undo, clear. Strokes are the data —
// the PNG is just a view of them.
export default function DrawCanvas({ onAnimated }) {
  const canvasRef = useRef(null)
  const strokesRef = useRef([]) // [{id, pts: [[x,y],...]}]
  const activeRef = useRef(null)
  const [strokeCount, setStrokeCount] = useState(0)
  const [motion, setMotion] = useState('')
  const [frames, setFrames] = useState(12)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const redraw = useCallback(() => {
    const ctx = canvasRef.current.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const s of strokesRef.current) drawSmooth(ctx, s.pts)
    if (activeRef.current) drawSmooth(ctx, activeRef.current)
  }, [])

  const toCanvasXY = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return [
      ((e.clientX - rect.left) / rect.width) * CANVAS_SIZE,
      ((e.clientY - rect.top) / rect.height) * CANVAS_SIZE,
    ]
  }

  const onPointerDown = (e) => {
    canvasRef.current.setPointerCapture(e.pointerId)
    activeRef.current = [toCanvasXY(e)]
  }
  const onPointerMove = (e) => {
    if (!activeRef.current) return
    activeRef.current.push(toCanvasXY(e))
    redraw()
  }
  const onPointerUp = () => {
    if (!activeRef.current) return
    if (activeRef.current.length > 1) {
      const pts = simplify(activeRef.current, 2).map(([x, y]) => [Math.round(x), Math.round(y)])
      strokesRef.current.push({ id: `s${strokesRef.current.length + 1}`, pts })
      setStrokeCount(strokesRef.current.length)
    }
    activeRef.current = null
    redraw()
  }

  const undo = () => {
    strokesRef.current.pop()
    setStrokeCount(strokesRef.current.length)
    redraw()
  }
  const clear = () => {
    strokesRef.current = []
    setStrokeCount(0)
    redraw()
  }

  const animate = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/animate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strokes: strokesRef.current, motion, frames }),
      })
      if (!res.ok) throw new Error(`animate failed: ${await res.text()}`)
      const { frames: frameSpecs } = await res.json()
      const pages = framesFromOps(strokesRef.current, frameSpecs)
      onAnimated(pages.map((strokes, i) => ({
        src: renderFrame(strokes),
        keyIndex: i,
        strokes, // kept so the viewer could re-render with vector boil later
      })))
    } catch (err) {
      setError(String(err.message ?? err))
    } finally {
      setBusy(false)
    }
  }

  const canGo = strokeCount > 0 && motion.trim().length > 0 && !busy

  return (
    <div className="draw-pad">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="draw-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div className="draw-tools">
        <button onClick={undo} disabled={strokeCount === 0 || busy}>undo</button>
        <button onClick={clear} disabled={strokeCount === 0 || busy}>clear</button>
        <span className="stroke-count">{strokeCount} strokes</span>
      </div>
      <input
        className="motion-input"
        placeholder="What happens next? e.g. the duck dives under the water"
        value={motion}
        onChange={(e) => setMotion(e.target.value)}
        disabled={busy}
      />
      <div className="draw-tools">
        <label>
          frames{' '}
          <select value={frames} onChange={(e) => setFrames(Number(e.target.value))} disabled={busy}>
            <option value={8}>8</option>
            <option value={12}>12</option>
            <option value={16}>16</option>
          </select>
        </label>
        <button className="animate-btn" onClick={animate} disabled={!canGo}>
          {busy ? 'animating…' : 'animate ▶'}
        </button>
      </div>
      {error && <p className="draw-error">{error}</p>}
    </div>
  )
}
