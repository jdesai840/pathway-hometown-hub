import MapScene from "./MapScene.jsx";
import VoiceMic from "./VoiceMic.jsx";
import SportFilter from "./SportFilter.jsx";
import AgentPanel from "./AgentPanel.jsx";
import HubDetail from "./HubDetail.jsx";
import EnterSpatialButton from "./EnterSpatialButton.jsx";

// Main exploration screen: 3D map fills the viewport with overlay UI panels.
export default function MapExplorer() {
  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)]">
      {/* The 3D scene fills the viewport. */}
      <div className="absolute inset-0">
        <MapScene />
      </div>

      {/* Top-left: agent voice + filters */}
      <div className="absolute top-4 left-4 w-[360px] max-w-[40vw] space-y-3 z-20">
        <VoiceMic />
        <SportFilter />
        <AgentPanel />
      </div>

      {/* Right: hub detail (only when a state is selected) */}
      <HubDetail />

      {/* Bottom-right: enter VR */}
      <EnterSpatialButton />
    </div>
  );
}
