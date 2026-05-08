async function postJSON(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

export async function fetchConfig() {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error(`/api/config ${res.status}`);
  return res.json();
}

export async function fetchHubs() {
  const res = await fetch("/api/hubs");
  if (!res.ok) throw new Error(`/api/hubs ${res.status}`);
  return res.json();
}

export async function fetchSportCatalog() {
  const res = await fetch("/api/sport-catalog");
  if (!res.ok) throw new Error(`/api/sport-catalog ${res.status}`);
  return res.json();
}

export function postGeoQuery({ question, history }) {
  return postJSON("/api/geo-query", { question, history });
}

export function postVoiceQuery({ audioBase64, mimeType, history }) {
  return postJSON("/api/voice-query", { audioBase64, mimeType, history });
}

export function postNarrate({ state, sport }) {
  return postJSON("/api/narrate", { state, sport });
}
