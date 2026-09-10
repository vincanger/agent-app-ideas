import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import type { AuthUser } from "wasp/auth";
import { getFlipbook, updateFlipbook, useQuery } from "wasp/client/operations";
import { Scrubber } from "../components/Scrubber";
import { Layout } from "../Layout";

export function FlipbookPage({ user }: { user: AuthUser }) {
  const { id } = useParams<{ id: string }>();
  // frames stream in while the job runs: poll until it's done
  const [pollMs, setPollMs] = useState<number | false>(3000);
  const { data: flipbook, error } = useQuery(getFlipbook, { id: id! }, {
    enabled: !!id,
    refetchInterval: pollMs,
  });
  useEffect(() => {
    setPollMs(flipbook?.status === "generating" ? 3000 : false);
  }, [flipbook]);

  const [wobble, setWobble] = useState(1.5); // boil amplitude in px (0 = off)
  const [fps, setFps] = useState<number | null>(null);
  const saveTimer = useRef<number>(0);

  // adopt the saved speed once the flipbook loads
  useEffect(() => {
    if (flipbook && fps === null) setFps(flipbook.fps);
  }, [flipbook, fps]);

  const changeFps = (value: number) => {
    setFps(value);
    // persist per flipbook, debounced so dragging the slider doesn't spam saves
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      if (id) updateFlipbook({ id, fps: value }).catch(() => {});
    }, 400);
  };

  if (error) {
    return (
      <Layout user={user}>
        <p className="draw-error">{error.message}</p>
        <Link to="/">← back</Link>
      </Layout>
    );
  }
  if (!flipbook || fps === null) {
    return (
      <Layout user={user}>
        <p className="hint">loading…</p>
      </Layout>
    );
  }

  const pages = flipbook.frames.map((f) => ({ src: f.image, draft: f.draft }));
  const generating = flipbook.status === "generating";

  return (
    <Layout user={user}>
      <div className="mode-row">
        <Link to="/" className="mode-toggle">← my flipbooks</Link>
        <span className="hint">{flipbook.motion}</span>
      </div>

      <Scrubber pages={pages} fps={fps} wobble={wobble} />

      {generating && (
        <p className="hint">
          {flipbook.frames.length < flipbook.frameCount
            ? `laying out the animation… (${flipbook.frameCount} pages)`
            : `${flipbook.frames.filter((f) => !f.draft).length} of ${flipbook.frameCount} pages at full resolution — scrub the rough cut meanwhile`}
        </p>
      )}
      {flipbook.status === "failed" && (
        <p className="draw-error">generation failed: {flipbook.error}</p>
      )}

      <div className="sliders">
        <label className="wobble">
          speed
          <input type="range" min="2" max="24" step="1" value={fps} onChange={(e) => changeFps(Number(e.target.value))} />
          {fps} pages/s
        </label>
        <label className="wobble">
          wobble
          <input type="range" min="0" max="3" step="0.5" value={wobble} onChange={(e) => setWobble(Number(e.target.value))} />
          {wobble === 0 ? "off" : `${wobble}px`}
        </label>
      </div>
      <p className="hint">drag or flick the strip · space to play · ←/→ to step</p>
    </Layout>
  );
}
