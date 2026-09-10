import type { GenerateFrames } from "wasp/server/jobs";
import { bufferToDataUrl, dataUrlToBuffer, generateFrame, redrawPrompt } from "./generation";
import { detectGrid, pickCells, sheetPrompt, sliceSheet } from "./sheet";

type Input = { flipbookId: string };

const SHEET_RETRIES = 3;
const REDRAW_CONCURRENCY = 4;

// Two stages:
//   1. one sprite-sheet call lays out the whole animation, which is what gives
//      even pacing; its cells are saved right away as low-res drafts so the
//      whole arc is scrubbable within a minute
//   2. every cell is redrawn at full resolution in parallel (sketch = style,
//      cell = pose), replacing its draft as it lands
export const generateFrames: GenerateFrames<Input, void> = async ({ flipbookId }, context) => {
  const { Flipbook, Frame } = context.entities;
  const flipbook = await Flipbook.findUnique({ where: { id: flipbookId } });
  if (!flipbook) return;

  const { model, motion, frameCount } = flipbook;
  const sketch = dataUrlToBuffer(flipbook.sketch);
  const startedAt = Date.now();
  const log = (msg: string) => console.log(`[generate] ${flipbookId}: ${msg}`);
  log(`${model}, ${frameCount} frames`);

  try {
    // ---- stage 1: sheet ----
    let cells: Buffer[] | null = null;
    for (let attempt = 1; attempt <= SHEET_RETRIES && !cells; attempt++) {
      const t0 = Date.now();
      const sheet = await generateFrame({ model, prompt: sheetPrompt(motion), images: [sketch], aspect: "1:1" });
      const grid = await detectGrid(sheet);
      log(`sheet attempt ${attempt}: ${grid.cols}x${grid.rows}, uniform=${grid.uniform}, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      if (grid.uniform) cells = await sliceSheet(sheet, grid);
    }
    if (!cells) throw new Error(`no usable sprite sheet after ${SHEET_RETRIES} attempts`);

    // cell 1 is the sketch's own pose, which frame 1 already is
    const poses = pickCells(cells, frameCount).slice(1);
    await Promise.all(
      poses.map((cell, i) =>
        Frame.upsert({
          where: { flipbookId_index: { flipbookId, index: i + 2 } },
          create: { flipbookId, index: i + 2, image: bufferToDataUrl(cell), draft: true },
          update: { image: bufferToDataUrl(cell), draft: true },
        }),
      ),
    );
    log(`${poses.length} draft frames saved`);

    // ---- stage 2: parallel full-res redraws ----
    let next = 0;
    const worker = async () => {
      while (next < poses.length) {
        const i = next++;
        const k = i + 2;
        const t0 = Date.now();
        const frame = await generateFrame({
          model,
          prompt: redrawPrompt({ k, frames: frameCount, motion }),
          images: [sketch, poses[i]],
        });
        await Frame.update({
          where: { flipbookId_index: { flipbookId, index: k } },
          data: { image: bufferToDataUrl(frame), draft: false },
        });
        log(`frame ${k}/${frameCount} redrawn in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(REDRAW_CONCURRENCY, poses.length) }, worker));

    await Flipbook.update({ where: { id: flipbookId }, data: { status: "ready", error: null } });
    log(`done in ${((Date.now() - startedAt) / 1000).toFixed(0)}s`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[generate] ${flipbookId}: failed — ${message}`);
    await Flipbook.update({ where: { id: flipbookId }, data: { status: "failed", error: message } });
  }
};
