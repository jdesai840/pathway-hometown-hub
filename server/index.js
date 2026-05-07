import express from "express";
import cors from "cors";
import { geoQuery } from "./routes/geoQuery.js";
import { voiceQuery } from "./routes/voiceQuery.js";
import { narrate } from "./routes/narrate.js";
import { getHubs } from "./routes/getHubs.js";
import { getSportCatalog } from "./routes/getSportCatalog.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" })); // generous for inline audio uploads

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/hubs", getHubs);
app.get("/api/sport-catalog", getSportCatalog);
app.post("/api/geo-query", geoQuery);
app.post("/api/voice-query", voiceQuery);
app.post("/api/narrate", narrate);

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`server listening on :${port}`);
});
