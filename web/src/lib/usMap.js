// Load + project the US states TopoJSON into Three.js-friendly geometry.
//
// us-atlas/states-albers-10m.json ships pre-projected Albers USA coordinates
// (range roughly [0, 1000] x [0, 600]). We center on origin and scale so the
// rendered map fits in a ~1.6-unit-wide Three.js scene.

import { feature } from "topojson-client";
import { geoPath } from "d3-geo";
import * as THREE from "three";
import { FIPS_TO_STATE } from "../data/fips-to-state.js";

// Albers USA bounding box (from us-atlas)
// Center the rendered map by translating by half the bounds.
const ALBERS_W = 975;
const ALBERS_H = 610;
// Scale Albers (~975 wide) into Three.js (~1.6 wide) — gives us a tabletop-sized US.
const SCENE_SCALE = 1.6 / ALBERS_W;

/** Convert Albers projected (x, y) → Three.js scene coords. */
export function albersToScene(x, y) {
  return [
    (x - ALBERS_W / 2) * SCENE_SCALE,
    -((y - ALBERS_H / 2) * SCENE_SCALE),
  ];
}

let cachedFeatures = null;

/** Load + parse the US states FeatureCollection. */
export async function loadUsStates() {
  if (cachedFeatures) return cachedFeatures;
  const url = (await import("us-atlas/states-albers-10m.json?url")).default;
  const topology = await fetch(url).then((r) => r.json());
  const collection = feature(topology, topology.objects.states);
  cachedFeatures = collection.features.map((f) => ({
    ...f,
    stateCode: FIPS_TO_STATE[f.id] || null,
  }));
  return cachedFeatures;
}

/**
 * Convert a GeoJSON Polygon/MultiPolygon (already in projected coords) to an
 * array of Three.Shape — one shape per polygon (with holes from inner rings).
 */
export function featureToShapes(feature) {
  const shapes = [];
  const polygons =
    feature.geometry.type === "MultiPolygon"
      ? feature.geometry.coordinates
      : [feature.geometry.coordinates];

  for (const poly of polygons) {
    if (!poly || poly.length === 0) continue;
    const outer = poly[0];
    const shape = new THREE.Shape();
    outer.forEach(([x, y], i) => {
      const [sx, sy] = albersToScene(x, y);
      if (i === 0) shape.moveTo(sx, sy);
      else shape.lineTo(sx, sy);
    });
    // inner rings → holes
    for (let i = 1; i < poly.length; i++) {
      const hole = new THREE.Path();
      poly[i].forEach(([x, y], j) => {
        const [sx, sy] = albersToScene(x, y);
        if (j === 0) hole.moveTo(sx, sy);
        else hole.lineTo(sx, sy);
      });
      shape.holes.push(hole);
    }
    shapes.push(shape);
  }
  return shapes;
}

/** Centroid of a feature in scene coords (uses d3 geoPath with identity projection). */
export function featureCenter(feature) {
  const path = geoPath();
  const c = path.centroid(feature); // [x, y] in projected coords
  return albersToScene(c[0], c[1]);
}
