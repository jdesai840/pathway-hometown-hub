import { useMemo } from "react";
import { useApp } from "../store.js";

// Quick-pick sport pills + Olympic/Paralympic toggle + recency/all-time toggle.

const SPORT_QUICK_PICKS = [
  "Curling",
  "Ice Hockey",
  "Track and Field",
  "Swimming",
  "Snowboarding",
  "Wheelchair Basketball",
  "Para Track and Field",
  "Sled Hockey",
];

export default function SportFilter() {
  const sportFilter = useApp((s) => s.sportFilter);
  const setSportFilter = useApp((s) => s.setSportFilter);
  const categoryFilter = useApp((s) => s.categoryFilter);
  const setCategoryFilter = useApp((s) => s.setCategoryFilter);
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <fieldset aria-label="Olympic or Paralympic filter">
          <div className="inline-flex rounded-full bg-slate-800 p-1 text-xs">
            <ToggleBtn active={categoryFilter === null} onClick={() => setCategoryFilter(null)}>
              Both
            </ToggleBtn>
            <ToggleBtn
              active={categoryFilter === "Olympic"}
              onClick={() => setCategoryFilter("Olympic")}
              accent="olympic"
            >
              Olympic
            </ToggleBtn>
            <ToggleBtn
              active={categoryFilter === "Paralympic"}
              onClick={() => setCategoryFilter("Paralympic")}
              accent="paralympic"
            >
              Paralympic
            </ToggleBtn>
          </div>
        </fieldset>
        <fieldset aria-label="Recency vs all-time mode">
          <div className="inline-flex rounded-full bg-slate-800 p-1 text-xs">
            <ToggleBtn active={mode === "recency"} onClick={() => setMode("recency")}>
              LA28 momentum
            </ToggleBtn>
            <ToggleBtn active={mode === "all_time"} onClick={() => setMode("all_time")}>
              All-time
            </ToggleBtn>
          </div>
        </fieldset>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <PillBtn active={sportFilter === null} onClick={() => setSportFilter(null)}>
          All sports
        </PillBtn>
        {SPORT_QUICK_PICKS.map((s) => (
          <PillBtn key={s} active={sportFilter === s} onClick={() => setSportFilter(s)}>
            {s}
          </PillBtn>
        ))}
      </div>
    </div>
  );
}

function ToggleBtn({ active, onClick, children, accent }) {
  const accentCls =
    accent === "olympic"
      ? active ? "bg-olympic text-white" : "text-olympic"
      : accent === "paralympic"
      ? active ? "bg-paralympic text-white" : "text-paralympic"
      : active ? "bg-slate-100 text-slate-900" : "text-slate-200";
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1 rounded-full transition focus:outline-none focus:ring-2 focus:ring-white/40 ${accentCls}`}
    >
      {children}
    </button>
  );
}

function PillBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`text-xs px-3 py-1 rounded-full transition focus:outline-none focus:ring-2 focus:ring-white/40 ${
        active
          ? "bg-white text-slate-900 font-semibold"
          : "bg-slate-800 text-slate-200 hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
