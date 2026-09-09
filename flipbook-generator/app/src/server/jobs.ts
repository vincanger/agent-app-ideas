import type { GenerateFrames } from "wasp/server/jobs";
import { bufferToDataUrl, dataUrlToBuffer, framePrompt, generateFrame } from "./generation";

type Input = { flipbookId: string };

// Generates frames 2..N for a flipbook, saving each one as it lands so the
// viewer's filmstrip fills in while the job runs.
export const generateFrames: GenerateFrames<Input, void> = async ({ flipbookId }, context) => {
  const { Flipbook, Frame } = context.entities;
  const flipbook = await Flipbook.findUnique({ where: { id: flipbookId } });
  if (!flipbook) return;

  const sketch = dataUrlToBuffer(flipbook.sketch);
  const startedAt = Date.now();
  console.log(`[generate] ${flipbookId}: ${flipbook.model}, ${flipbook.frameCount} frames`);

  try {
    let prev = sketch;
    for (let k = 2; k <= flipbook.frameCount; k++) {
      const t0 = Date.now();
      // the original sketch rides along on EVERY call as the style reference
      prev = await generateFrame({
        model: flipbook.model,
        prompt: framePrompt({ k, frames: flipbook.frameCount, motion: flipbook.motion }),
        images: [sketch, prev],
      });
      await Frame.upsert({
        where: { flipbookId_index: { flipbookId, index: k } },
        create: { flipbookId, index: k, image: bufferToDataUrl(prev) },
        update: { image: bufferToDataUrl(prev) },
      });
      console.log(`[generate] ${flipbookId}: frame ${k}/${flipbook.frameCount} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
    await Flipbook.update({ where: { id: flipbookId }, data: { status: "ready", error: null } });
    console.log(`[generate] ${flipbookId}: done in ${((Date.now() - startedAt) / 1000).toFixed(0)}s`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[generate] ${flipbookId}: failed — ${message}`);
    await Flipbook.update({ where: { id: flipbookId }, data: { status: "failed", error: message } });
  }
};
