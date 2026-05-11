import { useMemo, useState, useEffect, useRef } from "react";
import { useApp } from "../store.js";

const QUICK_PICKS = [
  "Track and Field",
  "Swimming",
  "Curling",
  "Ice Hockey",
  "Wheelchair Basketball",
  "Para Track and Field",
  "Snowboarding",
  "Sled Hockey",
];

export default function SportFilter() {
  const sportFilter = useApp((s) => s.sportFilter);
  const setSportFilter = useApp((s) => s.setSportFilter);
  const categoryFilter = useApp((s) => s.categoryFilter);
  const setCategoryFilter = useApp((s) => s.setCategoryFilter);
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);
  const climateOverlay = useApp((s) => s.climateOverlay);
  const setClimateOverlay = useApp((s) => s.setClimateOverlay);
  const cityHubsDoc = useApp((s) => s.cityHubsDoc);

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const allSports = useMemo(() => {
    if (!cityHubsDoc) return [];
    const map = new Map();
    for (const h of cityHubsDoc.hubs) {
      const key = `${h.sport}|${h.category}`;
      const e = map.get(key) || { sport: h.sport, category: h.category, athletes: 0 };
      e.athletes += h.athleteCount;
      map.set(key, e);
    }
    return [...map.values()].sort((a, b) => b.athletes - a.athletes);
  }, [cityHubsDoc]);

  const matches = useMemo(() => {
    let out = allSports;
    if (categoryFilter) out = out.filter((s) => s.category === categoryFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((s) => s.sport.toLowerCase().includes(q));
    }
    return out;
  }, [allSports, search, categoryFilter]);

  useEffect(() => {
    function onDoc(e) {
      if (!dropdownRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pickSport(s) {
    setSportFilter(s);
    setSearch("");
    setOpen(false);
  }

  return (
    <div className="px-4 py-3.5 space-y-2.5 relative">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <fieldset aria-label="Olympic or Paralympic">
          <div className="inline-flex rounded-full bg-slate-950/60 p-0.5 text-[11px] border border-slate-700/40">
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
          <div className="inline-flex rounded-full bg-slate-950/60 p-0.5 text-[11px] border border-slate-700/40">
            <ToggleBtn active={mode === "recency"} onClick={() => setMode("recency")}>
              LA28
            </ToggleBtn>
            <ToggleBtn active={mode === "all_time"} onClick={() => setMode("all_time")}>
              All-time
            </ToggleBtn>
          </div>
        </fieldset>
      </div>

      <div className="flex items-center gap-2">
        {sportFilter && (
          <button
            onClick={() => setSportFilter(null)}
            className="text-[11px] px-2.5 py-1.5 rounded-full bg-white text-slate-900 font-semibold flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-white/60 shrink-0"
            aria-label={`Clear filter ${sportFilter}`}
          >
            {sportFilter}
            <span className="text-slate-500">✕</span>
          </button>
        )}
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={sportFilter ? "swap sport…" : `search ${allSports.length} sports`}
          className="flex-1 bg-slate-950/60 border border-slate-700/60 rounded-full px-3 py-1.5 text-[12px] text-slate-50 focus:outline-none focus:ring-2 focus:ring-white/40 placeholder:text-slate-500 transition min-w-0"
          aria-label="Search sports"
        />
      </div>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-30 left-3.5 right-3.5 top-full mt-1 max-h-72 overflow-y-auto rounded-xl glass-strong shadow-2xl animate-fade-in"
        >
          {matches.length === 0 ? (
            <div className="p-3 text-xs text-slate-400">No sports match.</div>
          ) : (
            <ul role="listbox" className="py-1">
              {matches.slice(0, 50).map((s) => (
                <li key={`${s.sport}|${s.category}`}>
                  <button
                    onClick={() => pickSport(s.sport)}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-800/70 flex items-center justify-between gap-3 focus:outline-none focus:bg-slate-800/70 transition"
                  >
                    <span className="text-sm text-slate-50 truncate">{s.sport}</span>
                    <span className="flex items-center gap-2 text-[11px] shrink-0">
                      <span
                        className={
                          s.category === "Paralympic"
                            ? "text-paralympic font-semibold"
                            : "text-olympic font-semibold"
                        }
                      >
                        {s.category}
                      </span>
                      <span className="text-slate-400 num">{s.athletes}</span>
                    </span>
                  </button>
                </li>
              ))}
              {matches.length > 50 && (
                <li className="px-3 py-2 text-[10px] text-slate-500 italic">
                  Showing top 50. Keep typing to narrow.
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 pt-0.5">
        <PillBtn active={sportFilter === null} onClick={() => setSportFilter(null)}>
          All sports
        </PillBtn>
        {QUICK_PICKS.slice(0, 6).map((s) => (
          <PillBtn key={s} active={sportFilter === s} onClick={() => setSportFilter(s)}>
            {s}
          </PillBtn>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1.5 border-t border-slate-700/40">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
          Climate overlay
        </p>
        <button
          onClick={() => setClimateOverlay(!climateOverlay)}
          aria-pressed={climateOverlay}
          aria-label="Toggle NOAA climate region overlay"
          className={`relative w-10 h-5 rounded-full transition focus:outline-none focus:ring-2 focus:ring-white/40 ${
            climateOverlay ? "bg-gradient-to-r from-olympic to-paralympic" : "bg-slate-700/70"
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow ${
              climateOverlay ? "left-5" : "left-0.5"
            }`}
          />
        </button>
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
      : active ? "bg-slate-50 text-slate-900" : "text-slate-300";
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-2.5 py-0.5 rounded-full transition focus:outline-none focus:ring-2 focus:ring-white/40 font-medium ${accentCls}`}
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
      className={`text-[10px] px-2 py-0.5 rounded-full transition focus:outline-none focus:ring-2 focus:ring-white/40 ${
        active
          ? "bg-white text-slate-900 font-semibold"
          : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/70 border border-slate-700/40"
      }`}
    >
      {children}
    </button>
  );
}
