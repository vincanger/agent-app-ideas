// CLI for the sprite-sheet flipbook pipeline — see sheetlib.js for the logic.
//
//   node sheets.js [--sketch sketch.png] [--motion "the duck diving under the water"]
//     [--out ../scrubber-demo/public/frames]

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { buildFlipbook } from './sheetlib.js'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}

if (!process.env.REPLICATE_API_TOKEN) {
  console.error('Missing REPLICATE_API_TOKEN (put it in pipeline/.env)')
  process.exit(1)
}

try {
  await buildFlipbook({
    sketch: fs.readFileSync(arg('sketch', 'sketch.png')),
    motion: arg('motion', 'the duck diving under the water'),
    outDir: path.resolve(arg('out', '../scrubber-demo/public/frames')),
    sheetsDir: path.resolve('sheets'),
  })
} catch (err) {
  console.error(String(err.message ?? err))
  process.exit(1)
}
