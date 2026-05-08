import { useApp } from "../store.js";
import { CLIMATE_REGIONS } from "../data/climate-regions.js";

// Surfaces only when the climate overlay is active. Bottom-right of the map,
// glass-morph card listing the 9 NOAA climate regions with their swatches.
export default function ClimateLegend() {
  const climateOverlay = useApp((s) => s.climateOverlay);
  if (!climateOverlay) return null;

  const order = [
    "northeast",
    "upper_midwest",
    "ohio_valley",
    "southeast",
    "south",
    "northern_rockies_plains",
    "northwest",
    "southwest",
    "west",
    "noncontig",
  ];

  return (
    <div className="absolute bottom-4 right-4 z-20 glass rounded-2xl p-3.5 max-w-[260px] animate-slide-in-right">
      <p className="text-[10px] uppercase tracking-widest text-slate-300 font-semibold mb-2">
        NOAA climate regions
      </p>
      <ul className="space-y-1">
        {order.map((id) => {
          const r = CLIMATE_REGIONS[id];
          if (!r) return null;
          return (
            <li key={id} className="flex items-center gap-2 text-[11px] text-slate-200">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: r.color }}
                aria-hidden="true"
              />
              <span className="font-medium">{r.name}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-[10px] text-slate-500 mt-2 italic">
        Public-domain NOAA NCEI regions
      </p>
    </div>
  );
}
