import { useEffect, useState, useMemo } from "react";
import { feature } from "topojson-client";
import * as THREE from "three";
import { latLngToECEF } from "../lib/ecef.js";

// State-boundary overlay drawn as 3D lines slightly above the photorealistic
// terrain. Pulled from us-atlas's WGS84 TopoJSON, projected into ECEF so the
// lines hug the curve of the Earth.

const BORDER_ALT_METERS = 5000; // 5 km up — clears most terrain on the photoreal tiles

export default function StateBorders() {
  const [features, setFeatures] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = (await import("us-atlas/states-10m.json?url")).default;
      const topology = await fetch(url).then((r) => r.json());
      const collection = feature(topology, topology.objects.states);
      if (!cancelled) setFeatures(collection.features);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const lineSegments = useMemo(() => {
    if (!features) return [];
    const segments = [];
    for (const f of features) {
      const polygons =
        f.geometry.type === "MultiPolygon"
          ? f.geometry.coordinates
          : [f.geometry.coordinates];
      for (const poly of polygons) {
        for (const ring of poly) {
          // Build a closed line for each ring
          const points = ring.map(([lng, lat]) =>
            latLngToECEF(lat, lng, BORDER_ALT_METERS)
          );
          segments.push(points);
        }
      }
    }
    return segments;
  }, [features]);

  if (!features) return null;

  return (
    <group>
      {lineSegments.map((points, i) => (
        <BorderLine key={i} points={points} />
      ))}
    </group>
  );
}

function BorderLine({ points }) {
  const geom = useMemo(() => {
    const positions = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i].x;
      positions[i * 3 + 1] = points[i].y;
      positions[i * 3 + 2] = points[i].z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [points]);

  useEffect(() => () => geom.dispose(), [geom]);

  return (
    <line geometry={geom}>
      <lineBasicMaterial color="#ffffff" transparent opacity={0.7} depthTest={false} />
    </line>
  );
}
