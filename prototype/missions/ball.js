/* 任務關 A：讓鋼珠打中目標杯（國二 物理，E3）
 * 玩家自己挑器材、決定放球的高度與桌子墊多高，按「放手」看落點；遊戲用玩家的設定算出落點（滾動的實心球：v² = 10/7·g·h，平拋）。
 * 不用玩家計算：每次試做的數據都記在表上，玩家看數據調整。
 * 安全：放手前要請同學離開落地區，否則判失敗。
 * innerHTML 只放程式內寫死的字串與遊戲算出的數字，沒有玩家輸入的文字。 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var K = 1.6;              // 1 cm = 1.6 px
  var FLOOR = 270, EDGE = 150, H0 = 80, RAMP_H = 40;
  var TARGET = 105, CUP_R = 3;   // 目標杯距桌邊 105 cm，杯口半徑 3 cm

  var ITEMS = [
    { id: 'ramp', name: '斜面軌道', tip: '出口是水平的，放在桌邊' },
    { id: 'steel', name: '鋼珠', tip: '實心鋼球' },
    { id: 'pingpong', name: '乒乓球', tip: '空心、很輕的球' },
    { id: 'tape', name: '捲尺', tip: '量落點離桌邊多遠' },
    { id: 'carbon', name: '複寫紙', tip: '鋪在地上，球落地會留下點' },
    { id: 'block', name: '木塊', tip: '每塊 10 cm，可以把桌子墊高' },
    { id: 'magnet', name: '強力磁鐵', tip: '很強的磁鐵' },
    { id: 'scale', name: '電子秤', tip: '量質量' }
  ];
  var ICON = {
    ramp: '<path d="M6 40 Q30 40 42 12" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M6 44h36" stroke="currentColor" stroke-width="2.4"/>',
    steel: '<circle cx="24" cy="24" r="12" fill="#9aa5b1" stroke="currentColor" stroke-width="2.4"/><circle cx="19" cy="19" r="3" fill="#fff"/>',
    pingpong: '<circle cx="24" cy="24" r="12" fill="#fff" stroke="currentColor" stroke-width="2.4"/><path d="M14 20q10 6 20 0" fill="none" stroke="#f08a24" stroke-width="2"/>',
    tape: '<rect x="8" y="14" width="24" height="24" rx="6" fill="#ffd23f" stroke="currentColor" stroke-width="2.4"/><path d="M32 30h12" stroke="currentColor" stroke-width="3"/><circle cx="20" cy="26" r="4" fill="none" stroke="currentColor" stroke-width="2"/>',
    carbon: '<rect x="8" y="12" width="32" height="24" rx="2" fill="#3b4a5a" stroke="currentColor" stroke-width="2"/><circle cx="20" cy="24" r="2.5" fill="#fff"/><circle cx="28" cy="22" r="2.5" fill="#fff"/>',
    block: '<rect x="10" y="20" width="28" height="16" fill="#d9a066" stroke="currentColor" stroke-width="2.4"/><path d="M10 20l6-6h28l-6 6M38 36l6-6V14" fill="none" stroke="currentColor" stroke-width="2"/>',
    magnet: '<path d="M14 10v16a10 10 0 0 0 20 0V10h-7v16a3 3 0 0 1-6 0V10z" fill="#e5484d" stroke="currentColor" stroke-width="2.4"/><path d="M14 10h7v6h-7zM27 10h7v6h-7z" fill="#ddd"/>',
    scale: '<rect x="8" y="26" width="32" height="12" rx="3" fill="#cfd8e0" stroke="currentColor" stroke-width="2.4"/><rect x="12" y="20" width="24" height="6" rx="2" fill="currentColor"/>'
  };
  function icon(id, size) { size = size || 40; return '<svg viewBox="0 0 48 48" width="' + size + '" height="' + size + '" aria-hidden="true">' + (ICON[id] || '') + '</svg>'; }
  function el(tag, a, p) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }

  var st, shell, svg, G = {};

  function fresh() {
    return { ramp: false, ball: null, tape: false, carbon: false, blocks: 0, hasBlock: false, magnet: false, scale: false,
      h: 20, friend: true, tries: 0, data: [], marks: [], traps: 0, fails: 0, busy: false, passed: false };
  }
  function H() { return H0 + st.blocks * 10; }
  function tableTop() { return FLOOR - H() * K; }
  function rampY(x) { var f = (EDGE - x) / 110; return tableTop() - RAMP_H * K * f * f; }
  function releaseX(h) { return EDGE - 110 * Math.sqrt(h / RAMP_H); }
  function range(h, ball) {
    var x = Math.sqrt((ball === 'steel' ? 20 / 7 : 12 / 5) * h * H());   // 實心球 10/7、空心球 6/5
    return ball === 'pingpong' ? x * 0.86 : x;                          // 乒乓球另外受空氣阻力（遊戲設定值）
  }

  function buildScene(host) {
    svg = el('svg', { viewBox: '0 0 400 290', class: 'lab-svg', role: 'img', 'aria-label': '桌子、斜面與地上的目標杯' });
    el('line', { x1: 0, y1: FLOOR, x2: 400, y2: FLOOR, class: 'table' }, svg);
    G.tapeG = el('g', {}, svg);
    for (var d = 0; d <= 140; d += 10) {
      var x = EDGE + d * K;
      el('line', { x1: x, x2: x, y1: FLOOR, y2: FLOOR + (d % 50 ? 5 : 9), class: 'grad' }, G.tapeG);
      if (d % 20 === 0) el('text', { x: x, y: FLOOR + 18, 'text-anchor': 'middle', 'font-size': 9, fill: 'currentColor' }, G.tapeG).textContent = d;
    }
    G.carbon = el('rect', { x: EDGE + 70 * K, y: FLOOR - 3, width: 60 * K, height: 4, fill: '#3b4a5a' }, svg);
    G.table = el('g', {}, svg);
    G.marks = el('g', {}, svg);
    // 目標杯
    var cx = EDGE + TARGET * K;
    G.cup = el('g', {}, svg);
    el('path', { d: 'M' + (cx - CUP_R * K - 3) + ' ' + (FLOOR - 16) + ' L' + (cx - CUP_R * K) + ' ' + FLOOR + ' L' + (cx + CUP_R * K) + ' ' + FLOOR + ' L' + (cx + CUP_R * K + 3) + ' ' + (FLOOR - 16) + ' Z', fill: '#e5484d', stroke: '#1d2a36', 'stroke-width': 2 }, G.cup);
    el('text', { x: cx, y: FLOOR - 22, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#e5484d' }, G.cup).textContent = 'B';
    // 同學
    G.friend = el('g', {}, svg);
    var fx = EDGE + 120 * K;
    el('circle', { cx: fx, cy: FLOOR - 62, r: 9, fill: '#f4d9b8', stroke: '#1d2a36', 'stroke-width': 2 }, G.friend);
    el('path', { d: 'M' + (fx - 10) + ' ' + (FLOOR - 50) + ' h20 v28 h-20 z', fill: '#4c7cbf', stroke: '#1d2a36', 'stroke-width': 2 }, G.friend);
    el('path', { d: 'M' + (fx - 7) + ' ' + (FLOOR - 22) + ' v22 M' + (fx + 7) + ' ' + (FLOOR - 22) + ' v22', stroke: '#1d2a36', 'stroke-width': 4 }, G.friend);
    G.path = el('path', { d: '', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-dasharray': '3 4', opacity: .6 }, svg);
    G.ball = el('circle', { r: 6, class: 'tbulb' }, svg);
    G.magnet = el('g', {}, svg);
    el('rect', { x: EDGE - 30, y: 0, width: 14, height: 10, fill: '#e5484d', stroke: '#1d2a36', 'stroke-width': 2 }, G.magnet);
    host.appendChild(svg);
  }

  function drawTable() {
    while (G.table.firstChild) G.table.removeChild(G.table.firstChild);
    var top = tableTop();
    for (var b = 0; b < st.blocks; b++) {   // 木塊在桌腳下
      el('rect', { x: 26, y: FLOOR - (b + 1) * 10 * K, width: 16, height: 10 * K, fill: '#d9a066', stroke: '#1d2a36', 'stroke-width': 1.5 }, G.table);
      el('rect', { x: 128, y: FLOOR - (b + 1) * 10 * K, width: 16, height: 10 * K, fill: '#d9a066', stroke: '#1d2a36', 'stroke-width': 1.5 }, G.table);
    }
    var legTop = top + 6, legBot = FLOOR - st.blocks * 10 * K;
    el('rect', { x: 14, y: top, width: EDGE - 14, height: 7, rx: 2, class: 'metal' }, G.table);
    el('line', { x1: 34, y1: legTop, x2: 34, y2: legBot, class: 'leg' }, G.table);
    el('line', { x1: 136, y1: legTop, x2: 136, y2: legBot, class: 'leg' }, G.table);
    el('text', { x: 85, y: top + 22, 'text-anchor': 'middle', 'font-size': 10, fill: 'currentColor' }, G.table).textContent = '桌高 ' + H() + ' cm';
    if (st.ramp) {
      var d = 'M40 ' + rampY(40);
      for (var x = 45; x <= EDGE; x += 5) d += ' L' + x + ' ' + rampY(x);
      el('path', { d: d + ' L' + EDGE + ' ' + (top) + ' L40 ' + top + ' Z', fill: '#cfd8e0', stroke: '#1d2a36', 'stroke-width': 2 }, G.table);
      // 斜面上的高度刻度（每 10 cm）
      for (var hh = 10; hh <= 40; hh += 10) {
        var rx = releaseX(hh);
        el('line', { x1: rx, x2: rx - 6, y1: rampY(rx), y2: rampY(rx) - 4, stroke: '#1d2a36', 'stroke-width': 1.2 }, G.table);
        el('text', { x: rx - 8, y: rampY(rx) - 6, 'font-size': 8, 'text-anchor': 'end', fill: 'currentColor' }, G.table).textContent = hh;
      }
    }
  }

  function render() {
    drawTable();
    G.tapeG.style.display = st.tape ? '' : 'none';
    G.carbon.style.display = st.carbon ? '' : 'none';
    G.marks.style.display = st.carbon ? '' : 'none';
    G.friend.style.display = st.friend ? '' : 'none';
    G.magnet.style.display = st.magnet ? '' : 'none';
    if (st.magnet) G.magnet.setAttribute('transform', 'translate(0,' + (tableTop() - 14) + ')');
    if (!st.busy) {
      if (st.ramp && st.ball) { var x = releaseX(st.h); G.ball.setAttribute('cx', x); G.ball.setAttribute('cy', rampY(x) - 6); G.ball.style.display = ''; }
      else G.ball.style.display = 'none';
    }
    G.ball.setAttribute('class', st.ball === 'pingpong' ? 'ice' : 'tbulb');
    if (st.ball === 'pingpong') G.ball.setAttribute('fill', '#ffffff'); else G.ball.removeAttribute('fill');
    var hOut = shell.$('#out_h'), bOut = shell.$('#out_b');
    hOut.textContent = st.h.toFixed(1) + ' cm'; shell.$('#rng_h').value = st.h;
    bOut.textContent = st.blocks + ' 塊（桌高 ' + H() + ' cm）'; shell.$('#rng_b').value = st.blocks;
    shell.$('#rng_b').disabled = !st.hasBlock; shell.$('#sl_b').setAttribute('aria-disabled', String(!st.hasBlock));
    shell.$('#btnGo').disabled = st.busy;
    shell.$('#btnFriend').disabled = !st.friend || st.busy;
    shell.tries(st.tries);
    // 數據表
    var rows = st.data.map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + r.ball + '</td><td>' + r.h.toFixed(1) + '</td><td>' + r.H + '</td><td' + (r.hit ? ' class="hit"' : '') + '>' + r.x + '</td></tr>';
    }).join('');
    shell.$('#datalog').innerHTML = st.data.length ? '<table class="data"><thead><tr><th>次</th><th>球</th><th>放球高度 cm</th><th>桌高 cm</th><th>落點 cm</th></tr></thead><tbody>' + rows + '</tbody></table>' : '<p class="ctl-note">每次放手的數據會記在這裡。</p>';
  }

  function onItem(id) {
    if (st.busy || st.passed) return;
    switch (id) {
      case 'ramp': st.ramp = true; shell.used(id); shell.say('斜面放在桌邊了，出口是水平的。'); break;
      case 'steel': st.ball = 'steel'; shell.used('steel'); shell.used('pingpong', false); shell.say('放上鋼珠。用「放球高度」決定從斜面多高的地方放手。'); break;
      case 'pingpong': st.ball = 'pingpong'; st.traps++; shell.used('pingpong'); shell.used('steel', false); shell.say('放上乒乓球。（它很輕，會受空氣影響。）', 'warn'); break;
      case 'tape': st.tape = true; shell.used(id); shell.say('沿著地板拉好捲尺，可以讀落點離桌邊幾公分。'); break;
      case 'carbon': st.carbon = true; shell.used(id); shell.say('地上鋪了複寫紙，每次落地都會留下點。'); break;
      case 'block': st.hasBlock = true; shell.used(id); shell.say('拿到木塊了，可以用「桌腳墊高」調桌子高度。'); break;
      case 'magnet': st.magnet = true; st.traps++; shell.used(id); shell.say('在斜面旁放了強力磁鐵。', 'warn'); break;
      case 'scale': st.traps++; shell.used(id); shell.say('秤了一下：鋼珠 28 g、乒乓球 2.7 g。（這題用得到質量嗎？）', 'warn'); break;
    }
    render();
  }

  function go() {
    if (st.busy || st.passed) return;
    if (!st.ramp) return shell.say('要先放斜面軌道。', 'warn');
    if (!st.ball) return shell.say('要先放一顆球。', 'warn');
    if (st.friend) { st.fails++; return shell.fail('ball', '危險！落地區有人', '放手前要先確認落地區沒有人。鋼珠飛出去可能打傷同學。請同學退到安全線後再試。'); }
    st.tries++; st.busy = true; render();
    var h = st.h, Hh = H(), ball = st.ball;
    var x = range(h, ball), magnetGrab = st.magnet && ball === 'steel';
    // 動畫：先沿斜面滾下，再拋出去
    var x0 = releaseX(h), t0 = performance.now(), roll = 600, fly = 650, pts = [];
    var landPx = EDGE + x * K, top = tableTop() - 6;
    function frame(now) {
      var t = now - t0, px, py;
      if (t < roll) {
        var f = t / roll; f = f * f;
        px = x0 + (EDGE - x0) * f; py = rampY(px) - 6;
        if (magnetGrab && px > EDGE - 32) { G.ball.setAttribute('cx', EDGE - 24); G.ball.setAttribute('cy', top - 8); return done(null); }
      } else if (t < roll + fly) {
        var g = (t - roll) / fly;
        px = EDGE + (landPx - EDGE) * g; py = top + (FLOOR - 6 - top) * g * g;
        pts.push(px + ' ' + py);
      } else return done(x);
      G.ball.setAttribute('cx', px); G.ball.setAttribute('cy', py);
      if (pts.length > 1) G.path.setAttribute('d', 'M' + pts.join(' L'));
      requestAnimationFrame(frame);
    }
    function done(xx) {
      st.busy = false;
      if (xx === null) {
        st.data.push({ ball: '鋼珠', h: h, H: Hh, x: '被磁鐵吸住', hit: false }); render();
        return shell.result(false, '鋼珠被磁鐵吸住了', '鋼珠是鐵做的，經過強力磁鐵旁邊就被吸過去了。這題用不到磁鐵，把它拿走再試。', '');
      }
      var hit = Math.abs(xx - TARGET) <= CUP_R;
      var reading = st.tape ? xx.toFixed(1) : '（沒有捲尺，量不到）';
      if (st.carbon) el('circle', { cx: EDGE + xx * K, cy: FLOOR - 1, r: 2.5, fill: hit ? '#2c8a5a' : '#1d2a36' }, G.marks);
      st.data.push({ ball: ball === 'steel' ? '鋼珠' : '乒乓球', h: h, H: Hh, x: reading, hit: hit });
      G.ball.setAttribute('cx', EDGE + xx * K); G.ball.setAttribute('cy', FLOOR - 6);
      if (hit) {
        st.passed = true;
        var stars = 1 + (st.tries <= 3 ? 1 : 0) + (st.traps === 0 && st.fails === 0 ? 1 : 0);
        if (window.LabRecords) window.LabRecords.onPass('M-BALL', stars);
        shell.status('過關', 'done');
        shell.say('命中！落點 ' + xx.toFixed(1) + ' cm，鋼珠掉進杯子了。', 'ok');
        shell.result(true, '命中！' + '★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars),
          '第 ' + st.tries + ' 次試做打進杯子。落點 ' + xx.toFixed(1) + ' cm，杯子在 ' + TARGET + ' cm。',
          '球從越高的地方放手，離開桌邊時越快，飛得越遠；桌子越高，在空中的時間越長，也飛得越遠。球的質量不影響落點（乒乓球飛不遠是因為空氣阻力和它是空心的）。');
      } else {
        var miss = st.tape ? '落點 ' + xx.toFixed(1) + ' cm，杯子在 ' + TARGET + ' cm，' + (xx < TARGET ? '還差 ' + (TARGET - xx).toFixed(1) + ' cm。' : '超過 ' + (xx - TARGET).toFixed(1) + ' cm。') : '沒有捲尺，只看得出' + (xx < TARGET ? '落在杯子前面。' : '飛過杯子了。');
        shell.say('沒打中：' + miss + '調整後再放一次。', 'warn');
        shell.status('沒打中', 'hot');
      }
      render();
    }
    requestAnimationFrame(frame);
  }

  function controls() {
    var c = shell.$('#controls');
    c.innerHTML =
      '<div class="slider"><div class="slider-top"><span class="slider-label">放球高度（斜面上）</span><output id="out_h"></output></div>' +
      '<div class="slider-row"><button class="step" type="button" data-s="h" data-k="-1" aria-label="放球高度減少">－</button><input type="range" id="rng_h" min="2" max="40" step="0.5" aria-label="放球高度"><button class="step" type="button" data-s="h" data-k="1" aria-label="放球高度增加">＋</button></div></div>' +
      '<div class="slider" id="sl_b"><div class="slider-top"><span class="slider-label">桌腳墊高（要有木塊）</span><output id="out_b"></output></div>' +
      '<div class="slider-row"><button class="step" type="button" data-s="b" data-k="-1" aria-label="木塊減少">－</button><input type="range" id="rng_b" min="0" max="3" step="1" aria-label="木塊數"><button class="step" type="button" data-s="b" data-k="1" aria-label="木塊增加">＋</button></div></div>';
    shell.$('#rng_h').addEventListener('input', function (e) { if (!st.busy) { st.h = +e.target.value; render(); } });
    shell.$('#rng_b').addEventListener('input', function (e) { if (!st.busy && st.hasBlock) { st.blocks = +e.target.value; render(); } });
    c.addEventListener('click', function (e) {
      var b = e.target.closest('.step'); if (!b || st.busy) return;
      var k = +b.getAttribute('data-k');
      if (b.getAttribute('data-s') === 'h') st.h = Math.max(2, Math.min(40, st.h + 0.5 * k));
      else if (st.hasBlock) st.blocks = Math.max(0, Math.min(3, st.blocks + k));
      render();
    });
    var a = shell.$('#actions');
    a.innerHTML = '<button class="btn" type="button" id="btnFriend">請同學退到安全線後</button><button class="btn primary" type="button" id="btnGo">放手</button>';
    shell.$('#btnGo').addEventListener('click', go);
    shell.$('#btnFriend').addEventListener('click', function () { st.friend = false; shell.say('同學退到安全線後了。', 'ok'); render(); });
  }

  function reset() {
    st = fresh();
    while (G.marks.firstChild) G.marks.removeChild(G.marks.firstChild);
    G.path.setAttribute('d', '');
    shell.status('準備中'); shell.say('挑器材放上實驗桌，設定好再按「放手」。');
    render();
  }

  window.addEventListener('DOMContentLoaded', function () {
    st = fresh();
    shell = new window.MissionShell(document.getElementById('app'), {
      stage: '國二 物理・力與運動', title: '把鋼珠送進杯子', diff: 'E3',
      mission: '讓鋼珠從斜面滾下、飛出桌邊，掉進地上的紅色杯子 B（杯子離桌邊 105 cm）。',
      missionNote: '自己挑器材、決定從斜面多高的地方放手、要不要把桌子墊高。每次放手的數據都會記下來。',
      intro: '挑器材放上實驗桌，設定好再按「放手」。',
      items: ITEMS, icon: icon, onItem: onItem, onReset: reset
    });
    buildScene(shell.$('#scene'));
    controls();
    render();
    if (window.LabRecords) window.LabRecords.markPlay();
    window.__ball = { st: function () { return st; }, range: range, H: H };
  });
})();
