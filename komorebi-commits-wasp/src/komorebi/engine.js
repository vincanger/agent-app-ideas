'use strict';

/* ============================================================
   komorebi commits — a GitHub contribution graph as dappled light,
   rendered flat: a low-resolution intensity field pushed through
   Bayer ordered dithering into three tones. Every day with commits
   is a gap in the canopy; the breeze keeps the pattern breathing.

   This is the framework-agnostic render engine: one KomorebiEngine
   per canvas. The main page runs an interactive instance (tooltip,
   parallax, eclipse); the gallery runs many small passive ones.
   ============================================================ */

/* palette (flat) */
export const GROUND = [20, 33, 58];     // navy
export const LIGHT  = [154, 172, 208];  // periwinkle
export const GOLD   = [220, 175, 78];
export const SHADE  = [52, 70, 106];    // canopy shade — dimmer than light, softer than ground
export const PAGE_RGB = [11, 19, 34];
export const BORDER_RGB = [90, 102, 121]; // the frame line, composited over the page

/* tunable properties — ranges shared by sliders, URL params, and the server */
export const PREF_DEFS = {
  fringe: { def: 0.12, min: 0,   max: 1, step: 0.01, fmt: (v) => v.toFixed(2) },
  breeze: { def: 0.10, min: 0,   max: 1, step: 0.01, fmt: (v) => v.toFixed(2) },
  shade:  { def: 0.50, min: 0,   max: 1, step: 0.01, fmt: (v) => v.toFixed(2) },
  dapple: { def: 0.70, min: 0.4, max: 2, step: 0.01, fmt: (v) => v.toFixed(2), rebuild: true },
  grain:  { def: 2,    min: 1,   max: 5, step: 1,    fmt: (v) => `${v}px`,     rebuild: true },
};

export function defaultPrefs() {
  const p = {};
  for (const [name, d] of Object.entries(PREF_DEFS)) p[name] = d.def;
  return p;
}

export function clampPref(name, v) {
  const d = PREF_DEFS[name];
  return Math.min(d.max, Math.max(d.min, v));
}

export const REDUCED_MOTION =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- tiny deterministic hash → [0,1) ---------- */
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function hash2(x, y) { return hash(x * 157.31 + y * 12.9898); }

