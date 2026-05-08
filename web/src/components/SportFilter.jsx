import { useMemo, useState, useEffect, useRef } from "react";
import { useApp } from "../store.js";

// All-sports searchable filter + category + mode toggles.
// Pulls the FULL sport list from cityHubsDoc (~91 sport+category combos),
// shows a few popular quick-picks, and lets the user search by typing.

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
  const cityHubsDoc = useApp((s) => s.cityHubsDoc);

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Aggregate every (sport, category) → total athletes across the dataset.
  const allSports = useMemo(() => {
    if (!cityHubsDoc) return [];
    const map = new Map();
    for (const h of cityHubsDoc.hubs) {
      const key = `${h.sport}|${h.category}`;
      const e = map.get(key) || {
        sport: h.sport,
        category: h.category,
        athletes: 0,
      };
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

  // Close dropdown when clicking elsewhere
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
    <div className="rounded-2xl bg-slate-900/85 border border-slate-800 p-4 space-y-3 relative">
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

      {/* Search input + active sport pill */}
      <div className="flex items-center gap-2">
        {sportFilter && (
          <button
            onClick={() => setSportFilter(null)}
            className="text-xs px-3 py-1.5 rounded-full bg-white text-slate-900 font-semibold flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-white/60"
            aria-label={`Clear filter ${sportFilter}`}
          >
            {sportFilter} <span className="text-slate-500">✕</span>
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
          placeholder={sportFilter ? "search to swap…" : `search ${allSports.length} sports…`}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-full px-3 py-1.5 text-xs text-slate-50 focus:outline-none focus:ring-2 focus:ring-white/40 placeholder:text-slate-500"
          aria-label="Search sports"
        />
      </div>

      {/* Dropdown — visible when search is open */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-30 left-4 right-4 top-full mt-1 max-h-72 overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 shadow-2xl"
        >
          {matches.length === 0 ? (
            <div className="p-3 text-xs text-slate-400">No sports match.</div>
          ) : (
            <ul role="listbox" className="py-1">
              {matches.slice(0, 50).map((s) => (
                <li key={`${s.sport}|${s.category}`}>
                  <button
                    onClick={() => pickSport(s.sport)}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center justify-between gap-3 focus:outline-none focus:bg-slate-800"
                  >
                    <span className="text-sm text-slate-100 truncate">{s.sport}</span>
                    <span className="flex items-center gap-2 text-xs">
                      <span
                        className={
                          s.category === "Paralympic"
                            ? "text-paralympic font-semibold"
                            : "text-olympic font-semibold"
                        }
                      >
                        {s.category}
                      </span>
                      <span className="text-slate-400">{s.athletes}</span>
                    </span>
                  </button>
                </li>
              ))}
              {matches.length > 50 && (
                <li className="px-3 py-2 text-[11px] text-slate-500 italic">
                  Showing first 50 — keep typing to narrow.
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* Quick-picks — sample of popular sports */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        <PillBtn active={sportFilter === null} onClick={() => setSportFilter(null)}>
          All sports
        </PillBtn>
        {QUICK_PICKS.map((s) => (
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
      className={`text-[11px] px-2.5 py-1 rounded-full transition focus:outline-none focus:ring-2 focus:ring-white/40 ${
        active ? "bg-white text-slate-900 font-semibold" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
