/* 瘋狂實驗室・生活／運動物理的模擬（單位：公尺、公斤、秒；y 往上）
 * 每一種運動一個模擬器：create(L, p) 產生狀態，step(L, st, dt) 前進。
 * - st.judged：結果已經定了（ev 裡的數字不再改）；st.done：動畫也跑完了（球落地、鐵牌擺停）。判定和動畫分開，球不會停在半空。
 * - 碰撞一律用「圓對矩形／圓對圓」：籃板、牆、得分箱都是實心的，從哪一邊來都擋得住；同一個接觸只算一次（滾動、卡住不會一直加）。
 * 模型與數值照遊戲設計師 r8（_work/r8_遊戲設計師_生活情境物理關.md）與驗算程式；標「估計」的需老師確認。 */
(function (root) {
  'use strict';
  var G = 9.8, RHO = 1.2;
  function trail(st) { if (!st._tr || st.t - st._tr > 0.015) { st._tr = st.t; st.trail.push({ x: st.x, y: st.y, z: st.z || 0 }); } }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  // 圓（球心 st.x, st.y、半徑 r）撞實心矩形：推出去並反彈（恢復係數 e）。回傳：沒碰到 −1；碰到但正在分開 0；碰撞的法向速度（> 0）
  function hitRect(st, r, x0, y0, x1, y1, e) {
    var cx = clamp(st.x, x0, x1), cy = clamp(st.y, y0, y1), dx = st.x - cx, dy = st.y - cy, d = Math.hypot(dx, dy), nx, ny;
    if (d >= r) return -1;
    if (d > 1e-9) { nx = dx / d; ny = dy / d; }
    else {   // 球心跑進矩形裡（很少見）：往最近的那一面推出去
      var m = Math.min(st.x - x0, x1 - st.x, st.y - y0, y1 - st.y);
      nx = m === st.x - x0 ? -1 : m === x1 - st.x ? 1 : 0; ny = nx ? 0 : (m === st.y - y0 ? -1 : 1);
    }
    st.x = cx + nx * r; st.y = cy + ny * r;
    var vn = st.vx * nx + st.vy * ny;
    if (vn >= 0) return 0;
    st.vx -= (1 + e) * vn * nx; st.vy -= (1 + e) * vn * ny; return -vn;
  }
  function hitCircle(st, r, cx, cy, R, e) {   // 圓撞固定的圓（籃框鐵管剖面、鈴）
    var dx = st.x - cx, dy = st.y - cy, d = Math.hypot(dx, dy);
    if (d >= r + R || d < 1e-9) return -1;
    var nx = dx / d, ny = dy / d; st.x = cx + nx * (r + R); st.y = cy + ny * (r + R);
    var vn = st.vx * nx + st.vy * ny;
    if (vn >= 0) return 0;
    st.vx -= (1 + e) * vn * nx; st.vy -= (1 + e) * vn * ny; return -vn;
  }
  function touchStart(st, key, res) {   // 「新的接觸」才算一次：上一小步沒碰到、這一步碰到，而且真的撞進去（不是擦過就分開）
    var now = res >= 0, started = now && !st.cont[key] && res > 0.05; st.cont[key] = now; return started;
  }
  function judge(st) { if (!st.judged) { st.judged = true; st.judgedT = st.t; } }

  // ---------- 投籃（側視 2D）：拋體＋空氣阻力、籃板（實心矩形）、籃框（前後兩個鐵管剖面）、籃板後面的牆 ----------
  function hoopCreate(L, p) {
    var b = L.ball, th = p.angle * Math.PI / 180;
    return { x: L.release.x, y: L.release.y, vx: p.speed * Math.cos(th), vy: p.speed * Math.sin(th), rot: 0, w: p.speed * 1.5,   // 投籃是後旋（只影響畫面）
      k: 0.5 * RHO * b.cd * Math.PI * b.r * b.r / b.m, t: 0, trail: [], hits: [], cont: {}, slowT: 0, judged: false, judgedT: 0,
      ev: { board: 0, rim: 0, made: false, swish: false, bank: false, stuck: false, maxY: L.release.y, floor: 0, passX: null }, done: false };
  }
  function hoopStep(L, st, dt) {
    var b = L.ball, r = b.r, H = L.hoop, wallX = H.board + H.wall, n = Math.max(1, Math.round(dt / 0.0005)), h = dt / n;
    var rimC = H.board - (H.nearIn + H.farIn) / 2;
    for (var i = 0; i < n && !st.done; i++) {
      var sp = Math.hypot(st.vx, st.vy), py = st.y;
      st.vx += -st.k * sp * st.vx * h; st.vy += (-G - st.k * sp * st.vy) * h;
      st.x += st.vx * h; st.y += st.vy * h; st.rot += st.w * h; st.t += h;
      if (!st.judged) st.ev.maxY = Math.max(st.ev.maxY, st.y);
      var rb = hitRect(st, r, H.board, H.boardY0, H.board + H.thick, H.boardY1, H.eBoard);
      if (touchStart(st, 'board', rb)) { if (!st.judged) st.ev.board++; st.hits.push({ t: st.t, kind: 'board', v: rb }); }
      for (var k = 0; k < 2; k++) {
        var cx = k === 0 ? H.board - H.nearIn + H.tube : H.board - H.farIn - H.tube;   // 0＝靠籃板那端、1＝外側那端
        var rr = hitCircle(st, r, cx, H.rimY - H.tube, H.tube, H.eRim);
        if (touchStart(st, 'rim' + k, rr)) { if (!st.judged) st.ev.rim++; st.hits.push({ t: st.t, kind: 'rim', v: rr }); }
      }
      if (st.ev.made && st.y < H.rimY - r - 0.02 && st.y > H.rimY - 0.42) {   // 在籃網裡
        st.vx *= Math.exp(-8 * h);
        st.x = Math.max(H.board - H.farIn + 0.04, Math.min(H.board - H.nearIn - 0.04, st.x));
        if (!st._net) { st._net = true; st.hits.push({ t: st.t, kind: 'net' }); }
      }
      var rw = hitRect(st, r, wallX, 0, wallX + 1, 9, 0.5);
      if (touchStart(st, 'wall', rw)) st.hits.push({ t: st.t, kind: 'wall', v: rw });
      if (st.y < r) { var vf = -st.vy; st.y = r; st.vy = 0.75 * Math.abs(st.vy); st.vx *= 0.8; st.ev.floor++; if (vf > 0.3) st.hits.push({ t: st.t, kind: 'floor', v: vf }); }
      if (!st.judged) {
        // 球心由上往下穿過籃框平面：記下穿過的位置（離框中心多遠）；在兩端鐵管之間就是進了
        if (st.ev.passX === null && py >= H.rimY && st.y < H.rimY && st.vy < 0 && st.x > H.board - H.farIn - 0.3 && st.x < H.board) st.ev.passX = st.x - rimC;
        if (!st.ev.made && py >= H.rimY && st.y < H.rimY && st.vy < 0 && st.x > H.board - H.farIn && st.x < H.board - H.nearIn) st.ev.made = true;
        if (st.ev.made && st.y < H.rimY - 0.6) judge(st);                    // 進了：整顆穿過籃網再判（空心要整個過程都沒碰框、沒碰板）
        else if (!st.ev.made && st.ev.floor >= 1) judge(st);                // 沒進：落地就定了
        st.slowT = sp < 0.4 && st.y > 1 ? st.slowT + h : 0;
        if (st.slowT > 0.6) { st.ev.stuck = st.y > H.boardY1 ? 'top' : 'rim'; judge(st); st.done = true; }   // 卡住：停在原處（籃板上面，或籃框和籃板中間）
        if (st.t > 5) judge(st);
        if (st.judged) { st.ev.swish = st.ev.made && st.ev.board === 0 && st.ev.rim === 0; st.ev.bank = st.ev.made && st.ev.board > 0; }
      }
      if (st.judged && (st.ev.floor >= 3 || st.t - st.judgedT > 1.6)) st.done = true;   // 動畫：判定後讓球落地彈一下
      if (st.x < L.world.x0 - 1) { judge(st); st.done = true; }
    }
    trail(st);
  }

  // ---------- 走廊彈力球：先彈地 N 次再打中鈴（地面無摩擦、天花板也會反彈；不計空氣阻力） ----------
  function bellCreate(L, p) {
    var th = p.angle * Math.PI / 180, b = L.balls[p.ball];
    return { x: L.release.x, y: L.release.y, vx: p.speed * Math.cos(th), vy: p.speed * Math.sin(th), b: b, t: 0, trail: [], hits: [], peaks: [], cont: {}, judged: false, judgedT: 0,
      ev: { bounce: 0, hitBell: false, bellAfter: 0, miss: '' }, done: false };
  }
  function bellStep(L, st, dt) {
    var B = L.bell, b = st.b, n = Math.max(1, Math.round(dt / 0.0005)), h = dt / n;
    for (var i = 0; i < n && !st.done; i++) {
      var vy0 = st.vy; st.vy -= G * h; st.x += st.vx * h; st.y += (vy0 + st.vy) * 0.5 * h; st.t += h;
      if (!st.judged && vy0 > 0 && st.vy <= 0) st.peaks.push({ x: st.x, y: st.y, h: st.y - b.r });   // h：球底離地多高（跟 hₙ＝e²ⁿh₀ 比）
      if (st.y < b.r && st.vy < 0) {
        st.y = b.r; st.vy = -b.e * st.vy;
        if (!st.judged) { st.ev.bounce++; st.hits.push({ t: st.t, kind: 'floor', x: st.x, v: -vy0 }); }
        if (Math.abs(st.vy) < 0.05) { st.vy = 0; if (b.e < 0.3) st.vx = 0; if (!st.judged) { st.ev.miss = b.e < 0.3 ? '黏土球幾乎不彈，黏在地上了' : '球彈不起來了，貼著地面滑走'; judge(st); } }
      }
      if (st.y > L.ceiling - b.r && st.vy > 0) { st.y = L.ceiling - b.r; st.vy = -b.e * st.vy; if (!st.judged) st.hits.push({ t: st.t, kind: 'ceiling', x: st.x }); }
      var rb = hitCircle(st, b.r, B.x, B.y, B.R, 0.5);   // 鈴是實心的：打到會彈開
      if (touchStart(st, 'bell', rb) && !st.judged) { st.ev.hitBell = true; st.ev.bellAfter = st.ev.bounce; st.hits.push({ t: st.t, kind: 'bell' }); judge(st); }
      if (!st.judged && st.x > L.world.x1 + 0.2) { st.ev.miss = '球從鈴的旁邊飛過去了'; judge(st); st.done = true; }
      if (!st.judged && st.t > 8) judge(st);
      if (st.judged && (st.t - st.judgedT > 1.2 || st.x > L.world.x1 + 0.5)) st.done = true;
    }
    trail(st);
  }

  // ---------- 夜市擺錘鈴：彈丸撞吊著的鐵牌（黏住 e＝0／彈回 e），鐵牌中心升高 h＝V²/2g ----------
  // 鈴裝在彈片上，鐵牌擺到「升高 ringH[0]」的位置剛好碰到鈴；最高點在 ringH[0]～ringH[1] 之間＝輕輕推開彈片、鈴響；超過 ringH[1]＝太大力，鈴被撞飛
  function pendCreate(L, p) {
    var pel = L.pellets[p.pellet];
    return { x: L.release.x, y: L.release.y, vx: p.speed, vy: 0, pel: pel, M: L.plateM, t: 0, trail: [], hits: [], phase: 'fly', ang: 0, angV: 0, judged: false, judgedT: 0,
      ev: { V: 0, h: 0, ring: false, hard: false, miss: '', hitAt: 0, maxAng: 0 }, done: false, z: 0 };
  }
  function pendStep(L, st, dt) {
    var P = L.plate, n = Math.max(1, Math.round(dt / 0.0005)), h = dt / n, aBell = Math.acos(1 - L.ringH[0] / P.len);
    for (var i = 0; i < n && !st.done; i++) {
      st.t += h;
      if (st.phase === 'fly') {
        var vy0 = st.vy; st.vy -= G * h; st.x += st.vx * h; st.y += (vy0 + st.vy) * 0.5 * h;
        if (st.x + st.pel.r >= P.x - P.w / 2) {
          if (Math.abs(st.y - P.y) > P.h / 2) { st.ev.miss = '彈丸沒打到鐵牌（從' + (st.y > P.y ? '上' : '下') + '面過去）'; judge(st); st.phase = 'miss'; continue; }
          var m = st.pel.m, M = st.M, e = st.pel.e, v = st.vx;
          var V = (1 + e) * m * v / (m + M);                    // 鐵牌得到的速度（e＝0 時就是一起走的速度）
          st.ev.V = V; st.ev.h = V * V / (2 * G); st.ev.hitAt = st.y;
          st.ev.ring = st.ev.h >= L.ringH[0] && st.ev.h <= L.ringH[1]; st.ev.hard = st.ev.h > L.ringH[1];
          st.vx = e > 0 ? (m - e * M) * v / (m + M) : V;        // 彈回（變負）或黏在鐵牌上
          st.angV = V / P.len; st.phase = 'swing'; st.stuck = e === 0; st.swingT = 0; st.hits.push({ t: st.t, kind: 'plate', v: v });
          judge(st);
        }
        if (st.y < 0) { st.ev.miss = '彈丸掉到地上了'; judge(st); st.done = true; }
      } else if (st.phase === 'miss') {   // 沒打到：彈丸繼續飛、落下
        st.vy -= G * h; st.x += st.vx * h; st.y += st.vy * h; if (st.y < L.world.y0 - 0.1 || st.t - st.judgedT > 0.8) st.done = true;
      } else {
        // 單擺：θ'' ＝ −(g/L) sinθ。第一次擺到最高點之前不加阻尼（畫面上擺到的高度＝算出來的 h），之後才慢慢停
        var damp = st._peaked ? 1.2 : 0, a = -(G / P.len) * Math.sin(st.ang) - damp * st.angV, w0 = st.angV;
        st.angV += a * h; st.ang += st.angV * h; st.swingT += h;
        if (!st._peaked && w0 > 0 && st.angV <= 0) st._peaked = true;
        if (st.ang > L.frame[1]) { st.ang = L.frame[1]; if (st.angV > 0) { st.hits.push({ t: st.t, kind: 'frame', v: st.angV * P.len }); st.angV = -0.3 * st.angV; st._peaked = true; } }
        if (st.ang < L.frame[0]) { st.ang = L.frame[0]; if (st.angV < 0) { st.hits.push({ t: st.t, kind: 'frame', v: -st.angV * P.len }); st.angV = -0.3 * st.angV; } }
        st.ev.maxAng = Math.max(st.ev.maxAng, st.ang);
        if (!st._bell && st.ang >= aBell) { st._bell = true; st.hits.push({ t: st.t, kind: st.ev.hard ? 'bellOff' : 'bell' }); }
        if (!st.stuck) { st.x += st.vx * h; st.vy -= G * h; st.y += st.vy * h; if (st.y < L.world.y0 - 0.1) { st.vy = 0; st.vx = 0; } }
        if (st.swingT > 2.2) st.done = true;
      }
    }
    trail(st);
  }

  // ---------- 射箭（3D 質點）：二次阻力、側風；x 往靶、y 往上、z 往右 ----------
  function arrowCreate(L, p) {
    var a = L.arrows[p.arrow], el = p.elev * Math.PI / 180, yaw = Math.atan2(p.windage / 100, L.dist);
    var A = Math.PI * Math.pow(a.d / 2, 2);
    return { x: 0, y: L.release.y, z: 0, vx: a.v * Math.cos(el) * Math.cos(yaw), vy: a.v * Math.sin(el), vz: a.v * Math.cos(el) * Math.sin(yaw),
      k: 0.5 * RHO * a.cd * A / a.m, a: a, wind: p.wind, t: 0, trail: [], hits: [], judged: false, ev: { dy: 0, dz: 0, score: 0, r: 0, tof: 0 }, done: false };
  }
  function arrowStep(L, st, dt) {
    var n = Math.max(1, Math.round(dt / 0.0005)), h = dt / n;
    for (var i = 0; i < n && !st.done; i++) {
      var px = st.x, py = st.y, pz = st.z;
      var rx = st.vx, ry = st.vy, rz = st.vz - st.wind, sp = Math.sqrt(rx * rx + ry * ry + rz * rz);
      st.vx -= st.k * sp * rx * h; st.vy -= (G + st.k * sp * ry) * h; st.vz -= st.k * sp * rz * h;
      st.x += st.vx * h; st.y += st.vy * h; st.z += st.vz * h; st.t += h;
      if (st.x >= L.dist) {   // 跟靶面（x＝dist）的交點：在這一小步裡內插
        var f = (L.dist - px) / (st.x - px), y = py + (st.y - py) * f, z = pz + (st.z - pz) * f;
        st.x = L.dist; st.y = y; st.z = z;
        st.ev.dy = y - L.targetY; st.ev.dz = z; st.ev.r = Math.hypot(st.ev.dy, st.ev.dz); st.ev.tof = st.t; st.ev.atY = y;
        st.ev.score = st.ev.r < L.face / 2 ? 10 - Math.floor(st.ev.r / (L.face / 20)) : 0;
        st.judged = st.done = true;
      }
      if (st.y < 0) { st.ev.score = 0; st.ev.r = 99; st.ev.dy = -99; st.ev.tof = st.t; st.ev.ground = true; st.judged = st.done = true; }
    }
    trail(st);
  }

  // ---------- 一發入魂：空氣砲固定、出口速度固定；穿過牆上的窗口，射進得分箱側面的洞口（拋體＋空氣阻力） ----------
  // 目標 p.target ＝ { x：洞口那一面的位置, y：洞口中心高, wy：窗口中心高 }（每一輪由遊戲重新抽）。牆、得分箱都是實心矩形
  function snipeRects(L, T) {
    var Wl = L.wall, gl = L.goal, r0 = T.y - gl.d / 2, r1 = T.y + gl.d / 2;
    return [
      { kind: 'wall', x0: Wl.x - Wl.t / 2, y0: 0, x1: Wl.x + Wl.t / 2, y1: T.wy - L.window / 2 },
      { kind: 'wall', x0: Wl.x - Wl.t / 2, y0: T.wy + L.window / 2, x1: Wl.x + Wl.t / 2, y1: 3 },
      { kind: 'goal', x0: T.x, y0: 0, x1: T.x + gl.depth, y1: r0 },                    // 洞口下面
      { kind: 'goal', x0: T.x, y0: r1, x1: T.x + gl.depth, y1: r1 + gl.top },          // 洞口上面
      { kind: 'back', x0: T.x + gl.depth * 0.85, y0: r0, x1: T.x + gl.depth, y1: r1 }  // 洞的底
    ];
  }
  function snipeCreate(L, p) {
    var th = p.angle * Math.PI / 180, b = L.ball;
    return { x: L.muzzle.x, y: L.muzzle.y, vx: L.v * Math.cos(th), vy: L.v * Math.sin(th), T: p.target, R: snipeRects(L, p.target), floor: 0,
      k: 0.5 * RHO * b.cd * Math.PI * b.r * b.r / b.m, t: 0, trail: [], hits: [], cont: {}, judged: false, judgedT: 0,
      ev: { wallY: null, goalY: null, inGoal: false, hitWall: false, hitGoal: false, miss: '' }, done: false };
  }
  function snipeStep(L, st, dt) {
    var b = L.ball, r = b.r, T = st.T, Wl = L.wall, gl = L.goal, n = Math.max(1, Math.round(dt / 0.0005)), h = dt / n;
    for (var i = 0; i < n && !st.done; i++) {
      var px = st.x, py = st.y, sp = Math.hypot(st.vx, st.vy);
      if (st.phase === 'in') {   // 進洞了：沿著洞底滾到洞的最裡面停住（洞底是平的、有摩擦）
        st.vx *= Math.exp(-6 * h); st.vy = 0; st.y = T.y - gl.d / 2 + r; st.x = Math.min(st.x + st.vx * h, T.x + gl.depth * 0.85 - r); st.t += h;
        if (st.t - st.judgedT > 0.6) st.done = true;
        continue;
      }
      st.vx += -st.k * sp * st.vx * h; st.vy += (-G - st.k * sp * st.vy) * h;
      st.x += st.vx * h; st.y += st.vy * h; st.t += h;
      var yPre = st.y;   // 碰撞前的高度（紀錄卡用，不要用被擦偏之後的）
      // 給紀錄卡用：球心經過牆中心、經過洞口那一面時的高度
      if (st.ev.wallY === null && px < Wl.x && st.x >= Wl.x) st.ev.wallY = py + (st.y - py) * (Wl.x - px) / (st.x - px);
      if (st.ev.goalY === null && px < T.x && st.x >= T.x) st.ev.goalY = py + (st.y - py) * (T.x - px) / (st.x - px);
      for (var k = 0; k < st.R.length; k++) {
        var q = st.R[k], res = hitRect(st, r, q.x0, q.y0, q.x1, q.y1, 0.3);
        if (touchStart(st, 'r' + k, res)) {
          st.hits.push({ t: st.t, kind: q.kind === 'back' ? 'in' : q.kind, v: res });
          if (!st.judged && q.kind === 'wall') {
            st.ev.hitWall = true; st.ev.wallY = yPre; var off = yPre - T.wy, edge = Math.abs(off) < L.window / 2;
            st.ev.miss = (edge ? '擦到窗口' + (off > 0 ? '上緣' : '下緣') + '，不算' : '撞到牆') + '（碰到時球心比窗口中心' + (off > 0 ? '高 ' : '低 ') + (Math.abs(off) * 100).toFixed(1) + ' cm）'; judge(st);
          }
          if (!st.judged && q.kind === 'goal') { st.ev.hitGoal = true; var gy = st.ev.goalY !== null ? st.ev.goalY : st.y, far = Math.abs(gy - T.y) > gl.d / 2 + r; st.ev.miss = (far ? '打到得分箱正面' : '打到洞口邊緣彈出去') + '（比洞口中心' + (gy > T.y ? '高 ' : '低 ') + (Math.abs(gy - T.y) * 100).toFixed(1) + ' cm）'; judge(st); }
        }
      }
      // 整顆球過了洞口那一面、而且在洞口上下緣之間：進了
      if (!st.judged && st.x - r > T.x && Math.abs(st.y - T.y) < gl.d / 2) { st.ev.inGoal = true; st.phase = 'in'; st.hits.push({ t: st.t, kind: 'goal_in', v: sp }); judge(st); }
      if (st.y < r) { var vf = -st.vy; st.y = r; st.vy = 0.3 * Math.abs(st.vy); st.vx *= 0.6; st.floor++; if (vf > 0.3) st.hits.push({ t: st.t, kind: 'floor', v: vf }); if (!st.judged) { st.ev.miss = st.x < T.x ? '落在得分箱前面（離洞口還有 ' + ((T.x - st.x) * 100).toFixed(1) + ' cm）' : '從得分箱上面飛過去了'; judge(st); } }
      if (!st.judged && (st.x > L.world.x1 + 0.3 || st.t > 3)) { st.ev.miss = '從得分箱上面飛過去了'; judge(st); }
      if (st.judged && (st.t - st.judgedT > (st.ev.inGoal ? 0.6 : 1.2) || st.floor >= 3 || st.x > L.world.x1 + 0.5 || st.x < L.world.x0 - 0.3)) st.done = true;
    }
    trail(st);
  }

  // ---------- 停車格：彈簧把 A 車推出去（彈簧位能 ½kx² 全給 A 車）→ 撞 B 車 → B 車在摩擦墊上滑停（氣墊軌道沒摩擦，摩擦墊上 μ） ----------
  function parkCreate(L, p) {
    var mA = L.opts.mA[p.mA].m, e = L.opts.bump[p.bump].e, x = p.comp / 100, R = L.rail;
    var A = { m: mA, rear: R.plunger - x, v: 0, len: R.carL }, B = { m: R.mB, rear: R.padX, v: 0, len: R.carL };
    return { A: A, B: B, e: e, comp: x, t: 0, phase: 'push', trail: [], hits: [], stuck: false, x: 0, y: 0, judged: false, judgedT: 0,
      ev: { W: 0.5 * R.k * x * x, vA: 0, vA2: null, vB: null, dB: null, inSlot: false, miss: '' }, done: false };
  }
  function parkStep(L, st, dt) {
    var R = L.rail, A = st.A, B = st.B, n = Math.max(1, Math.round(dt / 0.0005)), h = dt / n, mu = R.mu * G;
    function onPad(c) { var mid = c.rear + c.len / 2; return mid >= R.padX && mid <= R.padX + R.padL; }
    function fric(c) {   // 車子中心在摩擦墊上才有摩擦（等減速 μg，停了就不動）
      if (!onPad(c) || c.v === 0) return;
      var dv = mu * h; c.v = Math.abs(c.v) <= dv ? 0 : c.v - dv * (c.v > 0 ? 1 : -1);
    }
    function canReach() {   // A 車還會不會追上（已經停下的）B 車：在墊子上會等減速；還沒上墊子的話先等速走到墊子
      if (st.stuck || A.v <= 0) return false;
      var gap = B.rear - (A.rear + A.len), toPad = Math.max(0, R.padX - (A.rear + A.len / 2));
      return toPad + A.v * A.v / (2 * mu) >= gap;
    }
    function fricPair() {   // 黏在一起：摩擦力只算中心在墊子上的那幾台
      var F = 0, M = A.m + B.m;
      [A, B].forEach(function (c) { if (onPad(c)) F += R.mu * c.m * G; });
      var dv = F / M * h; if (A.v !== 0) A.v = Math.abs(A.v) <= dv ? 0 : A.v - dv * (A.v > 0 ? 1 : -1); B.v = A.v;
    }
    for (var i = 0; i < n && !st.done; i++) {
      st.t += h;
      if (st.phase === 'push') {   // 彈簧推 A 車：F＝k·(壓縮量)，彈簧本身沒有質量
        if (st.comp <= 0) { st.ev.miss = '彈簧沒有壓，車子不會動'; judge(st); st.done = true; break; }
        var cmp = R.plunger - A.rear;
        if (cmp > 0) { A.v += R.k * cmp / A.m * h; A.rear += A.v * h; }
        else {
          st.phase = 'run'; st.ev.vA = A.v;
          if (A.v < 0.05) { st.ev.miss = 'A 車太慢（每秒不到 5 cm，要很久才撞得到 B 車），這次不算'; judge(st); st.done = true; break; }
        }
        continue;
      }
      if (st.stuck) { fricPair(); A.rear += A.v * h; B.rear = A.rear + A.len; }
      else { fric(A); fric(B); A.rear += A.v * h; B.rear += B.v * h; }
      // A 撞 B（A 的車頭碰到 B 的車尾）
      if (!st.stuck && A.rear + A.len >= B.rear && A.v > B.v) {
        var u = A.v - B.v, M = A.m + B.m;
        if (st.e === 0) { var Vc = (A.m * A.v + B.m * B.v) / M; A.v = B.v = Vc; st.stuck = true; A.rear = B.rear - A.len; }
        else { A.v -= (1 + st.e) * B.m / M * u; B.v += (1 + st.e) * A.m / M * u; A.rear = B.rear - A.len; }
        if (st.ev.vB === null) { st.ev.vB = B.v; st.ev.vA2 = A.v; }
        st.hits.push({ t: st.t, kind: st.e === 0 ? 'stick' : 'bump', v: u });
      }
      // 彈回來的 A 車：發射器有緩衝墊接住（不會再衝回去撞 B）
      if (A.v < 0 && A.rear <= R.plunger) { A.rear = R.plunger; A.v = 0; }
      // 軌道盡頭的擋板
      if (B.rear + B.len >= R.endX && B.v > 0) { B.rear = R.endX - B.len; B.v = -0.3 * B.v; if (!st.judged) { st.ev.miss = 'B 車衝出摩擦墊、撞到軌道盡頭'; } st.hits.push({ t: st.t, kind: 'end', v: B.v }); }
      // B 車停了（或兩台黏著停了）：結果定了；A 車還在慢慢滑的話，動畫再跑一下
      if (!st.judged && st.ev.vB !== null && B.v === 0 && !canReach()) { judge(st); st.ev.dB = B.rear - R.padX; st.hits.push({ t: st.t, kind: 'stop' }); }
      if (st.judged && (Math.abs(A.v) < 1e-6 || st.t - st.judgedT > 1.5)) st.done = true;
      if (st.t > 20) { if (!st.judged) { st.ev.miss = st.ev.miss || 'A 車太慢，還沒撞到 B 車'; judge(st); } st.done = true; }
    }
    if (st.ev.dB === null || !st.judged) st.ev.dB = B.rear - R.padX;
    if (st.judged && !st._final) {
      st._final = true;
      st.ev.inSlot = !st.ev.miss && st.ev.vB !== null && st.ev.dB >= L.slot[0] - 1e-9 && st.ev.dB <= L.slot[1] + 1e-9;
      if (!st.ev.inSlot && !st.ev.miss && st.ev.vB !== null) st.ev.miss = st.ev.dB < L.slot[0] ? '差 ' + ((L.slot[0] - st.ev.dB) * 100).toFixed(1) + ' cm 才到格子' : '超過格子 ' + ((st.ev.dB - L.slot[1]) * 100).toFixed(1) + ' cm';
    }
    st.x = B.rear + B.len; st.y = 0;   // 給軌跡用
  }

  var SIMS = { hoop: { create: hoopCreate, step: hoopStep }, bell: { create: bellCreate, step: bellStep }, pend: { create: pendCreate, step: pendStep }, arrow: { create: arrowCreate, step: arrowStep },
    snipe: { create: snipeCreate, step: snipeStep }, park: { create: parkCreate, step: parkStep } };
  function runAll(L, p) { var s = SIMS[L.sim], st = s.create(L, p), n = 0; while (!st.done && n < 40000) { s.step(L, st, 1 / 120); n++; } return st; }
  // 一發入魂：抽一輪的得分箱位置（量到 mm），窗口中心放在「低拋解」經過牆的高度；th0、th1 是不計阻力的兩個公式解（度）
  function snipeTarget(L, rnd) {
    for (var k = 0; k < 100; k++) {
      var x = Math.round((L.targets.x[0] + (L.targets.x[1] - L.targets.x[0]) * rnd()) * 1000) / 1000;
      var y = Math.round((L.targets.y[0] + (L.targets.y[1] - L.targets.y[0]) * rnd()) * 1000) / 1000;
      var X = x - L.muzzle.x, Yd = y - L.muzzle.y, A = G * X * X / (2 * L.v * L.v), disc = X * X - 4 * A * (A + Yd);
      if (disc < 0) continue;
      var u = (X - Math.sqrt(disc)) / (2 * A), xw = L.wall.x - L.muzzle.x;
      var wy = L.muzzle.y + xw * u - G * xw * xw * (1 + u * u) / (2 * L.v * L.v);
      return { x: x, y: y, wy: wy, th0: Math.atan(u) * 180 / Math.PI, th1: Math.atan((X + Math.sqrt(disc)) / (2 * A)) * 180 / Math.PI };
    }
    return null;
  }
  root.SportSim = { SIMS: SIMS, runAll: runAll, snipeTarget: snipeTarget, snipeRects: snipeRects, G: G, RHO: RHO };
})(typeof window !== 'undefined' ? window : globalThis);
