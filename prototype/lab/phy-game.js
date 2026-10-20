/* 瘋狂實驗室・物理實驗台（老闆 10/19：操作要學 nobook、要像《憤怒鳥》有挑戰和自由度、畫質要高、背景不要白）
 * 操作（照 nobook 的手法）：
 *   器材櫃的器材拖到實驗台；點器材出現選取框：拖上方圓鈕旋轉、拖兩端方塊改長短、直接拖著移動；
 *   器材的「部位」可以直接操作：發射器的紅色推桿往後拉、放手就發射；翹翹板的黃色支點左右拖；釋放夾往下拖改高度；
 *   球拖到發射器（或翹翹板、釋放夾）上就裝進去。兩指或滾輪縮放、拖空白處移動視角。
 * 物理由 physics.js 真的算（拋體、碰撞、滾動、槓桿、空氣阻力），每關次數有限。
 * innerHTML 只放程式內的文字與算出來的數字，沒有玩家輸入的文字。 */
(function () {
  'use strict';
  var PH = window.LabPhysics, M = window.PhyModel, V = PH.V, D2R = M.D2R, LV = window.PHY_LEVELS;
  var no = Math.max(1, Math.min(LV.length, parseInt(new URLSearchParams(location.search).get('lv'), 10) || 1));
  var level = LV[no - 1], TRACK = level.track || null;
  function $(s) { return document.querySelector(s); }
  function sfx(n, d) { if (window.LabSfx) window.LabSfx.play(n, d); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }

  var cv = $('#cv'), ctx = cv.getContext('2d'), wrap = $('#stageWrap'), toolbar = $('#toolbar'), dataBox = $('#data');
  var W = 0, H = 0, DPR = 1;
  var cam = { x: level.world.w / 2, y: (level.world.h - 1) / 2, s: 50, fit: 50, user: false };
  var S = { items: [], sel: null, mode: 'build', shots: level.shots, shot: 0, traces: [], passed: false, run: null, uid: 0, fx: [], last: null };

  // ---------- 器材櫃 ----------
  var SHELF = {
    plank: { name: '木板', kind: 'item' }, bumper: { name: '彈力板', kind: 'item' }, sponge: { name: '海綿墊', kind: 'item' }, seesaw: { name: '翹翹板', kind: 'item' },
    steel: { name: '鋼珠', kind: 'ball' }, wood: { name: '木球', kind: 'ball' }, pingpong: { name: '乒乓球', kind: 'ball' },
    iron05: { name: '鐵球 0.5 kg', kind: 'iron' }, iron1: { name: '鐵球 1 kg', kind: 'iron' }, iron2: { name: '鐵球 2 kg', kind: 'iron' },
    car1000: { name: '滑車 1 kg', kind: 'car', m: 1.0 }, car500: { name: '滑車 500 g', kind: 'car', m: 0.5 }, car200: { name: '滑車 200 g', kind: 'car', m: 0.2 },
    car100: { name: '滑車 100 g', kind: 'car', m: 0.1 }, car50: { name: '滑車 50 g', kind: 'car', m: 0.05 }, carVelcro: { name: '魔鬼氈 200 g', kind: 'car', m: 0.2, velcro: true }
  };
  var CAR_W = 0.9, CAR_H = 0.42;
  var ICON = {
    plank: '<rect x="4" y="16" width="40" height="8" rx="2" fill="#d9a066" stroke="#13233f" stroke-width="2"/>',
    bumper: '<rect x="4" y="16" width="40" height="8" rx="3" fill="#e5484d" stroke="#13233f" stroke-width="2"/><path d="M8 20h32" stroke="#fff" stroke-width="1.5"/>',
    sponge: '<rect x="4" y="13" width="40" height="14" rx="3" fill="#ffd84d" stroke="#13233f" stroke-width="2"/><circle cx="12" cy="19" r="1.6" fill="#c9a21c"/><circle cx="22" cy="23" r="1.6" fill="#c9a21c"/><circle cx="32" cy="18" r="1.6" fill="#c9a21c"/><circle cx="38" cy="23" r="1.4" fill="#c9a21c"/>',
    seesaw: '<path d="M4 18 L44 26" stroke="#13233f" stroke-width="5" stroke-linecap="round"/><path d="M4 18 L44 26" stroke="#d9a066" stroke-width="2.5" stroke-linecap="round"/><path d="M18 36 L26 22 L34 36Z" fill="#8a5a30" stroke="#13233f" stroke-width="2"/>',
    steel: '<circle cx="24" cy="20" r="11" fill="#9aa5b1" stroke="#13233f" stroke-width="2"/><circle cx="20" cy="16" r="3.5" fill="#fff"/>',
    wood: '<circle cx="24" cy="20" r="11" fill="#d9a066" stroke="#13233f" stroke-width="2"/><path d="M16 16q8 4 16 0M15 23q9 4 18 0" fill="none" stroke="#8a5a30" stroke-width="1.5"/>',
    pingpong: '<circle cx="24" cy="20" r="12" fill="#ff8a1e" stroke="#13233f" stroke-width="2"/><circle cx="20" cy="15" r="3" fill="#ffe0bf"/>',
    iron05: '<circle cx="24" cy="21" r="9" fill="#59636e" stroke="#13233f" stroke-width="2"/><circle cx="21" cy="18" r="2.5" fill="#c6ced6"/>',
    iron1: '<circle cx="24" cy="21" r="12" fill="#59636e" stroke="#13233f" stroke-width="2"/><circle cx="20" cy="17" r="3" fill="#c6ced6"/>',
    iron2: '<circle cx="24" cy="21" r="15" fill="#59636e" stroke="#13233f" stroke-width="2"/><circle cx="19" cy="16" r="3.5" fill="#c6ced6"/>',
    car: function (k) { var c = carColor(SHELF[k]); return '<rect x="5" y="12" width="38" height="16" rx="2" fill="#c9d2dc" stroke="#13233f" stroke-width="2"/><rect x="5" y="12" width="38" height="6" fill="' + c + '" stroke="#13233f" stroke-width="2"/>' + (SHELF[k].velcro ? '<rect x="40" y="16" width="6" height="10" fill="#2b3442"/>' : '<path d="M43 20h4" stroke="#13233f" stroke-width="2"/>'); }
  };
  function carColor(info) { return info.velcro ? '#7a5cc4' : info.m >= 1 ? '#13233f' : info.m >= 0.5 ? '#2f6db5' : info.m >= 0.2 ? '#2c9a6a' : info.m >= 0.1 ? '#f5c638' : '#ff6a55'; }
  function iconSvg(k) { var s = SHELF[k].kind === 'car' ? ICON.car(k) : ICON[k]; return '<svg viewBox="0 0 48 40" aria-hidden="true">' + s + '</svg>'; }

  // ---------- 器材 ----------
  function newItem(type, x, y, extra) {
    var T = M.TYPES[type] || {}, it = { uid: type + (++S.uid), type: type, x: x, y: y, ang: 0, len: T.len || 0, props: {} };
    if (extra) for (var k in extra) it[k] = extra[k];
    return it;
  }
  (level.fixed || []).forEach(function (f) {
    S.items.push(newItem(f.type, f.x, f.y, { ang: (f.deg || 0) * D2R, fixed: true, lockMove: !!f.lockMove, lockRot: !!f.lockRot, slideY: !!f.slideY, rotMax: f.rotMax, props: JSON.parse(JSON.stringify(f.props)) }));
  });
  if (TRACK) S.items.push(newItem('tlaunch', TRACK.startX, TRACK.y, { fixed: true, lockMove: true, props: { x: 0 } }));
  function shelfUsed(k) {
    var info = SHELF[k];
    if (info.kind === 'item') return S.items.filter(function (i) { return i.type === k && !i.fixed; }).length;
    if (info.kind === 'car') return S.items.filter(function (i) { return i.type === 'car' && i.props.key === k; }).length;
    return 0;
  }
  function shelfLeft(k) { return (level.shelf[k] || 0) - shelfUsed(k); }

  // 器材的形狀（世界座標）：擺放、點選、檢查重疊用
  function seesawAngle(it) { var lim = M.TYPES.seesaw.limits(it); return lim.max; }
  function polysOf(it) {
    if (it.type === 'seesaw') {
      var T = M.TYPES.seesaw, a = seesawAngle(it), o = V(it.x, it.y);
      var tf = function (pts) { return pts.map(function (p) { return PH.add(o, PH.rot(p, a)); }); };
      return [tf(T.plankPts(it)), tf(T.lipPts(it)), T.fixedPolys(it)[0]];
    }
    if (it.type === 'dropper') return [M.rect(it.x - 0.3, it.y - it.props.h - 0.8, it.x + 0.3, it.y + 0.1)];
    if (it.type === 'car') return [M.rect(it.x, it.y, it.x + CAR_W, it.y + CAR_H)];
    if (it.type === 'tlaunch') return [M.rect(it.x - 1.1, it.y, it.x, it.y + 0.5)];
    return M.itemPolys(it);
  }
  function pointIn(p, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var a = pts[i], b = pts[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }
  function nearPoly(p, pts, tol) {
    if (pointIn(p, pts)) return true;
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length], ab = PH.sub(b, a), t = clamp(PH.dot(PH.sub(p, a), ab) / PH.dot(ab, ab), 0, 1);
      if (dist(p, PH.add(a, PH.mul(ab, t))) < tol) return true;
    }
    return false;
  }
  function staticPolys() {
    var out = level.statics.map(function (s) { return s.pts.map(function (q) { return V(q[0], q[1]); }); });
    (level.cups || []).forEach(function (c) { var cp = M.cupParts(c); out = out.concat(cp.walls, [cp.bottom], [M.rect(c.x - c.w / 2, c.y, c.x + c.w / 2, c.y + c.h)]); });
    return out;
  }
  var STATIC_POLYS = staticPolys();
  function zoneFor(it) { return (level.zones || []).filter(function (z) { return !z.kind || z.kind === it.type; }); }
  function valid(it) {
    if (it.type === 'car') {
      if (it.x < TRACK.startX + 0.9 || it.x + CAR_W > TRACK.gateX - 0.15) return false;
      return !S.items.some(function (o) { return o !== it && o.type === 'car' && o.x < it.x + CAR_W + 0.04 && it.x < o.x + CAR_W + 0.04; });
    }
    if (!(it.fixed && it.lockMove)) {
      var zs = zoneFor(it);
      if (zs.length && !zs.some(function (z) { return it.x >= z.x0 && it.x <= z.x1 && (it.slideY || (it.y >= z.y0 && it.y <= z.y1)); })) return false;
    }
    if (it.type === 'dropper') return true;
    if (it.type === 'cannon' && it.y < 1.9) return false;
    var mine = polysOf(it), others = STATIC_POLYS.slice();
    S.items.forEach(function (o) { if (o !== it && o.type !== 'dropper' && o.type !== 'car') others = others.concat(polysOf(o)); });
    if (mine.some(function (a) { return others.some(function (b) { return M.polyOverlap(a, b, 0.01); }); })) return false;
    if ((it.type === 'launcher' || it.type === 'cannon') && it.props.ball) {
      var rb = M.BALLS[it.props.ball].r, mz = M.TYPES[it.type].muzzle(it, rb);
      if (others.some(function (b) { return nearPoly(mz, b, rb + 0.05); })) return false;
    }
    return true;
  }

  // ---------- 畫面座標 ----------
  function resize() {
    var r = wrap.getBoundingClientRect();
    W = r.width; H = r.height; DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cam.fit = Math.min(W / (level.world.w + 0.3), H / (level.world.h + 1.1));
    // 實驗桌貼著畫面底部；直拿時上方空出來的牆面放工具列和數據
    if (!cam.user) { cam.s = cam.fit; cam.x = level.world.w / 2; cam.y = -0.95 + (H / 2) / cam.s; }
    placeToolbar();
  }
  function w2s(p) { return { x: (p.x - cam.x) * cam.s + W / 2, y: H / 2 - (p.y - cam.y) * cam.s }; }
  function s2w(x, y) { return V((x - W / 2) / cam.s + cam.x, (H / 2 - y) / cam.s + cam.y); }
  function worldTf() { ctx.setTransform(DPR * cam.s, 0, 0, -DPR * cam.s, DPR * (W / 2 - cam.x * cam.s), DPR * (H / 2 + cam.y * cam.s)); }
  function screenTf() { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
  function px(n) { return n / cam.s; }
  var labels = [];
  function label(x, y, text, o) { labels.push({ x: x, y: y, t: text, o: o || {} }); }

  // ---------- 繪圖小工具（世界座標） ----------
  function path(pts) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); }
  function fillStroke(fill, stroke, lw) { if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = px(lw || 2); ctx.lineJoin = 'round'; ctx.stroke(); } }
  function grad(x0, y0, x1, y1, stops) { var g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(function (s) { g.addColorStop(s[0], s[1]); }); return g; }
  function rrect(x0, y0, x1, y1, r) {
    r = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
    ctx.beginPath(); ctx.moveTo(x0 + r, y0); ctx.lineTo(x1 - r, y0); ctx.arcTo(x1, y0, x1, y0 + r, r); ctx.lineTo(x1, y1 - r);
    ctx.arcTo(x1, y1, x1 - r, y1, r); ctx.lineTo(x0 + r, y1); ctx.arcTo(x0, y1, x0, y1 - r, r); ctx.lineTo(x0, y0 + r); ctx.arcTo(x0, y0, x0 + r, y0, r); ctx.closePath();
  }
  function bbox(pts) { var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }; pts.forEach(function (p) { b.x0 = Math.min(b.x0, p.x); b.y0 = Math.min(b.y0, p.y); b.x1 = Math.max(b.x1, p.x); b.y1 = Math.max(b.y1, p.y); }); return b; }
  function shadowOn(blur) { ctx.shadowColor = 'rgba(8, 16, 30, .45)'; ctx.shadowBlur = (blur || 6) * DPR; ctx.shadowOffsetX = 2 * DPR; ctx.shadowOffsetY = 3 * DPR; }
  function shadowOff() { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }

  function drawBackground() {
    screenTf();
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#22354b'); g.addColorStop(1, '#3a5672');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    worldTf();
    var a = s2w(0, H), b = s2w(W, 0), x, y;
    ctx.lineWidth = px(1);
    for (x = Math.floor(a.x); x <= b.x; x++) { ctx.strokeStyle = x % 5 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.10)'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, b.y); ctx.stroke(); }
    for (y = 1; y <= b.y; y++) { ctx.strokeStyle = y % 5 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.10)'; ctx.beginPath(); ctx.moveTo(a.x, y); ctx.lineTo(b.x, y); ctx.stroke(); }
  }
  function drawStatic(s) {
    var pts = s.pts.map(function (q) { return V(q[0], q[1]); }), bb = bbox(pts);
    if (s.look === 'bench') {
      path(pts); ctx.fillStyle = grad(0, 0, 0, bb.y0, [[0, '#c99257'], [0.12, '#b47a43'], [1, '#6e4321']]); ctx.fill();
      ctx.strokeStyle = 'rgba(70,38,14,.28)'; ctx.lineWidth = px(1.2);
      [-0.18, -0.42, -0.7, -0.95].forEach(function (yy, i) { ctx.beginPath(); for (var x = bb.x0; x <= bb.x1; x += 0.5) { var yv = yy + Math.sin(x * 0.9 + i) * 0.03; if (x === bb.x0) ctx.moveTo(x, yv); else ctx.lineTo(x, yv); } ctx.stroke(); });
      ctx.strokeStyle = '#f0c995'; ctx.lineWidth = px(3); ctx.beginPath(); ctx.moveTo(bb.x0, -0.01); ctx.lineTo(bb.x1, -0.01); ctx.stroke();
      // 桌邊的尺：每 1 cm 一小格、每 10 cm 標數字
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      for (var c = 0; c <= level.world.w * 10; c++) {
        var xx = c / 10, l = c % 10 === 0 ? 0.16 : c % 5 === 0 ? 0.1 : 0.05;
        if (cam.s < 40 && c % 5) continue;
        ctx.lineWidth = px(c % 10 === 0 ? 1.4 : 1); ctx.beginPath(); ctx.moveTo(xx, -0.04); ctx.lineTo(xx, -0.04 - l); ctx.stroke();
        if (c % 10 === 0 && (cam.s > 34 || c % 20 === 0)) label(xx, -0.34, String(c), { size: 10, color: '#fff7e8', weight: 700 });
      }
      label(level.world.w - 0.6, -0.72, '單位：cm', { size: 10, color: 'rgba(255,247,232,.85)' });
      return;
    }
    shadowOn(5);
    if (s.look === 'wall' || s.look === 'board') { path(pts); fillStroke(grad(bb.x0, 0, bb.x1, 0, [[0, '#e9eef4'], [1, '#c2ccd7']]), '#13233f', 2); }
    else if (s.look === 'shelf' || s.look === 'block') { path(pts); fillStroke(grad(0, bb.y1, 0, bb.y0, [[0, '#e8b77d'], [1, '#b67b44']]), '#13233f', 2); }
    else if (s.look === 'leg') { path(pts); fillStroke('#8794a3', '#13233f', 1.5); }
    else if (s.look === 'ceiling') { path(pts); fillStroke(grad(0, bb.y0, 0, bb.y1, [[0, '#2d4157'], [1, '#14212f']]), '#0b1528', 2); }
    else if (s.look === 'rail') { path(pts); fillStroke(grad(0, bb.y0, 0, bb.y1, [[0, '#7d8a98'], [1, '#d6dde5']]), '#13233f', 1.5); }
    else { path(pts); fillStroke('#c2ccd7', '#13233f', 2); }
    shadowOff();
    if (s.look === 'wall' || s.look === 'board') {
      ctx.fillStyle = '#7d8a98';
      [[bb.x0 + 0.08, bb.y1 - 0.12], [bb.x1 - 0.08, bb.y1 - 0.12], [bb.x0 + 0.08, bb.y0 + 0.12], [bb.x1 - 0.08, bb.y0 + 0.12]].forEach(function (p) { if (bb.x1 - bb.x0 > 0.2) { ctx.beginPath(); ctx.arc(p[0], p[1], 0.035, 0, 7); ctx.fill(); } });
    }
  }
  function drawCup(c, glow) {
    var cp = M.cupParts(c), x0 = c.x - c.w / 2, x1 = c.x + c.w / 2;
    ctx.fillStyle = glow ? 'rgba(120, 230, 160, .35)' : 'rgba(190, 228, 255, .16)'; ctx.fillRect(x0, c.y, c.w, c.h);
    path(cp.bottom); fillStroke('#ffd84d', '#13233f', 1.2);
    cp.walls.forEach(function (w) { path(w); fillStroke('rgba(225, 242, 255, .75)', '#13233f', 1.4); });
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = px(1.2);
    for (var i = 1; i <= 4; i++) { var yy = c.y + c.h * i / 5; ctx.beginPath(); ctx.moveTo(x0 + 0.02, yy); ctx.lineTo(x0 + (i % 2 ? 0.16 : 0.1), yy); ctx.stroke(); }
    ctx.strokeStyle = '#13233f'; ctx.lineWidth = px(2.4); ctx.beginPath(); ctx.moveTo(x0 - 0.12, c.y + c.h); ctx.lineTo(x1 + 0.12, c.y + c.h); ctx.stroke();
    if (glow) { ctx.save(); ctx.shadowColor = '#5dffa0'; ctx.shadowBlur = 18 * DPR; ctx.strokeStyle = '#5dffa0'; ctx.lineWidth = px(3); ctx.strokeRect(x0, c.y, c.w, c.h); ctx.restore(); }
    label(c.x, c.y + c.h + 0.35, '燒杯 ' + c.label, { size: 13, color: '#fff', weight: 900, stroke: '#13233f' });
  }
  function drawBall(kind, x, y, r, ang, faded) {
    var spec = M.BALLS[kind], g = ctx.createRadialGradient(x - r * 0.35, y + r * 0.4, r * 0.1, x, y, r);
    if (kind === 'steel') { g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, '#d6dde4'); g.addColorStop(0.75, '#7d8995'); g.addColorStop(1, '#4a5560'); }
    else if (kind === 'wood') { g.addColorStop(0, '#fbe3b6'); g.addColorStop(0.5, '#d29a5c'); g.addColorStop(1, '#94602f'); }
    else if (kind === 'pingpong') { g.addColorStop(0, '#fff3e3'); g.addColorStop(0.35, '#ffac5e'); g.addColorStop(1, '#df6510'); }
    else { g.addColorStop(0, '#d3d9df'); g.addColorStop(0.35, '#6c7680'); g.addColorStop(1, '#2b3239'); }
    ctx.globalAlpha = faded ? 0.35 : 1;
    if (!faded) shadowOn(5);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    shadowOff();
    ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1.6); ctx.stroke();
    // 轉動記號：看得出球在滾
    ctx.strokeStyle = kind === 'pingpong' ? 'rgba(160,60,0,.55)' : kind === 'wood' ? 'rgba(110,64,24,.6)' : 'rgba(255,255,255,.45)';
    ctx.lineWidth = px(1.2); ctx.beginPath(); ctx.arc(x, y, r * 0.62, ang, ang + 1.4); ctx.stroke();
    ctx.globalAlpha = 1;
    if (spec && spec.m >= 0.5 && !faded) label(x, y, spec.m >= 1 ? spec.m + ' kg' : '0.5 kg', { size: 10, color: '#fff', weight: 800 });
  }
  function drawBoard(it) {
    var T = M.TYPES[it.type], L = it.len / 2, t = T.thick / 2;
    ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.ang);
    shadowOn(6);
    rrect(-L, -t, L, t, Math.min(t, 0.06));
    if (it.type === 'plank') ctx.fillStyle = grad(0, t, 0, -t, [[0, '#f0c48c'], [1, '#c08548']]);
    else if (it.type === 'bumper') ctx.fillStyle = grad(0, t, 0, -t, [[0, '#ff7a6e'], [1, '#b8262c']]);
    else ctx.fillStyle = grad(0, t, 0, -t, [[0, '#ffe680'], [1, '#e2b51e']]);
    ctx.fill(); shadowOff();
    ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1.8); ctx.stroke();
    if (it.type === 'plank') { ctx.strokeStyle = 'rgba(110,64,24,.45)'; ctx.lineWidth = px(1); [-0.3, 0.25].forEach(function (k) { ctx.beginPath(); ctx.moveTo(-L + 0.1, k * t); ctx.bezierCurveTo(-L / 3, k * t + 0.02, L / 3, k * t - 0.02, L - 0.1, k * t); ctx.stroke(); }); }
    if (it.type === 'bumper') { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = px(1.5); ctx.beginPath(); ctx.moveTo(-L + 0.1, 0); ctx.lineTo(L - 0.1, 0); ctx.stroke(); }
    if (it.type === 'sponge') { ctx.fillStyle = 'rgba(160,120,10,.55)'; for (var i = 0; i < it.len * 6; i++) { var xx = -L + 0.08 + ((i * 0.37) % (it.len - 0.16)), yy = ((i * 0.53) % 1 - 0.5) * t * 1.3; ctx.beginPath(); ctx.arc(xx, yy, 0.022, 0, 7); ctx.fill(); } }
    ctx.restore();
    if (it._bad) { polysOf(it).forEach(function (p) { path(p); fillStroke('rgba(255,60,60,.35)', '#ff3b3b', 2); }); }
  }
  function drawLauncher(it, loaded) {
    var T = M.TYPES.launcher, base = T.fixedPolys(it)[0], c = (it.props.x || 0) / 10;
    shadowOn(5); path(base); fillStroke(grad(0, it.y, 0, 0, [[0, '#5f6c7a'], [1, '#2e3843']]), '#0b1528', 1.6); shadowOff();
    ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.ang);
    // 推桿與握把（往後拉 = 壓縮彈簧）
    ctx.strokeStyle = '#c9d2dc'; ctx.lineWidth = px(5); ctx.beginPath(); ctx.moveTo(-0.25 - c, 0); ctx.lineTo(0.35, 0); ctx.stroke();
    shadowOn(6); rrect(0, -T.half, T.barrel, T.half, 0.08); ctx.fillStyle = grad(0, T.half, 0, -T.half, [[0, '#eef2f6'], [0.45, '#a9b4bf'], [1, '#5c6875']]); ctx.fill(); shadowOff();
    ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1.8); ctx.stroke();
    // 彈簧窗口
    var w0 = 0.3, w1 = T.barrel - 0.45; rrect(w0, -0.1, w1, 0.1, 0.05); ctx.fillStyle = '#1d2a38'; ctx.fill();
    var sx = w0 + 0.05 - c * 0.3, n = 9, sL = (w1 - 0.1) - sx; ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = px(1.6); ctx.beginPath();
    for (var i = 0; i <= n * 2; i++) { var xx = sx + sL * i / (n * 2), yy = i % 2 ? 0.07 : -0.07; if (i === 0) ctx.moveTo(xx, 0); else ctx.lineTo(xx, yy); } ctx.stroke();
    ctx.fillStyle = '#ff5a3c'; ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1.6); ctx.beginPath(); ctx.arc(-0.25 - c, 0, 0.17, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-0.29 - c, 0.05, 0.04, 0, 7); ctx.fill();
    ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(3); ctx.beginPath(); ctx.moveTo(T.barrel, -T.half - 0.03); ctx.lineTo(T.barrel, T.half + 0.03); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#ffd84d'; ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1.4); ctx.beginPath(); ctx.arc(it.x, it.y, 0.08, 0, 7); ctx.fill(); ctx.stroke();
    if (loaded && it.props.ball) { var r = M.BALLS[it.props.ball].r, p = M.xf(it, V(T.barrel - r * 0.4, 0)); drawBall(it.props.ball, p.x, p.y, r, 0); }
    label(it.x + 0.42, 0.3, 'k = ' + it.props.k + ' N/m', { size: 10, color: '#fff7e8', weight: 800, stroke: '#13233f', align: 'left' });
    if (c > 0) { var kp = w2sCompat(M.xf(it, V(-0.25 - c, 0.32))); labels.push({ sx: kp.x, sy: kp.y, t: '壓縮 ' + f1(it.props.x) + ' cm', o: { size: 12, color: '#fff', weight: 900, stroke: '#13233f' } }); }
  }
  function w2sCompat(p) { return w2s(p); }
  function drawCannon(it, loaded) {
    var T = M.TYPES.cannon, base = T.fixedPolys(it)[0];
    shadowOn(5); path(base); fillStroke(grad(0, it.y, 0, 0, [[0, '#5f6c7a'], [1, '#2e3843']]), '#0b1528', 1.6); shadowOff();
    ctx.strokeStyle = '#2e3843'; ctx.lineWidth = px(6); ctx.beginPath(); ctx.moveTo(it.x - 0.7, it.y - 0.5); ctx.lineTo(it.x - 0.5, it.y - 0.1); ctx.stroke();
    ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.ang);
    shadowOn(6); rrect(-T.barrel, -T.half, -0.02, T.half, 0.08); ctx.fillStyle = grad(0, T.half, 0, -T.half, [[0, '#9fb59b'], [0.5, '#5d7a5a'], [1, '#2f4430']]); ctx.fill(); shadowOff();
    ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1.8); ctx.stroke();
    ctx.fillStyle = '#d8b25a'; [-1.5, -0.9, -0.3].forEach(function (x) { ctx.fillRect(x, -T.half, 0.08, T.half * 2); });
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1.5); ctx.beginPath(); ctx.arc(it.x - 0.7, 0.35, 0.22, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#c4162a'; ctx.lineWidth = px(2); ctx.beginPath(); ctx.moveTo(it.x - 0.7, 0.35); ctx.lineTo(it.x - 0.58, 0.47); ctx.stroke();
    ctx.fillStyle = '#ffd84d'; ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1.4); ctx.beginPath(); ctx.arc(it.x, it.y, 0.07, 0, 7); ctx.fill(); ctx.stroke();
    if (loaded && it.props.ball) { var r = M.BALLS[it.props.ball].r, p = M.xf(it, V(-r - 0.05, 0)); drawBall(it.props.ball, p.x, p.y, r, 0); }
    label(it.x - 0.7, -0.8, '出口速度 ' + it.props.v.toFixed(2) + ' m/s', { size: 11, color: '#fff7e8', weight: 800 });
  }
  function drawSeesaw(it, q) {
    var T = M.TYPES.seesaw, ang = q ? q.angle : seesawAngle(it), o = V(it.x, it.y);
    shadowOn(5); path(T.fixedPolys(it)[0]); fillStroke(grad(0, it.y, 0, 0, [[0, '#a8743f'], [1, '#6e4321']]), '#0b1528', 1.6); shadowOff();
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(ang);
    var a = it.props.arm;
    shadowOn(6); rrect(-a, 0, T.len - a, T.thick, 0.04); ctx.fillStyle = grad(0, T.thick, 0, 0, [[0, '#f0c48c'], [1, '#c08548']]); ctx.fill(); shadowOff();
    ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1.8); ctx.stroke();
    path(T.lipPts(it)); fillStroke('#c08548', '#0b1528', 1.4);
    ctx.restore();
    ctx.fillStyle = '#ffd84d'; ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1.6); ctx.beginPath(); ctx.arc(o.x, o.y, 0.13, 0, 7); ctx.fill(); ctx.stroke();
    if (!q && it.props.ball) { var r = M.BALLS[it.props.ball].r, p = PH.add(o, PH.rot(V(-a + 0.1 + r + 0.02, T.thick + r + 0.01), ang)); drawBall(it.props.ball, p.x, p.y, r, 0); }
    if (S.mode === 'build') label(o.x, -0.62, '左 ' + f1(a * 10) + ' cm｜右 ' + f1((T.len - a) * 10) + ' cm', { size: 10, color: '#fff7e8', weight: 700 });
  }
  function drawDropper(it, holding) {
    var hy = it.y - it.props.h;
    ctx.strokeStyle = '#c9d2dc'; ctx.lineWidth = px(3); ctx.beginPath(); ctx.moveTo(it.x, it.y - 0.1); ctx.lineTo(it.x, hy); ctx.stroke();
    shadowOn(4); rrect(it.x - 0.3, it.y - 0.22, it.x + 0.3, it.y + 0.08, 0.05); fillStroke(grad(0, it.y, 0, it.y - 0.22, [[0, '#9aa6b2'], [1, '#56626e']]), '#0b1528', 1.5); shadowOff();
    ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(2.2); ctx.beginPath(); ctx.moveTo(it.x - 0.16, hy - 0.12); ctx.quadraticCurveTo(it.x, hy + 0.05, it.x + 0.16, hy - 0.12); ctx.stroke();
    ctx.fillStyle = '#ffd84d'; ctx.beginPath(); ctx.arc(it.x, hy, 0.09, 0, 7); ctx.fill(); ctx.stroke();
    if (holding && it.props.ball) { var r = M.BALLS[it.props.ball].r; drawBall(it.props.ball, it.x, hy - r - 0.02, r, 0); }
    if (S.mode === 'build') labels.push(Object.assign(w2s(V(it.x + 0.5, hy)), { t: '離桌面 ' + f1((hy - (holding && it.props.ball ? 2 * M.BALLS[it.props.ball].r : 0)) * 10) + ' cm', o: { size: 11, color: '#fff', weight: 800, stroke: '#13233f', align: 'left' } }));
  }
  function drawTrack(run) {
    var t = TRACK, y = t.y;
    shadowOn(5); rrect(t.startX - 1.3, y - 0.35, t.endX + 0.15, y, 0.04); fillStroke(grad(0, y, 0, y - 0.35, [[0, '#eef2f6'], [1, '#8f9ba7']]), '#0b1528', 1.6); shadowOff();
    ctx.fillStyle = 'rgba(19,35,63,.35)'; for (var x = t.startX - 1.1; x < t.endX; x += 0.25) { ctx.beginPath(); ctx.arc(x, y - 0.06, 0.018, 0, 7); ctx.fill(); }
    [[t.startX - 1.3, 0], [t.endX - 0.2, 0]].forEach(function (p) { rrect(p[0] + 0.1, 0, p[0] + 0.3, y - 0.35, 0.02); fillStroke('#56626e', '#0b1528', 1.2); });
    rrect(t.endX, y, t.endX + 0.15, y + 0.6, 0.03); fillStroke('#e5484d', '#0b1528', 1.4);
    var g = t.gateX; ctx.lineWidth = px(1.5);
    rrect(g - 0.08, y - 0.1, g + 0.08, y + 1.05, 0.03); fillStroke('rgba(0,0,0,0)', '#0b1528', 0);
    ctx.fillStyle = '#2b3442'; ctx.fillRect(g - 0.1, y + 0.75, 0.2, 0.3); ctx.strokeStyle = '#0b1528'; ctx.strokeRect(g - 0.1, y + 0.75, 0.2, 0.3);
    ctx.fillRect(g - 0.1, y - 0.12, 0.2, 0.12);
    var lit = run && run.gateFlash > 0;
    ctx.strokeStyle = lit ? 'rgba(255,60,60,.95)' : 'rgba(255,60,60,.45)'; ctx.lineWidth = px(lit ? 3 : 1.5); ctx.setLineDash([px(4), px(3)]); ctx.beginPath(); ctx.moveTo(g, y); ctx.lineTo(g, y + 0.75); ctx.stroke(); ctx.setLineDash([]);
    label(g, y + 1.35, '光電閘', { size: 12, color: '#fff', weight: 900, stroke: '#13233f' });
  }
  function drawTrackLauncher(it) {
    var c = (it.props.x || 0) / 10, y = it.y;
    shadowOn(4); rrect(it.x - 1.1, y, it.x - 0.3, y + 0.5, 0.06); fillStroke(grad(0, y + 0.5, 0, y, [[0, '#a9b4bf'], [1, '#5c6875']]), '#0b1528', 1.6); shadowOff();
    var sx = it.x - 0.3, ex = it.x + 0.3 - c * 0.6; ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = px(1.6); ctx.beginPath();
    for (var i = 0; i <= 12; i++) { var xx = sx + (ex - sx) * i / 12, yy = y + 0.25 + (i % 2 ? 0.1 : -0.1); if (!i) ctx.moveTo(xx, y + 0.25); else ctx.lineTo(xx, yy); } ctx.stroke();
    ctx.fillStyle = '#c9d2dc'; ctx.fillRect(ex, y + 0.08, 0.06, 0.34);
    ctx.strokeStyle = '#c9d2dc'; ctx.lineWidth = px(5); ctx.beginPath(); ctx.moveTo(it.x - 1.1, y + 0.25); ctx.lineTo(it.x - 1.25 - c, y + 0.25); ctx.stroke();
    ctx.fillStyle = '#ff5a3c'; ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1.6); ctx.beginPath(); ctx.arc(it.x - 1.3 - c, y + 0.25, 0.17, 0, 7); ctx.fill(); ctx.stroke();
    label(it.x - 0.7, y + 0.95, 'k = ' + TRACK.k + ' N/m', { size: 10, color: '#fff7e8', weight: 700 });
    if (c > 0) label(it.x - 1.3 - c, y + 0.62, '壓縮 ' + f1(it.props.x) + ' cm', { size: 12, color: '#fff', weight: 900, stroke: '#13233f' });
  }
  function drawCar(x, y, info, bad) {
    shadowOn(5); rrect(x, y, x + CAR_W, y + CAR_H, 0.04); ctx.fillStyle = grad(0, y + CAR_H, 0, y, [[0, '#eef2f6'], [1, '#9aa6b2']]); ctx.fill(); shadowOff();
    ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1.6); ctx.stroke();
    ctx.fillStyle = carColor(info); ctx.fillRect(x + 0.02, y + CAR_H - 0.14, CAR_W - 0.04, 0.12);
    if (info.velcro) { ctx.fillStyle = '#2b3442'; ctx.fillRect(x - 0.06, y + 0.06, 0.08, 0.3); ctx.fillRect(x + CAR_W - 0.02, y + 0.06, 0.08, 0.3); }
    else { ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1.2); [x - 0.08, x + CAR_W + 0.08].forEach(function (bx, k) { ctx.beginPath(); ctx.moveTo(k ? x + CAR_W : x, y + 0.21); for (var i = 1; i <= 4; i++) ctx.lineTo(k ? x + CAR_W + 0.02 * i : x - 0.02 * i, y + 0.21 + (i % 2 ? 0.06 : -0.06)); ctx.stroke(); }); }
    if (bad) { rrect(x, y, x + CAR_W, y + CAR_H, 0.04); fillStroke('rgba(255,60,60,.35)', '#ff3b3b', 2); }
    label(x + CAR_W / 2, y + 0.2, info.m >= 1 ? '1 kg' : Math.round(info.m * 1000) + ' g', { size: 11, color: '#0b1528', weight: 900 });
  }

  // ---------- 選取框（nobook 式：旋轉鈕在上方、兩端可拉長） ----------
  function localBox(it) {
    if (it.type === 'launcher') return { x0: -0.45, y0: -0.3, x1: M.TYPES.launcher.barrel + 0.05, y1: 0.3 };
    if (it.type === 'cannon') return { x0: -M.TYPES.cannon.barrel - 0.05, y0: -0.3, x1: 0.05, y1: 0.3 };
    var T = M.TYPES[it.type];
    if (T && T.resize) return { x0: -it.len / 2 - 0.06, y0: -T.thick / 2 - 0.08, x1: it.len / 2 + 0.06, y1: T.thick / 2 + 0.08 };
    return null;
  }
  function isAimer(it) { return it.type === 'launcher' || it.type === 'cannon'; }
  function muzzleLocal(it) { return it.type === 'launcher' ? M.TYPES.launcher.barrel : 0; }
  function rotHandle(it) {
    var b = localBox(it); if (!b || !canRotate(it)) return null;
    if (isAimer(it)) return M.xf(it, V(muzzleLocal(it) + Math.max(0.75, px(46)), 0));   // 瞄準鈕：砲口正前方
    return M.xf(it, V((b.x0 + b.x1) / 2, b.y1 + Math.max(0.5, px(34))));
  }
  function canRotate(it) { var T = M.TYPES[it.type]; return T && T.rot && !it.lockRot; }
  function resizeHandles(it) { var T = M.TYPES[it.type]; if (!T || !T.resize || it.fixed) return []; return [{ end: -1, p: M.xf(it, V(-it.len / 2, 0)) }, { end: 1, p: M.xf(it, V(it.len / 2, 0)) }]; }
  function drawSelection() {
    var it = S.sel; if (!it || S.mode !== 'build') return;
    var b = localBox(it);
    ctx.save();
    if (b) {
      ctx.translate(it.x, it.y); ctx.rotate(it.ang);
      ctx.setLineDash([px(6), px(4)]); ctx.strokeStyle = '#fff'; ctx.lineWidth = px(2); ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); ctx.setLineDash([]);
      ctx.restore(); ctx.save();
    } else {
      var bb = bbox([].concat.apply([], polysOf(it)));
      ctx.setLineDash([px(6), px(4)]); ctx.strokeStyle = '#fff'; ctx.lineWidth = px(2); ctx.strokeRect(bb.x0 - 0.08, bb.y0 - 0.08, bb.x1 - bb.x0 + 0.16, bb.y1 - bb.y0 + 0.16); ctx.setLineDash([]);
    }
    ctx.restore();
    var rh = rotHandle(it);
    if (rh) {
      var top = isAimer(it) ? M.xf(it, V(muzzleLocal(it), 0)) : M.xf(it, V((b.x0 + b.x1) / 2, b.y1));
      if (isAimer(it)) ctx.setLineDash([px(5), px(4)]);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = px(2); ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(rh.x, rh.y); ctx.stroke(); ctx.setLineDash([]);
      var R = Math.max(0.17, px(15));
      ctx.fillStyle = '#ff6a55'; ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(2); ctx.beginPath(); ctx.arc(rh.x, rh.y, R, 0, 7); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = px(2); ctx.beginPath(); ctx.arc(rh.x, rh.y, R * 0.55, 0.5, 5.2); ctx.stroke();
    }
    resizeHandles(it).forEach(function (h) { var R = Math.max(0.13, px(11)); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(2); ctx.fillRect(h.p.x - R, h.p.y - R, R * 2, R * 2); ctx.strokeRect(h.p.x - R, h.p.y - R, R * 2, R * 2); });
    if ((it.type === 'launcher' || it.type === 'cannon') && drag && drag.kind === 'rotate') {   // 量角器
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = px(1.5); var rr = 1.2;
      ctx.beginPath(); ctx.arc(it.x, it.y, rr, 0, Math.PI / 2); ctx.stroke();
      for (var d = 0; d <= 90; d += 10) { var a = d * D2R; ctx.beginPath(); ctx.moveTo(it.x + Math.cos(a) * rr, it.y + Math.sin(a) * rr); ctx.lineTo(it.x + Math.cos(a) * (rr - 0.12), it.y + Math.sin(a) * (rr - 0.12)); ctx.stroke(); }
      ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = px(2.5); ctx.beginPath(); ctx.arc(it.x, it.y, rr - 0.06, 0, it.ang, false); ctx.stroke();
    }
  }

  // ---------- 畫一格 ----------
  function draw() {
    labels = [];
    drawBackground();
    worldTf();
    if (S.mode === 'build' && (S.sel || (drag && drag.kind === 'shelf'))) {   // 可以擺的區域
      (level.zones || []).forEach(function (z) {
        ctx.fillStyle = 'rgba(255, 216, 77, .08)'; ctx.fillRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0);
        ctx.setLineDash([px(8), px(6)]); ctx.strokeStyle = 'rgba(255, 216, 77, .7)'; ctx.lineWidth = px(1.5); ctx.strokeRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0); ctx.setLineDash([]);
      });
    }
    level.statics.forEach(drawStatic);
    if (TRACK) drawTrack(S.run);
    var run = S.run;
    // 之前幾發的軌跡（淡），這一發（亮）
    S.traces.forEach(function (tr, i) {
      var alpha = 0.25 + 0.5 * (i + 1) / S.traces.length;
      ctx.fillStyle = tr.hit ? 'rgba(93,255,160,' + alpha + ')' : 'rgba(255,255,255,' + alpha + ')';
      tr.pts.forEach(function (p, k) { if (k % 2 === 0) { ctx.beginPath(); ctx.arc(p.x, p.y, px(2.2), 0, 7); ctx.fill(); } });
    });
    (level.cups || []).forEach(function (c) { drawCup(c, S.passed); });
    S.items.forEach(function (it) {
      if (it.type === 'plank' || it.type === 'bumper' || it.type === 'sponge') drawBoard(it);
      else if (it.type === 'launcher') drawLauncher(it, !run);
      else if (it.type === 'cannon') drawCannon(it, !run);
      else if (it.type === 'seesaw') drawSeesaw(it, run && run.env ? run.env.refs[it.uid] : null);
      else if (it.type === 'dropper') drawDropper(it, !run);
      else if (it.type === 'tlaunch') drawTrackLauncher(it);
      else if (it.type === 'car' && !(run && run.track)) drawCar(it.x, it.y, SHELF[it.props.key], it._bad);
      if (it._bad && it.type !== 'car') polysOf(it).forEach(function (p) { path(p); fillStroke('rgba(255,60,60,.3)', '#ff3b3b', 2); });
    });
    if (run && run.track) run.track.cars.forEach(function (c) { drawCar(c.x, TRACK.y, c.info, false); });
    if (run && run.env) {
      run.env.world.balls.forEach(function (b) {
        if (!b.alive) return;
        if (b === run.ball) { ctx.fillStyle = 'rgba(255,255,255,.9)'; b.trail.forEach(function (p, k) { if (k % 2 === 0) { ctx.beginPath(); ctx.arc(p.x, p.y, px(2.2), 0, 7); ctx.fill(); } }); }
        drawBall(b.kind, b.p.x, b.p.y, b.r, b.ang);
        if (b === run.ball) { ctx.strokeStyle = 'rgba(255,216,77,.9)'; ctx.lineWidth = px(2); ctx.beginPath(); ctx.arc(b.p.x, b.p.y, b.r + px(5), 0, 7); ctx.stroke(); }
      });
    }
    if (!run && S.last && S.last.ball) drawBall(S.last.kind, S.last.ball.x, S.last.ball.y, M.BALLS[S.last.kind].r, 0, true);
    drawSelection();
    drawFx();
    // 文字（螢幕座標，才不會跟著翻轉）
    screenTf();
    labels.forEach(function (l) {
      var p = l.sx != null ? { x: l.sx, y: l.sy } : w2s(V(l.x, l.y)), o = l.o;
      ctx.font = (o.weight || 600) + ' ' + (o.size || 12) + 'px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
      ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
      var tw = ctx.measureText(l.t).width, lx = ctx.textAlign === 'left' ? p.x : p.x - tw / 2;   // 文字不要超出畫面
      if (lx < 4) p = { x: p.x + 4 - lx, y: p.y }; else if (lx + tw > W - 4) p = { x: p.x - (lx + tw - W + 4), y: p.y };
      if (o.stroke) { ctx.lineWidth = 3.5; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(l.t, p.x, p.y); }
      ctx.fillStyle = o.color || '#fff'; ctx.fillText(l.t, p.x, p.y);
    });
  }

  // ---------- 特效：撞擊塵土、過關彩帶 ----------
  function puff(p, n, color) { for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 1.6; S.fx.push({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 0.5, t: 0, life: 0.45, r: 0.03 + Math.random() * 0.04, c: color || 'rgba(255,255,255,.8)' }); } }
  function confetti(c) { var cols = ['#ff6a55', '#f5c638', '#5dffa0', '#7fc4ff', '#ffffff']; for (var i = 0; i < 46; i++) S.fx.push({ x: c.x + (Math.random() - 0.5) * 0.6, y: c.y + c.h, vx: (Math.random() - 0.5) * 5, vy: 3 + Math.random() * 5, t: 0, life: 1.4, r: 0.05, c: cols[i % cols.length], rect: true, rot: Math.random() * 6 }); }
  function stepFx(dt) { S.fx.forEach(function (f) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy -= (f.rect ? 9 : 3) * dt; f.rot = (f.rot || 0) + dt * 8; }); S.fx = S.fx.filter(function (f) { return f.t < f.life; }); }
  function drawFx() {
    S.fx.forEach(function (f) {
      ctx.globalAlpha = Math.max(0, 1 - f.t / f.life); ctx.fillStyle = f.c;
      if (f.rect) { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.fillRect(-0.06, -0.03, 0.12, 0.06); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 + f.t * 3), 0, 7); ctx.fill(); }
    });
    ctx.globalAlpha = 1;
  }

  // ---------- 點選、拖曳（nobook 式操作） ----------
  var ptrs = new Map(), drag = null, lastTick = 0;
  function select(it) { S.sel = it; buildToolbar(); }
  function handleAt(p) {
    var it = S.sel; if (!it || S.mode !== 'build') return null;
    var rh = rotHandle(it), tol = Math.max(0.3, px(24));
    if (rh && dist(p, rh) < tol) return { kind: 'rotate' };
    var hs = resizeHandles(it);
    for (var i = 0; i < hs.length; i++) if (dist(p, hs[i].p) < Math.max(0.22, px(20))) return { kind: 'resize', end: hs[i].end };
    return null;
  }
  function partAt(it, p) {
    var tol = Math.max(0.28, px(24));
    if (it.type === 'launcher') { var lp = M.toLocal(it, p), c0 = (it.props.x || 0) / 10; if (dist(p, M.xf(it, V(-0.25 - c0, 0))) < tol || (lp.x > -0.45 - c0 && lp.x < 0.55 && Math.abs(lp.y) < 0.42)) return 'plunger'; }
    if (it.type === 'tlaunch') { var c1 = (it.props.x || 0) / 10; if (dist(p, V(it.x - 1.3 - c1, it.y + 0.25)) < tol || (p.x > it.x - 1.55 - c1 && p.x < it.x && p.y > it.y - 0.3 && p.y < it.y + 0.9)) return 'plunger'; }
    if (it.type === 'seesaw' && dist(p, V(it.x, it.y)) < tol) return 'pivot';
    if (it.type === 'dropper' && dist(p, V(it.x, it.y - it.props.h)) < tol) return 'hook';
    return null;
  }
  function hitItem(p) {
    var i, it, part;
    for (i = S.items.length - 1; i >= 0; i--) { it = S.items[i]; part = partAt(it, p); if (part) return { it: it, part: part }; }
    for (i = S.items.length - 1; i >= 0; i--) {
      it = S.items[i];
      if (polysOf(it).some(function (pp) { return nearPoly(p, pp, Math.max(0.08, px(10))); })) return { it: it, part: 'body' };
    }
    return null;
  }
  function evPos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  cv.addEventListener('pointerdown', function (e) {
    var sp = evPos(e); ptrs.set(e.pointerId, sp);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件 */ }
    if (ptrs.size === 2) { var a = Array.from(ptrs.values()); drag = { kind: 'pinch', d0: dist(a[0], a[1]), s0: cam.s, c: { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 }, w: s2w((a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2) }; return; }
    var p = s2w(sp.x, sp.y);
    if (S.mode !== 'build') { drag = { kind: 'pan', sx: sp.x, sy: sp.y, cx: cam.x, cy: cam.y, tap: true, skip: true }; return; }
    var h = handleAt(p), it = S.sel;
    if (h && h.kind === 'rotate') { var c0 = rotCenter(it); drag = { kind: 'rotate', it: it, off: Math.atan2(p.y - c0.y, p.x - c0.x) - it.ang, a0: it.ang }; return; }
    if (h && h.kind === 'resize') { drag = { kind: 'resize', it: it, end: h.end, fixedEnd: M.xf(it, V(-h.end * it.len / 2, 0)), save: { x: it.x, y: it.y, len: it.len } }; return; }
    var hit = hitItem(p);
    if (hit) {
      it = hit.it; select(it);
      if (hit.part === 'plunger') drag = { kind: 'plunger', it: it, moved: false, x0: it.props.x || 0, p0: p };
      else if (hit.part === 'pivot') drag = { kind: 'pivot', it: it, px0: p.x, arm0: it.props.arm, x0: it.x };
      else if (hit.part === 'hook') drag = { kind: 'hook', it: it };
      else if (!it.lockMove) drag = { kind: 'move', it: it, dx: it.x - p.x, dy: it.y - p.y, ox: it.x, oy: it.y, moved: false };
      else drag = { kind: 'none' };
      return;
    }
    select(null);
    drag = { kind: 'pan', sx: sp.x, sy: sp.y, cx: cam.x, cy: cam.y, tap: true };
  });
  function rotCenter(it) { return V(it.x, it.y); }
  cv.addEventListener('pointermove', function (e) {
    if (!ptrs.has(e.pointerId)) return;
    var sp = evPos(e); ptrs.set(e.pointerId, sp);
    if (!drag) return;
    var p = s2w(sp.x, sp.y), it = drag.it;
    if (drag.kind === 'pinch' && ptrs.size === 2) {
      var a = Array.from(ptrs.values()), d = dist(a[0], a[1]);
      cam.s = clamp(drag.s0 * d / drag.d0, cam.fit * 0.7, cam.fit * 4); cam.user = true;
      var c = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
      cam.x = drag.w.x - (c.x - W / 2) / cam.s; cam.y = drag.w.y - (H / 2 - c.y) / cam.s;
      placeToolbar(); return;
    }
    if (drag.kind === 'pan') {
      if (Math.abs(sp.x - drag.sx) + Math.abs(sp.y - drag.sy) > 6) drag.tap = false;
      if (cam.s > cam.fit * 1.02 || S.mode !== 'build') { cam.x = drag.cx - (sp.x - drag.sx) / cam.s; cam.y = drag.cy + (sp.y - drag.sy) / cam.s; cam.user = true; placeToolbar(); }
      return;
    }
    if (drag.kind === 'move') {
      var nx = p.x + drag.dx, ny = p.y + drag.dy;
      if (it.slideY || it.type === 'seesaw' || it.type === 'car') ny = it.y;
      if (Math.abs(nx - drag.ox) + Math.abs(ny - drag.oy) > 0.05) drag.moved = true;
      it.x = Math.round(nx * 20) / 20; it.y = Math.round(ny * 20) / 20;
      it._bad = !valid(it); placeToolbar(); return;
    }
    if (drag.kind === 'rotate') {
      var c0 = rotCenter(it), step = it.type === 'cannon' ? 0.5 : 1;
      var deg = Math.round(((Math.atan2(p.y - c0.y, p.x - c0.x) - drag.off) / D2R) / step) * step;
      var T = M.TYPES[it.type], lo = T.rotMin != null ? T.rotMin : -180, hi = it.rotMax != null ? it.rotMax : (T.rotMax != null ? T.rotMax : 180);
      if (lo === -180) { deg = ((deg + 180) % 360 + 360) % 360 - 180; }
      deg = clamp(deg, lo, hi);
      if (deg * D2R !== it.ang) { it.ang = deg * D2R; tick(); }
      it._bad = !valid(it); buildToolbar(); return;
    }
    if (drag.kind === 'resize') {
      var T2 = M.TYPES[it.type], fe = drag.fixedEnd, axis = V(Math.cos(it.ang), Math.sin(it.ang));
      var L = clamp(Math.abs(PH.dot(PH.sub(p, fe), axis)), T2.minLen, T2.maxLen); L = Math.round(L * 10) / 10;
      if (L !== it.len) { it.len = L; tick(); }
      var mid = PH.add(fe, PH.mul(axis, drag.end * L / 2)); it.x = mid.x; it.y = mid.y;
      it._bad = !valid(it); buildToolbar(); return;
    }
    if (drag.kind === 'plunger') {
      if (!drag.moved && dist(p, drag.p0) < Math.max(0.1, px(8))) return;
      var maxX = it.type === 'tlaunch' ? TRACK.maxX : M.TYPES.launcher.maxX, comp;
      if (it.type === 'tlaunch') comp = drag.x0 + (drag.p0.x - p.x) * 10; else comp = drag.x0 + (M.toLocal(it, drag.p0).x - M.toLocal(it, p).x) * 10;
      comp = Math.round(clamp(comp, 0, maxX) * 10) / 10;
      if (comp !== it.props.x) { it.props.x = comp; drag.moved = true; tick(); buildToolbar(); }
      return;
    }
    if (drag.kind === 'pivot') {
      var T3 = M.TYPES.seesaw, arm = clamp(drag.arm0 + (p.x - drag.px0), T3.minArm, T3.maxArm);
      arm = Math.round(arm * 20) / 20;
      if (arm !== it.props.arm) { it.props.arm = arm; it.x = drag.x0 + (arm - drag.arm0); tick(); it._bad = !valid(it); buildToolbar(); }
      return;
    }
    if (drag.kind === 'hook') {
      var h = Math.round(clamp(it.y - p.y, 0.3, it.y - 1.2) * 20) / 20;
      if (h !== it.props.h) { it.props.h = h; tick(); buildToolbar(); }
    }
  });
  function endPtr(e) {
    ptrs.delete(e.pointerId);
    if (!drag) return;
    var d = drag, it = d.it; drag = null;
    if (d.kind === 'move') {
      if (it._bad) { var low = it.type === 'cannon' && it.y < 1.9; it.x = d.ox; it.y = d.oy; it._bad = false; toast(low ? '空氣砲的砲口要離桌面 19 cm 以上，砲管才轉得動' : '這裡不能放：會跟別的東西重疊，或砲口被擋住'); sfx('warn'); }
      else if (d.moved) sfx('item_place');
      if (it.type === 'car') sortCars();
    } else if (d.kind === 'rotate' || d.kind === 'resize' || d.kind === 'pivot') {
      if (it._bad) { if (d.kind === 'rotate') it.ang = d.a0; if (d.kind === 'resize') { it.x = d.save.x; it.y = d.save.y; it.len = d.save.len; } if (d.kind === 'pivot') { it.props.arm = d.arm0; it.x = d.x0; } it._bad = false; toast('會跟別的東西重疊，已經改回來'); sfx('warn'); }
    } else if (d.kind === 'plunger') {
      if (d.moved && it.props.x >= 0.3) fire(it);
    } else if (d.kind === 'pan' && d.skip && d.tap && S.mode === 'run' && S.run && !S.passed) {
      if (S.run.tr && !S.run.tr.hit) S.run.tr.done = true; else if (S.run.track) S.run.t = 99;   // 點一下：結束這一發
    }
    buildToolbar();
  }
  cv.addEventListener('pointerup', endPtr);
  cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('wheel', function (e) {
    e.preventDefault();
    var sp = evPos(e), w0 = s2w(sp.x, sp.y);
    cam.s = clamp(cam.s * (e.deltaY < 0 ? 1.12 : 1 / 1.12), cam.fit * 0.7, cam.fit * 4); cam.user = true;
    cam.x = w0.x - (sp.x - W / 2) / cam.s; cam.y = w0.y - (H / 2 - sp.y) / cam.s; placeToolbar();
  }, { passive: false });
  function tick() { var n = Date.now(); if (n - lastTick > 60) { lastTick = n; sfx('slider_tick'); } }
  $('#zoomIn').addEventListener('click', function () { cam.s = clamp(cam.s * 1.25, cam.fit * 0.7, cam.fit * 4); cam.user = true; placeToolbar(); });
  $('#zoomOut').addEventListener('click', function () { cam.s = clamp(cam.s / 1.25, cam.fit * 0.7, cam.fit * 4); cam.user = true; placeToolbar(); });
  $('#zoomFit').addEventListener('click', function () { cam.user = false; resize(); });

  // 鍵盤：方向鍵移動、Q／E 旋轉、Delete 刪除、空白鍵發射（不方便用滑鼠或手指時）
  window.addEventListener('keydown', function (e) {
    var it = S.sel; if (!it || S.mode !== 'build' || ['INPUT', 'BUTTON', 'A', 'TEXTAREA'].indexOf(document.activeElement && document.activeElement.tagName) >= 0) return;
    var k = e.key, moved = false;
    if (!it.lockMove && /Arrow/.test(k)) {
      var ox = it.x, oy = it.y;
      if (k === 'ArrowLeft') it.x -= 0.1; if (k === 'ArrowRight') it.x += 0.1;
      if (!it.slideY && it.type !== 'seesaw' && it.type !== 'car') { if (k === 'ArrowUp') it.y += 0.1; if (k === 'ArrowDown') it.y -= 0.1; }
      if (!valid(it)) { it.x = ox; it.y = oy; } moved = true;
    }
    if (canRotate(it) && (k === 'q' || k === 'e')) { rotateBy(it, k === 'q' ? 1 : -1); moved = true; }
    if (k === 'Delete' && !it.fixed) { removeItem(it); moved = true; }
    if (k === ' ' && isGun(it)) { fireFromToolbar(it); moved = true; }
    if (moved) { e.preventDefault(); buildToolbar(); }
  });

  // ---------- 器材櫃：拖到實驗台 ----------
  var shelfEl = $('#shelf'), ghost = document.createElement('div');
  ghost.className = 'ghost'; document.body.appendChild(ghost);
  function buildShelf() {
    shelfEl.innerHTML = Object.keys(level.shelf).map(function (k) {
      var info = SHELF[k], left = shelfLeft(k), isBall = info.kind === 'ball' || info.kind === 'iron';
      var loaded = isBall && S.items.some(function (i) { return i.props && i.props.ball === k; });
      return '<div class="tile' + (isBall ? ' ball' : '') + (!isBall && left <= 0 ? ' out' : '') + (loaded ? ' loaded' : '') + '" data-k="' + k + '" role="button" tabindex="0" aria-label="' + info.name + (isBall ? '：拖到發射器上換球' : '：拖到實驗台，剩 ' + left + ' 個') + '">' +
        iconSvg(k) + '<span>' + info.name + '</span>' + (isBall ? '' : '<span class="cnt">' + left + '</span>') + '</div>';
    }).join('');
  }
  shelfEl.addEventListener('pointerdown', function (e) {
    var t = e.target.closest('.tile'); if (!t || S.mode !== 'build') return;
    var k = t.getAttribute('data-k'), info = SHELF[k];
    if (info.kind !== 'ball' && info.kind !== 'iron' && shelfLeft(k) <= 0) { toast(info.name + '用完了'); sfx('warn'); return; }
    e.preventDefault();
    drag = { kind: 'shelf', k: k, sx: e.clientX, sy: e.clientY, moved: false, pid: e.pointerId };
    ghost.innerHTML = iconSvg(k); sfx('item_pick');
    try { shelfEl.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件 */ }
  });
  shelfEl.addEventListener('pointermove', function (e) {
    if (!drag || drag.kind !== 'shelf') return;
    if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 8) drag.moved = true;
    if (drag.moved) { ghost.classList.add('show'); ghost.style.left = (e.clientX - 32) + 'px'; ghost.style.top = (e.clientY - 28) + 'px'; }
  });
  function shelfEnd(e) {
    if (!drag || drag.kind !== 'shelf') return;
    var d = drag; drag = null; ghost.classList.remove('show');
    var info = SHELF[d.k], r = cv.getBoundingClientRect();
    var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!d.moved) { tapShelf(d.k); return; }
    if (!inside) return;
    var p = s2w(e.clientX - r.left, e.clientY - r.top);
    if (info.kind === 'ball' || info.kind === 'iron') { loadBallAt(d.k, p); return; }
    placeNew(d.k, p);
  }
  shelfEl.addEventListener('pointerup', shelfEnd);
  shelfEl.addEventListener('pointercancel', function () { drag = null; ghost.classList.remove('show'); });
  shelfEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { var t = e.target.closest('.tile'); if (t) { e.preventDefault(); tapShelf(t.getAttribute('data-k')); } } });
  function holders(kind) { return S.items.filter(function (i) { return kind === 'iron' ? i.type === 'dropper' : (i.type === 'launcher' || i.type === 'cannon' || i.type === 'seesaw'); }); }
  function loadInto(it, k) { it.props.ball = k; sfx('item_place'); toast((it.type === 'dropper' ? '釋放夾掛上' : '裝上') + SHELF[k].name + '（' + M.BALLS[k].note + '）'); buildShelf(); buildToolbar(); }
  function loadBallAt(k, p) {
    var info = SHELF[k], hs = holders(info.kind), best = null, bd = 1.4;
    hs.forEach(function (h) { var bb = bbox([].concat.apply([], polysOf(h))), c = V((bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2); var d = dist(p, c); if (d < bd + (bb.x1 - bb.x0) / 2) { bd = d; best = h; } });
    if (!best) { toast(info.kind === 'iron' ? '鐵球要拖到上方的釋放夾上' : (hs.length ? '球要拖到發射器（或翹翹板）上' : '先把翹翹板擺到桌上，再把球放上去')); sfx('warn'); return; }
    loadInto(best, k);
  }
  function tapShelf(k) {
    var info = SHELF[k];
    if (info.kind === 'ball' || info.kind === 'iron') {
      var hs = holders(info.kind), target = S.sel && hs.indexOf(S.sel) >= 0 ? S.sel : hs[0];
      if (!target) { toast('先把翹翹板擺到桌上，再把球放上去'); sfx('warn'); return; }
      loadInto(target, k); return;
    }
    toast('把「' + info.name + '」拖到實驗台上');
  }
  function placeNew(k, p) {
    var info = SHELF[k], it;
    if (info.kind === 'car') it = newItem('car', Math.round((p.x - CAR_W / 2) * 20) / 20, TRACK.y, { props: { key: k } });
    else if (k === 'seesaw') it = newItem('seesaw', Math.round(p.x * 20) / 20, M.TYPES.seesaw.foot, { props: { arm: 2.5, ball: 'steel' } });
    else it = newItem(k, Math.round(p.x * 20) / 20, Math.round(p.y * 20) / 20, {});
    S.items.push(it);
    if (!valid(it)) {
      S.items.pop();
      toast(info.kind === 'car' ? '滑車要放在軌道上、發射器和光電閘之間，不能疊在一起' : '這裡不能放：會跟別的東西重疊'); sfx('warn'); return;
    }
    if (info.kind === 'car') sortCars();
    sfx('item_place'); select(it); buildShelf();
  }
  function removeItem(it) { S.items = S.items.filter(function (i) { return i !== it; }); if (S.sel === it) select(null); sfx('reset'); buildShelf(); }
  function sortCars() { /* 位置就是順序，不用另外排 */ }

  // ---------- 工具列（點器材時出現，nobook 的「選單」） ----------
  function isGun(it) { return it.type === 'launcher' || it.type === 'cannon' || it.type === 'dropper' || it.type === 'tlaunch'; }
  function rotateBy(it, dir) {
    var T = M.TYPES[it.type], step = it.type === 'cannon' ? 0.5 : (it.type === 'launcher' ? 1 : 5);
    var lo = T.rotMin != null ? T.rotMin : -180, hi = it.rotMax != null ? it.rotMax : (T.rotMax != null ? T.rotMax : 180);
    var old = it.ang, deg = Math.round(it.ang / D2R / step) * step + dir * step;
    it.ang = clamp(deg, lo, hi) * D2R;
    if (!valid(it)) { it.ang = old; toast('會跟別的東西重疊'); sfx('warn'); } else tick();
  }
  function info(it) {
    var deg = (it.ang / D2R).toFixed(it.type === 'cannon' ? 1 : 0);
    if (it.type === 'launcher') return '仰角 ' + deg + '°・壓縮 ' + f1(it.props.x || 0) + ' cm・' + (it.props.ball ? M.BALLS[it.props.ball].name : '沒裝球');
    if (it.type === 'cannon') { var cup = (level.cups || [])[0], dd = cup ? '｜杯口：水平 ' + f1((cup.x - it.x) * 10) + '、高 ' + f1((cup.y + cup.h - it.y) * 10) + ' cm' : ''; return '仰角 ' + deg + '°' + dd; }
    if (it.type === 'seesaw') return '支點：左 ' + f1(it.props.arm * 10) + ' cm、右 ' + f1((M.TYPES.seesaw.len - it.props.arm) * 10) + ' cm';
    if (it.type === 'dropper') return (it.props.ball ? M.BALLS[it.props.ball].name : '沒掛鐵球') + '・夾子在軌道下 ' + f1(it.props.h * 10) + ' cm';
    if (it.type === 'tlaunch') return '壓縮 ' + f1(it.props.x || 0) + ' cm（最多 ' + TRACK.maxX + ' cm）';
    if (it.type === 'car') return SHELF[it.props.key].name;
    return M.TYPES[it.type].name + '・長 ' + f1(it.len * 10) + ' cm・角度 ' + deg + '°';
  }
  function btn(label, act, cls) { return '<button type="button" data-act="' + act + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + label + '</button>'; }
  function buildToolbar() {
    var it = S.sel;
    if (!it || S.mode !== 'build') { toolbar.hidden = true; return; }
    var h = '<span class="chip">' + info(it) + '</span>';
    if (canRotate(it)) h += it.type === 'cannon' ? btn('−0.5°', 'rotm') + btn('+0.5°', 'rotp') : it.type === 'launcher' ? btn('−1°', 'rotm') + btn('+1°', 'rotp') : btn('↺ 5°', 'rotp') + btn('↻ 5°', 'rotm');
    if (it.type === 'launcher' || it.type === 'tlaunch') h += btn('壓縮 −', 'cm') + btn('壓縮 +', 'cp') + btn('發射', 'fire', 'go');
    if (it.type === 'cannon') h += btn('發射', 'fire', 'go');
    if (it.type === 'seesaw') h += btn('支點 ◀', 'pl') + btn('支點 ▶', 'pr');
    if (it.type === 'dropper') h += btn('夾子 ▲', 'hu') + btn('夾子 ▼', 'hd') + btn('放開', 'fire', 'go');
    if (!it.fixed && it.type !== 'car' && it.type !== 'seesaw' && shelfLeft(it.type) > 0) h += btn('複製', 'copy');
    if (!it.fixed) h += btn('刪除', 'del', 'del');
    toolbar.innerHTML = h; toolbar.hidden = false; placeToolbar();
  }
  function placeToolbar() { /* 工具列固定在實驗台左上角（CSS），不會蓋住器材 */ }
  toolbar.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || !S.sel) return;
    var it = S.sel, a = b.getAttribute('data-act');
    if (a === 'rotm') rotateBy(it, -1);
    if (a === 'rotp') rotateBy(it, 1);
    if (a === 'cm' || a === 'cp') { var mx = it.type === 'tlaunch' ? TRACK.maxX : M.TYPES.launcher.maxX; it.props.x = Math.round(clamp((it.props.x || 0) + (a === 'cp' ? 0.1 : -0.1), 0, mx) * 10) / 10; tick(); }
    if (a === 'pl' || a === 'pr') { var T = M.TYPES.seesaw, d = a === 'pr' ? 0.1 : -0.1, arm = clamp(it.props.arm + d, T.minArm, T.maxArm); var ox = it.x, oa = it.props.arm; it.x += arm - it.props.arm; it.props.arm = Math.round(arm * 100) / 100; if (!valid(it)) { it.x = ox; it.props.arm = oa; toast('會跟別的東西重疊'); sfx('warn'); } else tick(); }
    if (a === 'hu' || a === 'hd') { it.props.h = Math.round(clamp(it.props.h + (a === 'hd' ? 0.1 : -0.1), 0.3, it.y - 1.2) * 100) / 100; tick(); }
    if (a === 'fire') { fireFromToolbar(it); return; }
    if (a === 'copy') { var c = newItem(it.type, it.x + 0.4, it.y - 0.3, { ang: it.ang, len: it.len }); S.items.push(c); if (!valid(c)) { c.y = it.y + 0.4; if (!valid(c)) { S.items.pop(); toast('旁邊沒有空位可以複製'); sfx('warn'); return; } } sfx('item_place'); select(c); buildShelf(); return; }
    if (a === 'del') { removeItem(it); return; }
    buildToolbar();
  });
  function fireFromToolbar(it) {
    if (it.type === 'launcher' && (it.props.x || 0) < 0.3) { toast('先把紅色推桿往後拉（或按「壓縮 +」），彈簧才有能量'); sfx('warn'); return; }
    if (it.type === 'tlaunch' && (it.props.x || 0) < 0.3) { toast('先把紅色推桿往後拉（或按「壓縮 +」）'); sfx('warn'); return; }
    fire(it);
  }

  // ---------- 發射與一發的結束 ----------
  function worldItems() { return S.items.filter(function (i) { return M.TYPES[i.type]; }); }
  function fire(gun) {
    if (S.mode !== 'build' || S.passed) return;
    if (S.shots <= 0) { toast('次數用完了'); return; }
    if (gun.type === 'tlaunch') return fireTrack(gun);
    var env = M.buildWorld(level, worldItems()), run = { env: env, gun: gun, vmax: 0 };
    env.world.onHit = onHit;
    if (gun.type === 'launcher' || gun.type === 'cannon') {
      if (!gun.props.ball) { toast('先把球拖到發射器上'); sfx('warn'); return; }
      var f = M.fire(env, gun);
      run.ball = f.ball; run.kind = gun.props.ball; run.info = { v0: f.v0, deg: f.angle, comp: gun.props.x };
      run.tr = new M.Tracker(env, f.ball); sfx('action');
    } else if (gun.type === 'dropper') {
      var ss = S.items.filter(function (i) { return i.type === 'seesaw'; })[0];
      if (!ss) { toast('先把翹翹板從器材櫃拖到桌上'); sfx('warn'); return; }
      if (!gun.props.ball) { toast('釋放夾還沒掛鐵球'); sfx('warn'); return; }
      var sb = M.seesawLoad(env, ss);
      for (var i = 0; i < 30; i++) env.world.step(1 / 60);
      M.drop(env, gun);
      run.ball = sb; run.kind = ss.props.ball; run.info = { iron: gun.props.ball, h: gun.props.h, dropY: gun.y - gun.props.h, arm: ss.props.arm };
      run.tr = new M.Tracker(env, sb, { waitLaunch: true, waitT: 1.2, restT: 0.3, maxT: 4 }); sfx('ui_tap');
    }
    S.run = run; S.mode = 'run'; select(null); S.last = null;
  }
  var lastHitSfx = 0;
  function onHit(b, other, speed) {
    var now = Date.now();
    if (speed > 6) puff(b.p, speed > 20 ? 8 : 4, b.kind === 'steel' || b.kind.indexOf('iron') === 0 ? 'rgba(255,255,255,.8)' : 'rgba(255,220,180,.85)');
    if (speed > 8 && now - lastHitSfx > 90) { lastHitSfx = now; sfx('ball_land'); }
  }
  function fireTrack(gun) {
    var cars = S.items.filter(function (i) { return i.type === 'car'; }).sort(function (a, b) { return a.x - b.x; });
    if (!cars.length) { toast('先把滑車從器材櫃拖到軌道上'); sfx('warn'); return; }
    var tk = new M.Track({ startX: TRACK.startX, endX: TRACK.endX, gateX: TRACK.gateX });
    cars.forEach(function (c) { var inf = SHELF[c.props.key]; tk.add({ m: inf.m, w: CAR_W, x: c.x, bumpL: inf.velcro ? 'velcro' : 'spring', bumpR: inf.velcro ? 'velcro' : 'spring', info: inf, item: c }); });
    var first = tk.cars[0], v1 = (gun.props.x / 100) * Math.sqrt(TRACK.k / (first.m + TRACK.plungerM));
    // 推桿先推著第一台車從發射器出口開始跑
    first.x = Math.max(first.x, TRACK.startX); first.v = v1 * 10;
    var lastCar = tk.cars[tk.cars.length - 1];
    S.run = { track: tk, gun: gun, t: 0, info: { comp: gun.props.x, v1: v1, firstM: first.m }, lastCar: lastCar, gateFlash: 0, logN: 0 };
    S.mode = 'run'; select(null); sfx('action');
  }
  function endShot() {
    var r = S.run, hit;
    S.shot++; S.shots--;
    if (r.track) {
      var g = r.track.gateLog.filter(function (e) { return e.car === r.lastCar; })[0];
      r.gateV = g ? g.v : 0; hit = r.gateV >= level.target;
      showData(r, hit);
    } else {
      hit = r.tr.hit;
      var tr = r.ball.trail.slice(); if (r.ball.alive) tr.push(V(r.ball.p.x, r.ball.p.y));
      S.traces.push({ pts: tr, hit: hit }); if (S.traces.length > 4) S.traces.shift();
      S.last = { kind: r.kind, ball: r.ball.alive && !hit ? V(r.ball.p.x, r.ball.p.y) : null };
      showData(r, hit);
    }
    S.run = null; S.mode = 'build'; updateShots();
    if (hit) return win(r);
    sfx(r.track ? 'miss' : (r.ball && r.ball.alive ? 'miss' : 'warn'), 0.05);
    if (S.shots <= 0) setTimeout(lose, 700);
    else if (level.fail && S.shot % 3 === 0) toast('線索：' + level.fail);   // 每失敗 3 次，搭檔給一次線索（不給答案）
    else toast('沒成功，還剩 ' + S.shots + ' 次。看看數據再調整。');
  }
  function showData(r, hit) {
    var h = '<b>第 ' + S.shot + ' 次</b>　';
    if (r.track) {
      h += '壓縮 ' + f1(r.info.comp) + ' cm → 第一台（' + fmtM(r.info.firstM) + '）出發 <b>' + r.info.v1.toFixed(2) + ' m/s</b><br>光電閘：';
      var logs = r.track.gateLog.map(function (e) { return fmtM(e.car.m) + ' ' + e.v.toFixed(2) + ' m/s'; });
      h += logs.length ? logs.join('、') : '沒有車通過';
      h += '<br>最後一台（' + fmtM(r.lastCar.m) + '）：' + (hit ? '<span class="hit">' + r.gateV.toFixed(2) + ' m/s，過關！</span>' : '<span class="miss">' + (r.gateV ? r.gateV.toFixed(2) + ' m/s，還不夠（要 ' + level.target.toFixed(2) + '）' : '沒通過光電閘') + '</span>');
    } else {
      var t = r.tr, ball = M.BALLS[r.kind];
      if (r.gun.type === 'dropper') h += M.BALLS[r.info.iron].name + '從離桌面 ' + f1((r.info.dropY - 2 * M.BALLS[r.info.iron].r) * 10) + ' cm 放開｜支點左 ' + f1(r.info.arm * 10) + ' cm<br>' + ball.name + '最快 <b>' + (r.vmax / 10).toFixed(2) + ' m/s</b>';
      else h += ball.name + '（' + ball.note + '）<br>' + (r.gun.type === 'launcher' ? '壓縮 ' + f1(r.info.comp) + ' cm → ' : '') + '出口速度 <b>' + r.info.v0.toFixed(2) + ' m/s</b>・仰角 ' + r.info.deg.toFixed(r.gun.type === 'cannon' ? 1 : 0) + '°';
      h += '・最高點離桌面 ' + f1(t.maxY * 10) + ' cm<br>';
      h += hit ? '<span class="hit">進杯了！</span>' : '<span class="miss">沒進</span>' + (t.land ? '，第一次碰到東西在 x = ' + f1(t.land.x * 10) + ' cm、高 ' + f1(t.land.y * 10) + ' cm' : (r.ball.alive ? '' : '，飛出實驗台了'));
    }
    dataBox.innerHTML = h; dataBox.hidden = false;
  }
  function fmtM(m) { return m >= 1 ? m + ' kg' : Math.round(m * 1000) + ' g'; }
  function starList(r) {
    if (no === 4) return [true, S.shot <= 3, S.shot === 1];
    if (no === 5) return [true, S.shot <= 5, (r.gateV || 0) >= 1.30];
    return [true, S.shot <= 5, S.shot <= 2];
  }
  function win(r) {
    S.passed = true;
    var got = starList(r), stars = got.filter(Boolean).length;
    if (window.LabRecords) window.LabRecords.onPass(level.id, stars);
    if (!r.track) { sfx('cup_hit'); confetti(level.cups[0]); }
    setTimeout(function () {
      sfx('pass'); for (var k = 1; k <= stars; k++) sfx('star' + k, 1.15 + 0.34 * (k - 1));
      var sh = '<div class="stars">' + [0, 1, 2].map(function (i) { return '<span' + (got[i] ? '' : ' class="off"') + '>★</span>'; }).join('') + '</div>' +
        '<h2>過關！</h2>' + (level.win ? '<p class="say">' + level.win + '</p>' : '') + '<ul>' + level.stars.map(function (s, i) { return '<li>' + (got[i] ? '✓ ' : '✗ ') + s + '</li>'; }).join('') + '</ul>' +
        '<div class="learn">' + dataBox.innerHTML + '</div><div class="learn"><b>背後的科學</b><br>' + level.learn + '</div>' + (level.bonus ? '<div class="learn bonus"><b>延伸挑戰</b><br>' + level.bonus + '</div>' : '') +
        '<div class="row"><a href="phy.html?lv=' + no + '">再玩一次</a>' + (no < LV.length ? '<a class="go" href="phy.html?lv=' + (no + 1) + '">下一關</a>' : '<a class="go" href="index.html">關卡列表</a>') + '</div>';
      openSheet(sh);
    }, r.track ? 500 : 1100);
  }
  function lose() {
    sfx('miss');
    openSheet('<h2>次數用完了</h2><p>' + level.shots + ' 次都沒成功。看看留下來的軌跡和數據，想想該怎麼調，再試一次！</p>' + (level.fail ? '<div class="learn"><b>線索</b><br>' + level.fail + '</div>' : '') + '<div class="learn">' + dataBox.innerHTML + '</div>' +
      '<div class="row"><a href="index.html">關卡列表</a><a class="go" href="phy.html?lv=' + no + '">重來</a></div>');
  }
  // 委託單（每關開場的情境）：只放程式內建的關卡文字
  function briefHtml() {
    return '<div class="brief"><span class="tag">新委託</span><h2>' + level.title + '</h2><p class="topic">' + level.stage + (level.topic ? '・' + level.topic : '') + '</p>' +
      '<ul class="story">' + (level.story || []).map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>' +
      '<div class="goal"><b>任務</b>' + level.mission + '</div>' +
      '<div class="row"><a href="index.html">換一個委託</a><button type="button" class="go" id="accept">接下委託</button></div></div>';
  }
  function showBrief() { openSheet(briefHtml()); var ac = $('#accept'); if (ac) { ac.focus(); ac.addEventListener('click', function () { $('#ov').classList.remove('show'); sfx('ui_tap'); }); } }
  function openSheet(h) { $('#sheet').innerHTML = h; $('#ov').classList.add('show'); var a = $('#sheet a.go'); if (a) a.focus(); }
  function updateShots() { var h = ''; for (var i = 0; i < level.shots; i++) h += '<i' + (i < level.shots - S.shots ? ' class="used"' : '') + '></i>'; $('#shots').innerHTML = h; $('#shots').setAttribute('aria-label', '剩下 ' + S.shots + ' 次'); }

  // ---------- 主迴圈 ----------
  var tPrev = 0, acc = 0;
  function loop(ts) {
    var dt = tPrev ? Math.min(0.1, (ts - tPrev) / 1000) : 0; tPrev = ts;
    if (S.mode === 'run' && S.run) {
      acc += dt; var n = 0;
      while (acc >= 1 / 60 && n < 4 && S.run) {
        acc -= 1 / 60; n++;
        var r = S.run;
        if (r.track) {
          var nHit = r.track.hits || 0;
          r.track.step(1 / 60); r.t += 1 / 60; r.gateFlash = Math.max(0, r.gateFlash - 1 / 60);
          if ((r.track.hits || 0) > nHit) sfx('item_place');   // 滑車相撞「喀」
          if (r.track.gateLog.length > r.logN) { r.logN = r.track.gateLog.length; r.gateFlash = 0.25; sfx('ui_tap'); }
          var moving = r.track.cars.some(function (c) { return Math.abs(c.v) > 0.05; });
          var passed = r.track.gateLog.some(function (e) { return e.car === r.lastCar; });
          if (passed && !r.passT) r.passT = r.t;
          if ((r.passT && r.t > r.passT + 1.2) || !moving || r.t > 7) endShot();
        } else {
          r.env.world.step(1 / 60); r.tr.update(1 / 60);
          var spd = Math.hypot(r.ball.v.x, r.ball.v.y);
          r.vmax = Math.max(r.vmax || 0, spd);
          if (r.ball.alive && r.ball.touching && spd > 4 && Date.now() - (r.rollT || 0) > 700) { r.rollT = Date.now(); sfx('ball_roll'); }   // 在桌面、板子上滾
          if (r.tr.done) endShot();
        }
      }
    } else acc = 0;
    stepFx(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- 開場 ----------
  var toastT = 0;
  function toast(t) { var el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, 2600); }
  $('#stage').textContent = level.stage; $('#title').textContent = level.title; $('#diff').textContent = level.diff;
  $('#missionText').textContent = level.mission; $('#howText').textContent = level.note;
  document.title = '瘋狂實驗室｜' + level.title;
  $('#btnHow').addEventListener('click', function () { var h = $('#howText'); h.hidden = !h.hidden; this.setAttribute('aria-expanded', String(!h.hidden)); this.textContent = h.hidden ? '怎麼操作' : '收起'; resize(); });
  var sb = $('#btnSfx');
  var SPK = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var SPKX = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function showSfx(m) { sb.innerHTML = m ? SPKX : SPK; sb.setAttribute('aria-pressed', String(!m)); sb.setAttribute('aria-label', m ? '音效：關' : '音效：開'); }
  if (window.LabSfx) { showSfx(window.LabSfx.isMuted()); window.LabSfx.onChange(showSfx); sb.addEventListener('click', function () { window.LabSfx.setMuted(!window.LabSfx.isMuted()); sfx('ui_tap'); }); } else sb.hidden = true;
  if (window.LabRecords) window.LabRecords.markPlay();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap); else window.addEventListener('resize', resize);
  resize(); updateShots(); buildShelf(); if (level.story) showBrief();
  var first = S.items.filter(function (i) { return isGun(i); })[0];
  if (first) select(first);
  toast('提示：點器材會出現選取框和工具列；' + (TRACK ? '先把滑車拖到軌道上' : '拖紅色推桿往後拉、放手就發射'));
  requestAnimationFrame(loop);
  window.__phy = { S: S, level: level, fire: fire, cam: cam, valid: valid, placeNew: placeNew, loadBallAt: loadBallAt, s2w: s2w, w2s: w2s };
})();
