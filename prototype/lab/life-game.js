/* 瘋狂實驗室・生活化學挑戰（老闆 10/20：生活中的化學檢驗——石蕊、廣用試紙、清潔用品、哪個對皮膚好）
 * 第 1 關：石蕊家庭大搜查（滴管、紅藍石蕊試紙、洗滴管、拖進三個籃子）
 * 第 2 關：洗面乳對皮膚溫和嗎？（純水／自來水稀釋、石蕊／廣用試紙／pH 計、洗電極、選出最接近皮膚 pH 的一瓶）
 * 畫面用固定的 1000×560 桌面座標，等比例放進畫面。背景、瓶罐是 GPT 畫的圖（img/life/），試紙、杯子、量具由程式畫。
 * innerHTML 只放程式內建的文字與算出來的數字，沒有玩家輸入的文字。 */
(function () {
  'use strict';
  var LV = window.LIFE_LEVELS;
  var no = Math.max(1, Math.min(LV.length, parseInt(new URLSearchParams(location.search).get('lv'), 10) || 1));
  var L = LV[no - 1], SORT = L.kind === 'sort';
  function $(s) { return document.querySelector(s); }
  function sfx(n, d) { if (window.LabSfx) window.LabSfx.play(n, d); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function fx(x, d) { return Number(x).toFixed(d); }
  var cv = $('#cv'), ctx = cv.getContext('2d'), wrap = $('#stageWrap'), dataBox = $('#data'), bar = $('#ctrlbar');
  var W = 0, H = 0, DPR = 1, VW = 1000, VH = 560, view = { s: 1, ox: 0, oy: 0 }, WIDE = false;
  var calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function byKey(k) { for (var i = 0; i < L.samples.length; i++) if (L.samples[i].key === k) return L.samples[i]; return null; }

  // ---------- 狀態 ----------
  var S = {
    over: false, tests: {}, assign: {}, wrong: {}, submits: 0, dirty: 0,
    dropper: { sample: null, residue: null, mix: null, x: 150, y: 470, tx: 150, ty: 470 },
    water: null, tool: null, cups: {}, meterLast: null, usedTap: false, picks: 0, choose: false, drag: null
  };

  // ---------- 座標與版面 ----------
  // 一般：1000×560 的桌面（瓶子一排、前面放試紙盤和籃子）。很寬很矮的畫面（手機橫放）：1400×400，試紙盤移到瓶子右邊，東西放大約 4 成
  function resize() {
    var r = wrap.getBoundingClientRect(); W = r.width; H = r.height; DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    setLayout(W / Math.max(1, H) >= 2.2);
    view.s = Math.min(W / VW, H / VH); view.ox = (W - VW * view.s) / 2; view.oy = (H - VH * view.s) / 2;
  }
  function X(x) { return view.ox + x * view.s; }
  function Y(y) { return view.oy + y * view.s; }
  function toV(px, py) { return { x: (px - view.ox) / view.s, y: (py - view.oy) / view.s }; }
  var SH_K = 0.5;   // 瓶罐圖 1 px ＝ 0.5 桌面單位（同一張圖的大小比例照原圖）
  var SH_BASE, SH0, SH_STEP, TRAY, RINSE, REST, BINS, BIN_W, BIN_Y0, BIN_Y1, CUP_Y, HOLD, CHART, CARD, MRINSE;
  var WATERS = { pure: { name: '純水' }, tap: { name: '自來水' } };
  var TOOLS = { litmus: { name: '石蕊試紙' }, uni: { name: '廣用試紙' }, meter: { name: 'pH 計' } };
  function put(o, x, y) { o.x = x; o.y = y; }
  var laidOut = false;
  function setLayout(wide) {
    if (laidOut && WIDE === wide) return;   // 版面沒換就不動（滴管拿在手上的位置不要跳掉）
    laidOut = true; WIDE = wide;
    if (!wide) {
      VW = 1000; VH = 560; SH_BASE = 300; SH0 = SORT ? 70 : 220; SH_STEP = SORT ? 122 : 135;
      TRAY = { x0: 200, x1: 680, y0: 360, y1: 548 }; RINSE = { x: 70, y: 470, r: 40 }; REST = { x: 150, y: 470 }; HOLD = { x: 440, y: 336 };
      BINS = [745, 842, 939]; BIN_W = 90; BIN_Y0 = 410; BIN_Y1 = 545;
      CUP_Y = 470; put(WATERS.pure, 52, 470); put(WATERS.tap, 140, 470);
      put(TOOLS.litmus, 835, 395); put(TOOLS.uni, 905, 395); put(TOOLS.meter, 968, 420); MRINSE = { x: 900, y: 505, r: 34 };
      CHART = { x0: 250, y0: 8 }; CARD = { x: 820, y: 150 };
    } else {
      VW = 1400; VH = 400; SH_BASE = 225; SH0 = SORT ? 60 : 80; SH_STEP = SORT ? 110 : 135;
      TRAY = { x0: 905, x1: 1385, y0: 22, y1: 210 }; RINSE = { x: 70, y: 322, r: 40 }; REST = { x: 150, y: 322 }; HOLD = { x: 860, y: 300 };
      BINS = [470, 610, 750]; BIN_W = 120; BIN_Y0 = 262; BIN_Y1 = 396;
      CUP_Y = 330; put(WATERS.pure, 730, 330); put(WATERS.tap, 815, 330);
      put(TOOLS.litmus, 935, 300); put(TOOLS.uni, 1010, 300); put(TOOLS.meter, 1085, 318); MRINSE = { x: 1205, y: 345, r: 34 };
      CHART = { x0: 720, y0: 14 }; CARD = { x: 1215, y: 92 };
    }
    var to = S.dropper.sample ? HOLD : REST; S.dropper.tx = S.dropper.x = to.x; S.dropper.ty = S.dropper.y = to.y;
  }
  function shelfX(i) { return SH0 + i * SH_STEP; }
  function cupPos(i) { return { x: shelfX(i), y: CUP_Y }; }

  // ---------- 圖 ----------
  var IMG = {};
  function img(n) { var im = IMG[n]; if (!im) { im = IMG[n] = new Image(); im.src = 'img/life/' + n; } return im.complete && im.naturalWidth ? im : null; }
  img('bg_kitchen.jpg'); L.samples.forEach(function (s) { img(s.img); });

  // ---------- 畫圖小工具 ----------
  function line(x0, y0, x1, y1, c, w) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
  function circ(x, y, r, fill, stroke, w) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = w || 1.5; ctx.stroke(); } }
  function rect(x0, y0, x1, y1, fill, stroke, w) { ctx.beginPath(); ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = w || 1.5; ctx.stroke(); } }
  function rrect(x, y, w, h, r, fill, stroke, lw) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); } }
  function text(t, x, y, o) { o = o || {}; ctx.font = (o.weight || 800) + ' ' + (o.size || 12) + 'px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif'; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle'; if (o.stroke) { ctx.lineWidth = o.sw || 3.5; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(t, x, y); } ctx.fillStyle = o.color || '#fff'; ctx.fillText(t, x, y); }
  function vs(n) { return n * view.s; }   // 桌面長度 → 螢幕 px
  function fs(n) { return Math.max(9, n * view.s); }   // 字的大小（最小 9 px）

  // ---------- 顏色：石蕊、廣用試紙 ----------
  function mixHex(a, b, t) { var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); function ch(p, s) { return (p >> s) & 255; } var r = Math.round(ch(pa, 16) + (ch(pb, 16) - ch(pa, 16)) * t), g = Math.round(ch(pa, 8) + (ch(pb, 8) - ch(pa, 8)) * t), bl = Math.round(ch(pa, 0) + (ch(pb, 0) - ch(pa, 0)) * t); return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1); }
  var LIT_RED = '#e0566e', LIT_BLUE = '#4f7fdc';
  function mixPH(main, res) {   // 滴管沒洗：這一滴有 9 成是新樣品、1 成是上一樣的殘留。示意算法（估計）：
    // 測鹼性的東西、殘留是酸（例如沾過醋的滴管去吸小蘇打水）：互相中和，往 7 靠；
    // 測酸性的東西時，醋、檸檬汁、可樂的酸比殘留的一點鹼多很多，只被中和一點點，照比例平均（藍色石蕊還是會變紅）
    if (main > 7 && res < 7) return 7 + (main - 7) * 0.4;
    return 0.9 * main + 0.1 * res;
  }
  function fizz(a, b) { var A = byKey(a), B = byKey(b); return (a === 'soda' && B.pH < 6) || (b === 'soda' && A.pH < 6); }   // 小蘇打碰到酸：冒二氧化碳氣泡
  function litmus(paper, pH) {   // 石蕊：pH 4.5 以下藍色試紙變紅；pH 8.3 以上紅色試紙變藍；中間是過渡（看起來幾乎不變）
    if (paper === 'red') { var t = clamp((pH - 7.6) / 0.7, 0, 1); return mixHex(LIT_RED, LIT_BLUE, t); }
    var u = clamp((5.2 - pH) / 0.7, 0, 1); return mixHex(LIT_BLUE, LIT_RED, u);
  }
  function litName(paper, pH) { var c = paper === 'red' ? (pH >= 8.3 ? '變藍' : pH > 7.6 ? '有一點點偏紫' : '沒變（還是紅）') : (pH <= 4.5 ? '變紅' : pH < 5.2 ? '有一點點偏紫' : '沒變（還是藍）'); return c; }
  var UNI = ['#d7262b', '#e8452a', '#f47b2a', '#f9a530', '#f4cf35', '#c9d23a', '#7dbf43', '#3daa6d', '#2a9a9b', '#2b7fc0', '#2f5aa8', '#45409a', '#55308a', '#4a2273'];   // 廣用試紙比色卡 pH 1～14（常見的色卡配色）
  function uniColor(pH) { var p = clamp(pH, 1, 14) - 1, i = Math.floor(p), t = p - i; return i >= 13 ? UNI[13] : mixHex(UNI[i], UNI[i + 1], t); }
  function uniName(pH) { var n = ['紅', '紅', '橘紅', '橘', '黃', '黃綠', '綠', '藍綠', '青', '藍', '靛', '紫', '紫', '深紫']; return n[clamp(Math.round(pH), 1, 14) - 1]; }

  // ---------- 特效 ----------
  var FX = { parts: [], pops: [], shake: 0 }, CONF = ['#ffd84d', '#ff6a55', '#5dffa0', '#7ce0ff', '#ffffff', '#c58cff'];
  function burst(x, y, n, o) { o = o || {}; for (var i = 0; i < n; i++) { var a = o.a0 !== undefined ? o.a0 + (Math.random() - 0.5) * (o.spread || 1) : Math.random() * Math.PI * 2, v = (o.v || 160) * (0.35 + Math.random() * 0.9); FX.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: -Math.sin(a) * v, g: o.g === undefined ? 420 : o.g, life: (o.life || 0.8) * (0.6 + Math.random() * 0.7), t: 0, c: o.colors ? o.colors[i % o.colors.length] : (o.color || '#ffd84d'), s: (o.size || 3) * (0.6 + Math.random() * 0.8), conf: !!o.confetti, rot: Math.random() * 6 }); } }
  function popup(t, x, y, o) { o = o || {}; FX.pops.push({ t: t, x: clamp(x, 50, W - 50), y: clamp(y, 30, H - 20), age: 0, life: o.life || 1.2, size: o.size || 22, color: o.color || '#ffd84d' }); }
  function stepFx(dt) {
    FX.parts = FX.parts.filter(function (p) { p.t += dt; p.vy += p.g * dt; if (p.conf) { p.vx *= 1 - 1.5 * dt; p.vy = Math.min(p.vy, 140); } p.x += p.vx * dt; p.y += p.vy * dt; return p.t < p.life; });
    FX.pops = FX.pops.filter(function (q) { q.age += dt; return q.age < q.life; });
    FX.shake *= Math.exp(-dt * 9); if (FX.shake < 0.3) FX.shake = 0;
  }
  function drawFx() {
    FX.parts.forEach(function (p) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); if (p.conf) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.t * 9); ctx.fillStyle = p.c; ctx.fillRect(-p.s, -p.s * 0.45, p.s * 2, p.s * 0.9); ctx.restore(); } else circ(p.x, p.y, p.s, p.c); });
    ctx.globalAlpha = 1;
    FX.pops.forEach(function (q) { var u = q.age / q.life, sc = q.age < 0.14 ? 0.4 + q.age / 0.14 * 0.8 : 1.2 - Math.min(0.2, (q.age - 0.14) * 1.4); ctx.globalAlpha = u > 0.7 ? Math.max(0, (1 - u) / 0.3) : 1; ctx.save(); ctx.translate(q.x, q.y - 28 * u); ctx.scale(sc, sc); text(q.t, 0, 0, { size: q.size, color: q.color, weight: 900, stroke: '#13233f', sw: Math.max(3.5, q.size / 6) }); ctx.restore(); });
    ctx.globalAlpha = 1;
  }

  // ---------- 場景 ----------
  function drawBg() {
    var im = img('bg_kitchen.jpg');
    if (!im) { ctx.fillStyle = '#9cc9b4'; ctx.fillRect(0, 0, W, H); return; }
    // 背景圖桌面後緣（圖上第 548 列）對到瓶子底下一點；左右不夠就鏡像接，上下不夠就補牆和桌面的顏色
    var k = view.s * (WIDE ? 0.8 : 1.05), w = im.naturalWidth * k, h = im.naturalHeight * k, x0 = X(VW / 2) - 768 * k, y0 = Y(SH_BASE - 15) - 548 * k;
    for (var i = Math.floor(-x0 / w); i <= Math.floor((W - x0) / w); i++) {
      var x = x0 + i * w;
      if (i % 2) { ctx.save(); ctx.translate(x + w, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, y0, w + 0.6, h); ctx.restore(); } else ctx.drawImage(im, x, y0, w + 0.6, h);
    }
    if (y0 > 0) { ctx.fillStyle = '#9fcfb6'; ctx.fillRect(0, 0, W, y0 + 1); }
    if (y0 + h < H) { ctx.fillStyle = '#c98f55'; ctx.fillRect(0, y0 + h - 1, W, H - y0 - h + 1); }
  }
  function sampleRect(s, i, scale) {   // 瓶子的位置（桌面座標）：在架上或在籃子裡
    var im = img(s.img), iw = im ? im.naturalWidth : 90, ih = im ? im.naturalHeight : 240, k = SH_K * (scale || 1);
    var bin = S.assign[s.key];
    if (SORT && bin) { var bi = BINS[['acid', 'neutral', 'base'].indexOf(bin)], inBin = L.samples.filter(function (q) { return S.assign[q.key] === bin; }), j = inBin.indexOf(s), n = inBin.length, kk = SH_K * 0.55; var cx = bi + (n > 1 ? (j - (n - 1) / 2) * Math.min(30, (BIN_W - 40) / (n - 1)) : 0); return { x: cx - iw * kk / 2, y: BIN_Y1 - 22 - ih * kk, w: iw * kk, h: ih * kk, cx: cx }; }
    var x = shelfX(i); return { x: x - iw * k / 2, y: SH_BASE - ih * k, w: iw * k, h: ih * k, cx: x };
  }
  function drawSample(s, i, inBasket) {
    if (S.drag && S.drag.k === s.key && S.drag.moved) return;
    if (SORT && !!S.assign[s.key] !== !!inBasket) return;
    var r = sampleRect(s, i), im = img(s.img);
    if (im) ctx.drawImage(im, X(r.x), Y(r.y), vs(r.w), vs(r.h)); else rect(X(r.x), Y(r.y), X(r.x + r.w), Y(r.y + r.h), s.liquid, '#13233f', 1.5);
    var inBin = SORT && S.assign[s.key];
    if (!inBin) { var tw = Math.max(54, s.name.length * 15 + 12); rrect(X(r.cx - tw / 2), Y(SH_BASE + 6), vs(tw), vs(22), vs(5), 'rgba(255,255,255,.92)', '#13233f', 1); text(s.name, X(r.cx), Y(SH_BASE + 17), { size: fs(13), color: '#13233f', weight: 900 }); }
    if (!SORT && S.choose) { var u = (performance.now() / 1000 * 1.3) % 1; ctx.strokeStyle = 'rgba(255,216,77,' + fx(1 - u, 2) + ')'; ctx.lineWidth = 3; ctx.strokeRect(X(r.x) - 4 - u * 6, Y(r.y) - 4 - u * 6, vs(r.w) + 8 + u * 12, vs(r.h) + 8 + u * 12); }
  }
  function drawBeaker(cx, cy, w, h, liquid, level, label) {   // 小燒杯（桌面座標）
    var x0 = X(cx - w / 2), x1 = X(cx + w / 2), y0 = Y(cy - h / 2), y1 = Y(cy + h / 2);
    if (level > 0) { var ly = y1 - (y1 - y0) * level; rect(x0 + 2, ly, x1 - 2, y1 - 2, liquid); }
    ctx.strokeStyle = '#eef6ff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y0); ctx.stroke();
    ctx.strokeStyle = 'rgba(19,35,63,.55)'; ctx.lineWidth = 1; ctx.stroke();
    if (label) text(label, (x0 + x1) / 2, y1 + fs(10), { size: fs(11), color: '#13233f', weight: 900, stroke: 'rgba(255,255,255,.85)', sw: 3 });
  }
  function drawDropper(x, y, liquid) {   // 滴管：橡皮頭在上、玻璃管在下，尖端在 (x, y)
    var gx0 = X(x - 5), gx1 = X(x + 5), top = Y(y - 70), tip = Y(y);
    if (liquid) rect(gx0 + 1, Y(y - 30), gx1 - 1, Y(y - 6), liquid);
    ctx.strokeStyle = '#eef6ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx0, Y(y - 50)); ctx.lineTo(gx0, Y(y - 10)); ctx.lineTo(X(x - 1.5), tip); ctx.lineTo(X(x + 1.5), tip); ctx.lineTo(gx1, Y(y - 10)); ctx.lineTo(gx1, Y(y - 50)); ctx.stroke();
    ctx.strokeStyle = 'rgba(19,35,63,.5)'; ctx.lineWidth = 1; ctx.stroke();
    rrect(X(x - 8), top, vs(16), vs(22), vs(7), '#e5484d', '#7a1d22', 1.2);
  }
  function drawSortTable() {
    // 清水杯（洗滴管）、滴管架
    drawBeaker(RINSE.x, RINSE.y, 70, 80, 'rgba(160,210,240,.55)', 0.7, '清水（洗滴管）');
    rect(X(REST.x - 14), Y(REST.y + 2), X(REST.x + 14), Y(REST.y + 12), '#8a5a32', '#13233f', 1);
    // 試紙盤：每樣東西固定一格（每格一張紅色、一張藍色石蕊），重測就換一組新試紙
    rrect(X(TRAY.x0), Y(TRAY.y0), vs(TRAY.x1 - TRAY.x0), vs(TRAY.y1 - TRAY.y0), vs(10), 'rgba(255,255,255,.88)', '#13233f', 1.5);
    text('試紙盤（點這裡滴一滴）', X((TRAY.x0 + TRAY.x1) / 2), Y(TRAY.y0 + 14), { size: fs(13), color: '#13233f', weight: 900 });
    var n = 8, sw = (TRAY.x1 - TRAY.x0 - 20) / n;
    for (var i = 0; i < n; i++) {
      var cx = TRAY.x0 + 10 + sw * (i + 0.5), t = S.tests[L.samples[i].key];
      [['red', -11], ['blue', 11]].forEach(function (pp) {
        var px = cx + pp[1], base = pp[0] === 'red' ? LIT_RED : LIT_BLUE;
        rect(X(px - 8), Y(TRAY.y0 + 30), X(px + 8), Y(TRAY.y0 + 120), base, '#13233f', 1);   // 試紙 9 cm 長（桌面單位）
        if (t) {
          var age = Math.min(1, t.age / 0.5), rr = vs(8.5) * (0.4 + 0.6 * age), col = litmus(pp[0], t.pH);   // 試紙只會有一種顏色（混到東西時是混合後的 pH）
          ctx.save(); ctx.beginPath(); ctx.rect(X(px - 8), Y(TRAY.y0 + 30), vs(16), vs(90)); ctx.clip();
          circ(X(px), Y(TRAY.y0 + 72), rr * 1.35, 'rgba(255,255,255,.18)');
          circ(X(px), Y(TRAY.y0 + 72), rr, col);
          if (t.fizz && t.age < 2.5) { for (var b2 = 0; b2 < 4; b2++) { var ph = (t.age * 1.6 + b2 * 0.25) % 1; circ(X(px - 4 + b2 * 2.5), Y(TRAY.y0 + 72) - ph * vs(18), Math.max(1, vs(1.6)), null, 'rgba(255,255,255,' + fx(1 - ph, 2) + ')', 1); } }   // 醋碰小蘇打：冒泡
          ctx.restore();
        }
      });
      text(L.samples[i].name, X(cx), Y(TRAY.y0 + 140), { size: fs(11), color: t ? '#13233f' : '#9aa7b6', weight: 900 });
      if (t && t.mix) text('不準？', X(cx), Y(TRAY.y0 + 160), { size: fs(11), color: '#e5484d', weight: 900 });
    }
    text('紅  藍', X(TRAY.x0 + 10 + sw * 0.5), Y(TRAY.y0 + 24), { size: fs(9), color: '#46546b', weight: 800 });
    // 三個籃子：後片 → 放進去的瓶子 → 前片（瓶子下半截藏在籃子裡）
    L.bins.forEach(function (b, i) {
      var cx = BINS[i], top = BIN_Y0 + 30, x0 = X(cx - BIN_W / 2), x1 = X(cx + BIN_W / 2), y0 = Y(top), y1 = Y(BIN_Y1), hot = S.drag && S.drag.moved && S.drag.over === b.cat;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(X(cx + BIN_W / 2 - 8), y1); ctx.lineTo(X(cx - BIN_W / 2 + 8), y1); ctx.closePath(); ctx.fillStyle = '#7a4f24'; ctx.fill();
      ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, y0, (x1 - x0) / 2, vs(7), 0, 0, Math.PI * 2); ctx.fillStyle = '#5a3a12'; ctx.fill();
      L.samples.forEach(function (q, k) { if (S.assign[q.key] === b.cat) drawSample(q, k, true); });
      var fy = Y(top + (BIN_Y1 - top) * 0.42);
      ctx.beginPath(); ctx.moveTo(X(cx - BIN_W / 2 + 3), fy); ctx.lineTo(X(cx + BIN_W / 2 - 3), fy); ctx.lineTo(X(cx + BIN_W / 2 - 8), y1); ctx.lineTo(X(cx - BIN_W / 2 + 8), y1); ctx.closePath();
      ctx.fillStyle = hot ? '#d9a35e' : '#b07a3e'; ctx.fill(); ctx.strokeStyle = '#5a3a12'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(90,58,18,.45)'; ctx.lineWidth = 1; for (var k2 = 1; k2 < 3; k2++) { var yy = fy + (y1 - fy) * k2 / 3; ctx.beginPath(); ctx.moveTo(X(cx - BIN_W / 2 + 6), yy); ctx.lineTo(X(cx + BIN_W / 2 - 6), yy); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, y0, (x1 - x0) / 2, vs(7), 0, 0, Math.PI); ctx.strokeStyle = '#3a240c'; ctx.lineWidth = 2; ctx.stroke();
      var lw = b.cat === 'neutral' ? 64 : 50;
      rrect(X(cx - lw / 2), (fy + y1) / 2 - vs(13), vs(lw), vs(26), vs(6), hot ? '#ffd84d' : (b.cat === 'acid' ? '#ffd6d6' : b.cat === 'base' ? '#d6e4ff' : '#e9f6e2'), '#13233f', 1.5);
      text(b.name.replace('（接近中性）', ''), X(cx), (fy + y1) / 2, { size: fs(14), color: '#13233f', weight: 900 });
      var inB = L.samples.filter(function (q) { return S.assign[q.key] === b.cat; });
      if (!inB.length) text('拖到這裡', X(cx), Y(top - 14), { size: fs(11), color: '#fff', weight: 800, stroke: '#13233f' });
      else inB.forEach(function (q, j) { text(q.name, X(cx), Y(top - 12) - j * (fs(10) + 2), { size: fs(10), color: '#fff', weight: 800, stroke: '#3a240c', sw: 3 }); });   // 籃子上方列出裡面有什麼
    });
  }
  function drawSkinTable() {
    // 稀釋用的水：純水、自來水（選到的會亮）
    var pw = WATERS.pure, tw = WATERS.tap, imw = img('water.png');
    [['pure', pw], ['tap', tw]].forEach(function (q) { if (S.water === q[0]) { circ(X(q[1].x), Y(q[1].y), vs(38), 'rgba(255,216,77,.35)', '#ffd84d', 3); } });
    if (imw) { var k = SH_K * 0.5; ctx.drawImage(imw, X(pw.x - imw.naturalWidth * k / 2), Y(pw.y + 35 - imw.naturalHeight * k), vs(imw.naturalWidth * k), vs(imw.naturalHeight * k)); }
    text('純水', X(pw.x), Y(pw.y + 48), { size: fs(12), color: '#13233f', weight: 900, stroke: 'rgba(255,255,255,.9)', sw: 3 });
    // 自來水：水龍頭
    rect(X(tw.x - 30), Y(tw.y - 40), X(tw.x - 22), Y(tw.y + 35), '#9aa7b6', '#13233f', 1); rect(X(tw.x - 22), Y(tw.y - 32), X(tw.x + 18), Y(tw.y - 22), '#c9d2dc', '#13233f', 1);
    rect(X(tw.x + 12), Y(tw.y - 22), X(tw.x + 18), Y(tw.y - 12), '#c9d2dc', '#13233f', 1); rrect(X(tw.x - 32), Y(tw.y - 48), vs(14), vs(8), vs(3), '#3c8dde', '#13233f', 1);
    if (S.water === 'tap') { line(X(tw.x + 15), Y(tw.y - 12), X(tw.x + 15), Y(tw.y + 30), 'rgba(160,210,240,.8)', vs(3)); }
    text('自來水', X(tw.x), Y(tw.y + 48), { size: fs(12), color: '#13233f', weight: 900, stroke: 'rgba(255,255,255,.9)', sw: 3 });
    // 每一瓶前面的小杯子（10% 稀釋液）＋量到的結果
    L.samples.forEach(function (s, i) {
      var c = cupPos(i), cup = S.cups[s.key];
      drawBeaker(c.x, c.y, 54, 62, cup ? mixHex(s.liquid, '#dff0fb', 0.6) : null, cup ? 0.6 : 0, cup ? '10%（' + (cup.water === 'pure' ? '純水' : '自來水') + '）' : '點瓶子稀釋');
      if (!cup) return;
      var res = cup.res, rx = c.x + 34;
      if (res.uni) { rect(X(rx), Y(c.y - 30), X(rx + 9), Y(c.y + 20), '#f3e6c4', '#13233f', 1); rect(X(rx), Y(c.y - 6), X(rx + 9), Y(c.y + 20), uniColor(cup.pH), null); }
      if (res.lit) { rect(X(rx + 12), Y(c.y - 30), X(rx + 19), Y(c.y + 20), litmus('red', cup.pH), '#13233f', 1); rect(X(rx + 21), Y(c.y - 30), X(rx + 28), Y(c.y + 20), litmus('blue', cup.pH), '#13233f', 1); }
      if (res.meter !== undefined) { rrect(X(c.x - 34), Y(c.y - 62), vs(68), vs(22), vs(5), '#13233f', '#7ce0ff', 1.5); text('pH ' + fx(res.meter, 1), X(c.x), Y(c.y - 51), { size: fs(13), color: '#7ce0ff', weight: 900 }); }
    });
    // 量具
    Object.keys(TOOLS).forEach(function (k) {
      var t = TOOLS[k], sel = S.tool === k;
      if (sel) circ(X(t.x), Y(t.y), vs(36), 'rgba(255,216,77,.35)', '#ffd84d', 3);
      if (k === 'litmus') { rrect(X(t.x - 22), Y(t.y - 26), vs(44), vs(52), vs(5), '#fff', '#13233f', 1.5); rect(X(t.x - 14), Y(t.y - 18), X(t.x - 3), Y(t.y + 18), LIT_RED); rect(X(t.x + 3), Y(t.y - 18), X(t.x + 14), Y(t.y + 18), LIT_BLUE); }
      if (k === 'uni') { rrect(X(t.x - 22), Y(t.y - 26), vs(44), vs(52), vs(5), '#fff', '#13233f', 1.5); for (var j = 0; j < 7; j++) rect(X(t.x - 16 + j * 4.6), Y(t.y - 14), X(t.x - 11.4 + j * 4.6), Y(t.y + 14), UNI[j * 2]); }
      if (k === 'meter') { rrect(X(t.x - 22), Y(t.y - 34), vs(44), vs(60), vs(7), '#2a313b', '#13233f', 1.5); rect(X(t.x - 16), Y(t.y - 26), X(t.x + 16), Y(t.y - 8), '#b8f0c8'); text(S.meterLast ? fx(S.cups[S.meterLast].res.meter, 1) : '--.-', X(t.x), Y(t.y - 17), { size: fs(11), color: '#13233f', weight: 900 }); line(X(t.x), Y(t.y + 26), X(t.x - 20), Y(t.y + 70), '#2a313b', vs(3)); rect(X(t.x - 25), Y(t.y + 66), X(t.x - 15), Y(t.y + 92), '#c9d2dc', '#13233f', 1); }
      text(t.name, X(t.x), Y(t.y + (k === 'meter' ? 40 : 36)), { size: fs(11), color: '#13233f', weight: 900, stroke: 'rgba(255,255,255,.9)', sw: 3 });
    });
    drawBeaker(MRINSE.x - 25, MRINSE.y + 5, 50, 52, 'rgba(160,210,240,.55)', 0.7, '純水（洗電極）');
    // 上面：廣用試紙比色卡、皮膚 pH 卡
    var cx0 = CHART.x0, cy0 = CHART.y0, cw = 34;
    rrect(X(cx0 - 10), Y(cy0), vs(cw * 14 + 20), vs(46), vs(6), 'rgba(255,255,255,.92)', '#13233f', 1.2);
    for (var p = 1; p <= 14; p++) { rect(X(cx0 + (p - 1) * cw + 2), Y(cy0 + 6), X(cx0 + p * cw - 2), Y(cy0 + 26), UNI[p - 1]); text(String(p), X(cx0 + (p - 0.5) * cw), Y(cy0 + 36), { size: fs(10), color: '#13233f', weight: 900 }); }
    text('廣用試紙比色卡', X(cx0 + cw * 7), Y(cy0 + 56), { size: fs(11), color: '#13233f', weight: 900, stroke: 'rgba(255,255,255,.9)', sw: 3 });
    ctx.font = '900 ' + fs(12) + 'px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
    var cw2 = Math.max(vs(170), ctx.measureText('約 pH 4.7～5.9（弱酸性）').width + 16), ccx = X(CARD.x + 85);
    rrect(ccx - cw2 / 2, Y(CARD.y), cw2, Math.max(vs(64), fs(13) + fs(12) + 18), vs(8), '#fff3ef', '#b0412e', 1.5);
    text('健康皮膚表面', ccx, Y(CARD.y) + fs(13) * 0.5 + 6, { size: fs(13), color: '#b0412e', weight: 900 }); text('約 pH 4.7～5.9（弱酸性）', ccx, Y(CARD.y) + fs(13) + fs(12) * 0.5 + 10, { size: fs(12), color: '#13233f', weight: 900 });
  }
  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (FX.shake) ctx.translate((Math.random() - 0.5) * FX.shake * 2, (Math.random() - 0.5) * FX.shake * 2);
    drawBg();
    L.samples.forEach(function (s, i) { drawSample(s, i, false); });
    if (SORT) { drawSortTable(); L.samples.forEach(function (s, i) { if (S.assign[s.key] && S.wrong[s.key]) { var r = sampleRect(s, i); text('✗', X(r.cx), Y(r.y - 4), { size: fs(22), color: '#ff3b3b', weight: 900, stroke: '#fff' }); } }); } else drawSkinTable();
    if (SORT) { var d = S.dropper, liq = d.sample ? byKey(d.sample).liquid : null; drawDropper(d.x, d.y, liq); if (d.sample) text('滴管：' + byKey(d.sample).name + (d.mix ? '（混到' + byKey(d.mix).name + '）' : ''), X(d.x + 14), Y(d.y - 40), { size: fs(12), color: '#fff', weight: 900, stroke: '#13233f', align: 'left' }); }
    if (S.drag && S.drag.moved) { var s = byKey(S.drag.k), im = img(s.img); if (im) { var k = SH_K * 0.6; ctx.globalAlpha = 0.9; ctx.drawImage(im, S.drag.px - vs(im.naturalWidth * k) / 2, S.drag.py - vs(im.naturalHeight * k) * 0.8, vs(im.naturalWidth * k), vs(im.naturalHeight * k)); ctx.globalAlpha = 1; } }
    drawFx();
    if (H > W * 1.05) {   // 手機直放：器材多、字會擠在一起，請橫放
      ctx.fillStyle = 'rgba(11,21,40,.78)'; ctx.fillRect(0, 0, W, H);
      rrect(W / 2 - 34, H / 2 - 62, 68, 40, 8, null, '#fff', 3); circ(W / 2 + 26, H / 2 - 42, 2.5, '#fff');   // 橫放的手機
      ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(W / 2, H / 2 - 42, 46, Math.PI * 1.15, Math.PI * 1.55); ctx.stroke();
      text('這關器材比較多', W / 2, H / 2 + 10, { size: 18, color: '#fff', weight: 900 });
      text('請把手機橫放（或用平板、電腦）', W / 2, H / 2 + 38, { size: 15, color: '#ffd84d', weight: 900 });
    }
  }

  // ---------- 操作 ----------
  function toolsBar() {
    var h = '';
    if (SORT) {
      var d = S.dropper, st = d.sample ? '裝著 ' + byKey(d.sample).name : d.residue ? '空的，殘留 ' + byKey(d.residue).name + '（要先洗）' : '空的、乾淨';
      h += '<div class="cg"><span class="cl">滴管</span><span class="cv state">' + st + '</span></div>';
      h += '<button type="button" data-act="rinse">洗滴管</button>';
      var left = L.samples.filter(function (s) { return !S.assign[s.key]; }).length;
      h += '<button type="button" class="go" data-act="submit">交件' + (left ? '（還有 ' + left + ' 樣）' : '') + '</button>';
    } else {
      h += '<div class="cg"><span class="cl">稀釋用水</span>' + ['pure', 'tap'].map(function (k) { return '<button type="button" data-water="' + k + '"' + (S.water === k ? ' class="on"' : '') + '>' + WATERS[k].name + '</button>'; }).join('') + '</div>';
      h += '<div class="cg"><span class="cl">量具</span>' + Object.keys(TOOLS).map(function (k) { return '<button type="button" data-tool="' + k + '"' + (S.tool === k ? ' class="on"' : '') + '>' + TOOLS[k].name + '</button>'; }).join('') + '</div>';
      h += '<button type="button" data-act="mrinse">洗 pH 計</button>';
      h += '<button type="button" class="go" data-act="choose">' + (S.choose ? '取消選擇' : '選這瓶') + '</button>';
    }
    bar.innerHTML = h;
  }
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || S.over) return;
    var act = b.getAttribute('data-act'), wk = b.getAttribute('data-water'), tk = b.getAttribute('data-tool');
    if (act === 'rinse') rinse(); else if (act === 'submit') submit(); else if (act === 'mrinse') meterRinse(); else if (act === 'choose') { S.choose = !S.choose; sfx('ui_tap'); if (S.choose) toast('點你要選給好朋友的那一瓶。'); toolsBar(); }
    else if (wk) { S.water = wk; sfx('ui_tap'); toolsBar(); }
    else if (tk) { S.tool = tk; sfx('ui_tap'); toolsBar(); }
  });

  function moveDropper(x, y) { S.dropper.tx = x; S.dropper.ty = y; }
  function suck(k) {
    var d = S.dropper, s = byKey(k);
    d.mix = d.residue && d.residue !== k ? d.residue : (d.sample && d.sample !== k ? d.sample : null);
    d.sample = k; d.residue = k;
    var r = sampleRect(s, L.samples.indexOf(s)); d.x = r.cx; d.y = r.y + 10; moveDropper(HOLD.x, HOLD.y);
    sfx('item_pick');
    if (d.mix) toast('滴管裡還有「' + byKey(d.mix).name + '」沒洗掉，現在混在一起了。'); else hideToast();
    toolsBar();
  }
  function dropTest() {
    var d = S.dropper;
    if (!d.sample) { toast('先點一瓶，用滴管吸一點樣品。'); sfx('warn'); return; }
    var t = { k: d.sample, mix: d.mix, age: 0, pH: d.mix ? mixPH(byKey(d.sample).pH, byKey(d.mix).pH) : byKey(d.sample).pH, fizz: !!d.mix && fizz(d.sample, d.mix) }; S.tests[t.k] = t;
    var s = byKey(t.k);
    if (t.mix) { S.dirty++; toast(t.fizz ? '冒泡了！小蘇打碰到酸起反應（產生二氧化碳），結果會不準。先洗滴管再測。' : '滴管沒洗：上一樣東西混進來了，這次的顏色不準。先洗滴管再測。'); }
    dataBox.innerHTML = '<b>' + s.name + '</b>　紅色石蕊：' + litName('red', t.pH) + '　藍色石蕊：' + litName('blue', t.pH) + (t.mix ? '<br><span class="miss">滴管沒洗，混到「' + byKey(t.mix).name + '」' + (t.fizz ? '（冒泡、互相中和）' : '') + '，這次的結果不準</span>' : '');
    dataBox.hidden = false;
    var sw = (TRAY.x1 - TRAY.x0 - 20) / 8; burst(X(TRAY.x0 + 10 + sw * 0.5), Y(TRAY.y0 + 72), 8, { color: s.liquid === '#5a2a12' ? '#7a4a2a' : '#bfe3ff', v: 70, life: 0.4, size: 2 });
    d.sample = null; d.mix = null; moveDropper(HOLD.x, HOLD.y);
    sfx('item_place'); toolsBar();
  }
  function rinse() {
    var d = S.dropper; d.sample = null; d.residue = null; d.mix = null; d.x = RINSE.x; d.y = RINSE.y - 10; moveDropper(REST.x, REST.y);
    burst(X(RINSE.x), Y(RINSE.y - 20), 10, { color: '#bfe3ff', v: 60, g: -40, life: 0.6, size: 2.5 });
    sfx('pour'); toast('滴管洗乾淨了。'); toolsBar();
  }
  function submit() {
    var left = L.samples.filter(function (s) { return !S.assign[s.key]; });
    if (left.length) { toast('還有 ' + left.length + ' 樣沒放進籃子：' + left.map(function (s) { return s.name; }).join('、') + '。'); sfx('warn'); return; }
    S.submits++; S.wrong = {};
    var bad = L.samples.filter(function (s) { return S.assign[s.key] !== s.cat; });
    bad.forEach(function (s) { S.wrong[s.key] = true; });
    if (!bad.length) return win([true, S.submits === 1, S.dirty === 0]);
    sfx('miss'); FX.shake = calm ? 0 : 4;
    dataBox.innerHTML = '<b>第 ' + S.submits + ' 次交件</b>：有 <span class="miss">' + bad.length + ' 樣放錯</span>（打 ✗ 的）。<br>' + L.fail; dataBox.hidden = false;
    toast('有 ' + bad.length + ' 樣放錯了，打 ✗ 的再測一次看看。');
  }
  // 第 2 關
  function dilute(k) {
    if (!S.water) { toast('先點一瓶水，選好要用純水還是自來水稀釋。'); sfx('warn'); return; }
    var s = byKey(k), pH = s.pH + (S.water === 'tap' ? (s.pH < 7.5 ? L.tapShift : L.tapShiftHigh) : 0);
    S.cups[k] = { water: S.water, pH: pH, res: {} }; if (S.water === 'tap') S.usedTap = true;
    if (S.meterLast === k) S.meterLast = null;
    var c = cupPos(L.samples.indexOf(s)); burst(X(c.x), Y(c.y - 10), 10, { color: '#bfe3ff', v: 60, g: 200, life: 0.5, size: 2 });
    sfx('pour'); toast(s.name + '：用' + (S.water === 'pure' ? '純水' : '自來水') + '稀釋成 10%。');
  }
  function measure(k) {
    var s = byKey(k), cup = S.cups[k];
    if (!cup) { toast('先稀釋：點後面的' + s.name + '，倒一點到小杯子加水。'); sfx('warn'); return; }
    if (!S.tool) { toast('先在右邊選一種量具（石蕊試紙、廣用試紙或 pH 計）。'); sfx('warn'); return; }
    var c = cupPos(L.samples.indexOf(s)), msg = '';
    if (S.tool === 'litmus') { cup.res.lit = true; msg = '石蕊：紅色' + litName('red', cup.pH) + '、藍色' + litName('blue', cup.pH) + '（石蕊分不出強弱）'; }
    if (S.tool === 'uni') { cup.res.uni = true; msg = '廣用試紙變成「' + uniName(cup.pH) + '色」→ 對上面的比色卡看是 pH 多少'; }
    if (S.tool === 'meter') {
      var v = cup.pH;
      if (S.meterLast && S.meterLast !== k) { var prev = S.cups[S.meterLast]; v = 0.8 * cup.pH + 0.2 * prev.pH; S.dirty++; msg = '（電極沒洗，上一杯混進來了，讀數不準）'; }
      cup.res.meter = Math.round(v * 10) / 10; S.meterLast = k; msg = 'pH 計：' + fx(cup.res.meter, 1) + ' ' + msg;
    }
    dataBox.innerHTML = '<b>' + s.name + '</b>（10%、' + (cup.water === 'pure' ? '純水' : '自來水') + '稀釋）　' + msg; dataBox.hidden = false;
    burst(X(c.x + 30), Y(c.y), 6, { color: '#ffffff', v: 50, life: 0.35, size: 2 }); sfx('item_place');
  }
  function meterRinse() { S.meterLast = null; burst(X(MRINSE.x - 25), Y(MRINSE.y - 10), 10, { color: '#bfe3ff', v: 60, g: -40, life: 0.6, size: 2.5 }); sfx('pour'); toast('pH 計的電極用純水洗乾淨了。'); }
  function answer(k) {
    S.picks++; S.choose = false; toolsBar();
    var s = byKey(k);
    if (k === L.answer) return win([true, S.picks === 1, !S.usedTap && S.dirty === 0]);
    sfx('miss');
    var cup = S.cups[k], hint = cup && (cup.res.meter !== undefined || cup.res.uni) ? s.name + ' 量起來大約 pH ' + (cup.res.meter !== undefined ? fx(cup.res.meter, 1) : fx(cup.pH, 0)) + '，離皮膚的 4.7～5.9 還有一段距離。' : '你還沒量「' + s.name + '」的 pH。先量完 5 瓶再比。';
    dataBox.innerHTML = '<b>不是這瓶</b>：' + hint + '<br>' + L.fail; dataBox.hidden = false; toast(hint);
  }

  // ---------- 指標：點、拖 ----------
  function evPos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function hitSample(v) {
    for (var i = L.samples.length - 1; i >= 0; i--) { var s = L.samples[i], r = sampleRect(s, i), pad = 8; if (v.x >= r.x - pad && v.x <= r.x + r.w + pad && v.y >= r.y - pad && v.y <= r.y + r.h + 24) return s; }
    return null;
  }
  function binAt(v) { for (var i = 0; i < 3; i++) if (Math.abs(v.x - BINS[i]) <= BIN_W / 2 + 6 && v.y >= BIN_Y0 - 30 && v.y <= BIN_Y1 + 10) return L.bins[i].cat; return null; }
  function near(v, p, r) { return Math.hypot(v.x - p.x, v.y - p.y) <= r; }
  cv.addEventListener('pointerdown', function (e) {
    if (S.over) return;
    var p = evPos(e), v = toV(p.x, p.y), s = hitSample(v);
    if (s) { S.drag = { k: s.key, x0: p.x, y0: p.y, px: p.x, py: p.y, moved: false, over: null }; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件 */ } return; }
    if (SORT) {
      if (v.x >= TRAY.x0 && v.x <= TRAY.x1 && v.y >= TRAY.y0 && v.y <= TRAY.y1) return dropTest();
      if (near(v, RINSE, RINSE.r + 10) || near(v, REST, 40)) return rinse();
    } else {
      if (near(v, WATERS.pure, 42)) { S.water = 'pure'; sfx('ui_tap'); toolsBar(); return; }
      if (near(v, WATERS.tap, 42)) { S.water = 'tap'; sfx('ui_tap'); toolsBar(); return; }
      for (var k in TOOLS) if (near(v, TOOLS[k], 38)) { S.tool = k; sfx('ui_tap'); toolsBar(); return; }
      if (near(v, { x: MRINSE.x - 25, y: MRINSE.y }, 36)) return meterRinse();
      for (var i = 0; i < L.samples.length; i++) { var c = cupPos(i); if (Math.abs(v.x - c.x) <= 34 && v.y >= c.y - 70 && v.y <= c.y + 44) return measure(L.samples[i].key); }
    }
  });
  cv.addEventListener('pointermove', function (e) {
    var d = S.drag; if (!d) return; var p = evPos(e);
    if (!d.moved && Math.hypot(p.x - d.x0, p.y - d.y0) < 10) return;
    if (!SORT) return;   // 第 2 關不用拖
    d.moved = true; d.px = p.x; d.py = p.y; d.over = binAt(toV(p.x, p.y));
  });
  function endDrag(e) {
    var d = S.drag; if (!d) return; S.drag = null;
    if (!d.moved) { if (SORT) suck(d.k); else if (S.choose) answer(d.k); else dilute(d.k); return; }
    var v = toV(d.px, d.py), bin = binAt(v);
    if (bin) { S.assign[d.k] = bin; delete S.wrong[d.k]; sfx('item_place'); }
    else if (v.y < SH_BASE + 30) { delete S.assign[d.k]; delete S.wrong[d.k]; sfx('ui_tap'); }
    toolsBar();
  }
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', function () { S.drag = null; });

  // ---------- 結果 ----------
  function win(got) {
    S.over = true; var n = got.filter(Boolean).length;
    if (window.LabRecords) window.LabRecords.onPass(L.id, n);
    sfx('pass'); for (var k = 1; k <= n; k++) sfx('star' + k, 1.15 + 0.34 * (k - 1));
    popup('過關！', W / 2, H * 0.4, { size: 46, life: 1.6 });
    for (var c = 0; c < 6; c++) burst(W * (c + 0.5) / 6, -10, 16, { confetti: true, v: 120, g: 260, colors: CONF, life: 2.2, size: 4.5, a0: -Math.PI / 2, spread: 2.2 });
    var tbl = '<table class="ph"><tr><th>樣品</th><th>pH</th><th>出處</th></tr>' + L.samples.map(function (s) { return '<tr><td>' + s.name + '</td><td>' + fx(s.pH, 1) + '</td><td>' + s.src + '</td></tr>'; }).join('') + '</table>';
    setTimeout(function () {
      openSheet('<div class="stars">' + [0, 1, 2].map(function (i) { return '<span' + (got[i] ? '' : ' class="off"') + '>★</span>'; }).join('') + '</div><h2>過關！</h2>' + (L.win ? '<p class="say">' + L.win + '</p>' : '') +
        '<ul>' + L.stars.map(function (s, i) { return '<li>' + (got[i] ? '✓ ' : '✗ ') + s + '</li>'; }).join('') + '</ul>' +
        '<div class="learn"><b>背後的科學</b><br>' + L.learn + '</div><div class="learn">' + tbl + '</div>' +
        '<div class="learn src"><b>數據出處</b><br>' + L.src + '</div>' +
        '<div class="row"><a href="life.html?lv=' + no + '">再玩一次</a>' + (no < LV.length ? '<a class="go" href="life.html?lv=' + (no + 1) + '">下一關</a>' : '<a class="go" href="index.html">關卡列表</a>') + '</div>');
    }, 1300);
  }
  function openSheet(h) { var sh = $('#sheet'); sh.innerHTML = h; $('#ov').classList.add('show'); var a = $('#sheet .go'); if (a) { try { a.focus({ preventScroll: true }); } catch (e) { a.focus(); } } sh.scrollTop = 0; }
  var toastT = 0;
  function toast(t) { var el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, 2800); }
  function hideToast() { $('#toast').classList.remove('show'); }
  function showBrief(again) {   // 委託單（手機橫放時任務列收起來，按標題列的「任務」再看一次）
    openSheet('<div class="brief"><span class="tag">' + (again ? '任務' : '新挑戰') + '</span><h2>' + L.title + '</h2><p class="topic">' + L.stage + (L.topic ? '・' + L.topic : '') + '</p>' +
      '<ul class="story">' + L.story.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul><div class="goal"><b>任務</b>' + L.mission + '</div>' +
      '<p class="how-brief"><b>怎麼操作</b>　' + L.note + '</p>' +
      '<div class="row"><a href="index.html">換一個挑戰</a><button type="button" class="go" id="accept">' + (again ? '繼續' : '開始') + '</button></div></div>');
    $('#accept').addEventListener('click', function () { $('#ov').classList.remove('show'); sfx('ui_tap'); });
  }

  // ---------- 主迴圈 ----------
  var tPrev = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    var dt = tPrev ? Math.min(0.05, (ts - tPrev) / 1000) : 0; tPrev = ts;
    var d = S.dropper, a = Math.min(1, dt * 8); d.x += (d.tx - d.x) * a; d.y += (d.ty - d.y) * a;
    Object.keys(S.tests).forEach(function (k) { S.tests[k].age += dt; });
    stepFx(dt); draw();
  }
  $('#stage').textContent = L.stage; $('#title').textContent = L.title; $('#diff').textContent = L.diff;
  $('#missionText').textContent = L.mission; $('#howText').textContent = L.note; document.title = '瘋狂實驗室｜' + L.title;
  $('#btnHow').addEventListener('click', function () { var hw = $('#howText'); hw.hidden = !hw.hidden; this.setAttribute('aria-expanded', String(!hw.hidden)); this.textContent = hw.hidden ? '怎麼操作' : '收起'; $('#mission').classList.toggle('open', !hw.hidden); resize(); });
  var bb = $('#btnBrief'); if (bb) bb.addEventListener('click', function () { if (!S.over) { showBrief(true); sfx('ui_tap'); } });
  var sb = $('#btnSfx');
  var SPK = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var SPKX = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function showSfx(m) { sb.innerHTML = m ? SPKX : SPK; sb.setAttribute('aria-pressed', String(!m)); sb.setAttribute('aria-label', m ? '音效：關' : '音效：開'); }
  if (window.LabSfx) { showSfx(window.LabSfx.isMuted()); window.LabSfx.onChange(showSfx); sb.addEventListener('click', function () { window.LabSfx.setMuted(!window.LabSfx.isMuted()); sfx('ui_tap'); }); } else sb.hidden = true;
  if (window.LabRecords) window.LabRecords.markPlay();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap); else window.addEventListener('resize', resize);
  resize(); toolsBar(); showBrief();
  requestAnimationFrame(loop);
  function where(k) {   // 測試用：瓶子、籃子、試紙盤、清水杯在畫面上的位置（CSS px，相對畫布左上角）
    if (k === 'tray') return { x: X((TRAY.x0 + TRAY.x1) / 2), y: Y((TRAY.y0 + TRAY.y1) / 2) };
    if (k === 'rinse') return { x: X(RINSE.x), y: Y(RINSE.y) };
    var bi = ['acid', 'neutral', 'base'].indexOf(k); if (bi >= 0) return { x: X(BINS[bi]), y: Y((BIN_Y0 + BIN_Y1) / 2) };
    if (TOOLS[k]) return { x: X(TOOLS[k].x), y: Y(TOOLS[k].y) };
    if (WATERS[k]) return { x: X(WATERS[k].x), y: Y(WATERS[k].y) };
    var s = byKey(k.replace(/^cup:/, '')), i = L.samples.indexOf(s);
    if (/^cup:/.test(k)) { var c = cupPos(i); return { x: X(c.x), y: Y(c.y) }; }
    var r = sampleRect(s, i); return { x: X(r.cx), y: Y(r.y + r.h * 0.6) };
  }
  window.__life = { S: S, L: L, where: where, suck: suck, dropTest: dropTest, rinse: rinse, submit: submit, dilute: dilute, measure: measure, answer: answer, meterRinse: meterRinse, toolsBar: toolsBar };
})();
