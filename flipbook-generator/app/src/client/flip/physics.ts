// Thumb-flip physics: a pure state machine with no rendering.
//
// The book has `n` pages. `page` is the integer page currently resting on top
// of the unflipped pile. Dragging the thumb builds `tension` (the page bows)
// until it crosses RELEASE_AT, at which point the page snaps free as a
// `Flight` that springs toward flat on the other pile with a little overshoot.
// A flick releases pages in a burst; play mode releases them on a clock.
//
// All time is in milliseconds. `step(dt)` must be called every animation frame.

export const TUNING = {
  RELEASE_AT: 0.55, // fraction of a page-drag at which the page snaps
  RELEASE_V: 0.006, // flip progress per ms at release (≈6 per second)
  SPRING: 0.00004, // acceleration toward flat, per ms²
  DAMP: 0.009, // velocity damping, per ms
  MIN_FLIGHT_GAP: 28, // ms between spawned flights in a riffle
  MOMENTUM_DECAY: 0.94, // per 16 ms, same feel as the old scrubber
  MOMENTUM_STOP: 0.00002, // pages/ms below which momentum ends
  TENSION_RELAX: 0.012, // per ms, how fast a bowed page relaxes when let go
  SETTLE_T: 0.004, // |t - 1| below which a flight is done...
  SETTLE_V: 0.0004, // ...together with |v| below this
  MAX_IN_FLIGHT: 4, // older flights snap flat beyond this
};

export type Flight = {
  index: number; // the page that is moving
  t: number; // 0 = flat on its origin pile, 1 = flat on its destination pile
  v: number; // progress per ms
  dir: 1 | -1; // 1 = flipping forward (up onto the top pile), -1 = back down
};

export type FlipMode = "idle" | "drag" | "riffle" | "play";

export type FlipSnapshot = {
  page: number;
  tension: number;
  pos: number;
  inFlight: readonly Flight[];
  mode: FlipMode;
};

export class FlipPhysics {
  private n: number;
  private page = 0;
  private tension = 0; // -1..1, sign = direction of the bow
  private inFlight: Flight[] = [];
  private mode: FlipMode = "idle";
  private momentum = 0; // pages/ms while riffling
  private carry = 0; // fractional page progress accumulated by momentum/play
  private lastSpawn = -Infinity;
  private clock = 0;
  private fps = 0;

  constructor(pageCount: number) {
    this.n = Math.max(1, pageCount);
  }

  // ---------- reads ----------

  get pageCount(): number {
    return this.n;
  }

  get currentPage(): number {
    return this.page;
  }

  // Float position for the filmstrip handle: the resting page plus how far the
  // thumb has dragged it.
  get pos(): number {
    return this.clamp(this.page + this.tension * TUNING.RELEASE_AT);
  }

  snapshot(): FlipSnapshot {
    return { page: this.page, tension: this.tension, pos: this.pos, inFlight: this.inFlight, mode: this.mode };
  }

  // ---------- writes ----------

  setPageCount(n: number): void {
    this.n = Math.max(1, n);
    this.page = this.clampInt(this.page);
    this.inFlight = this.inFlight.filter((f) => f.index < this.n);
  }

  // Jump straight to a page with no animation (keyboard step, reset).
  jumpTo(page: number): void {
    this.stop();
    this.page = this.clampInt(Math.round(page));
    this.tension = 0;
  }

  // Step one page with a proper flight (keyboard arrows).
  stepPage(dir: 1 | -1): void {
    this.stop();
    this.flip(dir);
  }

  dragStart(): void {
    this.stop();
    this.mode = "drag";
  }

  // The thumb is at float position `target` (in pages). Pages between the
  // resting page and the thumb release; the remainder becomes tension.
  dragTo(target: number): void {
    if (this.mode !== "drag") this.dragStart();
    // the covers can bow but never release: allow a partial page past each end
    const slack = TUNING.RELEASE_AT * 0.95;
    const p = Math.max(-slack, Math.min(this.n - 1 + slack, target));
    // release every page the thumb has fully passed
    while (p - this.page >= TUNING.RELEASE_AT && this.page < this.n - 1) this.flip(1);
    while (this.page - p >= TUNING.RELEASE_AT && this.page > 0) this.flip(-1);
    this.tension = Math.max(-1, Math.min(1, (p - this.page) / TUNING.RELEASE_AT));
  }

