// CLI for the per-frame flipbook pipeline — see framelib.js for the logic.
//
//   node frames.js [--sketch sketch.png] [--motion "the duck diving under the water"]
//     [--frames 16] [--shotlist duck-shotlist.json]
//     [--out ../scrubber-demo/public/frames] [--model sunburst|nano-banana-2|gpt-image-2]

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { buildFlipbookFrames } from './framelib.js'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}

if (!process.env.REPLICATE_API_TOKEN) {
  console.error('Missing REPLICATE_API_TOKEN (put it in pipeline/.env)')
  process.exit(1)
}

try {
  await buildFlipbookFrames({
    sketch: fs.readFileSync(arg('sketch', 'sketch.png')),
    motion: arg('motion', 'the duck diving under the water'),
    frames: Number(arg('frames', '16')),
    shotlist: arg('shotlist') ? JSON.parse(fs.readFileSync(arg('shotlist'), 'utf8')) : null,
    outDir: path.resolve(arg('out', '../scrubber-demo/public/frames')),
    model: arg('model', 'sunburst'),
  })
} catch (err) {
  console.error(String(err.message ?? err))
  process.exit(1)
}
