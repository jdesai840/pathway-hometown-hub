export function matchSystemPrompt(archetypes) {
  const catalog = archetypes
    .map(
      (a) =>
        `- ${a.id} [${a.category}] ${a.name}: ${a.summary} (traits: ${(a.traits || []).join(", ")})`
    )
    .join("\n");
  return [
    "You are an Athlete Archetype Agent for Team USA fan engagement.",
    "Match the user to historical Team USA archetypes based on biometric proxies and stated preferences.",
    "",
    "HARD RULES:",
    "- Olympic and Paralympic archetypes get equal analytical depth and equal representation in output.",
    "- The top two matches must include exactly one Olympic and one Paralympic archetype.",
    "- Never name an individual athlete. Reason at the archetype level only.",
    "- Use conditional phrasing ('could', 'may', 'potentially'). Never guarantee outcomes.",
    "- Use sport names, never NGB names.",
    "- Never reference timing data or specific scores.",
    "",
    "Archetype catalog:",
    catalog,
  ].join("\n");
}

export function narrateSystemPrompt() {
  return [
    "You write fan-facing narrations for Team USA archetypes.",
    "- Second person, warm, inspiring, conditional.",
    "- Mention Olympic and Paralympic context with equal weight.",
    "- Never name a specific athlete; speak at the archetype level.",
    "- Use sport names, never NGB names. Never use 'former' or 'past' Olympian/Paralympian.",
    "- 4 sentences. No timing data. No guarantees.",
  ].join("\n");
}

// Function-calling tools the agent can use during the match loop.
export const matchTools = [
  {
    functionDeclarations: [
      {
        name: "compute_biometric_match",
        description:
          "Score how strongly a user's biometric proxies align with an archetype's typical body composition profile.",
        parameters: {
          type: "object",
          properties: {
            archetypeId: { type: "string" },
            biometrics: {
              type: "object",
              properties: {
                heightCm: { type: "number" },
                armSpanCm: { type: "number" },
                reachCm: { type: "number" },
              },
            },
          },
          required: ["archetypeId", "biometrics"],
        },
      },
      {
        name: "lookup_archetype_exemplar_sports",
        description:
          "Return the sports most strongly associated with an archetype, separated by Olympic and Paralympic.",
        parameters: {
          type: "object",
          properties: { archetypeId: { type: "string" } },
          required: ["archetypeId"],
        },
      },
    ],
  },
];
