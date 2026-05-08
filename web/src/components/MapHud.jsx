import { useApp } from "../store.js";

// Bottom-left control hints + reset-view button. Lives outside the Canvas so
// it's just plain HTML overlay.
export default function MapHud() {
  const setSelectedState = useApp((s) => s.setSelectedState);
  const rehighlight = useApp((s) => s.rehighlight);

  function reset() {
    setSelectedState(null);
    rehighlight([]);
    // Trigger a custom event the MapScene listens for to recenter the camera.
    window.dispatchEvent(new CustomEvent("map:reset-view"));
  }

  return (
    <div className="absolute bottom-4 left-4 z-20 flex items-end gap-3 pointer-events-none">
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-[11px] text-slate-300 leading-relaxed pointer-events-auto">
        <div className="font-semibold text-slate-100 mb-0.5">Map controls</div>
        <div>
          Drag — orbit · Right-drag — pan · Scroll / pinch — zoom
        </div>
        <div className="text-slate-400">
          Click a state to focus · click again outside to deselect
        </div>
      </div>
      <button
        onClick={reset}
        aria-label="Reset map view"
        className="pointer-events-auto rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-100 text-xs font-semibold px-4 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-white/40"
      >
        Reset view
      </button>
    </div>
  );
}
