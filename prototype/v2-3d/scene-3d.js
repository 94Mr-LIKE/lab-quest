/* 版本 2「立體實驗桌」：Three.js r186（MIT）程式建模，不載入任何模型檔。
 * 單指拖曳實驗桌空白處＝轉動視角（有角度限制）；點兩下＝回到預設視角。
 * 單位：1 = 1 公分（示意比例）。 */
import * as THREE from './lib/three.module.min.js';

const MESH_Y = 18.6;            // 陶瓷纖維網上緣
const WATER_H = 6;              // 水深（cm）
const BEAKER_R = 4.4, BEAKER_H = 9.5;

function lathe(points, segs) {
  return new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), segs || 40);
}

export class Scene3D {
  constructor() { this.yaw = -0.35; this.pitch = 0.22; this.t = 0; this.iceT = 0; }

  mount(host) {
    this.host = host;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(r.domElement);
    r.domElement.setAttribute('aria-label', '立體實驗桌，可以拖曳轉動視角');

    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeef3f6);
    this.camera = new THREE.PerspectiveCamera(32, 1, 1, 500);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c4cc, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(20, 40, 30); scene.add(sun);
    this.flameLight = new THREE.PointLight(0xffa040, 0, 40, 1.5); this.flameLight.position.set(0, 12, 0); scene.add(this.flameLight);

