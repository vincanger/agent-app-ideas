import { defineConfig } from "vite";
import { wasp } from "wasp/client/vite";

export default defineConfig({
  plugins: [wasp()],
  server: {
    // 3010 so this app can run next to another Wasp app on 3000/3001;
    // keep in sync with WASP_WEB_CLIENT_URL in .env.server
    port: 3010,
    strictPort: true,
    open: false,
  },
});
