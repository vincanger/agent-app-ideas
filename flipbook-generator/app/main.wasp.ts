import { action, app, job, page, query, route } from "@wasp.sh/spec";
import { LoginPage, SignupPage } from "./src/client/pages/AuthPages" with { type: "ref" };
import { HomePage } from "./src/client/pages/HomePage" with { type: "ref" };
import { FlipbookPage } from "./src/client/pages/FlipbookPage" with { type: "ref" };
import {
  createFlipbook,
  deleteFlipbook,
  getFlipbook,
  getFlipbooks,
  updateFlipbook,
} from "./src/server/operations" with { type: "ref" };
import { generateFrames } from "./src/server/jobs" with { type: "ref" };

export default app({
  name: "flipbook",
  wasp: { version: "^0.25.0" },
  title: "flipbook",
  head: ["<link rel='icon' href='/favicon.svg' />"],
  auth: {
    userEntity: "User",
    methods: {
      usernameAndPassword: {},
    },
    onAuthFailedRedirectTo: "/login",
  },
  spec: [
    route("HomeRoute", "/", page(HomePage, { authRequired: true })),
    route("FlipbookRoute", "/flipbook/:id", page(FlipbookPage, { authRequired: true })),
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),

    query(getFlipbooks, { entities: ["Flipbook"] }),
    query(getFlipbook, { entities: ["Flipbook"] }),
    action(createFlipbook, { entities: ["Flipbook", "Frame"] }),
    action(updateFlipbook, { entities: ["Flipbook"] }),
    action(deleteFlipbook, { entities: ["Flipbook"] }),

    // Frame generation runs as a background job: 15 sequential model calls
    // take ~10 minutes, far beyond what an HTTP action should hold open.
    job(generateFrames, {
      executor: "PgBoss",
      entities: ["Flipbook", "Frame"],
    }),
  ],
});
