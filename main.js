import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fb8e8);
scene.fog = new THREE.Fog(0x8fb8e8, 400, 4500);
const camera = new THREE.PerspectiveCamera(65, 1, 0.5, 9000);
scene.add(new THREE.HemisphereLight(0xffffff, 0x556677, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(300, 600, 200);
scene.add(sun);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const loader = new GLTFLoader();
function setLoading(p, msg) { $('lfill').style.width = Math.round(p * 100) + '%'; $('lmsg').textContent = msg; }
function loadGLB(url, label, p0, p1) {
  return new Promise((res, rej) => loader.load(url, res,
    (e) => { if (e.total) setLoading(p0 + (p1 - p0) * (e.loaded / e.total), label); },
    () => rej(new Error('Could not load ' + url))));
}

// ---------- ground height grid (built once from the map triangles) ----------
const grid = { w: 0, h: 0, x0: 0, z0: 0, cell: CONFIG.gridCell, data: null };
function buildGrid(mesh) {
  const pos = mesh.geometry.attributes.position, idx = mesh.geometry.index;
  const n = pos.count, W = new Float32Array(n * 3), v = new THREE.Vector3();
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    W[i * 3] = v.x; W[i * 3 + 1] = v.y; W[i * 3 + 2] = v.z;
    if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
    if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z;
  }
  const c = grid.cell;
  grid.x0 = minX; grid.z0 = minZ;
  grid.w = Math.ceil((maxX - minX) / c) + 2; grid.h = Math.ceil((maxZ - minZ) / c) + 2;
  const data = new Float32Array(grid.w * grid.h).fill(-1e9);
  const tris = idx ? idx.count / 3 : n / 3;
  for (let t = 0; t < tris; t++) {
    const a = idx ? idx.getX(t * 3) : t * 3, b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, d = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    const ax = W[a * 3], ay = W[a * 3 + 1], az = W[a * 3 + 2];
    const bx = W[b * 3], by = W[b * 3 + 1], bz = W[b * 3 + 2];
    const cx = W[d * 3], cy = W[d * 3 + 1], cz = W[d * 3 + 2];
    const gx0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - minX) / c)), gx1 = Math.min(grid.w - 1, Math.ceil((Math.max(ax, bx, cx) - minX) / c));
    const gz0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - minZ) / c)), gz1 = Math.min(grid.h - 1, Math.ceil((Math.max(az, bz, cz) - minZ) / c));
    const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(den) < 1e-9) continue;
    for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
      const px = minX + gx * c, pz = minZ + gz * c;
      const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / den;
      const l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / den;
      const l3 = 1 - l1 - l2;
      if (l1 < -0.02 || l2 < -0.02 || l3 < -0.02) continue;
      const y = l1 * ay + l2 * by + l3 * cy, k = gz * grid.w + gx;
      if (y > data[k]) data[k] = y;
    }
  }
  // fill tiny holes inside the island (2 passes); outside stays empty = blocked
  for (let pass = 0; pass < 2; pass++) {
    const copy = data.slice();
    for (let z = 1; z < grid.h - 1; z++) for (let x = 1; x < grid.w - 1; x++) {
      const k = z * grid.w + x;
      if (copy[k] > -1e8) continue;
      let s = 0, m = 0;
      for (const o of [k - 1, k + 1, k - grid.w, k + grid.w]) if (copy[o] > -1e8) { s += copy[o]; m++; }
      if (m >= 3) data[k] = s / m;
    }
  }
  grid.data = data;
}
// returns height in meters, or null if there is no ground here
function groundAt(x, z) {
  const fx = (x - grid.x0) / grid.cell, fz = (z - grid.z0) / grid.cell;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  if (ix < 0 || iz < 0 || ix >= grid.w - 1 || iz >= grid.h - 1) return null;
  const k = iz * grid.w + ix, d = grid.data;
  const h00 = d[k], h10 = d[k + 1], h01 = d[k + grid.w], h11 = d[k + grid.w + 1];
  if (h00 < -1e8 || h10 < -1e8 || h01 < -1e8 || h11 < -1e8) return null;
  const tx = fx - ix, tz = fz - iz;
  return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
}

// ---------- model helper: scales a loaded model to real-world size ----------
function prepModel(gltf, { length, height, yaw }) {
  const inner = gltf.scene, box = new THREE.Box3().setFromObject(inner), size = box.getSize(new THREE.Vector3());
  const target = height ? height : length;
  const s = target / (height ? size.y : Math.max(size.x, size.z));
  inner.scale.setScalar(s);
  inner.rotation.y = THREE.MathUtils.degToRad(yaw || 0);
  const box2 = new THREE.Box3().setFromObject(inner), c = box2.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -box2.min.y, -c.z);
  const g = new THREE.Group(); g.add(inner);
  return g;
}

