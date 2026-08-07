import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Link } from "wasp/client/router";
import { useQuery, getGallery } from "wasp/client/operations";
import { KomorebiEngine } from "./komorebi/engine.js";
import { buildSearch } from "./komorebi/params.js";
import { GitHubLink } from "./GitHubLink";
import "./Main.css";

const ACTION_LABELS: Record<string, string> = {
  link: "copied a link",
  png: "saved an image",
  gif: "saved a gif",
};

function relativeTime(iso: string | Date): string {
  const then = new Date(iso).getTime();
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function ShareCard({ share }: { share: any }) {
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const engine = new KomorebiEngine({
      canvas,
      interactive: false,
      fixedWidth: Math.max(200, wrap.clientWidth),
      prefs: share.prefs,
    });
    engine.setDays(share.contributions);
    /* only cards in view spend frames on the breeze */
    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? engine.startLoop() : engine.stopLoop()),
      { rootMargin: "120px" }
    );
    io.observe(wrap);
    return () => { io.disconnect(); engine.destroy(); };
  }, [share.id, share.updatedAt]);

  return (
    <div
      className="share-card"
      onClick={() => navigate("/" + buildSearch(share.handle, share.prefs))}
      title={`open @${share.handle}'s light`}
    >
      <div className="inner" ref={wrapRef}>
        <canvas ref={canvasRef} />
      </div>
      <div className="card-caption">
        <b>@{share.handle}</b>
        {` · ${share.total.toLocaleString()} contributions`}
        {share.streak > 1 && ` · streak ${share.streak}d`}
        {` · ${ACTION_LABELS[share.action] || share.action} ${relativeTime(share.updatedAt)}`}
      </div>
    </div>
  );
}

export function GalleryPage() {
  const { data: shares, isLoading, error } = useQuery(getGallery);

  return (
    <>
      <header className="ui">
        <h1>
          <Link to="/">dappled commits</Link>
          <span className="jp">木漏れ日</span>
          <GitHubLink />
        </h1>
      </header>

      <main className="gallery">
        <div className="gallery-title">the gallery</div>
        <div className="gallery-sub">
          every light here was shared by someone — click one to step under their tree
        </div>

        {isLoading && <div className="gallery-empty">gathering the light…</div>}
        {error && <div className="gallery-empty">the gallery is unreachable right now</div>}

        {shares && shares.length === 0 && (
          <div className="gallery-empty">
            no light has been shared yet.
            <br />
            <Link to="/">go cast some</Link>
          </div>
        )}

        {shares && shares.length > 0 && (
          <div className="gallery-grid">
            {shares.map((s: any) => (
              <ShareCard key={s.id} share={s} />
            ))}
          </div>
        )}
      </main>

      <footer className="ui">
        <div className="credit">
          after <a href="https://jzhao.xyz/posts/dappled-light" target="_blank" rel="noopener noreferrer">“dappled light”</a> by jacky zhao
        </div>
        <div className="actions">
          <Link to="/">← back to your light</Link>
        </div>
      </footer>
    </>
  );
}
