// WGS84 lat/lng → ECEF (Earth-Centered, Earth-Fixed) coordinate helpers.
// 3d-tiles-renderer's TilesRenderer renders the globe in ECEF, so all camera
// + marker positioning has to be in this coordinate system.

import * as THREE from "three";

const WGS84_A = 6378137.0; // semi-major axis (m)
const WGS84_F = 1 / 298.257223563; // flattening
const WGS84_B = WGS84_A * (1 - WGS84_F); // semi-minor axis
const WGS84_E2 = 1 - (WGS84_B * WGS84_B) / (WGS84_A * WGS84_A); // eccentricity^2

/**
 * Convert WGS84 lat/lng (degrees) + altitude (m) to ECEF (x, y, z) in meters.
 * Returns a Three.Vector3.
 */
export function latLngToECEF(latDeg, lngDeg, altMeters = 0) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lng = THREE.MathUtils.degToRad(lngDeg);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  return new THREE.Vector3(
    (N + altMeters) * cosLat * Math.cos(lng),
    (N + altMeters) * cosLat * Math.sin(lng),
    (N * (1 - WGS84_E2) + altMeters) * sinLat
  );
}

/** Approximate CONUS center (lat 39.5, lng -98.35). */
export const CONUS_CENTER_LAT = 39.5;
export const CONUS_CENTER_LNG = -98.35;

/**
 * Local north direction (unit vector) at a lat/lng point on the WGS84 ellipsoid.
 * In ECEF coordinates: north = derivative of position w.r.t. latitude (normalized).
 *   north = (-sinLat * cosLng, -sinLat * sinLng, cosLat)
 */
export function localNorth(latDeg, lngDeg) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lng = THREE.MathUtils.degToRad(lngDeg);
  return new THREE.Vector3(
    -Math.sin(lat) * Math.cos(lng),
    -Math.sin(lat) * Math.sin(lng),
    Math.cos(lat)
  );
}

/** Surface normal (outward, "up" in ENU frame) at a lat/lng. */
export function surfaceNormal(latDeg, lngDeg) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lng = THREE.MathUtils.degToRad(lngDeg);
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lng),
    Math.cos(lat) * Math.sin(lng),
    Math.sin(lat)
  );
}
