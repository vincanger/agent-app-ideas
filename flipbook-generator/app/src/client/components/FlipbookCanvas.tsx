import { useEffect, useRef } from "react";
import { BEND, drawFlippingPage, drawPageShadow, drawTensionShadow, drawTensionedPage } from "../flip/bend";
import type { FlipPhysics, FlipSnapshot } from "../flip/physics";
import { BoilRenderer, PageImages } from "../flip/textures";

const LOOK = {
  PAD: 14, // around the book, css px
  EDGE_PX: 1, // pile thickness per page
  MAX_EDGE_LINES: 24,
  BINDING_H: 12,
  STRIPS_REST: 32,
  STRIPS_RIFFLE: 12,
  BOW: 0.35, // bow of a flying page (0 = rigid card)
  BOIL_MS: 110, // stepped boil clock
  BOARD: "#ddd5c4",
  BOARD_EDGE: "#c4bba8",
  PAGE_EDGE: "#d8d2c4",
  STAPLE: "#9a9388",
};

export type PageSpec = { src: string; draft: boolean };

// The canvas book. Runs the physics clock and draws the stack, the resting
// page, any pages in flight, and the binding. Reports each frame's snapshot
// upward so the filmstrip can follow.
export function FlipbookCanvas({
  pages,
  physics,
  wobble,
  onFrame,
}: {
  pages: PageSpec[];
  physics: FlipPhysics;
  wobble: number;
  onFrame?: (snap: FlipSnapshot) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pagesRef = useRef(pages);
  const wobbleRef = useRef(wobble);
  const onFrameRef = useRef(onFrame);
  pagesRef.current = pages;
  wobbleRef.current = wobble;
  onFrameRef.current = onFrame;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let raf = 0;
    let last = performance.now();
    let boilSeed = 0;
    let lastBoil = 0;
    let lastReported: { page: number; pos: number } | null = null;
    const images = new PageImages(() => {
      /* a page decoded: the next frame picks it up */
    });
    const boil = new BoilRenderer();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth;
      // square pages (the drawing pad is square) plus room for the top pile,
      // the binding and the bottom pile
      const pageW = cssW - 2 * LOOK.PAD;
      const pageH = pageW;
      const cssH = LOOK.PAD + pageH * BEND.BACK_SQUASH + LOOK.BINDING_H + pageH + LOOK.MAX_EDGE_LINES * LOOK.EDGE_PX + LOOK.PAD;
      canvas.style.height = `${cssH}px`;
      if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
      }
      return { dpr, cssW, cssH, pageW, pageH };
    };

    const draw = (now: number) => {
      const dt = now - last;
      last = now;
      physics.step(dt);
      const snap = physics.snapshot();
      const specs = pagesRef.current;
      const n = specs.length;

      const { dpr, cssW, cssH, pageW, pageH } = resize();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const hingeY = LOOK.PAD + pageH * BEND.BACK_SQUASH + LOOK.BINDING_H;
      const rect = { x: LOOK.PAD, y: hingeY, w: pageW, h: pageH };

      // board (the cardboard back of the book): spans the flipped pile above
      // the binding too, so pages that flip over land on something
      ctx.fillStyle = LOOK.BOARD;
      ctx.strokeStyle = LOOK.BOARD_EDGE;
      roundRect(ctx, rect.x - 6, LOOK.PAD - 6, rect.w + 12, cssH - 2 * LOOK.PAD + 12, 6);
      ctx.fill();
      ctx.stroke();
      // a darker band behind the binding, where the pages hinge
      ctx.fillStyle = LOOK.BOARD_EDGE;
      ctx.fillRect(rect.x - 6, hingeY - LOOK.BINDING_H - 2, rect.w + 12, LOOK.BINDING_H + 2);

      if (n === 0) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const backFlights = snap.inFlight.filter((f) => f.dir === -1);
      const flatIndex = Math.min(n - 1, snap.page + backFlights.length);
      const remaining = n - 1 - flatIndex; // pages still under the flat page
      const flipped = snap.page; // pages on the top pile

      // bottom pile: one edge line per remaining page
      const bottomLines = Math.min(remaining, LOOK.MAX_EDGE_LINES);
      for (let k = 1; k <= bottomLines; k++) {
        ctx.fillStyle = k % 2 ? LOOK.PAGE_EDGE : "#fff";
        ctx.fillRect(rect.x + k * 0.4, rect.y + rect.h + (k - 1) * LOOK.EDGE_PX, rect.w - k * 0.8, LOOK.EDGE_PX);
      }

      // top pile: flipped pages seen edge-on above the binding
      if (flipped > 0) {
        const pileH = Math.min(flipped, LOOK.MAX_EDGE_LINES) * LOOK.EDGE_PX;
        const topH = rect.h * BEND.BACK_SQUASH;
        ctx.fillStyle = BEND.BACK_PAPER;
        ctx.fillRect(rect.x, hingeY - LOOK.BINDING_H - topH, rect.w, topH);
        ctx.fillStyle = BEND.BACK_EDGE;
        ctx.fillRect(rect.x, hingeY - LOOK.BINDING_H - topH - pileH, rect.w, pileH);
        // the fold where the flipped pages bend back over the binding
        const fold = ctx.createLinearGradient(0, hingeY - LOOK.BINDING_H - 18, 0, hingeY - LOOK.BINDING_H);
        fold.addColorStop(0, "rgba(40, 32, 20, 0)");
        fold.addColorStop(1, "rgba(40, 32, 20, 0.28)");
        ctx.fillStyle = fold;
        ctx.fillRect(rect.x, hingeY - LOOK.BINDING_H - 18, rect.w, 18);
      }

      // the page underneath: visible whenever the resting page lifts (a
      // forward bow) — it's what the reader is about to see
      const tension = reducedMotion ? 0 : snap.tension;
      if (tension > 0.01 && flatIndex + 1 < n) {
        const under = images.get(specs[flatIndex + 1].src);
        if (under) ctx.drawImage(under, rect.x, rect.y, rect.w, rect.h);
        else {
          ctx.fillStyle = "#fff";
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        }
        drawTensionShadow(ctx, rect, tension);
      }

      // resting page (bowed if the thumb is loading it)
      const flatSpec = specs[flatIndex];
      const flatImg = images.get(flatSpec.src);
      if (flatImg) {
        let tex: CanvasImageSource = flatImg;
        const amp = wobbleRef.current;
        if (amp > 0 && boil.available) {
          if (now - lastBoil > LOOK.BOIL_MS) {
            boilSeed = (boilSeed + 1) % 97;
            lastBoil = now;
          }
          tex = boil.render(flatImg, amp, boilSeed) ?? flatImg;
        }
        if (Math.abs(tension) > 0.01) {
          drawTensionedPage(ctx, tex, rect, tension, LOOK.STRIPS_REST, flatSpec.draft);
        } else {
          ctx.drawImage(tex, rect.x, rect.y, rect.w, rect.h);
          if (flatSpec.draft) {
            ctx.fillStyle = "rgba(244, 241, 234, 0.35)";
            ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
          }
        }
      } else {
        ctx.fillStyle = "#fff";
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      }

      // pages in flight: furthest along first, newest on top
      if (!reducedMotion) {
        const flights = [...snap.inFlight].sort((a, b) => b.t - a.t);
        const riffling = snap.mode === "riffle" || snap.mode === "play";
        for (const f of flights) {
          const spec = specs[f.index];
          if (!spec) continue;
          const img = images.get(spec.src);
          if (!img) continue;
          // a backward flight is the same motion run in reverse
          const progress = f.dir === 1 ? f.t : 1 - Math.min(1, f.t);
          drawPageShadow(ctx, rect, progress);
          // pages are opaque paper: no smear ghost, no alpha — a riffle is
          // just pages moving fast, which is what a real one looks like
          const strips = riffling ? LOOK.STRIPS_RIFFLE : LOOK.STRIPS_REST;
          drawFlippingPage(ctx, img, rect, { progress, bow: LOOK.BOW, strips, draft: spec.draft });
        }
      }

      // binding: two staples over the hinge
      ctx.fillStyle = LOOK.STAPLE;
      for (const fx of [0.22, 0.78]) {
        roundRect(ctx, rect.x + rect.w * fx - 10, hingeY - LOOK.BINDING_H + 2, 20, 6, 3);
        ctx.fill();
      }

      // page number
      ctx.fillStyle = "#b0a893";
      ctx.font = "11px Georgia, serif";
      ctx.textAlign = "right";
      ctx.fillText(`${flatIndex + 1} / ${n}`, rect.x + rect.w - 6, rect.y + rect.h - 6);

      // let the filmstrip follow, but only when something moved
      const pos = snap.pos;
      if (!lastReported || lastReported.page !== snap.page || Math.abs(lastReported.pos - pos) > 0.004) {
        lastReported = { page: snap.page, pos };
        onFrameRef.current?.(snap);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      boil.dispose();
    };
  }, [physics]);

  return <canvas ref={canvasRef} className="book-canvas" aria-hidden="true" />;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
