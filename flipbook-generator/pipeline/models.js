// Image-model registry for the flipbook pipelines.
//
// Every model takes (prompt, reference images, aspect ratio) but names the
// inputs differently, so each entry maps our generic call onto the model's
// Replicate input schema. Select with --model <alias|full slug> or the
// FLIPBOOK_MODEL env var; the default is nano-banana-2.

export const DEFAULT_MODEL = 'google/nano-banana-2'

const MODELS = {
  'google/nano-banana-2': {
    aliases: ['nano-banana-2', 'nb2', 'nano-banana'],
    input: ({ prompt, images, aspect }) => ({
      prompt, image_input: images, aspect_ratio: aspect, output_format: 'png',
    }),
  },
  'openai/gpt-image-2.5-sunburst': {
    aliases: ['gpt-image-2.5-sunburst', 'gpt-image-2.5', 'sunburst'],
    input: ({ prompt, images, aspect, quality = 'high' }) => ({
      prompt, input_images: images, aspect_ratio: aspect, output_format: 'png', quality,
    }),
  },
  'openai/gpt-image-2': {
    aliases: ['gpt-image-2'],
    input: ({ prompt, images, aspect, quality = 'high' }) => ({
      prompt, input_images: images, aspect_ratio: aspect, output_format: 'png', quality,
    }),
  },
}

// Resolves an alias or full slug to the canonical model slug.
export function resolveModel(name) {
  const wanted = name || process.env.FLIPBOOK_MODEL || DEFAULT_MODEL
  for (const [slug, def] of Object.entries(MODELS)) {
    if (slug === wanted || def.aliases.includes(wanted)) return slug
  }
  const known = Object.keys(MODELS).join(', ')
  throw new Error(`Unknown model "${wanted}". Known models: ${known}`)
}

// Builds the Replicate input object for a model from our generic call shape.
export function buildInput(model, call) {
  return MODELS[model].input(call)
}
