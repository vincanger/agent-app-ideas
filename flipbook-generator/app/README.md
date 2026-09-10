# flipbook app 

Draw a quick sketch, describe what happens ("the duck dives under the water"),
and get a hand-drawn flipbook back: gpt-image-2.5-sunburst redraws your sketch
frame by frame, and you flip through the result by scrubbing a filmstrip.

Built with [Wasp](https://wasp.sh) 0.25: username/password auth, flipbooks
saved per user in Postgres, and frame generation as a PgBoss background job.

## Run it

```bash
cp .env.server.example .env.server   # add a REPLICATE_API_TOKEN or an OPENAI_API_KEY
wasp start db                        # in one terminal (Postgres in Docker)
wasp db migrate-dev                  # first time only
wasp start                           # in another terminal
```

Then open the client URL Wasp prints, sign up, draw, and hit **animate**.

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
- `src/server/jobs.ts` — `generateFrames` runs in two stages: one sprite-sheet
  call lays out the whole motion as a grid (`sheet.ts` slices it with sharp),
  then each cell is redrawn at full resolution in parallel with the sketch as
  the style reference. Draft cells and finished frames are saved as they land,
  so the viewer's filmstrip fills in while the job runs.
- `src/server/models.ts` — model registry and provider choice. Generation can
  go through Replicate (`REPLICATE_API_TOKEN`) or directly through the OpenAI
  SDK (`OPENAI_API_KEY`); with both keys set, `FLIPBOOK_PROVIDER=openai` picks
  OpenAI. Switch models with `FLIPBOOK_MODEL` (aliases: `sunburst`, `flare`,
  `gpt-image-2`, `nano-banana-2`; the last is Replicate-only).

## Known limitations

- Currently sing Sunburst and high quality images is expensive.
- Frames are stored as PNG data URLs in the `Frame` table (about 1 MB each).
  Fine for a demo; move them to object storage before running this for real.
- Each flipbook costs one sprite-sheet call plus one model call per frame, so
  generation takes a minute or two and is billed to your Replicate or OpenAI key.
- Flipbooks are private to the user who made them; there is no public library yet.
