import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlipPhysics, type FlipSnapshot } from "../flip/physics";
import { FlipbookCanvas, type PageSpec } from "./FlipbookCanvas";

// The flipbook player. The canvas book draws the pages; the filmstrip of
// thumbnails IS the slider: dragging across it thumbs through pages (they bow,
// then snap), a flick riffles with momentum, and the play button loops at
// `fps` pages per second.
export function Scrubber({ pages, fps, wobble }: { pages: PageSpec[]; fps: number; wobble: number }) {
  const physics = useMemo(() => new FlipPhysics(pages.length), []); // one book per mount
  // dev hook so the physics can be poked from the console / headless tests
  if (import.meta.env.DEV) (window as unknown as { __flip?: FlipPhysics }).__flip = physics;
  const [snap, setSnap] = useState<FlipSnapshot>(() => physics.snapshot());
  const [playing, setPlaying] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const lastMove = useRef<{ t: number; p: number } | null>(null);
  const velRef = useRef(0);

  const n = pages.length;

  // frames stream in while generating
  useEffect(() => {
    physics.setPageCount(n);
  }, [physics, n]);

  useEffect(() => {
    if (playing) physics.setPlaySpeed(fps);
  }, [physics, fps, playing]);

  const onFrame = useCallback((s: FlipSnapshot) => {
    setSnap(s);
    if (s.mode !== "play") setPlaying(false);
  }, []);

  // --- scrubbing ---
  const posFromEvent = useCallback((e: React.PointerEvent) => {
    const strip = stripRef.current;
    if (!strip) return 0;
    const rect = strip.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    return (x / rect.width) * (n - 1);
  }, [n]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setPlaying(false);
    physics.dragStart();
    physics.dragTo(posFromEvent(e));
    lastMove.current = { t: performance.now(), p: physics.pos };
    velRef.current = 0;
  }, [physics, posFromEvent]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const p = posFromEvent(e);
    const now = performance.now();
    const prev = lastMove.current;
    if (prev && now > prev.t) velRef.current = (p - prev.p) / (now - prev.t); // pages/ms
    lastMove.current = { t: now, p };
    physics.dragTo(p);
  }, [physics, posFromEvent]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    physics.release(velRef.current);
  }, [physics]);

  const togglePlay = useCallback(() => {
    if (playing) {
      physics.stop();
      setPlaying(false);
    } else {
      physics.playAt(fps);
      setPlaying(true);
    }
  }, [physics, playing, fps]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // never hijack keys while the user is typing
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName)) return;
      if (e.key === "ArrowRight") { setPlaying(false); physics.stepPage(1); }
      if (e.key === "ArrowLeft") { setPlaying(false); physics.stepPage(-1); }
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [physics, togglePlay]);

  const current = Math.min(n - 1, snap.page);
  // with many pages, thumbnail only every few to keep the strip readable
  const step = Math.max(1, Math.round(n / 12));
  const thumbs = pages.map((p, i) => ({ src: p.src, i })).filter(({ i }) => i % step === 0);
  const activeThumb = Math.floor(current / step) * step;
  const handlePct = n > 1 ? (snap.pos / (n - 1)) * 100 : 0;

  return (
    <>
      <FlipbookCanvas pages={pages} physics={physics} wobble={wobble} onFrame={onFrame} />

      <div className="controls">
        <button className="play" onClick={togglePlay} aria-label="play/pause">
          {playing ? "⏸" : "▶"}
        </button>
        <div
          className="strip"
          ref={stripRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          role="slider"
          aria-label="flipbook pages"
          aria-valuemin={1}
          aria-valuemax={n}
          aria-valuenow={current + 1}
          aria-valuetext={`page ${current + 1} of ${n}`}
          tabIndex={0}
        >
          {thumbs.map(({ src, i }) => (
            <img
              key={i}
              src={src}
              alt=""
              className={i === activeThumb ? "thumb active" : "thumb"}
              draggable={false}
            />
          ))}
          <div className="handle" style={{ left: `${handlePct}%` }} />
        </div>
      </div>
    </>
  );
}
