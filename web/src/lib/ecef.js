import * as THREE from "three";

const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_B = WGS84_A * (1 - WGS84_F);
const WGS84_E2 = 1 - (WGS84_B * WGS84_B) / (WGS84_A * WGS84_A);

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

// Tangent vector pointing NORTH along the surface (perpendicular to localUp).
export function localNorth(latDeg, lngDeg) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lng = THREE.MathUtils.degToRad(lngDeg);
  return new THREE.Vector3(
    -Math.sin(lat) * Math.cos(lng),
    -Math.sin(lat) * Math.sin(lng),
    Math.cos(lat)
  );
}

// Tangent vector pointing EAST along the surface.
export function localEast(latDeg, lngDeg) {
  const lng = THREE.MathUtils.degToRad(lngDeg);
  return new THREE.Vector3(-Math.sin(lng), Math.cos(lng), 0);
}

// Surface NORMAL — the actual "up" direction from the ground at (lat, lng).
// Points radially outward from Earth's center. Use this for altitude offsets
// and for camera.up so the sky stays at the top of the view.
export function localUp(latDeg, lngDeg) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lng = THREE.MathUtils.degToRad(lngDeg);
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lng),
    Math.cos(lat) * Math.sin(lng),
    Math.sin(lat)
  );
}
