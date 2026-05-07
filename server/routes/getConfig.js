// Returns runtime configuration the frontend needs (e.g. the Maps Platform key).
// We deliver this via API rather than baking into the Vite bundle so the same image
// runs in dev and prod — no rebuild required to swap keys.
//
// The Maps API key is inherently public once the user loads the page; we lock it
// down via HTTP-referrer restrictions in the GCP Console (not code).
export function getConfig(_req, res) {
  res.json({
    mapsApiKey: process.env.MAPS_API_KEY || null,
  });
}
