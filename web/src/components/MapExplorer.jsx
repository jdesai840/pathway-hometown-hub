import MapScene from "./MapScene.jsx";
import VoiceMic from "./VoiceMic.jsx";
import SportFilter from "./SportFilter.jsx";
import ChatThread from "./ChatThread.jsx";
import HubDetail from "./HubDetail.jsx";
import EnterSpatialButton from "./EnterSpatialButton.jsx";
import MapHud from "./MapHud.jsx";
// Note: HubDetail is still wired to state-level data; once city pins land in
// the next pass, we'll add a CityDetail component alongside it.

// Main exploration screen: stylized 3D US map fills the viewport with overlay
// UI panels for the agent + filters + per-state detail.
export default function MapExplorer() {
  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)]">
      <div className="absolute inset-0">
        <MapScene />
      </div>

      {/* Top-left: voice/text agent + filters + chat thread */}
      <div className="absolute top-4 left-4 w-[380px] max-w-[42vw] space-y-3 z-20">
        <VoiceMic />
        <SportFilter />
        <ChatThread />
      </div>

      <MapHud />
      <HubDetail />
      <EnterSpatialButton />
    </div>
  );
}
