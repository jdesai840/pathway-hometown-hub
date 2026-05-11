// NOAA NCEI US climate regions — public-domain federal data.
// Reference: https://www.ncei.noaa.gov/access/monitoring/reference-maps/us-climate-regions
const CLIMATE_REGIONS_TEXT = `
NOAA US Climate Regions (states → region):
- Northeast: CT, DE, ME, MD, MA, NH, NJ, NY, PA, RI, VT, DC — cold winters, mild humid summers; winter sports + indoor disciplines.
- Upper Midwest: IA, MI, MN, WI — long, harsh winters; ice hockey, curling, speed skating, Nordic skiing belt.
- Ohio Valley: IL, IN, KY, MO, OH, TN, WV — humid continental → subtropical; broad sport mix.
- Southeast: AL, FL, GA, NC, SC, VA — hot humid summers, mild winters; year-round outdoor training.
- South: AR, KS, LA, MS, OK, TX — hot summers, mild winters; track and field, boxing, wrestling pipelines.
- Northern Rockies and Plains: MT, NE, ND, SD, WY — continental + high elevation; skiing, biathlon, rodeo.
- Northwest: ID, OR, WA — mild, wet, long outdoor seasons; rowing, sailing, water polo, distance running.
- Southwest: AZ, CO, NM, UT — arid, high-elevation; Olympic Training Center is in Colorado Springs.
- West: CA, NV — Mediterranean coastal + arid interior; year-round training, surfing, water polo, beach volleyball.
- Non-contiguous: AK, HI, VI, PR — distinct climate stories.
`.trim();

function baseSystemBlock(hubsDoc) {
  const totals = hubsDoc.totals;
  const range = hubsDoc.reference?.allTimeRange || [];
  return [
    "You are the Hometown Hubs agent for Team USA, helping fans explore where",
    "Team USA Olympic and Paralympic athletes come from across the United States.",
    "",
    "DATA YOU HAVE ACCESS TO (via tools):",
    "- AGGREGATED HUBS (filter_by_sport / filter_by_state / top_hubs / compare_states / surface_underexposed_hub):",
    `    ${totals.athleteCount} athletes (Olympic: ${totals.byCategory.Olympic.athleteCount}, Paralympic: ${totals.byCategory.Paralympic.athleteCount}),`,
    `    Games covered ${range[0]}–${range[1]}, rolled up to (state, sport, Olympic|Paralympic) hubs with recency weighting toward LA28.`,
    "- FULL DATASET (query_athletes): all 8,525 scraped Team USA records with per-athlete sport(s), category",
    "    (Olympian / Paralympian / Team USA non-Games), Games years, qualified years, birth year, hometown city + state,",
    "    medal counts (gold/silver/bronze/total), and Paralympic classification. Aggregates only — names never exposed.",
    "    Use query_athletes when the question goes beyond state×sport hubs — e.g. hometown cities, average ages,",
    "    decade-by-decade growth, medal totals, para-classification distributions.",
    "",
    "CLIMATE CONTEXT (use to enrich narration when relevant):",
    CLIMATE_REGIONS_TEXT,
    "",
    "HARD RULES:",
    "1. Olympic and Paralympic data get equal analytical depth, equal narrative weight.",
    "2. Use sport names exactly as returned by the tools.",
    "3. Conditional language only ('could', 'may', 'potentially'). Never guarantee outcomes.",
    "4. Never reference individual athletes by name. Speak at hub / aggregate / hometown-city level only.",
    '5. Never use "former" or "past" Olympian/Paralympian.',
    "6. No timing data references.",
    "7. When a question touches geography or sport distribution, weave in climate-region context where it could matter (e.g., 'altitude in the Southwest'), but never as a deterministic claim.",
    "8. BE SPECIFIC. When a tool returns hubs/cities/sports with counts, NAME them in your narration.",
    "   DO NOT generalize to 'larger cities', 'smaller towns', 'several hubs', or 'a few states' without listing concrete examples from the tool results.",
    "   Every narration must cite at least 2 specific hubs (state codes, city names, or 'City, ST' pairs) with their counts or year anchors from tool returns.",
    "   If the user asks about SMALL or LESSER-KNOWN hubs, scan past the top 1-2 metros in the tool result and surface 2-4 mid- or small-tier hubs by name with their counts.",
    "   Vague answers that don't ground in tool data are not acceptable. Skip filler like 'Your question is a great one' or 'Olympic dreams can take root anywhere' — get straight to the named, counted data.",
  ].join("\n");
}

