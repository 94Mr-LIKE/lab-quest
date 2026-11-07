/* 科學復興 第一章「讓水回到村子」── 遊戲主程式
 * 三關：斜面、槓桿、滑輪。物理計算全部在 model.js（node 可驗算）。
 */
(function () {
  "use strict";
  var M = window.VillageModel, G = M.G, KID = M.KID_MAX;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function fmt(v, d) { return (+v).toFixed(d == null ? 0 : d); }

  /* ================= 存檔 ================= */
  var SAVE_KEY = "village_ch1_v1";
  var save = (function () {
    try { var s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.levels) return s; } catch (e) {}
    return { levels: {}, sound: true, intro: false };
  })();
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
  function lvSave(id) { return save.levels[id] || (save.levels[id] = { done: false, cards: {}, stars: [false, false, false] }); }

  /* ================= 音效（WebAudio 合成） ================= */
  var AC = null;
  function ac() {
    if (!save.sound) return null;
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
    if (AC && AC.state === "suspended") AC.resume();
    return AC;
  }
  function tone(f, dur, type, vol, f2, delay) {
    var a = ac(); if (!a) return;
    var t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, f1, f2, delay) {
    var a = ac(); if (!a) return;
    var t = a.currentTime + (delay || 0), n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = a.createBufferSource(); s.buffer = b;
    var fl = a.createBiquadFilter(); fl.type = "bandpass"; fl.Q.value = 0.8;
    fl.frequency.setValueAtTime(f1, t); fl.frequency.exponentialRampToValueAtTime(f2 || f1, t + dur);
    var g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(a.destination); s.start(t);
  }
  var SFX = {
    tap: function () { tone(660, 0.06, "triangle", 0.12); },
    place: function () { tone(220, 0.08, "triangle", 0.25, 140); noise(0.08, 0.2, 900); },
    thud: function () { tone(90, 0.25, "sine", 0.5, 45); noise(0.18, 0.35, 400, 120); },
    creak: function () { tone(180 + Math.random() * 60, 0.12, "sawtooth", 0.05, 120); },
    splash: function () { noise(0.7, 0.5, 2500, 300); tone(300, 0.2, "sine", 0.15, 120, 0.05); },
    strain: function () { tone(140, 0.16, "square", 0.05, 120); },
    rope: function () { noise(0.06, 0.15, 3000, 1500); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.22, "triangle", 0.2, null, i * 0.11); }); },
    fail: function () { tone(330, 0.18, "triangle", 0.18, 250); tone(250, 0.3, "triangle", 0.18, 180, 0.16); },
    card: function () { tone(880, 0.1, "sine", 0.15); tone(1320, 0.18, "sine", 0.15, null, 0.08); },
    water: function () { noise(1.6, 0.35, 600, 1800); }
  };

  /* ================= 畫布與鏡頭 ================= */
  var cv = $("cv"), ctx = cv.getContext("2d"), DPR = 1, SW = 0, SH = 0;
  var cam = { x0: 0, y0: 0, x1: 10, y1: 5, s: 50, ox: 0, oy: 0, shake: 0 };
  function resize() {
    var r = cv.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    SW = Math.max(1, r.width); SH = Math.max(1, r.height);
    cv.width = Math.round(SW * DPR); cv.height = Math.round(SH * DPR);
    fitCam();
    $("rotateHint").hidden = !(SH > SW * 1.15 && cur && cur.id !== "ending");
  }
  function fitCam() {
    if (!cur) return;
    var v = cur.view;
    cam.x0 = v.x0; cam.x1 = v.x1; cam.y0 = v.y0; cam.y1 = v.y1;
    cam.s = Math.min(SW / (v.x1 - v.x0), SH / (v.y1 - v.y0));
    cam.ox = (SW - (v.x1 - v.x0) * cam.s) / 2;
    cam.oy = SH - Math.max(0, (SH - (v.y1 - v.y0) * cam.s) * 0.12);
  }
  function sx(x) { return cam.ox + (x - cam.x0) * cam.s; }
  function sy(y) { return cam.oy - (y - cam.y0) * cam.s; }
  function toWorld(px, py) { return { x: cam.x0 + (px - cam.ox) / cam.s, y: cam.y0 + (cam.oy - py) / cam.s }; }
  function px(n) { return n / cam.s; }
  // 世界座標（y 向上）
  function worldT() {
    var kx = cam.shake ? (Math.random() - 0.5) * cam.shake : 0, ky = cam.shake ? (Math.random() - 0.5) * cam.shake : 0;
    ctx.setTransform(DPR * cam.s, 0, 0, -DPR * cam.s, DPR * (cam.ox - cam.x0 * cam.s + kx), DPR * (cam.oy + cam.y0 * cam.s + ky));
  }
  function screenT() { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
  // 畫面能看到的世界範圍（含留白）
  function visW() { var a = toWorld(0, SH), b = toWorld(SW, 0); return { x0: a.x, y0: a.y, x1: b.x, y1: b.y }; }

  /* ================= 美術素材（GPT 繪製；缺圖時用程式畫的替代） ================= */
  var ARTM = window.VILLAGE_ART || {}, ART = {};
  Object.keys(ARTM).forEach(function (k) { var im = new Image(); im.onload = function () { ART[k] = im; }; im.src = "art/" + k + (ARTM[k].jpg ? ".jpg" : ".png"); });
  // 錨點預設底部中心；w、h 只給一個時照比例
  function sprite(k, x, y, o) {
    var im = ART[k]; if (!im) return false; o = o || {};
    var h = o.h || (o.w * im.height / im.width), w = o.w || (o.h * im.width / im.height);
    var ax = o.ax == null ? 0.5 : o.ax, ay = o.ay == null ? 1 : o.ay;
    ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); ctx.scale(o.flip ? -1 : 1, -1);
    ctx.drawImage(im, -ax * w, -ay * h, w, h); ctx.restore(); return true;
  }
  function texRect(k, x0, y0, x1, y1) { return sprite(k, x0, y0, { w: x1 - x0, h: y1 - y0, ax: 0, ay: 1 }); }
  function texSeg(k, x1, y1, x2, y2, th) { return sprite(k, x1, y1, { w: Math.hypot(x2 - x1, y2 - y1), h: th, ax: 0, ay: 0.5, rot: Math.atan2(y2 - y1, x2 - x1) }); }
  function bg(k) {
    var im = ART[k]; if (!im) return false;
    screenT(); var sc = Math.max(SW / im.width, SH / im.height), w = im.width * sc, h = im.height * sc;
    ctx.drawImage(im, (SW - w) / 2, SH - h, w, h); worldT(); return true;
  }
  // 小禾：依姿勢選圖，所有姿勢用同一個比例（以「站」的高度＝1.3 m 為準）
  function kidPose(k) {
    if (k.pose) return k.pose;
    if (k.mood === "happy") return "cheer";
    if (k.mood === "sad") return "sad";
    if ((k.lean || 0) > 0.5) return "push";
    if ((k.lean || 0) < -0.5) return "pull";
    if (k.hands) { var hy = (k.hands[0].y + k.hands[1].y) / 2 - k.y; if ((k.squat || 0) > 0.6) return "press_lo"; if ((k.squat || 0) > 0.2) return "press_mid"; if (hy > 1.25) return "press_hi"; }
    return "stand";
  }
  function kidSprite(k) {
    var name = "kid_" + kidPose(k), m = ARTM[name], ref = ARTM.kid_stand;
    if (!ART[name] || !m || !ref) return false;
    var h = m.h * 1.3 / ref.h;
    sprite(name, k.x, k.y, { h: h, flip: (k.face || 1) < 0 });
    if (k.mood === "strain") circle(k.x - 0.12 * (k.face || 1), k.y + 1.15, 0.03, "#7fc6e6");
    return true;
  }

  /* ================= 繪圖小工具（世界座標） ================= */
  function poly(pts, fill, stroke, lw) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = px(lw || 2); ctx.stroke(); }
  }
  function circle(x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = px(lw || 2); ctx.stroke(); }
  }
  function line(x1, y1, x2, y2, color, lw, cap) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = px(lw || 2); ctx.lineCap = cap || "round"; ctx.stroke();
  }
  var INK = "#2b2118";
  function sky(top, bottom) {
    screenT();
    var g = ctx.createLinearGradient(0, 0, 0, SH);
    g.addColorStop(0, top || "#8fc8e8"); g.addColorStop(1, bottom || "#f7e7c4");
    ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
    worldT();
  }
  function farHills(t) {
    var v = visW();
    ctx.fillStyle = "#b9cf9e";
    ctx.beginPath(); ctx.moveTo(v.x0 - 1, 0);
    for (var x = v.x0 - 1; x <= v.x1 + 1; x += 0.25) ctx.lineTo(x, 1.6 + Math.sin(x * 0.7) * 0.35 + Math.sin(x * 1.9 + 1) * 0.12);
    ctx.lineTo(v.x1 + 1, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#9dbb83";
    ctx.beginPath(); ctx.moveTo(v.x0 - 1, 0);
    for (x = v.x0 - 1; x <= v.x1 + 1; x += 0.25) ctx.lineTo(x, 0.9 + Math.sin(x * 1.1 + 2) * 0.25);
    ctx.lineTo(v.x1 + 1, 0); ctx.closePath(); ctx.fill();
    // 雲
    for (var i = 0; i < 3; i++) {
      var cx = v.x0 + ((i * 3.7 + t * 0.08) % (v.x1 - v.x0 + 3)) - 1, cy = v.y1 - 0.5 - i * 0.25;
      var wc = "rgba(255,255,255,.75)";
      circle(cx, cy, 0.22, wc); circle(cx + 0.25, cy + 0.08, 0.28, wc); circle(cx + 0.55, cy, 0.2, wc);
    }
  }
  // 用 GPT 的土牆材質一塊塊鋪地面（不拉伸）；草的那條要高出地面一點
  function tileGround(k, x0, x1, y, tileW, fill) {
    var im = ART[k]; if (!im) return false;
    var v = visW(), W = im.width, H = im.height, ix = W * 0.04;      // 左右各裁掉 4%（材質邊框），接縫才不明顯
    var h = tileW * H / W, top = y + h * 0.12;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, v.y0 - 2, x1 - x0, top - v.y0 + 2); ctx.clip();
    ctx.fillStyle = fill || "#7a5530"; ctx.fillRect(x0, v.y0 - 2, x1 - x0, top - v.y0 + 2);
    ctx.scale(1, -1);                                                  // 改成 y 向下，方便用 drawImage 裁切
    for (var x = x0; x < x1; x += tileW) {
      ctx.drawImage(im, ix, 0, W - 2 * ix, H * 0.97, x, -top, tileW + 0.01, h * 0.97);
      // 下面再鋪：只用材質下半部（不重複草）
      for (var yy = top - h * 0.97; yy > v.y0 - 1; yy -= h * 0.6) ctx.drawImage(im, ix, H * 0.33, W - 2 * ix, H * 0.6, x, -yy, tileW + 0.01, h * 0.6 + 0.01);
    }
    ctx.restore(); return true;
  }
  function groundRect(x0, x1, y, col) {
    if (tileGround("tex_cliff", x0, x1, y, 1.3)) return;
    var v = visW();
    poly([[x0, y], [x1, y], [x1, v.y0 - 1], [x0, v.y0 - 1]], col || "#a5793f");
    poly([[x0, y], [x1, y], [x1, y - 0.08], [x0, y - 0.08]], "#6fa04a");
    line(x0, y, x1, y, "#4f7d33", 2);
  }
  function waterBody(x0, x1, ytop, t, col) {
    var v = visW();
    ctx.fillStyle = col || "rgba(64,150,165,.92)";
    ctx.beginPath(); ctx.moveTo(x0, v.y0 - 1);
    for (var x = x0; x <= x1 + 0.001; x += 0.1) ctx.lineTo(x, ytop + Math.sin(x * 5 + t * 2.5) * 0.02);
    ctx.lineTo(x1, v.y0 - 1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = px(2);
    ctx.beginPath();
    for (x = x0 + 0.1; x < x1 - 0.2; x += 0.6) { var yy = ytop - 0.08 + Math.sin(x + t) * 0.02; ctx.moveTo(x, yy); ctx.lineTo(x + 0.2, yy); }
    ctx.stroke();
  }
  function rock(cx, cy, r, seed, col, rot) {
    if (sprite("boulder", cx, cy, { w: r * 2.15, ay: 0.5, rot: rot || 0 })) return;
    var pts = [], n = 9;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2, k = 0.82 + 0.18 * Math.abs(Math.sin(seed * 7.1 + i * 2.3));
      pts.push([cx + Math.cos(a) * r * k * 1.08, cy + Math.sin(a) * r * k]);
    }
    poly(pts, col || "#8a8a84", INK, 2);
    ctx.save(); ctx.clip();
    circle(cx + r * 0.3, cy - r * 0.35, r * 0.7, "rgba(0,0,0,.15)");
    circle(cx - r * 0.35, cy + r * 0.35, r * 0.25, "rgba(255,255,255,.25)");
    ctx.restore();
  }
  function plank(x1, y1, x2, y2, th, hl) {
    if (texSeg("tex_plank", x1, y1, x2, y2, th * 1.5)) { if (hl) { ctx.save(); ctx.globalAlpha = 0.35 + 0.2 * Math.sin(clock * 5); line(x1, y1, x2, y2, "#ffd27a", 10); ctx.restore(); } return; }
    var dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L * th / 2, ny = dx / L * th / 2;
    poly([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]], hl ? "#f6c46a" : "#c99858", INK, 2);
    ctx.strokeStyle = "rgba(90,55,20,.45)"; ctx.lineWidth = px(1.2);
    ctx.beginPath();
    for (var k = 0.25; k < 1; k += 0.5) { ctx.moveTo(x1 + dx * 0.05 + nx * (k * 2 - 1) * 0.5, y1 + dy * 0.05 + ny * (k * 2 - 1) * 0.5); ctx.lineTo(x2 - dx * 0.05 + nx * (k * 2 - 1) * 0.5, y2 - dy * 0.05 + ny * (k * 2 - 1) * 0.5); }
    ctx.stroke();
  }
  function wheelDraw(cx, cy, r, ang) {
    if (sprite("wheel", cx, cy, { w: r * 2, ay: 0.5, rot: ang })) return;
    circle(cx, cy, r, "#b9874a", INK, 3);
    circle(cx, cy, r * 0.82, "#d9ad6c", INK, 1.5);
    for (var i = 0; i < 8; i++) {
      var a = ang + i * Math.PI / 4;
      line(cx, cy, cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82, "#7a4f22", 3);
      // 水車的葉片
      var bx = cx + Math.cos(a) * r, by = cy + Math.sin(a) * r;
      line(bx, by, bx + Math.cos(a) * r * 0.16, by + Math.sin(a) * r * 0.16, "#7a4f22", 5, "butt");
    }
    circle(cx, cy, r * 0.12, "#5a3a18", INK, 1.5);
  }
  function crate(x, y, w, h) {
    if (sprite("crate", x + w / 2, y, { w: w, h: h })) return;
    poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], "#c48a46", INK, 2);
    line(x, y, x + w, y + h, "#8a5a28", 2); line(x + w, y, x, y + h, "#8a5a28", 2);
  }
  function pulleyDraw(x, y, r, rot, ghost) {
    if (!ghost && sprite("pulley", x, y, { w: r * 2, ay: 0.5, rot: rot })) return;
    circle(x, y, r, ghost ? "rgba(255,231,199,.5)" : "#9aa3a8", ghost ? "#e0822b" : INK, 2);
    if (!ghost) { circle(x, y, r * 0.55, "#c7ced2", INK, 1); circle(x, y, r * 0.15, INK); line(x + Math.cos(rot) * r * 0.2, y + Math.sin(rot) * r * 0.2, x + Math.cos(rot) * r * 0.5, y + Math.sin(rot) * r * 0.5, INK, 1.5); }
  }
  function rope(pts, col) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = col || "#8a6a3a"; ctx.lineWidth = px(3); ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
  }
  function ringHint(x, y, r, t) {
    ctx.save(); ctx.setLineDash([px(6), px(5)]); ctx.lineDashOffset = -t * px(20);
    circle(x, y, r, "rgba(255,200,90,.25)", "#e0822b", 2.5); ctx.restore();
  }

  /* ---------- 小禾 ---------- */
  // k = { x, y(腳底), face(1 右/-1 左), hand:{x,y} 或 hands:[{},{}], mood, squat(0~1), t, lean }
  function kidDraw(k) {
    if (kidSprite(k)) return;
    var f = k.face || 1, sq = k.squat || 0, lean = k.lean || 0;
    var hip = { x: k.x - lean * 0.1, y: k.y + 0.6 - sq * 0.25 };
    var sh = { x: hip.x + lean * 0.22 * f, y: hip.y + 0.42 };
    var head = { x: sh.x + lean * 0.08 * f, y: sh.y + 0.15 };
    var walk = k.walk ? Math.sin(k.t * 10) * 0.12 : 0;
    // 腿
    var kneeOut = 0.12 + sq * 0.18;
    line(hip.x, hip.y, hip.x + kneeOut * f * 0.6 + walk, hip.y - 0.3 + sq * 0.08, "#3d5a80", 9);
    line(hip.x + kneeOut * f * 0.6 + walk, hip.y - 0.3 + sq * 0.08, k.x + 0.08 * f + walk * 1.5, k.y + 0.02, "#3d5a80", 8);
    line(hip.x, hip.y, hip.x - kneeOut * f * 0.3 - walk, hip.y - 0.3 + sq * 0.08, "#34506f", 9);
    line(hip.x - kneeOut * f * 0.3 - walk, hip.y - 0.3 + sq * 0.08, k.x - 0.06 * f - walk * 1.5, k.y + 0.02, "#34506f", 8);
    // 身體
    line(hip.x, hip.y, sh.x, sh.y, "#e4572e", 18);
    // 手
    var hands = k.hands || (k.hand ? [k.hand, k.hand] : [{ x: sh.x + 0.18 * f, y: sh.y - 0.35 }, { x: sh.x + 0.05 * f, y: sh.y - 0.4 }]);
    for (var i = 0; i < 2; i++) {
      var hd = hands[i], dx = hd.x - sh.x, dy = hd.y - sh.y, d = Math.hypot(dx, dy), maxA = 0.56;
      var hx = d > maxA ? sh.x + dx / d * maxA : hd.x, hy = d > maxA ? sh.y + dy / d * maxA : hd.y;
      var ex = (sh.x + hx) / 2 - dy / (d || 1) * 0.06 * f, ey = (sh.y + hy) / 2 + dx / (d || 1) * 0.06 * f;
      ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.quadraticCurveTo(ex, ey, hx, hy);
      ctx.strokeStyle = i ? "#c4471f" : "#e4572e"; ctx.lineWidth = px(7); ctx.lineCap = "round"; ctx.stroke();
      circle(hx, hy, 0.045, "#f2c9a0", INK, 1);
    }
    // 頭
    circle(head.x, head.y + 0.07, 0.14, "#f2c9a0", INK, 2);
    ctx.fillStyle = "#3b2a1a"; ctx.beginPath(); ctx.arc(head.x, head.y + 0.1, 0.145, 0.15, Math.PI - 0.15); ctx.fill();
    // 臉
    var ex2 = head.x + 0.05 * f, ey2 = head.y + 0.08, mood = k.mood || "ok";
    if (mood === "strain") {
      line(ex2 - 0.035, ey2 + 0.01, ex2 - 0.005, ey2 - 0.01, INK, 2); line(ex2 + 0.035, ey2 + 0.01, ex2 + 0.065, ey2 - 0.01, INK, 2);
      line(ex2 - 0.01, ey2 - 0.06, ex2 + 0.05, ey2 - 0.06, INK, 2.5);
      circle(head.x - 0.1 * f, head.y + 0.16, 0.025, "#7fc6e6");
    } else if (mood === "happy") {
      ctx.beginPath(); ctx.arc(ex2 - 0.02, ey2, 0.02, 0, Math.PI); ctx.arc(ex2 + 0.05, ey2, 0.02, 0, Math.PI); ctx.strokeStyle = INK; ctx.lineWidth = px(2); ctx.stroke();
      ctx.beginPath(); ctx.arc(ex2 + 0.015, ey2 - 0.04, 0.035, Math.PI, 0, true); ctx.stroke();
    } else if (mood === "sad") {
      circle(ex2 - 0.02, ey2, 0.014, INK); circle(ex2 + 0.05, ey2, 0.014, INK);
      ctx.beginPath(); ctx.arc(ex2 + 0.015, ey2 - 0.08, 0.03, 0.2, Math.PI - 0.2); ctx.strokeStyle = INK; ctx.lineWidth = px(2); ctx.stroke();
    } else {
      circle(ex2 - 0.02, ey2, 0.016, INK); circle(ex2 + 0.05, ey2, 0.016, INK);
      line(ex2, ey2 - 0.055, ex2 + 0.04, ey2 - 0.05, INK, 2);
    }
  }
  function bubble(text, wx, wy) {
    screenT();
    ctx.font = "bold 15px " + getComputedStyle(document.body).fontFamily;
    var w = ctx.measureText(text).width + 18, h = 30, x = clamp(sx(wx) - w / 2, 4, SW - w - 4), y = Math.max(4, sy(wy) - h - 10);
    ctx.fillStyle = "#fffaf0"; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    roundRect(x, y, w, h, 10); ctx.fill(); ctx.stroke();
    var tx = clamp(sx(wx), x + 12, x + w - 12);
    ctx.beginPath(); ctx.moveTo(tx - 6, y + h - 1); ctx.lineTo(tx, y + h + 8); ctx.lineTo(tx + 6, y + h - 1); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x + w / 2, y + h / 2 + 1);
    worldT();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // 力氣表：需要的力 vs 小禾最大 200 N
  function effortMeter(need, wx, wy) {
    screenT();
    var w = 132, h = 40, x = clamp(sx(wx) - w / 2, 4, SW - w - 4), y = clamp(sy(wy) - h - 46, 4, SH - h - 4);
    ctx.fillStyle = "rgba(43,33,24,.88)"; roundRect(x, y, w, h, 8); ctx.fill();
    var over = need > KID, frac = clamp(need / KID, 0, 1.6) / 1.6;
    ctx.fillStyle = "#4a3b2c"; ctx.fillRect(x + 8, y + 24, w - 16, 8);
    ctx.fillStyle = over ? "#e74c3c" : "#7bc96f"; ctx.fillRect(x + 8, y + 24, (w - 16) * frac, 8);
    var mx = x + 8 + (w - 16) / 1.6; ctx.fillStyle = "#fff"; ctx.fillRect(mx - 1, y + 20, 2, 16);
    ctx.fillStyle = "#f4ead3"; ctx.font = "bold 12px " + getComputedStyle(document.body).fontFamily; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText("要出 " + fmt(need) + " N", x + 8, y + 16);
    ctx.textAlign = "right"; ctx.fillStyle = over ? "#ff9a8a" : "#c9e8c2"; ctx.fillText("最多 " + KID, x + w - 8, y + 16);
    worldT();
  }

  /* ---------- 粒子 ---------- */
  var parts = [];
  function burst(x, y, n, col, sp, up, g, size) {
    for (var i = 0; i < n; i++) parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * sp, vy: Math.random() * (up || sp) , life: 0.6 + Math.random() * 0.6, c: col, g: g == null ? 9.8 : g, s: size || 0.04 });
  }
  function stepParts(dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) parts.splice(i, 1);
    }
  }
  function drawParts() { for (var i = 0; i < parts.length; i++) { var p = parts[i]; ctx.globalAlpha = clamp(p.life * 1.5, 0, 1); circle(p.x, p.y, p.s, p.c); } ctx.globalAlpha = 1; }

  /* ================= 關卡共用 ================= */
  var cur = null, holding = false, clock = 0;
  function toast(msg, ms) {
    var el = $("toast"); el.textContent = msg; el.hidden = !msg;
    clearTimeout(toast._t); if (msg && ms !== 0) toast._t = setTimeout(function () { el.hidden = true; }, ms || 2600);
  }

  /* ---------- 第 1 關：斜面 ---------- */
  var R = M.RAMP;
  var ramp = {
    id: "ramp", no: "第 1 站", name: "把水車輪推上河岸", icon: "🛞",
    view: { x0: -1.4, x1: 8.4, y0: -0.75, y1: 3.1 },
    brief: "<p>水車輪 <b>60 公斤</b>，河岸高 <b>1.2 公尺</b>。直接抬要 588 N，小禾最多只有 200 N。</p><p>從下面挑一塊木板，拖到河岸邊搭成斜面，再<b>按住「出力」</b>把輪子推上去。半路放手，輪子會滾回去喔。</p>",
    cards: {
      steep: { ic: "⛰️", t: "太陡了", d: "斜面越陡，推上去要的力越大。木板太短，斜面就太陡。" },
      noroom: { ic: "🌊", t: "沒地方站", d: "斜面越長越省力，但也越佔地方。木板太長，底端跑到河邊，輪子和小禾都站不下。" },
      slip: { ic: "↩️", t: "半路放手", d: "一放手，沒有力把輪子撐住，重力沿著斜面把輪子拉回去。" },
      ok: { ic: "📐", t: "省力不省功", d: "斜面越長，推的力越小，但要推越遠。力 × 距離，至少要等於 mgh（重量 × 高度）。" }
    },
    order: ["steep", "noroom", "slip", "ok"],
    starText: ["把輪子推上河岸", "收集全部 4 張科學筆記", "一路推到頂，中途沒有放手"],
    init: function () { this.cfg = { L: null }; this.reset(); },
    reset: function () {
      this.state = "build"; this.ph = ""; this.tm = 0; this.s = 0; this.vb = 0; this.work = 0; this.released = false;
      this.ang = 0; this.kidJump = 0; this.flatX = 0; this.splashed = false; this.strainT = 0;
      this.r = this.cfg.L ? M.evalRamp(this.cfg.L) : null;
      this.place();
    },
    place: function () {
      var r = this.r;
      if (r) { this.wx = r.footX - R.radius - 0.02; }
      else this.wx = 3.8;
      this.wy = R.radius; this.kx = this.wx - R.radius - 0.42; this.ky = 0;
    },
    tray: function () {
      var me = this;
      return R.planks.map(function (L) { return { id: "p" + L, icon: "🪵", art: "tex_plank", label: L + " m 木板", on: me.cfg.L === L, drag: true }; });
    },
    targets: function (id) { return [{ x: R.ledgeX, y: R.height, r: 0.35 }]; },
    drop: function (id, w) {
      if (Math.hypot(w.x - R.ledgeX, w.y - R.height) < 1.4 || (w.x > 1 && w.x < 7)) { this.tap(id); return; }
      toast("把木板拖到河岸邊（發光的地方）");
    },
    tap: function (id) {
      var L = +id.slice(1);
      this.cfg.L = this.cfg.L === L ? null : L; SFX.place(); this.reset();
      if (this.r && this.r.reason === "noroom") toast("木板底端離河好近……", 2200);
    },
    canStart: function () { return true; },
    start: function () {
      this.state = "run"; var r = this.r;
      this.ph = !r ? "flat" : r.reason === "noroom" ? "slip_room" : "climb";
    },
    rampPt: function (s) { var r = this.r; return { x: r.footX + s * r.cos, y: s * r.sin }; },
    update: function (dt, hold) {
      var r = this.r, me = this; this.tm += dt;
      if (this.ph === "flat") {                       // 沒有斜面：推到牆邊，抬不起來
        if (hold) { var lim = R.ledgeX - R.radius; if (this.wx < lim) { this.wx = Math.min(lim, this.wx + 0.9 * dt); this.ang -= 0.9 * dt / R.radius; this.kx = this.wx - R.radius - 0.42; } else { this.strainT = (this.strainT || 0) + dt; if (Math.random() < dt * 4) SFX.strain(); if (this.strainT > 1.3) finish(this, { ok: false, reason: "nolift" }); } }
        return;
      }
      if (this.ph === "slip_room") {                 // 木板太長：小禾踩到河邊滑下去
        this.kx -= 0.8 * dt; if (this.kx < -0.1 && !this.splashed) { this.splashed = true; SFX.splash(); burst(-0.3, 0, 30, "#bfe8f5", 2, 3, 9.8, 0.05); }
        if (this.tm > 1.3) finish(this, { ok: false, reason: "noroom" }); return;
      }
      if (this.ph === "climb") {
        var p;
        if (hold) {
          if (r.Freq > KID) {
            if (this.s <= 0) { this.wx = Math.min(r.footX - R.radius * 0.4, this.wx + 0.6 * dt); }
            this.strainT = (this.strainT || 0) + dt; if (Math.random() < dt * 4) SFX.strain();
            if (this.strainT > 1.4) finish(this, { ok: false, reason: "steep" });
          } else {
            var v = 0.7;
            if (this.s <= 0 && this.wx < r.footX - 0.01) { this.wx += v * dt; this.ang -= v * dt / R.radius; }
            else { this.s += v * dt; this.work += r.Freq * v * dt; this.ang -= v * dt / R.radius; if (Math.random() < dt * 3) SFX.creak(); }
            if (this.s >= r.L) { this.ph = "top"; this.tm = 0; SFX.thud(); }
          }
        } else if (this.s > 0.02) { this.released = true; this.ph = "back"; this.vb = 0; this.kidJump = 0; toast("放手了！", 1200); }
        if (this.s > 0) { p = this.rampPt(this.s); this.wx = p.x - r.sin * R.radius; this.wy = p.y + r.cos * R.radius; var kp = this.rampPt(Math.max(0, this.s - R.radius - 0.42)); this.kx = kp.x; this.ky = kp.y; }
        else { this.wy = R.radius; this.kx = this.wx - R.radius - 0.42; this.ky = 0; }
        return;
      }
      if (this.ph === "back") {                        // 滾回去：小禾跳起來閃開
        var a = 0.5 * G * r.sin;
        this.vb += a * dt; this.kidJump += dt;
        if (this.s > 0) { this.s -= this.vb * dt; this.ang += this.vb * dt / R.radius; p = this.rampPt(Math.max(this.s, 0)); this.wx = p.x - r.sin * R.radius; this.wy = p.y + r.cos * R.radius; }
        else { this.wx -= this.vb * dt; this.ang += this.vb * dt / R.radius; this.wy = R.radius; }
        if (this.wx < -0.4 && !this.splashed) { this.splashed = true; SFX.splash(); burst(-0.6, 0, 40, "#bfe8f5", 3, 4, 9.8, 0.05); this.ph = "sunk"; this.tm = 0; }
        return;
      }
      if (this.ph === "sunk") { if (this.tm > 1.0) finish(this, { ok: false, reason: "slip" }); return; }
      if (this.ph === "top") {
        if (this.wx < 7.2) { this.wx += 0.8 * dt; this.ang -= 0.8 * dt / R.radius; this.wy = R.height + R.radius; }
        if (this.tm > 1.3) finish(this, { ok: true, reason: "ok", star3: !this.released });
        var kp2 = this.rampPt(r.L - 0.2); this.kx = kp2.x; this.ky = kp2.y;
      }
    },
    render: function (t) {
      var r = this.r, me = this;
      if (!bg("bg_river")) { sky(); farHills(t); }
      waterBody(visW().x0 - 1, 0, -0.18, t);
      groundRect(0, R.ledgeX, 0);
      // 河岸（懸崖）
      var v = visW();
      if (!tileGround("tex_cliff", R.ledgeX, v.x1 + 1, R.height, 1.3)) {
        poly([[R.ledgeX, v.y0 - 1], [R.ledgeX, R.height], [v.x1 + 1, R.height], [v.x1 + 1, v.y0 - 1]], "#9c7140", INK, 2);
        poly([[R.ledgeX, R.height], [v.x1 + 1, R.height], [v.x1 + 1, R.height - 0.08], [R.ledgeX, R.height - 0.08]], "#6fa04a");
        for (var i = 0; i < 5; i++) line(R.ledgeX + 0.15, 0.2 + i * 0.22, R.ledgeX + 0.5 + (i % 2) * 0.3, 0.2 + i * 0.22, "rgba(60,40,20,.35)", 2);
      }
      // 水車架
      if (!sprite("aframe", 7.2, R.height, { h: 1.15 })) {
        line(7.0, R.height, 7.2, R.height + 1.0, "#6b4524", 7); line(7.4, R.height, 7.2, R.height + 1.0, "#6b4524", 7);
        circle(7.2, R.height + 1.0, 0.06, INK);
      }
      // 標示：高度 1.2 m
      dim(R.ledgeX + 0.95, 0, R.ledgeX + 0.95, R.height, "1.2 m");
      // 拖曳提示
      if (dragging && dragging.charAt(0) === "p") ringHint(R.ledgeX, R.height, 0.35, t);
      else if (!this.cfg.L && this.state === "build") ringHint(R.ledgeX, R.height, 0.3, t);
      // 木板
      if (r) {
        plank(r.footX, 0.04, R.ledgeX + 0.05, R.height + 0.04, 0.09, this.state === "build");
        if (this.state === "build") lengthLabel(r.footX, 0, R.ledgeX, R.height, this.cfg.L + " m");
      }
      // 輪子與小禾
      var jump = this.ph === "back" || this.ph === "sunk" ? Math.max(0, 1 - Math.abs(this.wx - this.kx) / 1.1) * 1.25 : 0;
      var mood = this.strainT > 0.2 && this.state === "run" && (this.ph === "climb" || this.ph === "flat") && holding && (r ? r.Freq > KID || this.ph === "flat" : true) ? "strain" : this.ph === "top" ? "happy" : (this.ph === "back" || this.ph === "sunk" || this.ph === "slip_room") ? "sad" : "ok";
      var kid = { x: this.kx, y: this.ky + jump, face: 1, t: t, mood: mood, walk: holding && this.state === "run" && !(r && r.Freq > KID) && this.ph === "climb" };
      if (this.ph === "slip_room") { kid.y = Math.max(-0.6, this.ky - Math.max(0, this.tm - 0.5) * 1.5); kid.mood = "sad"; }
      if (this.ph === "climb" || this.ph === "flat") { kid.lean = 1; kid.hand = { x: this.wx - R.radius * 0.8, y: this.wy + 0.05 }; }
      if (this.ph !== "sunk") wheelDraw(this.wx, this.wy, R.radius, this.ang);
      kidDraw(kid);
      if (this.ph === "sunk") { waterBody(visW().x0 - 1, 0, -0.18, t); }
      if (this.state === "run" && holding && (this.ph === "climb" || this.ph === "flat")) effortMeter(this.ph === "flat" ? R.mass * G : (this.s > 0 || r.Freq > KID ? r.Freq : R.mu * R.mass * G), this.kx, this.ky + 1.3);
      if (this.state === "run" && this.ph === "flat" && this.strainT > 0.3) bubble("抬不起來……", this.kx, this.ky + 1.5);
      if (this.state === "run" && this.ph === "climb" && r.Freq > KID && this.strainT > 0.3) bubble("推不上去！", this.kx, this.ky + 1.5);
      if (this.ph === "top") bubble("推上去了！", this.kx, this.ky + 1.5);
    },
    result: function (res) {
      var r = this.r;
      if (res.reason === "nolift") return { title: "抬不起來", msg: "沒有斜面，要直接把 60 公斤的輪子抬高 1.2 m，得出 588 N 的力，小禾只有 200 N。" };
      if (res.reason === "steep") return { title: "太陡，推不上去", msg: "這塊 " + r.L + " m 的木板斜了 " + fmt(r.angle, 1) + "°，要出 <b>" + fmt(r.Freq) + " N</b>，超過 200 N。", card: "steep" };
      if (res.reason === "noroom") return { title: "沒地方站", msg: r.L + " m 的木板底端離河只剩 " + fmt(r.footX, 2) + " m，輪子和小禾站不下，小禾滑進河裡了（還好水很淺）。", card: "noroom" };
      if (res.reason === "slip") return { title: "輪子滾回河裡了", msg: "半路一放手，輪子沿著斜面滾下去，掉進河裡。阿伯幫你撈上來了，再試一次！", card: "slip" };
      return { title: "推上去了！", card: "ok",
        msg: "斜面讓小禾用比較小的力，把輪子慢慢推高。",
        num: "出力 <b>" + fmt(r.Freq) + " N</b> × 推了 <b>" + r.L + " m</b> ＝ 做功約 <b>" + fmt(r.work) + " J</b><br>輪子升高 1.2 m，位能增加 mgh ＝ 60 × 9.8 × 1.2 ≈ <b>" + fmt(r.mgh) + " J</b><br>多出來的 " + fmt(r.work - r.mgh) + " J，花在輪子的滾動阻力。" };
    }
  };

  /* ---------- 第 2 關：槓桿 ---------- */
  var LV = M.LEVER;
  var lever = {
    id: "lever", no: "第 2 站", name: "撬開堵住出水口的石頭", icon: "🪨",
    view: { x0: 0.0, x1: 6.7, y0: -0.45, y1: 2.75 },
    brief: "<p>山泉的出水口被一顆 <b>50 公斤</b>的石頭堵住。要把石頭抬高 <b>40 公分</b>，水才沖得開。</p><p>拖一塊木板、一顆支點石到地上，左右拖動支點（或按 ◀ ▶ 微調），再<b>按住「出力」</b>把木板往下壓。小禾踮腳最高搆到 <b>1.5 m</b>，木箱可以讓她站高 0.5 m。</p>",
    cards: {
      heavy: { ic: "🏋️", t: "壓不動", d: "支點離石頭越遠，石頭這邊的力臂越長、手那邊越短，要出的力就越大。" },
      noreach: { ic: "🙋", t: "搆不到", d: "手這邊的力臂越長越省力，但手那一端也翹得越高。" },
      low: { ic: "📏", t: "抬不夠高", d: "省力的槓桿，石頭那端動得比手少；支點太矮，石頭也抬不高。" },
      ok: { ic: "⚖️", t: "省力就要多走路", d: "手的力臂是石頭的幾倍，就只要幾分之一的力；但手要壓下的距離，也是石頭升高的好幾倍。" }
    },
    order: ["heavy", "noreach", "low", "ok"],
    starText: ["把石頭撬開", "收集全部 4 張科學筆記", "不用木箱就成功"],
    init: function () { this.cfg = { plank: null, fu: null, xf: 3.4, box: false }; this.reset(); },
    plankObj: function () { var L = this.cfg.plank; return L ? LV.planks.filter(function (p) { return p.L === L; })[0] : null; },
    fuObj: function () { var id = this.cfg.fu; return id ? LV.fulcrums.filter(function (f) { return f.id === id; })[0] : null; },
    // 由支點 x 算出 dl（沿木板），並對齊 5 cm
    snap: function () {
      var p = this.plankObj(), f = this.fuObj(); if (!p || !f) return;
      var dl = Math.hypot(LV.loadX - this.cfg.xf, f.h);
      dl = clamp(Math.round(dl / LV.step) * LV.step, f.h + 0.05, p.L - f.h - 0.05);
      dl = Math.round(dl * 100) / 100;
      this.cfg.dl = dl; this.cfg.xf = LV.loadX - Math.sqrt(dl * dl - f.h * f.h);
    },
    reset: function () {
      this.state = "build"; this.ph = ""; this.tm = 0; this.strainT = 0; this.stoneOff = null; this.water = 0;
      this.snap();
      var p = this.plankObj(), f = this.fuObj();
      this.r = p && f ? M.evalLever({ L: p.L, pm: p.m, hf: f.h, dl: this.cfg.dl, box: this.cfg.box }) : null;
      this.phi = this.r ? this.r.phi0 : 0;
    },
    geo: function (phi) {   // 木板兩端位置
      var p = this.plankObj(), f = this.fuObj();
      if (!p) return null;
      if (!f) return { load: { x: LV.loadX, y: 0.04 }, eff: { x: LV.loadX - p.L, y: 0.04 }, flat: true };
      var dl = this.cfg.dl, de = p.L - dl, F = { x: this.cfg.xf, y: f.h }, ux = -Math.cos(phi), uy = Math.sin(phi);
      return { F: F, load: { x: F.x - dl * ux, y: F.y - dl * uy }, eff: { x: F.x + de * ux, y: F.y + de * uy } };
    },
    tray: function () {
      var c = this.cfg, items = LV.planks.map(function (p) { return { id: "p" + p.L, icon: "🪵", art: "tex_plank", label: p.L + " m 木板", on: c.plank === p.L, drag: true }; });
      LV.fulcrums.forEach(function (f) { items.push({ id: "f" + f.id, icon: "🪨", art: "fulcrum_" + f.id, label: "支點 " + Math.round(f.h * 100) + "cm", on: c.fu === f.id, drag: true }); });
      items.push({ id: "box", icon: "📦", art: "crate", label: "木箱", on: c.box, drag: true });
      return items;
    },
    targets: function (id) {
      if (id.charAt(0) === "p") return [{ x: LV.loadX - 1.5, y: 0.05, r: 0.4, line: [LV.loadX - 3.8, LV.loadX] }];
      if (id.charAt(0) === "f") return [{ line: [1.3, LV.loadX - 0.3], y: 0.02 }];
      return [{ x: this.boxX(), y: 0.25, r: 0.4 }];
    },
    boxX: function () { var g = this.geo(this.r ? this.r.phi0 : 0); return g ? clamp(g.eff.x + 0.1, 0.4, 4) : 1.4; },
    drop: function (id, w) {
      if (id.charAt(0) === "f") { this.cfg.fu = id.slice(1); this.cfg.xf = clamp(w.x, 1.2, LV.loadX - 0.3); SFX.place(); this.reset(); return; }
      this.tap(id);
    },
    tap: function (id) {
      var c = this.cfg;
      if (id.charAt(0) === "p") { var L = +id.slice(1); c.plank = c.plank === L ? null : L; }
      else if (id.charAt(0) === "f") { var f = id.slice(1); if (c.fu === f) c.fu = null; else { c.fu = f; if (!c.xf) c.xf = 3.4; } }
      else c.box = !c.box;
      SFX.place(); this.reset();
    },
    down: function (w) {
      if (this.state !== "build" || !this.cfg.fu) return false;
      var f = this.fuObj();
      if (Math.abs(w.x - this.cfg.xf) < 0.45 && w.y < f.h + 0.5) { this.grab = true; return true; }
      return false;
    },
    move: function (w) { if (this.grab) { this.cfg.xf = clamp(w.x, 0.8, LV.loadX - 0.25); this.reset(); } },
    up: function () { if (this.grab) { this.grab = false; SFX.tap(); } },
    nudge: function (d) {
      if (!this.cfg.fu || !this.cfg.plank) { toast("先放木板和支點石"); return; }
      var f = this.fuObj(), p = this.plankObj(), dl = clamp(this.cfg.dl - d * LV.step, f.h + 0.05, p.L - f.h - 0.05);
      this.cfg.xf = LV.loadX - Math.sqrt(dl * dl - f.h * f.h); SFX.tap(); this.reset();
    },
    nudgeLabel: function () { return this.cfg.fu && this.cfg.plank ? "支點離石頭<br>" + fmt(this.cfg.dl, 2) + " m" : "支點"; },
    canStart: function () {
      if (!this.cfg.plank || !this.cfg.fu) { toast(!this.cfg.plank ? "先拖一塊木板到石頭旁邊" : "再拖一顆支點石到木板下面"); return false; }
      return true;
    },
    start: function () { this.state = "run"; this.ph = this.r.reason === "noreach" ? "jump" : "press"; this.tm = 0; this.strainT = 0; },
    update: function (dt, hold) {
      var r = this.r; this.tm += dt;
      if (this.ph === "jump") { if (this.tm > 1.6) finish(this, { ok: false, reason: "noreach" }); return; }
      if (this.ph === "press") {
        if (hold) {
          if (r.reason === "heavy") { this.strainT += dt; if (Math.random() < dt * 4) SFX.strain(); if (this.strainT > 1.4) finish(this, { ok: false, reason: "heavy" }); return; }
          var dphi = 0.45 / r.de * dt;
          this.phi = Math.max(r.phi1, this.phi - dphi); if (Math.random() < dt * 3) SFX.creak();
          if (this.phi <= r.phi1 + 1e-6) {
            if (r.ok) { this.ph = "burst"; this.tm = 0; SFX.water(); var g = this.geo(this.phi); this.stoneOff = { x: g.load.x + 0.08, y: g.load.y + LV.stoneR, vx: -1.5, vy: 1.6, a: 0 }; }
            else { this.ph = "low"; this.tm = 0; SFX.thud(); }
          }
        } else if (this.phi < r.phi0) {
          this.phi = Math.min(r.phi0, this.phi + 2.2 * dt); if (this.phi >= r.phi0) SFX.thud();
        }
        return;
      }
      if (this.ph === "low") { if (this.tm > 1.0) finish(this, { ok: false, reason: "low" }); return; }
      if (this.ph === "burst") {
        var s = this.stoneOff; s.vy -= G * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.a += 4 * dt;
        if (s.y < LV.stoneR) { s.y = LV.stoneR; s.vy = Math.abs(s.vy) * 0.35; s.vx *= 0.7; if (Math.abs(s.vy) > 0.4) SFX.thud(); }
        this.water = Math.min(1, this.water + dt * 0.8);
        if (Math.random() < 0.6) burst(LV.loadX + 0.25, 0.2, 2, "#bfe8f5", 2.5, 1.5, 6, 0.035);
        if (this.tm > 2.2) finish(this, { ok: true, reason: "ok", star3: !this.cfg.box });
      }
    },
    render: function (t) {
      var r = this.r, c = this.cfg, f = this.fuObj(), p = this.plankObj();
      if (!bg("bg_spring")) { sky(); farHills(t); }
      // 山壁與出水口
      var v = visW(), hx = LV.loadX + 0.22;
      if (!tileGround("tex_rockwall", hx - 0.04, v.x1 + 1, 2.3, 3.6, "#6f6a5e")) {
        poly([[hx, -1], [hx, 2.1], [hx + 0.5, 2.4], [v.x1 + 1, 2.5], [v.x1 + 1, -1]], "#8f7a5a", INK, 2);
        poly([[hx, 2.1], [hx + 0.5, 2.4], [v.x1 + 1, 2.5], [v.x1 + 1, 2.35], [hx + 0.5, 2.25], [hx, 1.98]], "#6fa04a");
      }
      ctx.fillStyle = "#3b2c1c"; ctx.beginPath(); ctx.ellipse(hx + 0.02, 0.2, 0.08, 0.2, 0, 0, Math.PI * 2); ctx.fill();
      groundRect(v.x0 - 1, hx, 0);
      // 水流（成功後）
      if (this.water > 0) {
        var wl = lerp(hx, v.x0 - 1, this.water);
        poly([[wl, 0.0], [hx, 0.0], [hx, 0.14], [wl, 0.06]], "rgba(58,167,194,.85)");
        for (var k = 0; k < 6; k++) { var xx = hx - ((t * 2 + k * 0.7) % (hx - wl + 0.01)); line(xx, 0.08, xx - 0.25, 0.06, "rgba(255,255,255,.7)", 2); }
      } else { // 擠出來的小水滴
        if (Math.sin(t * 3) > 0.7) circle(hx - 0.02, 0.05 + ((t * 0.8) % 0.1), 0.02, "#7fc6e6");
      }
      dim(hx + 0.35, 0, hx + 0.35, LV.needRise, "要抬 40 cm");
      // 拖曳提示
      if (dragging) this.targets(dragging).forEach(function (tg) { if (tg.line) { ctx.save(); ctx.setLineDash([px(8), px(6)]); line(tg.line[0], tg.y + 0.02, tg.line[1], tg.y + 0.02, "#e0822b", 5); ctx.restore(); } else ringHint(tg.x, tg.y, tg.r, t); });
      else if (this.state === "build" && !p) ringHint(LV.loadX - 1.5, 0.05, 0.35, t);
      // 木箱
      var bx = this.boxX();
      if (c.box) crate(bx - 0.28, 0, 0.56, LV.boxUp);
      // 支點
      if (f) {
        var fx = c.xf;
        if (!sprite("fulcrum_" + f.id, fx, 0, { h: f.h }))
          poly([[fx - f.h * 0.9, 0], [fx + f.h * 0.9, 0], [fx + f.h * 0.25, f.h * 0.8], [fx, f.h], [fx - f.h * 0.3, f.h * 0.75]], this.grab ? "#a9a9a2" : "#8a8a84", INK, 2);
      }
      // 木板與石頭
      var g = this.geo(this.phi);
      if (g) {
        plank(g.eff.x, g.eff.y, g.load.x, g.load.y, 0.08, this.state === "build" && !f);
        if (this.state === "build") lengthLabel(g.eff.x, g.eff.y + 0.05, g.load.x, g.load.y + 0.05, p.L + " m");
      }
      if (this.stoneOff) rock(this.stoneOff.x, this.stoneOff.y, LV.stoneR, 3, "#7d7d76", this.stoneOff.a);
      else if (g) rock(g.load.x + 0.08, g.load.y + LV.stoneR - 0.01, LV.stoneR, 3, "#7d7d76");
      else rock(LV.loadX + 0.08, LV.stoneR, LV.stoneR, 3, "#7d7d76");
      // 小禾
      var base = c.box ? LV.boxUp : 0, kx = g && f ? clamp(this.geo(r.phi0).eff.x + 0.12, 0.35, 4.5) : 1.4;
      var kid = { x: kx, y: base, face: 1, t: t, mood: "ok" };
      if (this.state === "run" && g && f) {
        if (this.ph === "jump") {
          var jp = Math.abs(Math.sin(this.tm * 5)) * 0.25; kid.y = base + jp; kid.pose = "reach"; kid.hands = [{ x: kx + 0.05, y: base + 1.6 + jp }, { x: kx - 0.05, y: base + 1.6 + jp }]; kid.mood = "sad";
          bubble("搆不到！", kx, base + 1.9);
        } else {
          var e = g.eff, reachY = Math.min(e.y, base + 1.55);
          kid.hands = [{ x: e.x + 0.02, y: e.y }, { x: e.x + 0.06, y: e.y - 0.02 }];
          kid.squat = clamp((base + 1.2 - e.y) / 0.9, 0, 1);
          if (r.reason === "heavy" && holding) { kid.mood = "strain"; kid.y = base + Math.max(0, Math.sin(t * 12)) * 0.03; bubble("壓不下去……", kx, base + 1.9); }
          else if (this.ph === "burst") { kid.mood = "happy"; bubble("水來了！", kx, base + 1.7); }
          else if (this.ph === "low") { kid.mood = "sad"; bubble("還差一點……", kx, base + 1.6); }
          else if (holding) kid.mood = "strain";
        }
      }
      kidDraw(kid);
      if (this.state === "run" && holding && this.ph === "press" && r) effortMeter(Math.max(r.Freq, 0), kx, base + 1.5);
    },
    result: function (res) {
      var r = this.r, p = this.plankObj(), f = this.fuObj();
      var info = "木板 " + p.L + " m、" + f.name + "（高 " + Math.round(f.h * 100) + " cm）、支點離石頭 " + fmt(r.dl, 2) + " m（手那邊 " + fmt(r.de, 2) + " m）" + (r.box ? "、站木箱" : "");
      if (res.reason === "noreach") return { title: "搆不到", msg: "手那一端翹到 <b>" + fmt(r.ye0, 2) + " m</b> 高，小禾最高只搆到 " + fmt(r.reachMax, 1) + " m。", card: "noreach", sub: info };
      if (res.reason === "heavy") return { title: "壓不動", msg: "要壓下去得出 <b>" + fmt(r.Freq) + " N</b>，超過 200 N。", card: "heavy", sub: info };
      if (res.reason === "low") return { title: "抬不夠高", msg: "木板壓到底，石頭只抬高 <b>" + fmt(r.rise * 100) + " cm</b>，要 40 cm 水才沖得開。", card: "low", sub: info };
      return { title: "石頭撬開了！", card: "ok", sub: info,
        msg: "手這邊的力臂是石頭那邊的 " + fmt(r.de / r.dl, 1) + " 倍，所以只要出 " + fmt(r.Freq) + " N。",
        num: "小禾出力 <b>" + fmt(r.Freq) + " N</b> × 壓下 <b>" + fmt(r.ye0, 2) + " m</b> ＝ 約 <b>" + fmt(r.kidWork) + " J</b><br>石頭升高 " + fmt(r.rise, 2) + " m：50 × 9.8 × " + fmt(r.rise, 2) + " ≈ <b>" + fmt(r.stoneGain) + " J</b>" + (Math.abs(r.plankGain) > 1 ? "（木板重心升降 " + fmt(r.plankGain) + " J）" : "") + "<br>省了力，但手要多走好幾倍的距離。" };
    }
  };

  /* ---------- 第 3 關：滑輪 ---------- */
  var PU = M.PULLEY;
  var BEAM_Y = 3.35, PR = 0.12, BX = [2.78, 3.18, 3.58], GX = [2.54, 2.94, 3.34], GATE_W = 1.2, GATE_H = 1.0, KIDX = 5.6;
  var pulley = {
    id: "pulley", no: "第 3 站", name: "拉起水閘門", icon: "⚙️",
    view: { x0: -0.2, x1: 6.4, y0: -0.6, y1: 4.15 },
    brief: "<p>水閘門 <b>70 公斤</b>，要拉高 <b>1.5 公尺</b>，水才流得過去。直接抬要 686 N。</p><p>把滑輪拖到<b>橫梁</b>或<b>閘門</b>上的掛勾（每個滑輪 3 公斤），繩子會自動穿好。繩子只有 <b>7 公尺</b>。再<b>按住「出力」</b>拉。</p>",
    cards: {
      direct: { ic: "💪", t: "直接抬", d: "70 公斤的閘門重 686 N，比小禾的 200 N 大太多。" },
      fixedonly: { ic: "↕️", t: "定滑輪只改方向", d: "掛在橫梁上的滑輪不會動，叫定滑輪：讓你可以往下拉，但力氣一樣大。" },
      heavy: { ic: "🔗", t: "還是太重", d: "掛在閘門上、跟著一起動的叫動滑輪。每多一個動滑輪，就多兩段繩子一起撐住。" },
      up: { ic: "⤴️", t: "要往上拉", d: "最後一段繩子要從橫梁上的定滑輪下來，站在地上的小禾才拉得到。" },
      rope: { ic: "🧵", t: "繩子不夠長", d: "幾段繩子撐住，力就分成幾份，但繩子也要拉幾倍長。6 段要拉 9 m，繩子只有 7 m。" },
      ok: { ic: "🏗️", t: "數一數有幾段繩子", d: "4 段繩子撐住閘門，每段只要出四分之一的力；閘門升 1.5 m，繩子要拉 6 m。" }
    },
    order: ["direct", "fixedonly", "heavy", "up", "rope", "ok"],
    starText: ["拉起水閘門", "收集全部 6 張科學筆記", "只用 4 個滑輪"],
    init: function () { this.cfg = { beam: [false, false, false], gate: [false, false, false] }; this.reset(); },
    count: function () { var c = this.cfg; return { f: c.beam.filter(Boolean).length, m: c.gate.filter(Boolean).length }; },
    reset: function () {
      this.state = "build"; this.ph = ""; this.tm = 0; this.rise = 0; this.pulled = 0; this.strainT = 0; this.water = 0; this.rot = 0;
      var n = this.count(); this.r = M.evalPulley(n.f, n.m);
    },
    used: function () { var n = this.count(); return n.f + n.m; },
    tray: function () { var left = PU.have - this.used(); return [{ id: "pul", icon: "⚙️", art: "pulley", label: "滑輪", count: left, drag: left > 0, empty: left <= 0 }, { id: "clear", icon: "↩️", label: "全部拿下來", drag: false }]; },
    targets: function () {
      var me = this, out = [], gy = this.gateTop() + 0.3;
      BX.forEach(function (x, i) { if (!me.cfg.beam[i]) out.push({ x: x, y: BEAM_Y - 0.2, r: PR + 0.05 }); });
      GX.forEach(function (x, i) { if (!me.cfg.gate[i]) out.push({ x: x, y: gy, r: PR + 0.05 }); });
      return out;
    },
    gateTop: function () { return this.rise + GATE_H; },
    drop: function (id, w) {
      if (id !== "pul") return;
      if (this.used() >= PU.have) { toast("滑輪用完了"); return; }
      var best = null, bd = 0.45, me = this, gy = this.gateTop() + 0.3;
      BX.forEach(function (x, i) { var d = Math.hypot(w.x - x, w.y - (BEAM_Y - 0.2)); if (!me.cfg.beam[i] && d < bd) { bd = d; best = ["beam", i]; } });
      GX.forEach(function (x, i) { var d = Math.hypot(w.x - x, w.y - gy); if (!me.cfg.gate[i] && d < bd) { bd = d; best = ["gate", i]; } });
      if (!best) { toast("把滑輪放到發光的掛勾上"); return; }
      this.cfg[best[0]][best[1]] = true; SFX.place(); this.reset();
    },
    tap: function (id) {
      if (id === "clear") { this.cfg = { beam: [false, false, false], gate: [false, false, false] }; SFX.tap(); this.reset(); return; }
      toast("把滑輪拖到橫梁或閘門的掛勾上", 2200);
    },
    down: function (w) {   // 點一下已掛好的滑輪 = 拿下來
      if (this.state !== "build") return false;
      var me = this, gy = this.gateTop() + 0.3, hit = null;
      BX.forEach(function (x, i) { if (me.cfg.beam[i] && Math.hypot(w.x - x, w.y - (BEAM_Y - 0.2)) < 0.25) hit = ["beam", i]; });
      GX.forEach(function (x, i) { if (me.cfg.gate[i] && Math.hypot(w.x - x, w.y - gy) < 0.25) hit = ["gate", i]; });
      if (hit) { this.cfg[hit[0]][hit[1]] = false; SFX.tap(); this.reset(); return true; }
      return false;
    },
    canStart: function () { return true; },
    start: function () {
      var n = this.count(); this.state = "run"; this.tm = 0;
      this.ph = n.f === 0 && n.m === 0 ? "direct" : !this.r.dirDown ? "up" : "pull";
    },
    update: function (dt, hold) {
      var r = this.r; this.tm += dt;
      if (this.ph === "direct") { if (hold) { this.strainT += dt; if (Math.random() < dt * 4) SFX.strain(); if (this.strainT > 1.3) finish(this, { ok: false, reason: "direct" }); } return; }
      if (this.ph === "up") { if (this.tm > 1.5) finish(this, { ok: false, reason: "up" }); return; }
      if (this.ph === "pull") {
        if (hold) {
          if (r.Freq > KID) { this.strainT += dt; if (Math.random() < dt * 4) SFX.strain(); if (this.strainT > 1.4) finish(this, { ok: false, reason: r.reason }); return; }
          var v = 1.1;
          this.pulled = Math.min(PU.rope, this.pulled + v * dt); this.rise = this.pulled / r.n; this.rot += v * dt / PR;
          if (Math.random() < dt * 5) SFX.rope();
          if (this.rise >= PU.needRise) { this.rise = PU.needRise; this.ph = "flow"; this.tm = 0; SFX.water(); }
          else if (this.pulled >= PU.rope - 1e-6) { this.ph = "ropeout"; this.tm = 0; SFX.thud(); }
        } else if (this.rise > 0) {
          this.rise = Math.max(0, this.rise - 2.0 * dt); this.pulled = this.rise * r.n; this.rot -= 2.0 * r.n * dt / PR;
          if (this.rise === 0) { SFX.splash(); burst(3.0, 0.1, 25, "#bfe8f5", 2.5, 2.5, 9.8, 0.04); }
        }
        return;
      }
      if (this.ph === "ropeout") { if (this.tm > 1.1) finish(this, { ok: false, reason: "rope" }); return; }
      if (this.ph === "flow") {
        this.water = Math.min(1, this.water + dt * 0.9);
        if (Math.random() < 0.8) burst(3.0 + (Math.random() - 0.5) * 1.0, 0.25, 2, "#bfe8f5", 2, 2.5, 7, 0.04);
        var n = this.count();
        if (this.tm > 2.0) finish(this, { ok: true, reason: "ok", star3: n.f + n.m === 4 });
      }
    },
    ropePath: function () {
      var c = this.cfg, gy = this.gateTop() + 0.3, bs = [], gs = [], i;
      for (i = 0; i < 3; i++) { if (c.beam[i]) bs.push(BX[i]); if (c.gate[i]) gs.push(GX[i]); }
      var by = BEAM_Y - 0.2, pts = [], m = gs.length, f = bs.length, hand = [KIDX - 0.25, 1.05];
      function under(x) { for (var a = Math.PI; a <= 2 * Math.PI + 1e-6; a += Math.PI / 8) pts.push([x + PR * Math.cos(a), gy + PR * Math.sin(a)]); }
      function over(x) { for (var a = Math.PI; a >= -1e-6; a -= Math.PI / 8) pts.push([x + PR * Math.cos(a), by + PR * Math.sin(a)]); }
      if (m === 0) {
        if (f === 0) return { pts: null, segs: 0 };
        pts.push([3.0, this.gateTop()]);
        for (i = 0; i < f; i++) over(bs[i]);
        pts.push(hand); return { pts: pts, segs: 1 };
      }
      pts.push([gs[0] - PR, BEAM_Y - 0.05]);           // 繩頭綁在橫梁上
      for (i = 0; i < m; i++) {
        under(gs[i]);
        if (i < f) over(bs[i]);
        else { pts.push([gs[i] + PR, BEAM_Y + 0.55]); return { pts: pts, segs: 2 * m, loose: true }; }
      }
      for (i = m; i < f; i++) over(bs[i]);
      pts.push(hand); return { pts: pts, segs: 2 * m };
    },
    render: function (t) {
      var c = this.cfg, me = this, v = visW();
      if (!bg("bg_canal")) { sky("#a7d3ea", "#f5e6c6"); farHills(t); }
      // 水渠（正面看）
      groundRect(v.x0 - 1, 2.3, 0); groundRect(3.7, v.x1 + 1, 0);
      poly([[2.3, 0], [3.7, 0], [3.7, -0.4], [2.3, -0.4]], "#5c4a36");
      // 閘門後面的水
      poly([[2.3, 0], [3.7, 0], [3.7, 0.85 + Math.sin(t * 2) * 0.01], [2.3, 0.85 + Math.sin(t * 2.3) * 0.01]], "rgba(58,167,194,.55)");
      // 石柱與橫梁
      if (!texRect("tex_pillar", 2.05, 0, 2.3, BEAM_Y)) poly([[2.05, 0], [2.3, 0], [2.3, BEAM_Y], [2.05, BEAM_Y]], "#9b9b93", INK, 2);
      if (!texRect("tex_pillar", 3.7, 0, 3.95, BEAM_Y)) poly([[3.7, 0], [3.95, 0], [3.95, BEAM_Y], [3.7, BEAM_Y]], "#9b9b93", INK, 2);
      if (!texRect("tex_beam", 1.9, BEAM_Y - 0.05, 4.1, BEAM_Y + 0.17)) poly([[1.9, BEAM_Y - 0.05], [4.1, BEAM_Y - 0.05], [4.1, BEAM_Y + 0.15], [1.9, BEAM_Y + 0.15]], "#8a5a2b", INK, 2);
      // 閘門
      var gt = this.gateTop(), gb = this.rise;
      var k;
      if (!texRect("tex_gate", 2.4, gb, 3.6, gt)) {
        poly([[2.4, gb], [3.6, gb], [3.6, gt], [2.4, gt]], "#b07a40", INK, 2.5);
        for (k = 1; k < 4; k++) line(2.4 + k * 0.3, gb + 0.03, 2.4 + k * 0.3, gt - 0.03, "rgba(70,40,15,.5)", 1.5);
        line(2.42, gb + 0.5, 3.58, gb + 0.5, "#5a3a18", 4);
      }
      // 流出來的水
      if (this.water > 0 || gb > 0.05) {
        var hgt = Math.min(gb, 0.8) * (this.water > 0 ? 1 : 0.6);
        poly([[2.3, 0], [3.7, 0], [3.7, hgt], [2.3, hgt]], "rgba(90,190,215,.85)");
        for (k = 0; k < 7; k++) { var xx = 2.35 + k * 0.2; line(xx, hgt * ((t * 3 + k) % 1), xx + 0.05, hgt * ((t * 3 + k) % 1) - 0.12, "rgba(255,255,255,.75)", 2); }
      }
      if (this.water > 0) { var wv = visW(); poly([[2.3, -0.4], [3.7, -0.4], [3.7 + 2 * this.water, wv.y0 - 1], [2.3 - 2 * this.water, wv.y0 - 1]], "rgba(58,167,194,.7)"); }
      dim(4.15, gb, 4.15, gb + PU.needRise, "1.5 m");
      // 掛勾提示
      if (this.state === "build") {
        var showAll = dragging === "pul";
        BX.forEach(function (x, i) { if (!c.beam[i]) { if (showAll) ringHint(x, BEAM_Y - 0.2, PR + 0.05, t); else circle(x, BEAM_Y - 0.06, 0.03, INK); } });
        GX.forEach(function (x, i) { if (!c.gate[i]) { if (showAll) ringHint(x, gt + 0.3, PR + 0.05, t); else circle(x, gt + 0.05, 0.03, INK); } });
      }
      // 繩子
      var rp = this.ropePath(), gy = gt + 0.3;
      if (rp.pts) { rope(rp.pts); if (rp.loose) { circle(rp.pts[rp.pts.length - 1][0], rp.pts[rp.pts.length - 1][1], 0.04, "#8a6a3a"); } }
      // 動滑輪的吊繩
      GX.forEach(function (x, i) { if (c.gate[i]) { line(x, gy, x, gt, "#5a3a18", 3); pulleyDraw(x, gy, PR, me.rot); } });
      BX.forEach(function (x, i) { if (c.beam[i]) { line(x, BEAM_Y - 0.05, x, BEAM_Y - 0.2, "#5a3a18", 3); pulleyDraw(x, BEAM_Y - 0.2, PR, -me.rot); } });
      // 繩子堆
      var left = PU.rope - this.pulled;
      ctx.fillStyle = "#8a6a3a"; ctx.beginPath(); ctx.ellipse(KIDX + 0.55, 0.06, 0.12 + left * 0.025, 0.05 + left * 0.008, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = px(1.5); ctx.stroke();
      screenT(); ctx.font = "bold 12px " + getComputedStyle(document.body).fontFamily; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      var rl = "繩子剩 " + fmt(left, 1) + " m", rw = ctx.measureText(rl).width + 12, rx = sx(KIDX + 0.45), ry = sy(-0.12) + 8;
      ctx.fillStyle = "rgba(255,250,240,.9)"; roundRect(rx - rw / 2, ry - 9, rw, 18, 6); ctx.fill(); ctx.fillStyle = INK; ctx.fillText(rl, rx, ry); worldT();
      // 小禾
      var n = this.count(), kid = { x: KIDX, y: 0, face: -1, t: t, mood: "ok" };
      if (this.ph === "direct" || (this.state === "build" && n.f === 0 && n.m === 0)) { kid.x = 4.2; kid.hands = [{ x: 3.62, y: gb + 0.5 }, { x: 3.62, y: gb + 0.45 }]; if (holding && this.state === "run") { kid.mood = "strain"; kid.lean = 1; bubble("好重……抬不動", kid.x, 1.6); } }
      else if (rp.pts && !rp.loose) {
        kid.hands = [{ x: KIDX - 0.25, y: 1.05 }, { x: KIDX - 0.15, y: 0.95 }]; kid.lean = holding && this.state === "run" ? -0.8 : 0;
        if (this.state === "run" && holding) { kid.mood = r_over(this) ? "strain" : "ok"; if (r_over(this)) bubble("拉不動……", KIDX, 1.6); }
      }
      if (this.ph === "up") { kid.hands = [{ x: KIDX - 0.1, y: 1.6 }, { x: KIDX + 0.05, y: 1.55 }]; kid.mood = "sad"; bubble("繩子在上面，拉不到！", KIDX, 1.8); }
      if (this.ph === "ropeout") { kid.mood = "sad"; bubble("繩子拉完了！", KIDX, 1.7); }
      if (this.ph === "flow") { kid.mood = "happy"; bubble("水流過去了！", KIDX, 1.7); }
      kidDraw(kid);
      if (this.state === "run" && holding && (this.ph === "pull" || this.ph === "direct")) effortMeter(this.ph === "direct" ? 686 : this.r.Freq, kid.x, 1.4);
      function r_over(o) { return o.r.Freq > KID; }
    },
    result: function (res) {
      var r = this.r, n = this.count(), info = "定滑輪 " + n.f + " 個、動滑輪 " + n.m + " 個：撐住閘門的繩子 " + r.n + " 段";
      if (res.reason === "direct") return { title: "直接抬，抬不動", msg: "沒有滑輪，閘門重 <b>686 N</b>，小禾只有 200 N。", card: "direct" };
      if (res.reason === "fixedonly") return { title: "還是一樣重", msg: "只有定滑輪：可以往下拉了，但還是要出 <b>" + fmt(r.Freq) + " N</b>。", card: "fixedonly", sub: info };
      if (res.reason === "heavy") return { title: "還是太重", msg: "要出 <b>" + fmt(r.Freq) + " N</b>（閘門加滑輪 " + fmt(r.W) + " N ÷ " + r.n + " 段），超過 200 N。", card: "heavy", sub: info };
      if (res.reason === "up") return { title: "要往上拉", msg: "繩子最後一段是從動滑輪往上走，站在地上的小禾拉不到。定滑輪的數量要跟動滑輪一樣多。", card: "up", sub: info };
      if (res.reason === "rope") return { title: "繩子不夠長", msg: "拉了 7 m，閘門只升高 <b>" + fmt(PU.rope / r.n * 100) + " cm</b>；要升 1.5 m，得拉 " + fmt(r.pull, 1) + " m。", card: "rope", sub: info };
      return { title: "水閘門拉起來了！", card: "ok", sub: info,
        msg: r.n + " 段繩子一起撐住，每段只要出 " + fmt(r.Freq) + " N。",
        num: "小禾出力 <b>" + fmt(r.Freq) + " N</b> × 拉了 <b>" + fmt(r.pull, 1) + " m</b> ＝ 約 <b>" + fmt(r.kidWork) + " J</b><br>閘門加滑輪重 " + fmt(r.W) + " N × 升高 1.5 m ＝ <b>" + fmt(r.gain) + " J</b><br>功一樣多：力變成 1/" + r.n + "，距離變成 " + r.n + " 倍。" };
    }
  };

  /* ---------- 終點：水回來了 ---------- */
  var ending = {
    id: "ending", view: { x0: -0.5, x1: 8.5, y0: -0.6, y1: 3.4 }, noTray: true,
    init: function () { this.cfg = {}; this.reset(); }, reset: function () { this.state = "end"; this.ang = 0; },
    tray: function () { return []; }, canStart: function () { return false; },
    update: function () {}, render: function (t) {
      if (!bg("bg_village")) { sky("#ffd59a", "#fdf0d8"); farHills(t); }
      waterBody(-2, 10, 0.25, t, "rgba(58,167,194,.9)");
      groundRect(5.6, 12, 0.6); groundRect(-3, 1.0, 0.6);
      this.ang -= 0.012; wheelDraw(5.2, 1.0, 0.9, this.ang);
      line(5.2, 1.0, 5.9, 0.6, "#6b4524", 7); line(5.2, 1.0, 5.9, 1.9, "#6b4524", 5);
      // 房子
      if (!sprite("house", 7.0, 0.6, { w: 1.7 })) {
        poly([[6.4, 0.6], [7.6, 0.6], [7.6, 1.5], [6.4, 1.5]], "#e8d3a8", INK, 2); poly([[6.25, 1.5], [7.75, 1.5], [7.0, 2.1]], "#c4561f", INK, 2);
        poly([[6.85, 0.6], [7.15, 0.6], [7.15, 1.05], [6.85, 1.05]], "#7a4f22", INK, 1.5);
      }
      kidDraw({ x: 0.4, y: 0.6, face: 1, t: t, mood: "happy", hands: [{ x: 0.2, y: 1.9 + Math.sin(t * 6) * 0.1 }, { x: 0.65, y: 1.9 + Math.cos(t * 6) * 0.1 }] });
      if (Math.random() < 0.3) burst(4.6 + Math.random() * 0.4, 0.3, 1, "#d6f1fa", 1.5, 2, 6, 0.04);
    }
  };

  var LEVELS = [ramp, lever, pulley];

  /* ================= 結果與筆記 ================= */
  function finish(lv, res) {
    if (lv.state === "result") return;
    lv.state = "result"; holding = false; $("holdBtn").classList.remove("down");
    var info = lv.result(res), sv = lvSave(lv.id), newCard = null;
    if (info.card && !sv.cards[info.card]) { sv.cards[info.card] = true; newCard = info.card; }
    var starsNow = [false, false, false];
    if (res.ok) {
      sv.done = true;
      starsNow = [true, lv.order.every(function (k) { return sv.cards[k]; }), !!res.star3];
      for (var i = 0; i < 3; i++) sv.stars[i] = sv.stars[i] || starsNow[i];
      SFX.win(); burst(lv.id === "ramp" ? 7 : lv.id === "lever" ? 5 : 3, 2, 40, "#ffd166", 4, 4, 6, 0.05);
    } else SFX.fail();
    if (newCard) setTimeout(SFX.card, 350);
    persist(); updateNoteCount();
    var html = "<h2>" + (res.ok ? "🎉 " : "") + info.title + "</h2>";
    if (res.ok) html += "<div class='big'>" + starsNow.map(function (s) { return s ? "★" : "☆"; }).join("") + "</div>" +
      "<p style='font-size:13px;text-align:center;margin-top:-4px'>" + lv.starText.map(function (s, i) { return (starsNow[i] ? "★ " : "☆ ") + s; }).join("<br>") + "</p>";
    html += "<p>" + info.msg + "</p>";
    if (info.sub) html += "<p style='font-size:13px;color:#6b5a44'>" + info.sub + "</p>";
    if (info.num) html += "<div class='num'>" + info.num + "</div>";
    if (newCard) { var cd = lv.cards[newCard]; html += "<div class='card newcard'><div class='ci'>" + cd.ic + "</div><div><b>新的科學筆記：" + cd.t + "</b><span>" + cd.d + "</span></div></div>"; }
    else if (info.card && !res.ok) html += "<p style='font-size:13px;color:#6b5a44'>（這張科學筆記已經有了，試試別的做法？）</p>";
    var btns = [{ t: "再試一次", pri: !res.ok, f: function () { closeModal(); lv.reset(); refreshUI(); } }];
    if (res.ok) btns.push({ t: "回路線圖", pri: true, f: function () { closeModal(); showHub(); } });
    setTimeout(function () { openModal(html, btns); }, res.ok ? 400 : 250);
  }
  function showNotes() {
    var lv = cur, sv = lvSave(lv.id), html = "<h2>📒 科學筆記：" + lv.name + "</h2><p style='font-size:14px'>每一種失敗都是一個發現。收集全部筆記可以拿到一顆星。</p>";
    lv.order.forEach(function (k) {
      var c = lv.cards[k], has = sv.cards[k];
      html += "<div class='card" + (has ? "" : " lock") + "'><div class='ci'>" + (has ? c.ic : "❔") + "</div><div><b>" + (has ? c.t : "還沒發現") + "</b><span>" + (has ? c.d : "換個做法試試看，也許失敗就會發現它。") + "</span></div></div>";
    });
    openModal(html, [{ t: "關閉", pri: true, f: closeModal }]);
  }
  function updateNoteCount() { if (!cur || !cur.order) return; var sv = lvSave(cur.id); $("noteCount").textContent = cur.order.filter(function (k) { return sv.cards[k]; }).length + "/" + cur.order.length; }

  /* ================= 彈出視窗 ================= */
  function openModal(html, btns) {
    $("modalBody").innerHTML = html;
    var b = $("modalBtns"); b.innerHTML = "";
    (btns || []).forEach(function (x) { var el = document.createElement("button"); el.textContent = x.t; if (x.pri) el.className = "pri"; el.onclick = function () { SFX.tap(); x.f(); }; b.appendChild(el); });
    $("modal").hidden = false;
  }
  function closeModal() { $("modal").hidden = true; }

  /* ================= 路線圖 ================= */
  var STORY = "山上的泉水斷了，村子已經好幾天沒水。小禾在舊倉庫找到一張泛黃的路線圖：<b>先把水車輪推上河岸，再撬開堵住出水口的石頭，最後拉起水閘門</b>，水就會回到村子。<br>問題是小禾力氣不大。要怎麼做到？靠科學。";
  function showHub() {
    cur = null; holding = false;
    $("level").hidden = true; $("hub").hidden = false;
    $("story").innerHTML = STORY;
    var box = $("nodes"); box.innerHTML = "";
    var prevDone = true;
    LEVELS.forEach(function (lv, i) {
      var sv = lvSave(lv.id), stars = sv.stars.map(function (s) { return s ? "★" : "☆"; }).join(""), got = lv.order.filter(function (k) { return sv.cards[k]; }).length;
      var b = document.createElement("button"); b.className = "node" + (sv.done ? " done" : ""); b.disabled = !prevDone;
      b.innerHTML = "<div class='ic'>" + lv.icon + "</div><div><small>" + lv.no + (prevDone ? "" : "（先完成上一站）") + "</small><b>" + lv.name + "</b><small>" + ["斜面", "槓桿", "滑輪"][i] + "</small></div><div class='st'>" + stars + "<small>筆記 " + got + "/" + lv.order.length + "</small></div>";
      b.onclick = function () { SFX.tap(); enterLevel(lv); };
      box.appendChild(b);
      var ln = document.createElement("div"); ln.className = "link"; box.appendChild(ln);
      prevDone = sv.done;
    });
    var fin = document.createElement("button"); fin.className = "node final"; fin.disabled = !prevDone;
    fin.innerHTML = "<div class='ic'>💧</div><div><small>終點</small><b>水回到村子</b><small>" + (prevDone ? "點我看看！" : "完成三站就會解鎖") + "</small></div><div class='st'></div>";
    fin.onclick = function () { SFX.tap(); enterEnding(); };
    box.appendChild(fin);
    if (!save.intro) { save.intro = true; persist(); }
  }
  function enterEnding() {
    enterLevel(ending, true);
    openModal("<h2>💧 水回到村子了！</h2><p>水車輪推上了河岸、出水口的石頭撬開了、水閘門也拉起來了。水嘩啦啦流進村子，水車轉了起來。</p><div class='num'><b>這一章你發現的事</b><br>・斜面、槓桿、滑輪都能<b>省力</b>，但都要<b>多走距離</b>。<br>・力 × 距離＝功。機械省力，不省功。<br>・定滑輪改方向，動滑輪省力；槓桿看力臂。</div><p style='font-size:14px;color:#6b5a44'>下一章（構想中）：水車轉起來了，能不能讓村子的燈亮起來？</p>",
      [{ t: "看看村子", f: closeModal }, { t: "回路線圖", pri: true, f: function () { closeModal(); showHub(); } }]);
  }

  /* ================= 關卡畫面 ================= */
  function enterLevel(lv, quiet) {
    cur = lv; parts.length = 0;
    if (!lv.cfg) lv.init(); else lv.reset();
    $("hub").hidden = true; $("level").hidden = false;
    $("lvNo").textContent = lv.no || ""; $("lvName").textContent = lv.name || "水回到村子";
    $("noteBtn").hidden = !lv.order; $("briefBtn").hidden = !lv.brief;
    $("holdBtn").hidden = !!lv.noTray;
    updateNoteCount(); refreshUI();
    requestAnimationFrame(resize);
    if (!quiet && lv.brief) openModal("<h2>" + lv.no + "　" + lv.name + "</h2>" + lv.brief, [{ t: "開始", pri: true, f: closeModal }]);
  }
  function refreshUI() {
    var lv = cur, tray = $("tray"); tray.innerHTML = "";
    if (!lv) return;
    var build = lv.state === "build";
    lv.tray().forEach(function (it) {
      var b = document.createElement("button");
      b.className = "part" + (it.on ? " on" : "") + (it.empty ? " empty" : ""); b.dataset.id = it.id; b.dataset.drag = it.drag ? "1" : "";
      b.innerHTML = (it.art && ART[it.art] ? "<img class='pimg' alt='' src='" + ART[it.art].src + "'>" : "<span class='pi'>" + it.icon + "</span>") + "<span class='pl'>" + it.label + "</span>" + (it.count != null ? "<span class='pc'>" + it.count + "</span>" : "");
      b.disabled = !build;
      tray.appendChild(b);
    });
    var nd = $("nudge"); nd.hidden = !(lv.nudge && build);
    if (lv.nudge) $("nudgeLabel").innerHTML = lv.nudgeLabel();
    $("holdBtn").disabled = !(build || lv.state === "run");
  }

  /* ---------- 從工具列拖曳 ---------- */
  var dragging = null, dragStart = null, dragEl = null;
  $("tray").addEventListener("pointerdown", function (e) {
    var b = e.target.closest(".part"); if (!b || b.disabled || !cur || cur.state !== "build") return;
    dragStart = { id: b.dataset.id, x: e.clientX, y: e.clientY, can: b.dataset.drag === "1", moved: false, label: b.querySelector(".pl").textContent };
    dragEl = b; try { b.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  window.addEventListener("pointermove", function (e) {
    if (!dragStart) return;
    if (!dragStart.moved && Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) > 10 && dragStart.can) { dragStart.moved = true; dragging = dragStart.id; var gh = $("ghost"); gh.textContent = dragStart.label; gh.hidden = false; }
    if (dragStart.moved) { var g = $("ghost"); g.style.left = e.clientX + "px"; g.style.top = e.clientY + "px"; }
  });
  function endTrayDrag(e) {
    if (!dragStart) return;
    var d = dragStart; dragStart = null; $("ghost").hidden = true;
    if (d.moved) {
      dragging = null;
      var r = cv.getBoundingClientRect();
      if (e && e.type === "pointerup" && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        cur.drop(d.id, toWorld(e.clientX - r.left, e.clientY - r.top)); refreshUI();
      }
    } else if (e && e.type === "pointerup") { cur.tap(d.id); refreshUI(); }
  }
  window.addEventListener("pointerup", endTrayDrag);
  window.addEventListener("pointercancel", endTrayDrag);

  /* ---------- 畫面上拖曳 ---------- */
  var cvGrab = false;
  cv.addEventListener("pointerdown", function (e) {
    if (!cur || !cur.down) return; ac();
    var r = cv.getBoundingClientRect();
    if (cur.down(toWorld(e.clientX - r.left, e.clientY - r.top))) { cvGrab = true; try { cv.setPointerCapture(e.pointerId); } catch (err) {} refreshUI(); }
  });
  cv.addEventListener("pointermove", function (e) {
    if (!cvGrab || !cur.move) return; var r = cv.getBoundingClientRect(); cur.move(toWorld(e.clientX - r.left, e.clientY - r.top)); refreshNudge();
  });
  function cvUp() { if (cvGrab) { cvGrab = false; if (cur.up) cur.up(); refreshUI(); } }
  cv.addEventListener("pointerup", cvUp); cv.addEventListener("pointercancel", cvUp);
  function refreshNudge() { if (cur && cur.nudge) $("nudgeLabel").innerHTML = cur.nudgeLabel(); }
  $("nudge").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b || !cur || cur.state !== "build") return; cur.nudge(+b.dataset.d); refreshNudge(); });

  /* ---------- 按住出力 ---------- */
  var hb = $("holdBtn");
  function holdDown(e) {
    if (e) e.preventDefault(); ac();
    if (!cur || hb.disabled) return;
    if (cur.state === "build") { if (!cur.canStart()) return; cur.start(); refreshUI(); }
    if (cur.state === "run") { holding = true; hb.classList.add("down"); }
  }
  function holdUp() { holding = false; hb.classList.remove("down"); }
  hb.addEventListener("pointerdown", function (e) { try { hb.setPointerCapture(e.pointerId); } catch (err) {} holdDown(e); });
  hb.addEventListener("pointerup", holdUp); hb.addEventListener("pointercancel", holdUp); hb.addEventListener("lostpointercapture", holdUp);
  hb.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  window.addEventListener("keydown", function (e) { if (e.code === "Space" && !e.repeat && $("modal").hidden) holdDown(e); });
  window.addEventListener("keyup", function (e) { if (e.code === "Space") holdUp(); });
  window.addEventListener("blur", holdUp);

  /* ---------- 其他按鈕 ---------- */
  $("lvBack").onclick = function () { SFX.tap(); showHub(); };
  $("noteBtn").onclick = function () { SFX.tap(); showNotes(); };
  $("briefBtn").onclick = function () { SFX.tap(); if (cur && cur.brief) openModal("<h2>" + cur.no + "　" + cur.name + "</h2>" + cur.brief, [{ t: "知道了", pri: true, f: closeModal }]); };
  function soundIcon() { $("soundBtn").textContent = save.sound ? "🔊" : "🔇"; }
  $("soundBtn").onclick = function () { save.sound = !save.sound; persist(); soundIcon(); SFX.tap(); };
  soundIcon();

  /* ---------- 標示 ---------- */
  function dim(x1, y1, x2, y2, label) {
    line(x1, y1, x2, y2, "rgba(43,33,24,.6)", 1.5);
    line(x1 - 0.06, y1, x1 + 0.06, y1, "rgba(43,33,24,.6)", 1.5); line(x2 - 0.06, y2, x2 + 0.06, y2, "rgba(43,33,24,.6)", 1.5);
    screenT(); ctx.font = "bold 12px " + getComputedStyle(document.body).fontFamily;
    var tw = ctx.measureText(label).width + 10, tx = sx(x1) + 5, ty = sy((y1 + y2) / 2);
    ctx.fillStyle = "rgba(255,250,240,.88)"; roundRect(tx, ty - 9, tw, 18, 6); ctx.fill();
    ctx.fillStyle = INK; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(label, tx + 5, ty); worldT();
  }
  function lengthLabel(x1, y1, x2, y2, label) {
    screenT(); var mx = sx((x1 + x2) / 2), my = sy((y1 + y2) / 2) - 14;
    ctx.font = "bold 12px " + getComputedStyle(document.body).fontFamily; var w = ctx.measureText(label).width + 10;
    ctx.fillStyle = "rgba(255,250,240,.9)"; roundRect(mx - w / 2, my - 9, w, 18, 6); ctx.fill();
    ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, mx, my); worldT();
  }

  /* ================= 主迴圈 ================= */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
    if (cur && !$("level").hidden) {
      if (cur.state === "run") cur.update(dt, holding);
      stepParts(dt); cam.shake *= 0.9;
      ctx.save(); worldT(); cur.render(clock); drawParts(); ctx.restore();
    }
    requestAnimationFrame(frame);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", function () { setTimeout(resize, 200); });
  showHub();
  requestAnimationFrame(frame);

  // 給自動測試用
  window.__village = { levels: LEVELS, enter: function (i) { enterLevel(LEVELS[i], true); closeModal(); }, cur: function () { return cur; }, finishModal: closeModal, refresh: refreshUI, save: save };
})();