// ---------- input ----------
const input = { x: 0, y: 0, brake: false, run: false, act: false, keys: {} };
window.addEventListener('keydown', (e) => { input.keys[e.code] = true; if (e.code === 'KeyF') input.act = true; });
window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
const stick = $('stick'), knob = $('knob'); let stickId = null;
function stickMove(e) {
  const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
  const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
  input.x = dx; input.y = -dy;
  knob.style.transform = `translate(${dx * 35}px,${dy * 35}px)`;
}
stick.addEventListener('pointerdown', (e) => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); stickMove(e); });
stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickMove(e); });
const stickEnd = (e) => { if (e.pointerId === stickId) { stickId = null; input.x = input.y = 0; knob.style.transform = ''; } };
stick.addEventListener('pointerup', stickEnd); stick.addEventListener('pointercancel', stickEnd);
$('bAct').addEventListener('pointerdown', () => { input.act = true; });
for (const [id, key] of [['bBrake', 'brake'], ['bRun', 'run']]) {
  const el = $(id);
  el.addEventListener('pointerdown', () => { input[key] = true; });
  el.addEventListener('pointerup', () => { input[key] = false; });
  el.addEventListener('pointercancel', () => { input[key] = false; });
}
let camDrag = null, camYawOffset = 0;
canvas.addEventListener('pointerdown', (e) => { camDrag = { id: e.pointerId, x: e.clientX }; });
canvas.addEventListener('pointermove', (e) => { if (camDrag && e.pointerId === camDrag.id) { camYawOffset -= (e.clientX - camDrag.x) * 0.006; camDrag.x = e.clientX; } });
canvas.addEventListener('pointerup', () => { camDrag = null; });

// ---------- game state ----------
const state = { mode: 'foot', car: null, player: null, carYaw: 0, speed: 0, pYaw: 0, camYaw: 0 };

function tryMove(obj, nx, nz, maxSlope) {
  const h0 = groundAt(obj.position.x, obj.position.z), h1 = groundAt(nx, nz);
  if (h1 === null) return false;
  const dist = Math.hypot(nx - obj.position.x, nz - obj.position.z) || 1e-6;
  if (h0 !== null && (h1 - h0) / dist > maxSlope) return false;
  obj.position.set(nx, h1, nz);
  return true;
}

