// Read by the Nitro Vite plugin (vite.config.ts). Kept separate so the Vite config stays plain.
import { defineConfig } from "nitro";

export default defineConfig({
  // @vscode/sqlite3 (behind @keyvhq/sqlite) loads a compiled .node addon, which can't be
  // bundled. Keep it external and copy it, with its binary, into .output/server/node_modules.
  traceDeps: ["@vscode/sqlite3"],
});
