/* HD-2D 畫質樣本：3D 方塊地形（GPT 材質）＋ 2D 角色與植物看板（GPT 繪製）
 * 1 格 = 1 公尺。x 向右，z 朝鏡頭。地面高度：河床 0、地面 1、高台 2、後方台地 3。
 */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { HorizontalTiltShiftShader } from "three/addons/shaders/HorizontalTiltShiftShader.js";
import { VerticalTiltShiftShader } from "three/addons/shaders/VerticalTiltShiftShader.js";

const MAN = window.HD2_ART || {};
const $ = (id) => document.getElementById(id);

/* ================= 地圖 ================= */
const MAP = [
  "UUUUUUUUUUUUUUUUUUUUUUUUUUUUUU",
  "UUUUUUUUUUUUUUUUUUUUUUUUUUUUUU",
  "UUUUUUUUUUUUUUUUUUUUUUUUUUUUUU",
  "UUUUUUUUUUUUUUUUUUUUUUUUUUUUUU",
  "..BBBBBB........wwww######SS##",
  "..BBBBBB........wwww##########",
  "..BBBBBB........wwww##########",
  "..BBBBBB........wwww##########",
  "..cccccc........wwww#####T####",
  ".cccccccc.......wwww##########",
  "....,,..........wwww##########",
  "....,,..........wwww##########",
  "....,,..........wwww##########",
  "....,,..........wwww####ss####",
  "....,,..........wwww....,,....",
  "....,,,,,,,,,,,,bbbb,,,,,,....",
  "....,,..........wwww..........",
  "....,,..........wwww..........",
  "....,,..........wwww..........",
  "....,,..........wwww..........",
  "....,,..........wwww..........",
  "....,,..........wwww..........",
  "....,,..........wwww..........",
  "....,,..........wwww..........",
];
const MW = MAP[0].length, MH = MAP.length;
const BASE_H = { ".": 1, ",": 1, c: 1, B: 1, T: 1, "#": 2, U: 3, w: 0, b: 0, s: 1, S: 2, F: 1, V: 3 };
BASE_H.T = 2;
// 地圖外圍再鋪一圈森林（看得到、走不進去），畫面邊緣就不會是空的
const PADX = 10, PADZ = 8;
const tileAt = (x, z) => {
  if (x < -PADX || x >= MW + PADX || z < -2 || z >= MH + PADZ) return null;
  if (x >= 0 && x < MW && z >= 0 && z < MH) return MAP[z][x];
  if (z < 4) return "V";
  if (z >= MH && x >= 16 && x < 20) return "w";
  return "F";
};
const colH = (x, z) => { const t = tileAt(x, z); return t == null ? -1 : BASE_H[t]; };
const WATER_Y = 0.55;
const solid = new Set();                                    // 有障礙物的格子 "x,z"
// 連續位置的地面高度（樓梯是斜坡：往 -z 走變高）
function groundAt(px, pz) {
  const x = Math.floor(px), z = Math.floor(pz), t = tileAt(x, z);
  if (t == null) return null;
  if (t === "s" || t === "S") return BASE_H[t] + 0.25 * (1 + Math.min(3, Math.floor((1 - (pz - z)) * 4)));  // 跟石階一階一階的高度一致
  if (t === "b") return 1.02;
  return BASE_H[t];
}
// 河中的踏石：頂面高 1 m，跟河岸一樣高，要用跳的過去
// 河裡的大石頭：都能踩。[x, z, 半徑, 頂面高]
// 過河那組：岸 → A（走著跳就到）→ B（間隔 1.6 m，要跑起來跳）→ 對岸
const STONES = [[16.85, 19.3, 0.45, 0.95], [19.4, 19.2, 0.45, 0.95], [16.75, 8.6, 0.5, 0.85], [19.2, 11.6, 0.45, 0.9],
  [16.8, 12.9, 0.4, 0.8], [18.3, 22.4, 0.5, 0.9], [17.4, 15.2 - 1.6, 0.35, 0.75]].map(([x, z, r, top]) => ({ x, z, r, top }));
function stoneAt(px, pz) { return STONES.find((s) => Math.hypot(px - s.x, pz - s.z) < s.r) || null; }
// 腳下可以站的面：踏石 > 地面；河面（沒有踏石）回傳 water
function surfaceAt(px, pz) {
  const st = stoneAt(px, pz); if (st) return { y: st.top, water: false };
  const t = tileAt(Math.floor(px), Math.floor(pz));
  if (t === "w") return { y: WATER_Y, water: true };
  const g = groundAt(px, pz); return g == null ? null : { y: g, water: false };
}
function blocked(px, pz) {
  const x = Math.floor(px), z = Math.floor(pz), t = tileAt(x, z);
  return t == null || t === "B" || t === "T" || t === "F" || t === "V" || solid.has(x + "," + z);
}
function walkable(px, pz) {
  const x = Math.floor(px), z = Math.floor(pz), t = tileAt(x, z);
  if (t == null || t === "w" || t === "B" || t === "T" || t === "F" || t === "V") return false;
  return !solid.has(x + "," + z);
}

/* ================= 渲染器 ================= */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const FOG = new THREE.Color("#cfc2a0");
scene.fog = new THREE.Fog(FOG, 28, 60);
scene.background = new THREE.Color("#a9c3c8");
const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 120);

/* ---------- 光 ---------- */
const sun = new THREE.DirectionalLight("#ffd9a3", 2.6);
sun.position.set(-9, 16, -7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight("#cfe3ff", "#5b4b30", 0.75));
scene.add(new THREE.AmbientLight("#ffe7c4", 0.18));

