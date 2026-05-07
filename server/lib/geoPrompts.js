export function geoSystemPrompt(hubsDoc) {
  const totals = hubsDoc.totals;
  const range = hubsDoc.reference?.allTimeRange || [];
  return [
    "You are the Hometown Hubs agent for Team USA, helping fans explore where",
    "Team USA Olympic and Paralympic athletes come from across the United States.",
    "",
    "DATA YOU HAVE ACCESS TO (via tools):",
    `- ${totals.athleteCount} athletes (Olympic: ${totals.byCategory.Olympic.athleteCount}, Paralympic: ${totals.byCategory.Paralympic.athleteCount})`,
    `- All historical Games covered: ${range[0]} – ${range[1]}`,
    "- Aggregated to (state, sport, Olympic|Paralympic) hubs with recency weighting toward LA28 prep horizon.",
    "",
    "HARD RULES:",
    "1. Olympic and Paralympic data get equal analytical depth, equal narrative weight.",
    "2. Use sport names exactly as returned by the tools.",
    "3. Conditional language only ('could', 'may', 'potentially'). Never guarantee outcomes.",
    "4. Never reference individual athletes.",
    '5. Never use "former" or "past" Olympian/Paralympian.',
    "6. No timing data references.",
    "",
    "WORKFLOW:",
    "- Inspect the user's question. Choose ONE OR MORE tools to gather data.",
    "- After tools return, return STRICT JSON: {",
    "    intent: short string describing what you did,",
    "    highlights: array of 2-letter state codes to emphasize on the map (max 8),",
    "    narration: 2-4 sentences in second person, parity-respecting, conditional,",
    "    facts: array of short bullet strings the UI can render as supporting points",
    "  }",
    "- If the user's question doesn't match the dataset (e.g. medal predictions, individual",
    "  athletes), respond with intent='out_of_scope' and explain politely in narration.",
  ].join("\n");
}

export const geoTools = [
  {
    functionDeclarations: [
      {
        name: "filter_by_sport",
        description:
          "Return the top hubs (states) for a given sport, ranked by recency weight or all-time count.",
        parameters: {
          type: "object",
          properties: {
            sport: { type: "string", description: "Sport name (case-insensitive, partial match ok). Examples: 'curling', 'wheelchair basketball', 'track and field'." },
            category: { type: "string", enum: ["Olympic", "Paralympic"], description: "Optional. Filter to one category." },
            season: { type: "string", enum: ["Summer", "Winter"] },
            mode: { type: "string", enum: ["recency", "all_time"], description: "Default 'recency' (LA28 momentum). 'all_time' uses raw athlete counts." },
            limit: { type: "integer", description: "Max hubs to return (default 12)." },
          },
          required: ["sport"],
        },
      },
      {
        name: "filter_by_state",
        description: "Return all hubs (sports) located in a given state, ranked by activity.",
        parameters: {
          type: "object",
          properties: {
            state: { type: "string", description: "Two-letter state code (CA, MN, FL, etc.) or full name." },
            mode: { type: "string", enum: ["recency", "all_time"] },
            limit: { type: "integer" },
          },
          required: ["state"],
        },
      },
      {
        name: "top_hubs",
        description: "Top hubs across all sports/states by activity. Use when the user asks about the strongest hubs broadly.",
        parameters: {
          type: "object",
          properties: {
            category: { type: "string", enum: ["Olympic", "Paralympic"] },
            mode: { type: "string", enum: ["recency", "all_time"] },
            limit: { type: "integer" },
          },
        },
      },
      {
        name: "compare_states",
        description: "Compare two states side-by-side, including their top sports and total athlete counts.",
        parameters: {
          type: "object",
          properties: {
            stateA: { type: "string" },
            stateB: { type: "string" },
          },
          required: ["stateA", "stateB"],
        },
      },
      {
        name: "surface_underexposed_hub",
        description:
          "Surface a small-state hub that punches above its weight (high recency weight relative to state total). Useful when the user says 'show me a surprising hub' or 'where would I least expect Team USA momentum?'",
        parameters: {
          type: "object",
          properties: {
            excludeStates: { type: "array", items: { type: "string" }, description: "States already shown that should not be returned." },
          },
        },
      },
    ],
  },
];

export function narrateHubSystemPrompt() {
  return [
    "You write fan-facing narrations for Team USA hometown hubs.",
    "- Second person, warm, inspiring, conditional language.",
    "- Mention Olympic and Paralympic context with equal weight when both are relevant.",
    "- Never name a specific athlete; speak at hub/aggregate level only.",
    "- Use sport names, never NGB names. Never use 'former' or 'past' Olympian/Paralympian.",
    "- 3-4 sentences. No timing data. No guarantees about outcomes.",
  ].join("\n");
}
