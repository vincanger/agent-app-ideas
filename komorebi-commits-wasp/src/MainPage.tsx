import { useEffect, useRef, useState } from "react";
import { Link } from "wasp/client/router";
import { recordShare } from "wasp/client/operations";
import { KomorebiEngine, PREF_DEFS } from "./komorebi/engine.js";
import { fetchContributions, demoContributions, computeStats } from "./komorebi/data.js";
import { savePng, saveGif } from "./komorebi/exports.js";
import { prefsFromSearch, buildSearch } from "./komorebi/params.js";
import { GitHubLink } from "./GitHubLink";
import "./Main.css";

type Prefs = Record<string, number>;
type Meta = { user: string; total: number; streak: number; demo: boolean };
type MonthMark = { frac: number; label: string };

function captionText(meta: Meta): string {
  const parts = [`${meta.total.toLocaleString()} contributions in the last year`];
  if (meta.streak > 1) parts.push(`longest streak ${meta.streak} days`);
  if (meta.demo) parts.push("demo data");
  return `@${meta.user} · ${parts.join(" · ")}`;
}

export function MainPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<any>(null);
  const daysRef = useRef<any[] | null>(null);
  const metaRef = useRef<Meta | null>(null);
  const prefsRef = useRef<Prefs>(prefsFromSearch(window.location.search) as Prefs);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [prefs, setPrefs] = useState<Prefs>(prefsRef.current);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [monthMarks, setMonthMarks] = useState<MonthMark[]>([]);
  const [frameW, setFrameW] = useState(0);
  const [notice, setNotice] = useState("");
  const [toast, setToast] = useState("");
  const [inputVal, setInputVal] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return (p.get("user") || "").trim().replace(/^@/, "");
  });

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  }

  function syncUrl() {
    if (urlTimer.current) clearTimeout(urlTimer.current);
    urlTimer.current = setTimeout(() => {
      const m = metaRef.current;
      const user = m && !m.demo ? m.user : "";
      const search = buildSearch(user, prefsRef.current);
      window.history.replaceState(null, "", window.location.pathname + search);
    }, 200);
  }

  async function load(user: string) {
    setNotice("");
    let days: any[] | undefined;
    let demo = false;
    if (user) {
      try {
        days = await fetchContributions(user);
      } catch {
        demo = true;
        setNotice(`couldn’t reach the contributions api for @${user} — showing an imagined year instead`);
      }
    } else {
      demo = true;
    }
    if (demo) days = demoContributions();

    const stats = computeStats(days);
    const m: Meta = { user: user || "someone", total: stats.total, streak: stats.streak, demo };
    metaRef.current = m;
    daysRef.current = days!;
    setMeta(m);
    engineRef.current?.setDays(days);
    syncUrl();
    document.title = user
      ? `@${user} — komorebi commits`
      : "komorebi commits — your GitHub year as dappled light";
  }

  /* engine lifetime + global listeners */
  useEffect(() => {
    const engine = new KomorebiEngine({
      canvas: canvasRef.current!,
      interactive: true,
      prefs: prefsRef.current,
      onLayout: (e: any) => {
        setFrameW(e.cssW);
        setMonthMarks([...e.monthMarks]);
      },
    });
    engineRef.current = engine;
    engine.startLoop();

    const params = new URLSearchParams(window.location.search);
    load(params.has("demo") ? "" : (params.get("user") || "").trim().replace(/^@/, ""));

    /* waving at the canopy stirs it; moving the pointer shifts the layers */
    let lastPX: number | null = null, lastPY: number | null = null;
    const onPointerMove = (e: PointerEvent) => {
      engine.setParallaxTarget(
        e.clientX / window.innerWidth - 0.5,
        e.clientY / window.innerHeight - 0.5
      );
      if (lastPX !== null) {
        const d = Math.hypot(e.clientX - lastPX, e.clientY - lastPY!);
        engine.addStir(d * 0.0025);
      }
      lastPX = e.clientX; lastPY = e.clientY;
    };
    window.addEventListener("pointermove", onPointerMove);

    /* hidden easter egg from the essay: press `e` — every gap between
       leaves is a pinhole camera, and during an eclipse each one
       projects a crescent sun */
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "e" && document.activeElement !== inputRef.current) {
        engine.triggerEclipse();
        showToast("the moon passes — every gap in the leaves is a pinhole camera");
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("keydown", onKeyDown);
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPrefChange(name: string, value: number) {
    const next = { ...prefsRef.current, [name]: value };
    prefsRef.current = next;
    setPrefs(next);
    engineRef.current?.setPrefs({ [name]: value });
    syncUrl();
  }

  /* tooltip follows the nearest lit day */
  function onCanvasPointerMove(e: React.PointerEvent) {
    const tip = tooltipRef.current;
    const engine = engineRef.current;
    if (!tip || !engine) return;
    const b = engine.hitTest(e.clientX, e.clientY);
    if (b) {
      const d = new Date(b.date + "T12:00:00");
      tip.textContent = `${d.toLocaleDateString("en", { month: "long", day: "numeric" })} — ${b.count} contribution${b.count === 1 ? "" : "s"}`;
      tip.style.left = e.clientX + "px";
      tip.style.top = e.clientY + "px";
      tip.style.opacity = "1";
    } else {
      tip.style.opacity = "0";
    }
  }

  function recordIfReal(action: "link" | "png" | "gif") {
    const m = metaRef.current;
    if (!m || m.demo || !daysRef.current) return;
    recordShare({
      handle: m.user,
      action,
      prefs: prefsRef.current as any,
      contributions: daysRef.current as any,
      total: m.total,
      streak: m.streak,
    }).catch((err: unknown) => console.warn("recordShare failed", err));
  }

  async function onCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("link copied — send someone your light");
    } catch {
      showToast(window.location.href);
    }
    recordIfReal("link");
  }

  function onSavePng() {
    const m = metaRef.current;
    if (!engineRef.current || !m) return;
    savePng(engineRef.current, captionText(m), m.user);
    showToast("saved");
    recordIfReal("png");
  }

  async function onSaveGif() {
    const m = metaRef.current;
    if (!engineRef.current || !m) return;
    showToast("rendering gif…");
    const ok = await saveGif(engineRef.current, captionText(m), m.user);
    if (ok) {
      showToast("gif saved — loops back and forth, seamlessly");
      recordIfReal("gif");
    }
  }

  return (
    <>
      <header className="ui">
        <h1>
          dappled commits<span className="jp">木漏れ日</span>
          <GitHubLink />
        </h1>
      </header>

      <form
        className="ui"
        onSubmit={(e) => {
          e.preventDefault();
          const u = inputVal.trim().replace(/^@/, "");
          if (u) load(u);
          inputRef.current?.blur();
        }}
      >
        <span className="at">@</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="github username"
          autoComplete="off"
          spellCheck={false}
          aria-label="GitHub username"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
        />
      </form>

      <main className="scene">
        <div className="frame">
          <div className="inner">
            <canvas
              ref={canvasRef}
              className="scene-canvas"
              onPointerMove={onCanvasPointerMove}
              onPointerLeave={() => { if (tooltipRef.current) tooltipRef.current.style.opacity = "0"; }}
            />
          </div>
          <div className="months" style={{ width: frameW ? `${frameW}px` : undefined }}>
            {monthMarks.map((m, i) => (
              <span key={i} style={{ left: `${m.frac * 100}%` }}>{m.label}</span>
            ))}
          </div>
        </div>

        <div className="caption">
          {meta && (
            <>
              <b>@{meta.user}</b>
              {" · "}
              {`${meta.total.toLocaleString()} contributions in the last year`}
              {meta.streak > 1 && ` · longest streak ${meta.streak} days`}
              {meta.demo && " · demo data"}
            </>
          )}
        </div>

        <div className="props">
          {Object.entries(PREF_DEFS).map(([name, d]: [string, any]) => (
            <div className="prop" key={name}>
              <label>
                {name}: <span className="val">{d.fmt(prefs[name])}</span>
                <input
                  type="range"
                  min={d.min}
                  max={d.max}
                  step={d.step}
                  value={prefs[name]}
                  aria-label={name}
                  onChange={(e) => onPrefChange(name, parseFloat(e.target.value))}
                />
              </label>
            </div>
          ))}
        </div>

        <div className="about">
          <h2>This is your GitHub contribution graph, redrawn as if it were sunlight through a tree.</h2>
          <p>
            Every day you committed code is a gap in the canopy: a patch of
            light on the ground, bigger and brighter the more you shipped. The wind keeps it moving:
            patches sway and flicker in the breeze, and slow clouds of leaf-shadow
            drift across, dimming the light as they pass. The sliders tune
            how golden the light is, how hard the wind blows, how thick the canopy is, etc,
            and the whole thing is drawn in flat dithered pixels, after the essay
            <i>“dappled light”</i> by Jacky Zhao. Copying a link or saving an image
            leaves your light in the <Link to="/gallery">gallery</Link>.
          </p>
        </div>
      </main>

      <div className={`notice${notice ? " show" : ""}`}>{notice}</div>
      <div className="tooltip" ref={tooltipRef} />
      <div className={`toast${toast ? " show" : ""}`}>{toast}</div>

      <footer className="ui">
        <div className="credit">
          after <a href="https://jzhao.xyz/posts/dappled-light" target="_blank" rel="noopener noreferrer">“dappled light”</a> by jacky zhao
        </div>
        <div className="actions">
          <button onClick={onCopyLink}>copy link</button>
          <button onClick={onSavePng}>save image</button>
          <button onClick={onSaveGif}>save gif</button>
          <Link to="/gallery">gallery →</Link>
        </div>
      </footer>
    </>
  );
}
