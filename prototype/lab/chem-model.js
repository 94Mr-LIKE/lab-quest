/* 瘋狂實驗室・化學實驗台：溶液、容器、反應的計算（不碰畫面，Node 也能跑來驗算）
 * 單位：體積 mL、物質量 mol、質量 g、溫度 °C；畫面長度 cm（y 朝上，桌面 y = 0）。
 * 簡化模型（寫在說明裡）：
 *   - 體積直接相加（濃鹽酸加水的體積收縮很小，忽略）。
 *   - 強酸強鹼完全解離；中和 H⁺ + OH⁻ → H₂O，pH 用剩下的 H⁺ 或 OH⁻ 濃度算。
 *   - 酚酞：pH < 8.2 無色，8.2～10 淡紅漸深，> 10 紅色。
 *   - 濃鹽酸試藥：HCl 37.0%、密度 1.19 g/mL、分子量 36.46 → 每 mL 含 0.012076 mol HCl、0.7497 g 水。 */
(function (root) {
  'use strict';
  var MW = { HCl: 36.46, NaOH: 40.00, NaCl: 58.44 };
  var CONC = { rho: 1.19, wt: 0.370 };
  var N_PER_ML_CONC = CONC.rho * CONC.wt / MW.HCl;   // 0.012076 mol/mL

  // 試劑：每 mL 含多少（mol、g 水）；solid 的是每 g
  var REAGENTS = {
    water: { name: '純水', label: ['純水（蒸餾水）'], color: [210, 235, 255, 0.35] },
    tap: { name: '自來水', label: ['自來水', '含少量離子'], impure: true, color: [215, 235, 250, 0.38] },
    concHCl: { name: '濃鹽酸 37%', label: ['鹽酸 HCl  37.0%', '密度 1.19 g/mL', '分子量 36.46', '腐蝕性'], nHCl: N_PER_ML_CONC, conc: true, color: [250, 245, 205, 0.55] },
    NaOH01: { name: '0.100 mol/L NaOH', label: ['氫氧化鈉標準溶液', 'NaOH 0.100 mol/L'], nNaOH: 0.100 / 1000, color: [225, 240, 255, 0.35] },
    unkHCl: { name: '未知濃度鹽酸', label: ['未知濃度鹽酸', 'HCl ? mol/L'], color: [235, 245, 255, 0.35] },
    php: { name: '酚酞指示劑', label: ['酚酞指示劑'], php: true, color: [240, 240, 240, 0.5] }
  };

  // ---------- 溶液 ----------
  function Sol() { this.v = 0; this.n = { HCl: 0, NaOH: 0, NaCl: 0 }; this.solid = 0; this.php = 0; this.concV = 0; this.impure = false; this.mixed = 1; this.temp = 25; this.waterG = 0; }
  Sol.prototype.clone = function () { var s = new Sol(); s.v = this.v; s.n = { HCl: this.n.HCl, NaOH: this.n.NaOH, NaCl: this.n.NaCl }; s.solid = this.solid; s.php = this.php; s.concV = this.concV; s.impure = this.impure; s.mixed = this.mixed; s.temp = this.temp; s.waterG = this.waterG; return s; };
  // 從試劑瓶取出 vol mL（unkC：未知鹽酸的真正濃度 mol/L）
  function fromReagent(key, vol, unkC) {
    var r = REAGENTS[key], s = new Sol(); s.v = vol;
    if (r.nHCl) { s.n.HCl = r.nHCl * vol; s.concV = vol; s.waterG = vol * CONC.rho * (1 - CONC.wt); }
    else s.waterG = vol;
    if (r.nNaOH) s.n.NaOH = r.nNaOH * vol;
    if (key === 'unkHCl') s.n.HCl = unkC / 1000 * vol;
    if (r.php) s.php = vol / 0.05;   // 1 滴約 0.05 mL
    if (r.impure) s.impure = true;
    return s;
  }
  // 從 a 倒 vol mL 到 b（同比例帶走溶質；固體留在原容器底部，除非 takeSolid）
  function transfer(a, b, vol, takeSolid) {
    vol = Math.min(vol, a.v); if (vol <= 0 && !(takeSolid && a.solid > 0)) return 0;
    var f = a.v > 0 ? vol / a.v : 0, k;
    var addConc = a.concV * f, before = { v: b.v, concV: b.concV };
    for (k in a.n) { var d = a.n[k] * f; a.n[k] -= d; b.n[k] += d; }
    var dp = a.php * f; a.php -= dp; b.php += dp;
    var dw = a.waterG * f; a.waterG -= dw; b.waterG += dw;
    a.concV -= addConc; b.concV += addConc;
    if (a.impure && vol > 0) b.impure = true;
    b.temp = b.v + vol > 0 ? (b.temp * b.v + a.temp * vol) / (b.v + vol) : b.temp;
    a.v -= vol; b.v += vol;
    if (takeSolid && a.solid > 0) { b.solid += a.solid; a.solid = 0; }
    b.mixed = b.v > 0 ? Math.min(b.mixed, before.v / b.v) : 1;
    neutralize(b);
    return vol;
  }
  function neutralize(s) { var m = Math.min(s.n.HCl, s.n.NaOH); if (m > 0) { s.n.HCl -= m; s.n.NaOH -= m; s.n.NaCl += m; s.waterG += m * 18.02; } }
  // 濃酸比例：濃鹽酸佔的體積比例（> 0.5 時再加水就會「強酸飛濺」）
  function concFrac(s) { return s.v > 0 ? s.concV / s.v : 0; }
  function molarity(s, sp) { return s.v > 0 ? s.n[sp] / (s.v / 1000) : 0; }
  function pH(s) {
    if (s.v <= 0) return 7;
    var L = s.v / 1000, h = s.n.HCl / L, oh = s.n.NaOH / L;
    if (h > 1e-7) return -Math.log10(h);
    if (oh > 1e-7) return 14 + Math.log10(oh);
    return 7;
  }
  // 酚酞顏色：回傳 0～1 的紅色濃度
  function phpPink(ph, drops) { if (drops < 0.5) return 0; if (ph < 8.2) return 0; return Math.min(1, (ph - 8.2) / 1.8); }
  function dissolve(s, dt, stirring) {   // 食鹽溶解：攪拌時每秒溶 2.6 g（攪拌一次 4 秒可溶完 10 g），不攪拌 0.1 g（遊戲設定值）
    if (s.solid <= 0 || s.v <= 0) return 0;
    var sat = s.waterG * 0.36 - s.n.NaCl * MW.NaCl;   // 25 °C 約 36 g / 100 g 水
    var d = Math.min(s.solid, Math.max(0, sat), (stirring ? 2.6 : 0.1) * dt);
    s.solid -= d; s.n.NaCl += d / MW.NaCl; s.v += d * 0.37;   // 溶解後體積增加（約 0.37 mL/g，遊戲設定值）
    return d;
  }
  function massPercent(s) { var solute = s.n.NaCl * MW.NaCl, water = s.waterG; return solute + water > 0 ? solute / (solute + water) * 100 : 0; }

  // ---------- 容器形狀：由下往上的截頭圓錐段 [高, 下半徑, 上半徑]（cm） ----------
  var SHAPES = {
    beaker250: { segs: [[9.6, 3.6, 3.6]], mouth: 3.7, marks: [[50, '50'], [100, '100'], [150, '150'], [200, '200'], [250, '250']], cap: 300, glass: true, spout: true, name: '燒杯 250 mL' },
    beaker100: { segs: [[7.2, 2.6, 2.6]], mouth: 2.7, marks: [[25, '25'], [50, '50'], [75, '75'], [100, '100']], cap: 150, glass: true, spout: true, name: '燒杯 100 mL' },
    cyl100: { segs: [[0.6, 1.5, 1.5], [17.5, 1.45, 1.45]], mouth: 1.5, scaleFrom: 0.6, marks: 'cyl100', cap: 116, glass: true, spout: true, base: 2.6, name: '量筒 100 mL' },
    cyl50: { segs: [[0.6, 1.1, 1.1], [16, 1.05, 1.05]], mouth: 1.1, scaleFrom: 0.6, marks: 'cyl50', cap: 55, glass: true, spout: true, base: 2.2, name: '量筒 50 mL' },
    vol100: { segs: [[0.6, 2.2, 2.9], [1.6, 2.9, 2.9], [2.6, 2.9, 0.75], [11.5, 0.75, 0.75]], mouth: 0.8, markV: 100, cap: 108, glass: true, neck: true, name: '容量瓶 100 mL' },
    conical: { segs: [[0.5, 3.8, 3.8], [9.0, 3.8, 1.4], [3.0, 1.4, 1.4]], mouth: 1.5, marks: [[50, '50'], [100, '100'], [150, '150']], cap: 250, glass: true, name: '錐形瓶 250 mL' },
    bottle: { segs: [[8.5, 3.2, 3.2], [2.2, 3.2, 1.3], [2.2, 1.3, 1.3]], mouth: 1.4, cap: 500, glass: true, bottle: true, name: '試劑瓶' },
    washer: { segs: [[11, 3.0, 3.0], [1.5, 3.0, 1.2]], mouth: 0.3, cap: 500, glass: false, washer: true, name: '洗瓶（純水）' },
    jug: { segs: [[12, 4.0, 4.0], [2.0, 4.0, 2.0]], mouth: 2.0, cap: 1000, glass: false, jug: true, name: '自來水壺' }
  };
  function shapeTable(shape) {   // 累積體積表：每 0.05 cm 一格
    if (shape._t) return shape._t;
    var t = [{ y: 0, v: 0, r: shape.segs[0][1] }], y = 0, v = 0;
    shape.segs.forEach(function (sg) {
      var h = sg[0], r0 = sg[1], r1 = sg[2], n = Math.max(1, Math.round(h / 0.05));
      for (var i = 1; i <= n; i++) {
        var y0 = (i - 1) / n * h, y1 = i / n * h, ra = r0 + (r1 - r0) * y0 / h, rb = r0 + (r1 - r0) * y1 / h;
        v += Math.PI / 3 * (h / n) * (ra * ra + ra * rb + rb * rb);
        t.push({ y: y + y1, v: v, r: rb });
      }
      y += h;
    });
    shape._t = t; shape.H = y; return t;
  }
  function levelOf(shape, vol) {   // 液面高度（cm，從容器內底算）
    var t = shapeTable(shape);
    if (vol <= 0) return 0;
    for (var i = 1; i < t.length; i++) if (t[i].v >= vol) { var a = t[i - 1], b = t[i]; return a.y + (b.y - a.y) * (vol - a.v) / (b.v - a.v); }
    return t[t.length - 1].y;
  }
  function volAt(shape, y) { var t = shapeTable(shape); for (var i = 1; i < t.length; i++) if (t[i].y >= y) { var a = t[i - 1], b = t[i]; return a.v + (b.v - a.v) * (y - a.y) / (b.y - a.y); } return t[t.length - 1].v; }
  function radiusAt(shape, y) { var t = shapeTable(shape); for (var i = 1; i < t.length; i++) if (t[i].y >= y) return t[i].r; return t[t.length - 1].r; }

  // ---------- 量具：吸量管、滴定管（刻度由上往下） ----------
  // 吸量管 20 mL：管長 34 cm，刻度區 4～28 cm（0 mL 在上，20 mL 在下）；滴定管 50 mL：刻度 0 在上
  var PIPETTE = { len: 34, r: 0.32, cap: 20, top0: 30, mark20: 6, name: '刻度吸量管 20 mL（附安全吸球）' };
  var BURETTE = { len: 60, r: 0.55, cap: 50, top0: 55, mark50: 8, name: '滴定管 50 mL' };

  // 量測的誤差（遊戲設定值）：讀數四捨五入到最小刻度的 1/10
  function readRound(x, step) { return Math.round(x / step) * step; }

  root.ChemModel = {
    MW: MW, CONC: CONC, N_PER_ML_CONC: N_PER_ML_CONC, REAGENTS: REAGENTS, SHAPES: SHAPES, PIPETTE: PIPETTE, BURETTE: BURETTE,
    Sol: Sol, fromReagent: fromReagent, transfer: transfer, neutralize: neutralize, concFrac: concFrac, molarity: molarity, pH: pH, phpPink: phpPink,
    dissolve: dissolve, massPercent: massPercent, shapeTable: shapeTable, levelOf: levelOf, volAt: volAt, radiusAt: radiusAt, readRound: readRound
  };
})(typeof window !== 'undefined' ? window : globalThis);
