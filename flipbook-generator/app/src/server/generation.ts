// Per-frame generation (ported from ../../pipeline/framelib.js).
//
// Frame 1 is the user's sketch itself. Every later frame is one model call
// with two reference images: the original sketch (sole style authority) and
// the previous frame (pose continuity). Frames are generated sequentially
// because each one continues from the last.

import Replicate from "replicate";
import { buildInput } from "./models";

const RETRIES = 2;

const STYLE_NOTE = `Style: match the original drawing's line quality exactly (same stroke weight, same simple black lines on white, same character design and proportions). Keep it as loose and simple as the original; do not add shading, texture, or scenery.`;

const FRAME_NOTE = `Framing: same camera, same scale, same facing direction as the previous frame. The subject stays exactly the same size as in the original drawing. Anything static in the scene stays exactly where it was. ONE single frame on a white background — no grid, no sequence, no text, no border.`;

export function framePrompt({ k, frames, motion }: { k: number; frames: number; motion: string }): string {
  return `Draw frame ${k} of ${frames} of a flipbook animation of the attached drawing. The animation: ${motion}.
Image 1 is the original drawing (frame 1): it is the ONLY style reference. Image 2 is frame ${k - 1}, the previous frame: continue directly from its pose.
Advance the motion by one even step (1/${frames - 1} of the whole action past the previous frame). Do not finish early: the action completes exactly at frame ${frames}.
The pose must be clearly different from the previous frame — this is a flipbook page, so the motion has to visibly progress. Include the splashes, ripples, bubbles and other effects the action calls for, in the same simple line style.
${STYLE_NOTE}
${FRAME_NOTE}`;
}

// Full-resolution redraw of one sheet cell. The cell fixes the pose (and so
// the pacing); the sketch fixes the style.
export function redrawPrompt({ k, frames, motion }: { k: number; frames: number; motion: string }): string {
  return `Redraw image 2 as a single full-resolution frame. It is frame ${k} of ${frames} of a flipbook animation of image 1, the original drawing. The animation: ${motion}.
Keep image 2's pose, position, scale and every element (splashes, ripples, bubbles) exactly as they are — do not advance or change the motion. Only the rendering changes: draw it cleanly at full size in exactly the style of image 1.
${STYLE_NOTE}
${FRAME_NOTE}`;
}

async function outputToBuffer(output: unknown): Promise<Buffer> {
  const item = Array.isArray(output) ? output[0] : output;
  if (item && typeof (item as { blob?: unknown }).blob === "function") {
    const blob: Blob = await (item as { blob: () => Promise<Blob> }).blob();
    return Buffer.from(await blob.arrayBuffer());
  }
  const url = typeof item === "string" ? item : (item as { url: () => string }).url();
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}

export function dataUrlToBuffer(dataUrl: string): Buffer {
  const b64 = dataUrl.match(/^data:image\/png;base64,(.+)$/)?.[1];
  if (!b64) throw new Error("expected a PNG data URL");
  return Buffer.from(b64, "base64");
}

export function bufferToDataUrl(buf: Buffer): string {
  return `data:image/png;base64,${buf.toString("base64")}`;
}

// One model call with retries; returns the PNG bytes of the generated frame.
export async function generateFrame({
  model,
  prompt,
  images,
  aspect = "1:1",
}: {
  model: string;
  prompt: string;
  images: Buffer[];
  aspect?: string;
}): Promise<Buffer> {
  const replicate = new Replicate();
  let lastErr: unknown;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const output = await replicate.run(model as `${string}/${string}`, {
        input: buildInput(model, { prompt, images, aspect }),
      });
      return await outputToBuffer(output);
    } catch (err) {
      lastErr = err;
      console.warn(`[generate] attempt ${attempt} failed:`, err instanceof Error ? err.message : err);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