function update(dt) {
  const k = input.keys;
  const ix = input.x + ((k.KeyD || k.ArrowRight) ? 1 : 0) - ((k.KeyA || k.ArrowLeft) ? 1 : 0);
  const iy = input.y + ((k.KeyW || k.ArrowUp) ? 1 : 0) - ((k.KeyS || k.ArrowDown) ? 1 : 0);
  const brake = input.brake || k.Space, run = input.run || k.ShiftLeft;
  const { car, player } = state;

  if (input.act) {
    input.act = false;
    if (state.mode === 'foot' && player.position.distanceTo(car.position) < 6) {
      state.mode = 'car'; player.visible = false;
    } else if (state.mode === 'car' && Math.abs(state.speed) < 8) {
      state.mode = 'foot'; player.visible = true;
      const side = new THREE.Vector3(Math.cos(state.carYaw), 0, -Math.sin(state.carYaw)).multiplyScalar(3);
      const p = car.position.clone().add(side), h = groundAt(p.x, p.z);
      if (h !== null) player.position.set(p.x, h, p.z); else player.position.copy(car.position);
      state.pYaw = state.carYaw; state.speed = 0;
    }
  }

  if (state.mode === 'car') {
    const c = CONFIG.car_stats;
    if (iy > 0.05) state.speed += iy * c.accel * dt;
    else if (iy < -0.05) state.speed += (state.speed > 0 ? iy * c.brake : iy * c.accel) * dt;
    if (brake) state.speed -= Math.sign(state.speed) * Math.min(Math.abs(state.speed), c.brake * dt);
    state.speed -= state.speed * c.drag * dt;
    state.speed = THREE.MathUtils.clamp(state.speed, -c.reverseMax, c.maxSpeed);
    const steer = THREE.MathUtils.clamp(Math.abs(state.speed) / 6, 0, 1) * Math.sign(state.speed);
    state.carYaw -= ix * c.turn * steer * dt;
    const fx = Math.sin(state.carYaw), fz = Math.cos(state.carYaw);
    if (!tryMove(car, car.position.x + fx * state.speed * dt, car.position.z + fz * state.speed * dt, CONFIG.maxSlope)) state.speed *= -0.2;
    const hf = groundAt(car.position.x + fx * 2, car.position.z + fz * 2), hb = groundAt(car.position.x - fx * 2, car.position.z - fz * 2);
    car.rotation.order = 'YXZ';
    car.rotation.set(0, state.carYaw, 0);
    if (hf !== null && hb !== null) car.rotation.x = -Math.atan2(hf - hb, 4);
    const follow = state.carYaw + Math.PI;
    camYawOffset *= 0.97;
    state.camYaw += (((follow + camYawOffset - state.camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 3);
  } else {
    const sp = run ? CONFIG.foot_stats.run : CONFIG.foot_stats.walk;
    const len = Math.hypot(ix, iy);
    if (len > 0.1) {
      // camera sits behind the player, so "forward" is away from the camera
      const fwdx = -Math.sin(state.camYaw), fwdz = -Math.cos(state.camYaw);
      const rx = -fwdz, rz = fwdx;
      const mx = fwdx * iy + rx * ix, mz = fwdz * iy + rz * ix, ml = Math.hypot(mx, mz) || 1;
      state.pYaw = Math.atan2(mx, mz);
      tryMove(player, player.position.x + (mx / ml) * sp * dt, player.position.z + (mz / ml) * sp * dt, CONFIG.maxSlope);
    }
    player.rotation.y = state.pYaw;
    state.camYaw += camYawOffset; camYawOffset = 0;
  }

  // camera
  const target = state.mode === 'car' ? car : player;
  const dist = state.mode === 'car' ? 9 : 5, up = state.mode === 'car' ? 3.2 : 2.2;
  const cp = new THREE.Vector3(target.position.x + Math.sin(state.camYaw) * dist, target.position.y + up, target.position.z + Math.cos(state.camYaw) * dist);
  const gh = groundAt(cp.x, cp.z); if (gh !== null && cp.y < gh + 1) cp.y = gh + 1;
  camera.position.lerp(cp, Math.min(1, dt * 8));
  camera.lookAt(target.position.x, target.position.y + 1.4, target.position.z);

  $('speed').textContent = Math.round(Math.abs(state.speed) * 3.6) + ' km/h';
  $('hint').textContent = state.mode === 'car' ? 'F: get out (slow down first)' : (player.position.distanceTo(car.position) < 6 ? 'F: get in car' : 'Walk to the car');
  $('bAct').textContent = state.mode === 'car' ? 'EXIT' : 'ENTER';
}

// ---------- start ----------
async function start() {
  try {
    setLoading(0.02, 'Loading map...');
    const mapGltf = await loadGLB(CONFIG.map.url, 'Loading map...', 0.02, 0.7);
    const root = mapGltf.scene; root.scale.setScalar(CONFIG.map.scale); root.updateMatrixWorld(true);
    let mapMesh = null;
    root.traverse((o) => {
      if (o.isMesh) {
        mapMesh = o;
        const tex = o.material.map; if (tex) tex.anisotropy = 4;
        o.material = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
        o.frustumCulled = false;
      }
    });
    if (!mapMesh) throw new Error('No mesh found in the map file');
    scene.add(root);
    setLoading(0.72, 'Building ground...');
    await new Promise((r) => setTimeout(r, 30));
    buildGrid(mapMesh);

    // spawn: lowest map vertex near the chosen spot
    const pos = mapMesh.geometry.attributes.position, S = CONFIG.spawn;
    let best = -1, bz = 1e9;
    for (let i = 0; i < pos.count; i++) {
      if (Math.hypot(pos.getX(i) - S.x, pos.getY(i) - S.y) < S.radius && pos.getZ(i) < bz) { bz = pos.getZ(i); best = i; }
    }
    if (best < 0) throw new Error('Spawn point is not on the map. Edit "spawn" in js/config.js');
    const sp = new THREE.Vector3(pos.getX(best), pos.getY(best), pos.getZ(best)).applyMatrix4(mapMesh.matrixWorld);

    setLoading(0.78, 'Loading car...');
    const carG = prepModel(await loadGLB(CONFIG.car.url, 'Loading car...', 0.78, 0.9), CONFIG.car);
    setLoading(0.9, 'Loading character...');
    const plG = prepModel(await loadGLB(CONFIG.player.url, 'Loading character...', 0.9, 0.99), CONFIG.player);
    scene.add(carG, plG);
    state.car = carG; state.player = plG;
    const h = groundAt(sp.x, sp.z) ?? sp.y;
    carG.position.set(sp.x, h, sp.z);
    const ph = groundAt(sp.x + 4, sp.z) ?? h;
    plG.position.set(sp.x + 4, ph, sp.z);
    state.camYaw = 0;
    camera.position.set(plG.position.x, plG.position.y + 4, plG.position.z + 6);
    $('loading').style.display = 'none';
    let last = performance.now();
    renderer.setAnimationLoop((t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      update(dt); renderer.render(scene, camera);
    });
  } catch (err) {
    setLoading(0, 'ERROR: ' + err.message);
    console.error(err);
  }
}
start();
