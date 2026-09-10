// Strip warp: draws a page hinged along its top edge at a given flip angle,
// bowed so the free edge lags the hinge, with foreshortening from vertical
// squash and a shading gradient for depth. Pure 2D canvas — no 3D.

export const BEND = {
  BACK_SQUASH: 0.22, // pages behind the hinge are seen edge-on: squash them
  BOW_LAG: 0.9, // how much the free edge lags the hinge at full bow
  SHADE_MAX: 0.3, // darkest overlay on a strip seen edge-on
  TENSION_ANGLE: 1.25, // radians the free edge lifts at tension 1
  BACK_PAPER: "#f7f4ee",
  BACK_EDGE: "#d8d2c4",
};

export type PageRect = { x: number; y: number; w: number; h: number };

export type BendOptions = {
  // 0 = flat on the bottom pile, 1 = flat on the top pile (values past 1 are
  // the overshoot press and render as 1)
  progress: number;
  // 0..1 amount of bow (0 = rigid card)
  bow: number;
  strips: number;
  // 0..1 extra transparency for motion smear
  alpha?: number;
  draft?: boolean;
};

// Per-strip angle: a rigid page has the same angle everywhere; a bowed page's
// free edge (y=1) lags the hinge (y=0), most at mid-flip and not at all when
// flat on either pile.
function stripAngle(theta: number, yNorm: number, bow: number): number {
  return theta - bow * BEND.BOW_LAG * Math.sin(theta) * yNorm;
}

export function drawFlippingPage(
  ctx: CanvasRenderingContext2D,
  tex: CanvasImageSource,
  rect: PageRect,
  opts: BendOptions,
): void {
  const theta = Math.min(1, Math.max(0, opts.progress)) * Math.PI;
  const n = Math.max(4, opts.strips);
  const srcH = "naturalHeight" in tex ? tex.naturalHeight : (tex as HTMLCanvasElement).height;
  const srcW = "naturalWidth" in tex ? tex.naturalWidth : (tex as HTMLCanvasElement).width;
  drawStrips(ctx, tex, srcW, srcH, rect, n, (yNorm) => stripAngle(theta, yNorm, opts.bow), opts);
}

// Shadow the lifted free edge of a bowed page casts on the page beneath.
export function drawTensionShadow(ctx: CanvasRenderingContext2D, rect: PageRect, tension: number): void {
  const lift = Math.abs(tension);
  if (lift < 0.02) return;
  const reach = rect.h * 0.35 * lift;
  const g = ctx.createLinearGradient(0, rect.y + rect.h - reach, 0, rect.y + rect.h);
  g.addColorStop(0, "rgba(40, 32, 20, 0)");
  g.addColorStop(1, `rgba(40, 32, 20, ${0.35 * lift})`);
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y + rect.h - reach, rect.w, reach);
}

// A page under the thumb: not rotating, just lifting its free edge a little.
export function drawTensionedPage(
  ctx: CanvasRenderingContext2D,
  tex: CanvasImageSource,
  rect: PageRect,
  tension: number,
  strips: number,
  draft = false,
): void {
  const srcH = "naturalHeight" in tex ? tex.naturalHeight : (tex as HTMLCanvasElement).height;
  const srcW = "naturalWidth" in tex ? tex.naturalWidth : (tex as HTMLCanvasElement).width;
  const lift = Math.abs(tension) * BEND.TENSION_ANGLE;
  // free edge lifts toward the viewer for a forward bow, away for a backward one
  const sign = tension >= 0 ? 1 : -1;
  drawStrips(ctx, tex, srcW, srcH, rect, Math.max(4, strips), (yNorm) => sign * lift * yNorm * yNorm, { draft });
}

function drawStrips(
  ctx: CanvasRenderingContext2D,
  tex: CanvasImageSource,
  srcW: number,
  srcH: number,
  rect: PageRect,
  n: number,
  angleAt: (yNorm: number) => number,
  opts: { alpha?: number; draft?: boolean },
): void {
  const stripSrcH = srcH / n;
  const stripLen = rect.h / n;
  let cy = rect.y; // running position along the page, from the hinge
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  for (let i = 0; i < n; i++) {
    const yNorm = (i + 0.5) / n;
    const a = angleAt(yNorm);
    const c = Math.cos(a);
    if (c >= 0) {
      // front side: the page image, foreshortened
      const dh = Math.max(0.5, stripLen * c);
      ctx.drawImage(tex, 0, i * stripSrcH, srcW, stripSrcH, rect.x, cy, rect.w, dh + 0.6);
      const shade = (1 - c) * BEND.SHADE_MAX;
      if (shade > 0.01) {
        ctx.fillStyle = shadeFill(ctx, rect, shade);
        ctx.fillRect(rect.x, cy, rect.w, dh + 0.6);
      }
      if (opts.draft) {
        ctx.fillStyle = "rgba(244, 241, 234, 0.35)";
        ctx.fillRect(rect.x, cy, rect.w, dh + 0.6);
      }
      cy += dh;
    } else {
      // back side: blank paper, seen edge-on and heading up over the hinge
      const dh = stripLen * c * BEND.BACK_SQUASH; // negative
      const shade = (1 + c) * BEND.SHADE_MAX * 0.6;
      ctx.fillStyle = BEND.BACK_PAPER;
      ctx.fillRect(rect.x, cy + dh, rect.w, -dh + 0.6);
      if (shade > 0.01) {
        ctx.fillStyle = `rgba(40, 32, 20, ${shade})`;
        ctx.fillRect(rect.x, cy + dh, rect.w, -dh + 0.6);
      }
      cy += dh;
    }
  }
  ctx.restore();
}

// Shade that darkens toward the page's outer edge, so a tilted page reads as
// lit from the binding side rather than as a uniform grey slab.
function shadeFill(ctx: CanvasRenderingContext2D, rect: PageRect, shade: number): CanvasGradient {
  const g = ctx.createLinearGradient(rect.x, 0, rect.x + rect.w, 0);
  g.addColorStop(0, `rgba(40, 32, 20, ${shade * 0.55})`);
  g.addColorStop(1, `rgba(40, 32, 20, ${shade})`);
  return g;
}

// Soft shadow a lifting page throws on the page below it.
export function drawPageShadow(ctx: CanvasRenderingContext2D, rect: PageRect, progress: number): void {
  const theta = Math.min(1, Math.max(0, progress)) * Math.PI;
  const s = Math.sin(theta);
  if (s < 0.02 || theta > Math.PI / 2) return;
  const reach = rect.h * Math.cos(theta);
  const g = ctx.createLinearGradient(0, rect.y, 0, rect.y + Math.max(1, reach));
  g.addColorStop(0, `rgba(40, 32, 20, ${0.22 * s})`);
  g.addColorStop(1, "rgba(40, 32, 20, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, Math.max(1, reach));
}
