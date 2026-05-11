import MapScene from "./MapScene.jsx";
import SportFilter from "./SportFilter.jsx";
import AgentStreamPanel from "./AgentStreamPanel.jsx";
import HubDetail from "./HubDetail.jsx";
import CityDetail from "./CityDetail.jsx";
import MapHud from "./MapHud.jsx";
import ClimateLegend from "./ClimateLegend.jsx";
import TourLauncher from "./TourLauncher.jsx";
import TourOverlay from "./TourOverlay.jsx";
import CityCinematic from "./CityCinematic.jsx";
import { useApp } from "../store.js";

export default function MapExplorer() {
  const tour = useApp((s) => s.tour);
  const tourActive = Boolean(tour);
  const viewMode = useApp((s) => s.viewMode);
  const setViewMode = useApp((s) => s.setViewMode);

  // Exploration UI (chat, filters, side panels) shows only when the user is
  // explicitly in Map Explorer mode AND no tour is running.
  const showExploreUI = viewMode === "explore" && !tourActive;

  function handleResetView() {
    window.dispatchEvent(new CustomEvent("map:reset-view"));
  }

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)]">
      <div className="absolute inset-0">
        <MapScene />
      </div>

      {/* Top-left agent panel — ONE unified glass surface with internal
          dividers. Conditionally rendered (not just opacity-faded) so it
          fully leaves the DOM in Tour mode — avoids any backdrop-filter
          compositing artifacts from a hidden-but-present panel. */}
      {showExploreUI && (
        <div
          className="absolute top-4 left-4 w-[400px] max-w-[42vw] z-20 rounded-2xl animate-slide-up"
          style={{
            background: "rgba(8, 12, 22, 0.55)",
            backdropFilter: "blur(14px) saturate(140%)",
            WebkitBackdropFilter: "blur(14px) saturate(140%)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
          }}
        >
          <SportFilter />
        </div>
      )}

      {/* Top-right streaming agent dashboard — only in Map Explorer mode. */}
      {showExploreUI && <AgentStreamPanel />}

      <ClimateLegend />

      {/* Side-detail panels — also gated on Map Explorer mode. */}
      {showExploreUI && (
        <>
          <HubDetail />
          <CityDetail />
        </>
      )}

      {/* TourLauncher (Start Tour pill) — ONLY in Tour mode. */}
      {viewMode === "tour" && <TourLauncher />}

      {/* Tour overlay (captions, popouts, control bar) lives OUTSIDE <Map>. */}
      <TourOverlay />
      {/* Photorealistic 3D city viewport, fades in mid-narration during a tour stop */}
      <CityCinematic />

      {/* Bottom-left controls — single flex column groups the
          [mode toggle + reset view] row above the "Map / Drag pan" info card. */}
      <div className="absolute bottom-4 left-4 z-30 flex flex-col items-start gap-2.5">
        <div className="flex items-center gap-2">
          {/* Mode toggle pill */}
          <button
            type="button"
            onClick={() =>
              setViewMode(viewMode === "tour" ? "explore" : "tour")
            }
            disabled={tourActive}
            className="group inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold tracking-wide text-slate-100 border border-white/15 hover:border-white/30 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white/40"
            style={{
              background: "rgba(8, 12, 22, 0.6)",
              backdropFilter: "blur(12px) saturate(140%)",
              WebkitBackdropFilter: "blur(12px) saturate(140%)",
            }}
            aria-label={
              viewMode === "tour"
                ? "Switch to Map Explorer"
                : "Switch to Interactive Tour"
            }
          >
            <span aria-hidden="true">{viewMode === "tour" ? "🗺" : "🎬"}</span>
            <span>{viewMode === "tour" ? "Map Explorer" : "Interactive Tour"}</span>
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
          </button>

          {/* Reset view — matches toggle's pill aesthetic */}
          <button
            type="button"
            onClick={handleResetView}
            aria-label="Reset map view"
            className="inline-flex items-center px-3.5 py-2 rounded-full text-xs font-semibold tracking-wide text-slate-100 border border-white/15 hover:border-white/30 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/40"
            style={{
              background: "rgba(8, 12, 22, 0.6)",
              backdropFilter: "blur(12px) saturate(140%)",
              WebkitBackdropFilter: "blur(12px) saturate(140%)",
            }}
          >
            Reset view
          </button>
        </div>

        <MapHud />
      </div>
    </div>
  );
}
