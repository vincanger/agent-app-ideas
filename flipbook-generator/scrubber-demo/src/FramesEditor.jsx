import { useCallback, useEffect, useRef, useState } from 'react'

// Frame arrangement + single-frame touch-up editor.
//
// Grid view: drag a thumbnail onto another spot to reorder, ✕ to drop a bad
// frame, click a frame to open it in the editor. Order is saved to the
// manifest (files never move on disk).
//
// Frame editor: move/tilt/scale the whole drawing, pencil and eraser for
// touch-ups, with onion-skin ghosts of the neighboring frames for alignment.

const fileOf = (src) => src.split('?')[0].split('/').pop()

export default function FramesEditor({ manifest, onDone }) {
  const [order, setOrder] = useState(manifest.frames)
  const [baseline, setBaseline] = useState(manifest.frames) // last saved order
  const [dragIdx, setDragIdx] = useState(null)
  // {type:'swap', idx} — drop ON a frame, exchanges the two
  // {type:'insert', at} — drop in the margin, slots the frame between neighbors
  const [dropTarget, setDropTarget] = useState(null)
  const [editing, setEditing] = useState(null) // index into order
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const gridRef = useRef(null)
  const dirty = order.join('|') !== baseline.join('|')

  // Middle of a cell targets a swap; cell edges and the gaps between cells
  // target an insertion at the nearest boundary.
  const targetFromPoint = (x, y) => {
    const cells = [...gridRef.current.querySelectorAll('.frame-cell')]
    let best = null
    cells.forEach((el, i) => {
      const r = el.getBoundingClientRect()
      const dx = Math.max(r.left - x, 0, x - r.right)
      const dy = Math.max(r.top - y, 0, y - r.bottom)
      const d = dx * dx + dy * dy
      if (!best || d < best.d) best = { i, r, d }
    })
    if (!best) return null
    const { i, r } = best
    const edge = r.width * 0.22
    let target
    if (x < r.left + edge) target = { type: 'insert', at: i }
    else if (x > r.right - edge) target = { type: 'insert', at: i + 1 }
    else target = { type: 'swap', idx: i }
    // no-ops: swapping with itself / inserting right where it already sits
    if (target.type === 'swap' && target.idx === dragIdx) return null
    if (target.type === 'insert' && (target.at === dragIdx || target.at === dragIdx + 1)) return null
    return target
  }

  const onGridDragOver = (e) => {
    e.preventDefault()
    if (dragIdx === null) return
    setDropTarget(targetFromPoint(e.clientX, e.clientY))
  }

  const onGridDrop = (e) => {
    e.preventDefault()
    const t = dropTarget
    if (dragIdx !== null && t) {
      setOrder((o) => {
        const next = [...o]
        if (t.type === 'swap') {
          ;[next[dragIdx], next[t.idx]] = [next[t.idx], next[dragIdx]]
        } else {
          const at = t.at > dragIdx ? t.at - 1 : t.at
          const [moved] = next.splice(dragIdx, 1)
          next.splice(at, 0, moved)
        }
        return next
      })
    }
    setDragIdx(null)
    setDropTarget(null)
  }

  const saveOrder = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/frames/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames: order }),
      })
      if (!res.ok) throw new Error(await res.text())
      onDone(await res.json())
    } catch (err) {
      setError(String(err.message ?? err))
      setBusy(false)
    }
  }

  // a frame file was overwritten: refresh its cache-busted url in the local
  // order (keeping any unsaved reordering) and go back to the grid
  const onFrameSaved = (newManifest) => {
    const byFile = new Map(newManifest.frames.map((u) => [fileOf(u), u]))
    const refresh = (list) => list.map((u) => byFile.get(fileOf(u)) ?? u)
    setOrder(refresh)
    setBaseline(refresh)
    setEditing(null)
  }

  if (editing !== null) {
    return (
      <FrameEditor
        src={order[editing]}
        prevSrc={editing > 0 ? order[editing - 1] : null}
        nextSrc={editing < order.length - 1 ? order[editing + 1] : null}
        pageNum={editing + 1}
        onSaved={onFrameSaved}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <div className="frames-editor">
      <div className="editor-bar">
        <button onClick={() => onDone(null)} disabled={busy}>← back to viewer</button>
        <button className="save-order" onClick={saveOrder} disabled={!dirty || busy}>
          {busy ? 'saving…' : dirty ? 'save order' : 'order saved'}
        </button>
      </div>
      <p className="hint">drag onto a frame to swap · into a gap to insert · click to edit · ✕ to remove</p>
      <div className="frames-grid" ref={gridRef} onDragOver={onGridDragOver} onDrop={onGridDrop}>
        {order.map((src, i) => (
          <div
            key={src}
            className={
              'frame-cell' +
              (i === dragIdx ? ' dragging' : '') +
              (dropTarget?.type === 'swap' && dropTarget.idx === i ? ' over' : '') +
              (dropTarget?.type === 'insert' && dropTarget.at === i ? ' insert-before' : '') +
              (dropTarget?.type === 'insert' && dropTarget.at === order.length && i === order.length - 1 ? ' insert-after' : '')
            }
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragEnd={() => { setDragIdx(null); setDropTarget(null) }}
            onClick={() => setEditing(i)}
          >
            <img src={src} alt={`frame ${i + 1}`} draggable={false} />
            <span className="cell-num">{i + 1}</span>
            {order.length > 2 && (
              <button
                className="cell-x"
                title="remove frame"
                onClick={(e) => { e.stopPropagation(); setOrder((o) => o.filter((_, j) => j !== i)) }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      {error && <p className="draw-error">{error}</p>}
    </div>
  )
}

function FrameEditor({ src, prevSrc, nextSrc, pageNum, onSaved, onCancel }) {
  const canvasRef = useRef(null)
  const imgsRef = useRef({}) // base, prev, next
  const activeRef = useRef(null) // in-progress pencil/eraser stroke
  const dragRef = useRef(null) // move-tool drag origin
  const [loaded, setLoaded] = useState(false)
  const [tool, setTool] = useState('move') // 'move' | 'pencil' | 'eraser'
  const [rotate, setRotate] = useState(0)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState([0, 0])
  const [strokes, setStrokes] = useState([]) // {tool, pts:[[x,y],...]}
  const [ghostPrev, setGhostPrev] = useState(true)
  const [ghostNext, setGhostNext] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = (s) => new Promise((resolve) => {
      if (!s) return resolve(null)
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = s
    })
    Promise.all([load(src), load(prevSrc), load(nextSrc)]).then(([base, prev, next]) => {
      if (cancelled) return
      imgsRef.current = { base, prev, next }
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [src, prevSrc, nextSrc])

  const render = useCallback((forExport = false) => {
    const { base, prev, next } = imgsRef.current
    const canvas = canvasRef.current
    if (!canvas || !base) return
    const W = canvas.width
    const H = canvas.height
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, W, H)
    ctx.save()
    ctx.translate(W / 2 + offset[0], H / 2 + offset[1])
    ctx.rotate((rotate * Math.PI) / 180)
    ctx.scale(scale, scale)
    ctx.drawImage(base, -W / 2, -H / 2, W, H)
    ctx.restore()
    if (!forExport) {
      // frames are opaque white PNGs, so ghosts go on top with multiply:
      // white is neutral and the neighbor's lines show through as gray
      ctx.globalCompositeOperation = 'multiply'
      ctx.globalAlpha = 0.3
      if (ghostPrev && prev) ctx.drawImage(prev, 0, 0, W, H)
      if (ghostNext && next) ctx.drawImage(next, 0, 0, W, H)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const all = activeRef.current ? [...strokes, activeRef.current] : strokes
    for (const s of all) {
      ctx.strokeStyle = s.tool === 'eraser' ? '#fff' : '#1a1a1a'
      ctx.lineWidth = s.tool === 'eraser' ? Math.max(16, W / 30) : Math.max(3, W / 90)
      ctx.beginPath()
      s.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
      ctx.stroke()
    }
  }, [strokes, rotate, scale, offset, ghostPrev, ghostNext])

  useEffect(() => { if (loaded) render() }, [loaded, render])

  const toXY = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return [
      ((e.clientX - rect.left) / rect.width) * canvasRef.current.width,
      ((e.clientY - rect.top) / rect.height) * canvasRef.current.height,
    ]
  }

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    if (tool === 'move') {
      dragRef.current = { at: toXY(e), from: offset }
    } else {
      activeRef.current = { tool, pts: [toXY(e)] }
    }
  }
  const onPointerMove = (e) => {
    if (tool === 'move' && dragRef.current) {
      const [x, y] = toXY(e)
      const { at, from } = dragRef.current
      setOffset([from[0] + x - at[0], from[1] + y - at[1]])
    } else if (activeRef.current) {
      activeRef.current.pts.push(toXY(e))
      render()
    }
  }
  const onPointerUp = () => {
    if (activeRef.current) {
      const s = activeRef.current
      activeRef.current = null
      if (s.pts.length > 1) setStrokes((prev) => [...prev, s])
    }
    dragRef.current = null
  }

  const pristine = rotate === 0 && scale === 1 && offset[0] === 0 && offset[1] === 0 && strokes.length === 0

  const reset = () => { setRotate(0); setScale(1); setOffset([0, 0]); setStrokes([]) }

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      render(true) // re-render without ghosts
      const image = canvasRef.current.toDataURL('image/png')
      render()
      const res = await fetch('/api/frames/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: fileOf(src), image }),
      })
      if (!res.ok) throw new Error(await res.text())
      onSaved(await res.json())
    } catch (err) {
      setError(String(err.message ?? err))
      setBusy(false)
    }
  }

  const { base } = imgsRef.current
  return (
    <div className="frame-editor">
      <div className="editor-bar">
        <button onClick={onCancel} disabled={busy}>← back to frames</button>
        <span className="editor-title">frame {pageNum}</span>
        <button className="save-order" onClick={save} disabled={pristine || busy}>
          {busy ? 'saving…' : 'save frame'}
        </button>
      </div>
      {loaded && base ? (
        <canvas
          ref={canvasRef}
          width={base.naturalWidth}
          height={base.naturalHeight}
          className={`edit-canvas tool-${tool}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      ) : (
        <div className="loading">loading frame…</div>
      )}
      <div className="editor-tools">
        {['move', 'pencil', 'eraser'].map((t) => (
          <button key={t} className={tool === t ? 'active' : ''} onClick={() => setTool(t)}>
            {t === 'move' ? '✥ move' : t === 'pencil' ? '✏️ pencil' : '⌫ eraser'}
          </button>
        ))}
        <button onClick={() => setStrokes((s) => s.slice(0, -1))} disabled={strokes.length === 0}>undo</button>
        <button onClick={reset} disabled={pristine}>reset</button>
      </div>
      <div className="editor-sliders">
        <label>
          tilt
          <input type="range" min="-20" max="20" step="0.5" value={rotate} onChange={(e) => setRotate(Number(e.target.value))} />
          {rotate}°
        </label>
        <label>
          scale
          <input type="range" min="0.7" max="1.3" step="0.01" value={scale} onChange={(e) => setScale(Number(e.target.value))} />
          {scale.toFixed(2)}×
        </label>
      </div>
      <div className="editor-ghosts">
        {prevSrc && (
          <label><input type="checkbox" checked={ghostPrev} onChange={(e) => setGhostPrev(e.target.checked)} /> ghost prev</label>
        )}
        {nextSrc && (
          <label><input type="checkbox" checked={ghostNext} onChange={(e) => setGhostNext(e.target.checked)} /> ghost next</label>
        )}
      </div>
      {error && <p className="draw-error">{error}</p>}
    </div>
  )
}