/* ================= 素材 ================= */
const TEX = {}, loader = new THREE.TextureLoader();
function noiseTex(c1, c2, seed) {                           // 沒有 GPT 材質時的替代
  const cv = document.createElement("canvas"); cv.width = cv.height = 128; const g = cv.getContext("2d");
  g.fillStyle = c1; g.fillRect(0, 0, 128, 128);
  let s = seed; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 900; i++) { g.fillStyle = c2; g.globalAlpha = rnd() * 0.5; g.fillRect(rnd() * 128, rnd() * 128, 2 + rnd() * 5, 2 + rnd() * 5); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const FALLBACK = { tex_grass: ["#6f8f3a", "#a7c25a"], tex_dirt: ["#8a6a45", "#5b4430"], tex_wall: ["#8b877a", "#5f5b50"], tex_cobble: ["#7d7b6e", "#9c9a8c"], tex_wood: ["#7a5532", "#4e341c"], tex_metal: ["#8a4a2a", "#5c3a28"] };
function loadAll() {
  const keys = Object.keys(MAN);
  return Promise.all(keys.map((k) => new Promise((res) => {
    loader.load("art/" + k + (MAN[k].jpg ? ".jpg" : ".png"), (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; TEX[k] = t; res(); }, undefined, () => res());
  })));
}
function tiled(k) {
  const t = TEX[k] || noiseTex(FALLBACK[k][0], FALLBACK[k][1], k.length * 77);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ================= 地形（自己組網格：只畫看得到的面） ================= */
function buildTerrain() {
  const groups = { grass: [], dirt: [], cobble: [], bed: [], wall: [] };
  const push = (arr, v, uv, col) => arr.push({ v, uv, col });
  function quad(key, p, uvs, shade) {
    const c = shade == null ? 1 : shade;
    push(groups[key], p, uvs, c);
  }
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const S = 0.5;                                             // 材質每 2 格重複
  for (let z = -2; z < MH + PADZ; z++) for (let x = -PADX; x < MW + PADX; x++) {
    const t = tileAt(x, z), h = BASE_H[t];
    const top = t === "w" || t === "b" ? "bed" : t === "," ? "dirt" : (t === "c" || t === "B" || t === "T") ? "cobble" : "grass";
    if (t !== "s" && t !== "S") {
      quad(top, [[x, h, z + 1], [x + 1, h, z + 1], [x + 1, h, z], [x, h, z]], [[x * S, -(z + 1) * S], [(x + 1) * S, -(z + 1) * S], [(x + 1) * S, -z * S], [x * S, -z * S]], 0.86 + rnd() * 0.2);
    }
    // 四面側牆：鄰格比較低才畫
    const sides = [[0, 1, [x, z + 1], [x + 1, z + 1]], [1, 0, [x + 1, z + 1], [x + 1, z]], [0, -1, [x + 1, z], [x, z]], [-1, 0, [x, z], [x, z + 1]]];
    for (const [dx, dz, a, b] of sides) {
      let nh = colH(x + dx, z + dz);
      const nt = tileAt(x + dx, z + dz);
      if (nt === "s" || nt === "S") nh = BASE_H[nt];
      if (nh >= h) continue;
      const lo = nh < 0 ? -1.2 : nh, along = (dx !== 0 ? a[1] : a[0]) * S, along2 = (dx !== 0 ? b[1] : b[0]) * S;
      quad("wall", [[a[0], lo, a[1]], [b[0], lo, b[1]], [b[0], h, b[1]], [a[0], h, a[1]]],
        [[along, lo * S], [along2, lo * S], [along2, h * S], [along, h * S]], dz === 1 ? 1 : dx !== 0 ? 0.82 : 0.7);
    }
  }
  const mats = {
    grass: new THREE.MeshStandardMaterial({ map: tiled("tex_grass"), roughness: 0.95, vertexColors: true }),
    dirt: new THREE.MeshStandardMaterial({ map: tiled("tex_dirt"), roughness: 1, vertexColors: true }),
    cobble: new THREE.MeshStandardMaterial({ map: tiled("tex_cobble"), roughness: 0.9, vertexColors: true }),
    bed: new THREE.MeshStandardMaterial({ map: tiled("tex_cobble"), color: "#6b7f78", roughness: 0.8, vertexColors: true }),
    wall: new THREE.MeshStandardMaterial({ map: tiled("tex_wall"), roughness: 0.95, vertexColors: true }),
  };
  for (const k in groups) {
    const qs = groups[k]; if (!qs.length) continue;
    const pos = [], uv = [], col = [], idx = [];
    qs.forEach((q, i) => {
      q.v.forEach((p) => pos.push(...p)); q.uv.forEach((u) => uv.push(...u));
      for (let j = 0; j < 4; j++) col.push(q.col, q.col, q.col);
      idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mats[k]); m.receiveShadow = true; m.castShadow = k === "wall";
    scene.add(m);
  }
  // 樓梯：一階一階的石塊
  const stairMat = new THREE.MeshStandardMaterial({ map: tiled("tex_wall"), roughness: 0.95 });
  for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
    const t = MAP[z][x]; if (t !== "s" && t !== "S") continue;
    const b = BASE_H[t];
    for (let i = 0; i < 4; i++) {
      const hh = b + (i + 1) * 0.25, d = 1 - i * 0.25;
      const box = new THREE.Mesh(new THREE.BoxGeometry(1, hh - (b - 1.2), d), stairMat);
      box.position.set(x + 0.5, (hh + (b - 1.2)) / 2, z + d / 2);
      box.castShadow = box.receiveShadow = true; scene.add(box);
    }
  }
}

/* ================= 水 ================= */
const waterU = { t: { value: 0 } };
function buildWater() {
  const mat = new THREE.ShaderMaterial({
    transparent: true, uniforms: waterU,
    vertexShader: `varying vec2 vP; void main(){ vec4 w = modelMatrix*vec4(position,1.); vP = w.xz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float t; varying vec2 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 q = vP*vec2(1.6,0.9) + vec2(0., -t*0.9);
        float a = n(q*2.0) * .6 + n(q*4.3 + 3.1) * .4;
        float b = n(vP*vec2(3.,1.5) + vec2(t*.3, -t*1.4));
        float bank = smoothstep(0., .35, min(vP.x-16., 20.-vP.x));
        vec3 deep = vec3(.06,.33,.36), shal = vec3(.30,.70,.68);
        vec3 c = mix(shal, deep, bank*.8) + a*.10;
        float spark = pow(max(0., b*a), 6.) * 9.;
        float foam = (1.-bank) * smoothstep(.45,.75,a) * .6;
        c += vec3(1.,.95,.8) * spark + foam;
        gl_FragColor = vec4(c, .82 - bank*.05);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const g = new THREE.PlaneGeometry(4, MH + PADZ - 4); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.set(18, WATER_Y, 4 + (MH + PADZ - 4) / 2); scene.add(m);
  // 瀑布
  const wf = new THREE.ShaderMaterial({
    transparent: true, uniforms: waterU, depthWrite: false,
    vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float t; varying vec2 vU;
      float h(float x){ return fract(sin(x*91.3)*4375.5); }
      void main(){
        float col = floor(vU.x*38.);
        float s = fract(vU.y*2.5 + t*(1.6 + h(col)*.8) + h(col)*7.);
        float streak = smoothstep(.0,.5,s) * (.55 + h(col+1.)*.45);
        float edge = smoothstep(0.,.12,vU.x)*smoothstep(1.,.88,vU.x);
        vec3 c = mix(vec3(.45,.78,.80), vec3(1.), streak*.8);
        gl_FragColor = vec4(c*1.15, (.55 + streak*.4)*edge);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const wg = new THREE.PlaneGeometry(3.6, 3 - WATER_Y + 0.1);
  const wm = new THREE.Mesh(wg, wf); wm.position.set(18, (3 + WATER_Y) / 2, 4.02); scene.add(wm);
}

/* ================= 物件 ================= */
function woodMat() { const t = tiled("tex_wood").clone(); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }); }
let wheel;
function buildWheel() {
  const m = woodMat(), iron = new THREE.MeshStandardMaterial({ color: "#5b4636", roughness: 0.6, metalness: 0.4 });
  wheel = new THREE.Group();
  const R = 1.25;
  for (const zz of [-0.22, 0.22]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.07, 8, 40), m); ring.position.z = zz; wheel.add(ring);
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(R * 2, 0.08, 0.08), m); sp.rotation.z = i * Math.PI / 8 * 2 / 2 * 1; sp.rotation.z = i * Math.PI / 8; sp.position.z = zz; wheel.add(sp);
    }
  }
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.5), m);
    p.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); p.rotation.z = a; wheel.add(p);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 12), iron); hub.rotation.x = Math.PI / 2; wheel.add(hub);
  wheel.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  wheel.position.set(21.6, 2 + R - 0.15, 4.5);
  scene.add(wheel);
  // 支架與水槽
  for (const dz of [-0.45, 0.45]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.6, 0.14), m); leg.position.set(21.6, 2.8, 4.5 + dz); leg.castShadow = true; scene.add(leg);
  }
  const chute = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.5), m); chute.position.set(20.9, 3.05, 4.3); chute.rotation.z = -0.12; chute.castShadow = true; scene.add(chute);
}
function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m;
}
const lights = [];
function buildHouse() {
  const wt = tiled("tex_wall").clone(); wt.repeat.set(3, 1.3); wt.needsUpdate = true;
  const wall = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.95 });
  const mt = tiled("tex_metal").clone(); mt.repeat.set(3, 1.5); mt.needsUpdate = true;
  const metal = new THREE.MeshStandardMaterial({ map: mt, roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide });
  box(6, 2.6, 3.8, wall, 5, 1 + 1.3, 6);                       // 主體
  box(6.1, 0.25, 3.9, wall, 5, 3.7, 6);                         // 二樓樓板
  box(6, 1.4, 3.8, wall, 5, 4.5, 5.6).scale.z = 0.8;            // 二樓（退縮）
  const roof = box(6.6, 0.08, 2.6, metal, 5, 5.45, 6.3); roof.rotation.x = 0.35;
  const aw = box(6.4, 0.06, 1.4, metal, 5, 3.1, 8.4); aw.rotation.x = 0.3;  // 遮雨棚
  for (const x of [2.3, 7.7]) box(0.12, 2.2, 0.12, woodMat(), x, 2.1, 8.95);
  // 窗戶與門：裡面的暖光
  const glow = new THREE.MeshBasicMaterial({ color: "#e0913f" });
  const dark = new THREE.MeshBasicMaterial({ color: "#1c140c" });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.8), glow); door.position.set(4.5, 1.9, 7.91); scene.add(door);
  const frame = woodMat();
  for (const x of [2.8, 6.6]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.9), glow); w.position.set(x, 2.3, 7.91); scene.add(w);
    box(1.25, 0.1, 0.1, frame, x, 2.78, 7.95); box(1.25, 0.1, 0.1, frame, x, 1.82, 7.95);
    box(0.08, 0.9, 0.08, frame, x, 2.3, 7.95); box(1.1, 0.06, 0.06, frame, x, 2.3, 7.95);
  }
  box(1.3, 0.12, 0.12, frame, 4.5, 2.85, 7.95); box(0.12, 1.9, 0.12, frame, 3.92, 1.9, 7.95); box(0.12, 1.9, 0.12, frame, 5.08, 1.9, 7.95);
  for (const x of [3.2, 5, 6.8]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), dark); w.position.set(x, 4.5, 7.12); scene.add(w); }
  const pl = new THREE.PointLight("#ffaa55", 6, 7, 1.6); pl.position.set(4.5, 2.4, 8.6); scene.add(pl); lights.push(pl);
}
function buildBridge() {
  const m = woodMat();
  for (let i = 0; i < 9; i++) { const p = box(0.42, 0.1, 1.05, m, 16.25 + i * 0.44, 0.97, 15.5); p.rotation.z = (i % 3 - 1) * 0.03; }
  for (const x of [16.1, 19.9]) for (const z of [15.0, 16.0]) box(0.14, 0.9, 0.14, m, x, 1.25, z);
  for (const z of [15.0, 16.0]) { const r = box(3.9, 0.06, 0.06, m, 18, 1.55, z); r.rotation.z = 0.02; }
}

/* ================= 看板（GPT 畫的 2D 圖，立在 3D 世界裡） ================= */
const TILT = -0.32;                                           // 往鏡頭傾一點，補俯視造成的壓扁
const planeGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
function billboard(k, x, y, z, height, opt = {}) {
  const t = TEX[k], m = MAN[k];
  const mat = new THREE.MeshBasicMaterial({ map: t || null, color: t ? (opt.tint || "#f2ede4") : "#557a3a", alphaTest: 0.45, side: THREE.DoubleSide, fog: true });
  const mesh = new THREE.Mesh(planeGeo, mat);
  const w = m ? height * m.w / m.h : height * 0.8;
  mesh.scale.set(opt.flip ? -w : w, height, 1);
  mesh.position.set(x, y, z); mesh.rotation.x = opt.flat ? 0 : TILT;
  mesh.castShadow = opt.shadow !== false;
  if (t) mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.45 });
  scene.add(mesh); return mesh;
}
let tablet, tabletGlow;
function buildDeco() {
  let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const block = (x, z) => solid.add(Math.floor(x) + "," + Math.floor(z));
  // 後方台地：樹、藤蔓垂在牆上
  for (let x = 1; x < 30; x += 2.3 + r() * 1.5) { if (x > 15 && x < 23) continue; billboard("deco_tree", x, 3, 2.2 + r() * 1.2, 3.4 + r() * 1.2, { flip: r() > 0.5 }); }
  for (let x = 9; x < 30; x += 1.4 + r() * 1.8) { if (x > 15.5 && x < 22.8) continue; billboard("deco_vines", x, 1.7, 4.01, 1.4, { flat: true, flip: r() > 0.5, shadow: false }); }
  for (let x = 0.5; x < 30; x += 1.8 + r() * 1.6) { if (x > 15 && x < 23) continue; billboard("deco_bush", x, 3, 3.6, 0.9 + r() * 0.4, { flip: r() > 0.5 }); }
  // 房子周圍
  billboard("deco_lantern", 3.1, 1, 9.3, 1.5); solid.add("3,9");
  billboard("deco_barrel", 8.5, 1, 8.6, 0.85); block(8.5, 8.6);
  billboard("deco_crates", 1.2, 1, 8.3, 1.1); block(1.2, 8.3);
  billboard("deco_vines", 2.4, 2.4, 7.95, 1.6, { flat: true, shadow: false });
  // 左岸
  for (let z = 9.3; z < 14.5; z += 1.5) { billboard("deco_fence", 15.2, 1, z, 0.8); block(15.2, z); }
  for (let z = 16.5; z < 24; z += 1.5) { if (z > 17.8 && z < 20.6) continue; billboard("deco_fence", 15.2, 1, z, 0.8); block(15.2, z); }
  // 踏石（3D 石柱）
  const rt = tiled("tex_wall").clone(); rt.repeat.set(1.5, 1.5); rt.needsUpdate = true;
  const stMat = new THREE.MeshStandardMaterial({ map: rt, color: "#b8b4a6", roughness: 0.9, flatShading: true });
  const mossMat = new THREE.MeshStandardMaterial({ map: tiled("tex_grass"), roughness: 1, flatShading: true });
  STONES.forEach((st, k) => {
    // 圓滾的大石頭：二十面體壓扁、表面隨機凹凸，頂面削平好站
    const g = new THREE.IcosahedronGeometry(1, 2), pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), n = 1 + 0.12 * Math.sin(x * 5.1 + k) * Math.cos(z * 4.3 - k) + 0.06 * Math.sin(y * 7 + k * 2);
      pa.setXYZ(i, x * n, Math.min(y * n, 0.78), z * n);
    }
    g.computeVertexNormals();
    const hgt = st.top + 0.15, c = new THREE.Mesh(g, stMat);
    c.scale.set(st.r * 1.25, hgt / 1.78, st.r * 1.15); c.position.set(st.x, st.top - 0.78 * hgt / 1.78, st.z);
    c.rotation.y = k * 1.3; c.castShadow = c.receiveShadow = true; scene.add(c);
    const moss = new THREE.Mesh(new THREE.CircleGeometry(st.r * 0.8, 12), mossMat); moss.rotation.x = -Math.PI / 2; moss.position.set(st.x, st.top + 0.005, st.z); moss.receiveShadow = true; scene.add(moss);
  });
  // 河裡的石頭

  // 植物撒在地面
  const kinds = ["deco_fern", "deco_grass", "deco_flowers", "deco_bush"];
  for (let i = 0; i < 70; i++) {
    const x = r() * MW, z = 4 + r() * (MH - 4), t = tileAt(Math.floor(x), Math.floor(z));
    if (!t || "w b B , c s S T".split(" ").includes(t)) continue;
    if (Math.abs(x - 5) < 1.5 && z > 9 && z < 13) continue;
    const k = kinds[Math.floor(r() * kinds.length)], h = k === "deco_bush" ? 0.8 + r() * 0.4 : 0.45 + r() * 0.35;
    billboard(k, x, groundAt(x, z), z, h, { flip: r() > 0.5, shadow: k === "deco_bush" });
  }
  for (const [x, z] of [[22.5, 9.5], [27.5, 6.5], [21, 12.5], [28.2, 11.8]]) { billboard("deco_tree", x, 2, z, 3.2, { flip: r() > 0.5 }); block(x, z); }
  // 外圍森林
  for (let i = 0; i < 260; i++) {
    const x = -PADX + r() * (MW + 2 * PADX), z = 4 + r() * (MH + PADZ - 4), t = tileAt(Math.floor(x), Math.floor(z));
    if (t !== "F") continue;
    const big = r() > 0.35; billboard(big ? "deco_tree" : "deco_bush", x, 1, z, big ? 2.6 + r() * 1.6 : 0.9 + r() * 0.5, { flip: r() > 0.5 });
  }
  for (let x = -PADX; x < MW + PADX; x += 2 + r() * 1.5) { if (x >= 0 && x < MW) continue; billboard("deco_tree", x, 3, 1 + r() * 2.5, 3.2 + r() * 1.4, { flip: r() > 0.5 }); }
  // 謎團石碑
  tablet = billboard("deco_tablet", 25.5, 2, 8.6, 1.5);
  const gl = new THREE.PointLight("#5ff6e6", 3, 5, 1.5); gl.position.set(25.5, 3, 9.4); scene.add(gl); lights.push(gl); tabletGlow = gl;
}

/* ================= 粒子：陽光裡的灰塵、螢火蟲 ================= */
function dotTex() {
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
let dust, flies, rays = [];
function buildFX() {
  const n = 260, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { p[i * 3] = Math.random() * MW; p[i * 3 + 1] = 1 + Math.random() * 5; p[i * 3 + 2] = 3 + Math.random() * (MH - 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  dust = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.09, map: dotTex(), color: "#ffe9b8", transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);
  const m = 40, q = new Float32Array(m * 3);
  for (let i = 0; i < m; i++) { q[i * 3] = 15 + Math.random() * 6; q[i * 3 + 1] = 0.8 + Math.random() * 1.2; q[i * 3 + 2] = 5 + Math.random() * 18; }
  const g2 = new THREE.BufferGeometry(); g2.setAttribute("position", new THREE.BufferAttribute(q, 3));
  flies = new THREE.Points(g2, new THREE.PointsMaterial({ size: 0.16, map: dotTex(), color: "#c8ffb0", transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(flies);
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(40 * 3), 3));
  splashPts = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.14, map: dotTex(), color: "#e8fbff", transparent: true, depthWrite: false }));
  splashPts.visible = false; scene.add(splashPts);
  // 光束：幾片疊加的漸層板，沿著陽光方向
  const c = document.createElement("canvas"); c.width = 16; c.height = 256; const gg = c.getContext("2d");
  const gr = gg.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "rgba(255,220,160,0)"); gr.addColorStop(0.25, "rgba(255,220,160,.9)"); gr.addColorStop(1, "rgba(255,220,160,0)");
  gg.fillStyle = gr; gg.fillRect(0, 0, 16, 256);
  const rt = new THREE.CanvasTexture(c);
  const dir = sun.position.clone().normalize();
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.MeshBasicMaterial({ map: rt, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.8 + Math.random() * 1.6, 16), mat);
    pl.position.set(3 + i * 4.5 + Math.random() * 2, 6, 6 + Math.random() * 6);
    pl.lookAt(pl.position.clone().add(new THREE.Vector3(0, 0, 1)));
    pl.rotation.z = Math.atan2(dir.x, dir.y) * 0.9; pl.rotation.x = -0.5;
    pl.userData.ph = Math.random() * 6; scene.add(pl); rays.push(pl);
  }
}

/* ---------- 水花 ---------- */
let splashPts, splashV = [], splashT = 0;
function splash(x, z) {
  const n = 40, p = splashPts.geometry.attributes.position;
  splashV = [];
  for (let i = 0; i < n; i++) { p.setXYZ(i, x, WATER_Y, z); const a = Math.random() * 6.28, r = 0.6 + Math.random() * 1.6; splashV.push([Math.cos(a) * r, 2 + Math.random() * 2.5, Math.sin(a) * r]); }
  p.needsUpdate = true; splashT = 1; splashPts.visible = true;
}
function stepSplash(dt) {
  if (!splashPts || splashT <= 0) return;
  splashT -= dt; const p = splashPts.geometry.attributes.position;
  for (let i = 0; i < splashV.length; i++) { const v = splashV[i]; v[1] -= 9.8 * dt; p.setXYZ(i, p.getX(i) + v[0] * dt, Math.max(WATER_Y, p.getY(i) + v[1] * dt), p.getZ(i) + v[2] * dt); }
  p.needsUpdate = true; splashPts.material.opacity = Math.max(0, splashT); if (splashT <= 0) splashPts.visible = false;
}

/* ================= 主角 ================= */
const KID_H = 1.55;
const kid = { x: 5, z: 12.5, y: 1, vy: 0, vx: 0, vz: 0, run: false, takeoff: 0, air: false, dir: "down", flip: false, t: 0, moving: false, safe: { x: 5, z: 12.5 }, sinkT: 0 };
// 跳躍：真實的自由落體（g = 9.8 m/s²），起跳速度讓最高點 = 0.6 m（一般人原地跳的高度）
// 跳躍手感：重力比真實大、起跳快、落下快（按住久跳得高，輕點跳得低）
const G = 26, JUMP_H = 0.8, JUMP_V = Math.sqrt(2 * G * JUMP_H);
const WALK = 2.3, RUN = 5.2;                                   // 走路、跑步速度（m/s）
let jumpBuf = 0, coyote = 0, jumpHeld = false;
function jump() { jumpBuf = 0.12; jumpHeld = true; }
function jumpRelease() { jumpHeld = false; if (kid.air && kid.vy > 0) kid.vy *= 0.45; }
let kidMesh, kidShadow;
function buildKid() {
  const mat = new THREE.MeshBasicMaterial({ map: TEX.kid_down_idle || null, color: TEX.kid_down_idle ? "#ffffff" : "#d0643a", alphaTest: 0.45, side: THREE.DoubleSide });
  kidMesh = new THREE.Mesh(planeGeo, mat); kidMesh.rotation.x = TILT; kidMesh.castShadow = true;
  if (TEX.kid_down_idle) kidMesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: TEX.kid_down_idle, alphaTest: 0.45 });
  scene.add(kidMesh);
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  kidShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  kidShadow.rotation.x = -Math.PI / 2; scene.add(kidShadow);
}
function setKidFrame(name) {
  const t = TEX[name], m = MAN[name], ref = MAN.kid_down_idle;
  if (!t || !m || !ref) return;
  if (kidMesh.material.map !== t) { kidMesh.material.map = t; kidMesh.material.needsUpdate = true; kidMesh.customDepthMaterial.map = t; kidMesh.customDepthMaterial.needsUpdate = true; }
  const h = KID_H * m.h / ref.h, w = h * m.w / m.h;
  kidMesh.scale.set(kid.flip ? -w : w, h, 1);
}

/* ================= 輸入 ================= */
const keys = {}, joy = { on: false, x: 0, y: 0, ox: 0, oy: 0, id: null };
let lastInput = "touch";
addEventListener("keydown", (e) => { lastInput = "key"; keys[e.key.toLowerCase()] = true; if (e.code === "Space") { e.preventDefault(); if (!e.repeat) jump(); } });
addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; if (e.code === "Space") jumpRelease(); });
const stick = $("stick"), knob = $("knob");
renderer.domElement.addEventListener("pointerdown", (e) => {
  lastInput = "touch"; joy.on = true; joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0;
  stick.style.display = "block"; stick.style.left = e.clientX + "px"; stick.style.top = e.clientY + "px"; knob.style.transform = "";
});
addEventListener("pointermove", (e) => {
  if (!joy.on || e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const d = Math.hypot(dx, dy), M = 45;
  if (d > M) { dx *= M / d; dy *= M / d; }
  joy.x = dx / M; joy.y = dy / M; knob.style.transform = `translate(${dx}px,${dy}px)`;
});
const endJoy = (e) => { if (e.pointerId !== joy.id) return; joy.on = false; joy.x = joy.y = 0; stick.style.display = "none"; };
addEventListener("pointerup", endJoy); addEventListener("pointercancel", endJoy);
let FX = true;
$("fx").addEventListener("pointerdown", (e) => e.stopPropagation());
$("jump").addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); lastInput = "touch"; jump(); $("jump").classList.add("down"); });
const jumpUp = () => { if ($("jump").classList.contains("down")) { $("jump").classList.remove("down"); jumpRelease(); } };
addEventListener("pointerup", jumpUp); addEventListener("pointercancel", jumpUp);
$("fx").onclick = () => { FX = !FX; $("fx").textContent = "特效：" + (FX ? "開" : "關"); };

/* ================= 字幕與事件 ================= */
let subT;
function say(t, sec) { const el = $("sub"); el.textContent = t; el.classList.add("on"); clearTimeout(subT); subT = setTimeout(() => el.classList.remove("on"), sec * 1000); }
let seen = false;
function events() {
  if (!seen && Math.hypot(kid.x - 25.5, kid.z - 9.6) < 1.3) {
    seen = true; say("這塊石碑……上面的符號在發光？", 3);
    setTimeout(() => say("三百年前的人，到底想留下什麼？", 3.5), 3200);
  }
}

/* ================= 更新 ================= */
const clock = { last: performance.now() / 1000, elapsedTime: 0, getDelta() { const n = performance.now() / 1000, d = n - this.last; this.last = n; this.elapsedTime += d; return d; } };
function update(dt, t) {
  let ix = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0) + joy.x;
  let iz = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0) + joy.y;
  let len = Math.hypot(ix, iz);
  if (len > 1) { ix /= len; iz /= len; len = 1; }
  // 跑步：搖桿推到底（超過 75%）或按住 Shift；輕推＝走路
  const wantRun = keys.shift || (joy.on && len > 0.75);
  const live = kid.sinkT <= 0;
  if (!kid.air && live) {
    kid.run = wantRun && len > 0.2;
    const spd = len > 0.2 ? (kid.run ? RUN : WALK) : 0, tx = len > 0.2 ? ix / len * spd : 0, tz = len > 0.2 ? iz / len * spd : 0;
    const k = Math.min(1, dt * 14);                                     // 起步、停下很快，但不是瞬間
    kid.vx += (tx - kid.vx) * k; kid.vz += (tz - kid.vz) * k;
  } else if (kid.air && len > 0.2) {                                   // 空中只能微調方向，不能加速
    const cur = Math.hypot(kid.vx, kid.vz), cap = Math.max(cur, WALK * 0.6);
    kid.vx += ix * 6 * dt; kid.vz += iz * 6 * dt;
    const nv = Math.hypot(kid.vx, kid.vz); if (nv > cap) { kid.vx *= cap / nv; kid.vz *= cap / nv; }
  }
  if (!live) { kid.vx = kid.vz = 0; }
  const spdNow = Math.hypot(kid.vx, kid.vz);
  kid.moving = spdNow > 0.25 && !kid.air;
  // 碰撞：牆、障礙物用「身體寬度」判斷（避免圖卡進牆）；河水只看腳的位置
  const BX = 0.32, BZN = 0.24, BZS = 0.1;
  const ok = (nx, nz) => {
    const ax = nx + Math.sign(nx - kid.x) * BX, az = nz + (nz < kid.z ? -BZN : nz > kid.z ? BZS : 0);
    if (blocked(ax, az) || blocked(nx, nz) || blocked(ax, nz) || blocked(nx, az)) return false;
    const sf = surfaceAt(nx, nz); if (!sf) return false;
    const wallH = Math.max(...[surfaceAt(ax, az), surfaceAt(ax, nz), surfaceAt(nx, az)].map((q) => (q && !q.water ? q.y : -9)));
    if (kid.air) return Math.max(sf.water ? 0 : sf.y, wallH) <= kid.y + 0.05;
    if (sf.water) return false;                                         // 走路不會自己走進河裡（要跳）
    if (wallH > Math.max(kid.y, sf.y) + 0.4) return false;              // 前面的牆太高（石階一階 0.25 m 可以上）
    return Math.abs(sf.y - kid.y) < 0.4;
  };
  if (spdNow > 0.01) {
    const dx = kid.vx * dt, dz = kid.vz * dt;
    if (ok(kid.x + dx, kid.z)) kid.x += dx; else kid.vx = 0;
    if (ok(kid.x, kid.z + dz)) kid.z += dz; else kid.vz = 0;
    if (len > 0.2 || kid.air) {
      const fx = kid.air ? kid.vx : ix, fz = kid.air ? kid.vz : iz;
      if (Math.abs(fx) > Math.abs(fz) * 0.9) { kid.dir = "side"; kid.flip = fx < 0; } else { kid.dir = fz < 0 ? "up" : "down"; kid.flip = false; }
    }
    kid.t += dt * (kid.run ? 1.6 : 1);
  } else kid.t = 0;
  const sf = surfaceAt(kid.x, kid.z) || { y: kid.y, water: false };
  // 起跳（預先按、剛走出邊緣 0.1 秒內都算）
  jumpBuf -= dt; coyote = kid.air ? coyote - dt : 0.1;
  if (jumpBuf > 0 && coyote > 0 && live) {
    kid.vy = JUMP_V * (jumpHeld ? 1 : 0.7); kid.air = true; jumpBuf = 0; coyote = 0; kid.takeoff = spdNow;
  }
  if (kid.sinkT > 0) {                                                  // 掉進河裡：沉下去，再回到上一個站穩的位置
    kid.sinkT -= dt; kid.y -= dt * 1.2;
    if (kid.sinkT <= 0) { kid.x = kid.safe.x; kid.z = kid.safe.z; kid.y = surfaceAt(kid.x, kid.z).y; kid.air = false; kid.vy = 0; }
  } else if (kid.air) {
    kid.vy -= G * dt; kid.y += kid.vy * dt;
    if (kid.y <= sf.y && kid.vy <= 0) {
      kid.y = sf.y; kid.air = false; kid.vy = 0;
      if (sf.water) {
        kid.sinkT = 0.9; splash(kid.x, kid.z);
        const tip = kid.takeoff < (WALK + RUN) / 2 ? (lastInput === "key" ? "走著跳不夠遠，按住 Shift 跑起來再跳！" : "走著跳不夠遠，把搖桿推到底跑起來再跳！") : "撲通！差一點……";
        say(tip, 2.6);
      }
    }
  } else {
    if (sf.y < kid.y - 0.3) { kid.air = true; kid.vy = 0; kid.takeoff = spdNow; }   // 走出邊緣就往下掉
    else kid.y += (sf.y - kid.y) * Math.min(1, dt * 14);
    if (!sf.water && !stoneAt(kid.x, kid.z)) kid.safe = { x: kid.x, z: kid.z };
  }
  const seq = ["a", "idle", "b", "idle"];
  setKidFrame("kid_" + kid.dir + "_" + (kid.air ? "a" : kid.moving ? seq[Math.floor(kid.t * 8) % 4] : "idle"));
  kidMesh.rotation.z = kid.run && kid.moving && kid.dir === "side" ? (kid.flip ? 0.08 : -0.08) : 0;   // 跑步身體前傾
  kidMesh.position.set(kid.x, kid.y + (kid.moving && !kid.air ? Math.abs(Math.sin(kid.t * 12.5)) * 0.03 : 0), kid.z);
  const fl = sf.y, up = Math.max(0, kid.y - fl), ss = 1 / (1 + up * 1.2);
  kidShadow.position.set(kid.x, fl + 0.02, kid.z + 0.05); kidShadow.scale.set(ss, ss, 1); kidShadow.material.opacity = ss;
  kidShadow.visible = kid.sinkT <= 0;
  stepSplash(dt);
  events();
  // 動畫
  waterU.t.value = t;
  if (wheel) wheel.rotation.z = -t * 0.6;
  lights[0] && (lights[0].intensity = 5.5 + Math.sin(t * 13) * 0.4 + Math.sin(t * 7.3) * 0.5);
  if (tabletGlow) tabletGlow.intensity = 2.2 + Math.sin(t * 2.2) * 1.4 + (seen ? 1.5 : 0);
  const dp = dust.geometry.attributes.position;
  for (let i = 0; i < dp.count; i++) { dp.array[i * 3 + 1] += Math.sin(t * 0.7 + i) * 0.002; dp.array[i * 3] += 0.003; if (dp.array[i * 3] > MW) dp.array[i * 3] = 0; }
  dp.needsUpdate = true;
  const fp = flies.geometry.attributes.position;
  for (let i = 0; i < fp.count; i++) { fp.array[i * 3] += Math.sin(t * 0.9 + i * 2.1) * 0.006; fp.array[i * 3 + 1] += Math.cos(t * 1.3 + i) * 0.004; fp.array[i * 3 + 2] += Math.cos(t * 0.6 + i * 1.7) * 0.006; }
  fp.needsUpdate = true; flies.material.opacity = 0.55 + Math.sin(t * 3) * 0.35;
  rays.forEach((r) => { r.material.opacity = FX ? 0.07 + 0.06 * Math.sin(t * 0.5 + r.userData.ph) : 0; });
  dust.visible = flies.visible = FX;
  // 鏡頭跟著主角
  const asp = innerWidth / innerHeight, dist = asp < 1 ? 22 / Math.max(asp, 0.5) * 0.55 : 22;
  const target = new THREE.Vector3(THREE.MathUtils.clamp(kid.x, 6, MW - 6), kid.y * 0.6 + 0.6, THREE.MathUtils.clamp(kid.z, 6, MH - 4));
  camPos.lerp(target.clone().add(new THREE.Vector3(0, dist * 0.64, dist * 0.77)), Math.min(1, dt * 3));
  camLook.lerp(target, Math.min(1, dt * 3));
  camera.position.copy(camPos); camera.lookAt(camLook);
  sun.target.position.copy(camLook); sun.position.copy(camLook).add(new THREE.Vector3(-9, 16, -7));
}
const camPos = new THREE.Vector3(5, 12, 24), camLook = new THREE.Vector3(5, 1, 12);

/* ================= 後製：光暈、移軸景深、暗角 ================= */
let composer, tiltH, tiltV;
const GradeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      c.rgb = mix(c.rgb, c.rgb*vec3(1.06,1.0,.9), .6);
      c.rgb = (c.rgb - .5) * 1.06 + .5;
      float v = smoothstep(.95, .35, distance(vUv, vec2(.5,.55)));
      c.rgb *= mix(.62, 1., v);
      gl_FragColor = c; }`,
};
function buildPost() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.55, 0.78));
  composer.addPass(new OutputPass());
  tiltH = new ShaderPass(HorizontalTiltShiftShader); tiltV = new ShaderPass(VerticalTiltShiftShader);
  composer.addPass(tiltH); composer.addPass(tiltV);
  composer.addPass(new ShaderPass(GradeShader));
}
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, quality);
  renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  if (composer) {
    composer.setPixelRatio(dpr); composer.setSize(innerWidth, innerHeight);
    tiltH.uniforms.h.value = 1.7 / innerWidth; tiltV.uniforms.v.value = 1.7 / innerHeight;
    tiltH.uniforms.r.value = tiltV.uniforms.r.value = 0.5;
  }
}
let quality = 1.5;

