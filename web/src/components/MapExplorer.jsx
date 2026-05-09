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

export default function MapExplorer() {
  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)]">
      <div className="absolute inset-0">
        <MapScene />
      </div>

      <div className="absolute top-4 left-4 w-[400px] max-w-[42vw] space-y-2.5 z-20">
        <VoiceMic />
        <SportFilter />
        <ChatThread />
      </div>

      <MapHud />
      <ClimateLegend />
      <HubDetail />
      <CityDetail />
      <TourLauncher />
      {/* Tour overlay (captions, popouts, control bar) lives OUTSIDE <Map>
          so its position:fixed escapes the map's transformed containing block. */}
      <TourOverlay />
      {/* Photorealistic 3D city viewport, fades in mid-narration during a tour stop */}
      <CityCinematic />
    </div>
  );
}