    const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .6, metalness: .1 }, o || {}));
    const metal = M(0x8a96a3, { metalness: .5, roughness: .4 });

    // 桌面
    const table = new THREE.Mesh(new THREE.BoxGeometry(70, 2, 34), M(0xe8d8bd, { roughness: .9 }));
    table.position.set(6, -1, 0); scene.add(table);

    // 三腳架＋陶瓷纖維網
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7.2, .45, 8, 40), metal);
    ring.rotation.x = Math.PI / 2; ring.position.y = 17.6; scene.add(ring);
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2 + .5;
      const top = new THREE.Vector3(Math.cos(a) * 7.2, 17.6, Math.sin(a) * 7.2);
      const bot = new THREE.Vector3(Math.cos(a) * 10, 0, Math.sin(a) * 10);
      const len = top.distanceTo(bot);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, len, 8), metal);
      leg.position.copy(top).add(bot).multiplyScalar(.5);
      leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bot).normalize());
      scene.add(leg);
    }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(16, .5, 16), M(0xf2f1ec, { roughness: .95 }));
    mesh.position.y = 18.35; scene.add(mesh);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, .52, 32), M(0xe3cfb2, { roughness: 1 }));
    core.position.y = 18.36; scene.add(core);

    // 鐵架
    const base = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 7), metal); base.position.set(19, .5, 0); scene.add(base);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 44, 12), metal); rod.position.set(19, 22, 0); scene.add(rod);

    // 空位提示
    const slotMat = new THREE.MeshBasicMaterial({ color: 0x2f8f9d, wireframe: true, transparent: true, opacity: .35 });
    this.slotBox = new THREE.Mesh(new THREE.CylinderGeometry(BEAKER_R, BEAKER_R, BEAKER_H, 20, 1, true), slotMat);
    this.slotBox.position.y = MESH_Y + BEAKER_H / 2; scene.add(this.slotBox);
    this.slotLamp = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 7, 16, 1, true), slotMat);
    this.slotLamp.position.y = 3.5; scene.add(this.slotLamp);
    this.slotMat = slotMat;

    // 酒精燈
    const lamp = this.lamp = new THREE.Group();
    lamp.add(new THREE.Mesh(lathe([[0, 0], [3.5, 0], [3.6, .4], [3.2, 3.6], [1.4, 5], [0, 5]]),
      new THREE.MeshStandardMaterial({ color: 0xdff1ff, transparent: true, opacity: .55, roughness: .1 })));
    const fuel = new THREE.Mesh(lathe([[0, .3], [3.2, .3], [3.0, 2.4], [0, 2.4]]), M(0xb7d9ef, { transparent: true, opacity: .6 }));
    lamp.add(fuel);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 1.6, 16), metal); neck.position.y = 5.6; lamp.add(neck);
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, 1.2, 8), M(0x333333)); wick.position.y = 6.9; lamp.add(wick);
    const flame = this.flame = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ConeGeometry(1.15, 5.2, 20), new THREE.MeshBasicMaterial({ color: 0xffa83e, transparent: true, opacity: .85 }));
    outer.position.y = 2.6; flame.add(outer);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(.55, 2.2, 16), new THREE.MeshBasicMaterial({ color: 0x5b8ff5 }));
    inner.position.y = 1.1; flame.add(inner);
    flame.position.y = 7.4; lamp.add(flame);
    scene.add(lamp);

    // 燒杯＋水
    const bk = this.beaker = new THREE.Group();
    bk.position.y = MESH_Y;
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xd9eef8, transparent: true, opacity: .3, roughness: .05, side: THREE.DoubleSide, depthWrite: false });
    bk.add(new THREE.Mesh(lathe([[0, 0], [BEAKER_R, 0], [BEAKER_R + .1, .3], [BEAKER_R + .1, BEAKER_H], [BEAKER_R + .6, BEAKER_H + .4]], 48), glassMat));
    for (let g = 1; g <= 4; g++) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(1.2, .08, .08), M(0x44657c));
      tick.position.set(BEAKER_R * .6, g * 1.8, BEAKER_R * .8); tick.rotation.y = -.6; bk.add(tick);
    }
    const water = this.water = new THREE.Mesh(new THREE.CylinderGeometry(BEAKER_R - .05, BEAKER_R - .05, WATER_H, 40),
      new THREE.MeshStandardMaterial({ color: 0x7cc4e6, transparent: true, opacity: .55, roughness: .15, depthWrite: false }));
    water.position.y = WATER_H / 2 + .05; bk.add(water);
    this.bubbleMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9 }), 24);
    this.bubbleMesh.count = 0; bk.add(this.bubbleMesh);
    this.bubbles = Array.from({ length: 24 }, () => ({ x: 0, y: 0, z: 0, v: 1 }));
    this.ice = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), new THREE.MeshStandardMaterial({ color: 0xf2fbff, transparent: true, opacity: .8 }));
      c.position.set(-1.6 + i * 1.6, WATER_H - .2, (i - 1) * 1.1); c.rotation.set(.3 * i, .5 * i, 0); this.ice.add(c);
    }
    bk.add(this.ice);
    this.steam = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .0, depthWrite: false }));
      p.userData.k = i / 6; this.steam.add(p);
    }
    bk.add(this.steam);
    scene.add(bk);

    // 溫度計＋夾子
    const th = this.thermo = new THREE.Group();
    const tglass = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, 15, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .55, roughness: .1 }));
    tglass.position.y = 7.9; th.add(tglass);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.48, 14, 10), M(0xd64545, { roughness: .3 }));
    bulb.position.y = .45; th.add(bulb);
    this.column = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 1, 8), M(0xd64545, { roughness: .3 }));
    th.add(this.column);
    const arm = this.arm = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 1, 10), metal);
    arm.rotation.z = Math.PI / 2; arm.position.set(8.6, 13.5, 0); th.add(arm);
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), metal); clamp.position.set(0, 13.5, 0); th.add(clamp);
    th.position.set(1.8, MESH_Y + .3, 0);
    scene.add(th);

    // 護目鏡狀態（疊在畫布上的文字）
    this.chip = document.createElement('div');
    this.chip.className = 'chip3d'; this.chip.textContent = '已戴護目鏡';
    host.appendChild(this.chip);

    // 拖曳轉視角
    let drag = null;
    const cv = r.domElement;
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      if (!drag) return;
      this.yaw = Math.max(-1.1, Math.min(1.1, drag.yaw - (e.clientX - drag.x) * .008));
      this.pitch = Math.max(.02, Math.min(.75, drag.pitch + (e.clientY - drag.y) * .006));
    });
    const end = () => { drag = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('dblclick', () => { this.yaw = -.35; this.pitch = .22; });

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
  }

  resize() {
    const w = this.host.clientWidth || 300, h = this.host.clientHeight || 220;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.dist = w / h < 1.2 ? 100 : 78;
  }

  render(s, level, ev) {
    this.beaker.visible = !!s.container;
    this.slotBox.visible = !s.container;
    this.lamp.visible = s.lamp;
    this.slotLamp.visible = !s.lamp;
    this.flame.visible = s.lit;
    this.thermo.visible = s.thermo;
    this.chip.style.display = s.goggles ? '' : 'none';
    this.thermo.position.y = MESH_Y + .3 + s.depth;
    const tx = (BEAKER_R - .55) - s.wall;              // 離杯壁 0 cm＝球部貼著杯壁
    this.thermo.position.x = tx;
    this.arm.scale.y = 19 - tx; this.arm.position.x = (19 - tx) / 2;   // 橫桿永遠接到鐵架（x = 19）
    const h = Math.max(.2, Math.min(112, s.shown)) * .11 + .6;   // 液柱長度（示意）
    this.column.scale.y = h; this.column.position.y = .45 + h / 2;
    if (ev && ev.type === 'place' && ev.item === 'ice') this.iceT = 4;
    if (ev && ev.type === 'reset') this.iceT = 0;
    this.state = s;
  }

  frame(dt, s) {
    this.t += dt;
    // 鏡頭
    const tgt = new THREE.Vector3(5, 19, 0);
    const d = this.dist || 80;
    this.camera.position.set(tgt.x + Math.sin(this.yaw) * Math.cos(this.pitch) * d, tgt.y + Math.sin(this.pitch) * d, tgt.z + Math.cos(this.yaw) * Math.cos(this.pitch) * d);
    this.camera.lookAt(tgt);
    this.slotMat.opacity = this.host.classList.contains('drop-ready') ? .9 : .3;
    // 火焰
    if (s.lit) {
      const k = 1 + Math.sin(this.t * 17) * .06 + Math.sin(this.t * 7.3) * .05;
      this.flame.scale.set(2 - k, k, 2 - k);
      this.flameLight.intensity = 40 + Math.sin(this.t * 13) * 6;
    } else this.flameLight.intensity = 0;
    // 冰塊
    if (this.iceT > 0 && !s.paused) this.iceT -= dt;
    this.ice.visible = this.iceT > 0;
    // 氣泡
    const want = !s.container ? 0 : s.water < 70 ? 0 : s.boiling && s.lit ? 24 : Math.round((s.water - 70) / 30 * 10);
    const m = new THREE.Matrix4();
    for (let i = 0; i < want; i++) {
      const b = this.bubbles[i];
      if (b.v === 1 || b.y > WATER_H - .3) { const a = Math.random() * 6.28, rr = Math.random() * (BEAKER_R - .8); b.x = Math.cos(a) * rr; b.z = Math.sin(a) * rr; b.y = .2 + (b.v === 1 ? Math.random() * WATER_H : 0); b.v = 1.5 + Math.random() * 2; }
      if (!s.paused) b.y += b.v * dt * (s.boiling ? 1.8 : 1);
      m.setPosition(b.x, b.y, b.z); this.bubbleMesh.setMatrixAt(i, m);
    }
    this.bubbleMesh.count = want; this.bubbleMesh.instanceMatrix.needsUpdate = true;
    // 水蒸氣
    const boil = s.boiling && s.lit;
    this.steam.children.forEach(p => {
      const k = (p.userData.k + this.t * .25) % 1;
      p.position.set(Math.sin(k * 9 + p.userData.k * 5) * 1.5, BEAKER_H + k * 9, Math.cos(k * 7) * 1.2);
      p.scale.setScalar(.6 + k * 1.6);
      p.material.opacity = boil ? (1 - k) * .45 : 0;
    });
    this.renderer.render(this.scene, this.camera);
  }
}
