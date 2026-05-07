async function postJSON(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

export async function fetchArchetypes() {
  const res = await fetch("/api/archetypes");
  if (!res.ok) throw new Error(`/api/archetypes ${res.status}`);
  return res.json();
}

export function postArchetypeMatch({ biometrics, transcript }) {
  return postJSON("/api/archetype-match", { biometrics, transcript });
}

export function postNarrate({ archetypeId, sketchPngBase64 }) {
  return postJSON("/api/narrate", { archetypeId, sketchPngBase64 });
}
