import express from "express";
import cors from "cors";
import { archetypeMatch } from "./routes/archetypeMatch.js";
import { narrate } from "./routes/narrate.js";
import { getArchetypes } from "./routes/getArchetypes.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/archetypes", getArchetypes);
app.post("/api/archetype-match", archetypeMatch);
app.post("/api/narrate", narrate);

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`server listening on :${port}`);
});
