// Image-model registry and provider selection.
//
// The same models are reachable two ways: through Replicate (one token for
// many models) or directly through the OpenAI SDK (OpenAI's own models only).
// Every model takes (prompt, reference images, aspect ratio) but each provider
// names the inputs differently, so an entry carries the id for each provider
// it is available on, and generation.ts maps our generic call onto that API.

export const DEFAULT_MODEL = "openai/gpt-image-2.5-sunburst";

export type Provider = "replicate" | "openai";
export const PROVIDERS: Provider[] = ["replicate", "openai"];

export type GenerationCall = {
  prompt: string;
  images: Buffer[];
  aspect: string;
  quality?: "low" | "medium" | "high";
};

type ModelDef = {
  aliases: string[];
  // model id on the OpenAI Images API, if OpenAI serves it
  openai?: string;
  // input shape for `replicate.run(slug, { input })`, if Replicate serves it
  replicate?: (call: GenerationCall) => Record<string, unknown>;
};

const gptImageReplicateInput = ({ prompt, images, aspect, quality = "high" }: GenerationCall) => ({
  prompt,
  input_images: images,
  aspect_ratio: aspect,
  output_format: "png",
  quality,
});

// Keyed by the Replicate-style slug; that is what the Flipbook.model column stores.
const MODELS: Record<string, ModelDef> = {
  "openai/gpt-image-2.5-sunburst": {
    aliases: ["gpt-image-2.5-sunburst", "gpt-image-2.5", "sunburst"],
    openai: "gpt-image-2.5-sunburst",
    replicate: gptImageReplicateInput,
  },
  "openai/gpt-image-2.5-flare": {
    aliases: ["gpt-image-2.5-flare", "flare"],
    openai: "gpt-image-2.5-flare",
    replicate: gptImageReplicateInput,
  },
  "openai/gpt-image-2": {
    aliases: ["gpt-image-2"],
    openai: "gpt-image-2",
    replicate: gptImageReplicateInput,
  },
  "google/nano-banana-2": {
    aliases: ["nano-banana-2", "nb2", "nano-banana"],
    replicate: ({ prompt, images, aspect }) => ({
      prompt,
      image_input: images,
      aspect_ratio: aspect,
      output_format: "png",
    }),
  },
};

// Which API to call. FLIPBOOK_PROVIDER wins; otherwise whichever key is set,
// Replicate first because it serves every model in the registry.
export function resolveProvider(): Provider {
  const wanted = process.env.FLIPBOOK_PROVIDER?.trim().toLowerCase();
  if (wanted) {
    if (!PROVIDERS.includes(wanted as Provider)) {
      throw new Error(`Unknown FLIPBOOK_PROVIDER "${wanted}". Use one of: ${PROVIDERS.join(", ")}`);
    }
    return wanted as Provider;
  }
  if (process.env.REPLICATE_API_TOKEN) return "replicate";
  if (process.env.OPENAI_API_KEY) return "openai";
  throw new Error("Set REPLICATE_API_TOKEN or OPENAI_API_KEY in .env.server");
}

// Resolves an alias or full slug to the canonical model slug, and checks the
// active provider can actually serve it.
export function resolveModel(name?: string | null, provider: Provider = resolveProvider()): string {
  const wanted = name || process.env.FLIPBOOK_MODEL || DEFAULT_MODEL;
  const known = Object.entries(MODELS).find(([slug, def]) => slug === wanted || def.aliases.includes(wanted));
  if (!known) throw new Error(`Unknown model "${wanted}". Known models: ${Object.keys(MODELS).join(", ")}`);
  const [slug, def] = known;
  if (!def[provider]) {
    const served = Object.entries(MODELS).filter(([, d]) => d[provider]).map(([s]) => s);
    throw new Error(`${slug} is not available through ${provider}. Models on ${provider}: ${served.join(", ")}`);
  }
  return slug;
}

// Builds the Replicate input object for a model from our generic call shape.
export function buildReplicateInput(model: string, call: GenerationCall): Record<string, unknown> {
  const build = MODELS[model]?.replicate;
  if (!build) throw new Error(`${model} is not available through replicate`);
  return build(call);
}

// The model id to send to the OpenAI Images API.
export function openaiModelId(model: string): string {
  const id = MODELS[model]?.openai;
  if (!id) throw new Error(`${model} is not available through openai`);
  return id;
}
