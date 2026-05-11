// "Map / Drag pan · Scroll zoom" info card. Positioning + the Reset view
// button are owned by MapExplorer now so the bottom-left controls (mode
// toggle, reset view, info card) can share one tidy flex column.
export default function MapHud() {
  return (
    <div className="glass rounded-2xl px-3 py-2 text-[11px] text-slate-200 leading-relaxed pointer-events-auto">
      <div className="font-semibold text-slate-50 mb-0.5">Map</div>
      <div className="text-slate-300">
        Drag pan · Scroll zoom · <span className="text-slate-400">Click pin for detail</span>
      </div>
      <div className="text-slate-500 text-[10px] mt-0.5">Google Maps Platform</div>
    </div>
  );
}