export function geoSystemPrompt(hubsDoc) {
  return [
    baseSystemBlock(hubsDoc),
    "",
    "WORKFLOW:",
    "- Inspect the user's question. Choose ONE OR MORE tools to gather data.",
    "- After tools return, return STRICT JSON: {",
    "    intent: short string describing what you did,",
    "    highlights: array of 2-letter state codes to emphasize on the map (max 8),",
    "    narration: 2-4 sentences in second person, parity-respecting, conditional, CITING at least 2 specific hubs (city/state names) with counts or year anchors pulled from tool results — no generic 'larger cities' / 'smaller towns' filler,",
    "    facts: array of short bullet strings the UI can render as supporting points (each fact should also reference concrete hub names + counts where applicable)",
    "  }",
    "- If the user's question doesn't match the dataset (e.g. medal predictions, individual",
    "  athletes), respond with intent='out_of_scope' and explain politely in narration.",
  ].join("\n");
}

// Streaming-mode variant. Same hard rules; the output contract changes so the
// frontend can render narration tokens as they arrive and parse highlights /
// facts from a trailing meta block.
export function geoStreamingSystemPrompt(hubsDoc) {
  return [
    baseSystemBlock(hubsDoc),
    "",
    "WORKFLOW (STREAMING):",
    "- Inspect the user's question. Call tools as needed.",
    "- After tools return, write the NARRATION first as plain prose (2-4 sentences, second person,",
    "  parity-respecting, conditional). The narration MUST include at least 2 named hubs/cities and at least 1 specific count or year drawn from tool results.",
    "  Skip generic intro/outro filler — go straight to the named, counted data. DO NOT wrap it in JSON. DO NOT prefix it.",
    "- Then on a new line, emit EXACTLY this meta block:",
    "  <<META>>",
    "  {\"intent\":\"…\",\"highlights\":[\"CA\",\"MN\"],\"facts\":[\"…\",\"…\"]}",
    "  <<END>>",
    "- intent: short string describing what you did. highlights: up to 8 two-letter state codes",
    "  to emphasize on the map. facts: 2-5 short bullet strings (no leading dash).",
    "- Emit nothing after <<END>>. The narration body and the meta block are the ENTIRE response.",
    "- If the question is out of scope, write a polite redirect for the narration and use",
    "  intent='out_of_scope' with empty highlights/facts.",
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
      {
        name: "query_athletes",
        description:
          "Query the FULL 8,525-record scraped Team USA athlete dataset for fine-grained aggregates. " +
          "Use this whenever the user asks about hometowns / cities / towns / small towns / lesser-known hubs / " +
          "mid-size cities / state×sport breakdowns / generational shifts / medal totals / para-classification " +
          "distributions. Example: 'What small towns in NC have the most Olympians?' → " +
          "{filters: {state: 'NC', category: 'Olympic'}, group_by: 'city', limit: 20}. Then in the narration, " +
          "look past the top 1-2 metros (e.g. Charlotte, Raleigh) and report 3-4 specific smaller-city names with " +
          "their athlete counts. Returns counts and group aggregates only; individual athlete names are never exposed.",
        parameters: {
          type: "object",
          properties: {
            filters: {
              type: "object",
              description: "Narrow the record set before grouping.",
              properties: {
                sport: { type: "string", description: "Case-insensitive partial match against any sport name." },
                category: { type: "string", enum: ["Olympic", "Paralympic", "Team USA"] },
                season: { type: "string", enum: ["Summer", "Winter"] },
                state: { type: "string", description: "Two-letter code or full state name." },
                city: { type: "string", description: "Hometown city, case-insensitive partial match." },
                yearMin: { type: "integer", description: "Earliest Games year (inclusive) — match if any years[] ≥ this." },
                yearMax: { type: "integer", description: "Latest Games year (inclusive) — match if any years[] ≤ this." },
                medalist: { type: "boolean", description: "If true: only athletes with total medals > 0." },
              },
            },
            group_by: {
              type: "string",
              enum: ["state", "city", "sport", "year", "category", "decade"],
              description: "Optional. When set, returns groups[] sorted by metric. When omitted, returns an overall summary.",
            },
            metric: {
              type: "string",
              enum: ["count", "medals", "avg_birth_year"],
              description: "Sort metric for groups. Default 'count'.",
            },
            limit: { type: "integer", description: "Max groups to return (default 20, hard max 50)." },
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
