import MapScene from "./MapScene.jsx";
import VoiceMic from "./VoiceMic.jsx";
import SportFilter from "./SportFilter.jsx";
import ChatThread from "./ChatThread.jsx";
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

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)]">
      <div className="absolute inset-0">
        <MapScene />
      </div>

      {/* Top-left agent stack — visible only in Map Explorer mode (not Tour
          mode, not during an active tour). Stays mounted so chat history /
          sport filter survive across mode toggles. */}
      <div
        className={`absolute top-4 left-4 w-[400px] max-w-[42vw] space-y-2.5 z-20 transition-opacity duration-500 ${
          showExploreUI ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!showExploreUI}
      >
        <VoiceMic />
        <SportFilter />
        <ChatThread />
      </div>

      <MapHud />
      <ClimateLegend />

      {/* Side-detail panels — also gated on Map Explorer mode. */}
      <div
        className={`transition-opacity duration-500 ${
          showExploreUI ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!showExploreUI}
      >
        <HubDetail />
        <CityDetail />
      </div>

      <TourLauncher />
      {/* Tour overlay (captions, popouts, control bar) lives OUTSIDE <Map>
          so its position:fixed escapes the map's transformed containing block. */}
      <TourOverlay />
      {/* Photorealistic 3D city viewport, fades in mid-narration during a tour stop */}
      <CityCinematic />

      {/* Mode toggle — top-right pill. Disabled while a tour is actively
          playing; user can still finish or exit the tour first. */}
      <div className="absolute top-4 right-4 z-30">
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
      </div>
    </div>
  );
}
