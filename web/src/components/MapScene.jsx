import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useEffect } from "react";
import { useApp } from "../store.js";
import CityMarkers from "./CityMarkers.jsx";

// Custom dark map style — modern, low-distraction, parity-friendly.
// We hide POI clutter, dim road labels, and brighten admin (state) boundaries
// so the city pins stand out against a clean basemap.
const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0b1220" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b1220" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#475569" }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#64748b" }, { weight: 1.5 }] },
  { featureType: "administrative.province", elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#e2e8f0" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#101a2c" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#334155" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#04111c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
];

const US_BOUNDS = {
  north: 49.5,
  south: 24.0,
  west: -125.0,
  east: -66.0,
};
const US_CENTER = { lat: 39.5, lng: -98.35 };

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
        defaultCenter={US_CENTER}
        defaultZoom={4}
        minZoom={3}
        maxZoom={14}
        gestureHandling="greedy"
        disableDefaultUI={false}
        zoomControl={true}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        styles={MAP_STYLE}
        restriction={{
          latLngBounds: { north: 60, south: 18, west: -135, east: -60 },
          strictBounds: false,
        }}
        clickableIcons={false}
        style={{ width: "100%", height: "100%" }}
      >
        <CityMarkers />
        <ResetHandler />
      </Map>
    </APIProvider>
  );
}

// Listens for the HUD "Reset to USA" event and snaps the map to a US-bounded view.
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
