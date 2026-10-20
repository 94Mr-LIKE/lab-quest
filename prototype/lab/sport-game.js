/* 瘋狂實驗室・生活／運動物理挑戰（老闆 10/20：生活中的科學；發射位置固定；靶子、碰撞次數；投籃、射箭……；「畫面好看一點，這是遊戲」）
 * 物理由 sport-sim.js 算；這裡負責畫面、操作、計分、特效。單位：公尺、公斤、秒。
 * 美術分工：場景背景和人物是 GPT 畫的圖（img/sport/）；要算物理的東西（球、籃框、籃板、鈴、鐵牌、靶、牆、得分箱、車）由程式照真實尺寸畫，位置跟模擬一致。
 * 模擬分「判定」（st.judged，結果定了）和「動畫」（st.done，球落地、鐵牌擺停）：判定後畫面繼續跑，東西不會停在半空。
 * innerHTML 只放程式內建的文字與算出來的數字，沒有玩家輸入的文字。 */
(function () {
  'use strict';
  var LV = window.SPORT_LEVELS, SIM = window.SportSim;
  var no = Math.max(1, Math.min(LV.length, parseInt(new URLSearchParams(location.search).get('lv'), 10) || 1));
  var L = LV[no - 1];
  function $(s) { return document.querySelector(s); }
  function sfx(n, d) { if (window.LabSfx) window.LabSfx.play(n, d); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function fx(x, d) { return Number(x).toFixed(d); }
  var cv = $('#cv'), ctx = cv.getContext('2d'), wrap = $('#stageWrap'), dataBox = $('#data'), bar = $('#ctrlbar');
  var W = 0, H = 0, DPR = 1, view = { sx: 50, sy: 50, ox: 0, oy: 0 };
  var calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);   // 系統設定「減少動態」：不震動畫面

  // ---------- 狀態 ----------
  var P = {};   // 玩家調的參數
  Object.keys(L.ctrl).forEach(function (k) { P[k] = L.ctrl[k].init; });
  var archery = L.rule === 'archery', rounds = !!L.rounds;   // 輪次制：射箭、一發入魂（每輪 1 發）
  var S = { shot: 0, results: [], st: null, mode: 'aim', traces: [], over: false, holes: [], stuck: [], postT: 0, backT: 0,
    round: rounds ? 0 : 1, practice: archery ? (L.practice || 0) : 0, wind: 0, winds: [], targets: [], devs: [], boxFrom: null, boxT: 1 };
  if (archery) { for (var i = 0; i < L.rounds; i++) S.winds.push(Math.round((L.winds[0] + Math.random() * (L.winds[1] - L.winds[0])) * 10) / 10); }
  if (archery && !S.practice) S.wind = S.winds[0];
  if (L.sim === 'snipe') { for (var j = 0; j < L.rounds; j++) S.targets.push(SIM.snipeTarget(L, Math.random)); }
  function totalShots() { return rounds ? L.rounds : L.shots; }

  // ---------- 美術素材 ----------
  var IMG = {};
  function img(n) { var im = IMG[n]; if (!im) { im = IMG[n] = new Image(); im.src = 'img/sport/' + n; } return im.complete && im.naturalWidth ? im : null; }
  // 背景對位：背景圖上 (ax, ay) 這一點放在世界座標 (wx, wy)；ppm＝背景圖上 1 公尺幾 px（照圖裡的地板、門、櫃台估的）
  var BG = {
    hoop: { src: 'bg_gym.jpg', ax: 1105, ay: 900, wx: 5.45, wy: 0, ppm: 110, fill: '#1d2f45' },
    bell: { src: 'bg_corridor.jpg', ax: 1330, ay: 840, wx: 3.0, wy: 0, ppm: 287, doorTop: 305, fill: '#2a3d52' },
    pend: { src: 'bg_nightmarket.jpg', ax: 768, ay: 735, wx: 0.25, wy: 0.95, ppm: 758, fill: '#1a1430' },   // 櫃台在畫面下緣外，上面看得到獎品架
    snipe: { src: 'bg_robot_arena.jpg', ax: 768, ay: 697, wx: 0.47, wy: 0, ppm: 560, fill: '#141a3a' },     // 比賽桌桌面＝y 0
    park: { src: 'bg_freight.jpg', ax: 768, ay: 678, wx: 0.95, wy: -0.025, ppm: 560, fill: '#3a3530', blur: 1.5 }   // 倉庫在遠處（模糊一點），前面是測試桌
  };
  // 角色：角色圖上 (ax, ay) 這一點放在「手／箭尖／槍口」的世界座標；ppm＝角色圖上 1 公尺幾 px（照真實身高、槍長算）
  var SPR = {
    shooter: { src: 'shooter.png', ax: 196.3, ay: 2.2, ppm: 274 },     // 手背上緣（球在手上面）；身高約 1.82 m
    thrower: { src: 'thrower.png', ax: 201.8, ay: 224.8, ppm: 332.9 },  // 手掌上緣；身高約 1.55 m
    archer: { src: 'archer.png', ax: 349.9, ay: 173.6, ppm: 247.5 },    // 箭尖；身高約 1.86 m
    toygun: { src: 'toygun.png', ax: 418.6, ay: 24.6, ppm: 688 }        // 槍口；槍長約 0.61 m，支架底座在櫃台上
  };
  var SCENE = { hoop: ['bg_gym.jpg', 'shooter.png'], bell: ['bg_corridor.jpg', 'thrower.png'], pend: ['bg_nightmarket.jpg', 'toygun.png'], arrow: ['bg_archery.jpg', 'archer.png'], snipe: ['bg_robot_arena.jpg'], park: ['bg_freight.jpg'] }[L.sim];
  SCENE.forEach(img);   // 先開始載入

  // ---------- 座標 ----------
  // 投籃、走廊、夜市、一發入魂、停車格：整個場地放進畫面（等比例）。射箭：70 m 放不進一個畫面，改成等比例的鏡頭跟著箭走，下面有全程小地圖。
  var CAM0 = -2.4, cam = { x: CAM0 };
  function resize() {
    var r = wrap.getBoundingClientRect(); W = r.width; H = r.height; DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    if (archery) { view.band = Math.max(30, Math.round(H * 0.15)); view.oy = H - view.band; view.sx = view.sy = Math.min(view.oy / 3.3, W / 8); setCam(cam.x); return; }
    var w = L.world, ww = w.x1 - w.x0, wh = w.y1 - w.y0, s = Math.min(W / ww, (H - 10) / wh);
    view.sx = view.sy = s; view.ox = (W - ww * s) / 2 - w.x0 * s; view.oy = H - 4 + w.y0 * s;
  }
  function setCam(x) { cam.x = x; view.ox = -x * view.sx; }
  function camMax() { return L.dist - 0.62 * W / view.sx; }   // 鏡頭最遠停在靶出現在畫面 62% 的地方（右上角是靶面放大圖）
  function X(x) { return view.ox + x * view.sx; }
  function Y(y) { return view.oy - y * view.sy; }

  // ---------- 畫圖小工具（螢幕座標） ----------
  function line(x0, y0, x1, y1, c, w) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
  function circ(x, y, r, fill, stroke, w) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = w || 1.5; ctx.stroke(); } }
  function rect(x0, y0, x1, y1, fill, stroke, w) { ctx.beginPath(); ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = w || 1.5; ctx.stroke(); } }
  function rrect(x, y, w, h, r, fill, stroke, lw) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); } }
  function text(t, x, y, o) { o = o || {}; ctx.font = (o.weight || 800) + ' ' + (o.size || 12) + 'px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif'; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle'; if (o.stroke) { ctx.lineWidth = o.sw || 3.5; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(t, x, y); } ctx.fillStyle = o.color || '#fff'; ctx.fillText(t, x, y); }
  function textIn(t, x, y, o) {   // 文字一律留在畫布裡（太靠右就靠右對齊、太靠左就靠左對齊）
    o = o || {}; ctx.font = (o.weight || 800) + ' ' + (o.size || 12) + 'px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
    var w = ctx.measureText(t).width, a = o.align || 'center', x0 = a === 'center' ? x - w / 2 : a === 'right' ? x - w : x;
    if (x0 + w > W - 6) { x = W - 6; o.align = 'right'; } else if (x0 < 6) { x = 6; o.align = 'left'; }
    text(t, x, clamp(y, 10, H - 8), o);
  }
  function grad(y0, y1, a, b) { var g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function tileX(im, x0, y, w, h, sy, sh) {   // 背景左右用鏡像接起來（接縫看不出來），蓋滿整個寬度
    if (w < 4 || h <= 0) return;
    for (var i = Math.floor(-x0 / w); i <= Math.floor((W - x0) / w); i++) {
      var x = x0 + i * w;
      if (i % 2) { ctx.save(); ctx.translate(x + w, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, sy, im.naturalWidth, sh, 0, y, w + 0.6, h); ctx.restore(); }
      else ctx.drawImage(im, 0, sy, im.naturalWidth, sh, x, y, w + 0.6, h);
    }
  }
  function drawBg(c) {
    var im = img(c.src); if (!im) { ctx.fillStyle = c.fill; ctx.fillRect(0, 0, W, H); return; }
    var k = view.sx / c.ppm, ih = im.naturalHeight, w = im.naturalWidth * k, h = ih * k, x0 = X(c.wx) - c.ax * k, y0 = Y(c.wy) - c.ay * k;
    if (c.blur && 'filter' in ctx) ctx.filter = 'blur(' + c.blur + 'px)';
    tileX(im, x0, y0, w, h, 0, ih);
    if (c.blur && 'filter' in ctx) ctx.filter = 'none';
    if (y0 > 0) tileX(im, x0, 0, w, y0 + 1, 0, 1);                              // 上面沒蓋到：拉長最上面一列（天花板）
    if (y0 + h < H) tileX(im, x0, y0 + h - 1, w, H - y0 - h + 1, ih - 1, 1);   // 下面沒蓋到：拉長最下面一列（地板）
  }
  function drawSpr(n, wx, wy) {   // 角色圖：對位點放在世界座標 (wx, wy)，大小照真實尺寸
    var c = SPR[n], im = img(c.src); if (!im) return false;
    var k = view.sy / c.ppm; ctx.drawImage(im, X(wx) - c.ax * k, Y(wy) - c.ay * k, im.naturalWidth * k, im.naturalHeight * k); return true;
  }
  function person(x, feetY, h, armTo, color) {   // 圖還沒載入時的人形剪影
    var c = color || '#0e1a2b', head = h * 0.13;
    ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineCap = 'round';
    circ(x, feetY - h + head, head, c);
    ctx.lineWidth = h * 0.16; ctx.beginPath(); ctx.moveTo(x, feetY - h + head * 2.1); ctx.lineTo(x, feetY - h * 0.45); ctx.stroke();
    ctx.lineWidth = h * 0.09; ctx.beginPath(); ctx.moveTo(x, feetY - h * 0.47); ctx.lineTo(x - h * 0.08, feetY); ctx.moveTo(x, feetY - h * 0.47); ctx.lineTo(x + h * 0.08, feetY); ctx.stroke();
    if (armTo) { ctx.lineWidth = h * 0.065; ctx.beginPath(); ctx.moveTo(x, feetY - h * 0.78); ctx.lineTo(armTo.x, armTo.y); ctx.stroke(); }
    ctx.lineCap = 'butt';
  }
  function bellShape(r, fill) {   // 鈴（原點在鈴頂，往下 1.75r 是鈴口）
    var g = ctx.createLinearGradient(-r, 0, r, 0); g.addColorStop(0, '#b8860b'); g.addColorStop(0.35, fill || '#ffe27a'); g.addColorStop(1, '#a87400');
    ctx.beginPath(); ctx.moveTo(-1.08 * r, 1.75 * r); ctx.bezierCurveTo(-0.98 * r, 0.9 * r, -0.78 * r, 0, 0, 0); ctx.bezierCurveTo(0.78 * r, 0, 0.98 * r, 0.9 * r, 1.08 * r, 1.75 * r); ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#13233f'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 1.75 * r, 1.08 * r, 0.2 * r, 0, 0, Math.PI * 2); ctx.fillStyle = '#7a5200'; ctx.fill(); ctx.stroke();
  }

  // ---------- 特效：粒子、跳字、震動 ----------
  var FX = { parts: [], pops: [], shake: 0, net: -1, bell: -1, pbell: -1, flash: 0, bellOff: null };
  var CONF = ['#ffd84d', '#ff6a55', '#5dffa0', '#7ce0ff', '#ffffff', '#c58cff'];
  function burst(x, y, n, o) {
    o = o || {};
    for (var i = 0; i < n; i++) {
      var a = o.a0 !== undefined ? o.a0 + (Math.random() - 0.5) * (o.spread || 1) : Math.random() * Math.PI * 2, v = (o.v || 160) * (0.35 + Math.random() * 0.9);
      FX.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: -Math.sin(a) * v, g: o.g === undefined ? 420 : o.g, life: (o.life || 0.8) * (0.6 + Math.random() * 0.7), t: 0,
        c: o.colors ? o.colors[i % o.colors.length] : (o.color || '#ffd84d'), s: (o.size || 3) * (0.6 + Math.random() * 0.8), conf: !!o.confetti, rot: Math.random() * 6 });
    }
  }
  function popup(t, x, y, o) { o = o || {}; FX.pops.push({ t: t, x: clamp(x, 50, W - 50), y: clamp(y, 30, H - 20), age: 0, life: o.life || 1.2, size: o.size || 22, color: o.color || '#ffd84d' }); }
  function shake(m) { if (!calm) FX.shake = Math.max(FX.shake, m); }
  function celebrate() {   // 成功的彩帶從畫面上緣兩邊噴，不從目標正中間炸開（不要蓋住「有沒有碰到」的證據）
    setTimeout(function () { burst(10, 10, 26, { confetti: true, v: 300, g: 260, colors: CONF, life: 1.6, size: 4, a0: -0.55, spread: 0.9 }); burst(W - 10, 10, 26, { confetti: true, v: 300, g: 260, colors: CONF, life: 1.6, size: 4, a0: Math.PI + 0.55, spread: 0.9 }); }, 250);
  }
  function stepFx(dt) {
    FX.parts = FX.parts.filter(function (p) { p.t += dt; p.vy += p.g * dt; if (p.conf) { p.vx *= 1 - 1.5 * dt; p.vy = Math.min(p.vy, 140); } p.x += p.vx * dt; p.y += p.vy * dt; return p.t < p.life; });
    FX.pops = FX.pops.filter(function (q) { q.age += dt; return q.age < q.life; });
    FX.shake *= Math.exp(-dt * 9); if (FX.shake < 0.3) FX.shake = 0;
    ['net', 'bell', 'pbell'].forEach(function (k) { if (FX[k] >= 0) { FX[k] += dt; if (FX[k] > 3) FX[k] = -1; } });
    FX.flash = Math.max(0, FX.flash - dt * 6);
    var b = FX.bellOff; if (b) { b.t += dt; b.vy -= 9.8 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.w * dt; }
  }
  function drawFx() {
    FX.parts.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      if (p.conf) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.t * 9); ctx.fillStyle = p.c; ctx.fillRect(-p.s, -p.s * 0.45, p.s * 2, p.s * 0.9); ctx.restore(); }
      else circ(p.x, p.y, p.s, p.c);
    });
    ctx.globalAlpha = 1;
    FX.pops.forEach(function (q) {
      var u = q.age / q.life, sc = q.age < 0.14 ? 0.4 + q.age / 0.14 * 0.8 : 1.2 - Math.min(0.2, (q.age - 0.14) * 1.4);
      ctx.globalAlpha = u > 0.7 ? Math.max(0, (1 - u) / 0.3) : 1;
      ctx.save(); ctx.translate(q.x, q.y - 28 * u); ctx.scale(sc, sc); text(q.t, 0, 0, { size: q.size, color: q.color, weight: 900, stroke: '#13233f', sw: Math.max(3.5, q.size / 6) }); ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  // ---------- 球 ----------
  function shadow(x, y, r) { var a = 0.38 * Math.max(0, 1 - y / 3.5), w = Math.max(3, r * view.sx * (1.25 - Math.min(0.6, y / 5))); if (a > 0.02) { ctx.fillStyle = 'rgba(0,0,0,' + fx(a, 3) + ')'; ctx.beginPath(); ctx.ellipse(X(x), Y(0) - 1, w, w * 0.3, 0, 0, Math.PI * 2); ctx.fill(); } }
  function shine(px, py, pr) { var g = ctx.createRadialGradient(px - pr * 0.38, py - pr * 0.38, pr * 0.05, px, py, pr); g.addColorStop(0, 'rgba(255,255,255,.8)'); g.addColorStop(0.32, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.38)'); circ(px, py, pr, g); }
  function drawBasketball(x, y, rot) {
    var px = X(x), py = Y(y), pr = Math.max(4, L.ball.r * view.sx);
    circ(px, py, pr, '#ec7a26', '#3a1a06', 1.5);
    ctx.save(); ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.clip(); ctx.translate(px, py); ctx.rotate(-rot);
    ctx.strokeStyle = '#3a1a06'; ctx.lineWidth = Math.max(1, pr * 0.09);
    ctx.beginPath(); ctx.moveTo(-pr, 0); ctx.lineTo(pr, 0); ctx.moveTo(0, -pr); ctx.lineTo(0, pr); ctx.stroke();
    ctx.beginPath(); ctx.arc(-pr * 1.3, 0, pr * 0.95, -0.95, 0.95); ctx.stroke();
    ctx.beginPath(); ctx.arc(pr * 1.3, 0, pr * 0.95, Math.PI - 0.95, Math.PI + 0.95); ctx.stroke();
    ctx.restore(); shine(px, py, pr);
  }
  function drawBall(x, y, r, color) { var px = X(x), py = Y(y), pr = Math.max(3.5, r * view.sx); circ(px, py, pr, color, '#0b1528', 1.2); shine(px, py, pr); }
  function trailPath(tr) { ctx.beginPath(); tr.forEach(function (p, i) { if (i) ctx.lineTo(X(p.x), Y(p.y)); else ctx.moveTo(X(p.x), Y(p.y)); }); }
  function drawTraces() {   // 之前幾次的軌跡（淡淡的虛線；成功是綠色），對照著調
    ctx.setLineDash([3, 6]); ctx.lineCap = 'round';
    S.traces.forEach(function (tr, i) { trailPath(tr.pts); ctx.strokeStyle = tr.ok ? 'rgba(93,255,160,.75)' : 'rgba(255,255,255,' + fx(0.25 + 0.35 * (i + 1) / S.traces.length, 2) + ')'; ctx.lineWidth = 2; ctx.stroke(); });
    ctx.setLineDash([]); ctx.lineCap = 'butt';
  }
  function drawLiveTrail(st) { if (st.trail.length < 2) return; trailPath(st.trail); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,216,77,.35)'; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.stroke(); }

  // ---------- 投籃 ----------
  function rimGeom() { var H0 = L.hoop; return { cx: X(H0.board - (H0.nearIn + H0.farIn) / 2), cy: Y(H0.rimY - H0.tube), rx: ((H0.farIn - H0.nearIn) / 2 + H0.tube) * view.sx, ry: Math.max(3, 0.05 * view.sx), lw: Math.max(2.5, H0.tube * 2 * view.sx * 1.3) }; }
  function drawHoopScene() {
    drawBg(BG.hoop);
    var H0 = L.hoop, fl = Y(0), bx = X(H0.board), bw = Math.max(4, H0.thick * view.sx), wall = X(H0.board + H0.wall);
    // 地板：罰球線（球員腳尖）、離籃板幾公尺
    var ftl = X(H0.board - 4.60); rect(ftl - 2, fl - 3, ftl + 2, fl, 'rgba(255,255,255,.95)'); text('罰球線', ftl, fl - 24, { size: 9, color: '#fff7e8', weight: 800, stroke: 'rgba(40,20,5,.8)', sw: 3 });
    for (var m = 1; m <= 4; m++) { var xm = X(H0.board - m); line(xm, fl - 5, xm, fl, 'rgba(255,255,255,.6)', 1.5); text(m + ' m', xm, fl - 12, { size: 10, color: '#fff7e8', weight: 800, stroke: 'rgba(40,20,5,.8)', sw: 3 }); }
    // 籃架：牆上的支架 → 籃板（側面看是一片 5 cm 厚的壓克力，下緣有護墊）→ 框的支架
    var th = Math.max(4, 0.07 * view.sx);
    line(bx + bw, Y(3.25), wall, Y(3.5), '#46505c', th); line(bx + bw, Y(3.75), wall, Y(3.5), '#46505c', th * 0.6);
    rect(wall - 3, Y(3.8), wall + 5, Y(3.15), '#2a313b', '#0b1528', 1);
    var g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#f2f8ff'); g.addColorStop(1, '#9fb8d4');
    rect(bx, Y(H0.boardY1), bx + bw, Y(H0.boardY0), g, '#0b1528', 1.5);
    rect(bx, Y(H0.boardY0 + 0.07), bx + bw, Y(H0.boardY0), '#e5484d', '#0b1528', 1);
    line(bx, Y(H0.rimY - 0.012), X(H0.board - H0.nearIn), Y(H0.rimY - 0.012), '#c4520f', Math.max(3, 0.035 * view.sx));
    // 框高：從地板量到籃框的尺寸線（畫在籃板和牆中間）
    var dxl = (bx + bw + wall) / 2;
    ctx.setLineDash([4, 3]); line(dxl, fl, dxl, Y(H0.rimY), 'rgba(255,247,232,.7)', 1.2); ctx.setLineDash([]);
    line(dxl - 4, Y(H0.rimY), dxl + 4, Y(H0.rimY), '#fff7e8', 1.5); text('框高 3.05 m', dxl, Y(H0.rimY / 2), { size: 10, color: '#fff7e8', weight: 800, stroke: '#13233f' });
  }
  function drawNet(R, front) {   // 籃網：前半在球前面、後半在球後面；進球時會甩動
    var t = FX.net, sw = t >= 0 ? Math.sin(t * 16) * Math.exp(-t * 3.5) : 0, dep = 0.42 * view.sy;
    var bot = { cx: R.cx + sw * R.rx * 0.3, cy: R.cy + dep * (1 + 0.15 * Math.abs(sw)), rx: R.rx * 0.55, ry: R.ry * 0.55 };
    var mid = { cx: (R.cx + bot.cx) / 2, cy: (R.cy + bot.cy) / 2, rx: (R.rx + bot.rx) / 2, ry: (R.ry + bot.ry) / 2 };
    ctx.strokeStyle = front ? 'rgba(255,255,255,.92)' : 'rgba(220,226,235,.6)'; ctx.lineWidth = 1.2;
    for (var i = 0; i < 12; i++) {
      var a = (i + 0.5) / 12 * Math.PI * 2; if ((Math.sin(a) > 0) !== front) continue;
      for (var d = -1; d <= 1; d += 2) { var b = a + d * Math.PI / 12; ctx.beginPath(); ctx.moveTo(R.cx + Math.cos(a) * R.rx, R.cy + Math.sin(a) * R.ry); ctx.lineTo(bot.cx + Math.cos(b) * bot.rx, bot.cy + Math.sin(b) * bot.ry); ctx.stroke(); }
    }
    [mid, bot].forEach(function (e) { ctx.beginPath(); ctx.ellipse(e.cx, e.cy, e.rx, e.ry, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); ctx.stroke(); });
  }
  function drawRim(front) {
    var R = rimGeom(); drawNet(R, front);
    ctx.beginPath(); ctx.ellipse(R.cx, R.cy, R.rx, R.ry, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
    ctx.strokeStyle = '#6b2406'; ctx.lineWidth = R.lw + 2; ctx.stroke(); ctx.strokeStyle = front ? '#ff7a1a' : '#d0600f'; ctx.lineWidth = R.lw; ctx.stroke();
  }

  // ---------- 走廊彈力球 ----------
  function drawBellScene() {
    drawBg(BG.bell);
    var fl = Y(0);
    // 天花板（球碰到會彈）
    ctx.setLineDash([6, 4]); line(0, Y(L.ceiling), W, Y(L.ceiling), 'rgba(255,255,255,.45)', 1.5); ctx.setLineDash([]);
    textIn('天花板 2.6 m（球碰到會彈）', 10, Y(L.ceiling) + 10, { size: 10, color: '#fff', weight: 800, stroke: '#13233f', align: 'left' });
    for (var m = 0; m <= 3; m++) { rect(X(m) - 1.5, fl - 4, X(m) + 1.5, fl + 4, '#ffd23f'); text(m + ' m', X(m) + 3, fl + Math.min(10, (H - fl) / 2 + 1), { size: 10, color: '#fff', weight: 900, stroke: '#13233f', align: 'left' }); }
    var B = L.bell, c = BG.bell, top = c.wy + (c.ay - c.doorTop) / c.ppm;   // 鈴用長繩吊在門框上緣
    var hx = X(B.x), hy = Y(top), r = B.R * view.sx, sw = FX.bell >= 0 ? 0.55 * Math.sin(FX.bell * 13) * Math.exp(-FX.bell * 2.2) : 0;
    var len = Y(B.y + B.R) - hy, bx = hx + Math.sin(sw) * len, by = hy + Math.cos(sw) * len;   // 繩子跟著鈴一起擺（螢幕 y 往下）
    line(hx, hy, bx, by, '#e9eef4', 1.5); rect(hx - 6, hy - 3, hx + 6, hy + 3, '#8a5a32', '#13233f', 1);
    ctx.save(); ctx.translate(bx, by); ctx.rotate(-sw); bellShape(r); circ(Math.sin(sw) * r * 0.5, 1.95 * r, Math.max(2, r * 0.2), '#5c3d00'); ctx.restore();
    // 鈴很小（直徑 12 cm），外面畫一圈會閃的目標框，看得到要打哪裡
    var u = (performance.now() / 1000 * 1.2) % 1;
    if (S.mode === 'aim') circ(X(B.x), Y(B.y), (B.R + 0.03) * view.sx + 4 + u * 10, null, 'rgba(255,216,77,' + fx(0.9 * (1 - u), 2) + ')', 2);
    text('鈴：離地 35 cm', hx + 8, hy + 14, { size: 10, color: '#fff', weight: 800, stroke: '#13233f', align: 'left' });
  }

  // ---------- 夜市擺錘鈴 ----------
  // 鐵牌的中心沿著半徑 0.30 m 的圓弧擺動。鈴裝在一片彈片上：鐵牌升高 5 cm 碰到鈴；輕輕推開（最高 5～6 cm）鈴就響，太大力（超過 6 cm）鈴被撞飛
  function arcPt(ang, r) { var Pl = L.plate; return { x: Pl.x + Math.sin(ang) * r, y: Pl.pivotY - Math.cos(ang) * r }; }
  function bellGeom(curAng) {   // 鈴的位置：被鐵牌外緣推著走（鐵牌角度超過碰鈴的角度時）
    var Pl = L.plate, a5 = Math.acos(1 - L.ringH[0] / Pl.len), ro = Pl.len + Pl.h / 2, d = Math.asin((Pl.w / 2) / ro), br = 0.016;
    var rest = arcPt(a5 + d, ro + br * 0.6), mount = { x: rest.x, y: Pl.pivotY }, push = Math.max(0, (curAng || 0) - a5);
    var Ls = mount.y - rest.y, phi = Math.min(0.9, push * ro / Ls * 1.05);
    return { x: mount.x + Math.sin(phi) * Ls, y: mount.y - Math.cos(phi) * Ls, mount: mount, phi: phi, br: br, a5: a5 };
  }
  function drawPendScene(st) {
    drawBg(BG.pend);
    var Pl = L.plate, pv = Y(Pl.pivotY), s = view.sx;
    // 招牌（左上，在槍的上面）
    var sx0 = X(-0.14), sy0 = Y(1.565), sw0 = 0.2 * s, sh0 = clamp(0.045 * s, 18, 30);
    rrect(sx0, sy0, sw0, sh0, 4, '#7a3b16', '#2a1208', 1.5); text('擺錘鈴 3 發 50 元', sx0 + sw0 / 2, sy0 + sh0 / 2, { size: clamp(sh0 * 0.48, 10, 15), color: '#ffd84d', weight: 900 });
    // 橫桿（吊鐵牌）＋兩根柱子（一直到畫面頂）
    rect(X(0.02) - 3, 0, X(0.02) + 3, pv, '#5c6875', '#0b1528', 1); rect(X(0.46) - 3, 0, X(0.46) + 3, pv, '#5c6875', '#0b1528', 1);
    rect(X(0.0), pv - 4, X(0.48), pv + 4, grad(pv - 4, pv + 4, '#e9eef4', '#7d8794'), '#0b1528', 1);
    circ(X(Pl.x), pv, 4, '#c9d2dc', '#0b1528', 1);
    // 鐵牌中心走的圓弧（虛線），綠色那段＝升高 5～6 cm
    var ra = Math.acos(1 - L.ringH[0] / Pl.len), rb = Math.acos(1 - L.ringH[1] / Pl.len), R = Pl.len * s;
    ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(X(Pl.x), pv, R, Math.PI / 2 - rb - 0.12, Math.PI / 2); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(X(Pl.x), pv, R, Math.PI / 2 - rb, Math.PI / 2 - ra); ctx.strokeStyle = '#2fbf71'; ctx.lineWidth = 5; ctx.stroke();
    // 鈴＋彈片（從橫桿吊下來）；太大力時鈴被撞飛（FX.bellOff）
    var ang = st && st.phase === 'swing' ? st.ang : 0, bg = bellGeom(ang), brp = Math.max(6, bg.br * s);
    var a5 = bg0(), gc = arcPt(a5, Pl.len);   // 升高 5 cm 時的鐵牌（虛線）：它的外緣正好碰到鈴
    ctx.save(); ctx.translate(X(gc.x), Y(gc.y)); ctx.rotate(-a5); ctx.setLineDash([3, 3]); rect(-Pl.w / 2 * s, -Pl.h / 2 * s, Pl.w / 2 * s, Pl.h / 2 * s, 'rgba(255,255,255,.12)', 'rgba(255,255,255,.6)', 1.2); ctx.setLineDash([]); ctx.restore();
    text('升高 5 cm 時', X(gc.x) - 0.05 * s, Y(gc.y - Pl.h / 2) + 10, { size: 9, color: 'rgba(255,255,255,.85)', weight: 800, stroke: '#13233f', sw: 3, align: 'right' });
    line(X(bg.mount.x), pv, X(bg.x), Y(bg.y), '#c9d2dc', 2.5);
    if (!FX.bellOff) {
      var bs = FX.pbell >= 0 ? 0.3 * Math.sin(FX.pbell * 30) * Math.exp(-FX.pbell * 3) : 0;
      ctx.save(); ctx.translate(X(bg.x), Y(bg.y) - brp * 0.2); ctx.rotate(-bg.phi + bs); bellShape(brp * 0.9); ctx.restore();
    }
    var bl = arcPt((ra + rb) / 2, Pl.len + 0.085); text('鈴：5～6 cm 響', X(bl.x) + 4, Y(bl.y) + 6, { size: 10, color: '#a6ffcb', weight: 800, stroke: '#13233f', align: 'left' });
  }
  function bg0() { return Math.acos(1 - L.ringH[0] / L.plate.len); }
  function drawBellOff() { var b = FX.bellOff; if (!b) return; ctx.save(); ctx.translate(X(b.x), Y(b.y)); ctx.rotate(b.rot); bellShape(Math.max(6, 0.016 * view.sx) * 0.9); ctx.restore(); }
  function drawPlate(st) {   // 鐵牌（會擺）：整片繞著橫桿上的轉軸轉
    var Pl = L.plate, ang = st && st.phase === 'swing' ? st.ang : 0, c = arcPt(ang, Pl.len), top = arcPt(ang, Pl.len - Pl.h / 2);
    line(X(Pl.x), Y(Pl.pivotY), X(top.x), Y(top.y), '#c9d2dc', 2);
    ctx.save(); ctx.translate(X(c.x), Y(c.y)); ctx.rotate(-ang);
    var hw = Pl.w / 2 * view.sx, hh = Pl.h / 2 * view.sy;
    rect(-hw, -hh, hw, hh, grad(-hh, hh, '#e3e8ee', '#7d8794'), '#0b1528', 2);
    circ(0, 0, Math.max(3, hw * 0.75), '#e5484d', '#fff', 1); circ(0, 0, Math.max(1.5, hw * 0.3), '#fff');
    if (st && st.stuck && st.phase === 'swing') circ(-hw - st.pel.r * view.sx, 0, st.pel.r * view.sx, st.pel.color, '#0b1528', 1);
    ctx.restore();
  }
  function drawGauge(st) {   // 右邊的升高計（放大）：鐵牌中心升高幾 cm，跟 h＝V²／2g 同一個量
    var Pl = L.plate, ang = st && st.phase === 'swing' ? st.ang : 0, rise = Math.max(0, Pl.len * (1 - Math.cos(ang)));
    var top = Y(L.world.y1), gx = W - 64, gy0 = 26, gy1 = top > 150 ? top - 14 : H - 24, gw = 18; if (gy1 - gy0 < 80) return;   // 直放：場地上面有空位就放上面，不蓋住鈴
    function GY(cm) { return gy1 - (gy1 - gy0) * cm / 10; }
    rrect(gx - 62, gy0 - 20, 120, gy1 - gy0 + 36, 8, 'rgba(11,21,40,.72)', 'rgba(255,255,255,.25)', 1);
    text('鐵牌中心升高', gx - 2, gy0 - 9, { size: 10, color: '#fff', weight: 900 });
    rect(gx, gy0, gx + gw, gy1, '#1d2a36', '#9fb3cf', 1);
    rect(gx, GY(L.ringH[1] * 100), gx + gw, GY(L.ringH[0] * 100), '#2fbf71');
    rect(gx, GY(10), gx + gw, GY(L.ringH[1] * 100), 'rgba(229,72,77,.75)');
    text('太大力', gx + gw + 12, GY(9), { size: 9, color: '#ffb3a8', weight: 900, align: 'left' });
    for (var c = 0; c <= 10; c++) { line(gx + gw, GY(c), gx + gw + (c % 5 ? 4 : 8), GY(c), '#c9d6ea', 1); if (c % 2 === 0 || c === 5) text(c + '', gx + gw + 12, GY(c), { size: 9, color: '#c9d6ea', weight: 800, align: 'left' }); }
    text('cm', gx + gw + 12, gy1 + 10, { size: 9, color: '#c9d6ea', weight: 800, align: 'left' });
    var my = GY(Math.min(10.3, rise * 100)); rect(gx - 4, my - 2, gx + gw + 4, my + 2, '#ffd84d');
    var mh = st && st.ev.maxAng ? Pl.len * (1 - Math.cos(st.ev.maxAng)) : 0;   // 這一發擺到的最高點（留著給你看）
    if (mh > 0.0005) { var mY = GY(Math.min(10.3, mh * 100)); line(gx, mY, gx + gw, mY, '#fff', 2); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(gx - 2, mY); ctx.lineTo(gx - 9, mY - 5); ctx.lineTo(gx - 9, mY + 5); ctx.closePath(); ctx.fill(); text('最高 ' + fx(mh * 100, 1), gx - 11, mY, { size: 10, color: '#fff', weight: 900, stroke: '#13233f', align: 'right' }); }
    else if (st && st.phase === 'swing') text(fx(rise * 100, 1), gx - 6, my, { size: 11, color: '#ffd84d', weight: 900, stroke: '#13233f', align: 'right' });
  }

  // ---------- 射箭（鏡頭跟著箭走） ----------
  function drawArrowShaft(x, y, ang, len) {   // 箭尖在 (x, y)，ang＝箭頭指的方向
    var px = X(x), py = Y(y), l = len * view.sx, ux = Math.cos(ang), uy = -Math.sin(ang), nx = -uy, ny = ux, f = Math.max(3, 0.03 * view.sx);
    line(px - ux * l, py - uy * l, px, py, '#1d232b', Math.max(2, 0.01 * view.sx));
    ctx.fillStyle = '#3c8dde'; ctx.beginPath(); ctx.moveTo(px - ux * l, py - uy * l); ctx.lineTo(px - ux * (l - 2.5 * f) + nx * f, py - uy * (l - 2.5 * f) + ny * f); ctx.lineTo(px - ux * (l - 3 * f), py - uy * (l - 3 * f)); ctx.lineTo(px - ux * (l - 2.5 * f) - nx * f, py - uy * (l - 2.5 * f) - ny * f); ctx.closePath(); ctx.fill();
  }
  function drawFlag(fm, tt) {   // 風旗：無風就垂下來；側風是「從射手左邊吹向右邊」＝朝著你（鏡頭）吹，旗子朝你這邊飄（畫成很短、會抖的旗）
    var x = X(fm), gy = Y(0), top = Y(2.2); if (x < -40 || x > W + 60) return;
    ctx.globalAlpha = 0.75; line(x, gy, x, top, '#e9eef4', 1.5);   // 旗桿在箭道旁邊（畫淡一點）
    ctx.fillStyle = '#e5484d'; ctx.beginPath();
    if (S.wind <= 0) { ctx.moveTo(x, top); ctx.lineTo(x + 5, top + 4); ctx.lineTo(x + 3, top + 26); ctx.lineTo(x, top + 24); }
    else { var f = Math.sin(tt * (5 + S.wind * 2) + fm) * (1.5 + S.wind), wl = 7 + S.wind * 2; ctx.moveTo(x, top); ctx.lineTo(x + wl, top + 3 + f); ctx.lineTo(x + wl * 0.9, top + 15 + f); ctx.lineTo(x, top + 14); }
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  }
  function drawArrowScene() {
    var im = img('bg_archery.jpg'), gy = Y(0);
    if (im) { var k = gy / 850, w = im.naturalWidth * k, h = im.naturalHeight * k; tileX(im, -cam.x * view.sx * 0.12 - w * 0.25, 0, w, h, 0, im.naturalHeight); if (h < H) { ctx.fillStyle = '#4a8a2c'; ctx.fillRect(0, h - 1, W, H - h + 1); } }
    else { ctx.fillStyle = grad(0, gy, '#3d8fe0', '#b9d7ef'); ctx.fillRect(0, 0, W, gy); ctx.fillStyle = '#4a8a2c'; ctx.fillRect(0, gy, W, H - gy); }
    ctx.fillStyle = 'rgba(25,60,15,.25)'; ctx.fillRect(0, gy, W, H - gy); line(0, gy, W, gy, 'rgba(255,255,255,.35)', 1);
    // 射擊線、距離牌（每 10 m）
    if (X(0) > -20) { line(X(0), gy, X(0), H, '#fff', 3); }
    for (var m = 10; m < L.dist; m += 10) { var x = X(m); if (x < -40 || x > W + 40) continue; line(x, gy, x, Y(0.55), '#6b4a22', 3); rrect(x - 17, Y(0.75), 34, Math.max(14, 0.2 * view.sy), 3, '#fff', '#13233f', 1.2); text(m + ' m', x, Y(0.65), { size: 11, color: '#13233f', weight: 900 }); }
    var tt = performance.now() / 1000; [5, 64].forEach(function (fm) { drawFlag(fm, tt); });   // 風旗插在箭道旁邊（5 m：瞄準時看得到；64 m：箭到靶時看得到）
    // 靶架、草靶、靶紙（靶紙轉一點角度，看得到顏色圈）
    var tx = X(L.dist);
    if (tx > -80 && tx < W + 120) {
      var s = view.sx, cy = Y(L.targetY), R = L.face / 2 * s, rx = Math.max(5, 0.13 * s);
      ctx.strokeStyle = '#7a4b22'; ctx.lineWidth = Math.max(3, 0.06 * s); ctx.beginPath(); ctx.moveTo(tx + 0.05 * s, gy); ctx.lineTo(tx + 0.3 * s, Y(2.05)); ctx.lineTo(tx + 0.75 * s, gy); ctx.stroke();
      rect(tx, Y(L.bossY[1]), tx + 0.32 * s, Y(L.bossY[0]), '#d9c27a', '#6b5320', 1.5);
      ctx.strokeStyle = 'rgba(107,83,32,.45)'; ctx.lineWidth = 1; for (var j = 1; j < 8; j++) { ctx.beginPath(); ctx.moveTo(tx, Y(0.6 + j * 0.175)); ctx.lineTo(tx + 0.32 * s, Y(0.6 + j * 0.175)); ctx.stroke(); }
      var cols = ['#f6f1e3', '#f6f1e3', '#1d2a36', '#1d2a36', '#3c8dde', '#3c8dde', '#e5484d', '#e5484d', '#ffd23f', '#ffd23f'];
      for (var i = 0; i < 10; i++) { ctx.beginPath(); ctx.ellipse(tx, cy, rx * (10 - i) / 10, R * (10 - i) / 10, 0, 0, Math.PI * 2); ctx.fillStyle = cols[i]; ctx.fill(); ctx.strokeStyle = 'rgba(19,35,63,.5)'; ctx.lineWidth = 0.8; ctx.stroke(); }
    }
    S.stuck.forEach(function (a) { drawArrowShaft(a.x, a.y, a.ang, a.ground ? 0.55 : 0.62); });
    if (!drawSpr('archer', 0, L.release.y)) person(X(-0.6), gy, view.sy * 1.75, { x: X(0), y: Y(L.release.y) });
  }
  function drawMini() {   // 全程小地圖：0～70 m 整條軌跡，看得出箭飛到哪
    var x0 = 8, x1 = Math.min(W - 8, Math.max(220, W * 0.62)), y1 = H - 5, y0 = Math.max(Y(0) + 4, H - 44);
    if (y1 - y0 < 18) return;
    rrect(x0, y0, x1 - x0, y1 - y0, 6, 'rgba(11,21,40,.62)');
    var mx0 = x0 + 10, msx = (x1 - x0 - 24) / L.dist, gyy = y1 - 5, msy = (y1 - y0 - 12) / 3.0;
    function MX(x) { return mx0 + x * msx; } function MY(y) { return gyy - y * msy; }
    line(mx0, gyy, MX(L.dist), gyy, 'rgba(255,255,255,.4)', 1);
    rect(MX(cam.x), y0 + 2, MX(cam.x + W / view.sx), y1 - 2, 'rgba(255,255,255,.08)', 'rgba(255,255,255,.35)', 1);
    line(MX(L.dist), MY(L.targetY - L.face / 2), MX(L.dist), MY(L.targetY + L.face / 2), '#ffd23f', 3);
    S.traces.forEach(function (tr) { ctx.beginPath(); tr.pts.forEach(function (p, i) { if (i) ctx.lineTo(MX(p.x), MY(p.y)); else ctx.moveTo(MX(p.x), MY(p.y)); }); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.stroke(); });
    if (S.st) { ctx.beginPath(); S.st.trail.forEach(function (p, i) { if (i) ctx.lineTo(MX(p.x), MY(p.y)); else ctx.moveTo(MX(p.x), MY(p.y)); }); ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = 1.5; ctx.stroke(); if (!S.st.done) circ(MX(S.st.x), MY(S.st.y), 2.5, '#ffd84d'); }
    circ(MX(0), MY(L.release.y), 3, '#fff');
    var vx = msy / msx; text('全程 ' + L.dist + ' m' + (vx >= 1.5 ? '（高度放大 ' + Math.round(vx) + ' 倍）' : ''), x1 - 6, y0 + 9, { size: 9, color: 'rgba(255,255,255,.8)', weight: 800, align: 'right' });
  }
  function drawFace() {   // 靶面放大圖（右上角）：射手看過去的靶面，看得到左右偏和上下偏
    var R = Math.max(40, Math.min(70, (H - 130) / 2)), cx = W - R - 16, cy = R + 26, k = R / (L.face / 2);
    rrect(cx - R - 10, 4, R * 2 + 20, R * 2 + 112, 8, 'rgba(11,21,40,.72)', 'rgba(255,255,255,.35)', 1.2);
    text('靶面放大圖', cx, 14, { size: 11, color: '#fff', weight: 900 });
    var cols = ['#f6f1e3', '#f6f1e3', '#1d2a36', '#1d2a36', '#3c8dde', '#3c8dde', '#e5484d', '#e5484d', '#ffd23f', '#ffd23f'];
    for (var i = 0; i < 10; i++) circ(cx, cy, R * (10 - i) / 10, cols[i], i === 2 || i === 3 ? '#fff' : '#13233f', 0.8);
    circ(cx, cy, R * 0.05, null, '#13233f', 0.8);
    var n0 = S.holes[0] && S.holes[0].practice ? 1 : 0, last = S.holes.length - 1, pulse = (performance.now() / 1000 * 3) % 1;
    S.holes.forEach(function (hol, i) {
      var hx = cx + hol.dz * k, hy = cy - hol.dy * k; if (Math.hypot(hx - cx, hy - cy) > R + 6) return;
      if (i === last && S.mode === 'aim') circ(hx, hy, 5 + pulse * 10, null, 'rgba(255,255,255,' + fx(1 - pulse, 2) + ')', 2);
      circ(hx, hy, 4, hol.practice ? '#7c8a99' : '#0b1528', '#fff', 1.5); text(hol.practice ? '試' : String(i + 1 - n0), hx + 8, hy - 8, { size: 10, color: '#fff', weight: 900, stroke: '#13233f' });
    });
    text('看箭孔：左右偏＝風', cx, cy + R + 13, { size: 10, color: '#fff', weight: 900 });
    text(S.wind > 0 ? '側風 ' + fx(S.wind, 1) + ' m/s' : '無風', cx, cy + R + 29, { size: 12, color: '#ffd84d', weight: 900, stroke: '#13233f' });
    // 俯視風向圖：從上面看箭道（射手在下、靶在上），風從左往右吹
    var wy0 = cy + R + 42, ww = R * 2, wh = 34; rrect(cx - ww / 2, wy0, ww, wh, 6, 'rgba(255,255,255,.1)', 'rgba(255,255,255,.3)', 1);
    line(cx, wy0 + wh - 4, cx, wy0 + 6, 'rgba(255,255,255,.7)', 2); circ(cx, wy0 + 6, 3, '#ffd23f'); circ(cx, wy0 + wh - 4, 3, '#fff');
    if (S.wind > 0) { var off = ((performance.now() / 1000 * (0.6 + S.wind * 0.3)) % 1) * 18; for (var q = 0; q < 2; q++) { var ay = wy0 + 11 + q * 12, ax = cx - ww / 2 + 8 + off; line(ax, ay, ax + 20, ay, '#7ce0ff', 2); ctx.fillStyle = '#7ce0ff'; ctx.beginPath(); ctx.moveTo(ax + 24, ay); ctx.lineTo(ax + 18, ay - 4); ctx.lineTo(ax + 18, ay + 4); ctx.closePath(); ctx.fill(); } }
    text(S.wind > 0 ? '從上面看：風從左往右' : '從上面看：無風', cx, wy0 + wh + 9, { size: 9, color: '#c9d6ea', weight: 800 });
    if (!S.over) textIn(S.practice > 0 ? '試射（不計分）' : '第 ' + Math.min(S.round + 1, L.rounds) + ' 輪／' + L.rounds, cx - R - 16, 16, { size: 12, color: '#fff', weight: 900, stroke: '#13233f', align: 'right' });
  }

  // ---------- 一發入魂（空氣砲、牆上的窗口、側面開洞的得分箱） ----------
  function curTarget() {   // 換輪時，得分箱和窗口滑到新位置（不要瞬間跳過去）
    var T = S.targets[Math.min(S.round, S.targets.length - 1)];
    if (!S.boxFrom || S.boxT >= 1) return T;
    var u = S.boxT * S.boxT * (3 - 2 * S.boxT), A = S.boxFrom;
    return { x: A.x + (T.x - A.x) * u, y: A.y + (T.y - A.y) * u, wy: A.wy + (T.wy - A.wy) * u, th0: T.th0 };
  }
  function dimLabel(t, x, y, o) { o = o || {}; textIn(t, x, y, { size: o.size || 12, color: o.color || '#ffd84d', weight: 900, stroke: '#13233f', align: o.align || 'center' }); }
  function drawSnipeScene(st) {
    drawBg(BG.snipe);
    var T = (st && st.T) || curTarget(), s = view.sx, t0 = Y(0), Wl = L.wall, gl = L.goal, mz = L.muzzle;
    // 桌面上的尺：0 在砲口正下方，每 10 cm 一格
    for (var c = 0; c <= 100; c += 10) { var xx = X(mz.x + c / 100); line(xx, t0, xx, t0 + 6, '#fff3d6', 1.5); text(String(c), xx, t0 + 13, { size: 9, color: '#fff3d6', weight: 800, stroke: 'rgba(40,20,5,.8)', sw: 3 }); }
    // 牆：木板（1.6 cm 厚）一直到天花板，只在窗口那裡開 4 cm
    var wx0 = X(Wl.x - Wl.t / 2), wx1 = X(Wl.x + Wl.t / 2), wtop = Y(T.wy + L.window / 2), wbot = Y(T.wy - L.window / 2);
    var g = ctx.createLinearGradient(wx0, 0, wx1, 0); g.addColorStop(0, '#c48a52'); g.addColorStop(0.5, '#e0a96a'); g.addColorStop(1, '#8a5a32');
    rect(wx0, -10, wx1, wtop, g, '#3a240c', 1.5); rect(wx0, wbot, wx1, t0, g, '#3a240c', 1.5);
    ctx.strokeStyle = 'rgba(58,36,12,.35)'; ctx.lineWidth = 1; for (var yy = t0 - 18; yy > 0; yy -= 22) { if (yy < wtop || yy > wbot) { ctx.beginPath(); ctx.moveTo(wx0, yy); ctx.lineTo(wx1, yy); ctx.stroke(); } }
    rect(wx0 - 3, wtop - 3, wx1 + 3, wtop, '#ffd23f'); rect(wx0 - 3, wbot, wx1 + 3, wbot + 3, '#ffd23f');
    if (S.mode === 'aim') { var u = (performance.now() / 1000 * 1.2) % 1; ctx.strokeStyle = 'rgba(255,216,77,' + fx(0.8 * (1 - u), 2) + ')'; ctx.lineWidth = 2; ctx.strokeRect(wx0 - 5 - u * 6, wtop - 5 - u * 6, wx1 - wx0 + 10 + u * 12, wbot - wtop + 10 + u * 12); }
    text('窗口 4 cm', (wx0 + wx1) / 2, wtop - 14, { size: 10, color: '#fff', weight: 800, stroke: '#13233f' });
    // 得分箱：洞口開在面向砲口的那一面（剖面畫法：看得到洞裡面）
    var gx0 = X(T.x), gx1 = X(T.x + gl.depth), r0 = Y(T.y - gl.d / 2), r1 = Y(T.y + gl.d / 2), gtop = Y(T.y + gl.d / 2 + gl.top);
    var bg2 = ctx.createLinearGradient(gx0, 0, gx1, 0); bg2.addColorStop(0, '#3c8dde'); bg2.addColorStop(1, '#22508a');
    rect(gx0, gtop, gx1, t0, bg2, '#0b1528', 1.5);
    rect(gx0, r1, X(T.x + gl.depth * 0.85), r0, '#0b1528');   // 洞（裡面是暗的）
    rect(gx0 - 3, r1 - 2, gx0 + 2, r1 + 2, '#ffd23f'); rect(gx0 - 3, r0 - 2, gx0 + 2, r0 + 2, '#ffd23f');
    if (S.mode === 'aim') { var u2 = (performance.now() / 1000 * 1.2 + 0.5) % 1; ctx.strokeStyle = 'rgba(255,216,77,' + fx(0.8 * (1 - u2), 2) + ')'; ctx.lineWidth = 2; ctx.strokeRect(gx0 - 6 - u2 * 6, r1 - 4 - u2 * 6, 14 + u2 * 12, r0 - r1 + 8 + u2 * 12); }
    text('得分箱', (gx0 + gx1) / 2, gtop - 10, { size: 10, color: '#fff', weight: 800, stroke: '#13233f' });
    // 量給你看：洞口中心離砲口多遠（水平 x、高度差 y）
    var mX = X(mz.x), mY = Y(mz.y), dx = (T.x - mz.x) * 100, dy = (T.y - mz.y) * 100, oy = Y(T.y);
    ctx.setLineDash([5, 4]); line(mX, mY, gx0, mY, 'rgba(255,216,77,.8)', 1.5); line(gx0, mY, gx0, oy, 'rgba(255,216,77,.8)', 1.5); ctx.setLineDash([]);
    dimLabel('x ＝ ' + fx(dx, 1) + ' cm', mX + (gx0 - mX) * 0.76, mY + (oy > mY ? -12 : 12));
    dimLabel('y ＝ ' + (dy >= 0 ? '+' : '−') + fx(Math.abs(dy), 1) + ' cm', gx0 - 8, (mY + oy) / 2 + (Math.abs(oy - mY) < 16 ? -16 : 0), { align: 'right' });
  }
  function drawCannon(angDeg) {   // 空氣砲：砲口固定（轉軸就在砲口），砲管往後延伸
    var mz = L.muzzle, s = view.sx, a = angDeg * Math.PI / 180, mx = X(mz.x), my = Y(mz.y), len = 0.16 * s, r = 0.022 * s;
    rect(mx - 0.012 * s, my, mx + 0.012 * s, Y(0), '#46505c', '#0b1528', 1); rect(mx - 0.06 * s, Y(0.015), mx + 0.05 * s, Y(0), '#2a313b', '#0b1528', 1);
    ctx.save(); ctx.translate(mx, my); ctx.rotate(-a);
    var g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#9aa7b6'); g.addColorStop(0.45, '#e3e8ee'); g.addColorStop(1, '#4a5563');
    rrect(-len, -r, len, r * 2, r * 0.4, g, '#0b1528', 1.5);
    ctx.fillStyle = '#ffd23f'; for (var k = 0; k < 3; k++) ctx.fillRect(-len + r * 0.6 + k * r * 0.9, -r, r * 0.4, r * 2);
    circ(-len + r * 0.2, 0, r * 1.25, '#e5484d', '#0b1528', 1.5); circ(-len + r * 0.2, 0, r * 0.55, '#fff', '#0b1528', 1);
    ctx.restore();
    circ(mx, my, Math.max(3, 0.008 * s), '#ffd23f', '#0b1528', 1);
  }

  // ---------- 停車格（氣墊軌道、彈簧發射器、摩擦墊） ----------
  function drawCarP(rear, letter, massText, color, bump, vel, weights) {
    var R = L.rail, s = view.sx, x0 = X(rear), x1 = X(rear + R.carL), yb = Y(0.005), h = R.carH * s;
    var g = ctx.createLinearGradient(0, yb - h, 0, yb); g.addColorStop(0, color); g.addColorStop(1, '#0b1528');
    rrect(x0, yb - h, x1 - x0, h, Math.min(5, h * 0.25), g, '#0b1528', 1.5);
    for (var k = 0; k < (weights || 0); k++) { var wy = yb - h - (k + 1) * h * 0.32; rrect(x0 + (x1 - x0) * 0.22, wy, (x1 - x0) * 0.56, h * 0.3, 3, '#7d8794', '#0b1528', 1); }   // 重的車疊砝碼
    rect(x0 + 3, yb - h * 0.66, x1 - 3, yb - h * 0.22, 'rgba(255,255,255,.88)'); text(letter, (x0 + x1) / 2, yb - h * 0.44, { size: clamp(h * 0.38, 10, 16), color: '#13233f', weight: 900 });
    if (bump === 'spring') { ctx.strokeStyle = '#c9d2dc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, yb - h * 0.5); for (var i = 1; i <= 5; i++) ctx.lineTo(x1 + i * 0.004 * s, yb - h * 0.5 + (i % 2 ? -h * 0.18 : h * 0.18)); ctx.stroke(); }
    if (bump === 'velcro') rect(x1, yb - h * 0.8, x1 + 0.008 * s, yb - h * 0.2, '#7a5cc4', '#0b1528', 1);
    var lt = yb - h - (weights || 0) * h * 0.32 - 10;
    if (vel !== undefined && Math.abs(vel) > 0.004) text(fx(Math.abs(vel), 2) + ' m/s' + (vel < 0 ? ' ←' : ''), (x0 + x1) / 2, lt, { size: 11, color: '#7ce0ff', weight: 900, stroke: '#13233f' });
    else text(massText, (x0 + x1) / 2, lt, { size: 11, color: '#fff', weight: 900, stroke: '#13233f' });
  }
  function drawParkScene(st) {
    drawBg(BG.park);
    var R = L.rail, s = view.sx, t0 = Y(0), benchTop = Y(-0.025);
    // 測試桌
    ctx.fillStyle = grad(benchTop, H, '#8a5a32', '#4a2c14'); ctx.fillRect(0, benchTop, W, H - benchTop); line(0, benchTop, W, benchTop, '#c48a52', 3);
    // 氣墊軌道（鋁軌，上面有出氣孔）
    rect(X(-0.02), t0, X(R.endX + 0.06), benchTop, grad(t0, benchTop, '#e9eef4', '#8794a3'), '#0b1528', 1);
    ctx.fillStyle = 'rgba(19,35,63,.45)'; for (var hx = 0.02; hx < R.endX; hx += 0.04) ctx.fillRect(X(hx) - 1, t0 + 2, 2, 2);
    // 摩擦墊、停車格、刻度（從 B 車車頭原來的位置量，數字寫在桌上）
    var p0 = X(R.padX), p1 = X(R.padX + R.padL), f0 = R.padX + R.carL;
    rect(p0, t0 - 3, p1, t0 + 2, '#2a313b', '#0b1528', 1); ctx.fillStyle = 'rgba(255,255,255,.12)'; for (var dx = R.padX; dx < R.padX + R.padL; dx += 0.015) ctx.fillRect(X(dx), t0 - 2, 1.5, 3);
    var sx0 = X(f0 + L.slot[0]), sx1 = X(f0 + L.slot[1]), u = (performance.now() / 1000) % 1;
    rect(sx0, Y(0.11), sx1, t0 - 3, 'rgba(255,216,77,' + fx(S.mode === 'aim' ? 0.25 + 0.2 * Math.sin(u * Math.PI * 2) : 0.3, 2) + ')', '#ffd23f', 2);
    text('停車格', (sx0 + sx1) / 2, Y(0.125), { size: 11, color: '#ffd84d', weight: 900, stroke: '#13233f' });
    for (var c = 0; c <= 60; c += 10) { var xx = X(f0 + c / 100); line(xx, t0 - 6, xx, benchTop + 4, c === 40 ? '#ffd23f' : 'rgba(255,255,255,.8)', 1.2); text(String(c), xx, benchTop + 12, { size: 10, color: '#fff', weight: 900, stroke: '#3a240c', sw: 3 }); }
    text('cm（B 車頭往前滑）', X(f0 + 0.6) + 10, benchTop + 12, { size: 10, color: '#fff', weight: 800, stroke: '#3a240c', sw: 3, align: 'left' });
    text('摩擦墊 μ＝0.10', (p0 + X(f0)) / 2 - 10, benchTop + 26, { size: 10, color: '#fff', weight: 800, stroke: '#3a240c', sw: 3 });
    rect(X(R.endX), Y(0.08), X(R.endX + 0.03), t0, '#e5484d', '#0b1528', 1);   // 盡頭擋板
    // 彈簧發射器：彈簧畫到 A 車車尾（壓縮時變短）
    var aRear = st ? st.A.rear : R.plunger - P.comp / 100, base = X(0.0);
    rect(X(-0.03), Y(0.07), base, t0, '#46505c', '#0b1528', 1);
    var sp1 = Math.max(base + 4, X(Math.min(aRear, R.plunger))), coils = 9;
    ctx.strokeStyle = '#c9d2dc'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(base, Y(0.03));
    for (var i = 1; i <= coils * 2; i++) ctx.lineTo(base + (sp1 - base) * i / (coils * 2), Y(0.03) + (i % 2 ? -0.014 : 0.014) * s);
    ctx.stroke(); rect(sp1 - 2, Y(0.055), sp1 + 2, Y(0.005), '#e5484d', '#0b1528', 1);
    if (!st && P.comp > 0) { ctx.setLineDash([4, 3]); line(X(R.plunger), Y(0.075), X(R.plunger), t0, 'rgba(255,255,255,.6)', 1); ctx.setLineDash([]); text('壓 ' + fx(P.comp, 1) + ' cm', (X(R.plunger) + sp1) / 2, benchTop + 12, { size: 11, color: '#ffd84d', weight: 900, stroke: '#3a240c' }); }
    // 車子（A 車越重疊越多砝碼）
    var optA = L.opts.mA[st ? st.params.mA : P.mA], bump = st ? st.params.bump : P.bump;
    drawCarP(st ? st.B.rear : R.padX, 'B', '0.5 kg', '#9aa7b6', null, st ? st.B.v : undefined, 1);
    drawCarP(aRear, 'A', optA.name, optA.m >= 1 ? '#3a5277' : optA.m >= 0.5 ? '#2f6db5' : '#2c9a6a', bump, st ? st.A.v : undefined, optA.m >= 1 ? 2 : optA.m >= 0.5 ? 1 : 0);
  }
  function drawSlotZoom(st) {   // 右上角：停車格放大圖（B 車車頭附近 30～55 cm，放大看停在哪）
    var R = L.rail, w = Math.min(230, W * 0.36), h = 58, x0 = W - w - 8, y0 = 8, c0 = 30, c1 = 55;
    function ZX(cm) { return x0 + 10 + (w - 20) * (cm - c0) / (c1 - c0); }
    rrect(x0, y0, w, h, 8, 'rgba(11,21,40,.78)', 'rgba(255,255,255,.35)', 1.2);
    text('停車格放大圖', x0 + w / 2, y0 + 10, { size: 10, color: '#fff', weight: 900 });
    rect(ZX(L.slot[0] * 100), y0 + 18, ZX(L.slot[1] * 100), y0 + 38, 'rgba(255,216,77,.35)', '#ffd23f', 1.5);
    for (var c = c0; c <= c1; c++) { var xx = ZX(c), big = c % 5 === 0; line(xx, y0 + 38, xx, y0 + (big ? 30 : 34), '#c9d6ea', 1); if (big) text(String(c), xx, y0 + 47, { size: 9, color: '#c9d6ea', weight: 800 }); }
    var d = st ? (st.B.rear - R.padX) * 100 : 0;
    if (st && d > c0 - 3) { var bxp = ZX(clamp(d, c0 - 2, c1 + 2)); rect(bxp - 22, y0 + 20, bxp, y0 + 36, '#9aa7b6', '#0b1528', 1); line(bxp, y0 + 16, bxp, y0 + 40, '#ff6a55', 2); text(fx(d, 1) + ' cm', bxp + 4, y0 + 54, { size: 10, color: '#ffd84d', weight: 900, align: 'left' }); }
    else text('（B 車頭還沒到這一段）', x0 + w / 2, y0 + 55, { size: 9, color: '#9fb3cf', weight: 800 });
  }

  // ---------- 瞄準提示 ----------
  function aimInfo() {
    if (L.sim === 'hoop' || L.sim === 'bell') { var th = P.angle * Math.PI / 180, len = 30 + 70 * (P.speed - L.ctrl.speed.min) / (L.ctrl.speed.max - L.ctrl.speed.min); return { x: X(L.release.x), y: Y(L.release.y), dx: Math.cos(th) * len, dy: -Math.sin(th) * len }; }
    if (L.sim === 'snipe') { var t2 = P.angle * Math.PI / 180; return { x: X(L.muzzle.x), y: Y(L.muzzle.y), dx: Math.cos(t2) * 46, dy: -Math.sin(t2) * 46, label: fx(P.angle, 1) + '°・' + fx(L.v, 2) + ' m/s', lx: X(L.muzzle.x) - 0.17 * view.sx, ly: Y(0.06), la: 'left' }; }
    if (archery && Math.abs(cam.x - CAM0) < 0.3) { var t3 = P.elev * Math.PI / 180, l3 = 3.2 * view.sx; return { x: X(0), y: Y(L.release.y), dx: Math.cos(t3) * l3, dy: -Math.sin(t3) * l3, label: '仰角 ' + fx(P.elev, 2) + '°', noHead: true }; }
    return null;
  }
  function drawAim() {
    var a = aimInfo(); if (!a || S.mode !== 'aim' || S.over) return;
    if (S.shot === 0 && !drag && L.aim === 'drag') { var u = (performance.now() / 1000 * 1.4) % 1; circ(a.x, a.y, 14 + u * 22, null, 'rgba(255,216,77,' + fx(1 - u, 2) + ')', 3); text('拖住球往後拉', a.x + 16, a.y + 30, { size: 12, color: '#ffd84d', weight: 900, stroke: '#13233f', align: 'left' }); }
    ctx.setLineDash([6, 5]); line(a.x, a.y, a.x + a.dx, a.y + a.dy, '#ffd84d', a.noHead ? 2 : 3); ctx.setLineDash([]);
    if (!a.noHead) { var ang = Math.atan2(-a.dy, a.dx); ctx.fillStyle = '#ffd84d'; ctx.beginPath(); ctx.moveTo(a.x + a.dx, a.y + a.dy); ctx.lineTo(a.x + a.dx - 10 * Math.cos(ang - 0.4), a.y + a.dy + 10 * Math.sin(ang - 0.4)); ctx.lineTo(a.x + a.dx - 10 * Math.cos(ang + 0.4), a.y + a.dy + 10 * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fill(); }
    var lab = a.label || (fx(P.angle, L.ctrl.angle.digits) + '°・' + fx(P.speed, L.ctrl.speed.digits) + ' m/s');
    if (a.lx !== undefined) textIn(lab, a.lx, a.ly, { size: 12, color: '#ffd84d', weight: 900, stroke: '#13233f', align: a.la });
    else textIn(lab, a.x + a.dx + 8, a.y + a.dy - 12, { size: 12, color: '#ffd84d', weight: 900, stroke: '#13233f', align: 'left' });
  }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (FX.shake) ctx.translate((Math.random() - 0.5) * FX.shake * 2, (Math.random() - 0.5) * FX.shake * 2);
    var st = S.st, live = !!st && (S.mode === 'fly' || S.mode === 'post');   // 瞄準時球回到出手點
    if (L.sim === 'hoop') {
      drawHoopScene();
      if (!drawSpr('shooter', L.release.x, L.release.y - 0.12)) person(X(L.release.x - 0.2), Y(0), view.sy * 1.8, { x: X(L.release.x), y: Y(L.release.y) });
      drawTraces(); drawRim(false);
      var bxp = live ? st.x : L.release.x, byp = live ? st.y : L.release.y;
      if (live) drawLiveTrail(st);
      shadow(bxp, byp, L.ball.r); drawBasketball(bxp, byp, live ? st.rot : 0);
      drawRim(true);
    } else if (L.sim === 'bell') {
      drawBellScene();
      if (!drawSpr('thrower', L.release.x, L.release.y - 0.028)) person(X(-0.3), Y(0), view.sy * 1.55, { x: X(0), y: Y(L.release.y) });
      drawTraces();
      if (live) {
        drawLiveTrail(st); shadow(st.x, st.y, st.b.r); drawBall(st.x, st.y, st.b.r, st.b.color);
        var nB = 0;
        st.hits.forEach(function (h) { if (h.kind === 'floor') { nB++; var col = nB === L.need ? '#2fbf71' : nB > L.need ? '#ff9a3c' : '#ffd84d'; circ(X(h.x), Y(0) - 2, 9, col, '#13233f', 1.5); text(String(nB), X(h.x), Y(0) - 2, { size: 11, color: '#13233f', weight: 900 }); } });
        st.peaks.forEach(function (p) { text(fx(p.h * 100, 0) + ' cm', X(p.x), Y(p.y) - 12, { size: 10, color: '#fff', weight: 800, stroke: '#13233f' }); });
      } else { var b = L.balls[P.ball]; shadow(L.release.x, L.release.y, b.r); drawBall(L.release.x, L.release.y, b.r, b.color); }
    } else if (L.sim === 'pend') {
      drawPendScene(live ? st : null); drawPlate(live ? st : null); drawBellOff();
      var gun = drawSpr('toygun', L.release.x, L.release.y);
      if (!gun) { rect(X(-0.2), Y(L.release.y + 0.012), X(0.0), Y(L.release.y - 0.012), '#5c6875', '#0b1528', 1.5); }
      if (FX.flash > 0) circ(X(L.release.x + 0.01), Y(L.release.y), 6 + 14 * FX.flash, 'rgba(255,230,140,' + fx(FX.flash, 2) + ')');
      if (live && !(st.stuck && st.phase === 'swing')) drawBall(st.x, st.y, st.pel.r, st.pel.color);
      else if (!live) drawBall(L.release.x + L.pellets[P.pellet].r, L.release.y, L.pellets[P.pellet].r, L.pellets[P.pellet].color);
      drawGauge(live ? st : null);
    } else if (L.sim === 'snipe') {
      drawSnipeScene(live ? st : null); drawTraces();
      if (live) { drawLiveTrail(st); drawBall(st.x, st.y, L.ball.r, '#c9d2dc'); }
      drawCannon(live ? st.params.angle : P.angle);
      if (FX.flash > 0) circ(X(L.muzzle.x), Y(L.muzzle.y), 6 + 16 * FX.flash, 'rgba(220,240,255,' + fx(FX.flash, 2) + ')');
      if (!S.over && S.round < L.rounds) textIn('第 ' + (S.round + 1) + ' 輪／' + L.rounds + '・每輪 1 發', W - 10, 16, { size: 12, color: '#fff', weight: 900, stroke: '#13233f', align: 'right' });
    } else if (L.sim === 'park') {
      drawParkScene(live ? st : null); drawSlotZoom(live || (st && S.lastPark) ? st : null);
    } else {
      drawArrowScene(); drawTraces();
      if (live && !st.done) {
        drawLiveTrail(st); drawArrowShaft(st.x, st.y, Math.atan2(st.vy, st.vx), 0.72);
        if (Y(st.y) < 4) textIn('↑ 箭在 ' + fx(st.y, 1) + ' m 高', X(st.x), 14, { size: 12, color: '#ffd84d', weight: 900, stroke: '#13233f' });   // 飛出畫面上緣
      }
      drawMini(); drawFace();
    }
    drawAim(); drawFx();
  }

  // ---------- 操作列 ----------
  var CH_NAME = function (k, v) { var src = k === 'ball' ? L.balls : k === 'pellet' ? L.pellets : k === 'arrow' ? L.arrows : L.opts[k]; return src[v].name; };
  function buildBar() {
    var h = '';
    Object.keys(L.ctrl).forEach(function (k) {
      var c = L.ctrl[k];
      if (c.choices) { h += '<div class="cg"><span class="cl">' + c.label + '</span>' + c.choices.map(function (v) { return '<button type="button" data-ch="' + k + ':' + v + '"' + (P[k] === v ? ' class="on"' : '') + '>' + CH_NAME(k, v) + '</button>'; }).join('') + '</div>'; }
      else h += '<div class="cg"><span class="cl">' + c.label + '</span><button type="button" data-st="' + k + ':-1" aria-label="' + c.label + '減少">−</button><span class="cv" id="v_' + k + '">' + fx(P[k], c.digits) + ' ' + c.unit + '</span><button type="button" data-st="' + k + ':1" aria-label="' + c.label + '增加">＋</button></div>';
    });
    h += '<button type="button" class="go" id="btnGo">' + ({ hoop: '投', bell: '丟', pend: '發射', arrow: '放箭', snipe: '發射', park: '放手' }[L.sim]) + '</button>';
    bar.innerHTML = h;
    $('#btnGo').addEventListener('click', fire);
  }
  function setVal(k, v) { var c = L.ctrl[k]; P[k] = Math.round(clamp(v, c.min, c.max) / c.step) * c.step; var el = $('#v_' + k); if (el) el.textContent = fx(P[k], c.digits) + ' ' + c.unit; }
  var rep = null;
  bar.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('button[data-st]'); if (!b || S.mode !== 'aim') return;
    var a = b.getAttribute('data-st').split(':'), k = a[0], d = +a[1], c = L.ctrl[k];
    setVal(k, P[k] + d * c.step); sfx('slider_tick');
    var n = 0; clearInterval(rep); rep = setInterval(function () { n++; if (n > 4) { setVal(k, P[k] + d * c.step * (n > 20 ? 10 : 1)); } }, 90);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { bar.addEventListener(ev, function () { clearInterval(rep); }); });
  bar.addEventListener('click', function (e) { var b = e.target.closest('button[data-ch]'); if (!b || S.mode !== 'aim') return; var a = b.getAttribute('data-ch').split(':'); P[a[0]] = a[1]; sfx('ui_tap'); buildBar(); });

  // ---------- 拖曳瞄準（投籃、丟球）：拖住球往後拉 ----------
  var drag = null;
  function evPos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  cv.addEventListener('pointerdown', function (e) {
    if (S.mode !== 'aim' || L.aim !== 'drag' || S.over) return;
    var p = evPos(e), bx = X(L.release.x), by = Y(L.release.y);
    if (Math.hypot(p.x - bx, p.y - by) > 70) return;
    drag = { x0: bx, y0: by, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件 */ }
  });
  cv.addEventListener('pointermove', function (e) {
    if (!drag) return; var p = evPos(e), dx = drag.x0 - p.x, dy = p.y - drag.y0, len = Math.hypot(dx, dy);   // 往後拉：發射方向和拉的方向相反
    if (len < 12) return; drag.moved = true;
    var c = L.ctrl;
    setVal('angle', Math.atan2(dy, dx) * 180 / Math.PI);
    setVal('speed', c.speed.min + (c.speed.max - c.speed.min) * clamp((len - 12) / 160, 0, 1));
  });
  function endDrag() { if (!drag) return; var d = drag; drag = null; if (d.moved) fire(); }
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', function () { drag = null; });

  // ---------- 發射、事件特效、結果 ----------
  function fire() {
    if (S.mode !== 'aim' || S.over) return;
    var p = {}; Object.keys(P).forEach(function (k) { p[k] = P[k]; }); p.wind = S.wind; if (L.sim === 'snipe') { p.target = S.targets[S.round]; S.boxT = 1; }
    S.st = SIM.SIMS[L.sim].create(L, p); S.st.params = p; S.mode = 'fly'; S.lastPark = false;
    dataBox.hidden = true; $('#toast').classList.remove('show');   // 紀錄卡、提示飛行中先收起來，不要蓋住軌跡和特效（落地後顯示這一發的數據）
    FX.bellOff = null;
    if (archery) { setCam(CAM0); S.backT = 0; }
    if (L.sim === 'pend') { sfx('pop'); FX.flash = 1; burst(X(L.release.x + 0.01), Y(L.release.y), 10, { colors: ['#fff3b0', '#ffd84d', '#ffffff'], v: 120, g: 0, life: 0.25, size: 2.5, a0: 0, spread: 1.2 }); }
    else if (L.sim === 'snipe') { sfx('pop'); FX.flash = 1; burst(X(L.muzzle.x), Y(L.muzzle.y), 12, { colors: ['#e9f4ff', '#ffffff', '#9fd3ff'], v: 110, g: 0, life: 0.3, size: 2.5, a0: P.angle * Math.PI / 180, spread: 1.0 }); }
    else if (L.sim === 'park') sfx('action');
    else sfx('whoosh');
  }
  function timeScale(st) {   // 慢動作：快到目標時放慢（只影響畫面播放速度，算出來的物理量不變）
    if (L.sim === 'hoop') { var H0 = L.hoop, cx = H0.board - (H0.nearIn + H0.farIn) / 2; return st.vy < 0 && Math.hypot(st.x - cx, st.y - H0.rimY) < 0.55 ? 0.4 : 1; }
    if (L.sim === 'bell') return Math.hypot(st.x - L.bell.x, st.y - L.bell.y) < 0.35 ? 0.35 : 1;
    if (L.sim === 'pend') return st.phase === 'fly' ? Math.min(1, (L.plate.x - L.release.x) / Math.max(0.3, st.params.speed) / 0.35) : 1;
    if (L.sim === 'snipe') { var T = st.T; return Math.abs(st.x - T.x) < 0.1 || Math.abs(st.x - L.wall.x) < 0.06 ? 0.3 : 0.6; }
    if (L.sim === 'park') { if (st.ev.vB === null) return st.A.rear + L.rail.carL > st.B.rear - 0.04 ? 0.35 : (st.A.v < 0.2 && st.phase === 'run' ? 3 : 1); return 1; }
    return st.x > L.dist - 6 ? 0.2 : 0.6;
  }
  function hitFx(h, st) {
    var px = X(st.x), py = Y(st.y);
    if (h.kind === 'board') { sfx('board'); burst(X(L.hoop.board), py, 8, { color: '#ffffff', v: 110, life: 0.4, size: 2 }); shake(2); }
    else if (h.kind === 'rim') { sfx('rim'); burst(px, py, 10, { color: '#ffb347', v: 160, life: 0.45, size: 2.5 }); shake(3); }
    else if (h.kind === 'wall' && L.sim === 'hoop') sfx('ball_land');
    else if (h.kind === 'net') FX.net = 0;
    else if (h.kind === 'floor') {
      sfx('ball_land');
      if (L.sim === 'bell') { var n = st.ev.bounce; popup(String(n), X(h.x), Y(0) - 30, { size: 26, color: n === L.need ? '#5dffa0' : n > L.need ? '#ff9a3c' : '#ffffff', life: 0.9 }); burst(X(h.x), Y(0) - 2, 8, { color: 'rgba(235,235,245,.9)', v: 70, g: 160, life: 0.5, a0: Math.PI / 2, spread: 2.4, size: 2.5 }); }
    }
    else if (h.kind === 'ceiling') { sfx('ball_land'); burst(px, Y(L.ceiling) + 3, 6, { color: '#ffffff', v: 70, life: 0.4, size: 2 }); }
    else if (h.kind === 'bell' && L.sim === 'bell') { sfx('bell'); FX.bell = 0; shake(2); }
    else if (h.kind === 'plate') { sfx('rim'); burst(X(L.plate.x - L.plate.w / 2), Y(st.ev.hitAt), 14, { colors: ['#ffd84d', '#ffffff', '#ffb347'], v: 190, life: 0.4, size: 2.2 }); shake(3); }
    else if (h.kind === 'bell' && L.sim === 'pend') { sfx('bell'); FX.pbell = 0; if (st.ev.ring) { popup('噹！', X(L.plate.x + 0.1), Y(L.plate.pivotY - 0.08), { size: 30 }); celebrate(); } }
    else if (h.kind === 'frame') { sfx('board'); shake(3); }
    else if (h.kind === 'bellOff') { /* 太大力：鈴被撞飛 */ var bg = bellGeom(bg0()); sfx('board'); shake(5); FX.bellOff = { x: bg.x, y: bg.y, vx: 1.2, vy: 1.4, rot: 0, w: 9, t: 0 }; popup('太大力！鈴被撞飛了', X(L.plate.x + 0.12), Y(L.plate.pivotY - 0.06), { size: 18, color: '#ffb3a8' }); }
    else if (h.kind === 'wall') { sfx('board'); burst(px, py, 10, { color: '#ffffff', v: 120, life: 0.4, size: 2 }); popup(st.ev.miss && st.ev.miss.indexOf('擦到') === 0 ? '擦到窗口！' : '撞牆！', px - 20, py - 56, { size: 22, color: '#ffd84d' }); shake(4); }
    else if (h.kind === 'goal') { sfx('board'); burst(px, py, 8, { color: '#ffffff', v: 110, life: 0.4, size: 2 }); }
    else if (h.kind === 'goal_in' || h.kind === 'in') sfx('cup_hit');
    else if (h.kind === 'bump' || h.kind === 'stick') { var cxp = X(st.B.rear); sfx(h.kind === 'bump' ? 'board' : 'ball_land'); burst(cxp, Y(0.03), 12, { color: h.kind === 'bump' ? '#ffd84d' : '#c58cff', v: 120, life: 0.4, size: 2.2 }); popup(h.kind === 'bump' ? '碰！' : '啪（黏住）', cxp, Y(0.16), { size: 18, color: '#ffffff' }); shake(2); }
    else if (h.kind === 'end') { sfx('board'); shake(5); popup('撞到盡頭！', X(L.rail.endX) - 30, Y(0.16), { size: 18, color: '#ffb3a8' }); }
  }
  function liveFx(st) {   // 每一格檢查有沒有新事件
    var hs = st.hits || [];
    for (var i = st._heard || 0; i < hs.length; i++) hitFx(hs[i], st);
    st._heard = hs.length;
    if (L.sim === 'hoop' && st.ev.made && !st._made) { st._made = true; FX.net = 0; sfx('swish'); }   // 算不算空心要等球整顆穿過（impactFx）
    if (L.sim === 'pend' && st.phase === 'swing' && !st._peakFx && st._peaked && !st.ev.ring && !st.ev.hard) { st._peakFx = true; popup('差 ' + fx((L.ringH[0] - st.ev.h) * 100, 1) + ' cm 才碰到鈴', W - 150, H * 0.45, { size: 16, color: '#ffffff' }); }
  }
  function impactFx(st) {   // 結果定了的那一刻（判定），文字放在目標上方，彩帶從畫面邊緣噴
    var ev = st.ev;
    if (L.sim === 'hoop') {
      var R = rimGeom();
      if (ev.swish) { popup('空心！', R.cx - 30, R.cy - 70, { size: 32 }); celebrate(); }
      else if (ev.made) popup(ev.bank ? '擦板進（不算空心）' : '碰框進（不算空心）', R.cx - 40, R.cy - 60, { size: 16, color: '#ffffff' });
      else popup(ev.stuck ? '卡住了！' : '可惜！', R.cx - 30, R.cy - 60, { size: 20, color: '#ffffff' });
    }
    if (L.sim === 'bell') {
      var bx = X(L.bell.x), by = Y(L.bell.y + 0.45), okB = ev.hitBell && (L.exact ? ev.bellAfter === L.need : ev.bellAfter >= L.need);
      if (okB) { popup('叮！', bx - 30, by, { size: 34 }); celebrate(); }
      else if (ev.hitBell) popup(ev.bellAfter < L.need ? '太早打到了！' : '彈太多次了！', bx - 50, by, { size: 18, color: '#ffb347' });
      else popup('沒打到鈴', bx - 40, by, { size: 18, color: '#ffffff' });
    }
    if (L.sim === 'pend' && ev.miss) popup('沒打到', X(L.plate.x), Y(L.plate.y + 0.1), { size: 18, color: '#ffffff' });   // 鈴響的慶祝等鐵牌真的碰到鈴（hitFx 'bell'）
    if (L.sim === 'arrow') {
      var ang = Math.atan2(st.vy, st.vx), bt = L.bossY;
      if (ev.ground) { S.stuck.push({ x: st.x, y: 0.03, ang: ang, ground: true }); sfx('ball_land'); popup('射到地上', X(st.x), Y(0.9), { size: 20, color: '#ffffff' }); }
      else if (st.y >= bt[0] && st.y <= bt[1]) {
        S.stuck.push({ x: L.dist + 0.03, y: st.y, ang: ang }); sfx('arrow_hit'); shake(2);
        burst(X(L.dist), Y(st.y), 12, { colors: ['#d9c27a', '#fff3b0', '#ffffff'], v: 130, life: 0.5, size: 2.2 });
        var sc = ev.score, label = sc >= 10 ? (ev.r < L.face / 40 ? 'X！正中心' : '10 分！') : sc > 0 ? sc + ' 分' : '沒上靶紙';
        popup(label, X(L.dist) - 40, Y(bt[1]) - 24, { size: sc >= 9 ? 30 : 22, color: sc >= 9 ? '#ffd84d' : '#ffffff' });
        if (sc >= 9) celebrate();
      } else if (st.y < bt[0]) { S.stuck.push({ x: L.dist + 0.6, y: 0.02, ang: ang, ground: true }); sfx('ball_land'); popup('從靶下面過去了（仰角太小）', X(L.dist) - 40, Y(1.2), { size: 18, color: '#ffffff' }); }
      else popup('從靶上面飛過去了（仰角太大）', X(L.dist) - 40, Y(2.4), { size: 18, color: '#ffffff' });
    }
    if (L.sim === 'snipe') { var T = st.T; if (ev.inGoal) { popup('進球！', X(T.x), Y(T.y + L.goal.d / 2 + L.goal.top) - 30, { size: 30 }); celebrate(); } else if (ev.hitGoal) popup('彈出去了！', X(T.x), Y(T.y) - 40, { size: 20, color: '#ffffff' }); else if (!ev.hitWall) popup('沒進', X(T.x), Y(T.y) - 40, { size: 20, color: '#ffffff' }); }
    if (L.sim === 'park') { var fB = X(st.B.rear + L.rail.carL); if (ev.inSlot) { sfx('cup_hit'); popup('停進格子！', fB - 20, Y(0.22), { size: 26 }); celebrate(); } else if (ev.vB !== null) popup(ev.dB < L.slot[0] ? '差一點' : '滑過頭', fB, Y(0.2), { size: 20, color: '#ffffff' }); }
  }
  function finish() {
    var st = S.st, ev = st.ev, ok = false, h = '', p = st.params;
    S.mode = 'aim';
    if (L.sim === 'hoop') {
      S.shot++;
      ok = ev.swish;
      var pass = ev.passX === null ? (ev.maxY < L.hoop.rimY ? '球最高點沒到籃框高度（' + fx(ev.maxY, 2) + ' m）' : '球在籃框前面就掉下去了（太近），或打到籃板／籃框彈開') : '球心經過籃框平面時離框中心 ' + (ev.passX >= 0 ? '+' : '') + fx(ev.passX * 100, 0) + ' cm（' + (ok ? '在空心範圍內' : ev.passX > 0.02 ? '偏籃板那邊、太遠' : ev.passX < -0.02 ? '偏你這邊、太近' : '很準，但有碰到') + '）';
      h = '<b>第 ' + S.shot + ' 球</b>　仰角 ' + fx(p.angle, 1) + '°、出手 ' + fx(p.speed, 2) + ' m/s・最高 ' + fx(ev.maxY, 2) + ' m<br>' + pass + '<br>碰板 ' + ev.board + ' 次、碰框 ' + ev.rim + ' 次 → ' +
        (ok ? '<span class="hit">空心進球！</span>' : ev.stuck ? '<span class="miss">' + (ev.stuck === 'top' ? '球卡在籃板上面' : '球卡在籃框和籃板中間') + '</span>' : ev.made ? '<span class="miss">進了，但' + (ev.bank ? '打板' : '碰框') + '，不是空心</span>' : '<span class="miss">沒進</span>');
    } else if (L.sim === 'bell') {
      S.shot++;
      ok = ev.hitBell && (L.exact ? ev.bellAfter === L.need : ev.bellAfter >= L.need);
      var pk = st.peaks.map(function (q) { return fx(q.h * 100, 0); }).join('、');
      h = '<b>第 ' + S.shot + ' 次</b>　' + L.balls[p.ball].name + '、' + fx(p.angle, 0) + '°、' + fx(p.speed, 2) + ' m/s<br>彈地 ' + ev.bounce + ' 次' + (pk ? '（每跳最高：球底離地 ' + pk + ' cm）' : '') + ' → ' +
        (ok ? '<span class="hit">彈 ' + ev.bellAfter + ' 次後打中鈴！</span>' : ev.hitBell ? '<span class="miss">彈 ' + ev.bellAfter + ' 次' + (ev.bellAfter < L.need ? '就' : '才') + '打中，不算（要剛好 ' + L.need + ' 次）</span>' : '<span class="miss">' + (ev.miss || '沒打中鈴') + '</span>');
    } else if (L.sim === 'pend') {
      S.shot++;
      ok = ev.ring;
      h = '<b>第 ' + S.shot + ' 發</b>　' + L.pellets[p.pellet].name + '、' + fx(p.speed, 1) + ' m/s<br>' + (ev.miss ? '<span class="miss">' + ev.miss + '</span>' :
        '鐵牌被打到後的速度 V ＝ ' + fx(ev.V, 2) + ' m/s → ' + (ev.h > L.plate.len * (1 - Math.cos(L.frame[1])) ? '能升高 h ＝ V²／2g ＝ ' + fx(ev.h * 100, 1) + ' cm（被機台擋框擋在 ' + fx(L.plate.len * (1 - Math.cos(L.frame[1])) * 100, 1) + ' cm）' : '升高 h ＝ V²／2g ＝ ' + fx(ev.h * 100, 1) + ' cm') + ' → ' + (ok ? '<span class="hit">鈴響了！</span>' : ev.hard ? '<span class="miss">超過 6 cm，太大力，鈴被撞飛了</span>' : '<span class="miss">差 ' + fx((L.ringH[0] - ev.h) * 100, 1) + ' cm 才碰到鈴</span>'));
    } else if (L.sim === 'snipe') {
      var T = st.T, dx = (T.x - L.muzzle.x) * 100, dy = (T.y - L.muzzle.y) * 100;
      ok = ev.inGoal; S.devs.push(Math.abs(p.angle - T.th0));
      h = '<b>第 ' + (S.round + 1) + ' 輪</b>　洞口：x ＝ ' + fx(dx, 1) + ' cm、y ＝ ' + (dy >= 0 ? '+' : '−') + fx(Math.abs(dy), 1) + ' cm・仰角 ' + fx(p.angle, 1) + '°<br>' +
        (ev.wallY !== null ? '經過牆時離窗口中心 ' + fx(Math.abs(ev.wallY - T.wy) * 100, 1) + ' cm（窗口 4 cm、鋼珠 3.2 cm，牆有厚度、球斜著穿過：上下只剩約 0.2～0.4 cm）' : '沒有飛到牆') +
        (ev.goalY !== null ? '<br>到洞口時離洞口中心 ' + fx(Math.abs(ev.goalY - T.y) * 100, 1) + ' cm（洞口 6 cm：上下約剩 1.2～1.4 cm）' : '') + ' → ' +
        (ok ? '<span class="hit">進球！</span>' : '<span class="miss">' + (ev.miss || '沒進') + '</span>');
      S.results.push(ok); S.boxFrom = T; S.round++; S.boxT = 0; S.clearTraces = true;
    } else if (L.sim === 'park') {
      if (ev.vB !== null) S.shot++;   // 沒撞到 B 車（沒壓彈簧、A 車太慢）這次不算，不扣次數
      S.lastPark = true;
      ok = ev.inSlot; var oA = L.opts.mA[p.mA];
      h = '<b>' + (ev.vB === null ? '這次不算' : '第 ' + S.shot + ' 次') + '</b>　A 車 ' + oA.name + '、' + L.opts.bump[p.bump].name + '、壓 ' + fx(p.comp, 1) + ' cm<br>' +
        (ev.vB === null ? '<span class="miss">' + (ev.miss || '沒撞到 B 車') + '（不扣次數）</span>' :
        '彈簧做功 ½kx² ＝ ' + fx(ev.W, 3) + ' J → A 車 ' + fx(ev.vA, 3) + ' m/s → 撞後 B 車 ' + fx(ev.vB, 3) + ' m/s（A 車 ' + fx(ev.vA2, 3) + ' m/s）<br>B 車往前滑 ' + fx(ev.dB * 100, 1) + ' cm（停車格 ' + L.slot[0] * 100 + '～' + L.slot[1] * 100 + ' cm）→ ' +
        (ok ? '<span class="hit">停進格子！</span>' : '<span class="miss">' + ev.miss + '</span>'));
    } else if (L.sim === 'arrow') {
      var isP = S.practice > 0, score = ev.score, side = ev.dz >= 0 ? '右 ' : '左 ', up = ev.dy >= 0 ? '上 ' : '下 ', a = L.arrows[p.arrow];
      S.holes.push({ dz: ev.dz, dy: ev.dy, practice: isP });
      h = '<b>' + (isP ? '試射' : '第 ' + (S.round + 1) + ' 箭') + '</b>（' + (S.wind > 0 ? '側風從左 ' + fx(S.wind, 1) + ' m/s' : '無風') + '）　' + a.name + '、仰角 ' + fx(p.elev, 2) + '°、左右瞄 ' + fx(p.windage, 0) + ' cm<br>' +
        (ev.ground ? '<span class="miss">箭射到地上了（仰角太小）</span>' : (ev.atY < L.bossY[0] || ev.atY > L.bossY[1]) ? '<span class="miss">箭到 70 m 時離地 ' + fx(ev.atY, 2) + ' m，從靶' + (ev.atY < L.bossY[0] ? '下面' : '上面') + '過去了（靶心離地 ' + L.targetY + ' m）</span>' : '飛行 ' + fx(ev.tof, 3) + ' s（真空中只要 70 ÷ (' + a.v + '×cos' + fx(p.elev, 2) + '°) ＝ ' + fx(L.dist / (a.v * Math.cos(p.elev * Math.PI / 180)), 3) + ' s）・箭孔：' + side + fx(Math.abs(ev.dz) * 100, 1) + ' cm、' + up + fx(Math.abs(ev.dy) * 100, 1) + ' cm → ' + (score >= 9 ? '<span class="hit">' + score + ' 分</span>' : '<span class="miss">' + score + ' 分</span>'));
      if (isP) { S.practice--; S.wind = S.winds[0]; }
      else { S.results.push(score); S.round++; S.wind = S.round < L.rounds ? S.winds[S.round] : 0; }
      S.backT = 0.6;
    }
    if (L.sim !== 'arrow' && L.sim !== 'snipe') S.results.push(ok);
    if (S.clearTraces) { S.traces = []; S.clearTraces = false; } else { S.traces.push({ pts: st.trail.slice(), ok: L.sim === 'arrow' ? ev.score >= 9 : ok }); if (S.traces.length > 4) S.traces.shift(); }
    dataBox.innerHTML = h; dataBox.hidden = false;
    updateShots(); buildBar();
    if (L.sim === 'snipe') {
      sfx(ok ? 'cup_hit' : 'miss', 0.05);
      if (S.round >= L.rounds) { var nIn = S.results.filter(Boolean).length; if (nIn >= L.need) return win({ all: nIn === L.rounds, close: S.devs.every(function (d) { return d < 0.3; }) && nIn === L.rounds }); S.over = true; return setTimeout(lose, 600); }
      var nt = S.targets[S.round], ndx = (nt.x - L.muzzle.x) * 100, ndy = (nt.y - L.muzzle.y) * 100;
      toast('第 ' + (S.round + 1) + ' 輪：裁判把得分箱搬到 x ＝ ' + fx(ndx, 1) + ' cm、y ＝ ' + (ndy >= 0 ? '+' : '−') + fx(Math.abs(ndy), 1) + ' cm。先算再發射。');
      return;
    }
    if (L.sim === 'arrow') {
      if (S.round >= L.rounds) { var good = S.results.filter(function (s) { return s >= 9; }).length; if (good >= L.need) return win({ all: good === L.rounds, ten: S.results.some(function (s) { return s >= 10; }) }); return lose(); }
      if (!S.holes[S.holes.length - 1].practice && ev.score < 9) sfx('miss', 0.05);
      toast(S.practice > 0 ? '再試射一次' : '下一輪的側風：從左 ' + fx(S.wind, 1) + ' m/s。看靶面的箭孔，算一下要往左瞄多少。');
      return;
    }
    if (ok) return win({});
    sfx('miss', 0.05);
    if (S.shot >= L.shots) { S.over = true; return setTimeout(lose, 600); }
    if (S.shot % 3 === 0 && L.fail) toast('線索：' + L.fail); else toast('還剩 ' + (L.shots - S.shot) + ' 次。看紀錄卡的數據再調。');
  }
  function starsOf(extra) {
    if (archery) return [true, !!extra.all, !!extra.ten];
    if (L.sim === 'snipe') return [true, !!extra.all, !!extra.close];
    return [true, S.shot <= L.starLine[0], S.shot <= L.starLine[1]];
  }
  function win(extra) {
    S.over = true;
    var got = starsOf(extra), n = got.filter(Boolean).length;
    if (window.LabRecords) window.LabRecords.onPass(L.id, n);
    sfx('pass'); for (var k = 1; k <= n; k++) sfx('star' + k, 1.15 + 0.34 * (k - 1));
    popup('過關！', W / 2, H * 0.42, { size: 46, life: 1.6 });
    for (var c = 0; c < 6; c++) burst(W * (c + 0.5) / 6, -10, 16, { confetti: true, v: 120, g: 260, colors: CONF, life: 2.2, size: 4.5, a0: -Math.PI / 2, spread: 2.2 });
    setTimeout(function () {
      openSheet('<div class="stars">' + [0, 1, 2].map(function (i) { return '<span' + (got[i] ? '' : ' class="off"') + '>★</span>'; }).join('') + '</div><h2>過關！</h2>' + (L.win ? '<p class="say">' + L.win + '</p>' : '') +
        '<ul>' + L.stars.map(function (s, i) { return '<li>' + (got[i] ? '✓ ' : '✗ ') + s + '</li>'; }).join('') + '</ul>' +
        '<div class="learn">' + dataBox.innerHTML + '</div><div class="learn"><b>背後的科學</b><br>' + L.learn + '</div>' + (L.bonus ? '<div class="learn bonus"><b>延伸挑戰</b><br>' + L.bonus + '</div>' : '') +
        '<div class="learn src"><b>數據出處</b><br>' + L.src + '</div>' +
        '<div class="row"><a href="sport.html?lv=' + no + '">再玩一次</a>' + (no < LV.length ? '<a class="go" href="sport.html?lv=' + (no + 1) + '">下一關</a>' : '<a class="go" href="index.html">關卡列表</a>') + '</div>');
    }, 1300);
  }
  function lose() {
    S.over = true; sfx('miss');
    openSheet('<h2>' + (rounds ? '這一組沒過' : '次數用完了') + '</h2><p>' + (archery ? '3 箭裡要有 ' + L.need + ' 箭進 9 分圈。' : rounds ? L.rounds + ' 輪裡要有 ' + L.need + ' 輪進球。' : L.shots + ' 次都沒成功。') + '看看留下來的數據，想想該怎麼調，再試一次！</p>' + (L.fail ? '<div class="learn"><b>線索</b><br>' + L.fail + '</div>' : '') + '<div class="learn">' + dataBox.innerHTML + '</div>' +
      '<div class="row"><a href="index.html">關卡列表</a><a class="go" href="sport.html?lv=' + no + '">重來</a></div>');
  }
  function openSheet(h) { var sh = $('#sheet'); sh.innerHTML = h; $('#ov').classList.add('show'); var a = $('#sheet .go'); if (a) { try { a.focus({ preventScroll: true }); } catch (e) { a.focus(); } } sh.scrollTop = 0; }   // 先看到星星，不要直接捲到最下面
  function updateShots() { var n = totalShots(), used = rounds ? S.round : S.shot, h = ''; for (var i = 0; i < n; i++) h += '<i' + (i < used ? ' class="used"' : '') + '></i>'; $('#shots').innerHTML = h; $('#shots').setAttribute('aria-label', '剩下 ' + (n - used) + ' 次'); }
  var toastT = 0;
  function toast(t) { var el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, 2800); }

  // 委託單（每關開場的情境；手機橫放時任務列收起來，按標題列的「任務」再看一次）：只放程式內建的關卡文字
  function showBrief(again) {
    openSheet('<div class="brief"><span class="tag">' + (again ? '任務' : '新挑戰') + '</span><h2>' + L.title + '</h2><p class="topic">' + L.stage + (L.topic ? '・' + L.topic : '') + '</p>' +
      '<ul class="story">' + L.story.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul><div class="goal"><b>任務</b>' + L.mission + '</div>' +
      '<p class="how-brief"><b>怎麼操作</b>　' + L.note + '</p>' +
      '<div class="row"><a href="index.html">換一個挑戰</a><button type="button" class="go" id="accept">' + (again ? '繼續' : '開始') + '</button></div></div>');
    $('#accept').addEventListener('click', function () { $('#ov').classList.remove('show'); sfx('ui_tap'); });
  }

  // ---------- 主迴圈 ----------
  var tPrev = 0, POST = { hoop: 0.5, bell: 0.8, pend: 0.3, arrow: 1.3, snipe: 0.7, park: 0.6 };
  function camStep(dt) {   // 射箭的鏡頭：箭飛的時候跟著箭；射完停在靶那邊一下，再慢慢回到射手
    var tgt = CAM0;
    if ((S.mode === 'fly' || S.mode === 'post') && S.st) tgt = clamp(S.st.x - W / view.sx * 0.4, CAM0, camMax());
    else if (S.backT > 0) { S.backT -= dt; tgt = cam.x; }
    setCam(S.mode === 'fly' ? tgt : cam.x + (tgt - cam.x) * Math.min(1, dt * 3.5));
  }
  function stepSim(dt) { SIM.SIMS[L.sim].step(L, S.st, dt * (S.mode === 'fly' ? timeScale(S.st) : 1)); liveFx(S.st); }
  function loop(ts) {
    requestAnimationFrame(loop);
    var dt = tPrev ? Math.min(0.05, (ts - tPrev) / 1000) : 0; tPrev = ts;
    if (S.mode === 'fly' && S.st) {
      stepSim(dt);
      if (S.st.judged) { S.mode = 'post'; S.postT = POST[L.sim]; impactFx(S.st); }
    } else if (S.mode === 'post' && S.st) {
      if (!S.st.done) stepSim(dt);   // 判定後動畫繼續（球落地、鐵牌擺停）
      S.postT -= dt;
      if (S.postT <= 0 && (S.st.done || S.postT < -2.5)) finish();
    }
    if (L.sim === 'snipe' && S.boxT < 1 && S.mode === 'aim') S.boxT = Math.min(1, S.boxT + dt / 0.7);
    if (archery) camStep(dt);
    stepFx(dt);
    draw();
  }

  // ---------- 開場 ----------
  $('#stage').textContent = L.stage; $('#title').textContent = L.title; $('#diff').textContent = L.diff;
  $('#missionText').textContent = L.mission; $('#howText').textContent = L.note; document.title = '瘋狂實驗室｜' + L.title;
  $('#btnHow').addEventListener('click', function () { var hw = $('#howText'); hw.hidden = !hw.hidden; this.setAttribute('aria-expanded', String(!hw.hidden)); this.textContent = hw.hidden ? '怎麼操作' : '收起'; $('#mission').classList.toggle('open', !hw.hidden); resize(); });
  var bb = $('#btnBrief'); if (bb) bb.addEventListener('click', function () { if (!S.over) { showBrief(true); sfx('ui_tap'); } });
  var sb = $('#btnSfx');
  var SPK = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var SPKX = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function showSfx(m) { sb.innerHTML = m ? SPKX : SPK; sb.setAttribute('aria-pressed', String(!m)); sb.setAttribute('aria-label', m ? '音效：關' : '音效：開'); }
  if (window.LabSfx) { showSfx(window.LabSfx.isMuted()); window.LabSfx.onChange(showSfx); sb.addEventListener('click', function () { window.LabSfx.setMuted(!window.LabSfx.isMuted()); sfx('ui_tap'); }); } else sb.hidden = true;
  if (archery) document.body.classList.add('arch');   // 紀錄卡往右移，不要蓋住射手
  if (window.LabRecords) window.LabRecords.markPlay();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap); else window.addEventListener('resize', resize);
  resize(); buildBar(); updateShots(); showBrief(false);
  requestAnimationFrame(loop);
  window.__sport = { S: S, L: L, P: P, FX: FX, fire: fire, setVal: setVal, X: X, Y: Y, cam: cam };
})();
