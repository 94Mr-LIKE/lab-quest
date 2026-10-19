/* 瘋狂實驗室：自製 2D 物理引擎（老闆 10/19：物理要真的算、要像《憤怒鳥》）
 * 這台電腦不允許安裝外部套件，所以自己寫；只做遊戲用得到的部分，數字照真實物理。
 * 單位：長度 dm（1 dm = 10 cm）、質量 kg、時間 s；重力 g = 98 dm/s²（= 9.8 m/s²）。y 軸朝上。
 * 物體：
 *   球：動態圓形，會轉動（實心球 I = 2/5·m·r²，空心球 2/3·m·r²），可以有空氣阻力 F = ½·ρ·Cd·A·v²。
 *   靜態形狀：凸多邊形、粗線段（膠囊形）。
 *   樞軸板：繞固定點轉的凸多邊形（翹翹板），有轉動慣量、重力力矩、轉角上下限。
 * 碰撞：衝量法——法向用恢復係數 e 反彈，切向用庫侖摩擦 μ；每格畫面切成多個小步驟，最後把重疊推開。
 * 位置用梯形法積分：只受重力時跟拋體公式完全一致（高中「一發入魂」關要能算準）。 */
(function (root) {
  'use strict';
  var RHO_AIR = 1.2;   // 空氣密度 kg/m³

  function V(x, y) { return { x: x, y: y }; }
  function add(a, b) { return V(a.x + b.x, a.y + b.y); }
  function sub(a, b) { return V(a.x - b.x, a.y - b.y); }
  function mul(a, s) { return V(a.x * s, a.y * s); }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function cross(a, b) { return a.x * b.y - a.y * b.x; }
  function len(a) { return Math.sqrt(a.x * a.x + a.y * a.y); }
  function rot(p, t) { var c = Math.cos(t), s = Math.sin(t); return V(p.x * c - p.y * s, p.x * s + p.y * c); }
  function wxr(w, r) { return V(-w * r.y, w * r.x); }   // ω × r
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  function closestOnSeg(p, a, b) {
    var ab = sub(b, a), L2 = dot(ab, ab);
    var t = L2 > 0 ? clamp(dot(sub(p, a), ab) / L2, 0, 1) : 0;
    return add(a, mul(ab, t));
  }
  // 圓 vs 凸多邊形（頂點逆時針）；回傳 { n：從多邊形指向球心的法向, depth, point }
  function circlePoly(c, r, pts) {
    var n = pts.length, best = -Infinity, bn = null, i, a, b, en, s;
    for (i = 0; i < n; i++) {
      a = pts[i]; b = pts[(i + 1) % n];
      en = V(b.y - a.y, -(b.x - a.x)); var L = len(en); en = mul(en, 1 / L);
      s = dot(sub(c, a), en);
      if (s > best) { best = s; bn = en; }
    }
    if (best > r) return null;
    if (best <= 0) return { n: bn, depth: r - best, point: sub(c, mul(bn, best)) };   // 球心跑進多邊形裡
    var minD = Infinity, cp = null, q, d;
    for (i = 0; i < n; i++) {
      q = closestOnSeg(c, pts[i], pts[(i + 1) % n]); d = len(sub(c, q));
      if (d < minD) { minD = d; cp = q; }
    }
    if (minD >= r) return null;
    return { n: minD > 1e-9 ? mul(sub(c, cp), 1 / minD) : bn, depth: r - minD, point: cp };
  }
  function circleSeg(c, r, a, b, rr) {
    var q = closestOnSeg(c, a, b), d = sub(c, q), L = len(d);
    if (L >= r + rr) return null;
    var nn = L > 1e-9 ? mul(d, 1 / L) : V(0, 1);
    return { n: nn, depth: r + rr - L, point: add(q, mul(nn, rr)) };
  }

  function World(opt) {
    opt = opt || {};
    this.g = opt.g != null ? opt.g : 98;
    this.substeps = opt.substeps || 8;
    this.iters = opt.iters || 8;
    this.balls = []; this.statics = []; this.pivots = [];
    this.time = 0;
    this.onHit = null;          // function (ball, other, impactSpeed) — 撞擊音效用
    this.restThreshold = 2.5;   // dm/s：比這慢的碰撞不反彈（才停得住）
    this.bounds = opt.bounds || null;   // {x0,y0,x1,y1}：飛出範圍就移除
  }
  World.prototype.addStatic = function (s) {
    if (s.e == null) s.e = 0.55;
    if (s.mu == null) s.mu = 0.4;
    if (s.kind === 'poly') s.box = bbox(s.pts, 0); else s.box = bbox([s.a, s.b], s.r || 0);
    this.statics.push(s); return s;
  };
  World.prototype.addBall = function (b) {
    b.p = V(b.x, b.y); b.v = V(b.vx || 0, b.vy || 0); b.ang = 0; b.w = b.w || 0;
    b.I = (b.shell ? 2 / 3 : 2 / 5) * b.m * b.r * b.r; b.inv = 1 / b.m; b.invI = 1 / b.I;
    if (b.e == null) b.e = 0.6;
    if (b.mu == null) b.mu = 0.3;
    if (b.crr == null) b.crr = 0.01;   // 滾動阻力係數
    b.alive = true; b.touching = false; b.rest = 0; b.trail = [V(b.p.x, b.p.y)];
    this.balls.push(b); return b;
  };
  World.prototype.addPivot = function (q) {
    q.angle = q.angle || 0; q.w = q.w || 0;
    if (q.e == null) q.e = 0.4;
    if (q.mu == null) q.mu = 0.5;
    if (q.limitE == null) q.limitE = 0.1;
    this.pivots.push(q); this._pivotPts(q); return q;
  };
  World.prototype._pivotPts = function (q) {   // q.polys：好幾個凸多邊形（例如板子＋末端擋板）
    var o = V(q.px, q.py), all = [];
    if (!q.polys) q.polys = [q.pts];
    q.wpolys = q.polys.map(function (pts) { var w = pts.map(function (p) { return add(o, rot(p, q.angle)); }); all = all.concat(w); return w; });
    q.wpts = q.wpolys[0];
    q.box = bbox(all, 0);
    return q.wpolys;
  };
  function bbox(pts, pad) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach(function (p) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  }
  function nearBox(p, r, bx) { return p.x + r > bx.x0 && p.x - r < bx.x1 && p.y + r > bx.y0 && p.y - r < bx.y1; }

  World.prototype._collide = function () {
    var out = [], bs = this.balls, i, j, b, o, s, q, hit;
    for (i = 0; i < bs.length; i++) {
      b = bs[i]; if (!b.alive || b.held) continue;
      for (j = 0; j < this.statics.length; j++) {
        s = this.statics[j]; if (s.ghost || !nearBox(b.p, b.r, s.box)) continue;
        hit = s.kind === 'poly' ? circlePoly(b.p, b.r, s.pts) : circleSeg(b.p, b.r, s.a, s.b, s.r || 0);
        if (hit) out.push(this._contact(b, s, null, null, hit));
      }
      for (j = 0; j < this.pivots.length; j++) {
        q = this.pivots[j]; if (!nearBox(b.p, b.r, q.box)) continue;
        for (var k = 0; k < q.wpolys.length; k++) {
          hit = circlePoly(b.p, b.r, q.wpolys[k]);
          if (hit) out.push(this._contact(b, null, q, null, hit));
        }
      }
      for (j = i + 1; j < bs.length; j++) {
        o = bs[j]; if (!o.alive || o.held) continue;
        var d = sub(b.p, o.p), L = len(d);
        if (L < b.r + o.r && L > 1e-9) {
          var nn = mul(d, 1 / L);
          out.push(this._contact(b, null, null, o, { n: nn, depth: b.r + o.r - L, point: add(o.p, mul(nn, o.r)) }));
        }
      }
    }
    return out;
  };
  World.prototype._relVel = function (c) {
    var b = c.b, vb = add(b.v, wxr(b.w, c.rb)), vo = V(0, 0);
    if (c.q) vo = wxr(c.q.w, c.rq);
    if (c.o) vo = add(c.o.v, wxr(c.o.w, c.ro));
    return sub(vb, vo);
  };
  World.prototype._contact = function (b, s, q, o, hit) {
    var c = { b: b, s: s, q: q, o: o, n: hit.n, depth: hit.depth, point: hit.point, jn: 0, jt: 0 };
    c.rb = mul(hit.n, -b.r);
    if (q) c.rq = sub(hit.point, V(q.px, q.py));
    if (o) c.ro = mul(hit.n, o.r);
    var other = s || q || o;
    c.e = Math.sqrt(b.e * other.e);
    c.mu = Math.sqrt(b.mu * other.mu);
    var t = V(-c.n.y, c.n.x);
    c.t = t;
    c.kn = b.inv + (q ? Math.pow(cross(c.rq, c.n), 2) / q.I : 0) + (o ? o.inv : 0);
    c.kt = b.inv + Math.pow(cross(c.rb, t), 2) * b.invI + (q ? Math.pow(cross(c.rq, t), 2) / q.I : 0) +
      (o ? o.inv + Math.pow(cross(c.ro, t), 2) * o.invI : 0);
    var vn = dot(this._relVel(c), c.n);
    c.bias = vn < -this.restThreshold ? -c.e * vn : 0;
    if (vn < -this.restThreshold * 0.6 && this.onHit) this.onHit(b, other, -vn);
    return c;
  };
  World.prototype._apply = function (c, P) {
    var b = c.b;
    b.v = add(b.v, mul(P, b.inv)); b.w += cross(c.rb, P) * b.invI;
    if (c.q) c.q.w -= cross(c.rq, P) / c.q.I;
    if (c.o) { c.o.v = sub(c.o.v, mul(P, c.o.inv)); c.o.w -= cross(c.ro, P) * c.o.invI; }
  };
  World.prototype._solve = function (c) {
    var vr = this._relVel(c), vn = dot(vr, c.n);
    var dj = (c.bias - vn) / c.kn, nj = Math.max(c.jn + dj, 0);
    dj = nj - c.jn; c.jn = nj;
    if (dj !== 0) this._apply(c, mul(c.n, dj));
    vr = this._relVel(c);
    var vt = dot(vr, c.t), dt = -vt / c.kt, max = c.mu * c.jn;
    var nt = clamp(c.jt + dt, -max, max);
    dt = nt - c.jt; c.jt = nt;
    if (dt !== 0) this._apply(c, mul(c.t, dt));
  };

  World.prototype._sub = function (h) {
    var g = this.g, bs = this.balls, i, b, q;
    for (i = 0; i < bs.length; i++) {
      b = bs[i]; if (!b.alive || b.held) continue;
      b.v0 = V(b.v.x, b.v.y);
      var ax = 0, ay = -g, sp = len(b.v);
      if (b.cd && sp > 0) {   // 空氣阻力：用公尺算，再換回 dm
        var vm = sp / 10, F = 0.5 * RHO_AIR * b.cd * Math.PI * b.Rm * b.Rm * vm * vm, acc = F / b.m * 10;
        ax -= acc * b.v.x / sp; ay -= acc * b.v.y / sp;
      }
      b.v.x += ax * h; b.v.y += ay * h;
    }
    for (i = 0; i < this.pivots.length; i++) {
      q = this.pivots[i];
      if (q.m) { var com = rot(q.com, q.angle); q.w += cross(com, V(0, -g * q.m)) / q.I * h; }
    }
    var cs = this._collide(), k, it;
    for (it = 0; it < this.iters; it++) for (k = 0; k < cs.length; k++) this._solve(cs[k]);
    for (i = 0; i < bs.length; i++) {
      b = bs[i]; if (!b.alive || b.held) continue;
      b.touching = false;
      // 位置：梯形法（只受重力時就是拋體公式）
      b.p.x += (b.v0.x + b.v.x) * 0.5 * h; b.p.y += (b.v0.y + b.v.y) * 0.5 * h; b.ang += b.w * h;
    }
    for (k = 0; k < cs.length; k++) {
      cs[k].b.touching = true;
      if (cs[k].o) cs[k].o.touching = true;
    }
    // 滾動阻力（在接觸面上才有）
    for (i = 0; i < bs.length; i++) {
      b = bs[i]; if (!b.alive || b.held || !b.touching) continue;
      var s2 = len(b.v), dec = b.crr * g * h;
      if (s2 > 0) { var f = Math.max(0, s2 - dec) / s2; b.v = mul(b.v, f); b.w *= f; }
    }
    for (i = 0; i < this.pivots.length; i++) {
      q = this.pivots[i];
      q.angle += q.w * h;
      if (q.angle < q.min) { q.angle = q.min; if (q.w < 0) q.w = -q.w * q.limitE; }
      if (q.angle > q.max) { q.angle = q.max; if (q.w > 0) q.w = -q.w * q.limitE; }
      this._pivotPts(q);
    }
    // 把重疊推開（只推球）
    var cs2 = this._collide();
    for (k = 0; k < cs2.length; k++) {
      var c = cs2[k], d = Math.max(0, c.depth - 0.0005) * 0.8;
      if (!d) continue;
      if (c.o) {
        var wsum = c.b.inv + c.o.inv;
        c.b.p = add(c.b.p, mul(c.n, d * c.b.inv / wsum)); c.o.p = sub(c.o.p, mul(c.n, d * c.o.inv / wsum));
      } else c.b.p = add(c.b.p, mul(c.n, d));
    }
  };

  World.prototype.step = function (dt) {
    var h = dt / this.substeps, i, b;
    for (var s = 0; s < this.substeps; s++) this._sub(h);
    this.time += dt;
    for (i = 0; i < this.balls.length; i++) {
      b = this.balls[i]; if (!b.alive || b.held) continue;
      var last = b.trail[b.trail.length - 1];
      if (len(sub(b.p, last)) > 0.12) b.trail.push(V(b.p.x, b.p.y));
      b.rest = len(b.v) < 0.25 && Math.abs(b.w) < 2 ? b.rest + dt : 0;
      var B = this.bounds;
      if (B && (b.p.x < B.x0 || b.p.x > B.x1 || b.p.y < B.y0 || b.p.y > B.y1)) b.alive = false;
    }
  };

  root.LabPhysics = {
    World: World, V: V, add: add, sub: sub, mul: mul, dot: dot, cross: cross, len: len, rot: rot,
    circlePoly: circlePoly, circleSeg: circleSeg,
    // 常用材質（恢復係數 e、摩擦係數 μ）：數值取教科書常見範圍，屬遊戲設定值
    MAT: {
      steel: { e: 0.75, mu: 0.25 }, wood: { e: 0.6, mu: 0.4 }, rubber: { e: 0.95, mu: 0.8 },
      sponge: { e: 0.03, mu: 0.9 }, glass: { e: 0.7, mu: 0.15 }, bench: { e: 0.5, mu: 0.45 }, pingpong: { e: 0.88, mu: 0.3 }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
