/* 瘋狂實驗室・物理實驗台：器材的形狀、物理設定、發射與過關判定（不碰畫面，Node 也能跑來驗算關卡）
 * 座標：dm，y 朝上，實驗桌面 y = 0。角度存弧度。 */
(function (root) {
  'use strict';
  var PH = root.LabPhysics, V = PH.V, MAT = PH.MAT;
  var D2R = Math.PI / 180;

  // ---------- 球（彈藥）：直徑、質量照真實物品 ----------
  var BALLS = {
    steel: { name: '鋼珠', r: 0.16, m: 0.134, mat: 'steel', cd: 0.47, Rm: 0.016, note: '直徑 3.2 cm・134 g' },
    wood: { name: '木球', r: 0.16, m: 0.011, mat: 'wood', cd: 0.47, Rm: 0.016, note: '直徑 3.2 cm・11 g' },
    pingpong: { name: '乒乓球', r: 0.20, m: 0.0027, mat: 'pingpong', shell: true, cd: 0.47, Rm: 0.020, note: '直徑 4 cm・2.7 g，空心' },
    iron05: { name: '鐵球 0.5 kg', r: 0.25, m: 0.5, mat: 'steel', note: '0.5 kg' },
    iron1: { name: '鐵球 1 kg', r: 0.32, m: 1.0, mat: 'steel', note: '1 kg' },
    iron2: { name: '鐵球 2 kg', r: 0.40, m: 2.0, mat: 'steel', note: '2 kg' }
  };
  function makeBall(world, kind, x, y, vx, vy, tag) {
    var s = BALLS[kind], mt = MAT[s.mat];
    return world.addBall({ x: x, y: y, r: s.r, m: s.m, e: mt.e, mu: mt.mu, shell: !!s.shell, cd: s.cd, Rm: s.Rm, vx: vx || 0, vy: vy || 0, kind: kind, tag: tag || 'shot' });
  }

  function rect(x0, y0, x1, y1) { return [V(x0, y0), V(x1, y0), V(x1, y1), V(x0, y1)]; }
  function xf(it, p) { var c = Math.cos(it.ang), s = Math.sin(it.ang); return V(it.x + p.x * c - p.y * s, it.y + p.x * s + p.y * c); }
  function toLocal(it, p) { var dx = p.x - it.x, dy = p.y - it.y, c = Math.cos(-it.ang), s = Math.sin(-it.ang); return V(dx * c - dy * s, dx * s + dy * c); }

  // ---------- 器材 ----------
  // polys(it)：跟著器材轉的形狀（本地座標）；fixedPolys(it)：不轉的部分（例如底座，世界座標）
  var TYPES = {
    plank: { name: '木板', mat: 'wood', thick: 0.14, len: 3, minLen: 1.2, maxLen: 5, rot: true, resize: true,
      polys: function (it) { var L = it.len / 2, t = this.thick / 2; return [rect(-L, -t, L, t)]; } },
    bumper: { name: '彈力板', mat: 'rubber', thick: 0.16, len: 2.4, minLen: 1.2, maxLen: 4, rot: true, resize: true,
      polys: function (it) { var L = it.len / 2, t = this.thick / 2; return [rect(-L, -t, L, t)]; } },
    sponge: { name: '海綿墊', mat: 'sponge', thick: 0.3, len: 2.4, minLen: 1.2, maxLen: 4, rot: true, resize: true,
      polys: function (it) { var L = it.len / 2, t = this.thick / 2; return [rect(-L, -t, L, t)]; } },
    // 彈簧發射器：樞軸在砲管後端；壓縮推桿 x，出口速度 v = x·√(k ÷ (m球 + M推桿))
    launcher: { name: '彈簧發射器', mat: 'steel', barrel: 2.2, half: 0.25, rot: true, rotMin: 5, rotMax: 85, plungerM: 0.05, maxX: 6,
      polys: function () { return [rect(0, -this.half, this.barrel, this.half)]; },
      fixedPolys: function (it) { return [rect(it.x - 0.32, 0, it.x + 0.32, it.y - 0.18)]; },
      muzzle: function (it, r) { return xf(it, V(this.barrel + r + 0.03, 0)); } },
    // 壓縮空氣砲：樞軸就是砲口（發射點固定，方便計算），出口速度固定
    cannon: { name: '壓縮空氣砲', mat: 'steel', barrel: 1.8, half: 0.24, rot: true, rotMin: 0, rotMax: 80,
      polys: function () { return [rect(-this.barrel, -this.half, -0.02, this.half)]; },
      fixedPolys: function (it) { return [rect(it.x - 1.0, 0, it.x - 0.4, it.y - 0.5)]; },
      muzzle: function (it) { return V(it.x, it.y); } },
    // 翹翹板：支點高 0.6 dm，板長 5 dm；props.arm＝支點到左端（裝球那端）的距離
    seesaw: { name: '翹翹板', mat: 'wood', len: 5, thick: 0.12, foot: 0.6, rot: false, minArm: 1.2, maxArm: 3.8,
      polys: function (it) { return [this.plankPts(it)]; },
      plankPts: function (it) { var a = it.props.arm; return rect(-a, 0, this.len - a, this.thick); },
      lipPts: function (it) { var a = it.props.arm; return rect(-a, this.thick, -a + 0.1, this.thick + 0.32); },
      fixedPolys: function (it) { return [[V(it.x - 0.45, 0), V(it.x + 0.45, 0), V(it.x, it.y)]]; },
      limits: function (it) { var a = it.props.arm, b = this.len - a, h = it.y; return { max: Math.asin(Math.min(1, h / a)), min: -Math.asin(Math.min(1, h / b)) }; } },
    // 釋放夾：掛在上方軌道，可以左右移、調高度；放開時鐵球自由落下
    dropper: { name: '釋放夾', rot: false, minH: 2.0,
      polys: function () { return [rect(-0.3, -0.25, 0.3, 0.1)]; } }
  };

  function itemPolys(it) {
    var T = TYPES[it.type], c = Math.cos(it.ang), s = Math.sin(it.ang);
    var ps = T.polys(it).map(function (poly) { return poly.map(function (p) { return V(it.x + p.x * c - p.y * s, it.y + p.x * s + p.y * c); }); });
    if (T.fixedPolys) ps = ps.concat(T.fixedPolys(it));
    return ps;
  }

  // ---------- 凸多邊形重疊（擺放時檢查用，SAT） ----------
  function project(pts, ax) { var lo = Infinity, hi = -Infinity; pts.forEach(function (p) { var d = p.x * ax.x + p.y * ax.y; lo = Math.min(lo, d); hi = Math.max(hi, d); }); return [lo, hi]; }
  function polyOverlap(a, b, margin) {
    var polys = [a, b];
    for (var k = 0; k < 2; k++) {
      var P = polys[k];
      for (var i = 0; i < P.length; i++) {
        var p1 = P[i], p2 = P[(i + 1) % P.length], ax = V(p2.y - p1.y, -(p2.x - p1.x)), L = Math.hypot(ax.x, ax.y);
        ax = V(ax.x / L, ax.y / L);
        var A = project(a, ax), Bp = project(b, ax);
        if (A[1] - (margin || 0) < Bp[0] || Bp[1] - (margin || 0) < A[0]) return false;
      }
    }
    return true;
  }

  // ---------- 目標杯：杯底鋪海綿（球掉進去才停得住） ----------
  function cupParts(cup) {
    var w = cup.w / 2, t = 0.07, x = cup.x, y = cup.y, h = cup.h;
    return {
      walls: [rect(x - w - t, y, x - w, y + h), rect(x + w, y, x + w + t, y + h)],
      bottom: rect(x - w, y, x + w, y + 0.08),
      sensor: { x0: x - w + 0.02, y0: y + 0.08, x1: x + w - 0.02, y1: y + h - 0.02 }
    };
  }
  function inRect(p, r) { return p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1; }

  // ---------- 用關卡＋玩家擺的器材組出物理世界 ----------
  function buildWorld(level, items) {
    var w = new PH.World({ bounds: { x0: -3, y0: -3, x1: level.world.w + 3, y1: level.world.h + 8 } });
    level.statics.forEach(function (s) {
      var m = MAT[s.mat || 'bench'];
      w.addStatic({ kind: 'poly', pts: s.pts.map(function (p) { return V(p[0], p[1]); }), e: m.e, mu: m.mu, look: s.look });
    });
    var cups = (level.cups || []).map(function (cup) {
      var cp = cupParts(cup);
      cp.walls.forEach(function (pts) { w.addStatic({ kind: 'poly', pts: pts, e: MAT.glass.e, mu: MAT.glass.mu, look: 'cup' }); });
      w.addStatic({ kind: 'poly', pts: cp.bottom, e: MAT.sponge.e, mu: MAT.sponge.mu, look: 'cup' });
      return { def: cup, sensor: cp.sensor };
    });
    var refs = {};
    items.forEach(function (it) {
      var T = TYPES[it.type];
      if (it.type === 'seesaw') {
        var lim = T.limits(it), L = T.len, a = it.props.arm, m = 0.3;
        refs[it.uid] = w.addPivot({ px: it.x, py: it.y, polys: [T.plankPts(it), T.lipPts(it)], m: m, I: m * (L * L / 12 + Math.pow(L / 2 - a, 2)),
          com: V(L / 2 - a, T.thick / 2), angle: it.props.down === 'right' ? lim.min : lim.max, min: lim.min, max: lim.max, e: MAT.wood.e, mu: MAT.wood.mu, look: 'seesaw', item: it });
        w.addStatic({ kind: 'poly', pts: T.fixedPolys(it)[0], e: MAT.wood.e, mu: MAT.wood.mu, look: 'none' });
        return;
      }
      if (it.type === 'dropper') return;   // 釋放夾不擋球
      var mt = MAT[T.mat] || MAT.wood, gun = it.type === 'launcher' || it.type === 'cannon', nRot = T.polys(it).length;
      // 發射器、空氣砲的砲管不擋球（球是從砲管裡出來的）；底座會擋
      itemPolys(it).forEach(function (pts, i) { w.addStatic({ kind: 'poly', pts: pts, e: mt.e, mu: mt.mu, look: 'none', item: it, ghost: gun && i < nRot }); });
    });
    return { world: w, cups: cups, refs: refs };
  }

  // ---------- 發射 ----------
  function launcherSpeed(it, kind) {   // m/s
    var T = TYPES.launcher, x = (it.props.x || 0) / 100, m = BALLS[kind].m;
    return x * Math.sqrt(it.props.k / (m + T.plungerM));
  }
  function fire(env, it) {
    var w = env.world, kind = it.props.ball, T = TYPES[it.type], spec = BALLS[kind], v;
    if (it.type === 'launcher') v = launcherSpeed(it, kind);
    else v = it.props.v;
    var mz = T.muzzle(it, spec.r), vd = V(Math.cos(it.ang) * v * 10, Math.sin(it.ang) * v * 10);
    var b = makeBall(w, kind, mz.x, mz.y, vd.x, vd.y, 'shot');
    return { ball: b, v0: v, angle: it.ang / D2R, from: V(mz.x, mz.y) };
  }
  // 翹翹板：把要被拋出去的球放進左端的擋板旁
  function seesawLoad(env, it) {
    var q = env.refs[it.uid], T = TYPES.seesaw, kind = it.props.ball, r = BALLS[kind].r, a = it.props.arm;
    var local = V(-a + 0.1 + r + 0.02, T.thick + r + 0.01);
    var p = PH.add(V(q.px, q.py), PH.rot(local, q.angle));
    return makeBall(env.world, kind, p.x, p.y, 0, 0, 'shot');
  }
  function drop(env, it) {   // 鐵球從釋放夾自由落下
    var kind = it.props.ball, r = BALLS[kind].r;
    return makeBall(env.world, kind, it.x, it.y - it.props.h - r, 0, 0, 'weight');
  }

  // ---------- 一發的追蹤：最高點、落點、有沒有進杯 ----------
  function Tracker(env, ball, opts) {
    this.env = env; this.ball = ball; this.t = 0; this.maxY = ball.p.y; this.inCup = 0;
    this.hit = false; this.done = false; this.land = null; this.cupT = (opts && opts.cupT) || 0.35; this.maxT = (opts && opts.maxT) || 9;
    this.started = !(opts && opts.waitLaunch);
  }
  Tracker.prototype.update = function (dt) {
    var b = this.ball; this.t += dt;
    if (!this.started) { if (Math.hypot(b.v.x, b.v.y) > 3) this.started = true; else { if (this.t > this.maxT) this.done = true; return; } }
    if (b.alive) {
      this.maxY = Math.max(this.maxY, b.p.y);
      if (!this.land && b.touching && this.t > 0.05) this.land = V(b.p.x, b.p.y);
      var inside = this.env.cups.some(function (c) { return inRect(b.p, c.sensor); });
      this.inCup = inside ? this.inCup + dt : 0;
      if (this.inCup >= this.cupT) { this.hit = true; this.done = true; return; }
    }
    if (!b.alive || b.rest > 0.6 || this.t > this.maxT) this.done = true;
  };

  // ---------- 氣墊軌道（第 5 關）：一維碰撞 ----------
  // 滑車：x（左端位置，dm）、寬 w、質量 m、v（dm/s）；碰撞面 bumper：'spring'（彈簧，e = 0.95）或 'velcro'（魔鬼氈，黏在一起）
  function Track(def) { this.def = def; this.cars = []; this.t = 0; this.gate = def.gateX; this.gateLog = []; this.plunger = null; }
  Track.prototype.add = function (c) { c.v = 0; this.cars.push(c); return c; };
  Track.prototype.step = function (dt) {
    var cs = this.cars.slice().sort(function (a, b) { return a.x - b.x; }), i, sub = 8, h = dt / sub;
    for (var s = 0; s < sub; s++) {
      for (i = 0; i < cs.length; i++) {
        var c = cs[i], x0 = c.x + c.w;
        c.x += c.v * h;
        if (x0 < this.gate && c.x + c.w >= this.gate && c.v > 0) this.gateLog.push({ car: c, v: c.v / 10, t: this.t });   // 光電閘：車頭通過
      }
      for (i = 0; i < cs.length - 1; i++) {
        var a = cs[i], b = cs[i + 1];
        if (a.x + a.w > b.x && a.v > b.v) {
          var e = (a.bumpR === 'velcro' || b.bumpL === 'velcro') ? 0 : 0.95;
          if (a.v - b.v > 0.3) this.hits = (this.hits || 0) + 1;   // 給音效用
          var va = a.v, vb = b.v, M = a.m + b.m;
          a.v = (a.m * va + b.m * vb - b.m * e * (va - vb)) / M;
          b.v = (a.m * va + b.m * vb + a.m * e * (va - vb)) / M;
          var ov = a.x + a.w - b.x; a.x -= ov * b.m / M; b.x += ov * a.m / M;
        }
      }
      var last = cs[cs.length - 1], end = this.def.endX;
      if (last && last.x + last.w > end && last.v > 0) { last.x = end - last.w; last.v = -0.5 * last.v; }
      var first = cs[0];
      if (first && first.x < this.def.startX && first.v < 0) { first.x = this.def.startX; first.v = -0.5 * first.v; }
      this.t += h;
    }
  };

  root.PhyModel = {
    BALLS: BALLS, TYPES: TYPES, D2R: D2R, rect: rect, xf: xf, toLocal: toLocal, itemPolys: itemPolys, polyOverlap: polyOverlap,
    cupParts: cupParts, inRect: inRect, buildWorld: buildWorld, launcherSpeed: launcherSpeed, fire: fire, seesawLoad: seesawLoad, drop: drop,
    makeBall: makeBall, Tracker: Tracker, Track: Track
  };
})(typeof window !== 'undefined' ? window : globalThis);
