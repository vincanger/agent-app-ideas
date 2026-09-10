# flipbook (Wasp app)

Draw a quick sketch, describe what happens ("the duck dives under the water"),
and get a hand-drawn flipbook back: gpt-image-2.5-sunburst redraws your sketch
frame by frame, and you flip through the result by scrubbing a filmstrip.

Built with [Wasp](https://wasp.sh) 0.25: username/password auth, flipbooks
saved per user in Postgres, and frame generation as a PgBoss background job.

## Run it

```bash
cp .env.server.example .env.server   # add your REPLICATE_API_TOKEN
wasp start db                        # in one terminal (Postgres in Docker)
wasp db migrate-dev                  # first time only
wasp start                           # in another terminal
```

Then open the client URL Wasp prints, sign up, draw, and hit **animate**.

### Ports

The defaults are 3000 (client) and 3001 (server). This checkout pins 3010/3011
in `vite.config.ts`, `.env.client`, and `.env.server` so it can run next to
another Wasp app; drop those overrides if you don't need them.

## How it works

- `src/client/pages/HomePage.tsx` — drawing pad (one black pencil, undo,
  clear), motion prompt, frame count, and the list of your flipbooks.
- `src/client/pages/FlipbookPage.tsx` — the viewer. The book is a 2D canvas
  (`components/FlipbookCanvas.tsx`) that draws the board, the two page piles,
  the staples and the current page; pages change without a flip animation.
  `flip/physics.ts` is the pure state machine that paces page changes from
  drags, flicks and the play clock (unit-tested in `physics.test.ts`);
  `flip/textures.ts` is the WebGL "wobble" boil pre-pass. Play/pause runs at
  an adjustable speed saved per flipbook.
- `src/server/operations.ts` — `createFlipbook` stores the sketch as frame 1
  and submits the job; queries are scoped to the logged-in user.
- `src/server/jobs.ts` — `generateFrames` calls the model once per frame
  (sketch + previous frame as references) and saves each frame as it lands,
  so the viewer's filmstrip fills in while the job runs.
- `src/server/models.ts` — Replicate model registry; switch with
  `FLIPBOOK_MODEL` (aliases: `sunburst`, `gpt-image-2`, `nano-banana-2`).

Frames are stored as PNG data URLs in the `Frame` table. That's fine for line
art at 16–24 frames per flipbook; move them to object storage before this
grows beyond a demo.

The standalone pipeline experiments this was ported from live in
`../pipeline` and `../scrubber-demo`.
