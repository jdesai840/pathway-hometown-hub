// Compact horizontal timeline showing the historical span of an archetype.
// Props: { earliestYear, latestYear, accent ("olympic" | "paralympic") }
// Anchors to 1900 on the left and current year on the right so all archetypes
// share a common visual scale (parity-friendly — Olympic and Paralympic compared on same axis).

const SCALE_START = 1900;
const SCALE_END = new Date().getFullYear();

export default function EraTimeline({ earliestYear, latestYear, accent = "olympic" }) {
  if (!earliestYear || !latestYear) return null;

  const span = SCALE_END - SCALE_START;
  const leftPct = Math.max(0, ((earliestYear - SCALE_START) / span) * 100);
  const widthPct = Math.max(2, ((latestYear - earliestYear) / span) * 100);

  const accentClass =
    accent === "paralympic" ? "bg-paralympic" : "bg-olympic";

  return (
    <div
      className="mt-4"
      role="img"
      aria-label={`Active in ${accent === "paralympic" ? "Paralympic" : "Olympic"} Games from ${earliestYear} to ${latestYear}.`}
    >
      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
        <span>{SCALE_START}</span>
        <span className="text-slate-300 font-semibold">
          {earliestYear} – {latestYear}
        </span>
        <span>{SCALE_END}</span>
      </div>
      <div className="relative h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`absolute top-0 h-full ${accentClass} rounded-full`}
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}
