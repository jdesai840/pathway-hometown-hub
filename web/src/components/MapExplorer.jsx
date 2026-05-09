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

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)]">
      <div className="absolute inset-0">
        <MapScene />
      </div>

      {/* Top-left agent stack — fades out during a tour to let the city
          breathe. Stays mounted so chat history / sport filter survive. */}
      <div
        className={`absolute top-4 left-4 w-[400px] max-w-[42vw] space-y-2.5 z-20 transition-opacity duration-500 ${
          tourActive ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        aria-hidden={tourActive}
      >
        <VoiceMic />
        <SportFilter />
        <ChatThread />
      </div>

      <MapHud />
      <ClimateLegend />

      {/* Side-detail panels also hide during a tour. */}
      <div
        className={`transition-opacity duration-500 ${
          tourActive ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        aria-hidden={tourActive}
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
    </div>
  );
}
