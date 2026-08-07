import { HttpError } from "wasp/server";
import type { RecordShare, GetGallery } from "wasp/server/operations";
import type { Share } from "wasp/entities";

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{0,38})$/i;
const ACTIONS = new Set(["link", "png", "gif"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const PREF_RANGES: Record<string, { min: number; max: number }> = {
  fringe: { min: 0, max: 1 },
  breeze: { min: 0, max: 1 },
  shade: { min: 0, max: 1 },
  dapple: { min: 0.4, max: 2 },
  grain: { min: 1, max: 5 },
};

export type Prefs = {
  fringe: number;
  breeze: number;
  shade: number;
  dapple: number;
  grain: number;
};

export type ContributionDay = { date: string; count: number; level: number };

type RecordShareInput = {
  handle: string;
  action: string;
  prefs: Prefs;
  contributions: ContributionDay[];
  total: number;
  streak: number;
};

function cleanPrefs(raw: unknown): Prefs {
  if (typeof raw !== "object" || raw === null) {
    throw new HttpError(400, "prefs must be an object");
  }
  const out = {} as Record<string, number>;
  for (const [name, range] of Object.entries(PREF_RANGES)) {
    const v = (raw as Record<string, unknown>)[name];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new HttpError(400, `prefs.${name} must be a number`);
    }
    out[name] = Math.min(range.max, Math.max(range.min, v));
  }
  return out as Prefs;
}

function cleanContributions(raw: unknown): ContributionDay[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 400) {
    throw new HttpError(400, "contributions must be an array of 1–400 days");
  }
  return raw.map((d) => {
    if (
      typeof d !== "object" || d === null ||
      typeof (d as any).date !== "string" || !DATE_RE.test((d as any).date) ||
      typeof (d as any).count !== "number" || (d as any).count < 0 ||
      typeof (d as any).level !== "number" || (d as any).level < 0 || (d as any).level > 4
    ) {
      throw new HttpError(400, "each contribution must be { date, count, level }");
    }
    return {
      date: (d as any).date,
      count: Math.floor((d as any).count),
      level: Math.floor((d as any).level),
    };
  });
}

export function prefsKeyOf(prefs: Prefs): string {
  return [
    prefs.fringe.toFixed(2),
    prefs.breeze.toFixed(2),
    prefs.shade.toFixed(2),
    prefs.dapple.toFixed(2),
    String(Math.round(prefs.grain)),
  ].join("|");
}

export const recordShare: RecordShare<RecordShareInput, Share> = async (args, context) => {
  const handle = String(args.handle ?? "").trim().replace(/^@/, "").toLowerCase();
  if (!HANDLE_RE.test(handle)) throw new HttpError(400, "invalid github handle");
  if (!ACTIONS.has(args.action)) throw new HttpError(400, "invalid action");

  const prefs = cleanPrefs(args.prefs);
  const contributions = cleanContributions(args.contributions);
  const total = Math.max(0, Math.floor(Number(args.total) || 0));
  const streak = Math.max(0, Math.floor(Number(args.streak) || 0));
  const prefsKey = prefsKeyOf(prefs);

  return context.entities.Share.upsert({
    where: { handle_prefsKey: { handle, prefsKey } },
    update: { action: args.action, contributions, total, streak },
    create: { handle, action: args.action, prefsKey, prefs, contributions, total, streak },
  });
};

export const getGallery: GetGallery<void, Share[]> = async (_args, context) => {
  return context.entities.Share.findMany({
    orderBy: { updatedAt: "desc" },
    take: 60,
  });
};