/* ================= 主迴圈 ================= */
let fN = 0, fT = 0, lowCount = 0;
function frame() {
  const dt = Math.min(0.12, clock.getDelta()), t = clock.elapsedTime;
  const n = Math.ceil(dt / 0.034);                     // 畫面卡的時候也維持正確的物理（分小步算）
  for (let i = 0; i < n; i++) update(dt / n, t);
  if (FX) composer.render(); else renderer.render(scene, camera);
  fN++; fT += dt;
  if (fT > 1) {
    const fps = Math.round(fN / fT); $("fps").textContent = fps + " fps";
    if (fps < 28 && quality > 1) { if (++lowCount >= 2) { quality = 1; resize(); } } else lowCount = 0;
    fN = 0; fT = 0;
  }
  requestAnimationFrame(frame);
}
loadAll().then(() => {
  buildTerrain(); buildWater(); buildWheel(); buildHouse(); buildBridge(); buildDeco(); buildFX(); buildKid(); buildPost();
  resize(); addEventListener("resize", resize);
  const el = $("load"); el.style.opacity = 0; setTimeout(() => el.remove(), 900);
  say("水車終於轉起來了。可是河對岸的高台上，好像有什麼在發光……", 4);
  requestAnimationFrame(frame);
});
window.__hd2 = { kid, jump, setFX: (v) => { FX = v; } };
