import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { geoQuery } from "./routes/geoQuery.js";
import { narrate } from "./routes/narrate.js";
import { getHubs } from "./routes/getHubs.js";
import { getCityHubs } from "./routes/getCityHubs.js";
import { getSportCatalog } from "./routes/getSportCatalog.js";
import { getConfig } from "./routes/getConfig.js";
import { tour } from "./routes/tour.js";
import { tts } from "./routes/tts.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" })); // generous for inline audio uploads

// API routes
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/api/config", getConfig);
app.get("/api/hubs", getHubs);
app.get("/api/city-hubs", getCityHubs);
app.get("/api/sport-catalog", getSportCatalog);
app.post("/api/geo-query", geoQuery);
app.post("/api/narrate", narrate);
app.post("/api/tour", tour);
app.post("/api/tts", tts);

// Static serving — production. The multi-stage Dockerfile copies the built
// frontend into /app/server/public. Dev uses Vite on :5173 with proxy to :8080,
// so this code path is inert locally (the public dir doesn't exist).
const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(HERE, "public");
if (existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));
  // SPA fallback — anything not matched above and not under /api gets index.html.
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(join(PUBLIC_DIR, "index.html"));
  });
  console.log(`serving static frontend from ${PUBLIC_DIR}`);
} else {
  console.log(`no static frontend (PUBLIC_DIR=${PUBLIC_DIR} missing) — API only`);
}

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`server listening on :${port}`);
});
