import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// /api/animate runs the sprite-sheet pipeline (../pipeline/sheetlib.js):
// drawn sketch -> keyframe sheet -> in-between sheet -> sliced frames in
// public/frames. Uses the same REPLICATE_API_TOKEN as the CLI (pipeline/.env).

function loadReplicateToken() {
  if (process.env.REPLICATE_API_TOKEN) return process.env.REPLICATE_API_TOKEN
  const envPath = path.resolve(import.meta.dirname, '../pipeline/.env')
  if (fs.existsSync(envPath)) {
    const match = fs.readFileSync(envPath, 'utf8').match(/REPLICATE_API_TOKEN=(\S+)/)
    if (match) return match[1]
  }
  return null
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

// Frame-editor endpoints: reorder pages / overwrite a single frame PNG.
// The manifest's frames array is the page order — files never move on disk.
function framesEndpoint() {
  const framesDir = path.resolve(import.meta.dirname, 'public/frames')
  const manifestPath = path.join(framesDir, 'manifest.json')
  const readManifest = () => JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const writeManifest = (m) => { fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2)); return m }
  const FRAME_URL = /^\/frames\/frame-\d+\.png(\?v=\d+)?$/
  const FRAME_FILE = /^frame-\d+\.png$/

  return {
    name: 'frames-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/frames/order', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end('POST only') }
        try {
          const { frames } = JSON.parse(await readBody(req))
          if (!Array.isArray(frames) || !frames.length || !frames.every((f) => FRAME_URL.test(f))) {
            throw new Error('frames must be a non-empty array of /frames/frame-NN.png urls')
          }
          const manifest = writeManifest({
            ...readManifest(),
            frames,
            total: frames.length,
            generatedAt: new Date().toISOString(),
          })
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(manifest))
        } catch (err) {
          res.statusCode = 500
          res.end(String(err.message ?? err))
        }
      })

      server.middlewares.use('/api/frames/save', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end('POST only') }
        try {
          const { file, image } = JSON.parse(await readBody(req))
          if (!FRAME_FILE.test(file ?? '')) throw new Error('bad frame filename')
          const b64 = image?.match(/^data:image\/png;base64,(.+)$/)?.[1]
          if (!b64) throw new Error('image must be a PNG data URL')
          fs.writeFileSync(path.join(framesDir, file), Buffer.from(b64, 'base64'))
          // bump the edited file's cache-busting version everywhere it appears
          const prev = readManifest()
          const v = Date.now()
          const manifest = writeManifest({
            ...prev,
            frames: prev.frames.map((u) =>
              u.split('?')[0] === `/frames/${file}` ? `/frames/${file}?v=${v}` : u),
            generatedAt: new Date().toISOString(),
          })
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(manifest))
        } catch (err) {
          res.statusCode = 500
          res.end(String(err.message ?? err))
        }
      })
    },
  }
}

function animateEndpoint() {
  return {
    name: 'animate-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/animate', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end('POST only') }
        const token = loadReplicateToken()
        if (!token) { res.statusCode = 500; return res.end('REPLICATE_API_TOKEN not found (pipeline/.env)') }
        process.env.REPLICATE_API_TOKEN = token
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', async () => {
          try {
            const { image, motion } = JSON.parse(body)
            const b64 = image?.match(/^data:image\/png;base64,(.+)$/)?.[1]
            if (!b64) throw new Error('image must be a PNG data URL')
            if (!motion?.trim()) throw new Error('motion is required')

            const { buildFlipbook } = await import('../pipeline/sheetlib.js')
            const manifest = await buildFlipbook({
              sketch: Buffer.from(b64, 'base64'),
              motion: motion.trim(),
              outDir: path.resolve(import.meta.dirname, 'public/frames'),
              sheetsDir: path.resolve(import.meta.dirname, '../pipeline/sheets'),
              log: (msg) => console.log('[animate]', msg),
            })
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(manifest))
          } catch (err) {
            console.error('[animate]', err)
            res.statusCode = 500
            res.end(String(err.message ?? err))
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), animateEndpoint(), framesEndpoint()],
})
