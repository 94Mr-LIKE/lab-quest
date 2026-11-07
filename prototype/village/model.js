/* 科學復興 第一章「讓水回到村子」── 物理模型（瀏覽器與 node 共用）
 * 全部採「準靜態」：小禾慢慢出力，物體等速移動，所以
 *   需要的力 = 讓物體平衡所需的力；做的功 = 力 × 施力點移動的距離。
 * 單位：公尺、公斤、牛頓、焦耳；g = 9.8 m/s²。
 */
(function (root) {
  "use strict";
  var G = 9.8;
  var KID_MAX = 200;          // 小禾最大出力（N），三關共用

  /* ---------- 第 1 關：斜面（把水車輪推上河岸） ---------- */
  var RAMP = {
    mass: 60,                 // 水車輪 60 kg
    radius: 0.55,
    height: 1.2,              // 河岸高 1.2 m
    ledgeX: 6.0,              // 河岸牆的位置（河邊 x = 0）
    footMinX: 1.4,            // 木板底端至少離河邊 1.4 m，輪子和小禾才站得下
    mu: 0.03,                 // 木輪在木板上的滾動阻力係數（小）
    planks: [3, 4, 4.5, 5]
  };
  function evalRamp(L) {
    var h = RAMP.height, W = RAMP.mass * G;
    if (!(L > h)) return { ok: false, reason: "short", L: L };
    var sin = h / L, cos = Math.sqrt(1 - sin * sin);
    var run = L * cos, footX = RAMP.ledgeX - run;
    var Freq = W * (sin + RAMP.mu * cos);
    var r = { L: L, sin: sin, cos: cos, run: run, footX: footX, Freq: Freq,
      work: Freq * L, mgh: W * h, angle: Math.asin(sin) * 180 / Math.PI };
    if (footX < RAMP.footMinX) { r.ok = false; r.reason = "noroom"; return r; }
    if (Freq > KID_MAX) { r.ok = false; r.reason = "steep"; return r; }
    r.ok = true; r.reason = "ok"; return r;
  }

  /* ---------- 第 2 關：槓桿（撬開堵住出水口的石頭） ---------- */
  var LEVER = {
    stoneMass: 50,            // 石頭 50 kg（約 34 cm 大）
    stoneR: 0.17,
    loadX: 5.0,               // 木板前端（石頭底下）固定在 x = 5.0 的地面
    needRise: 0.40,           // 石頭要抬高 40 cm，水才沖得開
    reach: 1.5,               // 小禾踮腳搆得到 1.5 m
    boxUp: 0.5,               // 站上木箱多 0.5 m
    planks: [{ L: 3, m: 3 }, { L: 4, m: 4 }],
    fulcrums: [{ id: "s", h: 0.25, name: "小石頭" }, { id: "m", h: 0.35, name: "中石頭" }, { id: "l", h: 0.5, name: "大石頭" }],
    step: 0.05
  };
  /* cfg: { L, pm, hf, dl, box } ; dl = 支點到石頭端（沿木板）的距離 */
  function evalLever(cfg) {
    var L = cfg.L, hf = cfg.hf, dl = cfg.dl, de = L - dl;
    var Ws = LEVER.stoneMass * G, Wp = cfg.pm * G;
    var r = { L: L, hf: hf, dl: dl, de: de, box: !!cfg.box };
    if (dl <= hf + 0.02) { r.ok = false; r.reason = "noreach_stone"; return r; } // 木板前端碰不到石頭底下
    if (de <= hf + 0.02) { r.ok = false; r.reason = "short_arm"; return r; }
    r.phi0 = Math.asin(hf / dl);               // 起始：石頭端貼地，手端翹起
    r.phi1 = -Math.asin(hf / de);              // 結束：手端壓到地
    r.ye0 = hf * (1 + de / dl);                 // 手端起始高度
    r.rise = hf * (1 + dl / de);                // 石頭端最後高度（= 升高量）
    // 力矩平衡（力都是鉛直的，cosφ 兩邊約掉）：F·de + Wp·(L/2 − dl) = Ws·dl
    r.Freq = (Ws * dl - Wp * (L / 2 - dl)) / de;
    r.reachMax = LEVER.reach + (cfg.box ? LEVER.boxUp : 0);
    r.kidWork = Math.max(r.Freq, 0) * r.ye0;
    r.stoneGain = Ws * r.rise;
    r.plankGain = Wp * (L / 2 - dl) * (Math.sin(r.phi1) - Math.sin(r.phi0)); // 木板重心升降（可正可負）
    if (r.ye0 > r.reachMax) { r.ok = false; r.reason = "noreach"; return r; }
    if (r.Freq > KID_MAX) { r.ok = false; r.reason = "heavy"; return r; }
    if (r.rise < LEVER.needRise) { r.ok = false; r.reason = "low"; return r; }
    r.ok = true; r.reason = "ok"; return r;
  }

  /* ---------- 第 3 關：滑輪（拉起水閘門） ---------- */
  var PULLEY = {
    gateMass: 70, pulleyMass: 3, needRise: 1.5, rope: 7.0, slots: 3, have: 6
  };
  /* f = 掛在橫梁上的滑輪（定滑輪）數，m = 掛在閘門上的滑輪（動滑輪）數
   * 繩子一端綁在橫梁，依序穿過 動—定—動—定…，最後一段要從定滑輪往下才拉得到。 */
  function evalPulley(f, m) {
    var W = (PULLEY.gateMass + m * PULLEY.pulleyMass) * G;
    var r = { f: f, m: m, W: W };
    if (m === 0) {
      r.n = 1;
      r.dirDown = f >= 1;                       // 沒有定滑輪＝直接用手往上抬
    } else {
      r.n = 2 * m;
      r.dirDown = f >= m;
    }
    r.Freq = W / r.n;
    r.pull = PULLEY.needRise * r.n;
    r.kidWork = r.Freq * r.pull;
    r.gain = W * PULLEY.needRise;
    if (m === 0 && f === 0) { r.ok = r.Freq <= KID_MAX; r.reason = r.ok ? "ok" : "direct"; return r; }
    if (!r.dirDown) { r.ok = false; r.reason = "up"; return r; }
    if (r.Freq > KID_MAX) { r.ok = false; r.reason = m === 0 ? "fixedonly" : "heavy"; return r; }
    if (r.pull > PULLEY.rope) { r.ok = false; r.reason = "rope"; return r; }
    r.ok = true; r.reason = "ok"; return r;
  }

  var api = { G: G, KID_MAX: KID_MAX, RAMP: RAMP, LEVER: LEVER, PULLEY: PULLEY,
    evalRamp: evalRamp, evalLever: evalLever, evalPulley: evalPulley };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VillageModel = api;
})(this);
