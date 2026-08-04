import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// Claude hosted on Replicate — reuses the same REPLICATE_API_TOKEN as the
// image pipeline (../pipeline/.env). Swap to the Anthropic SDK directly if an
// ANTHROPIC_API_KEY becomes available; the prompt/response contract is the same.
const LLM_MODEL = 'anthropic/claude-4.5-sonnet'

function loadReplicateToken() {
  if (process.env.REPLICATE_API_TOKEN) return process.env.REPLICATE_API_TOKEN
  const envPath = path.resolve(import.meta.dirname, '../pipeline/.env')
  if (fs.existsSync(envPath)) {
    const match = fs.readFileSync(envPath, 'utf8').match(/REPLICATE_API_TOKEN=(\S+)/)
    if (match) return match[1]
  }
  return null
}

function animatePrompt(strokes, motion, N) {
  return `You are a keyframe animator for a hand-drawn flipbook.

The drawing below is frame 1 of a ${N}-frame flipbook on a 512x512 canvas
(origin top-left, x right, y down). It is represented as vector strokes —
polylines of [x,y] points, each with an id:

${JSON.stringify(strokes)}

Animation: ${motion}

Produce frames 2..${N} (${N - 1} frames). Each frame advances the motion by an
equal 1/${N} increment; the motion completes exactly at frame ${N}. Describe each
frame INDEPENDENTLY, always relative to the ORIGINAL frame-1 strokes above
(never relative to a previous frame you generated):

- "ops": for each original stroke that appears in the frame, a transform
  {"id", "translate":[dx,dy], "rotate":<degrees>, "pivot":[x,y],
  "scale":<factor>}. Rotation uses standard math convention: positive =
  counterclockwise. Omit fields that are identity. A stroke with no op and
  not removed stays exactly as in frame 1.
- "remove": ids of original strokes absent from this frame.
- "add": new strokes drawn for this frame, e.g. splashes, ripples, bubbles:
  {"id":"a1","pts":[[x,y],...]}. Keep them simple (3-10 points), in the same
  naive hand-drawn spirit. List each frame's added strokes in full.

Think about the physics: which strokes move together as the subject (give them
the same transform), which are background and stay fixed, where effects appear
and fade. Keep everything inside the canvas.

Respond with ONLY a JSON object, no prose, no code fences:
{"frames":[{"ops":[...],"remove":[...],"add":[...]}, ...]}
with exactly ${N - 1} entries in "frames".`
}

function animateEndpoint() {
  return {
    name: 'animate-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/animate', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end('POST only') }
        const token = loadReplicateToken()
        if (!token) { res.statusCode = 500; return res.end('REPLICATE_API_TOKEN not found (pipeline/.env)') }
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', async () => {
          try {
            const { strokes, motion, frames } = JSON.parse(body)
            const prediction = await fetch(
              `https://api.replicate.com/v1/models/${LLM_MODEL}/predictions`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                  Prefer: 'wait=60',
                },
                body: JSON.stringify({
                  input: {
                    prompt: animatePrompt(strokes, motion, frames),
                    max_tokens: 16000,
                  },
                }),
              },
            ).then((r) => r.json())

            if (prediction.error) throw new Error(prediction.error)
            let output = Array.isArray(prediction.output)
              ? prediction.output.join('')
              : String(prediction.output ?? '')
            // tolerate accidental fences/prose around the JSON
            const start = output.indexOf('{')
            const end = output.lastIndexOf('}')
            if (start === -1 || end === -1) throw new Error(`no JSON in LLM output: ${output.slice(0, 200)}`)
            const parsed = JSON.parse(output.slice(start, end + 1))
            if (!Array.isArray(parsed.frames)) throw new Error('LLM output missing frames array')
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(parsed))
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
  plugins: [react(), animateEndpoint()],
})
