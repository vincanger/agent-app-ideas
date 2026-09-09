// Image-model registry (ported from ../../pipeline/models.js).
//
// Every model takes (prompt, reference images, aspect ratio) but names the
// inputs differently, so each entry maps our generic call onto the model's
// Replicate input schema.

export const DEFAULT_MODEL = "openai/gpt-image-2.5-sunburst";

export type GenerationCall = {
  prompt: string;
  images: Buffer[];
  aspect: string;
  quality?: "low" | "medium" | "high";
};

type ModelDef = {
  aliases: string[];
  input: (call: GenerationCall) => Record<string, unknown>;
};

const gptImageInput = ({ prompt, images, aspect, quality = "high" }: GenerationCall) => ({
  prompt,
  input_images: images,
  aspect_ratio: aspect,
  output_format: "png",
  quality,
});

const MODELS: Record<string, ModelDef> = {
  "openai/gpt-image-2.5-sunburst": {
    aliases: ["gpt-image-2.5-sunburst", "gpt-image-2.5", "sunburst"],
    input: gptImageInput,
  },
  "openai/gpt-image-2": {
    aliases: ["gpt-image-2"],
    input: gptImageInput,
  },
  "google/nano-banana-2": {
    aliases: ["nano-banana-2", "nb2", "nano-banana"],
    input: ({ prompt, images, aspect }) => ({
      prompt,
      image_input: images,
      aspect_ratio: aspect,
      output_format: "png",
    }),
  },
};

// Resolves an alias or full slug to the canonical model slug.
export function resolveModel(name?: string | null): string {
  const wanted = name || process.env.FLIPBOOK_MODEL || DEFAULT_MODEL;
  for (const [slug, def] of Object.entries(MODELS)) {
    if (slug === wanted || def.aliases.includes(wanted)) return slug;
  }
  throw new Error(`Unknown model "${wanted}". Known models: ${Object.keys(MODELS).join(", ")}`);
}

// Builds the Replicate input object for a model from our generic call shape.
export function buildInput(model: string, call: GenerationCall): Record<string, unknown> {
  return MODELS[model].input(call);
}
