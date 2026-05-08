// Bridges the TourPlayer (which needs useMap()) into the Map's React tree.
// We can't render TourPlayer at the MapExplorer level because the
// @vis.gl/react-google-maps useMap() hook only resolves under <APIProvider>
// + <Map>. MapScene already has those, and MapScene renders its own bridge.
//
// This stub is here to keep MapExplorer's structure clean. The real player
// is mounted from inside MapScene.
export default function TourPlayerInside() {
  return null;
}
