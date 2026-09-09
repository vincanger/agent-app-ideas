import { useCallback, useEffect, useRef, useState } from "react";
import { BoilCanvas } from "./BoilCanvas";

// The flipbook player. The filmstrip of thumbnails IS the slider: dragging
// across it flips pages, a flick keeps riffling with momentum, and the play
// button loops at `fps` pages per second.
export function Scrubber({
  pages,
  fps,
  wobble,
  aspect,
}: {
  pages: string[];
  fps: number;
  wobble: number;
  aspect: number;
}) {
  const [pos, setPos] = useState(0); // float page position
  const [playing, setPlaying] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const velRef = useRef(0);
  const fpsRef = useRef(fps);
  const lastMove = useRef<{ t: number; p: number } | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => { fpsRef.current = fps; }, [fps]);

  const n = pages.length;

  const setPosition = useCallback((p: number, count: number) => {
    const clamped = Math.max(0, Math.min(count - 1, p));
    posRef.current = clamped;
    setPos(clamped);
  }, []);

  // keep the position valid as frames stream in / the flipbook changes
  useEffect(() => {
    if (posRef.current > n - 1) setPosition(n - 1, n);
  }, [n, setPosition]);

  const stopAnimations = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setPlaying(false);
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // --- scrubbing ---
  const posFromEvent = useCallback((e: React.PointerEvent) => {
    const strip = stripRef.current;
    if (!strip) return 0;
    const rect = strip.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    return (x / rect.width) * (n - 1);
  }, [n]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    stopAnimations();
    e.currentTarget.setPointerCapture(e.pointerId);
    setPosition(posFromEvent(e), n);
    lastMove.current = { t: performance.now(), p: posRef.current };
    velRef.current = 0;
  }, [n, posFromEvent, setPosition, stopAnimations]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const p = posFromEvent(e);
    const now = performance.now();
    const prev = lastMove.current;
    if (prev && now > prev.t) velRef.current = (p - prev.p) / (now - prev.t); // pages/ms
    lastMove.current = { t: now, p };
    setPosition(p, n);
  }, [n, posFromEvent, setPosition]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    // flick momentum: keep riffling with decay
    let v = velRef.current * 16; // pages per ~frame
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 16;
      last = now;
      v *= Math.pow(0.94, dt);
      const next = posRef.current + v * dt;
      setPosition(next, n);
      if (Math.abs(v) > 0.02 && next > 0 && next < n - 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setPosition(Math.round(posRef.current), n); // snap
      }
    };
    if (Math.abs(v) > 0.05) rafRef.current = requestAnimationFrame(step);
    else setPosition(Math.round(posRef.current), n);
  }, [n, setPosition]);

  // --- play button: forward loop at fps pages/sec ---
  const togglePlay = useCallback(() => {
    if (playing) {
      stopAnimations();
      return;
    }
    setPlaying(true);
    let last = performance.now();
    // unclamped accumulator: setPosition clamps to n-1, which would otherwise
    // pin the loop just below the wrap threshold at the last page
    let acc = posRef.current;
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      acc = (acc + fpsRef.current * dt) % n;
      setPosition(acc, n);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [playing, n, setPosition, stopAnimations]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // never hijack keys while the user is typing
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName)) return;
      if (e.key === "ArrowRight") { stopAnimations(); setPosition(Math.round(posRef.current) + 1, n); }
      if (e.key === "ArrowLeft") { stopAnimations(); setPosition(Math.round(posRef.current) - 1, n); }
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n, setPosition, stopAnimations, togglePlay]);

  const current = Math.min(n - 1, Math.round(pos));
  // with many pages, thumbnail only every few to keep the strip readable
  const step = Math.max(1, Math.round(n / 12));
  const thumbs = pages.map((src, i) => ({ src, i })).filter(({ i }) => i % step === 0);
  const activeThumb = Math.floor(current / step) * step;
  const handlePct = n > 1 ? (pos / (n - 1)) * 100 : 0;

  return (
    <>
      <div className="page-view" style={{ aspectRatio: aspect }}>
        <BoilCanvas src={pages[current]} amp={wobble} />
        <div className="page-num">{current + 1} / {n}</div>
      </div>

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
          aria-valuemin={1}
          aria-valuemax={n}
          aria-valuenow={current + 1}
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
