import { useCallback, useEffect, useRef, useState } from "react";
import { CANVAS_SIZE, drawSmooth, simplify, type Point } from "../vector";

type Stroke = { id: string; pts: Point[] };

const FRAME_OPTIONS = [8, 12, 16];

// Minimal drawing pad: one black pencil, undo, clear, a motion prompt and a
// frame count. Calls onSubmit with the sketch as a PNG data URL.
export function DrawCanvas({
  onSubmit,
  busy,
  error,
}: {
  onSubmit: (args: { sketch: string; motion: string; frameCount: number }) => void;
  busy: boolean;
  error: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activeRef = useRef<Point[] | null>(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [motion, setMotion] = useState("");
  const [frameCount, setFrameCount] = useState(16);

  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokesRef.current) drawSmooth(ctx, s.pts);
    if (activeRef.current) drawSmooth(ctx, activeRef.current);
  }, []);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const toCanvasXY = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) / rect.width) * CANVAS_SIZE,
      ((e.clientY - rect.top) / rect.height) * CANVAS_SIZE,
    ];
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    activeRef.current = [toCanvasXY(e)];
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeRef.current) return;
    activeRef.current.push(toCanvasXY(e));
    redraw();
  };
  const onPointerUp = () => {
    if (!activeRef.current) return;
    if (activeRef.current.length > 1) {
      const pts = simplify(activeRef.current, 2).map(([x, y]) => [Math.round(x), Math.round(y)] as Point);
      strokesRef.current.push({ id: `s${strokesRef.current.length + 1}`, pts });
      setStrokeCount(strokesRef.current.length);
    }
    activeRef.current = null;
    redraw();
  };

  const undo = () => {
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    redraw();
  };
  const clear = () => {
    strokesRef.current = [];
    setStrokeCount(0);
    redraw();
  };

  const canGo = strokeCount > 0 && motion.trim().length > 0 && !busy;

  const submit = () => {
    if (!canGo || !canvasRef.current) return;
    onSubmit({ sketch: canvasRef.current.toDataURL("image/png"), motion: motion.trim(), frameCount });
  };

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
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        disabled={busy}
      />
      <div className="draw-tools">
        <label className="frame-count">
          frames
          <select value={frameCount} onChange={(e) => setFrameCount(Number(e.target.value))} disabled={busy}>
            {FRAME_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button className="animate-btn" onClick={submit} disabled={!canGo}>
          {busy ? "starting…" : "animate ▶"}
        </button>
      </div>
      {error && <p className="draw-error">{error}</p>}
    </div>
  );
}