/* one octave of bilinear value noise */
function vnoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix + seed, iy), b = hash2(ix + 1 + seed, iy);
  const c = hash2(ix + seed, iy + 1), d = hash2(ix + 1 + seed, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/* 8×8 Bayer matrix, normalized to [0,1) */
const BAYER = (() => {
  const m = [[0]];
  let n = 1;
  while (n < 8) {
    for (let y = 0; y < n; y++) {
      m[y + n] = [];
      for (let x = 0; x < n; x++) {
        const v = m[y][x] * 4;
        m[y][x] = v; m[y][x + n] = v + 2; m[y + n][x] = v + 3; m[y + n][x + n] = v + 1;
      }
    }
    n *= 2;
  }
  return m.flat().map(v => v / 64);
})();

export class KomorebiEngine {
  /**
   * @param {Object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {boolean} [opts.interactive] main-page instance: window resize,
   *   parallax/stir inputs, eclipse. Gallery cards pass false.
   * @param {number} [opts.fixedWidth] css width in px; when absent the engine
   *   sizes to min(90vw, 1160) like the page frame.
   * @param {Object} [opts.prefs] initial prefs (partial, merged over defaults)
   * @param {Function} [opts.onLayout] called after every layout() — the page
   *   uses it to size the month labels row.
   */
  constructor({ canvas, interactive = true, fixedWidth = null, prefs = null, onLayout = null }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.interactive = interactive;
    this.fixedWidth = fixedWidth;
    this.onLayout = onLayout;
    this.prefs = { ...defaultPrefs(), ...(prefs || {}) };

    this.blobs = [];
    this.monthMarks = [];
    this.days = null;

    /* field geometry */
    this.cssW = 0; this.cssH = 0;   // canvas css size
    this.fw = 0; this.fh = 0;       // field size in chunky pixels
    this.cellW = 0; this.rowH = 0;  // field units per week / weekday
    this.img = null;                // ImageData for the field
    this.field = null;
    this.ibuf = null; this.sbuf = null; // per-pixel intensity / shade, for the fringe pass

    /* interaction: waving the pointer stirs the canopy; it settles after.
       parallax: layers slide with the pointer in proportion to their depth. */
    this.stir = 0;
    this.par = { x: 0, y: 0, tx: 0, ty: 0 };
    this.eclipse = { active: false, t0: 0, dur: 18 };

    /* gallery cards get a random time offset so they don't swing in unison */
    this.start = performance.now() - (interactive ? 0 : Math.random() * 40000);
    this.lastFrame = 0;
    this.rafId = null;
    this.running = false;

    this._frame = this._frame.bind(this);
    if (interactive && !fixedWidth) {
      this._onResize = () => {
        this.layoutField();
        if (this.onLayout) this.onLayout(this);
        if (REDUCED_MOTION) this.renderOnce();
      };
      window.addEventListener('resize', this._onResize);
    }
    this.layoutField();
  }

  currentT() {
    return REDUCED_MOTION ? 12.0 : (performance.now() - this.start) / 1000;
  }

  /* ---------- data → blobs ---------- */

  setDays(days) {
    this.days = days;
    this.buildBlobs(days);
    this.layoutField();
    if (this.onLayout) this.onLayout(this);
    this.renderOnce();
  }

  setPrefs(partial) {
    let rebuild = false;
    for (const [name, v] of Object.entries(partial)) {
      if (!(name in PREF_DEFS)) continue;
      const c = clampPref(name, v);
      if (c !== this.prefs[name]) {
        this.prefs[name] = c;
        if (PREF_DEFS[name].rebuild) rebuild = true;
      }
    }
    if (rebuild) {
      this.layoutField();
      if (this.onLayout) this.onLayout(this);
    }
    if (REDUCED_MOTION || !this.running) this.renderOnce();
  }

  buildBlobs(days) {
    const counts = days.filter(d => d.count > 0).map(d => d.count).sort((a, b) => a - b);
    const p90 = counts.length ? counts[Math.floor(counts.length * 0.9)] : 1;

    const last = new Date(days[days.length - 1].date + 'T12:00:00');
    const lastDow = last.getDay();

    this.blobs = [];
    const byWeek = new Map();
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      const date = new Date(d.date + 'T12:00:00');
      const daysAgo = Math.round((last - date) / 86400000);
      const week = Math.floor((daysAgo + lastDow) / 7); // 0 = current week
      if (!byWeek.has(week)) byWeek.set(week, d.date);
      if (d.count === 0) continue;
      const v = Math.min(1, 0.5 * (d.level / 4) + 0.5 * (d.count / p90));
      const seed = i * 13.37;
      this.blobs.push({
        date: d.date, count: d.count, week, dow: date.getDay(), v,
        jx: (hash(seed + 1) - 0.5) * 0.6,
        jy: (hash(seed + 2) - 0.5) * 0.6,
        p1: hash(seed + 3) * Math.PI * 2,
        p2: hash(seed + 4) * Math.PI * 2,
        p3: hash(seed + 5) * Math.PI * 2,
        fj: 0.75 + hash(seed + 6) * 0.6,
        amp: 0.6 + hash(seed + 7) * 0.5,
        // height in the canopy: busy days hang low (crisp, bright),
        // light days sit high (soft, wide, dim) — penumbra grows with
        // distance from the ground, like the post's U = f·a·b
        depth: Math.min(1, 0.65 * (1 - v) + 0.35 * hash(seed + 9)),
      });
    }

    // month starts, oldest → newest, as fraction across the field
    this.monthMarks = [];
    const weeks = this.maxWeek();
    let lastMonth = -1;
    for (let w = weeks - 1; w >= 0; w--) {
      const ds = byWeek.get(w);
      if (!ds) continue;
      const m = new Date(ds + 'T12:00:00').getMonth();
      if (m !== lastMonth) {
        this.monthMarks.push({
          frac: (weeks - 1 - w) / weeks,
          label: new Date(ds + 'T12:00:00').toLocaleString('en', { month: 'short' }).toLowerCase(),
        });
        lastMonth = m;
      }
    }
  }

  maxWeek() {
    return this.blobs.length ? Math.max(53, ...this.blobs.map(b => b.week + 1)) : 53;
  }

  /* ---------- layout ---------- */

  layoutField() {
    const weeks = this.maxWeek();
    this.cssW = this.fixedWidth != null
      ? this.fixedWidth
      : Math.min(window.innerWidth * 0.9, 1160);
    this.cssH = Math.round(this.cssW * 14 / 53);      // rows are two cells tall
    const g = this.prefs.grain;
    this.fw = Math.max(40, Math.round(this.cssW / g));
    this.fh = Math.max(12, Math.round(this.cssH / g));
    this.cellW = this.fw / weeks;
    this.rowH = this.fh / 7;
    this.canvas.width = this.fw; this.canvas.height = this.fh;
    this.canvas.style.width = this.cssW + 'px';
    this.canvas.style.height = this.cssH + 'px';
    this.img = this.ctx.createImageData(this.fw, this.fh);
  }

  /* ---------- wind ---------- */

  /* slow envelope: gusts swell, then the canopy settles */
  gustAt(t) {
    const g = 0.6 * Math.sin(t * 0.11 + 1.7) + 0.4 * Math.sin(t * 0.043) + 0.2 * Math.sin(t * 0.27 + 4.1);
    return Math.min(1, Math.max(0, 0.5 + 0.5 * g));
  }

  /* One pendulum for the whole canopy: everything swings together on a
     slow oscillation whose amplitude waxes with gusts and settles after.
     Deeper leaves lag behind — the swing travels through the tree — and
     a small per-leaf flutter keeps it organic. */
  blobCenter(b, t) {
    const breeze = this.prefs.breeze;
    const G = this.gustAt(t);
    const energy = (0.25 + breeze * 0.9 + this.stir * 0.9) * (0.35 + 0.65 * G);
    const omega = 1.1 + 0.9 * breeze;
    const lag = b.depth * 0.9 + b.dow * 0.06;
    const swing = Math.sin(t * omega - lag);
    const swing2 = Math.cos(t * omega - lag);
    const amp = b.amp * this.cellW * (0.5 + 1.1 * b.depth) * energy;
    const ts = t * (0.15 + 0.9 * breeze);
    const flutter = Math.sin(ts * 1.9 * b.fj + b.p1) * 0.2;
    const flutterY = Math.sin(ts * 1.5 * b.fj + b.p2) * 0.14;
    const depthShift = 0.5 + 1.3 * b.depth;
    return {
      x: (this.maxWeek() - 1 - b.week + 0.5 + b.jx) * this.cellW
         + amp * (swing + flutter)
         + this.par.x * this.cellW * 1.8 * depthShift,
      y: (b.dow + 0.5 + b.jy) * this.rowH
         + amp * (0.28 * swing2 + flutterY)
         + this.par.y * this.rowH * 0.14 * depthShift,
    };
  }

  /* ---------- the field ---------- */

  eclipseState(t) {
    if (!this.eclipse.active) return null;
    const e = (t - this.eclipse.t0) / this.eclipse.dur;
    if (e >= 1) { this.eclipse.active = false; return null; }
    const c = Math.sin(e * Math.PI);
    const ang = -0.5 + e * 1.1;
    return { c, dx: Math.cos(ang), dy: Math.sin(ang) * 0.7 };
  }

  /* splat one radial kernel into the field (weight may be negative).
     `core` is the flat plateau fraction: a crisp low leaf has a wide
     core and a steep rim; a high leaf is all penumbra (core 0). */
  splat(cx, cy, r, amp, core) {
    const { fw, fh, field } = this;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(fw - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(fh - 1, Math.ceil(cy + r));
    const r2 = r * r;
    const rim = 1 - core;
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      const row = y * fw;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const d2 = (dx * dx + dy * dy) / r2;
        if (d2 >= 1) continue;
        const d = Math.sqrt(d2);
        let w = 1;
        if (d > core) {
          const u = (1 - d) / rim;
          w = u * u * (3 - 2 * u);
        }
        field[row + x] += w * amp;
      }
    }
  }

  render(t) {
    if (!this.img) return;
    this.computeFields(t);
    this.composite();
  }

  /* seamless loop frame for the GIF export: cross-blend the intensity
     field with itself one `period` earlier, weighted by `frac` ∈ [0,1),
     so frame frac→1 lands exactly on frame frac=0. The blend happens
     before dithering, so the output stays four flat tones. */
  renderLoopFrame(t0, frac, period) {
    if (!this.img) return;
    this.computeFields(t0 + frac * period);
    const n = this.ibuf.length;
    if (!this._loopI || this._loopI.length !== n) {
      this._loopI = new Float32Array(n);
      this._loopS = new Float32Array(n);
    }
    this._loopI.set(this.ibuf);
    this._loopS.set(this.sbuf);
    this.computeFields(t0 + frac * period - period);
    const { ibuf, sbuf, _loopI, _loopS } = this;
    for (let i = 0; i < n; i++) {
      ibuf[i] = _loopI[i] * (1 - frac) + ibuf[i] * frac;
      sbuf[i] = _loopS[i] * (1 - frac) + sbuf[i] * frac;
    }
    this.composite();
  }

  /* pass 0+1: splat the leaves and fill ibuf/sbuf with per-pixel
     intensity and canopy shade at time t */
  computeFields(t) {
    const { fw, fh, rowH } = this;
    if (!this.field || this.field.length !== fw * fh) this.field = new Float32Array(fw * fh);
    this.field.fill(0);

    const ec = this.eclipseState(t);
    const G = this.gustAt(t);
    const dapple = this.prefs.dapple;

    for (const b of this.blobs) {
      const c = this.blobCenter(b, t);
      const flicker = 0.8 + 0.2 * Math.sin(t * (0.12 + 0.75 * this.prefs.breeze) * 1.6 * b.fj + b.p3);
      const r = rowH * (0.35 + 0.85 * b.v) * dapple * (1 + 0.55 * b.depth);
      const amp = (0.42 + 0.55 * b.v) * flicker * (0.85 + 0.15 * G) * (1 - 0.38 * b.depth);
      const core = 0.55 * (1 - b.depth);
      this.splat(c.x, c.y, r, amp, core);
      if (ec) {
        // the moon takes a bite from every pinhole's sun
        const off = r * (1.5 - 1.28 * ec.c);
        this.splat(c.x + off * ec.dx, c.y + off * ec.dy, r * 0.92, -amp * 1.15 * ec.c, core);
      }
    }

    // drifting undergrowth noise + canopy shade + dithered quantization
    const shadeAmt = this.prefs.shade;
    const drift = t * (0.008 + 0.06 * this.prefs.breeze);  // shade clouds cross with the wind

    // canopy shade field: domain-warped three-octave fBm, computed on a
    // coarse subgrid then sampled bilinearly per pixel — organic cloud
    // shapes instead of the blocky look of raw bilinear noise
    const SSTEP = 3;
    const sgw = Math.ceil(fw / SSTEP) + 2, sgh = Math.ceil(fh / SSTEP) + 2;
    let shadeGrid = null;
    if (shadeAmt > 0) {
      shadeGrid = new Float32Array(sgw * sgh);
      for (let gy = 0; gy < sgh; gy++) {
        const y = gy * SSTEP;
        for (let gx = 0; gx < sgw; gx++) {
          const x = gx * SSTEP;
          // a whisper of warp breaks the grid feel of value noise without
          // marbling it — his canopy is plain thresholded octave noise
          const wx = (vnoise(x * 0.026 - drift * 0.6, y * 0.052, 911) - 0.5) * 2.2;
          const wy = (vnoise(x * 0.026 + 37 - drift * 0.45, y * 0.052, 977) - 0.5) * 1.8;
          // octaves travel at different speeds: the cloud masses cross,
          // their mid detail lags, and the finest lacework stays pinned —
          // so it is revealed by the passing shade rather than dragged
          const o1 = vnoise(x * 0.045 - drift + wx, y * 0.09 + drift * 0.2 + wy, 501);
          const o2 = vnoise(x * 0.0945 - drift * 0.84 + wx * 0.7, y * 0.189 + wy * 0.7, 733);
          const o3 = vnoise(x * 0.189 - drift * 0.21 + wx * 0.3, y * 0.378 + wy * 0.3, 877);
          const raw = (o1 + 0.5 * o2 + 0.25 * o3) / 1.75;
          shadeGrid[gy * sgw + gx] = Math.min(1, Math.max(0, (raw - 0.36) * 2.0));
        }
      }
    }

    if (!this.ibuf || this.ibuf.length !== fw * fh) {
      this.ibuf = new Float32Array(fw * fh);
      this.sbuf = new Float32Array(fw * fh);
    }
    const { ibuf, sbuf, field } = this;

    // the shade is the farthest layer from the wall, so it parallaxes most
    const shadeParX = this.par.x * fw * 0.045, shadeParY = this.par.y * fh * 0.06;

    // pass 1: total intensity + shade per pixel
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const idx = y * fw + x;
        // static undergrowth: the speckle constellation is fixed in
        // place — only the light and shade passing over it make
        // individual pixels blink out and return
        const noise = vnoise(x * 0.121, y * 0.275, 0);

        // sample the canopy shade field bilinearly
        let S = 0;
        if (shadeGrid) {
          let sgx = (x + shadeParX) / SSTEP, sgy = (y + shadeParY) / SSTEP;
          if (sgx < 0) sgx = 0; else if (sgx > sgw - 1.01) sgx = sgw - 1.01;
          if (sgy < 0) sgy = 0; else if (sgy > sgh - 1.01) sgy = sgh - 1.01;
          const six = sgx | 0, siy = sgy | 0;
          const sfx = sgx - six, sfy = sgy - siy;
          const s0 = siy * sgw + six;
          const sA = shadeGrid[s0], sB = shadeGrid[s0 + 1];
          const sC = shadeGrid[s0 + sgw], sD = shadeGrid[s0 + sgw + 1];
          S = shadeAmt * (sA + (sB - sA) * sfx + (sC - sA) * sfy + (sA - sB - sC + sD) * sfx * sfy);
        }

        ibuf[idx] = Math.max(0, field[idx]) + noise * 0.26 - 0.10 - S * S * 0.55;
        sbuf[idx] = S;
      }
    }
  }

  /* pass 2: dither ibuf/sbuf into flat tones. Gold is a boundary fringe —
     it lives where the light field falls off steeply at mid tones, the rim
     where sun blooms into shadow — not a band of raw intensity. */
  composite() {
    const { fw, fh, rowH, ibuf, sbuf } = this;
    const data = this.img.data;
    const fringe = this.prefs.fringe;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const idx = y * fw + x;
        const I = ibuf[idx];
        const bay = BAYER[(y & 7) * 8 + (x & 7)] - 0.5;

        // fringe score first: it straddles the light/dark boundary.
        // grad is normalized by rowH so the bloom width doesn't change
        // with grain resolution.
        let gold = false;
        if (fringe > 0) {
          const xl = ibuf[x > 0 ? idx - 1 : idx], xr = ibuf[x < fw - 1 ? idx + 1 : idx];
          const yu = ibuf[y > 0 ? idx - fw : idx], yd = ibuf[y < fh - 1 ? idx + fw : idx];
          const grad = Math.abs(xr - xl) + Math.abs(yd - yu);
          const mid = Math.max(0, 1 - Math.abs(I - 0.40) * 2.6);
          gold = grad * rowH * 0.33 * mid * fringe + bay * 0.45 > 0.34;
        }

        let col = GROUND;
        if (gold) col = GOLD;
        else if (I + bay * 0.62 > 0.40) col = LIGHT;
        else if (sbuf[idx] + bay * 0.7 > 0.55) col = SHADE;
        const o = idx * 4;
        data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = 255;
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
  }

  renderOnce() { this.render(this.currentT()); }

  /* ---------- animation loop ---------- */

  startLoop() {
    if (this.running) return;
    this.running = true;
    this.rafId = requestAnimationFrame(this._frame);
  }

  stopLoop() {
    this.running = false;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  destroy() {
    this.stopLoop();
    if (this._onResize) window.removeEventListener('resize', this._onResize);
  }

  _frame(now) {
    if (!this.running) return;
    const t = (now - this.start) / 1000;
    if (REDUCED_MOTION && !this.eclipse.active) {
      this.render(12.0);
      this.rafId = null;
      return; // re-rendered on demand only
    }
    if (now - this.lastFrame > 1000 / 30) { // 30fps is plenty for leaves
      this.lastFrame = now;
      this.stir *= 0.985;                          // the canopy settles
      this.par.x += (this.par.tx - this.par.x) * 0.07; // layers ease toward the pointer
      this.par.y += (this.par.ty - this.par.y) * 0.07;
      this.render(t);
    }
    this.rafId = requestAnimationFrame(this._frame);
  }

  /* ---------- interaction hooks (main page only) ---------- */

  setParallaxTarget(tx, ty) { this.par.tx = tx; this.par.ty = ty; }

  addStir(d) { this.stir = Math.min(1.2, this.stir + d); }

  triggerEclipse() {
    this.eclipse.active = true;
    this.eclipse.t0 = (performance.now() - this.start) / 1000;
    if (REDUCED_MOTION && this.running && this.rafId == null) {
      this.rafId = requestAnimationFrame(this._frame);
    }
  }

  /* nearest blob to a client-space point, within reach — for the tooltip */
  hitTest(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = (clientX - rect.left) / rect.width * this.fw;
    const my = (clientY - rect.top) / rect.height * this.fh;
    const t = this.currentT();
    let bestB = null, bestD = Infinity;
    for (const b of this.blobs) {
      const c = this.blobCenter(b, t);
      const d = Math.hypot(c.x - mx, c.y - my);
      if (d < bestD) { bestD = d; bestB = b; }
    }
    return bestB && bestD < this.rowH * 1.3 ? bestB : null;
  }
}
