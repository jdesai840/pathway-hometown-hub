import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useEffect } from "react";
import { useApp } from "../store.js";
import CityMarkers from "./CityMarkers.jsx";
import TourController from "./TourController.jsx";

const US_BOUNDS = {
  north: 49.5,
  south: 24.0,
  west: -125.0,
  east: -66.0,
};
const US_CENTER = { lat: 39.5, lng: -98.35 };

// Google's native HYBRID map type: satellite imagery + roads/labels overlay.
// Feels "alive" without the 3D camera-orientation pain. AdvancedMarkers need
// a Map ID — DEMO_MAP_ID is provided by Google for prototyping.
const HYBRID_MAP_ID = "DEMO_MAP_ID";

export default function MapScene() {
  const mapsApiKey = useApp((s) => s.mapsApiKey);

  if (!mapsApiKey) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-950">
        <div className="text-center max-w-md p-6">
          <p className="text-sm uppercase tracking-widest text-slate-500 mb-2">map offline</p>
          <p>Maps API key is missing.</p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={mapsApiKey}>
      <Map
        mapId={HYBRID_MAP_ID}
        mapTypeId="hybrid"
        defaultCenter={US_CENTER}
        defaultZoom={4}
        minZoom={3}
        maxZoom={16}
        gestureHandling="greedy"
        disableDefaultUI={false}
        zoomControl={true}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        rotateControl={false}
        tilt={0}
        restriction={{
          latLngBounds: { north: 60, south: 18, west: -135, east: -60 },
          strictBounds: false,
        }}
        clickableIcons={false}
        style={{ width: "100%", height: "100%" }}
      >
        <CityMarkers />
        <ResetHandler />
        <TourController />
      </Map>
    </APIProvider>
  );
}

function ResetHandler() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    function onReset() {
      map.fitBounds(US_BOUNDS, 60);
    }
    window.addEventListener("map:reset-view", onReset);
    return () => window.removeEventListener("map:reset-view", onReset);
  }, [map]);
  return null;
}
