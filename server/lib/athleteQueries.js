// Flexible aggregation over the full 8,525-record athlete dataset.
// Returns counts / groups / summaries — NEVER individual identifying fields.

const STATE_FULL_TO_CODE = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC", "puerto rico": "PR",
};

function normalizeState(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (s.length === 2) return s.toUpperCase();
  return STATE_FULL_TO_CODE[s.toLowerCase()] || s.toUpperCase();
}

function matchesFilters(rec, f) {
  if (f.category) {
    const want = f.category; // "Olympic" | "Paralympic" | "Team USA"
    const hasSportType = rec.sports.some((s) => s.type === want);
    const matchesCatField =
      (want === "Olympic" && rec.category === "Olympian") ||
      (want === "Paralympic" && rec.category === "Paralympian") ||
      (want === "Team USA" && rec.category === "Team USA");
    if (!hasSportType && !matchesCatField) return false;
  }
  if (f.season) {
    if (!rec.sports.some((s) => s.season === f.season)) return false;
  }
  if (f.sport) {
    const q = f.sport.toLowerCase();
    if (!rec.sports.some((s) => (s.name || "").toLowerCase().includes(q))) return false;
  }
  if (f.state) {
    const want = normalizeState(f.state);
    if (rec.homeState !== want) return false;
  }
  if (f.city) {
    const q = f.city.toLowerCase();
    if (!rec.homeCity || !rec.homeCity.toLowerCase().includes(q)) return false;
  }
  if (typeof f.yearMin === "number") {
    if (!rec.years.some((y) => y >= f.yearMin)) return false;
  }
  if (typeof f.yearMax === "number") {
    if (!rec.years.some((y) => y <= f.yearMax)) return false;
  }
  if (f.medalist === true) {
    if ((rec.medals.total || 0) === 0) return false;
  }
  if (f.medalist === false) {
    if ((rec.medals.total || 0) > 0) return false;
  }
  return true;
}

function groupKey(rec, groupBy) {
  switch (groupBy) {
    case "state": return rec.homeState || "Unknown";
    case "city":
      return rec.homeCity
        ? `${rec.homeCity}${rec.homeState ? `, ${rec.homeState}` : ""}`
        : "Unknown";
    case "sport": return rec.sports[0]?.name || "Unknown";
    case "year":
      // Use the LATEST year so each athlete contributes once per group_by year.
      return rec.years.length ? String(Math.max(...rec.years)) : "Unknown";
    case "category":
      if (rec.sports.some((s) => s.type === "Paralympic")) return "Paralympic";
      if (rec.sports.some((s) => s.type === "Olympic")) return "Olympic";
      return rec.category || "Unknown";
    case "decade":
      if (!rec.years.length) return "Unknown";
      const y = Math.max(...rec.years);
      return `${Math.floor(y / 10) * 10}s`;
    default:
      return "all";
  }
}

export function queryAthletes(records, args) {
  const filters = args.filters || {};
  const groupBy = args.group_by || null;
  const metric = args.metric || "count";
  const limit = Math.max(1, Math.min(50, args.limit || 20));

  const matched = [];
  for (const r of records) {
    if (matchesFilters(r, filters)) matched.push(r);
  }

  // No group_by → summary block over the matched set.
  if (!groupBy) {
    const ages = matched
      .map((r) => r.birthYear)
      .filter((y) => typeof y === "number");
    const medalSum = matched.reduce((acc, r) => {
      acc.gold += r.medals.gold;
      acc.silver += r.medals.silver;
      acc.bronze += r.medals.bronze;
      acc.total += r.medals.total;
      return acc;
    }, { gold: 0, silver: 0, bronze: 0, total: 0 });
    return {
      total: matched.length,
      summary: {
        medalists: matched.filter((r) => r.medals.total > 0).length,
        medals: medalSum,
        avgBirthYear:
          ages.length === 0
            ? null
            : Math.round(ages.reduce((a, b) => a + b, 0) / ages.length),
        birthYearCount: ages.length,
        olympicCount: matched.filter((r) =>
          r.sports.some((s) => s.type === "Olympic")
        ).length,
        paralympicCount: matched.filter((r) =>
          r.sports.some((s) => s.type === "Paralympic")
        ).length,
      },
    };
  }

  // Group + aggregate.
  const buckets = new Map();
  let unknownCount = 0;
  const dropUnknown = groupBy === "state" || groupBy === "city";
  for (const r of matched) {
    const key = groupKey(r, groupBy);
    if (dropUnknown && key === "Unknown") {
      unknownCount += 1;
      continue;
    }
    let b = buckets.get(key);
    if (!b) {
      b = { key, count: 0, medals: 0, birthYears: [] };
      buckets.set(key, b);
    }
    b.count += 1;
    b.medals += r.medals.total;
    if (typeof r.birthYear === "number") b.birthYears.push(r.birthYear);
  }

  const groups = [...buckets.values()].map((b) => ({
    key: b.key,
    count: b.count,
    medals: b.medals,
    avgBirthYear:
      b.birthYears.length === 0
        ? null
        : Math.round(b.birthYears.reduce((a, c) => a + c, 0) / b.birthYears.length),
  }));

  groups.sort((a, b) => {
    if (metric === "medals") return b.medals - a.medals;
    if (metric === "avg_birth_year") {
      // Newer first (higher birth year = younger).
      return (b.avgBirthYear ?? -Infinity) - (a.avgBirthYear ?? -Infinity);
    }
    return b.count - a.count;
  });

  return {
    total: matched.length,
    groupBy,
    metric,
    groups: groups.slice(0, limit),
    truncated: groups.length > limit,
    ...(dropUnknown && unknownCount > 0
      ? { missingLocation: unknownCount }
      : {}),
  };
}
