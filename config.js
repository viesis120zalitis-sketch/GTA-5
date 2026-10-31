// All tweakable settings live here. Change numbers here, not in main.js.
export const CONFIG = {
  // Map file: add map_clean.glb to this folder in the repo (see README).
  map: { url: 'assets/maps/map_clean.glb', scale: 5000 },

  // Where you start, in the map's own coordinates (downtown Los Santos).
  spawn: { x: -0.119, y: -0.403, radius: 0.01 },

  // Models already in your repo root. "length"/"height" are real-world meters.
  // "yaw" turns the model if it faces the wrong way (try 90, 180 or -90).
  car:    { url: 'police_car.glb', length: 4.8, yaw: 0 },
  player: { url: 'michael.glb',    height: 1.8, yaw: 0 },

  car_stats: { accel: 14, maxSpeed: 48, reverseMax: 12, brake: 30, drag: 0.35, turn: 1.9 },
  foot_stats: { walk: 5, run: 9 },
  gridCell: 6,        // meters per ground-height cell (smaller = more exact, slower to build)
  maxSlope: 1.4,      // steepest slope you can drive/walk up (1.4 is about 55 degrees)
};
