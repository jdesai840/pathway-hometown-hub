// Streaming client for /api/geo-query?stream=1.
// Yields server-sent events parsed from `data: {...}\n\n` framing.
// Each event shape: {type: "started"|"tool_use"|"tool_done"|"token"|"done"|"error", ...payload}
export async function* streamGeoQuery({ question, history, signal }) {
  const res = await fetch("/api/geo-query?stream=1", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ question, history }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`stream failed: ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = frame.trim();
      if (!line || line.startsWith(":")) continue; // heartbeats / comments
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      try {
        yield JSON.parse(json);
      } catch {
        // swallow malformed frames
      }
    }
  }
}
