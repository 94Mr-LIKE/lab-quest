/* 高品質 2D 畫質樣本
 * 世界座標＝地面圖的像素（1 張 1536 寬；世界由「原圖＋左右鏡像」兩張接成 3072 寬）。
 * 圖層由遠到近：L0 天空 → L1 山坡村落 → L2 廢墟 → L3 地面（可走）→ 角色、道具 → L4 前景植物。
 */
(function () {
  "use strict";
  var MAN = window.HD_ART || {}, IMG = {};
  var cv = document.getElementById("cv"), ctx = cv.getContext("2d");
  var DPR = 1, SW = 1, SH = 1, S = 1;
  var TILE = 1536, WORLD = TILE * 2, VIEW_H = 640;
  var FX = true, clock = 0;

  /* ---------- 載入 ---------- */
  var names = Object.keys(MAN), left = names.length;
  names.forEach(function (k) {
    var im = new Image();
    im.onload = im.onerror = function () { if (im.naturalWidth) IMG[k] = im; if (--left === 0) start(); };
    im.src = "art/" + k + (MAN[k].jpg ? ".jpg" : ".png");
  });
  if (!names.length) document.getElementById("load").textContent = "還沒有美術素材";

  /* ---------- 地面高度 ---------- */
  var HM = (MAN.L3_ground && MAN.L3_ground.height) || [], STEP = (MAN.L3_ground && MAN.L3_ground.step) || 4;
  function groundY(x) {                                  // 世界 x → 地面最上緣的 y（圖片像素，向下為正）
    x = ((x % WORLD) + WORLD) % WORLD;
    var lx = x < TILE ? x : WORLD - x;                    // 第二張是鏡像
    var i = lx / STEP, i0 = Math.floor(i), t = i - i0;
    var a = HM[Math.max(0, Math.min(HM.length - 1, i0))], b = HM[Math.max(0, Math.min(HM.length - 1, i0 + 1))];
    return a == null ? 760 : a + (b - a) * t;
  }
  var RIVER_Y = 0, LAND0 = 0, LAND1 = WORLD;
  function analyseGround() {
    if (!HM.length) return;
    var max = Math.max.apply(null, HM), min = Math.min.apply(null, HM);
    RIVER_Y = max - (max - min) * 0.3;                   // 比這更低的欄＝河
    for (var x = 0; x < TILE * 0.6; x += STEP) if (groundY(x) >= RIVER_Y) LAND0 = x + 70;   // 河的最右邊再往右一點
    LAND1 = WORLD - LAND0;
  }

  /* ---------- 鏡頭 ---------- */
  var cam = { x: 900, drag: 0, dragT: 0 };
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    SW = cv.clientWidth; SH = cv.clientHeight;
    cv.width = Math.round(SW * DPR); cv.height = Math.round(SH * DPR);
    if (SH > SW) { S = SW / 1000; VIEW_H = SH / S; }     // 直放：寬度看 1000 單位，上面多出來的是天空
    else { VIEW_H = 780; S = SH / VIEW_H; }
  }
  function wx2sx(x, f, m) { return SW / 2 + (x - cam.x * f) * S * (m || 1); }   // f：視差係數
  function wy2sy(y) { return SH - (1024 - y) * S; }

  /* ---------- 圖層 ---------- */
  // 依視差係數 f、縮放 m 水平鋪滿（原圖、鏡像交替），底部對齊 bottomY（螢幕座標）
  function layer(k, f, m, bottomY, alpha) {
    var im = IMG[k]; if (!im) return;
    var w = im.width * S * m, h = im.height * S * m, top = bottomY - h;
    var x0 = SW / 2 - cam.x * f * S * m;                 // 世界 x=0 的位置
    var n0 = Math.floor(-x0 / w) - 1, n1 = Math.ceil((SW - x0) / w) + 1;
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    for (var n = n0; n <= n1; n++) {
      var x = x0 + n * w;
      if (((n % 2) + 2) % 2 === 1) { ctx.save(); ctx.translate(x + w, top); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, w + 1, h); ctx.restore(); }
      else ctx.drawImage(im, x, top, w + 1, h);
    }
    ctx.globalAlpha = 1;
  }
  function sky() {
    var im = IMG.L0_sky; if (!im) { ctx.fillStyle = "#9cc3d8"; ctx.fillRect(0, 0, SW, SH); return; }
    var sc = Math.max(SH / im.height, SW / (im.width * 0.8)) * 1.08, w = im.width * sc, h = im.height * sc;
    var x = (SW - w) / 2 - (cam.x - WORLD / 2) * 0.04 * S, y = SH - h + SH * 0.04;
    ctx.drawImage(im, x, y, w, h);
  }

  /* ---------- 預先畫好的光點、霧 ---------- */
  function softDot(r, col) {
    var c = document.createElement("canvas"); c.width = c.height = r * 2; var g = c.getContext("2d");
    var gr = g.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c;
  }
  var DOT = softDot(16, "rgba(255,240,200,1)"), MIST = softDot(64, "rgba(235,242,245,1)"), GLOW = softDot(64, "rgba(120,255,240,1)");

  var SUN = function () { return { x: -SW * 0.05, y: -SH * 0.18 }; };
  function rays(t) {
    var s = SUN();
    ctx.save(); ctx.globalCompositeOperation = "screen";
    for (var i = 0; i < 7; i++) {
      var a = 0.42 + i * 0.085 + Math.sin(t * 0.13 + i) * 0.01, spread = 0.025 + (i % 3) * 0.012;
      var L = Math.hypot(SW, SH) * 1.3, al = (0.07 + 0.05 * Math.sin(t * 0.4 + i * 1.7)) * (i % 2 ? 0.8 : 1);
      var g = ctx.createLinearGradient(s.x, s.y, s.x + Math.cos(a) * L, s.y + Math.sin(a) * L);
      g.addColorStop(0, "rgba(255,226,160," + (al * 2.2) + ")"); g.addColorStop(0.55, "rgba(255,214,140," + al + ")"); g.addColorStop(1, "rgba(255,214,140,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + Math.cos(a - spread) * L, s.y + Math.sin(a - spread) * L);
      ctx.lineTo(s.x + Math.cos(a + spread) * L, s.y + Math.sin(a + spread) * L); ctx.closePath(); ctx.fill();
    }
    var bl = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, SH * 0.9);
    bl.addColorStop(0, "rgba(255,230,170,.55)"); bl.addColorStop(1, "rgba(255,230,170,0)");
    ctx.fillStyle = bl; ctx.fillRect(0, 0, SW, SH);
    ctx.restore();
  }
  function rayLight(x, y) {                               // 某個螢幕點在光束裡有多亮（給灰塵用）
    var s = SUN(), a = Math.atan2(y - s.y, x - s.x), v = 0;
    for (var i = 0; i < 7; i++) { var d = Math.abs(a - (0.42 + i * 0.085)); if (d < 0.04) v = Math.max(v, 1 - d / 0.04); }
    return v;
  }
  var mists = [];
  for (var i = 0; i < 9; i++) mists.push({ x: Math.random() * WORLD, y: 0.55 + Math.random() * 0.2, w: 500 + Math.random() * 600, h: 60 + Math.random() * 60, v: 6 + Math.random() * 10, a: 0.10 + Math.random() * 0.12, band: i < 5 ? 0 : 1 });
  function mist(band, f) {
    ctx.save();
    mists.forEach(function (m) {
      if (m.band !== band) return;
      var x = ((m.x + clock * m.v) % (WORLD * 1.4)) - WORLD * 0.2;
      var sx = wx2sx(x, f), sy = band ? wy2sy(groundY(x) - 30) : SH * m.y;
      ctx.globalAlpha = m.a; ctx.drawImage(MIST, sx - m.w * S / 2, sy - m.h * S / 2, m.w * S, m.h * S);
    });
    ctx.restore();
  }
  var dust = [];
  for (i = 0; i < 90; i++) dust.push({ x: Math.random(), y: Math.random(), z: 0.5 + Math.random() * 0.9, ph: Math.random() * 6.3, front: i < 25 });
  function drawDust(front) {
    ctx.save(); ctx.globalCompositeOperation = "screen";
    dust.forEach(function (d) {
      if (d.front !== front) return;
      var x = ((d.x * SW * 1.4 - cam.x * S * 0.2 * d.z + Math.sin(clock * 0.3 + d.ph) * 20) % (SW * 1.4) + SW * 1.4) % (SW * 1.4) - SW * 0.2;
      var y = ((d.y * SH - clock * 8 * d.z) % SH + SH) % SH;
      var L = rayLight(x, y), r = (front ? 5 : 2.5) * d.z * (0.6 + L);
      ctx.globalAlpha = (0.15 + L * 0.75) * (0.6 + 0.4 * Math.sin(clock * 2 + d.ph));
      ctx.drawImage(DOT, x - r * 2, y - r * 2, r * 4, r * 4);
    });
    ctx.restore();
  }
  var leaves = [];
  function stepLeaves(dt) {
    if (leaves.length < 6 && Math.random() < dt * 0.6) leaves.push({ x: Math.random() * SW * 1.2, y: -20, vx: -20 - Math.random() * 30, vy: 30 + Math.random() * 25, r: Math.random() * 6, vr: (Math.random() - 0.5) * 3, s: 0.7 + Math.random() * 0.6 });
    for (var i = leaves.length - 1; i >= 0; i--) { var l = leaves[i]; l.x += (l.vx + Math.sin(clock * 2 + i) * 25) * dt; l.y += l.vy * dt; l.r += l.vr * dt; if (l.y > SH + 20) leaves.splice(i, 1); }
  }
  function drawLeaves() {
    leaves.forEach(function (l) {
      ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.r); ctx.scale(l.s, l.s * Math.abs(Math.cos(l.r * 1.3)) + 0.2);
      ctx.fillStyle = "rgba(160,150,60,.85)"; ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
  }
  function water() {                                      // 河面的流動反光
    ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.lineCap = "round";
    var x0 = cam.x - SW / 2 / S - 50, x1 = cam.x + SW / 2 / S + 50;
    for (var x = Math.floor(x0 / 24) * 24; x < x1; x += 24) {
      var gy = groundY(x); if (gy < RIVER_Y) continue;
      for (var k = 0; k < 3; k++) {
        var ph = (x * 0.37 + k * 2.1), yy = gy + 8 + k * 16 + Math.sin(clock * 1.5 + ph) * 2;
        var xx = x + ((clock * (30 + k * 12) + ph * 40) % 24), a = 0.25 + 0.25 * Math.sin(clock * 3 + ph * 1.7);
        ctx.strokeStyle = "rgba(220,250,255," + Math.max(0, a) + ")"; ctx.lineWidth = (2.2 - k * 0.5) * S;
        ctx.beginPath(); ctx.moveTo(wx2sx(xx, 1), wy2sy(yy)); ctx.lineTo(wx2sx(xx + 10 + k * 4, 1), wy2sy(yy)); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function grade() {
    var g = ctx.createLinearGradient(0, 0, SW, SH);
    g.addColorStop(0, "rgba(255,186,110,.22)"); g.addColorStop(1, "rgba(30,60,80,.22)");
    ctx.save(); ctx.globalCompositeOperation = "soft-light"; ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH); ctx.restore();
    var v = ctx.createRadialGradient(SW / 2, SH * 0.55, Math.min(SW, SH) * 0.35, SW / 2, SH * 0.55, Math.hypot(SW, SH) * 0.62);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(10,6,2,.5)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, SW, SH);
  }

  /* ---------- 道具 ---------- */
  function prop(k, x, w, sink, rot) {
    var im = IMG[k]; if (!im) return;
    var h = w * im.height / im.width, sx = wx2sx(x, 1), sy = wy2sy(groundY(x) + sink);
    ctx.save(); ctx.translate(sx, sy); if (rot) ctx.rotate(rot); ctx.drawImage(im, -w * S / 2, -h * S, w * S, h * S); ctx.restore();
  }
  var PANEL_X = TILE;                                     // 謎團金屬板：高台正中央
  function props() {
    prop("wheel", 720, 300, 14, -0.06);
    prop("crate", 2230, 120, 10);
    prop("panel", PANEL_X, 170, 34);
    if (FX && IMG.panel) {                               // 謎團的光
      var p = 0.5 + 0.5 * Math.sin(clock * 2.2), sx = wx2sx(PANEL_X, 1), sy = wy2sy(groundY(PANEL_X) - 40), r = (120 + p * 40) * S;
      ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = 0.25 + p * 0.3; ctx.drawImage(GLOW, sx - r, sy - r, r * 2, r * 2); ctx.restore();
    }
  }

  /* ---------- 主角 ---------- */
  var KID_H = 270;
  var kid = { x: 880, tx: 880, face: 1, y: 0, walkT: 0, pose: "kid_idle", busy: 0, seen: false };
  function kidScale() { var m = MAN.kid_idle; return m ? KID_H / m.h : 1; }
  function stepKid(dt) {
    if (kid.busy > 0) { kid.busy -= dt; if (kid.busy <= 0) kid.pose = "kid_idle"; return; }
    var d = kid.tx - kid.x;
    if (Math.abs(d) > 4) {
      kid.face = d > 0 ? 1 : -1; kid.x += Math.sign(d) * Math.min(Math.abs(d), 230 * dt); kid.walkT += dt;
      var f = ["kid_walk1", "kid_walk2", "kid_walk3", "kid_walk2"]; kid.pose = f[Math.floor(kid.walkT * 7) % 4];
    } else { kid.pose = "kid_idle"; kid.walkT = 0; }
    if (!kid.seen && Math.abs(kid.x - PANEL_X) < 70) {
      kid.seen = true; kid.tx = kid.x; kid.pose = "kid_crouch"; kid.busy = 2.4; say("這塊金屬板……上面的符號在發光？", 2.6);
      setTimeout(function () { kid.pose = "kid_look"; kid.busy = 2.6; say("三百年前的人，到底想留下什麼？", 3.2); }, 2500);
    }
    var gy = groundY(kid.x) + 10;                          // 腳稍微陷進草裡
    kid.y = kid.y ? kid.y + (gy - kid.y) * Math.min(1, dt * 12) : gy;
  }
  function drawKid() {
    var im = IMG[kid.pose] || IMG.kid_idle; if (!im) return;
    var sc = kidScale(), w = im.width * sc, h = im.height * sc, breathe = kid.pose === "kid_idle" ? 1 + Math.sin(clock * 2.2) * 0.008 : 1;
    var sx = wx2sx(kid.x, 1), sy = wy2sy(kid.y);
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(sx, sy - 2 * S, 70 * S, 10 * S, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(sx, sy); ctx.scale(kid.face, breathe);
    ctx.drawImage(im, -w * S / 2, -h * S, w * S, h * S); ctx.restore();
  }

  /* ---------- 字幕 ---------- */
  var subT = null;
  function say(t, sec) { var el = document.getElementById("sub"); el.textContent = t; el.classList.add("on"); clearTimeout(subT); subT = setTimeout(function () { el.classList.remove("on"); }, sec * 1000); }

  /* ---------- 輸入：點一下走過去、拖曳平移 ---------- */
  var down = null;
  cv.addEventListener("pointerdown", function (e) { down = { x: e.clientX, y: e.clientY, cam: cam.drag, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (er) {} });
  cv.addEventListener("pointermove", function (e) {
    if (!down) return; var dx = e.clientX - down.x;
    if (Math.abs(dx) > 10) down.moved = true;
    if (down.moved) { cam.drag = Math.max(-700, Math.min(700, down.cam - dx / S)); cam.dragT = 2.5; }
  });
  cv.addEventListener("pointerup", function (e) {
    if (down && !down.moved && kid.busy <= 0) { var x = cam.x + (e.clientX - SW / 2) / S; kid.tx = Math.max(LAND0, Math.min(LAND1, x)); }
    down = null;
  });
  document.getElementById("fx").onclick = function () { FX = !FX; this.textContent = "特效：" + (FX ? "開" : "關"); };

  /* ---------- 主迴圈 ---------- */
  var last = 0, fpsN = 0, fpsT = 0;
  function frame(now) {
    var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; clock += dt;
    fpsN++; fpsT += dt; if (fpsT > 1) { document.getElementById("fps").textContent = Math.round(fpsN / fpsT) + " fps"; fpsN = 0; fpsT = 0; }
    stepKid(dt); stepLeaves(dt);
    if (cam.dragT > 0) cam.dragT -= dt; else cam.drag *= Math.pow(0.1, dt);
    var target = Math.max(SW / 2 / S, Math.min(WORLD - SW / 2 / S, kid.x + cam.drag));
    cam.x += (target - cam.x) * Math.min(1, dt * 3);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    sky();
    if (FX) mist(0, 0.15);
    layer("L1_village", 0.3, 0.72, SH - 150 * S);
    if (FX) rays(clock);
    layer("L2_ruins", 0.62, 0.5, wy2sy(790));
    if (FX) { drawDust(false); mist(1, 0.85); }
    layer("L3_ground", 1, 1, SH);
    if (FX) water();
    props();
    drawKid();
    if (FX) { drawDust(true); drawLeaves(); }
    if (IMG.L4_fore) layer("L4_fore", 1.35, (SH + 60 * S) / (IMG.L4_fore.height * S), SH + 60 * S);   // 上緣貼齊螢幕頂端（藤蔓從上面垂下來）
    if (FX) grade();
    requestAnimationFrame(frame);
  }
  function start() {
    analyseGround(); resize();
    cam.x = kid.x; var el = document.getElementById("load"); el.style.opacity = 0; setTimeout(function () { el.remove(); }, 900);
    say("水車終於修好了。可是高台上，好像有什麼東西在發光……", 3.5);
    requestAnimationFrame(frame);
  }
  window.addEventListener("resize", resize);
  window.__hd = { kid: kid, cam: cam, setFX: function (v) { FX = v; } };
})();
