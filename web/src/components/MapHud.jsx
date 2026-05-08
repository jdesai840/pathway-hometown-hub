// Bottom-left control hints + reset-view button for the 2D map.
export default function MapHud() {
  function reset() {
    window.dispatchEvent(new CustomEvent("map:reset-view"));
  }

  return (
    <div className="absolute bottom-4 left-4 z-20 flex items-end gap-3 pointer-events-none">
      <div className="rounded-2xl bg-slate-900/85 border border-slate-800 px-3 py-2 text-[11px] text-slate-200 leading-relaxed pointer-events-auto">
        <div className="font-semibold text-slate-50 mb-0.5">Map controls</div>
        <div>Drag — pan · Scroll / pinch — zoom · Click a pin for detail</div>
        <div className="text-slate-400">Powered by Google Maps Platform</div>
      </div>
      <button
        onClick={reset}
        aria-label="Reset map view to USA"
        className="pointer-events-auto rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-100 text-xs font-semibold px-4 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-white/40"
      >
        Reset to USA
      </button>
    </div>
  );
}
