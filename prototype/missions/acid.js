/* 任務關 B：配出 2.0 M 鹽酸 100 mL（高中基礎化學，E4）
 * 老闆 10/19 的例子：玩家自己決定要哪些材料、用多少 mL、實驗順序；最後遊戲用玩家的數據算出幾 M，判定是否通過。
 * 把水加進濃鹽酸 → 直接顯示「強酸飛濺」失敗，重來。
 * 老闆 10/19：莫耳濃度是 mol/L，試藥瓶要給真實標示（質量百分率、密度），學生自己換算。
 * 濃鹽酸試藥：HCl 37.0%（質量百分率）、密度 1.19 g/mL、HCl 分子量 36.46 g/mol
 *   → 每 mL 含 HCl 1.19 × 0.370 ÷ 36.46 = 0.012076 mol，也就是 12.08 mol/L。
 * 計算：HCl 莫耳數 n = 取用體積(mL) × 0.012076（× 有沒有潤洗燒杯）；濃度 = n ÷ 容量瓶最後的體積(L)。
 * innerHTML 只放程式內寫死的字串與遊戲算出的數字，沒有玩家輸入的文字。 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var RHO = 1.19, WT = 0.370, MW = 36.46, NPER = RHO * WT / MW;   // 每 mL 濃鹽酸含 HCl 的 mol 數
  var C0 = NPER * 1000, TARGET = 2.0, TOL = 0.1;

  var ITEMS = [
    { id: 'goggles', name: '護目鏡', tip: '保護眼睛' },
    { id: 'gloves', name: '耐酸手套', tip: '保護手' },
    { id: 'hcl', name: '濃鹽酸 37%', tip: '試藥瓶標示：HCl 37.0%（質量百分率）、密度 1.19 g/mL、分子量 36.46；有腐蝕性' },
    { id: 'water', name: '純水洗瓶', tip: '去離子水' },
    { id: 'tap', name: '自來水', tip: '水龍頭的水' },
    { id: 'beaker', name: '燒杯 250 mL', tip: '用來先稀釋' },
    { id: 'flask', name: '容量瓶 100 mL', tip: '瓶頸有一條刻度線' },
    { id: 'pipette', name: '刻度吸量管', tip: '附安全吸球，最小刻度 0.1 mL' },
    { id: 'cylinder', name: '量筒 50 mL', tip: '最小刻度 1 mL' },
    { id: 'naoh', name: '氫氧化鈉溶液', tip: '鹼性溶液' },
    { id: 'lamp', name: '酒精燈', tip: '加熱用' }
  ];
  var ICON = {
    goggles: '<path d="M6 20c0-4 4-6 9-6h18c5 0 9 2 9 6v6c0 4-3 6-7 6h-4l-3-4h-4l-3 4h-4c-4 0-7-2-7-6z" fill="#dff1ff" stroke="currentColor" stroke-width="2.4"/>',
    gloves: '<path d="M14 40V20q0-3 3-3t3 3v-6q0-3 3-3t3 3v6-8q0-3 3-3t3 3v14l3-4q3-2 5 0l-8 15H14z" fill="#ffd23f" stroke="currentColor" stroke-width="2.2"/>',
    hcl: '<path d="M18 6h12v6l6 6v24H12V18l6-6z" fill="#fff" stroke="currentColor" stroke-width="2.4"/><path d="M17 26l7-6 7 6-7 6z" fill="#fff" stroke="#e5484d" stroke-width="2"/><path d="M14 34h20" stroke="currentColor" stroke-width="2"/>',
    water: '<path d="M16 16h16v24a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4z" fill="#d6eefa" stroke="currentColor" stroke-width="2.4"/><path d="M24 16V8h10" fill="none" stroke="currentColor" stroke-width="2.4"/>',
    tap: '<path d="M8 14h20v6H8z M28 16h6v14" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M34 34c-2 3-2 5 0 6 2-1 2-3 0-6z" fill="#6aa7c5"/>',
    beaker: '<path d="M14 8h20M16 8v28a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4V8" fill="none" stroke="currentColor" stroke-width="2.4"/>',
    flask: '<path d="M21 4h6v14l10 12a8 8 0 0 1-6 12H17a8 8 0 0 1-6-12l10-12z" fill="#fff" stroke="currentColor" stroke-width="2.4"/><path d="M21 12h6" stroke="#e5484d" stroke-width="2"/>',
    pipette: '<path d="M22 4h4v32l-2 8-2-8z" fill="#fff" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="6" r="5" fill="#e5484d" stroke="currentColor" stroke-width="2"/>',
    cylinder: '<path d="M19 6h10M20 6v34h8V6M16 40h16" fill="none" stroke="currentColor" stroke-width="2.4"/>',
    naoh: '<path d="M18 6h12v6l6 6v24H12V18l6-6z" fill="#efe4ff" stroke="currentColor" stroke-width="2.4"/><path d="M14 30h20" stroke="currentColor" stroke-width="2"/>',
    lamp: '<path d="M14 40h20l-3-14H17z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M21 26v-4h6v4" fill="none" stroke="currentColor" stroke-width="2.4"/>'
  };
  function icon(id, size) { size = size || 40; return '<svg viewBox="0 0 48 48" width="' + size + '" height="' + size + '" aria-hidden="true">' + (ICON[id] || '') + '</svg>'; }
  function el(tag, a, p) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }

  var st, shell, G = {};
  function fresh() {
    return { have: {}, goggles: false, gloves: false, waterSrc: null, wAdd: 50, vSet: 10, offset: 0.0,
      beakerW: 0, beakerA: 0, acidFirst: false, impure: false, base: false, stirred: false, rinse: true,
      inFlask: false, toMark: false, shaken: false, measured: null, vReal: 0, tool: null, traps: 0, steps: [] };
  }
  function log(t) { st.steps.push(t); }

  function buildScene(host) {
    var svg = el('svg', { viewBox: '0 0 400 290', class: 'lab-svg', role: 'img', 'aria-label': '燒杯、容量瓶與藥品' });
    el('line', { x1: 10, y1: 272, x2: 390, y2: 272, class: 'table' }, svg);
    // 藥品架
    G.shelf = el('g', {}, svg);
    // 燒杯
    G.beaker = el('g', {}, svg);
    el('path', { d: 'M60 170 L64 174 L64 266 Q64 270 70 270 L146 270 Q152 270 152 266 L152 174 L156 170', class: 'glass' }, G.beaker);
    G.bLiquid = el('rect', { x: 66, y: 270, width: 84, height: 0, class: 'water' }, G.beaker);
    G.bAcid = el('rect', { x: 66, y: 270, width: 84, height: 0, fill: '#f6c84c', opacity: .8 }, G.beaker);
    G.bText = el('text', { x: 108, y: 162, 'text-anchor': 'middle', 'font-size': 11, fill: 'currentColor' }, G.beaker);
    // 容量瓶
    G.flask = el('g', {}, svg);
    el('path', { d: 'M262 60 L262 160 L222 220 Q210 270 250 270 L306 270 Q346 270 334 220 L294 160 L294 60', class: 'glass' }, G.flask);
    el('line', { x1: 256, x2: 300, y1: 110, y2: 110, stroke: '#e5484d', 'stroke-width': 2 }, G.flask);
    G.fLiquid = el('path', { d: '', fill: '#bfe3f5', opacity: .85 }, G.flask);
    G.fText = el('text', { x: 278, y: 52, 'text-anchor': 'middle', 'font-size': 11, fill: 'currentColor' }, G.flask);
    // 刻度線放大
    G.zoom = el('g', {}, svg);
    el('rect', { x: 312, y: 70, width: 74, height: 80, rx: 8, fill: '#fff', stroke: 'currentColor', 'stroke-width': 1.5 }, G.zoom);
    el('line', { x1: 318, x2: 380, y1: 110, y2: 110, stroke: '#e5484d', 'stroke-width': 2 }, G.zoom);
    G.menis = el('path', { d: '', fill: 'none', stroke: '#2f6fb3', 'stroke-width': 2.5 }, G.zoom);
    el('text', { x: 349, y: 144, 'text-anchor': 'middle', 'font-size': 9, fill: 'currentColor' }, G.zoom).textContent = '刻度線（平視）';
    G.ppe = el('text', { x: 14, y: 22, 'font-size': 12, 'font-weight': 700, fill: '#1f6b63' }, svg);
    host.appendChild(svg);
  }

  function render() {
    var s = st;
    G.beaker.style.display = s.have.beaker ? '' : 'none';
    G.flask.style.display = s.have.flask ? '' : 'none';
    G.zoom.style.display = s.inFlask ? '' : 'none';
    var total = s.beakerW + s.beakerA, px = 0.42;
    var hW = s.beakerW * px, hA = s.beakerA * px;
    G.bLiquid.setAttribute('y', 270 - hW - hA); G.bLiquid.setAttribute('height', hW + hA);
    G.bAcid.setAttribute('y', 270 - hW - hA); G.bAcid.setAttribute('height', s.acidFirst && s.beakerW === 0 ? hA : 0);
    G.bText.textContent = total ? '燒杯裡約 ' + Math.round(total) + ' mL' : '';
    var vol = s.inFlask ? (s.toMark ? 100 + s.offset : 60) : 0;
    var y = vol >= 99 ? 110 - (vol - 100) * 6 : 270 - vol * 1.0;
    G.fLiquid.setAttribute('d', vol ? 'M' + (vol >= 99 ? 263 : 230) + ' ' + y + (vol >= 99 ? ' L293 ' + y + ' L293 160 L333 222 Q344 268 306 268 L250 268 Q212 268 223 222 L263 160 Z' : ' L326 ' + y + ' L333 222 Q344 268 306 268 L250 268 Q212 268 223 222 Z') : '');
    G.fText.textContent = s.inFlask ? (s.toMark ? '液面：' + (s.offset === 0 ? '剛好在刻度線' : (s.offset > 0 ? '超過刻度線' : '低於刻度線')) : '還沒加到刻度線') : '';
    var my = 110 - s.offset * 12;
    G.menis.setAttribute('d', s.toMark ? 'M320 ' + (my - 6) + ' Q349 ' + (my + 6) + ' 378 ' + (my - 6) : '');
    G.ppe.textContent = (s.goggles ? '已戴護目鏡　' : '') + (s.gloves ? '已戴手套' : '');
    // 拉桿數值
    shell.$('#out_w').textContent = s.wAdd + ' mL'; shell.$('#rng_w').value = s.wAdd;
    shell.$('#out_v').textContent = s.vSet.toFixed(1) + ' mL'; shell.$('#rng_v').value = s.vSet;
    shell.$('#out_o').textContent = (s.offset >= 0 ? '+' : '') + s.offset.toFixed(1) + ' mL（' + (Math.abs(s.offset) < 0.05 ? '對齊刻度線' : s.offset > 0 ? '太多' : '不夠') + '）';
    shell.$('#rng_o').value = s.offset; shell.$('#rng_o').disabled = !s.toMark;
    shell.$('#btnRinse').textContent = '倒進容量瓶時潤洗燒杯：' + (s.rinse ? '要' : '不要');
    shell.$('#datalog').innerHTML = s.steps.length ? '<table class="data"><thead><tr><th>#</th><th>你做了什麼</th></tr></thead><tbody>' + s.steps.map(function (t, i) { return '<tr><td>' + (i + 1) + '</td><td>' + t + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="ctl-note">你的每一步都會記在這裡。</p>';
  }

  function sfx(n, d) { if (window.LabSfx) window.LabSfx.play(n, d); }
  function onItem(id) {
    var s = st;
    switch (id) {
      case 'goggles': s.goggles = true; shell.used(id); shell.say('戴好護目鏡了。', 'ok'); break;
      case 'gloves': s.gloves = true; shell.used(id); shell.say('戴好耐酸手套了。', 'ok'); break;
      case 'water': s.have.water = true; s.waterSrc = 'pure'; shell.used('water'); shell.used('tap', false); shell.say('準備純水。', 'ok'); break;
      case 'tap': s.have.water = true; s.waterSrc = 'tap'; s.traps++; shell.used('tap'); shell.used('water', false); shell.say('準備了自來水。', 'warn'); break;
      case 'beaker': s.have.beaker = true; shell.used(id); shell.say('燒杯放好了。'); break;
      case 'flask': s.have.flask = true; shell.used(id); shell.say('容量瓶放好了。'); break;
      case 'pipette': s.tool = 'pipette'; shell.used('pipette'); shell.used('cylinder', false); shell.say('用刻度吸量管＋安全吸球量濃鹽酸（最小刻度 0.1 mL）。'); break;
      case 'cylinder': s.tool = 'cylinder'; shell.used('cylinder'); shell.used('pipette', false); shell.say('用量筒量濃鹽酸（最小刻度 1 mL）。', 'warn'); break;
      case 'hcl': s.have.hcl = true; shell.used(id); shell.say('拿到濃鹽酸試藥。瓶上標示：HCl 37.0%（質量百分率）、密度 1.19 g/mL、分子量 36.46 g/mol，還有「腐蝕」危害圖示。'); break;
      case 'naoh': s.base = true; s.traps++; shell.used(id); shell.say('拿了氫氧化鈉溶液。（題目要的是鹽酸喔。）', 'warn'); break;
      case 'lamp': s.traps++; shell.used(id); shell.say('這個實驗不需要加熱。', 'warn'); break;
    }
    render();
  }

  // ---------- 步驟
  function addWater() {
    var s = st;
    if (!s.have.beaker) return shell.say('先放燒杯。', 'warn');
    if (!s.have.water) return shell.say('先準備水。', 'warn');
    if (s.inFlask) return shell.say('溶液已經倒進容量瓶了，要加水請用「加水到刻度線」。', 'warn');
    if (s.beakerA > 0 && s.beakerW === 0) {
      return shell.fail('splash', '強酸飛濺！', '你把水倒進濃鹽酸裡。水碰到濃酸會劇烈放熱，把酸噴出來，可能噴到眼睛和皮膚。要「酸加入水」：先在燒杯放水，再把酸慢慢加進去。');
    }
    s.beakerW += s.wAdd; if (s.waterSrc === 'tap') s.impure = true; sfx('pour');
    log('燒杯加' + (s.waterSrc === 'tap' ? '自來水 ' : '純水 ') + s.wAdd + ' mL');
    shell.say('燒杯裡加了 ' + s.wAdd + ' mL 水。', 'ok'); render();
  }
  function addAcid() {
    var s = st;
    if (!s.have.beaker) return shell.say('先放燒杯。', 'warn');
    if (!s.have.hcl) return shell.say('先拿濃鹽酸。', 'warn');
    if (!s.tool) return shell.say('要用什麼量濃鹽酸？先挑量取工具。', 'warn');
    if (!s.goggles || !s.gloves) return shell.fail('danger', '先做好防護！', '濃鹽酸有腐蝕性，量取和倒入時可能噴濺。要先戴好護目鏡和耐酸手套。');
    if (s.inFlask) return shell.say('溶液已經倒進容量瓶了。', 'warn');
    var err = s.tool === 'cylinder' ? (Math.random() - 0.5) * 1.2 : (Math.random() - 0.5) * 0.04;   // 量筒誤差大（遊戲設定值）
    s.vReal += Math.max(0, s.vSet + err);
    if (s.beakerW === 0) s.acidFirst = true;
    s.beakerA += s.vSet; sfx('pour');
    log('用' + (s.tool === 'pipette' ? '吸量管' : '量筒') + '量 ' + s.vSet.toFixed(1) + ' mL 濃鹽酸，加進燒杯' + (s.beakerW === 0 ? '（燒杯裡還沒有水）' : '的水裡'));
    shell.say(s.beakerW === 0 ? '濃鹽酸倒進了空燒杯。' : '濃鹽酸慢慢加進水裡，酸入水，正確。', s.beakerW === 0 ? 'warn' : 'ok');
    render();
  }
  function stir() { if (!st.beakerA && !st.beakerW) return shell.say('燒杯是空的。'); st.stirred = true; sfx('stir'); log('用玻棒攪拌'); shell.say('攪拌均勻了。', 'ok'); render(); }
  function toFlask() {
    var s = st;
    if (!s.have.flask) return shell.say('先放容量瓶。', 'warn');
    if (!s.beakerA) return shell.say('燒杯裡還沒有鹽酸。', 'warn');
    if (s.inFlask) return;
    s.inFlask = true; sfx('pour');
    if (s.base) s.vReal *= 0.4;   // 拿了氫氧化鈉又加進來 → 被中和（遊戲設定值）
    log('倒進容量瓶' + (s.rinse ? '，並用純水潤洗燒杯 3 次一起倒入' : '（沒有潤洗燒杯）'));
    shell.say('溶液倒進容量瓶了。接著「加水到刻度線」。', 'ok'); render();
  }
  function toMark() {
    var s = st;
    if (!s.inFlask) return shell.say('先把溶液倒進容量瓶。', 'warn');
    if (!s.have.water) return shell.say('先準備水。', 'warn');
    if (s.waterSrc === 'tap') s.impure = true;
    s.toMark = true; s.offset = s.offset || 0.8; sfx('pour');
    log('加水到接近刻度線（用下面的拉桿把液面對準刻度線）');
    shell.say('看右邊放大的刻度線，用「液面位置」拉桿把凹液面最低點對準刻度線。', 'info'); render();
  }
  function shake() { if (!st.toMark) return shell.say('先加水到刻度線，再蓋瓶塞搖勻。', 'warn'); st.shaken = true; sfx('shake'); log('蓋上瓶塞，倒轉搖勻'); shell.say('搖勻了。可以測定濃度。', 'ok'); render(); }
  function measure() {
    var s = st;
    if (!s.toMark) return shell.say('還沒完成配製。', 'warn');
    sfx('action');
    var V = 100 + s.offset;
    var n = NPER * s.vReal * (s.rinse ? 1 : 0.96);   // HCl 的 mol 數；沒潤洗燒杯會少約 4%（遊戲設定值）
    var c = n / (V / 1000);                          // mol/L
    if (!s.shaken) c *= 1 + (Math.random() - 0.5) * 0.3;  // 沒搖勻，取樣的地方濃度不均
    c = Math.round(c * 100) / 100;
    log('測定濃度：' + c.toFixed(2) + ' mol/L');
    var ok = Math.abs(c - TARGET) <= TOL && !s.impure;
    var why = [];
    if (s.impure) why.push('用了自來水，含有雜質，不能當標準溶液');
    if (!s.shaken) why.push('沒有搖勻，濃度不均勻');
    if (!s.rinse) why.push('沒潤洗燒杯，少了一些鹽酸');
    if (s.tool === 'cylinder') why.push('量筒最小刻度 1 mL，量得不夠準');
    if (Math.abs(s.offset) >= 0.05) why.push('液面沒對準刻度線（差 ' + s.offset.toFixed(1) + ' mL）');
    if (s.base) why.push('加了氫氧化鈉，把鹽酸中和掉了');
    render();
    if (ok) {
      var stars = 1 + (s.tool === 'pipette' && s.rinse && s.shaken ? 1 : 0) + (s.traps === 0 ? 1 : 0);
      if (window.LabRecords) window.LabRecords.onPass('M-ACID', stars);
      shell.status('通過', 'done');
      shell.say('測定結果：' + c.toFixed(2) + ' mol/L，通過！', 'ok', false);
      shell.result(true, '通過！' + '★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars), '你配出的鹽酸是 ' + c.toFixed(2) + ' mol/L（目標 2.0 ± 0.1 mol/L）。',
        '① 濃鹽酸的濃度：1 L = 1000 mL 重 1.19 × 1000 = 1190 g，其中 HCl 佔 37.0%，是 440.3 g，440.3 ÷ 36.46 = 12.08 mol，所以是 12.08 mol/L。② 要配 0.100 L × 2.0 mol/L = 0.200 mol。③ 0.200 mol ÷ 12.08 mol/L = 0.01656 L，取 16.6 mL，加水到 100 mL。這次你的溶液含 HCl ' + n.toFixed(4) + ' mol，體積 ' + (V / 1000).toFixed(4) + ' L。稀釋濃酸一定要「酸加入水」，並且戴好護目鏡和手套。' + (why.length ? '可以更好：' + why.join('；') + '。' : ''));
    } else {
      shell.status('沒通過', 'hot');
      shell.say('測定結果：' + c.toFixed(2) + ' mol/L，還沒達到 2.0 ± 0.1 mol/L。可以按「重來」再配一次。', 'warn', false);
      shell.result(false, '沒通過：' + c.toFixed(2) + ' mol/L', '你的溶液含 HCl ' + n.toFixed(4) + ' mol，體積 ' + (V / 1000).toFixed(4) + ' L，濃度 = ' + n.toFixed(4) + ' ÷ ' + (V / 1000).toFixed(4) + ' = ' + c.toFixed(2) + ' mol/L。目標是 2.0 ± 0.1 mol/L。' + (why.length ? '可能的原因：' + why.join('；') + '。' : '想想看：先用瓶上的 37%、密度 1.19 g/mL 算出濃鹽酸每 mL 含幾 mol HCl。'), '');
    }
  }

  function controls() {
    shell.$('#controls').innerHTML =
      '<div class="slider"><div class="slider-top"><span class="slider-label">每次加多少純水到燒杯</span><output id="out_w"></output></div>' +
      '<div class="slider-row"><button class="step" type="button" data-s="w" data-k="-1" aria-label="減少">－</button><input type="range" id="rng_w" min="5" max="80" step="5" aria-label="加水量"><button class="step" type="button" data-s="w" data-k="1" aria-label="增加">＋</button></div></div>' +
      '<div class="slider"><div class="slider-top"><span class="slider-label">量取濃鹽酸的體積</span><output id="out_v"></output></div>' +
      '<div class="slider-row"><button class="step" type="button" data-s="v" data-k="-1" aria-label="減少">－</button><input type="range" id="rng_v" min="0" max="25" step="0.1" aria-label="濃鹽酸體積"><button class="step" type="button" data-s="v" data-k="1" aria-label="增加">＋</button></div></div>' +
      '<div class="slider"><div class="slider-top"><span class="slider-label">液面位置（對準刻度線）</span><output id="out_o"></output></div>' +
      '<div class="slider-row"><button class="step" type="button" data-s="o" data-k="-1" aria-label="減少">－</button><input type="range" id="rng_o" min="-3" max="3" step="0.1" aria-label="液面位置"><button class="step" type="button" data-s="o" data-k="1" aria-label="增加">＋</button></div></div>' +
      '<div class="row btns"><button class="btn" type="button" id="btnRinse"></button></div>';
    var c = shell.$('#controls');
    shell.$('#rng_w').addEventListener('input', function (e) { st.wAdd = +e.target.value; render(); });
    shell.$('#rng_v').addEventListener('input', function (e) { st.vSet = Math.round(+e.target.value * 10) / 10; render(); });
    shell.$('#rng_o').addEventListener('input', function (e) { st.offset = Math.round(+e.target.value * 10) / 10; render(); });
    shell.$('#btnRinse').addEventListener('click', function () { st.rinse = !st.rinse; render(); });
    c.addEventListener('click', function (e) {
      var b = e.target.closest('.step'); if (!b) return;
      var k = +b.getAttribute('data-k'), s = b.getAttribute('data-s');
      if (s === 'w') st.wAdd = Math.max(5, Math.min(80, st.wAdd + 5 * k));
      if (s === 'v') st.vSet = Math.max(0, Math.min(25, Math.round((st.vSet + 0.1 * k) * 10) / 10));
      if (s === 'o' && st.toMark) st.offset = Math.max(-3, Math.min(3, Math.round((st.offset + 0.1 * k) * 10) / 10));
      render();
    });
    var a = shell.$('#actions');
    a.style.flexWrap = 'wrap';
    var A = [['燒杯加純水', addWater], ['燒杯加濃鹽酸', addAcid], ['攪拌', stir], ['倒進容量瓶', toFlask], ['加水到刻度線', toMark], ['蓋上搖勻', shake], ['測定濃度', measure]];
    a.innerHTML = A.map(function (x, i) { return '<button class="btn' + (i === A.length - 1 ? ' primary' : '') + '" type="button" data-a="' + i + '" style="flex:1 1 40%">' + x[0] + '</button>'; }).join('');
    a.addEventListener('click', function (e) { var b = e.target.closest('[data-a]'); if (b) A[+b.getAttribute('data-a')][1](); });
  }

  function reset() { st = fresh(); shell.status('準備中'); shell.say('先想好要用哪些器材、量多少、照什麼順序。'); render(); }

  window.addEventListener('DOMContentLoaded', function () {
    st = fresh();
    shell = new window.MissionShell(document.getElementById('app'), {
      stage: '高中基礎化學・溶液的濃度', title: '配出 2.0 mol/L 鹽酸', diff: 'E4',
      mission: '老師要 100 mL、2.0 mol/L 的稀鹽酸（誤差 ±0.1 mol/L）。架上只有濃鹽酸試藥：HCl 37.0%（質量百分率）、密度 1.19 g/mL、分子量 36.46 g/mol。先算好要取幾 mL，再配出來。',
      missionNote: '自己決定要用哪些器材和藥品、濃鹽酸取多少 mL、步驟的順序。最後按「測定濃度」，遊戲會用你的數據算出你配的是幾 M。',
      intro: '先想好要用哪些器材、量多少、照什麼順序。',
      items: ITEMS, icon: icon, onItem: onItem, onReset: reset
    });
    buildScene(shell.$('#scene'));
    controls();
    render();
    if (window.LabRecords) window.LabRecords.markPlay();
    window.__acid = { st: function () { return st; } };
  });
})();
