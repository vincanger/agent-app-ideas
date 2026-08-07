import { app, page, route, query, action } from "@wasp.sh/spec";
import { MainPage } from "./src/MainPage" with { type: "ref" };
import { GalleryPage } from "./src/GalleryPage" with { type: "ref" };
import { recordShare, getGallery } from "./src/shares" with { type: "ref" };

export default app({
  name: "komorebiCommits",
  wasp: { version: "^0.25.0" },
  title: "komorebi commits — your GitHub year as dappled light",
  head: [
    "<link rel='icon' href='/favicon.ico' />",
    "<meta name='description' content='Your GitHub contribution graph rendered as flat, dithered dappled light. Each day you committed is a gap in the canopy.' />",
  ],
  spec: [
    route("RootRoute", "/", page(MainPage)),
    route("GalleryRoute", "/gallery", page(GalleryPage)),
    action(recordShare, { entities: ["Share"] }),
    query(getGallery, { entities: ["Share"] }),
  ],
});
