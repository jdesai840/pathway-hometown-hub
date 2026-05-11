// Attach ground elevation (meters above WGS84) to each tour stop's viewpoint
// so the photoreal cinematic camera anchors at terrain height instead of
// sea level. High-elevation cities (Denver 1610m, Las Vegas 619m, Park City
// 2100m, El Paso 1140m) would otherwise drop the camera underneath the
// visible terrain — and would float labelled pins BELOW the surface tiles,
// causing them to drift relative to the GPS point as the camera orbits.
//
// Open-Meteo is free, keyless, and server-friendly. Google's Maps Elevation
// API key is HTTP-referrer-restricted and can't be called from a server.
//
// Graceful fallback — on API failure or shape mismatch, stops are returned
// untouched and the cinematic falls back to elevation=0 (correct for
// coastal cities, broken for elevated ones).
export async function attachElevations(stops) {
  if (!Array.isArray(stops) || stops.length === 0) return;
  try {
    const lats = stops
      .map((s) =>
        typeof s.viewpoint?.lat === "number" ? s.viewpoint.lat : s.lat
      )
      .join(",");
    const lngs = stops
      .map((s) =>
        typeof s.viewpoint?.lng === "number" ? s.viewpoint.lng : s.lng
      )
      .join(",");
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;
    const r = await fetch(url);
    const data = await r.json();
    if (
      !Array.isArray(data?.elevation) ||
      data.elevation.length !== stops.length
    ) {
      console.warn("attachElevations: unexpected response", data);
      return;
    }
    stops.forEach((s, i) => {
      const elev = data.elevation[i];
      if (typeof elev === "number") {
        if (!s.viewpoint) s.viewpoint = { lat: s.lat, lng: s.lng };
        s.viewpoint.elevation = elev;
      }
    });
    console.log(
      "attachElevations:",
      stops
        .map((s) =>
          typeof s.viewpoint?.elevation === "number"
            ? `${Math.round(s.viewpoint.elevation)}m`
            : "?"
        )
        .join(", ")
    );
  } catch (err) {
    console.warn("attachElevations failed", err?.message);
  }
}
