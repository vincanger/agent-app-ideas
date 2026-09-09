import { HttpError } from "wasp/server";
import { generateFrames } from "wasp/server/jobs";
import type { Flipbook, Frame } from "wasp/entities";
import type {
  CreateFlipbook,
  DeleteFlipbook,
  GetFlipbook,
  GetFlipbooks,
  UpdateFlipbook,
} from "wasp/server/operations";
import { resolveModel } from "./models";

const MIN_FRAMES = 4;
const MAX_FRAMES = 24;
const MIN_FPS = 2;
const MAX_FPS = 24;

// ---------- queries ----------

export type FlipbookSummary = Flipbook & { framesDone: number };

// The user's flipbooks, newest first; the sketch doubles as the thumbnail.
export const getFlipbooks: GetFlipbooks<void, FlipbookSummary[]> = async (_args, context) => {
  if (!context.user) throw new HttpError(401);
  const flipbooks = await context.entities.Flipbook.findMany({
    where: { userId: context.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { frames: true } } },
  });
  return flipbooks.map(({ _count, ...f }) => ({ ...f, framesDone: _count.frames }));
};

export type FlipbookWithFrames = Flipbook & { frames: Frame[] };

export const getFlipbook: GetFlipbook<{ id: string }, FlipbookWithFrames> = async ({ id }, context) => {
  if (!context.user) throw new HttpError(401);
  const flipbook = await context.entities.Flipbook.findUnique({
    where: { id },
    include: { frames: { orderBy: { index: "asc" } } },
  });
  if (!flipbook || flipbook.userId !== context.user.id) throw new HttpError(404, "Flipbook not found");
  return flipbook;
};

// ---------- actions ----------

type CreateArgs = { sketch: string; motion: string; frameCount?: number; model?: string };

// Saves the sketch as frame 1 and kicks off background generation of the rest.
export const createFlipbook: CreateFlipbook<CreateArgs, Flipbook> = async (args, context) => {
  if (!context.user) throw new HttpError(401);
  const motion = args.motion?.trim();
  if (!motion) throw new HttpError(400, "Describe what happens in the animation");
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(args.sketch ?? "")) {
    throw new HttpError(400, "sketch must be a PNG data URL");
  }
  const frameCount = Math.min(MAX_FRAMES, Math.max(MIN_FRAMES, Math.round(args.frameCount ?? 16)));
  let model: string;
  try {
    model = resolveModel(args.model);
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : "unknown model");
  }

  const flipbook = await context.entities.Flipbook.create({
    data: {
      userId: context.user.id,
      motion,
      model,
      frameCount,
      sketch: args.sketch,
      frames: { create: [{ index: 1, image: args.sketch }] },
    },
  });
  await generateFrames.submit({ flipbookId: flipbook.id });
  return flipbook;
};

type UpdateArgs = { id: string; fps?: number };

export const updateFlipbook: UpdateFlipbook<UpdateArgs, Flipbook> = async ({ id, fps }, context) => {
  if (!context.user) throw new HttpError(401);
  const existing = await context.entities.Flipbook.findUnique({ where: { id } });
  if (!existing || existing.userId !== context.user.id) throw new HttpError(404, "Flipbook not found");
  const data: { fps?: number } = {};
  if (fps !== undefined) data.fps = Math.min(MAX_FPS, Math.max(MIN_FPS, Math.round(fps)));
  return context.entities.Flipbook.update({ where: { id }, data });
};

export const deleteFlipbook: DeleteFlipbook<{ id: string }, void> = async ({ id }, context) => {
  if (!context.user) throw new HttpError(401);
  const existing = await context.entities.Flipbook.findUnique({ where: { id } });
  if (!existing || existing.userId !== context.user.id) throw new HttpError(404, "Flipbook not found");
  await context.entities.Flipbook.delete({ where: { id } }); // frames cascade
};