  // Thumb lifted with `velocity` in pages/ms. Fast → riffle with momentum;
  // slow → the bowed page relaxes back.
  release(velocity: number): void {
    this.momentum = velocity;
    this.carry = this.tension * TUNING.RELEASE_AT;
    this.mode = Math.abs(velocity) > TUNING.MOMENTUM_STOP * 4 ? "riffle" : "idle";
  }

  playAt(fps: number): void {
    this.stop();
    this.fps = fps;
    this.mode = "play";
    this.carry = 0;
  }

  setPlaySpeed(fps: number): void {
    this.fps = fps;
  }

  stop(): void {
    this.mode = "idle";
    this.momentum = 0;
    this.carry = 0;
  }

  // Advance the simulation by `dt` ms.
  step(dt: number): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 50); // never integrate across a long stall
    this.clock += dt;

    if (this.mode === "riffle") this.stepRiffle(dt);
    else if (this.mode === "play") this.stepPlay(dt);
    else if (this.mode === "idle" && this.tension !== 0) {
      // bowed page relaxes
      const k = Math.exp(-TUNING.TENSION_RELAX * dt);
      this.tension *= k;
      if (Math.abs(this.tension) < 0.01) this.tension = 0;
    }

    // integrate flights: a damped spring toward t = 1
    for (const f of this.inFlight) {
      f.v += (TUNING.SPRING * (1 - f.t) - TUNING.DAMP * f.v) * dt;
      f.t += f.v * dt;
    }
    this.inFlight = this.inFlight.filter(
      (f) => !(Math.abs(f.t - 1) < TUNING.SETTLE_T && Math.abs(f.v) < TUNING.SETTLE_V),
    );
    // cap the number of pages in the air: the oldest ones just land
    while (this.inFlight.length > TUNING.MAX_IN_FLIGHT) this.inFlight.shift();
  }

  // ---------- internals ----------

  private stepRiffle(dt: number): void {
    this.momentum *= Math.pow(TUNING.MOMENTUM_DECAY, dt / 16);
    this.carry += this.momentum * dt;
    // release whole pages, at most one per MIN_FLIGHT_GAP so a riffle reads as
    // a burst of distinct pages rather than a blur
    const dir: 1 | -1 = this.carry > 0 ? 1 : -1;
    if (Math.abs(this.carry) >= TUNING.RELEASE_AT && this.canSpawn()) {
      if (this.flip(dir)) this.carry -= dir;
      else this.carry = 0; // hit the cover
    }
    const atEnd = (dir === 1 && this.page >= this.n - 1) || (dir === -1 && this.page <= 0);
    if (Math.abs(this.momentum) < TUNING.MOMENTUM_STOP || atEnd) {
      this.momentum = 0;
      // leftover carry that didn't make a page becomes a bow that relaxes
      this.tension = Math.max(-1, Math.min(1, this.carry / TUNING.RELEASE_AT));
      this.carry = 0;
      this.mode = "idle";
    } else {
      this.tension = Math.max(-1, Math.min(1, this.carry / TUNING.RELEASE_AT));
    }
  }

  private stepPlay(dt: number): void {
    this.carry += (this.fps / 1000) * dt;
    while (this.carry >= 1) {
      this.carry -= 1;
      if (this.page >= this.n - 1) {
        // end of the book: close it and start over, no flight for the wrap
        this.page = 0;
        this.inFlight = [];
      } else {
        this.flip(1);
      }
    }
    this.tension = 0;
  }

  private canSpawn(): boolean {
    return this.clock - this.lastSpawn >= TUNING.MIN_FLIGHT_GAP;
  }

  // Releases the page in `dir`. Returns false at the covers.
  private flip(dir: 1 | -1): boolean {
    if (dir === 1) {
      if (this.page >= this.n - 1) return false;
      this.inFlight.push({ index: this.page, t: 0, v: TUNING.RELEASE_V, dir: 1 });
      this.page += 1;
    } else {
      if (this.page <= 0) return false;
      this.inFlight.push({ index: this.page - 1, t: 0, v: TUNING.RELEASE_V, dir: -1 });
      this.page -= 1;
    }
    this.lastSpawn = this.clock;
    this.tension = 0;
    return true;
  }

  private clamp(p: number): number {
    return Math.max(0, Math.min(this.n - 1, p));
  }

  private clampInt(p: number): number {
    return Math.max(0, Math.min(this.n - 1, Math.round(p)));
  }
}
