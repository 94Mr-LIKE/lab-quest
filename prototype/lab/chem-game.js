/* 瘋狂實驗室・化學實驗台（老闆 10/19：操作學 nobook）
 * 照 nobook 使用手冊的手法：
 *   器材從器材櫃拖上實驗台；拖著容器靠近另一個容器的瓶口，放手就「架好」，旁邊出現藍色「傾倒」圓鈕，往下拖越多倒越快，放手就停；
 *   吸量管拖進瓶子，拖紅色吸球往上＝吸、往下＝放；洗瓶拖到容器上方，按住藍色圓鈕擠水；玻璃棒拖進燒杯左右拖＝攪拌；
 *   滴定管的活栓往右拖＝打開；點一下＝一滴。選取量筒、吸量管、滴定管、容量瓶時，右邊放大鏡看刻度。
 * 溶液、反應用 chem-model.js 真的算（mol、mL、pH、酚酞顏色、溶解）。
 * innerHTML 只放程式內的文字與算出來的數字；玩家輸入的答案只用 parseFloat 讀數字，不放進 HTML。 */
(function () {
  'use strict';
  var CM = window.ChemModel, LV = window.CHEM_LEVELS;
  var no = Math.max(1, Math.min(LV.length, parseInt(new URLSearchParams(location.search).get('lv'), 10) || 1));
  var level = LV[no - 1];
  function $(s) { return document.querySelector(s); }
  function sfx(n, d) { if (window.LabSfx) window.LabSfx.play(n, d); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function P(x, y) { return { x: x, y: y }; }
  function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  function f2(x) { return (Math.round(x * 100) / 100).toFixed(2); }

  var cv = $('#cv'), ctx = cv.getContext('2d'), wrap = $('#stageWrap'), toolbar = $('#toolbar'), dataBox = $('#data');
  var W = 0, H = 0, DPR = 1;
  var cam = { x: level.world.w / 2, y: 0, s: 10, fit: 10, user: false };
  var view = { s: 10, cx: 0, cy: 0, ox: 0, oy: 0 };
  var S = { spAmt: 5, items: [], sel: null, over: false, ppe: { goggles: false, gloves: false }, log: [], traps: {}, fx: [], uid: 0, t: 0,
    unkC: 0.08 + Math.random() * 0.07, acidBy: null, rinses: 0, beakerToFlask: 0, washSinceTransfer: false, session: null };
  S.unkC = Math.round(S.unkC * 10000) / 10000;
  var TRAPS = { 1: ['sugarjar', 'beaker100'], 2: ['cyl50', 'jug', 'naoh', 'lamp'], 3: ['cyl50'] }[no] || [];

  // ---------- 器材 ----------
  var TY = {
    beaker250: { name: '燒杯 250 mL', kind: 'cont', shape: 'beaker250', film: 1.0, rate: 1.5, mass: 105 },
    beaker100: { name: '燒杯 100 mL', kind: 'cont', shape: 'beaker100', film: 0.6, rate: 1.1, mass: 52 },
    cyl100: { name: '量筒 100 mL', kind: 'cont', shape: 'cyl100', film: 0.4, rate: 0.8, mass: 120, measure: 'cyl', scale: 100 },
    cyl50: { name: '量筒 50 mL', kind: 'cont', shape: 'cyl50', film: 0.3, rate: 0.6, mass: 80, measure: 'cyl', scale: 50 },
    vol100: { name: '容量瓶 100 mL', kind: 'cont', shape: 'vol100', film: 0.8, rate: 0.5, mass: 70, measure: 'vol' },
    conical: { name: '錐形瓶 250 mL', kind: 'cont', shape: 'conical', film: 0.6, rate: 0.8, mass: 110 },
    bottle: { name: '試劑瓶', kind: 'cont', shape: 'bottle', film: 0, rate: 0.7, mass: 250, src: true },
    naoh: { name: '氫氧化鈉溶液', kind: 'cont', shape: 'bottle', film: 0, rate: 0.7, mass: 250, src: true, base: 'bottle' },
    jug: { name: '自來水壺', kind: 'cont', shape: 'jug', film: 0, rate: 2.0, mass: 300, src: true },
    washer: { name: '洗瓶（純水）', kind: 'washer', shape: 'washer', mass: 60 },
    pipette: { name: '吸量管 20 mL', kind: 'pipette' },
    rod: { name: '玻璃棒', kind: 'rod' },
    stopper: { name: '瓶塞', kind: 'stopper' },
    paper: { name: '稱量紙', kind: 'paper', mass: 0.30 },
    spatula: { name: '藥匙', kind: 'spatula' },
    saltjar: { name: '食鹽罐', kind: 'jar', solid: 'NaCl' },
    sugarjar: { name: '砂糖罐', kind: 'jar', solid: 'sugar' },
    balance: { name: '電子秤', kind: 'balance' },
    burette: { name: '滴定管 50 mL', kind: 'burette' },
    phpbottle: { name: '酚酞指示劑', kind: 'dropbottle' },
    lamp: { name: '酒精燈', kind: 'lamp' },
    goggles: { name: '護目鏡', kind: 'ppe' }, gloves: { name: '耐酸手套', kind: 'ppe' }
  };
  var PIPE = { len: 21, r: 0.3, g0: 17.5, g20: 4 };   // 吸量管：0 mL 刻度在 17.5 cm、20 mL 在 4 cm（從管尖算；畫面比例縮短）
  var BUR = { tip: 16, g0: 46, g50: 20, r: 0.5 };       // 滴定管：管尖 y = 16 cm；0 mL 刻度 y = 46、50 mL 在 y = 20（畫面比例縮短）
  var PAN_Y = 5.4;

  function shapeOf(it) { return CM.SHAPES[TY[it.type].shape]; }
  function HH(it) { var s = shapeOf(it); CM.shapeTable(s); return s.H; }
  function newItem(type, x, y, props) {
    var t = TY[type], it = { uid: type + (++S.uid), type: type, x: x, y: y || 0, tilt: 0, dock: null, props: props || {} };
    if (t.kind === 'cont' || t.kind === 'washer') {
      it.sol = new CM.Sol();
      if (type === 'jug') it.props.reagent = 'tap';
      if (type === 'naoh') it.props.reagent = 'NaOH01';
      if (it.props.reagent) { var vol = it.props.vol || 300; it.sol = CM.fromReagent(it.props.reagent, vol, S.unkC); }
    }
    if (type === 'burette') { it.props.read0 = Math.round((0.4 + Math.random() * 0.8) * 100) / 100; it.props.read = it.props.read0; it.props.open = 0; }
    if (type === 'balance') { it.props.tare = 0; }
    if (type === 'pipette') it.sol = new CM.Sol();
    if (type === 'paper' || type === 'spatula') { it.props.g = 0; it.props.solid = null; }
    return it;
  }
  level.fixed.forEach(function (f) { S.items.push(newItem(f.type, f.x, 0, JSON.parse(JSON.stringify(f.props || {})))); });
  function burette() { return S.items.filter(function (i) { return i.type === 'burette'; })[0]; }
  function balance() { return S.items.filter(function (i) { return i.type === 'balance'; })[0]; }
  function byUid(u) { return S.items.filter(function (i) { return i.uid === u; })[0]; }
  function isCont(it) { return TY[it.type].kind === 'cont'; }

  // ---------- 位置與形狀 ----------
  function pivotLocal(it) { var dir = it.dock && it.dock.dir || 1; if (TY[it.type].kind === 'paper') return P(dir * 3, 0); var s = shapeOf(it); return P(dir * s.mouth, s.H); }   // 稱量紙沒有形狀表，繞靠目標那一端轉（跟 drawPaper 一樣）
  function toWorld(it, p) {
    if (!it.tilt) return P(it.x + p.x, it.y + p.y);
    var pv = pivotLocal(it), dir = it.dock && it.dock.dir || 1, a = -dir * it.tilt * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    var dx = p.x - pv.x, dy = p.y - pv.y;
    return P(it.x + pv.x + dx * c - dy * s, it.y + pv.y + dx * s + dy * c);
  }
  function lipWorld(it) { return toWorld(it, pivotLocal(it)); }
  function mouthTop(it) { return P(it.x, it.y + HH(it)); }
  function boxOf(it) {   // 點選用的範圍（世界座標，直立時）
    var k = TY[it.type].kind, s;
    if (k === 'cont' || k === 'washer') { s = shapeOf(it); CM.shapeTable(s); var r = Math.max(s.base || 0, s.segs.reduce(function (m, g) { return Math.max(m, g[1], g[2]); }, 0)); return { x0: it.x - r - 0.4, x1: it.x + r + 0.4, y0: it.y, y1: it.y + s.H + (k === 'washer' ? 4 : 0.4) }; }
    if (k === 'pipette') return { x0: it.x - 0.9, x1: it.x + 0.9, y0: it.y, y1: it.y + PIPE.len + 2.6 };
    if (k === 'rod') return { x0: it.x - 0.7, x1: it.x + 0.7, y0: it.y, y1: it.y + 20 };
    if (k === 'stopper') return { x0: it.x - 1.2, x1: it.x + 1.2, y0: it.y, y1: it.y + 2 };
    if (k === 'paper') return { x0: it.x - 3.2, x1: it.x + 3.2, y0: it.y, y1: it.y + 1.2 };
    if (k === 'spatula') return it._rack && !it.dock ? { x0: it.x - 1.0, x1: it.x + 1.0, y0: it.y, y1: it.y + 15.6 } : { x0: it.x - 1.2, x1: it.x + 3.2, y0: it.y, y1: it.y + 15.6 };
    if (k === 'jar') return { x0: it.x - 3.3, x1: it.x + 3.3, y0: it.y, y1: it.y + 9.6 };
    if (k === 'balance') return { x0: it.x - 7, x1: it.x + 7, y0: 0, y1: PAN_Y + 0.4 };
    if (k === 'burette') return { x0: it.x - 1.6, x1: it.x + 1.6, y0: BUR.tip - 1.5, y1: BUR.g0 + 4 };
    if (k === 'dropbottle') return { x0: it.x - 2, x1: it.x + 2, y0: it.y, y1: it.y + 9 };
    if (k === 'lamp') return { x0: it.x - 3, x1: it.x + 3, y0: it.y, y1: it.y + 8 };
    return { x0: it.x - 2, x1: it.x + 2, y0: it.y, y1: it.y + 4 };
  }
  // 工具架的位置：桌上固定器材之間最寬、最靠右的空位
  var RACK = (function () {
    var occ = S.items.map(function (it) { var b = boxOf(it); return [b.x0 - 0.5, b.x1 + 0.5]; });
    for (var x = level.world.w - 4.5; x >= 4.5; x -= 0.5) { if (!occ.some(function (o) { return x - 4.0 < o[1] && o[0] < x + 4.0; })) return { x: x, slots: 4 }; }
    return { x: level.world.w - 4.5, slots: 4 };
  })();
  function drawRack() {
    var x0 = RACK.x - 3.8, x1 = RACK.x + 3.8;
    shadowOn(3); rrect(x0, 0, x1, 2.6, 0.3); fs('#8a5a32', '#0b1528', 1.2); shadowOff();
    ctx.fillStyle = 'rgba(0,0,0,.25)'; for (var i = 0; i < RACK.slots; i++) ctx.fillRect(RACK.x - 2.7 + i * 1.8 - 0.35, 2.2, 0.7, 0.4);
    label(RACK.x, 1.2, '工具架', { size: 9, color: '#fff6e8', weight: 900, inset: true });
  }
  function inBox(p, b, pad) { pad = pad || 0; return p.x >= b.x0 - pad && p.x <= b.x1 + pad && p.y >= b.y0 - pad && p.y <= b.y1 + pad; }

  // ---------- 鏡頭 ----------
  function lockMissionHeight() {   // 任務列和工具列輪流出現時高度不變，實驗台才不會上下跳
    var m = $('#mission'); if (!m || m.classList.contains('tool')) return;
    var port = window.matchMedia && window.matchMedia('(orientation: portrait)').matches;   // 直式：預留工具列三行的高度，選器材時版面不跳
    m.style.minHeight = ''; m.style.minHeight = Math.max(port ? 140 : 52, m.offsetHeight) + 'px';
  }
  function resize() {
    lockMissionHeight();
    var r = wrap.getBoundingClientRect(); W = r.width; H = r.height; DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    // 桌面放在離畫面底部 64 px 的地方，下面的桌緣放紀錄和「交給老師」
    cam.fit = Math.min(W / (level.world.w + 1), (H - 70) / (level.world.h + 1));
    if (!cam.user) { cam.s = cam.fit; cam.x = level.world.w / 2; cam.y = -64 / cam.s + (H / 2) / cam.s; }
  }
  // 傾倒時高高的量筒、瓶子會舉到很高：鏡頭自動拉遠，倒完再拉回來
  function autoFrame(dt) {
    if (cam.user) return;
    var top = level.world.h;
    S.items.forEach(function (it) { if (it.dock && it.dock.mode === 'pour' && it.tilt > 0) { var s = TY[it.type].kind === 'paper' ? null : shapeOf(it); if (s) { var lp = lipWorld(it); top = Math.max(top, lp.y + s.H * Math.sin(Math.min(90, it.tilt) * Math.PI / 180) + 1.5, it.y + s.H + 1.5); } } });
    var want = Math.min(W / (level.world.w + 1), (H - 70) / (top + 1));
    cam.s += (want - cam.s) * Math.min(1, dt * 4);
    cam.y = -64 / cam.s + (H / 2) / cam.s;
  }
  function setView(v) { view = v; }
  function mainView() { return { s: cam.s, cx: cam.x, cy: cam.y, ox: W / 2, oy: H / 2 }; }
  function w2s(p) { return P(view.ox + (p.x - view.cx) * view.s, view.oy - (p.y - view.cy) * view.s); }
  function s2w(x, y) { var v = mainView(); return P((x - v.ox) / v.s + v.cx, (v.oy - y) / v.s + v.cy); }
  function worldTf() { ctx.setTransform(DPR * view.s, 0, 0, -DPR * view.s, DPR * (view.ox - view.cx * view.s), DPR * (view.oy + view.cy * view.s)); }
  function screenTf() { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
  function px(n) { return n / view.s; }
  var labels = [];
  function label(x, y, t, o) { labels.push({ x: x, y: y, t: t, o: o || {} }); }

  // ---------- 繪圖 ----------
  function path(pts) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); }
  function grad(x0, y0, x1, y1, st) { var g = ctx.createLinearGradient(x0, y0, x1, y1); st.forEach(function (s) { g.addColorStop(s[0], s[1]); }); return g; }
  function rrect(x0, y0, x1, y1, r) { r = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2); ctx.beginPath(); ctx.moveTo(x0 + r, y0); ctx.lineTo(x1 - r, y0); ctx.arcTo(x1, y0, x1, y0 + r, r); ctx.lineTo(x1, y1 - r); ctx.arcTo(x1, y1, x1 - r, y1, r); ctx.lineTo(x0 + r, y1); ctx.arcTo(x0, y1, x0, y1 - r, r); ctx.lineTo(x0, y0 + r); ctx.arcTo(x0, y0, x0 + r, y0, r); ctx.closePath(); }
  function fs(fill, stroke, lw) { if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = px(lw || 1.6); ctx.lineJoin = 'round'; ctx.stroke(); } }
  function shadowOn(b) { ctx.shadowColor = 'rgba(8,16,30,.45)'; ctx.shadowBlur = (b || 6) * DPR; ctx.shadowOffsetX = 2 * DPR; ctx.shadowOffsetY = 3 * DPR; }
  function shadowOff() { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }

  function drawRoom() {
    screenTf(); var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#22354b'); g.addColorStop(1, '#3a5672'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    worldTf();
    var a = s2wView(0, H), b = s2wView(W, 0), x, y;
    ctx.lineWidth = px(1);
    for (x = Math.floor(a.x / 5) * 5; x <= b.x; x += 5) { ctx.strokeStyle = x % 25 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, b.y); ctx.stroke(); }
    for (y = 5; y <= b.y; y += 5) { ctx.strokeStyle = y % 25 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.moveTo(a.x, y); ctx.lineTo(b.x, y); ctx.stroke(); }
    // 實驗桌（深色耐酸桌面）
    ctx.fillStyle = grad(0, 0, 0, -6, [[0, '#3f4b57'], [0.15, '#2c3742'], [1, '#1b232c']]); ctx.fillRect(a.x - 5, -6, b.x - a.x + 10, 6);
    ctx.strokeStyle = '#7d8a98'; ctx.lineWidth = px(3); ctx.beginPath(); ctx.moveTo(a.x - 5, -0.05); ctx.lineTo(b.x + 5, -0.05); ctx.stroke();
  }
  function s2wView(x, y) { return P((x - view.ox) / view.s + view.cx, (view.oy - y) / view.s + view.cy); }

  function solColor(it) {
    var s = it.sol, c = [215, 235, 252, 0.45];
    if (s.concV / Math.max(s.v, 1e-6) > 0.3) c = [250, 244, 200, 0.6];
    if (s.impure) c = [215, 232, 238, 0.5];
    var pink = CM.phpPink(CM.pH(s), s.php);
    if (it.flash > 0) pink = Math.max(pink, Math.min(1, it.flash) * 0.8);
    if (pink > 0) c = [Math.round(c[0] + (240 - c[0]) * pink), Math.round(c[1] + (90 - c[1]) * pink), Math.round(c[2] + (170 - c[2]) * pink), 0.5 + 0.35 * pink];
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + c[3] + ')';
  }
  function interiorLocal(shape) {   // 內部輪廓（本地座標，逆時針）
    var t = CM.shapeTable(shape), L = [], R = [], step = Math.max(1, Math.floor(t.length / 60));
    for (var i = 0; i < t.length; i += step) { R.push(P(t[i].r, t[i].y)); }
    R.push(P(t[t.length - 1].r, t[t.length - 1].y));
    for (i = R.length - 1; i >= 0; i--) L.push(P(-R[i].x, R[i].y));
    return R.concat(L);
  }
  function clipBelow(poly, yLim) {   // 多邊形 ∩ { y ≤ yLim }
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length], ina = a.y <= yLim, inb = b.y <= yLim;
      if (ina) out.push(a);
      if (ina !== inb) { var t = (yLim - a.y) / (b.y - a.y); out.push(P(a.x + (b.x - a.x) * t, yLim)); }
    }
    return out;
  }
  function area(poly) { var s = 0; for (var i = 0; i < poly.length; i++) { var a = poly[i], b = poly[(i + 1) % poly.length]; s += a.x * b.y - b.x * a.y; } return Math.abs(s) / 2; }
  function drawLiquid(it, shape) {
    var s = it.sol; if (!s || s.v <= 0.02) return;
    var lvl = CM.levelOf(shape, s.v), inner = interiorLocal(shape);
    var poly;
    if (!it.tilt) poly = clipBelow(inner, lvl).map(function (p) { return P(it.x + p.x, it.y + p.y); });
    else {
      var target = area(clipBelow(inner, lvl)), w = inner.map(function (p) { return toWorld(it, p); });
      var lo = Math.min.apply(null, w.map(function (p) { return p.y; })), hi = Math.max.apply(null, w.map(function (p) { return p.y; }));
      for (var k = 0; k < 24; k++) { var mid = (lo + hi) / 2; if (area(clipBelow(w, mid)) < target) lo = mid; else hi = mid; }
      poly = clipBelow(w, (lo + hi) / 2);
    }
    if (poly.length < 3) return;
    path(poly); ctx.fillStyle = solColor(it); ctx.fill();
    if (!it.tilt) {   // 凹液面：靠杯壁的地方高一點
      var r = CM.radiusAt(shape, lvl), y = it.y + lvl;
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = px(1.4);
      ctx.beginPath(); ctx.moveTo(it.x - r, y + Math.min(0.18, r * 0.25)); ctx.quadraticCurveTo(it.x, y - 0.06, it.x + r, y + Math.min(0.18, r * 0.25)); ctx.stroke();
    }
    if (s.solid > 0.01) {   // 還沒溶解的食鹽
      ctx.fillStyle = '#ffffff';
      var n = Math.min(60, Math.ceil(s.solid * 4)), rb = CM.radiusAt(shape, 0.2);
      for (var i = 0; i < n; i++) { var xx = it.x + (((i * 0.618) % 1) * 2 - 1) * rb * 0.85, yy = it.y + 0.12 + ((i * 0.37) % 1) * Math.min(0.7, 0.1 + s.solid * 0.05); ctx.fillRect(xx, yy, 0.12, 0.12); }
    }
  }
  function drawGlass(it) {
    var shape = shapeOf(it), t = TY[it.type], inner = interiorLocal(shape), H0 = shape.H;
    var outer = inner.map(function (p) { return P(p.x + (p.x >= 0 ? 0.15 : -0.15), p.y); });
    outer.unshift(P(0, -0.15)); outer.push(P(0, -0.15));
    var w = outer.map(function (p) { return toWorld(it, p); });
    shadowOn(5);
    if (shape.base) { var b0 = toWorld(it, P(-shape.base, -0.2)), b1 = toWorld(it, P(shape.base, 0.5)); path([toWorld(it, P(-shape.base, -0.2)), toWorld(it, P(shape.base, -0.2)), toWorld(it, P(shape.base, 0.5)), toWorld(it, P(-shape.base, 0.5))]); fs('rgba(230,240,250,.6)', '#0b1528', 1.2); }
    path(w); ctx.fillStyle = shape.glass ? 'rgba(225,240,255,.16)' : (shape.washer ? 'rgba(245,248,252,.55)' : 'rgba(210,220,232,.6)'); ctx.fill();
    shadowOff();
    if (shape.bottle) {   // 試劑瓶標籤
      var lb = [P(-2.6, 2.2), P(2.6, 2.2), P(2.6, 7.6), P(-2.6, 7.6)].map(function (p) { return toWorld(it, p); });
      path(lb); fs('#fffdf6', '#0b1528', 1);
      if (!it.tilt) { var R = CM.REAGENTS[it.props.reagent]; (R ? R.label : []).forEach(function (line, i) { label(it.x, it.y + 6.9 - i * 1.25, line, { size: 9.5 + (i ? 0 : 1), color: '#13233f', weight: i ? 700 : 900, inset: true }); }); }
    }
    drawLiquid(it, shape);
    path(w); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = px(2.2); ctx.stroke(); ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1); ctx.stroke();
    // 刻度
    if (!it.tilt) drawMarks(it, shape);
    if (shape.washer) {   // 洗瓶的彎嘴與擠壓鈕
      var nz = washerNozzle(it);
      ctx.strokeStyle = '#e9eef4'; ctx.lineWidth = Math.max(px(4), 0.35); ctx.beginPath(); ctx.moveTo(it.x - 0.6, it.y + H0 + 0.3); ctx.lineTo(it.x - 0.6, Math.max(it.y + H0 + 2.6, nz.y + 1.2)); ctx.lineTo(nz.x, nz.y); ctx.stroke();
      ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1); ctx.stroke();
      knob(washerKnob(it), '#3c8dde', 'squeeze');
      label(it.x, it.y + 5.5, '純水', { size: 11, color: '#13233f', weight: 900, inset: true });
    }
    if (it.props.stopper) { var sp = [P(-0.9, H0), P(0.9, H0), P(1.1, H0 + 1.4), P(-1.1, H0 + 1.4)].map(function (p) { return toWorld(it, p); }); path(sp); fs('#e9eef4', '#0b1528', 1.2); }
    if (it.dock && it.dock.mode === 'pour') knob(pourKnob(it), '#3c8dde', 'pour');
    if (!it.tilt && t.kind === 'cont' && !shape.bottle && !t.measure && S.sel === it && it.sol) label(it.x, it.y + H0 + 1.6, approx(it.sol.v), { size: 11, color: '#fff', weight: 900, stroke: '#13233f' });
  }
  function drawMarks(it, shape) {
    var t = TY[it.type];
    ctx.strokeStyle = 'rgba(255,255,255,.95)';
    if (t.measure === 'cyl') {
      var big = t.scale === 100, r = shape.segs[1][1];
      for (var v = 1; v <= t.scale; v++) {
        var y = it.y + CM.levelOf(shape, v + volBelowScale(shape)), L = v % 10 === 0 ? 0.9 : v % 5 === 0 ? 0.6 : 0.35;
        if (view.s < 18 && v % 5) continue;
        ctx.lineWidth = px(v % 10 === 0 ? 1.3 : 0.9); ctx.beginPath(); ctx.moveTo(it.x - r, y); ctx.lineTo(it.x - r + L, y); ctx.stroke();
        if (v % 10 === 0 && (view.s > 14 || v % (big ? 20 : 10) === 0)) label(zoomDraw ? it.x - r + 1.0 : it.x + r + 0.2, y, String(v), { size: 9, color: '#fff', weight: 800, align: 'left', stroke: zoomDraw ? '#13233f' : null });   // 放大鏡裡數字畫在刻度旁邊
      }
    } else if (t.measure === 'vol') {
      var yv = it.y + CM.levelOf(shape, 100), rr = CM.radiusAt(shape, yv - it.y) + 0.12;
      ctx.lineWidth = px(1.6); ctx.beginPath(); ctx.ellipse(it.x, yv, rr, 0.12, 0, 0, Math.PI * 2); ctx.stroke();
      label(it.x, it.y + 2.2, '100 mL', { size: 10, color: '#fff', weight: 900, stroke: '#13233f', inset: true });
    } else if (shape.marks && Array.isArray(shape.marks)) {
      shape.marks.forEach(function (m) { var y = it.y + CM.levelOf(shape, m[0]), r = CM.radiusAt(shape, y - it.y); ctx.lineWidth = px(1); ctx.beginPath(); ctx.moveTo(it.x - r, y); ctx.lineTo(it.x - r + 0.7, y); ctx.stroke(); if (view.s > 12) label(it.x - r + 1.3, y, m[1], { size: 8.5, color: 'rgba(255,255,255,.9)', weight: 700, align: 'left' }); });
    }
  }
  function volBelowScale(shape) { return shape.scaleFrom ? CM.volAt(shape, shape.scaleFrom) : 0; }
  function knob(p, color, kind) {
    var R = Math.max(0.55, px(13));
    ctx.fillStyle = color; ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(2); ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = px(2); ctx.beginPath();
    if (kind === 'pour') { ctx.moveTo(p.x - R * 0.45, p.y + R * 0.2); ctx.lineTo(p.x, p.y - R * 0.35); ctx.lineTo(p.x + R * 0.45, p.y + R * 0.2); }
    else { ctx.arc(p.x, p.y, R * 0.45, 0, 7); }
    ctx.stroke();
  }
  function pourKnob(it) {
    var dir = it.dock.dir;
    if (TY[it.type].kind === 'paper') return P(it.x - dir * 3.9, it.y + 1.8);
    var s = shapeOf(it); return toWorld(it, P(-dir * (s.mouth + 1.6), s.H + 1.4));
  }
  function washerNozzle(it) { var s = shapeOf(it); return it.dock && it.dock.nozzle ? it.dock.nozzle : P(it.x - 3.3, it.y + s.H + 1.6); }
  function washerKnob(it) { var s = shapeOf(it); return P(it.x + 3.6, it.y + s.H * 0.55); }

  function drawPipette(it) {
    var x = it.x, y = it.y, L = PIPE.len, r = PIPE.r;
    shadowOn(4);
    ctx.fillStyle = 'rgba(230,242,255,.35)'; ctx.fillRect(x - r, y + 0.5, 2 * r, L - 0.5); shadowOff();
    path([P(x - r, y + 0.6), P(x - 0.08, y), P(x + 0.08, y), P(x + r, y + 0.6)]); fs('rgba(230,242,255,.35)', null);
    // 液柱
    if (it.sol.v > 0.005) { var top = pipeY(it, it.sol.v); ctx.fillStyle = solColor(it); ctx.fillRect(x - r + 0.06, y + 0.4, 2 * r - 0.12, top - y - 0.4); ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = px(1.2); ctx.beginPath(); ctx.moveTo(x - r + 0.06, top + 0.06); ctx.quadraticCurveTo(x, top - 0.05, x + r - 0.06, top + 0.06); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = px(1.6); ctx.strokeRect(x - r, y + 0.6, 2 * r, L - 0.6); ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(0.8); ctx.strokeRect(x - r, y + 0.6, 2 * r, L - 0.6);
    // 刻度（0 在上、20 在下）
    ctx.strokeStyle = 'rgba(255,255,255,.95)';
    for (var v = 0; v <= 200; v++) {
      var vv = v / 10, yy = pipeY(it, 20 - vv) , isInt = v % 10 === 0;
      if (view.s < 25 && !isInt) continue;
      ctx.lineWidth = px(isInt ? 1.1 : 0.6); ctx.beginPath(); ctx.moveTo(x - r, yy); ctx.lineTo(x - r + (isInt ? 0.35 : 0.18), yy); ctx.stroke();
      if (isInt && (vv % 5 === 0 || view.s > 30)) label(x + r + 0.15, yy, String(vv), { size: 8.5, color: '#fff', weight: 800, align: 'left' });
    }
    // 安全吸球
    var by = y + L + 1.1; ctx.fillStyle = '#d63b2f'; ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1.6); ctx.beginPath(); ctx.ellipse(x, by, 0.9, 1.3, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(x - 0.3, by + 0.45, 0.22, 0, 7); ctx.fill();
  }
  // 吸量管裡體積 v（mL，從 0 刻度往下算的「已吸入量」）對應的液面高度：0 刻度在上；液面在 (20 − v) 的刻度位置
  // 吸量管裡有 v mL 時，液面在刻度「20 − v」的位置（0 刻度在上、20 刻度在下；20 刻度以下的管尖不算）
  function pipeY(it, v) { return it.y + PIPE.g20 + (PIPE.g0 - PIPE.g20) * v / 20; }
  function drawRod(it) {
    var a = it.dock ? 0.12 : it._rack ? 0.02 : 0.25, top = P(it.x + Math.sin(a) * 20, it.y + Math.cos(a) * 20);
    ctx.strokeStyle = 'rgba(240,248,255,.95)'; ctx.lineWidth = Math.max(px(3), 0.35); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(it.x, it.y + 0.2); ctx.lineTo(top.x, top.y); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(0.8); ctx.stroke();
  }
  // GPT 重畫的器材圖（老闆 10/20：挖食鹽的圖重做）
  var IMG = {};
  ['salt_jar', 'spatula', 'spatula_salt'].forEach(function (n) { var im = new Image(); im.src = 'img/' + n + '.png'; IMG[n] = im; });
  function sprite(n) { var im = IMG[n]; return im && im.complete && im.naturalWidth ? im : null; }
  function drawSprite(im, x, y, w, h, ang) {   // (x, y)＝圖的底邊中點（世界座標），ang＝逆時針弧度
    ctx.save(); ctx.translate(x, y); if (ang) ctx.rotate(ang); ctx.scale(1, -1); ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
  }
  var SPAT = { len: 15.5, ang: -0.176 };   // 藥匙長 15.5 cm、直立時往右斜 10°
  function drawSpatula(it) {
    var sp = sprite(it.props.g > 0.01 ? 'spatula_salt' : 'spatula');
    if (sp) { drawSprite(sp, it.x, it.y + 0.1, SPAT.len * sp.naturalWidth / sp.naturalHeight, SPAT.len, it._rack && !it.dock ? 0 : SPAT.ang); return; }
    var top = P(it.x + 2.5, it.y + 15);
    ctx.strokeStyle = '#c9d2dc'; ctx.lineWidth = Math.max(px(4), 0.4); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(it.x, it.y + 1); ctx.lineTo(top.x, top.y); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(0.8); ctx.stroke();
    ctx.fillStyle = '#c9d2dc'; ctx.beginPath(); ctx.ellipse(it.x, it.y + 0.6, 0.9, 0.5, 0.3, 0, 7); ctx.fill(); ctx.stroke();
    if (it.props.g > 0.01) { ctx.fillStyle = it.props.solid === 'sugar' ? '#fff3dc' : '#ffffff'; ctx.beginPath(); ctx.ellipse(it.x, it.y + 0.95, 0.7, 0.25 + Math.min(0.4, it.props.g * 0.2), 0, 0, 7); ctx.fill(); }
  }
  function drawPaper(it) {
    ctx.save();
    if (it.tilt && it.dock) { var dir = it.dock.dir, ex = it.x + dir * 3; ctx.translate(ex, it.y); ctx.rotate(-dir * it.tilt * Math.PI / 180); ctx.translate(-ex, -it.y); }
    drawPaperBody(it);
    ctx.restore();
    if (it.dock && it.dock.mode === 'pour') knob(pourKnob(it), '#3c8dde', 'pour');
  }
  function drawPaperBody(it) {
    path([P(it.x - 3, it.y), P(it.x + 3, it.y), P(it.x + 2.6, it.y + 0.35), P(it.x - 2.6, it.y + 0.35)]); fs('#fbfbf6', '#0b1528', 1);
    if (it.props.g > 0.005) { ctx.fillStyle = it.props.solid === 'sugar' ? '#fff3dc' : '#ffffff'; ctx.strokeStyle = 'rgba(19,35,63,.5)'; ctx.lineWidth = px(0.8); ctx.beginPath(); var h = Math.min(1.6, 0.3 + Math.sqrt(it.props.g) * 0.4), w = Math.min(2.4, 0.6 + Math.sqrt(it.props.g) * 0.5); ctx.moveTo(it.x - w, it.y + 0.35); ctx.quadraticCurveTo(it.x, it.y + 0.35 + h * 2, it.x + w, it.y + 0.35); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  }
  function drawJar(it) {
    var jar = sprite('salt_jar');
    if (jar) {   // 罐子是 GPT 畫的；標籤文字由程式寫（砂糖罐也長得一樣：要看標籤，這就是陷阱）
      var jw = 6.6, jh = jw * jar.naturalHeight / jar.naturalWidth; shadowOn(5); drawSprite(jar, it.x, it.y, jw, jh, 0); shadowOff();
      label(it.x, it.y + jh * 0.43, TY[it.type].solid === 'sugar' ? '砂糖' : '氯化鈉', { size: 11, color: '#13233f', weight: 900, inset: true });
      label(it.x, it.y + jh * 0.355, TY[it.type].solid === 'sugar' ? 'C₁₂H₂₂O₁₁' : 'NaCl', { size: 9.5, color: '#13233f', weight: 700, inset: true });
      return;
    }
    shadowOn(5); rrect(it.x - 3, it.y, it.x + 3, it.y + 7, 0.6); fs('rgba(225,240,255,.3)', null); shadowOff();
    ctx.fillStyle = TY[it.type].solid === 'sugar' ? '#fff3dc' : '#ffffff'; ctx.fillRect(it.x - 2.8, it.y + 0.2, 5.6, 3.6);
    rrect(it.x - 3, it.y, it.x + 3, it.y + 7, 0.6); fs(null, '#0b1528', 1.4);
    rrect(it.x - 3.3, it.y + 7, it.x + 3.3, it.y + 8.2, 0.3); fs(TY[it.type].solid === 'sugar' ? '#c9893a' : '#2f6db5', '#0b1528', 1.2);
    rrect(it.x - 2.4, it.y + 4.2, it.x + 2.4, it.y + 6.4, 0.2); fs('#fffdf6', '#0b1528', 0.8);
    label(it.x, it.y + 5.6, TY[it.type].solid === 'sugar' ? '砂糖' : '氯化鈉', { size: 10, color: '#13233f', weight: 900, inset: true });
    label(it.x, it.y + 4.7, TY[it.type].solid === 'sugar' ? 'C₁₂H₂₂O₁₁' : 'NaCl', { size: 9, color: '#13233f', weight: 700, inset: true });
  }
  function balReading(b) {
    var on = S.items.filter(function (i) { return i.dock && i.dock.mode === 'pan'; }), m = 0;
    on.forEach(function (i) { m += TY[i.type].mass || 0; if (i.props.g) m += i.props.g; if (i.sol) m += i.sol.waterG + i.sol.n.NaCl * CM.MW.NaCl + i.sol.n.HCl * CM.MW.HCl + i.sol.solid; });
    return m - b.props.tare;
  }
  function drawBalance(it) {
    shadowOn(6); rrect(it.x - 7, 0, it.x + 7, 4.4, 0.6); fs(grad(0, 4.4, 0, 0, [[0, '#eef2f6'], [1, '#aab4bf']]), '#0b1528', 1.6); shadowOff();
    rrect(it.x - 5.6, 0.9, it.x + 0.6, 3.4, 0.3); fs('#13301f', '#0b1528', 1.2);
    var r = balReading(it); label(it.x - 2.5, 2.15, (Math.abs(r) < 0.005 ? '0.00' : f2(r)) + ' g', { size: 14, color: '#7dff9e', weight: 900, mono: true });
    ctx.fillStyle = '#ffd84d'; ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1.2); rrect(it.x + 2, 1.2, it.x + 5.4, 3.1, 0.3); ctx.fill(); ctx.stroke();
    label(it.x + 3.7, 2.15, '歸零', { size: 10, color: '#13233f', weight: 900, inset: true });
    rrect(it.x - 5.2, 4.4, it.x + 5.2, PAN_Y, 0.2); fs('#c9d2dc', '#0b1528', 1.2);
  }
  function drawBurette(it) {
    var b = BUR, x = it.x;
    // 鐵架：底座、立柱、夾子
    rrect(x - 9, 0, x + 3, 0.9, 0.2); fs('#2e3843', '#0b1528', 1.2);
    ctx.fillStyle = '#7d8a98'; ctx.fillRect(x - 7.6, 0.9, 0.5, b.g0 + 3); ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1); ctx.strokeRect(x - 7.6, 0.9, 0.5, b.g0 + 3);
    rrect(x - 7.6, b.g0 - 6, x - 0.4, b.g0 - 5.2, 0.15); fs('#56626e', '#0b1528', 1);
    // 管子
    ctx.fillStyle = 'rgba(230,242,255,.3)'; ctx.fillRect(x - b.r, b.tip + 2.2, 2 * b.r, b.g0 + 3 - b.tip - 2.2);
    var my = burY(it.props.read); ctx.fillStyle = 'rgba(215,235,252,.55)'; ctx.fillRect(x - b.r + 0.05, b.tip + 2.2, 2 * b.r - 0.1, my - b.tip - 2.2);
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = px(1.2); ctx.beginPath(); ctx.moveTo(x - b.r + 0.05, my + 0.08); ctx.quadraticCurveTo(x, my - 0.05, x + b.r - 0.05, my + 0.08); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = px(1.5); ctx.strokeRect(x - b.r, b.tip + 2.2, 2 * b.r, b.g0 + 3 - b.tip - 2.2); ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(0.8); ctx.strokeRect(x - b.r, b.tip + 2.2, 2 * b.r, b.g0 + 3 - b.tip - 2.2);
    for (var v = 0; v <= 500; v++) {
      var vv = v / 10, yy = burY(vv), isInt = v % 10 === 0;
      if (view.s < 30 && !isInt) continue;
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = px(isInt ? 1.1 : 0.6); ctx.beginPath(); ctx.moveTo(x - b.r, yy); ctx.lineTo(x - b.r + (isInt ? (vv % 5 === 0 ? 0.55 : 0.4) : 0.2), yy); ctx.stroke();
      if (isInt && (vv % 10 === 0 || view.s > 25)) label(x + b.r + 0.2, yy, String(vv), { size: 8.5, color: '#fff', weight: 800, align: 'left' });
    }
    // 活栓與管尖
    path([P(x - 0.25, b.tip + 2.2), P(x + 0.25, b.tip + 2.2), P(x + 0.1, b.tip), P(x - 0.1, b.tip)]); fs('rgba(230,242,255,.5)', '#0b1528', 0.8);
    var o = it.props.open, sc = P(x, b.tip + 1.3);
    ctx.fillStyle = '#e9eef4'; ctx.beginPath(); ctx.arc(sc.x, sc.y, 0.45, 0, 7); ctx.fill(); ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1); ctx.stroke();
    var ang = o * Math.PI / 2; ctx.strokeStyle = '#3c8dde'; ctx.lineWidth = Math.max(px(5), 0.45); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sc.x - Math.cos(ang) * 1.5, sc.y - Math.sin(ang) * 1.5); ctx.lineTo(sc.x + Math.cos(ang) * 1.5, sc.y + Math.sin(ang) * 1.5); ctx.stroke(); ctx.lineCap = 'butt';
    knob(stopcockKnob(it), '#3c8dde', 'cock');
    label(x - 3.8, b.g0 - 7.4, 'NaOH 0.100 mol/L', { size: 10, color: '#fff', weight: 900, stroke: '#13233f' });
  }
  function burY(read) { return BUR.g0 - (BUR.g0 - BUR.g50) * read / 50; }
  function stopcockKnob(it) { var o = it.props.open, ang = o * Math.PI / 2; return P(it.x + Math.cos(ang) * 1.5, BUR.tip + 1.3 + Math.sin(ang) * 1.5); }
  function drawDropBottle(it) {
    shadowOn(5); rrect(it.x - 1.8, it.y, it.x + 1.8, it.y + 5.6, 0.4); fs('#7a4a1e', '#0b1528', 1.3); shadowOff();
    rrect(it.x - 0.7, it.y + 5.6, it.x + 0.7, it.y + 7, 0.2); fs('#2b3442', '#0b1528', 1);
    ctx.fillStyle = '#d63b2f'; ctx.beginPath(); ctx.ellipse(it.x, it.y + 7.9, 0.7, 1, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#0b1528'; ctx.lineWidth = px(1); ctx.stroke();
    rrect(it.x - 1.5, it.y + 1.5, it.x + 1.5, it.y + 3.8, 0.2); fs('#fffdf6', null);
    label(it.x, it.y + 2.65, '酚酞', { size: 10, color: '#13233f', weight: 900, inset: true });
  }
  function drawLamp(it) {
    shadowOn(5); ctx.beginPath(); ctx.moveTo(it.x - 3, it.y); ctx.lineTo(it.x + 3, it.y); ctx.quadraticCurveTo(it.x + 3.2, it.y + 4, it.x + 1, it.y + 4.6); ctx.lineTo(it.x - 1, it.y + 4.6); ctx.quadraticCurveTo(it.x - 3.2, it.y + 4, it.x - 3, it.y); fs('rgba(225,240,255,.4)', '#0b1528', 1.3); shadowOff();
    rrect(it.x - 0.9, it.y + 4.6, it.x + 0.9, it.y + 6.2, 0.2); fs('#56626e', '#0b1528', 1);
  }
  function drawStopper(it) { path([P(it.x - 0.9, it.y), P(it.x + 0.9, it.y), P(it.x + 1.1, it.y + 1.4), P(it.x - 1.1, it.y + 1.4)]); fs('#e9eef4', '#0b1528', 1.2); }

  function drawItem(it) {
    var k = TY[it.type].kind;
    if (k === 'cont' || k === 'washer') drawGlass(it);
    else if (k === 'pipette') { drawPipette(it); if (S.sel === it || it.dock) knob(P(it.x, it.y + PIPE.len + 1.1), 'rgba(0,0,0,0)', 'bulb'); }
    else if (k === 'rod') drawRod(it);
    else if (k === 'spatula') drawSpatula(it);
    else if (k === 'paper') drawPaper(it);
    else if (k === 'jar') drawJar(it);
    else if (k === 'balance') drawBalance(it);
    else if (k === 'burette') drawBurette(it);
    else if (k === 'dropbottle') drawDropBottle(it);
    else if (k === 'lamp') drawLamp(it);
    else if (k === 'stopper') drawStopper(it);
  }
  function drawStreams() {
    S.items.forEach(function (it) {
      var rate = it._rate || 0; if (rate <= 0.01) return;
      var from, to;
      if (it.dock && it.dock.mode === 'pour') { from = lipWorld(it); var d = byUid(it.dock.to); to = P(d.x, d.y + Math.max(0.5, CM.levelOf(shapeOf(d), d.sol.v))); }
      else if (it.dock && it.dock.mode === 'over' && TY[it.type].kind === 'washer') { from = washerNozzle(it); var d2 = byUid(it.dock.to); to = P(d2.x, d2.y + Math.max(0.5, CM.levelOf(shapeOf(d2), d2.sol.v))); }
      else return;
      ctx.strokeStyle = solColor(it).replace(/[\d.]+\)$/, '.9)'); ctx.lineWidth = Math.max(px(2.5), Math.min(0.7, 0.08 + rate * 0.03)); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.quadraticCurveTo(from.x + (to.x - from.x) * 0.15, from.y, to.x, to.y); ctx.stroke(); ctx.lineCap = 'butt';
    });
  }
  function drawLive() {
    S.items.forEach(function (it) {
      if (!it.dock || !(it._shown > 0.004)) return;
      var k = TY[it.type].kind, at;
      if (it.dock.mode === 'pour' && k === 'cont') at = lipWorld(it);
      else if (it.dock.mode === 'over' && k === 'washer') at = washerNozzle(it);
      else return;
      label(at.x, at.y + 1.6, (k === 'washer' ? '已擠 ' : '已倒 ') + (it._shown < 10 ? f2(it._shown) : f1(it._shown)) + ' mL', { size: 14, color: '#ffd84d', weight: 900, stroke: '#13233f' });
    });
  }
  function drawFx() {
    S.fx.forEach(function (f) { ctx.globalAlpha = Math.max(0, 1 - f.t / f.life); ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill(); });
    ctx.globalAlpha = 1;
  }
  var zoomDraw = false;
  function drawScene(isZoom) {
    labels = []; zoomDraw = !!isZoom;
    drawRoom();
    var order = S.items.slice().sort(function (a, b) { return zOf(a) - zOf(b); });
    drawRack();
    order.forEach(drawItem);
    drawStreams(); drawFx(); if (!isZoom) drawLive();
    if (!isZoom && drag && drag.kind === 'move' && drag.moved) { var tg = pourTarget(drag.it); if (tg) { var bt = boxOf(tg); ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = px(3); ctx.strokeRect(bt.x0 - 0.3, bt.y0 - 0.3, bt.x1 - bt.x0 + 0.6, bt.y1 - bt.y0 + 0.6); label(tg.x, bt.y1 + 1.4, '放手就架到這裡', { size: 12, color: '#ffd84d', weight: 900, stroke: '#13233f' }); } }
    if (!isZoom && S.sel) { var b = boxOf(S.sel), si = S.sel; ctx.setLineDash([px(6), px(4)]); ctx.strokeStyle = '#fff'; ctx.lineWidth = px(2); path([[b.x0 - 0.3, b.y0 - 0.3], [b.x1 + 0.3, b.y0 - 0.3], [b.x1 + 0.3, b.y1 + 0.3], [b.x0 - 0.3, b.y1 + 0.3]].map(function (q) { return toWorld(si, P(q[0] - si.x, q[1] - si.y)); })); ctx.stroke(); ctx.setLineDash([]); }
    flushLabels(isZoom);
  }
  function zOf(it) {   // 畫的先後與點選的優先順序：工具在最上面
    var k = TY[it.type].kind;
    if (k === 'balance' || k === 'burette') return 0;
    if (k === 'jar' || k === 'dropbottle' && !it.dock || k === 'lamp') return 1;
    if ((k === 'cont' || k === 'washer') && !it.dock) return 1;
    if (k === 'paper') return 2;
    if (k === 'cont' || k === 'washer' || k === 'dropbottle') return 3;
    if (k === 'stopper') return 4;
    return 5;
  }
  function flushLabels() {
    screenTf();
    labels.forEach(function (l) {
      var p = w2s(P(l.x, l.y)), o = l.o, size = o.size || 12;
      if (o.inset) { size = Math.min(size, view.s * 0.85); if (size < 6) return; }   // 貼在器材上的字跟著縮放，太小就不畫
      ctx.font = (o.weight || 600) + ' ' + size + 'px ' + (o.mono ? 'ui-monospace,Consolas,monospace' : '"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif');
      ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
      if (o.stroke) { ctx.lineWidth = 3.5; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(l.t, p.x, p.y); }
      ctx.fillStyle = o.color || '#fff'; ctx.fillText(l.t, p.x, p.y);
    });
  }
  // 放大鏡：選到量具時，右邊顯示液面附近放大 5 倍
  function zoomFocus(it) {
    if (!it) return null;
    var t = TY[it.type];
    if (t.measure === 'cyl' && it.sol && !it.tilt) return P(it.x - shapeOf(it).segs[1][1] * 0.45, it.y + CM.levelOf(shapeOf(it), Math.max(it.sol.v, 1)));   // 往左偏，刻度和數字才看得到
    if (t.measure === 'vol' && !it.tilt) return P(it.x, it.y + CM.levelOf(shapeOf(it), 100));
    if (t.kind === 'pipette') return P(it.x, pipeY(it, it.sol.v));
    if (t.kind === 'burette') return P(it.x, burY(it.props.read));
    return null;
  }
  function draw() {
    setView(mainView()); drawScene(false);
    var it = S.sel, fp = zoomFocus(it);
    if (fp) {
      var R = Math.max(54, Math.min(84, H * 0.2, W * 0.19)), cx = W - R - 58, cy = 10 + R;
      if (H > W && !dataBox.hidden) cy = dataBox.offsetTop + dataBox.offsetHeight + 8 + R;   // 直式：放在紀錄卡下面，不要疊在一起
      screenTf(); ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
      setView({ s: cam.s * (TY[it.type].kind === 'burette' ? 7 : 5), cx: fp.x, cy: fp.y, ox: cx, oy: cy });
      drawScene(true);
      screenTf(); ctx.restore();
      ctx.strokeStyle = '#13233f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,216,77,.7)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = '800 11px "PingFang TC","Microsoft JhengHei",sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('放大鏡（讀凹液面最低點）', cx, cy + R + 14);
      setView(mainView());
    }
  }

  // ---------- 流動：傾倒、擠洗瓶、滴定管 ----------
  function film(it) { return TY[it.type].film || 0; }
  function capOf(it) { var s = shapeOf(it); CM.shapeTable(s); return CM.shapeTable(s)[CM.shapeTable(s).length - 1].v; }
  function isConc(sol) { return CM.concFrac(sol) > 0.3; }
  function move(src, dst, vol, how) {   // 回傳實際移動量；危險就直接失敗
    if (S.over || vol <= 0) return 0;
    var a = src.sol, d = dst.sol;
    if (isConc(a) && level.ppe && (!S.ppe.goggles || (level.ppe === true && !S.ppe.gloves))) { danger('ppe'); return 0; }
    if (CM.concFrac(d) > 0.5 && d.v >= 0.5 && CM.concFrac(a) < 0.2 && a.n.HCl / Math.max(a.v / 1000, 1e-9) < 1) { danger('splash'); return 0; }
    var avail = Math.max(0, a.v - (how === 'pour' ? film(src) : 0));
    var v = Math.min(vol, avail); if (v <= 0) return 0;
    var moved = CM.transfer(a, d, v);
    if (isCont(dst) && dst.sol.v > capOf(dst)) { var over = dst.sol.v - capOf(dst), lost = new CM.Sol(); CM.transfer(dst.sol, lost, over); src._pourLeft = 0; src._washLeft = 0; src._holdPour = false; src._squeeze = false; if (src.dock && src.dock.mode === 'pour') src.tilt = restTilt(src); if (!dst._fullWarn || S.t - dst._fullWarn > 2) { dst._fullWarn = S.t; toast(nameOf(dst) + '滿出來了！'); sfx('warn'); } }
    if (src.dock && src.dock.to === dst.uid) src._shown = (src._shown || 0) + moved;
    if (S.session && S.session.src === src.uid && S.session.dst === dst.uid) S.session.v += moved;
    else { endSession(); S.session = { src: src.uid, dst: dst.uid, v: moved, how: how }; }
    trackSpecial(src, dst, how);
    return moved;
  }
  function trackSpecial(src, dst, how) {
    if (no === 2) {
      if (src.type === 'bottle' && src.props.reagent === 'concHCl') S.acidBy = S.acidBy || (how === 'pipette' ? 'pipette' : 'pour');
      if (src.type === 'cyl50' && isConc(src.sol)) S.acidBy = 'cyl';
      if (TY[src.type].kind === 'washer' && dst.type === 'beaker250' && S.beakerToFlask > 0) S.washSinceTransfer = true;
      if (src.type === 'beaker250' && dst.type === 'vol100') { if (S.washSinceTransfer) { S.rinses++; S.washSinceTransfer = false; } S.beakerToFlask++; }
    }
    if (no === 3 && dst.type === 'conical' && TY[src.type].kind !== 'washer') S.sampleBy = TY[src.type].kind === 'pipette' && S.sampleBy !== 'pour' ? 'pipette' : 'pour';
  }
  function endSession() {
    var s = S.session; S.session = null; if (!s || s.v < 0.005) return;
    var a = byUid(s.src), b = byUid(s.dst); if (!a || !b) return;
    var key = s.src + '>' + s.dst;
    if (S.lastKey === key && S.log.length) { S.lastV += s.v; S.log.pop(); } else { S.lastKey = key; S.lastV = s.v; }   // 連續同一組合併成一行
    logStep(nameOf(a) + ' → ' + nameOf(b) + '：' + approx(S.lastV));
  }
  // 紀錄卡、工具列只給大約的量（精確的要自己讀刻度）：20 mL 以下到 1 mL，以上到 5 mL
  function approx(v) { return v < 0.05 ? '空的' : v < 0.95 ? '幾滴' : '約 ' + (v < 20 ? Math.round(v) : Math.round(v / 5) * 5) + ' mL'; }
  function nameOf(it) { if (it.props.reagent && CM.REAGENTS[it.props.reagent] && (it.type === 'bottle' || it.type === 'naoh')) return CM.REAGENTS[it.props.reagent].name; return TY[it.type].name; }
  function pourA0(it) { return (1 - Math.min(1, it.sol.v / capOf(it))) * 95; }   // 傾斜超過這個角度才開始倒（裝越滿越早）
  function pourRate(it) { return clamp((it.tilt - pourA0(it)) * TY[it.type].rate, 0, 30); }   // 傾斜越多倒越快
  function restTilt(it) { return TY[it.type].kind === 'paper' ? 0 : clamp(pourA0(it) - 8, 0, 70); }   // 架在杯口時先斜靠著、還不會倒
  function step(dt) {
    S.t += dt;
    S.items.forEach(function (it) {
      it._rate = 0;
      if (it.flash > 0) it.flash -= dt * 1.2;
      if (it.dock && it.dock.mode === 'pour') {
        var forced = it._holdPour || it._pourLeft > 0 || it._dumpAll;
        if (!it._holdKnob && !forced) { var rt = restTilt(it); it.tilt = it.tilt > rt ? Math.max(rt, it.tilt - 140 * dt) : Math.min(rt, it.tilt + 90 * dt); }
        if (TY[it.type].kind === 'paper') {
          var dst = byUid(it.dock.to);
          if (it._dumpAll) { it.tilt = Math.min(70, it.tilt + 160 * dt); if (it.props.g <= 0) it._dumpAll = false; }
          if (it.tilt > 35 && it.props.g > 0) { var g = Math.min(it.props.g, 15 * dt); if (it.props.g - g < 0.005) g = it.props.g; dst.sol.solid += g; dst.sol.solidKind = it.props.solid; it.props.g -= g; it._poured = (it._poured || 0) + g; if (it.props.solid === 'sugar') dst.sol.sugar = true; if (Math.random() < dt * 4) sfx('pour'); }
          if (it._poured > 0 && (it.props.g <= 0 || it.tilt <= 35)) { logStep('稱量紙上的' + (it.props.solid === 'sugar' ? '糖' : '食鹽') + ' ' + f2(it._poured) + ' g 倒進' + nameOf(dst)); it._poured = 0; }
        } else {
          var d = byUid(it.dock.to);
          if (forced) {   // 按住倒／倒固定的量：越按越快（最快每秒 30 mL），傾斜角度跟著流量變
            it._holdT = (it._holdT || 0) + dt;
            var want = it._holdPour ? Math.min(30, 3 + it._holdT * 9) : Math.min(15, Math.max(1.5, it._pourLeft * 3)), amt = want * dt;
            if (!it._holdPour) amt = Math.min(amt, it._pourLeft);
            var mvF = move(it, d, amt, 'pour'); it._rate = mvF / dt;
            it.tilt = Math.min(125, Math.max(it.tilt - 120 * dt, pourA0(it) + 6 + want * 1.6));
            if (!it._holdPour) { it._pourLeft = mvF > 1e-9 ? it._pourLeft - mvF : 0; if (it._pourLeft <= 1e-6) { it._pourLeft = 0; it._holdT = 0; it.tilt = restTilt(it); endSession(); } }
            if (mvF <= 1e-9 && !it._emptyWarn) { it._emptyWarn = true; toast(nameOf(it) + '倒不出來了（倒光了）'); }
            if (mvF > 0 && Math.random() < dt * 3) sfx('pour');
          } else {
            var r = pourRate(it);
            if (r > 0) { var mv = move(it, d, r * dt, 'pour'); it._rate = mv / dt; if (mv > 0 && Math.random() < dt * 3) sfx('pour'); }
          }
        }
      }
      if (TY[it.type].kind === 'washer' && it.dock && (it._squeeze || it._washLeft > 0)) {
        var d2 = byUid(it.dock.to), amt2 = it._squeeze ? 4 * dt : Math.min(it._washLeft, 6 * dt), mv2 = move(it, d2, amt2, 'wash'); it._rate = mv2 / dt;
        if (!it._squeeze) { it._washLeft = mv2 > 1e-9 ? it._washLeft - mv2 : 0; if (it._washLeft <= 1e-6) { it._washLeft = 0; endSession(); } }
      }
      if (it.type === 'burette' && it.props.open > 0) {
        var rate = it.props.open * it.props.open * 1.6, dv = Math.min(rate * dt, 50 - it.props.read);
        if (dv > 0) { it.props.read += dv; it._acc = (it._acc || 0) + dv; while (it._acc > 0.05) { it._acc -= 0.05; S.fx.push({ x: it.x, y: BUR.tip - 0.3, vx: 0, vy: -20, t: 0, life: 0.5, r: 0.18, c: 'rgba(200,228,255,.9)' }); } burDeliver(it, dv); }
      }
      if (it.sol && isCont(it)) {
        var stir = it._stir > 0; if (stir) it._stir -= dt;
        var dd = CM.dissolve(it.sol, dt, stir);
        if (stir || it._swirl > 0) it.sol.mixed = Math.min(1, it.sol.mixed + dt * 0.8);
        if (it._swirl > 0) it._swirl -= dt;
      }
    });
    S.fx.forEach(function (f) { f.t += dt; f.x += (f.vx || 0) * dt; f.y += (f.vy || 0) * dt; });
    S.fx = S.fx.filter(function (f) { return f.t < f.life; });
  }
  function underBurette() { var b = burette(); if (!b) return null; return S.items.filter(function (i) { return i.dock && i.dock.mode === 'under'; })[0] || null; }
  function burDeliver(b, dv) {
    var f = underBurette();
    if (!f) { if (!b._spillWarn) { b._spillWarn = true; toast('滴定管下面沒有容器接，溶液滴到桌上了'); sfx('warn'); } return; }
    var drop = CM.fromReagent('NaOH01', dv); CM.transfer(drop, f.sol, dv); f.flash = Math.max(f.flash || 0, 1);
    S.totalNaOH = (S.totalNaOH || 0) + dv;
  }

  // ---------- 危險、提示 ----------
  var ICON = {
    splash: '<svg viewBox="0 0 200 200" width="200" height="200" aria-hidden="true"><path d="M100 11 L115 43 L146 17 L141 58 L179 49 L160 81 L189 93 L166 112 L183 136 L154 141 L159 171 L129 159 L123 194 L100 173 L78 192 L71 160 L35 177 L42 144 L9 138 L36 112 L5 92 L43 82 L16 46 L58 56 L58 24 L85 44Z" fill="#e5484d" stroke="#1d2a36" stroke-width="5" stroke-linejoin="round"/><path d="M117 36 L125 58 L145 53 L142 75 L169 78 L149 98 L172 113 L143 121 L155 142 L132 140 L134 170 L112 152 L100 174 L88 153 L67 167 L68 140 L38 147 L52 122 L31 112 L50 98 L32 78 L56 74 L51 48 L78 61 L82 29 L100 57Z" fill="#ffd23f"/><g transform="rotate(-8 100 150)"><path d="M82 106 C74 92 62 84 48 80 C62 76 74 80 82 86 C76 70 68 58 58 48 C74 52 86 64 90 80 C90 62 94 46 100 30 C106 46 110 62 110 80 C114 64 126 52 142 48 C132 58 124 70 118 86 C126 80 138 76 152 80 C138 84 126 92 118 106 Z" fill="#f6a03a" stroke="#1d2a36" stroke-width="4" stroke-linejoin="round"/><path d="M76 104 h48 l-4 52 h-40 z" fill="#fff" stroke="#1d2a36" stroke-width="5" stroke-linejoin="round"/><path d="M79 124 h42 l-2.4 30 h-37.2 z" fill="#f6a03a"/></g></svg>',
    danger: '<svg viewBox="0 0 200 200" width="200" height="200" aria-hidden="true"><path d="M100 11 L115 43 L146 17 L141 58 L179 49 L160 81 L189 93 L166 112 L183 136 L154 141 L159 171 L129 159 L123 194 L100 173 L78 192 L71 160 L35 177 L42 144 L9 138 L36 112 L5 92 L43 82 L16 46 L58 56 L58 24 L85 44Z" fill="#e5484d" stroke="#1d2a36" stroke-width="5" stroke-linejoin="round"/><path d="M117 36 L125 58 L145 53 L142 75 L169 78 L149 98 L172 113 L143 121 L155 142 L132 140 L134 170 L112 152 L100 174 L88 153 L67 167 L68 140 L38 147 L52 122 L31 112 L50 98 L32 78 L56 74 L51 48 L78 61 L82 29 L100 57Z" fill="#ffd23f"/><path d="M86 40 h28 l-5 74 h-18 z" fill="#1d2a36"/><circle cx="100" cy="136" r="13" fill="#1d2a36"/></svg>'
  };
  function danger(kind) {
    if (S.over) return; S.over = true;
    var t = kind === 'splash' ? ['強酸飛濺！', '你把水倒進濃鹽酸裡。水碰到濃酸會劇烈放熱，把酸噴出來，可能噴到眼睛和皮膚。要「酸加入水」：先在燒杯放水，再把酸慢慢加進去。']
      : kind === 'ppe' ? ['先做好防護！', '濃鹽酸有腐蝕性，取用時可能噴濺。要先戴好護目鏡' + (level.ppe === true ? '和耐酸手套' : '') + '（點器材櫃的圖示就會戴上）。']
      : ['危險！', '這個操作很危險。'];
    sfx('danger'); if (kind === 'splash') sfx('splash', 0.04);
    var ov = $('#ov'); ov.classList.add('danger');
    $('#sheet').className = 'sheet fail';
    $('#sheet').innerHTML = '<div class="fail-ico">' + (kind === 'splash' ? ICON.splash : ICON.danger) + '</div><h2>' + t[0] + '</h2><p>' + t[1] + '</p><div class="row"><a class="go" href="chem.html?lv=' + no + '">重來</a></div>';
    ov.classList.add('show');
    if (navigator.vibrate) { try { navigator.vibrate([90, 50, 160]); } catch (e) { /* 不支援就算了 */ } }
  }
  var toastT = 0;
  function toast(t) { var el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, 2600); }
  function logStep(t) { if (t.indexOf(' → ') < 0) S.lastKey = null; S.log.push(t); if (S.log.length > 40) S.log.shift(); renderData(); }
  function renderData() {
    var n = window.matchMedia && window.matchMedia('(orientation: landscape) and (max-height: 560px)').matches ? 2 : 3;
    var h = S.log.slice(-n).map(function (t, i, a) { return (S.log.length - a.length + i + 1) + '. ' + t; }).join('<br>');
    if (no === 3) { var b = burette(); if (b) h = (h ? h + '<br>' : '') + '（滴定管讀數要自己從放大鏡讀）'; }
    var ppe = '';
    if (level.ppe) { var ok = S.ppe.goggles && (level.ppe !== true || S.ppe.gloves); ppe = '<span class="' + (ok ? 'hit' : 'miss') + '">防護：' + (S.ppe.goggles ? '✓' : '✗') + '護目鏡' + (level.ppe === true ? '　' + (S.ppe.gloves ? '✓' : '✗') + '手套' : '') + '</span><br>'; }
    dataBox.innerHTML = ppe + (h || '你的每一步都會記在這裡。'); dataBox.hidden = false;
  }
  function renderPPE() { renderData(); }   // 防護狀態顯示在紀錄卡第一行

  // ---------- 點選、拖曳 ----------
  var ptrs = new Map(), drag = null;
  function evPos(e) { var r = cv.getBoundingClientRect(); return P(e.clientX - r.left, e.clientY - r.top); }
  function partAt(p) {   // 好幾個圓鈕都在手指範圍內時，選最近的那個（例如吸量管的吸球和酚酞瓶的滴頭靠得很近）
    var tol = Math.max(0.9, 26 / cam.s), best = null, bd = 1e9;
    function cand(it, part, q, r) { var d = Math.hypot(p.x - q.x, p.y - q.y); if (d < (r || tol) && d < bd) { bd = d; best = { it: it, part: part }; } }
    for (var i = S.items.length - 1; i >= 0; i--) {
      var it = S.items[i], k = TY[it.type].kind;
      if (it.dock && it.dock.mode === 'pour') cand(it, 'pour', pourKnob(it));
      if (k === 'washer') cand(it, 'squeeze', washerKnob(it));
      if (k === 'pipette' && it.dock) cand(it, 'bulb', P(it.x, it.y + PIPE.len + 1.1));
      if (k === 'burette') { cand(it, 'cock', stopcockKnob(it)); cand(it, 'cock', P(it.x, BUR.tip + 1.3), tol * 0.8); }
      if (k === 'balance' && p.x > it.x + 1.6 && p.x < it.x + 5.8 && p.y > 0.8 && p.y < 3.5) return { it: it, part: 'tare' };
      if (k === 'dropbottle' && it.dock) cand(it, 'drop', P(it.x, it.y + 7.9));
    }
    return best;
  }
  function unTilt(it, p) {   // 世界座標 → 器材直立時的座標（toWorld 的反運算）
    if (!it.tilt) return p;
    var pv = pivotLocal(it), dir = it.dock && it.dock.dir || 1, a = dir * it.tilt * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    var dx = p.x - it.x - pv.x, dy = p.y - it.y - pv.y;
    return P(it.x + pv.x + dx * c - dy * s, it.y + pv.y + dx * s + dy * c);
  }
  function itemAt(p) {
    // 點到好幾個時：先比前後（zOf），一樣前面的就選離手指最近的那個（工具架上並排的工具才分得開）
    var best = null, bz = -1e9, bd = 1e9;
    S.items.forEach(function (it) { var b = boxOf(it), q = unTilt(it, p); if (!inBox(q, b, Math.max(0.2, 8 / cam.s))) return; var z = zOf(it), d = inBox(q, b, 0) ? 0 : 1; d += Math.abs(q.x - (b.x0 + b.x1) / 2) / 100; if (z > bz || (z === bz && d < bd)) { best = it; bz = z; bd = d; } });
    return best;
  }
  function select(it) { S.sel = it; buildToolbar(); }
  cv.addEventListener('pointerdown', function (e) {
    if (S.over) return;
    var sp = evPos(e); ptrs.set(e.pointerId, sp);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件 */ }
    if (ptrs.size === 2) { var a = Array.from(ptrs.values()); drag = { kind: 'pinch', d0: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), s0: cam.s, w: s2w((a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2) }; return; }
    var p = s2w(sp.x, sp.y), pt = partAt(p);
    if (pt) {
      var it = pt.it; select(it);
      if (pt.part === 'pour') { it._holdKnob = true; drag = { kind: 'pour', it: it, y0: p.y, t0: it.tilt }; return; }
      if (pt.part === 'squeeze') { if (!it.dock) { toast('先把洗瓶拖到容器上方'); return; } it._squeeze = true; drag = { kind: 'squeeze', it: it, t0: Date.now() }; sfx('pour'); return; }
      if (pt.part === 'bulb') { drag = { kind: 'bulb', it: it, y: p.y }; return; }
      if (pt.part === 'cock') { drag = { kind: 'cock', it: it, x0: p.x, o0: it.props.open, t0: Date.now(), moved: false }; return; }
      if (pt.part === 'tare') { it.props.tare += balReading(it); sfx('ui_tap'); logStep('電子秤歸零'); return; }
      if (pt.part === 'drop') { addDrop(it); return; }
    }
    var hit = itemAt(p);
    if (hit) {
      select(hit);
      var k = TY[hit.type].kind;
      if (k === 'rod' && hit.dock) { drag = { kind: 'stir', it: hit, x: p.x }; return; }
      if (hit.fixedPlace || k === 'balance' || k === 'burette' || k === 'jar') { drag = { kind: 'none' }; return; }
      drag = { kind: 'move', it: hit, dx: hit.x - p.x, dy: hit.y - p.y, moved: false, ox: hit.x, oy: hit.y, sx: p.x, sy: p.y };
      return;
    }
    select(null);
    drag = { kind: 'pan', sx: sp.x, sy: sp.y, cx: cam.x, cy: cam.y };
  });
  cv.addEventListener('pointermove', function (e) {
    if (!ptrs.has(e.pointerId) || !drag) return;
    var sp = evPos(e); ptrs.set(e.pointerId, sp);
    var p = s2w(sp.x, sp.y), it = drag.it;
    if (drag.kind === 'pinch' && ptrs.size === 2) { var a = Array.from(ptrs.values()), d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); cam.s = clamp(drag.s0 * d / drag.d0, cam.fit * 0.7, cam.fit * 5); cam.user = true; var c = P((a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2); cam.x = drag.w.x - (c.x - W / 2) / cam.s; cam.y = drag.w.y - (H / 2 - c.y) / cam.s; return; }
    if (drag.kind === 'pan') { if (cam.s > cam.fit * 1.02) { cam.x = drag.cx - (sp.x - drag.sx) / cam.s; cam.y = drag.cy + (sp.y - drag.sy) / cam.s; cam.user = true; } return; }
    if (drag.kind === 'move') {
      if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) < Math.max(0.3, 6 / cam.s)) return;   // 點一下只是選取，不拿起來
      if (!drag.moved) { drag.moved = true; undock(it); it._held = true; it._rack = false; if (TY[it.type].kind === 'pipette' || TY[it.type].kind === 'rod' || TY[it.type].kind === 'spatula') { drag.dx = 0; drag.dy = -4; } sfx('item_pick'); }
      it.x = p.x + drag.dx; it.y = Math.max(0, p.y + drag.dy); return;
    }
    if (drag.kind === 'pour') { it.tilt = clamp(drag.t0 + (drag.y0 - p.y) * 9, 0, 125); return; }
    if (drag.kind === 'bulb') { var dy = p.y - drag.y; drag.y = p.y; pipetteBy(it, dy * 0.8); return; }
    if (drag.kind === 'cock') { var o = clamp(drag.o0 + (p.x - drag.x0) * 0.4, 0, 1); if (Math.abs(p.x - drag.x0) > 0.2) drag.moved = true; it.props.open = Math.round(o * 20) / 20; return; }
    if (drag.kind === 'stir') { if (Math.abs(p.x - drag.x) > 0.25) { var c2 = byUid(it.dock.to); if (c2) { c2._stir = 0.5; if (!c2._stirLogged) { c2._stirLogged = true; logStep('用玻璃棒攪拌' + nameOf(c2)); } } drag.x = p.x; it.x = clamp(p.x, c2.x - 1.2, c2.x + 1.2); } }
  });
  function endPtr(e) {
    ptrs.delete(e.pointerId);
    var d = drag; drag = null; if (!d) return;
    var it = d.it;
    if (d.kind === 'pour') { it._holdKnob = false; if (TY[it.type].kind !== 'paper') it.tilt = Math.min(it.tilt, restTilt(it)); endSession(); }
    if (d.kind === 'squeeze') { it._squeeze = false; if (Date.now() - d.t0 < 220 && it.dock) { var dst = byUid(it.dock.to); move(it, dst, 0.05, 'wash'); } endSession(); }
    if (d.kind === 'bulb') endSession();
    if (d.kind === 'cock' && !d.moved && Date.now() - d.t0 < 300) { if (d.o0 > 0) { it.props.open = 0; toast('活栓關上了'); } else oneDrop(it); }
    if (d.kind === 'move' && d.moved) { it._held = false; place(it); }
    buildToolbar();
  }
  cv.addEventListener('pointerup', endPtr);
  cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('wheel', function (e) { e.preventDefault(); var sp = evPos(e), w0 = s2w(sp.x, sp.y); cam.s = clamp(cam.s * (e.deltaY < 0 ? 1.12 : 1 / 1.12), cam.fit * 0.7, cam.fit * 5); cam.user = true; cam.x = w0.x - (sp.x - W / 2) / cam.s; cam.y = w0.y - (H / 2 - sp.y) / cam.s; }, { passive: false });
  $('#zoomIn').addEventListener('click', function () { cam.s = clamp(cam.s * 1.25, cam.fit * 0.7, cam.fit * 5); cam.user = true; });
  $('#zoomOut').addEventListener('click', function () { cam.s = clamp(cam.s / 1.25, cam.fit * 0.7, cam.fit * 5); cam.user = true; });
  $('#zoomFit').addEventListener('click', function () { cam.user = false; resize(); });

  function undock(it) {
    if (!it.dock) return;
    if (it.dock.mode === 'stopper') { var f = byUid(it.dock.to); if (f) f.props.stopper = false; }
    it.dock = null; it.tilt = 0; it._squeeze = false; it._pourLeft = 0; it._dumpAll = false; it._washLeft = 0; it._holdPour = false; endSession();
  }
  // 放手時決定放在哪裡（nobook 的「感應區」）
  function place(it, opts) {
    var k = TY[it.type].kind, conts = S.items.filter(function (i) { return i !== it && isCont(i) && !i.dock || (i !== it && isCont(i) && i.dock && (i.dock.mode === 'pan' || i.dock.mode === 'under')); });
    var best = null, bd = 1e9;
    function consider(target, dist) { if (dist < bd) { bd = dist; best = target; } }
    if (k === 'cont' || k === 'paper') {
      best = opts && opts.noPour ? null : pourTarget(it);
      if (best) return dockPour(it, best);
      var bal = balance(); if (bal && Math.abs(it.x - bal.x) < 4 && it.y < PAN_Y + 4) { it.x = bal.x; it.y = PAN_Y; it.dock = { mode: 'pan', to: bal.uid }; sfx('item_place'); logStep(nameOf(it) + '放到電子秤上'); return; }
      var br = burette(); if (br && k === 'cont' && Math.abs(it.x - br.x) < 5) { it.x = br.x; it.y = 0; it.dock = { mode: 'under', to: br.uid }; sfx('item_place'); logStep(nameOf(it) + '放到滴定管下方'); return; }
      return toBench(it);
    }
    if (k === 'washer' || k === 'dropbottle') {
      conts.forEach(function (t) { var top = t.y + HH(t); var dx = Math.abs((k === 'washer' ? it.x - 3.3 : it.x) - t.x); if (dx < shapeOf(t).mouth + 5 && it.y > top - 4 && it.y < top + 16) consider(t, dx); });
      if (best) {
        var top2 = best.y + HH(best);
        if (k === 'washer') { var rT = CM.radiusAt(shapeOf(best), 0.2) + 0.15; it.x = best.x + rT + 3.4; it.y = best.y; it.dock = { mode: 'over', to: best.uid, nozzle: P(best.x, top2 + 1.0) }; it._shown = 0; toast('按住藍色圓鈕擠水；工具列可以擠一滴'); }
        else { var busy = S.items.some(function (o) { return o.dock && o.dock.mode === 'tip' && o.dock.to === best.uid; }); it.x = best.x + (busy ? shapeOf(best).mouth * 0.7 : 0); it.y = top2 + 1.0; it.dock = { mode: 'over', to: best.uid }; toast('按「滴一滴」，或點紅色滴頭'); }   // 杯裡插著吸量管、玻璃棒時往旁邊挪，滴頭才不會跟吸球疊在一起
        sfx('item_place'); return;
      }
      return toBench(it);
    }
    if (k === 'pipette' || k === 'rod' || k === 'spatula') {
      var targets = S.items.filter(function (i) { return i !== it && (isCont(i) || (k === 'spatula' && (TY[i.type].kind === 'jar' || TY[i.type].kind === 'paper'))) && !(i.dock && i.dock.mode === 'pour'); });
      targets.forEach(function (t) { var b = boxOf(t), dx = Math.abs(it.x - t.x); if (dx < (b.x1 - b.x0) / 2 + 1.5 && it.y < b.y1 + 6) consider(t, dx); });
      if (best) {
        if (k === 'pipette') {
          if (best.props.reagent === 'concHCl' && level.ppe && (!S.ppe.goggles || (level.ppe === true && !S.ppe.gloves))) return danger('ppe');
          it.x = best.x; it.y = best.y + 0.25; it.dock = { mode: 'tip', to: best.uid }; sfx('item_place'); toast('拖上面的紅色吸球：往上吸、往下放'); return;
        }
        if (k === 'rod') { if (!isCont(best)) return toBench(it); it.x = best.x; it.y = best.y + 0.3; it.dock = { mode: 'tip', to: best.uid }; sfx('item_place'); toast('玻璃棒左右拖＝攪拌'); return; }
        if (k === 'spatula') {
          var kb = TY[best.type].kind;
          if (kb === 'jar') { it.x = best.x; it.y = best.y + 3; it.dock = { mode: 'tip', to: best.uid }; sfx('item_place'); toast('先設定一匙幾克，再按「挖起」'); return; }
          if (kb === 'paper') { it.x = best.x; it.y = best.y + 1.4; it.dock = { mode: 'over', to: best.uid }; sfx('item_place'); toast('按「全倒」倒光，「抖一點」倒一點'); return; }
          if (kb === 'cont') { it.x = best.x; it.y = best.y + HH(best) + 0.8; it.dock = { mode: 'over', to: best.uid }; sfx('item_place'); toast('按「全倒」倒進去'); return; }
        }
      }
      return toBench(it);
    }
    if (k === 'stopper') {
      var vf = S.items.filter(function (i) { return i.type === 'vol100'; })[0];
      if (vf && Math.abs(it.x - vf.x) < 4 && Math.abs(it.y - (vf.y + HH(vf))) < 6) { it.dock = { mode: 'stopper', to: vf.uid }; vf.props.stopper = true; it.x = vf.x; it.y = vf.y + HH(vf); sfx('item_place'); logStep('蓋上瓶塞'); return; }
      return toBench(it);
    }
    return toBench(it);
  }
  // 拖著容器時，正下方瓶口最近的容器就是要倒進去的目標（畫面上會亮黃框提示）
  function pourTarget(it) {
    var k = TY[it.type].kind; if (k !== 'cont' && k !== 'paper') return null;
    if (it.y < 1.0) return null;   // 要拿起來（離開桌面）才會倒
    var best = null, bd = 1e9, srcTop = it.y + (k === 'paper' ? 1 : HH(it)), b = boxOf(it), srcR = (b.x1 - b.x0) / 2;
    S.items.forEach(function (t) {
      if (t === it || !isCont(t) || (t.dock && t.dock.mode === 'pour')) return;
      var top = t.y + HH(t), dx = Math.abs(it.x - t.x);
      // 瓶口要舉到目標杯口附近（比杯口高、但不要高太多），而且在杯子旁邊或正上方
      if (dx < shapeOf(t).mouth + srcR + 2.5 && srcTop > top - 1 && it.y < top + 8 && dx < bd) { bd = dx; best = t; }
    });
    return best;
  }
  function dockPour(it, t) {
    var dir = t.x >= it.x ? 1 : -1, sS = shapeOf(it), sT = shapeOf(t), topT = t.y + HH(t);
    if (TY[it.type].kind === 'paper') { it.x = t.x - dir * (sT.mouth + 1.5); it.y = topT + 0.8; it.dock = { mode: 'pour', to: t.uid, dir: dir }; it.tilt = 0; sfx('item_place'); toast('按「全倒」把紙上的東西倒進去'); return; }
    var lipY = Math.max(topT + 0.9, sS.H + 0.4), lipD = sT.mouth * 0.55;   // 高的瓶子不會沉到桌面下
    if (restTilt(it) < 25) {   // 裝很滿、不能先斜靠：整個瓶身放在目標旁邊，不要蓋住它（倒的時候水柱會畫成弧線流進去）
      var rS = Math.max(sS.base || 0, sS.segs.reduce(function (m, g) { return Math.max(m, g[1], g[2]); }, 0)), y0 = Math.max(0, lipY - sS.H - t.y), rT = 0;
      for (var i = 0; i <= 10; i++) rT = Math.max(rT, CM.radiusAt(sT, y0 + (HH(t) - y0) * i / 10));
      lipD = Math.max(lipD, rT + rS - sS.mouth + 0.25);
    }
    var lipX = t.x - dir * lipD;
    it._shown = 0; it._emptyWarn = false;
    it.x = lipX - dir * sS.mouth; it.y = lipY - sS.H; it.dock = { mode: 'pour', to: t.uid, dir: dir }; it.tilt = restTilt(it);
    sfx('item_place'); toast('架好了：按住「按住倒」就倒、放開就停；也可以按「倒 1 mL」「倒 10 mL」');
  }
  function toBench(it) {
    it.y = 0; it.dock = null; it.tilt = 0;
    var kk = TY[it.type].kind;
    if (kk === 'pipette' || kk === 'rod' || kk === 'spatula') {   // 工具插回工具架的空格
      var used = S.items.filter(function (o) { return o !== it && o._rack && !o.dock && !o._held; }).map(function (o) { return o._slot; });
      var slot = 0; while (used.indexOf(slot) >= 0) slot++;
      it._rack = true; it._slot = slot; it.x = RACK.x - 2.7 + Math.min(slot, RACK.slots - 1) * 1.8 + Math.max(0, slot - RACK.slots + 1) * 0.6; it.y = 0.5; sfx('item_place'); return;
    }
    var w = boxOf(it), half = (w.x1 - w.x0) / 2, x0 = clamp(it.x, half - 1, level.world.w - half + 1);
    // 找最近的空位，不要跟桌上別的器材疊在一起
    function free(x) { it.x = x; var b = boxOf(it); if (b.x0 < RACK.x + 3.8 && RACK.x - 3.8 < b.x1) return false; return !S.items.some(function (o) { if (o === it || o.dock || TY[o.type].kind === 'burette') return false; var c = boxOf(o); return b.x0 < c.x1 - 0.2 && c.x0 < b.x1 - 0.2 && b.y0 < c.y1 && c.y0 < b.y1; }); }
    var best = x0;
    for (var d = 0; d <= level.world.w; d += 0.5) { if (x0 + d <= level.world.w - half + 1 && free(x0 + d)) { best = x0 + d; break; } if (x0 - d >= half - 1 && free(x0 - d)) { best = x0 - d; break; } }
    it.x = best;
    sfx('item_place');
  }
  function pipetteBy(it, dv) {   // dv > 0 吸、< 0 放（mL）
    if (!it.dock) { toast('先把吸量管伸進容器裡'); return; }
    var c = byUid(it.dock.to);
    if (dv > 0) {
      var lvl = CM.levelOf(shapeOf(c), c.sol.v);
      if (lvl < 0.4) { if (!it._airWarn) { it._airWarn = true; toast('管尖不在液面下，吸到空氣了'); sfx('warn'); } return; }
      var room = 20 - it.sol.v; move(c, it, Math.min(dv, room), 'pipette');
    } else move(it, c, Math.min(-dv, it.sol.v), 'pipette');
  }
  function oneDrop(b) { if (S.over) return; var dv = Math.min(0.05, 50 - b.props.read); b.props.read += dv; S.fx.push({ x: b.x, y: BUR.tip - 0.3, vx: 0, vy: -20, t: 0, life: 0.5, r: 0.18, c: 'rgba(200,228,255,.9)' }); burDeliver(b, dv); sfx('slider_tick'); }
  function addDrop(it) {
    if (!it.dock) { toast('先把酚酞瓶拖到容器上方'); return; }
    var c = byUid(it.dock.to), d = CM.fromReagent('php', 0.05); CM.transfer(d, c.sol, 0.05); S.phpDrops = (S.phpDrops || 0) + 1; sfx('slider_tick'); logStep('加 1 滴酚酞到' + nameOf(c));
  }

  // ---------- 器材櫃 ----------
  var SHELF_ICON = {
    goggles: '<path d="M6 18q0-6 8-6h20q8 0 8 6v4q0 6-8 6h-4l-4-4h-4l-4 4h-4q-8 0-8-6z" fill="#7fc4ff" stroke="#13233f" stroke-width="2"/>',
    gloves: '<path d="M16 34V16q0-3 3-3t3 3v-6q0-3 3-3t3 3v4q0-3 3-3t3 3v16q0 6-7 6h-4q-7 0-7-6z" fill="#ffd84d" stroke="#13233f" stroke-width="2"/>',
    pipette: '<path d="M24 34V8" stroke="#13233f" stroke-width="5"/><path d="M24 34V8" stroke="#dff1ff" stroke-width="3"/><ellipse cx="24" cy="6" rx="4" ry="4" fill="#d63b2f" stroke="#13233f" stroke-width="2"/>',
    rod: '<path d="M14 34L34 6" stroke="#13233f" stroke-width="4" stroke-linecap="round"/><path d="M14 34L34 6" stroke="#eef6ff" stroke-width="2" stroke-linecap="round"/>',
    stopper: '<path d="M18 18h12l2 10H16z" fill="#e9eef4" stroke="#13233f" stroke-width="2"/>',
    cyl50: '<rect x="19" y="5" width="10" height="28" fill="#dff1ff" stroke="#13233f" stroke-width="2"/><rect x="14" y="33" width="20" height="3" fill="#dff1ff" stroke="#13233f" stroke-width="2"/>',
    cyl100: '<rect x="18" y="4" width="12" height="29" fill="#dff1ff" stroke="#13233f" stroke-width="2"/><rect x="13" y="33" width="22" height="3" fill="#dff1ff" stroke="#13233f" stroke-width="2"/>',
    jug: '<path d="M12 10h22v24H12z" fill="#e3e7ee" stroke="#13233f" stroke-width="2"/><path d="M34 14h4v12h-4" fill="none" stroke="#13233f" stroke-width="2"/>',
    naoh: '<rect x="15" y="12" width="18" height="22" rx="2" fill="#dff1ff" stroke="#13233f" stroke-width="2"/><rect x="20" y="6" width="8" height="6" fill="#13233f"/><text x="24" y="27" font-size="7" text-anchor="middle" fill="#13233f" font-weight="700">NaOH</text>',
    lamp: '<path d="M12 34h24q2-8-6-10h-12q-8 2-6 10z" fill="#dff1ff" stroke="#13233f" stroke-width="2"/><rect x="21" y="18" width="6" height="6" fill="#56626e"/>',
    paper: '<path d="M8 28h32l-4-6H12z" fill="#fff" stroke="#13233f" stroke-width="2"/>',
    spatula: '<path d="M12 32L34 8" stroke="#13233f" stroke-width="3"/><ellipse cx="12" cy="32" rx="5" ry="3" fill="#c9d2dc" stroke="#13233f" stroke-width="2"/>',
    sugarjar: '<rect x="13" y="12" width="22" height="22" rx="3" fill="#fff3dc" stroke="#13233f" stroke-width="2"/><rect x="12" y="8" width="24" height="5" fill="#c9893a" stroke="#13233f" stroke-width="2"/>',
    beaker100: '<path d="M14 8h20v26H14z" fill="#dff1ff" stroke="#13233f" stroke-width="2"/>',
    beaker250: '<path d="M11 8h26v26H11z" fill="#dff1ff" stroke="#13233f" stroke-width="2"/>',
    conical: '<path d="M20 6h8v8l8 20H12l8-20z" fill="#dff1ff" stroke="#13233f" stroke-width="2"/>'
  };
  var shelfEl = $('#shelf'), ghost = document.createElement('div'); ghost.className = 'ghost'; document.body.appendChild(ghost);
  function shelfLeft(k) { return (level.shelf[k] || 0) - (k === 'goggles' ? (S.ppe.goggles ? 1 : 0) : k === 'gloves' ? (S.ppe.gloves ? 1 : 0) : S.items.filter(function (i) { return i.type === k && i.fromShelf; }).length); }
  function svgOf(k) { return '<svg viewBox="0 0 48 40" aria-hidden="true">' + (SHELF_ICON[k] || '') + '</svg>'; }
  function buildShelf() {
    shelfEl.innerHTML = Object.keys(level.shelf).map(function (k) {
      var left = shelfLeft(k);
      return '<div class="tile' + (left <= 0 ? ' out' : '') + '" data-k="' + k + '" role="button" tabindex="0" aria-label="' + TY[k].name + '：拖到實驗台，剩 ' + left + ' 個">' + svgOf(k) + '<span>' + TY[k].name + '</span><span class="cnt">' + left + '</span></div>';
    }).join('');
  }
  shelfEl.addEventListener('pointerdown', function (e) {
    var t = e.target.closest('.tile'); if (!t || S.over) return;
    var k = t.getAttribute('data-k'); if (shelfLeft(k) <= 0) { toast(TY[k].name + '已經在用了'); return; }
    e.preventDefault(); drag = { kind: 'shelf', k: k, sx: e.clientX, sy: e.clientY, moved: false };
    ghost.innerHTML = svgOf(k); sfx('item_pick');
    try { shelfEl.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件 */ }
  });
  shelfEl.addEventListener('pointermove', function (e) { if (!drag || drag.kind !== 'shelf') return; if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 8) drag.moved = true; if (drag.moved) { ghost.classList.add('show'); ghost.style.left = (e.clientX - 32) + 'px'; ghost.style.top = (e.clientY - 28) + 'px'; } });
  shelfEl.addEventListener('pointerup', function (e) {
    if (!drag || drag.kind !== 'shelf') return;
    var d = drag; drag = null; ghost.classList.remove('show');
    var r = cv.getBoundingClientRect(), inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!d.moved) { if (TY[d.k].kind === 'ppe') wear(d.k); else addFromShelf(d.k, P(level.world.w * 0.6, 0), true); return; }   // 點一下＝放到桌上空位（不自動架到別的器材上）
    if (!inside) return;
    var p = s2w(e.clientX - r.left, e.clientY - r.top);
    addFromShelf(d.k, p);
  });
  shelfEl.addEventListener('keydown', function (e) { if (e.key !== 'Enter' && e.key !== ' ') return; var t = e.target.closest('.tile'); if (!t) return; e.preventDefault(); var k = t.getAttribute('data-k'); if (shelfLeft(k) <= 0) { toast(TY[k].name + '已經在用了'); return; } if (TY[k].kind === 'ppe') wear(k); else addFromShelf(k, P(level.world.w * 0.6, 0), true); });
  function wear(k) { if (S.ppe[k]) return; S.ppe[k] = true; sfx('item_place'); toast('戴上' + TY[k].name); logStep('戴上' + TY[k].name); renderPPE(); buildShelf(); }
  function addFromShelf(k, p, tapOnly) {
    if (TY[k].kind === 'ppe') return wear(k);
    var it = newItem(k, p.x, Math.max(0, p.y)); it.fromShelf = true;
    if (TRAPS.indexOf(k) >= 0) S.traps[k] = true;
    if (k === 'lamp') toast('這個實驗不需要加熱');
    if (k === 'naoh') toast('題目要配的是鹽酸喔');
    if (k === 'sugarjar') toast('這罐是砂糖');
    S.items.push(it); if (tapOnly) toBench(it); else place(it, { noPour: true }); select(it); buildShelf();
  }

  // ---------- 工具列 ----------
  function btn(label, act, cls) { return '<button type="button" data-act="' + act + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + label + '</button>'; }
  function infoOf(it) {
    var k = TY[it.type].kind;
    if (k === 'cont' && it.dock && it.dock.mode === 'pour') { var tgt = byUid(it.dock.to); return nameOf(it) + ' → ' + nameOf(tgt) + '：已倒 ' + (it._shown || 0).toFixed((it._shown || 0) < 10 ? 2 : 1) + ' mL'; }
    if (k === 'washer' && it.dock) return '洗瓶 → ' + nameOf(byUid(it.dock.to)) + '：已擠 ' + (it._shown || 0).toFixed(2) + ' mL';
    if (k === 'cont') { var s = it.sol, h = nameOf(it); if (!TY[it.type].src) { h += '・' + (TY[it.type].measure ? '讀放大鏡' : approx(s.v)); if (s.solid > 0.005) h += '・未溶 ' + f2(s.solid) + ' g'; } if (it.props.stopper) h += '・有瓶塞'; return h; }
    if (k === 'pipette') return '吸量管・管內 ' + it.sol.v.toFixed(2) + ' mL';
    if (k === 'spatula') { if (it.dock && TY[byUid(it.dock.to).type].kind === 'jar') return '一匙挖 ' + f1(S.spAmt) + ' g'; return '藥匙' + (it.props.g > 0.01 ? '・約 ' + f1(it.props.g) + ' g ' + (it.props.solid === 'sugar' ? '糖' : '食鹽') : '・空的'); }
    if (k === 'paper') return '稱量紙';
    if (k === 'burette') { var u = underBurette(), col = ''; if (u) { var pk = CM.phpPink(CM.pH(u.sol), u.sol.php); col = '・錐形瓶 ' + (pk <= 0 ? (u.flash > 0.2 ? '滴下處閃粉紅' : '無色') : pk < 0.5 ? '淡粉紅' : '粉紅'); } return '滴定管・活栓 ' + Math.round(it.props.open * 100) + '%' + col; }
    if (k === 'balance') return '電子秤';
    return TY[it.type].name;
  }
  // 這個器材可以對哪些容器操作（按鈕會列出來）
  function targetsOf(it) {
    var k = TY[it.type].kind;
    return S.items.filter(function (t) {
      if (t === it || (t.dock && t.dock.mode === 'pour')) return false;
      if (k === 'spatula') return TY[t.type].kind === 'jar' || TY[t.type].kind === 'paper' || (isCont(t) && !TY[t.type].src);
      if (k === 'pipette') return isCont(t);
      if (k === 'stopper') return t.type === 'vol100' && !t.props.stopper;
      return isCont(t) && !TY[t.type].src;
    });
  }
  var VERB = { cont: '倒進', paper: '倒進', pipette: '伸進', rod: '攪拌', spatula: '放到', washer: '擠到', dropbottle: '滴進', stopper: '蓋上' };
  function goTo(it, t) {   // 按鈕版的「拖過去放手」
    var k = TY[it.type].kind; undock(it); it._rack = false;
    if (k === 'cont' || k === 'paper') { dockPour(it, t); return; }
    if (k === 'pipette') { if (t.props.reagent === 'concHCl' && level.ppe && (!S.ppe.goggles || (level.ppe === true && !S.ppe.gloves))) return danger('ppe'); it.x = t.x; it.y = t.y + 0.25; it.dock = { mode: 'tip', to: t.uid }; sfx('item_place'); return; }
    if (k === 'rod') { it.x = t.x; it.y = t.y + 0.3; it.dock = { mode: 'tip', to: t.uid }; t._stir = 4; sfx('stir'); logStep('用玻璃棒攪拌' + nameOf(t)); return; }
    if (k === 'stopper') { it.dock = { mode: 'stopper', to: t.uid }; t.props.stopper = true; it.x = t.x; it.y = t.y + HH(t); sfx('item_place'); logStep('蓋上瓶塞'); return; }
    if (k === 'spatula') { var kb = TY[t.type].kind; it.x = t.x; it.y = kb === 'jar' ? t.y + 3 : kb === 'paper' ? t.y + 1.4 : t.y + HH(t) + 0.8; it.dock = { mode: kb === 'jar' ? 'tip' : 'over', to: t.uid }; sfx('item_place'); return; }
    if (k === 'washer') { var rT = CM.radiusAt(shapeOf(t), 0.2) + 0.15; it.x = t.x + rT + 3.4; it.y = t.y; it.dock = { mode: 'over', to: t.uid, nozzle: P(t.x, t.y + HH(t) + 1.0) }; it._shown = 0; sfx('item_place'); return; }
    if (k === 'dropbottle') { var busy = S.items.some(function (o) { return o.dock && o.dock.mode === 'tip' && o.dock.to === t.uid; }); it.x = t.x + (busy ? shapeOf(t).mouth * 0.7 : 0); it.y = t.y + HH(t) + 1.0; it.dock = { mode: 'over', to: t.uid }; sfx('item_place'); return; }
  }
  function shortName(t) { var n = nameOf(t); var same = S.items.filter(function (o) { return o !== t && nameOf(o) === n; }); return same.length ? n + '（' + (t.x < same[0].x ? '左' : '右') + '）' : n; }
  function buildToolbar() {
    var it = S.sel, mis = $('#mission'); if (!it || S.over) { toolbar.hidden = true; mis.classList.remove('tool'); return; }
    mis.classList.add('tool');
    var k = TY[it.type].kind, h = '<span class="chip">' + infoOf(it) + '</span>';
    var benchBtn = it.dock && (it.dock.mode === 'pour' || it.dock.mode === 'over' || it.dock.mode === 'tip' || it.dock.mode === 'pan' || it.dock.mode === 'under') && it.type !== 'stopper' && TY[it.type].kind !== 'dropbottle';
    if ((k === 'cont') && it.dock && it.dock.mode === 'pour') h += btn('按住倒', 'hold', 'go hold') + btn('倒 0.1', 'pq.1') + btn('倒 1 mL', 'pq1') + btn('倒 10 mL', 'pq10') + btn('全倒', 'pqall');
    if (k === 'paper' && it.dock && it.dock.mode === 'pour') h += btn('全倒', 'pqall', 'go');
    if (k === 'pipette' && it.dock) h += btn('吸 1 mL', 'p+1') + btn('吸 0.1', 'p+.1') + btn('放 0.1', 'p-.1') + btn('放 1 mL', 'p-1') + btn('全放', 'pall');
    if (k === 'washer' && it.dock) h += btn('按住擠', 'hold', 'go hold') + btn('擠一滴', 'w1') + btn('擠 1 mL', 'w10') + btn('擠 10 mL', 'w100');
    if (k === 'rod' && it.dock) h += btn('攪拌', 'stir');
    if (k === 'spatula' && it.dock) { var tk = TY[byUid(it.dock.to).type].kind; if (tk === 'jar') h += btn('−1', 'sp-1') + btn('−0.1', 'sp-.1') + btn('+0.1', 'sp+.1') + btn('+1', 'sp+1') + btn('挖起 ' + f1(S.spAmt) + ' g', 'scoop', 'go'); if (tk === 'paper' || tk === 'cont') h += btn('全倒', 'dump', 'go') + btn('抖一點', 'tap') + (tk === 'paper' ? btn('挖回一點', 'back') : ''); }
    if (k === 'balance') h += btn('歸零', 'tare');
    if (k === 'burette') { h += btn('一滴', 'drop') + btn('開大', 'open') + btn('關小', 'close') + btn('關閉', 'shut'); if (underBurette()) h += btn('搖晃錐形瓶', 'swirlU'); }
    if (k === 'dropbottle' && it.dock) h += btn('滴一滴', 'php', 'go') + btn('放回桌上', 'bench');
    if (it.type === 'vol100' && it.props.stopper) h += btn('倒轉搖勻', 'shake', 'go');
    if (it.type === 'conical' || (it.dock && it.dock.mode === 'under')) h += btn('搖晃', 'swirl');
    var mover = k === 'spatula' || k === 'pipette' || k === 'rod' || k === 'dropbottle' || k === 'washer';
    if ((!it.dock || mover || it.dock.mode === 'pan' || it.dock.mode === 'under') && VERB[k] && !(k === 'cont' && it.sol && it.sol.v <= 0.05 && !TY[it.type].src)) targetsOf(it).forEach(function (t) { if (!(it.dock && it.dock.to === t.uid)) h += btn(VERB[k] + ' ' + shortName(t), 'to:' + t.uid, 'to'); });
    var bur0 = burette(); if (bur0 && k === 'cont' && !TY[it.type].src && !(it.dock && it.dock.mode === 'under') && !underBurette()) h += btn('放到滴定管下', 'under', 'to');
    var bal0 = balance(); if (bal0 && (k === 'cont' || k === 'paper') && !TY[it.type].src && !(it.dock && it.dock.mode === 'pan') && !S.items.some(function (o) { return o.dock && o.dock.mode === 'pan'; })) h += btn('放到電子秤', 'pan', 'to');
    if (benchBtn) h += btn('放回桌上', 'bench');
    if (it.fromShelf) h += btn('收回器材櫃', 'del', 'del');
    toolbar.innerHTML = h; toolbar.hidden = false; toolbar.scrollLeft = 0;
  }
  toolbar.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('button[data-act="hold"]'); if (!b || !S.sel || S.over || e.button) return;
    e.preventDefault(); S.sel._holdT = 0; S._holder = S.sel; if (TY[S.sel.type].kind === 'washer') { S.sel._squeeze = true; sfx('pour'); } else S.sel._holdPour = true;
  });
  function stopHold() { var h = S._holder; if (!h) return; h._holdPour = false; if (TY[h.type].kind === 'washer') h._squeeze = false; else if (h.dock && h.dock.mode === 'pour') h.tilt = restTilt(h); h._holdT = 0; S._holder = null; endSession(); }
  window.addEventListener('blur', stopHold);
  window.addEventListener('pointerup', stopHold); window.addEventListener('pointercancel', stopHold);
  toolbar.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || !S.sel || S.over) return;
    var it = S.sel, a = b.getAttribute('data-act');
    if (a.indexOf('to:') === 0) { var tg = byUid(a.slice(3)); if (tg) { goTo(it, tg); if (TY[it.type].kind === 'dropbottle' && it.dock) addDrop(it); } buildToolbar(); buildShelf(); return; }
    if (a === 'bench') { undock(it); toBench(it); }
    if (a === 'under') { var br0 = burette(); undock(it); it.x = br0.x; it.y = 0; it.dock = { mode: 'under', to: br0.uid }; sfx('item_place'); logStep(nameOf(it) + '放到滴定管下方'); }
    if (a === 'pan') { var bl = balance(); undock(it); it.x = bl.x; it.y = PAN_Y; it.dock = { mode: 'pan', to: bl.uid }; sfx('item_place'); logStep(nameOf(it) + '放到電子秤上'); }
    if (a === 'p+1') pipetteBy(it, 1); if (a === 'p+.1') pipetteBy(it, 0.1); if (a === 'p-.1') pipetteBy(it, -0.1); if (a === 'p-1') pipetteBy(it, -1); if (a === 'pall') pipetteBy(it, -it.sol.v);
    if (a === 'p+1' || a === 'p+.1' || a === 'p-.1' || a === 'p-1' || a === 'pall') { endSession(); sfx('slider_tick'); }
    if (a === 'pq.1' || a === 'pq1' || a === 'pq10') it._pourLeft = (it._pourLeft || 0) + { 'pq.1': 0.1, 'pq1': 1, 'pq10': 10 }[a];
    if (a === 'pqall') { if (TY[it.type].kind === 'paper') it._dumpAll = true; else it._pourLeft = 1e6; }
    if (a === 'w100') it._washLeft = (it._washLeft || 0) + 10;
    if (a === 'w1' || a === 'w10') { move(it, byUid(it.dock.to), a === 'w1' ? 0.05 : 1, 'wash'); endSession(); sfx('slider_tick'); }
    if (a === 'stir') { var c = byUid(it.dock.to); c._stir = 4; sfx('stir'); logStep('用玻璃棒攪拌' + nameOf(c)); }
    if (a === 'scoop') { var jar = byUid(it.dock.to); it.props.g = Math.round(S.spAmt * (0.96 + Math.random() * 0.08) * 100) / 100; it.props.solid = TY[jar.type].solid; sfx('item_pick'); toast('挖起約 ' + f1(S.spAmt) + ' g' + (it.props.solid === 'sugar' ? '糖' : '食鹽') + '，按「放到 稱量紙」或「放到 燒杯」'); }
    if (a === 'sp+1' || a === 'sp-1' || a === 'sp+.1' || a === 'sp-.1') { S.spAmt = clamp(Math.round((S.spAmt + { 'sp+1': 1, 'sp-1': -1, 'sp+.1': 0.1, 'sp-.1': -0.1 }[a]) * 10) / 10, 0.1, 20); sfx('slider_tick'); }
    if (a === 'tap' || a === 'dump' || a === 'back') { var pp = byUid(it.dock.to); spatulaTo(it, pp, a); }
    if (a === 'tare') { it.props.tare += balReading(it); sfx('ui_tap'); logStep('電子秤歸零'); }
    if (a === 'drop') oneDrop(it);
    if (a === 'open') it.props.open = Math.min(1, it.props.open + 0.1);
    if (a === 'close') it.props.open = Math.max(0, it.props.open - 0.1);
    if (a === 'shut') it.props.open = 0;
    if (a === 'php') addDrop(it);
    if (a === 'shake') { it.sol.mixed = 1; it.props.shaken = true; it._shakeAnim = 1.2; sfx('shake'); logStep('蓋上瓶塞，倒轉搖勻'); }
    if (a === 'swirl') { it._swirl = 1.5; it.sol.mixed = 1; it.flash = 0; sfx('shake'); }
    if (a === 'swirlU') { var u = underBurette(); if (u) { u._swirl = 1.5; u.sol.mixed = 1; u.flash = 0; sfx('shake'); } }
    if (a === 'del') { undock(it); S.items = S.items.filter(function (i) { return i !== it; }); S.items.forEach(function (i) { if (i.dock && i.dock.to === it.uid) { undock(i); toBench(i); } }); S.sel = null; buildShelf(); sfx('reset'); }
    buildToolbar(); buildShelf();
  });
  function spatulaTo(sp, paper, how) {
    if (isCont(paper)) {   // 直接倒進容器
      if (sp.props.g <= 0.005) { toast('藥匙是空的，先到罐子裡挖一匙'); return; }
      var gc = how === 'dump' ? sp.props.g : Math.min(sp.props.g, Math.round((0.1 + Math.random() * 0.2) * 100) / 100);
      sp.props.g -= gc; paper.sol.solid += gc; paper.sol.solidKind = sp.props.solid; if (sp.props.solid === 'sugar') paper.sol.sugar = true;
      sfx('slider_tick'); logStep('藥匙上的' + (sp.props.solid === 'sugar' ? '糖' : '食鹽') + '倒進' + nameOf(paper)); return;
    }
    if (how === 'back') { var g0 = Math.min(paper.props.g, Math.round((0.1 + Math.random() * 0.2) * 100) / 100); /* 跟「抖一下」一樣一次一點點 */ paper.props.g -= g0; sp.props.g += g0; sp.props.solid = paper.props.solid; sfx('item_pick'); return; }
    if (sp.props.g <= 0.005) { toast('藥匙是空的，先到罐子裡挖一匙'); return; }
    var g = how === 'dump' ? sp.props.g : Math.min(sp.props.g, Math.round((0.1 + Math.random() * 0.2) * 100) / 100);
    if (paper.props.solid && paper.props.solid !== sp.props.solid && paper.props.g > 0) { toast('紙上已經有別的東西了'); }
    sp.props.g -= g; paper.props.g += g; paper.props.solid = sp.props.solid; sfx('slider_tick');
  }

  // ---------- 交卷 ----------
  var sub = $('#submit');
  function buildSubmit() {
    if (no === 3) sub.innerHTML = '<label for="ans">答案</label><input id="ans" inputmode="decimal" autocomplete="off" placeholder="0.000"><span>mol/L</span><button type="button" id="btnSubmit" class="go">交件</button>';
    else sub.innerHTML = '<button type="button" id="btnSubmit" class="go">交件</button>';
    $('#btnSubmit').addEventListener('click', evaluate);
  }
  function evaluate() {
    if (S.over) return;
    endSession();
    var res = no === 1 ? evalSalt() : no === 2 ? evalDilution() : evalTitration();
    if (!res.ok) { sfx('miss'); openSheet('<h2>還沒過關</h2><p>' + res.msg + '</p>' + (level.fail ? '<div class="learn"><b>線索</b><br>' + level.fail + '</div>' : '') + '<div class="row"><button type="button" id="keep">繼續做</button><a class="go" href="chem.html?lv=' + no + '">重來</a></div>'); $('#keep').addEventListener('click', function () { $('#ov').classList.remove('show'); }); return; }
    S.over = true;
    var stars = res.stars.filter(Boolean).length;
    if (window.LabRecords) window.LabRecords.onPass(level.id, stars);
    sfx('pass'); for (var k = 1; k <= stars; k++) sfx('star' + k, 1.15 + 0.34 * (k - 1));
    openSheet('<div class="stars">' + [0, 1, 2].map(function (i) { return '<span' + (res.stars[i] ? '' : ' class="off"') + '>★</span>'; }).join('') + '</div><h2>過關！</h2><ul>' + level.stars.map(function (s, i) { return '<li>' + (res.stars[i] ? '✓ ' : '✗ ') + s + '</li>'; }).join('') + '</ul>' +
      (level.win ? '<p class="say">' + level.win + '</p>' : '') + '<div class="learn">' + res.msg + '</div><div class="learn"><b>背後的科學</b><br>' + level.learn + '</div>' + (level.bonus ? '<div class="learn bonus"><b>延伸挑戰</b><br>' + level.bonus + '</div>' : '') +
      '<div class="row"><a href="chem.html?lv=' + no + '">再玩一次</a>' + (no < LV.length ? '<a class="go" href="chem.html?lv=' + (no + 1) + '">下一關</a>' : '<a class="go" href="index.html">關卡列表</a>') + '</div>');
  }
  function evalSalt() {
    var c = S.items.filter(function (i) { return isCont(i) && !TY[i.type].src && i.sol && (i.sol.n.NaCl > 0 || i.sol.solid > 0 || i.sol.sugar); }).sort(function (a, b) { return b.sol.v - a.sol.v; })[0];
    if (!c) return { ok: false, msg: '還沒有任何容器裡有食鹽水。' };
    var s = c.sol;
    if (s.sugar) return { ok: false, msg: '你加的是砂糖，不是食鹽（氯化鈉）。' };
    if (s.solid > 0.01) return { ok: false, msg: nameOf(c) + '裡還有 ' + f2(s.solid) + ' g 食鹽沒溶解，用玻璃棒攪拌。' };
    var salt = s.n.NaCl * CM.MW.NaCl, water = s.waterG, total = salt + water, pct = CM.massPercent(s);
    var msg = nameOf(c) + '裡：食鹽 ' + f2(salt) + ' g、水 ' + f1(water) + ' g，共 ' + f1(total) + ' g；重量百分濃度 = ' + f2(salt) + ' ÷ ' + f1(total) + ' × 100% = ' + f2(pct) + '%。';
    if (Math.abs(total - 100) > 2) return { ok: false, msg: msg + '總質量要 100 g（±2 g）。' };
    if (Math.abs(pct - 10) > 0.3) return { ok: false, msg: msg + '要 10%（±0.3%）。' };
    return { ok: true, msg: msg, stars: [true, Math.abs(pct - 10) <= 0.1, !Object.keys(S.traps).length] };
  }
  function evalDilution() {
    var f = S.items.filter(function (i) { return i.type === 'vol100'; })[0], s = f.sol;
    if (s.v < 1) return { ok: false, msg: '容量瓶還是空的。' };
    var M = CM.molarity(s, 'HCl'), n = s.n.HCl;
    var msg = '容量瓶裡 HCl ' + n.toFixed(4) + ' mol、體積 ' + f2(s.v) + ' mL = ' + (s.v / 1000).toFixed(5) + ' L；濃度 = ' + n.toFixed(4) + ' ÷ ' + (s.v / 1000).toFixed(5) + ' = ' + M.toFixed(3) + ' mol/L。';
    if (s.impure) return { ok: false, msg: msg + '用了自來水，含有雜質，不能當標準溶液。' };
    if (Math.abs(s.v - 100) > 0.3) return { ok: false, msg: msg + '液面沒有對準刻度線（' + (s.v > 100 ? '多了 ' : '少了 ') + f2(Math.abs(s.v - 100)) + ' mL）。' + (s.v > 100 ? '加過頭只能重配。' : '用洗瓶一滴一滴加到凹液面最低點碰到刻度線。') };
    if (!f.props.shaken) return { ok: false, msg: msg + '還沒蓋瓶塞倒轉搖勻，濃度不均勻。' };
    if (Math.abs(M - 2.0) > 0.1) return { ok: false, msg: msg + '要 2.0 ± 0.1 mol/L。' };
    return { ok: true, msg: msg + '（燒杯潤洗 ' + S.rinses + ' 次）', stars: [true, S.acidBy === 'pipette' && S.rinses >= 2 && !!f.props.shaken, !Object.keys(S.traps).length] };
  }
  function evalTitration() {
    var inp = $('#ans'), ans = parseFloat((inp && inp.value || '').replace(/[^0-9.]/g, ''));
    var f = underBurette() || S.items.filter(function (i) { return i.type === 'conical'; })[0];
    if (!f || f.sol.v < 1) return { ok: false, msg: '錐形瓶裡還沒有要滴定的鹽酸。' };
    var s = f.sol, ph = CM.pH(s);
    if (!(S.phpDrops > 0)) return { ok: false, msg: '錐形瓶裡沒有加酚酞，看不出終點。' };
    if (ph < 8.2) return { ok: false, msg: '還沒到終點：錐形瓶還是無色（pH ' + ph.toFixed(1) + '）。繼續一滴一滴加 NaOH。' };
    var added = S.totalNaOH || 0, nAcid0 = s.n.NaCl + s.n.HCl, veq = nAcid0 / 0.100 * 1000, over = added - veq;
    if (over > 0.30) return { ok: false, msg: '滴過頭了：多加了約 ' + f2(over) + ' mL 的 NaOH，溶液變得很紅。重來時接近終點要一滴一滴加。' };
    if (!isFinite(ans)) return { ok: false, msg: '請在「答案」欄填入你算出的鹽酸濃度（mol/L）。' };
    var b = burette(), err = Math.abs(ans - S.unkC) / S.unkC * 100;
    var msg = '滴定管：開始 ' + f2(b.props.read0) + ' mL、結束 ' + f2(b.props.read) + ' mL，用了 ' + f2(b.props.read - b.props.read0) + ' mL。你的答案 ' + ans + ' mol/L；真正的濃度是 ' + S.unkC.toFixed(4) + ' mol/L，誤差 ' + err.toFixed(1) + '%。';
    if (err > 2) return { ok: false, msg: msg + '要在 ±2% 以內。檢查讀數（0 在上面）和公式 C = 0.100 × V ÷ 20.00。' };
    return { ok: true, msg: msg, stars: [true, over <= 0.10, S.sampleBy === 'pipette' && !Object.keys(S.traps).length] };
  }
  // 委託單（每關開場的情境）：只放程式內建的關卡文字
  function briefHtml() {
    return '<div class="brief"><span class="tag">新委託</span><h2>' + level.title + '</h2><p class="topic">' + level.stage + (level.topic ? '・' + level.topic : '') + '</p>' +
      '<ul class="story">' + (level.story || []).map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>' +
      '<div class="goal"><b>任務</b>' + level.mission + '</div>' +
      '<div class="row"><a href="index.html">換一個委託</a><button type="button" class="go" id="accept">接下委託</button></div></div>';
  }
  function showBrief() { openSheet(briefHtml()); var ac = $('#accept'); if (ac) { ac.focus(); ac.addEventListener('click', function () { $('#ov').classList.remove('show'); sfx('ui_tap'); }); } }
  function openSheet(h) { $('#sheet').className = 'sheet'; $('#sheet').innerHTML = h; $('#ov').classList.remove('danger'); $('#ov').classList.add('show'); }

  // ---------- 主迴圈 ----------
  var tPrev = 0;
  function loop(ts) {
    requestAnimationFrame(loop);   // 先排下一格：就算這一格出錯，遊戲也不會整個停住
    var dt = tPrev ? Math.min(0.05, (ts - tPrev) / 1000) : 0; tPrev = ts;
    if (!S.over) step(dt);
    autoFrame(dt);
    if (S.sel && S.sel._shakeAnim > 0) S.sel._shakeAnim -= dt;
    draw();
    if (S.sel && !toolbar.hidden && (S.t * 4 | 0) !== (S._tb || 0)) { S._tb = S.t * 4 | 0; var chip = toolbar.querySelector('.chip'); if (chip) chip.textContent = infoOf(S.sel); }
  }

  // ---------- 開場 ----------
  $('#stage').textContent = level.stage; $('#title').textContent = level.title; $('#diff').textContent = level.diff;
  $('#missionText').textContent = level.mission; $('#howText').textContent = level.note; document.title = '瘋狂實驗室｜' + level.title;
  $('#btnHow').addEventListener('click', function () { var h = $('#howText'); h.hidden = !h.hidden; this.setAttribute('aria-expanded', String(!h.hidden)); this.textContent = h.hidden ? '怎麼操作' : '收起'; resize(); });
  var sb = $('#btnSfx');
  var SPK = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var SPKX = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function showSfx(m) { sb.innerHTML = m ? SPKX : SPK; sb.setAttribute('aria-pressed', String(!m)); sb.setAttribute('aria-label', m ? '音效：關' : '音效：開'); }
  if (window.LabSfx) { showSfx(window.LabSfx.isMuted()); window.LabSfx.onChange(showSfx); sb.addEventListener('click', function () { window.LabSfx.setMuted(!window.LabSfx.isMuted()); sfx('ui_tap'); }); } else sb.hidden = true;
  if (window.LabRecords) window.LabRecords.markPlay();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap); else window.addEventListener('resize', resize);
  resize(); buildShelf(); buildSubmit(); renderPPE(); renderData(); if (level.story) showBrief();
  toast('提示：點一下器材，上面會出現能做的事（倒進、放到、滴進…）；也可以直接用手拖');
  requestAnimationFrame(loop);
  window.__chem = { S: S, level: level, place: place, addFromShelf: addFromShelf, s2w: s2w, w2s: function (p) { setView(mainView()); return w2s(p); }, step: step, move: move, pipetteBy: pipetteBy, byUid: byUid, evaluate: evaluate, wear: wear, pourKnob: pourKnob };
})();
