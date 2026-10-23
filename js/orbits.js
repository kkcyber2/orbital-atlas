// Orbital mechanics for the scene. Positions are computed from real periods so
// the bodies keep their correct relative arrangement.

export const BODIES = [
  { id: "sun", name: "Sun", radius: 6.0, orbit: 0, period: 0, tilt: 0, colour: [1.0, 0.72, 0.33] },
  { id: "mercury", name: "Mercury", radius: 0.38, orbit: 11, period: 0.241, tilt: 0.03, colour: [0.62, 0.58, 0.54] },
  { id: "venus", name: "Venus", radius: 0.95, orbit: 15, period: 0.615, tilt: 0.05, colour: [0.90, 0.78, 0.55] },
  { id: "earth", name: "Earth", radius: 1.0, orbit: 20, period: 1.0, tilt: 0.09, colour: [0.30, 0.55, 0.85] },
  { id: "mars", name: "Mars", radius: 0.53, orbit: 26, period: 1.881, tilt: 0.10, colour: [0.78, 0.38, 0.24] },
  { id: "jupiter", name: "Jupiter", radius: 3.5, orbit: 38, period: 11.86, tilt: 0.12, colour: [0.80, 0.66, 0.50] },
  { id: "saturn", name: "Saturn", radius: 3.0, orbit: 50, period: 29.46, tilt: 0.14, colour: [0.85, 0.78, 0.60] },
  { id: "uranus", name: "Uranus", radius: 1.8, orbit: 60, period: 84.01, tilt: 0.16, colour: [0.55, 0.80, 0.85] },
  { id: "neptune", name: "Neptune", radius: 1.7, orbit: 70, period: 164.8, tilt: 0.18, colour: [0.35, 0.50, 0.85] },
];

// One Earth year of simulated time per this many seconds of wall clock.
export const SECONDS_PER_YEAR = 12;

// Position of a body at a given simulated time, in scene units.
export function positionAt(body, years) {
  if (!body.period || body.orbit === 0) return [0, 0, 0];
  const angle = (years / body.period) * Math.PI * 2;
  const x = Math.cos(angle) * body.orbit;
  const z = Math.sin(angle) * body.orbit;
  // A small inclination keeps the system from looking like a flat disc.
  const y = Math.sin(angle) * body.orbit * body.tilt;
  return [x, y, z];
}

// Camera path: a slow spiral outward, so scrolling flies you through the system.
export function cameraAt(progress) {
  const t = Math.max(0, Math.min(1, progress));
  const angle = t * Math.PI * 1.6 - Math.PI * 0.3;
  const radius = 8 + t * 62;
  const height = 5 + Math.sin(t * Math.PI) * 16;
  return {
    eye: [Math.cos(angle) * radius, height, Math.sin(angle) * radius],
    target: [Math.cos(angle + 0.5) * radius * 0.35, 0, Math.sin(angle + 0.5) * radius * 0.35],
  };
}

// Which body the camera is nearest, used for the HUD readout.
export function nearestBody(progress) {
  const index = Math.round(Math.max(0, Math.min(1, progress)) * (BODIES.length - 1));
  return BODIES[index];
}

// Distance from the sun in astronomical units, for the readout.
export function distanceAU(progress) {
  const t = Math.max(0, Math.min(1, progress));
  return t * 30.05;
}
