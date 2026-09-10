// Sprite-sheet stage (ported from ../../pipeline/sheetlib.js, sharp instead
// of ffmpeg). One model call lays out the whole animation as a grid, which is
// what gives the flipbook even pacing: the model sees the entire arc at once
// instead of guessing how much action is left frame by frame.

import sharp from "sharp";

export const COLS = 4;
export const ROWS = 4;
export const CELLS = COLS * ROWS;
const INSET = 5; // px trimmed from each cell edge to drop the grid lines

const GRID_NOTE = `Layout: a ${COLS}x${ROWS} grid of ${CELLS} equal square cells, ${COLS} columns by ${ROWS} rows, read left-to-right then top-to-bottom, separated by thin grid lines. Every cell shows the whole scene at the same framing as the original drawing: same waterline/ground height, same subject size.`;

const STYLE_NOTE = `Style: match the original drawing's line quality exactly (same stroke weight, same simple black lines on white, same character design and proportions). Keep it as loose and simple as the original; do not add shading, texture, or scenery.`;

export function sheetPrompt(motion: string): string {
  return `Draw a sprite sheet of ${CELLS} sequential animation frames of the attached drawing. The animation: ${motion}.
Cell 1 is the original drawing's pose, exactly as drawn. The motion then advances by an equal, clearly visible step in every cell and completes exactly in cell ${CELLS} — spread the whole action evenly across all ${CELLS} cells, do not finish early and do not stall.
Each cell must be a clearly different pose from its neighbours — this is a flipbook, so the motion has to visibly progress from cell to cell. Include the splashes, ripples, bubbles and other effects the action calls for, drawn in the same simple line style.
${STYLE_NOTE}
${GRID_NOTE}`;
}

export type Grid = { cols: number; rows: number; uniform: boolean };

// The model doesn't always honor the requested grid, so measure what it
// actually drew: divider lines are near-continuous dark rows/columns, so score
// each candidate grid by how dark the sheet is along its internal dividers.
export async function detectGrid(sheet: Buffer): Promise<Grid> {
  const { data, info } = await sharp(sheet).greyscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const colDark = new Float64Array(W);
  const rowDark = new Float64Array(H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[y * W + x] < 100) {
        colDark[x]++;
        rowDark[y]++;
      }
    }
  }
  for (let x = 0; x < W; x++) colDark[x] /= H;
  for (let y = 0; y < H; y++) rowDark[y] /= W;

  const lineScore = (fracs: Float64Array, size: number, count: number) => {
    let sum = 0;
    for (let i = 1; i < count; i++) {
      const at = Math.round((i / count) * size);
      let best = 0;
      for (let d = -3; d <= 3; d++) best = Math.max(best, fracs[at + d] ?? 0);
      sum += best;
    }
    return sum / (count - 1);
  };
  let best = { cols: COLS, rows: ROWS, score: 0 };
  for (const [cols, rows] of [[4, 4], [4, 3], [3, 4], [3, 3], [4, 6], [6, 4]]) {
    const score = (lineScore(colDark, W, cols) + lineScore(rowDark, H, rows)) / 2;
    if (score > best.score) best = { cols, rows, score };
  }

  // Ragged sheets (a row with 3 cells instead of 4) can't be sliced on a
  // uniform grid: verify every row band has a divider at each column position.
  const { cols, rows } = best;
  let uniform = true;
  for (let r = 0; r < rows && uniform; r++) {
    const y0 = Math.round((r / rows) * H);
    const y1 = Math.round(((r + 1) / rows) * H);
    for (let c = 1; c < cols; c++) {
      const at = Math.round((c / cols) * W);
      let darkest = 0;
      for (let d = -3; d <= 3; d++) {
        const x = at + d;
        if (x < 0 || x >= W) continue;
        let dark = 0;
        for (let y = y0; y < y1; y++) if (data[y * W + x] < 100) dark++;
        darkest = Math.max(darkest, dark / (y1 - y0));
      }
      if (darkest < 0.5) {
        uniform = false;
        break;
      }
    }
  }
  return { cols, rows, uniform };
}

// Slices the sheet into PNG cells in reading order, trimming the grid lines.
export async function sliceSheet(sheet: Buffer, { cols, rows }: Grid): Promise<Buffer[]> {
  const meta = await sharp(sheet).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  const cellW = Math.floor(W / cols);
  const cellH = Math.floor(H / rows);
  const cells: Buffer[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push(
        await sharp(sheet)
          .extract({
            left: col * cellW + INSET,
            top: row * cellH + INSET,
            width: cellW - 2 * INSET,
            height: cellH - 2 * INSET,
          })
          .png()
          .toBuffer(),
      );
    }
  }
  return cells;
}

// Picks `count` cells evenly across the sheet (always the first and last), so
// an 8-frame flipbook still spans the whole action.
export function pickCells<T>(cells: T[], count: number): T[] {
  if (count >= cells.length) return cells;
  return Array.from({ length: count }, (_, i) => cells[Math.round((i / (count - 1)) * (cells.length - 1))]);
}
