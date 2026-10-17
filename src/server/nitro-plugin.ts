// Runs once when the Node server boots (registered in vite.config.ts), before any request.
// Warm-up goes through the app's own fetch: Nitro bundles this plugin separately from the
// app code, so importing the MusicBrainz client here would give it a second, empty cache.
import { definePlugin } from "nitro";

export default definePlugin((nitroApp) => {
  void import("./warm.server").then((m) =>
    m.startWarming(async (mbid) => {
      const res = await nitroApp.fetch(new Request(`http://localhost/artist/${mbid}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }),
  );
});
