// Bottom-left HUD: control hints + reset-view button.
export default function MapHud() {
  function reset() {
    window.dispatchEvent(new CustomEvent("map:reset-view"));
  }

  return (
    <div className="absolute bottom-4 left-4 z-20 flex items-end gap-2.5 pointer-events-none">
      <div className="glass rounded-2xl px-3 py-2 text-[11px] text-slate-200 leading-relaxed pointer-events-auto">
        <div className="font-semibold text-slate-50 mb-0.5">Map</div>
        <div className="text-slate-300">
          Drag pan · Scroll zoom · <span className="text-slate-400">Click pin for detail</span>
        </div>
        <div className="text-slate-500 text-[10px] mt-0.5">Google Maps Platform</div>
      </div>
      <button
        onClick={reset}
        aria-label="Reset map view"
        className="pointer-events-auto rounded-full glass hover:bg-slate-800/80 text-slate-50 text-xs font-semibold px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-white/40 transition"
      >
        Reset view
      </button>
    </div>
  );
}
