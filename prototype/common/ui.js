/* 實驗闖關 原型：畫面與操作（三個版本共用，外觀由各版 CSS 決定）
 * 安全說明：本檔用 innerHTML 組的內容全部來自程式內寫死的字串（關卡資料、道具名稱、圖示）與數字，
 * 沒有任何玩家輸入或外部資料，所以沒有 XSS 風險；顯示提示訊息一律用 textContent。 */
(function () {
  'use strict';

  function $(sel, el) { return (el || document).querySelector(sel); }
  function fmtTime(t) {
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  var CAT_NAME = { '火': '火', '電': '電', '毒': '毒', '傷': '傷' };

  function buildDom(root, info, opts) {
    var items = window.LabCore.ITEMS.map(function (it) {
      return '<button class="item" type="button" data-item="' + it.id + '" aria-label="' + it.name + '：' + it.tip + '">' +
        '<span class="item-ico">' + window.LabIcons(it.id, 40) + '</span><span class="item-name">' + it.name + '</span></button>';
    }).join('');
    var teacher = opts.teacherInHeader ?
      '<p class="goal-mini"><b>任務</b>' + info.goal + '</p>' +
      '<div class="guide"><span class="guide-face" aria-hidden="true">' + teacherFace(44) + '</span><p class="guide-text" id="guideText">先把需要的道具拖到實驗桌上，或點一下道具。有些道具是陷阱喔！</p></div>' :
      '<p class="goal"><b>任務</b>' + info.goal + '</p>';
    root.innerHTML =
      '<header class="top">' +
        '<a class="back" href="map.html" aria-label="回到關卡地圖">‹</a>' +
        '<div class="titles"><span class="stage">' + info.stage + '・' + info.no + '</span><h1>' + info.title + '</h1></div>' +
        '<div class="stars-hud" aria-label="星等"><i>★</i><i>★</i><i>★</i></div>' +
        '<button class="hint-btn" type="button" id="btnHint">提示</button>' +
      '</header>' +
      teacher +
      '<main class="layout">' +
        '<section class="card scene-card">' +
          '<div class="scene-head"><span class="badge" id="status">準備中</span><span class="clock" id="clock">t = 0:00</span></div>' +
          '<div class="scene" id="scene" aria-label="實驗桌，可以把道具拖到這裡"></div>' +
          '<p class="log" id="log" role="status">把需要的道具拖到實驗桌上，或點一下道具。</p>' +
          '<div class="row btns">' +
            '<button class="btn primary" type="button" id="btnPause">暫停</button>' +
            '<button class="btn" type="button" id="btnZoom" data-ctl="zoom">近看溫度計</button>' +
          '</div>' +
        '</section>' +
        '<div class="side">' +
          '<section class="card tray-card"><h2>道具</h2><p class="sub">有些道具用不到，挑對的用。</p><div class="tray" id="tray">' + items + '</div></section>' +
          '<section class="card ctl-card"><h2>調整與紀錄</h2>' +
            slider('depth', '溫度計高度', '距杯底', 0, window.LabCore.DEPTH_MAX, 0.5, 'cm', ['杯底', '高']) +
            slider('wall', '離杯壁距離', '', 0, window.LabCore.WALL_MAX, 0.5, 'cm', ['貼杯壁', '水中間']) +
            slider('reading', '我讀到的溫度', '', 0, 110, 1, '°C') +
            '<div class="row btns"><button class="btn primary" type="button" id="btnRecord">記錄讀數</button>' +
            '<button class="btn ghost" type="button" id="btnReset">重新開始</button></div>' +
          '</section>' +
        '</div>' +
      '</main>' +
      '<div class="overlay" id="ovIntro"><div class="sheet">' +
        '<h2>歡迎來到模擬實驗室</h2>' +
        '<p>這是電腦裡的「模擬實驗室」。遊戲裡的實驗，真的要做時，一定要在學校實驗室、有老師在旁邊才可以做。</p>' +
        '<p>不要在家裡自己做火、電、化學藥品的實驗。真的受傷或不舒服，馬上告訴大人；很危險時打 119。</p>' +
        '<button class="btn primary wide" type="button" data-close>我知道了</button></div></div>' +
      '<div class="overlay" id="ovStop"><div class="sheet stop">' +
        '<div class="stop-head"><span class="teacher">' + teacherFace(64) + '</span><div><b class="stop-title">老師喊停！</b><span class="cat" id="stopCat">火</span></div></div>' +
        '<p id="stopText"></p>' +
        '<button class="btn primary wide" type="button" id="btnStopOk">我知道了，回到上一步</button></div></div>' +
      '<div class="overlay" id="ovZoom"><div class="sheet zoom">' +
        '<h2>近看溫度計</h2><p class="sub">視線和液柱頂端一樣高再讀。每一小格是 1 °C。</p>' +
        '<div class="zoom-wrap" id="zoomWrap"></div>' +
        slider('reading2', '我讀到的溫度', '', 0, 110, 1, '°C') +
        '<button class="btn primary wide" type="button" data-close>好了</button></div></div>' +
      '<div class="overlay" id="ovPass"><div class="sheet pass">' +
        '<h2>過關！</h2><div class="big-stars" id="passStars"></div>' +
        '<ul class="reasons" id="passReasons"></ul>' +
        '<div class="kcard"><b>實驗手冊卡</b><p>' + info.card + '</p><small>' + info.refs + '</small></div>' +
        '<div class="row btns"><button class="btn" type="button" id="btnAgain">再玩一次</button>' +
        '<button class="btn primary" type="button" id="btnNext">下一關</button></div></div></div>' +
      '<div class="ghost-item" id="ghost" aria-hidden="true"></div>';
  }

  function slider(id, label, prefix, min, max, step, unit, ends) {
    return '<div class="slider" data-ctl="' + id + '">' +
      '<div class="slider-top"><span class="slider-label">' + label + '</span><output id="out_' + id + '">' + (prefix ? prefix + ' ' : '') + '0 ' + unit + '</output></div>' +
      '<div class="slider-row"><button class="step" type="button" data-step="-1" data-for="' + id + '" aria-label="' + label + '減少">－</button>' +
      '<input type="range" id="rng_' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="0" aria-label="' + label + '">' +
      '<button class="step" type="button" data-step="1" data-for="' + id + '" aria-label="' + label + '增加">＋</button></div>' +
      (ends ? '<div class="slider-ends"><span>' + ends[0] + '</span><span>' + ends[1] + '</span></div>' : '') +
      '</div>';
  }

  function teacherFace(size) {
    return '<svg viewBox="0 0 64 64" width="' + size + '" height="' + size + '">' +
      '<circle cx="32" cy="32" r="30" fill="#f4d9b8"/>' +
      '<path d="M6 26c2-14 14-22 26-22s24 8 26 22c-6-6-14-9-26-9S12 20 6 26z" fill="#4a3b33"/>' +
      '<rect x="15" y="27" width="14" height="10" rx="4" fill="none" stroke="#2b2b2b" stroke-width="2.4"/>' +
      '<rect x="35" y="27" width="14" height="10" rx="4" fill="none" stroke="#2b2b2b" stroke-width="2.4"/>' +
      '<path d="M29 31h6" stroke="#2b2b2b" stroke-width="2.4"/>' +
      '<circle cx="22" cy="32" r="2.2" fill="#2b2b2b"/><circle cx="42" cy="32" r="2.2" fill="#2b2b2b"/>' +
      '<path d="M24 47c4 3 12 3 16 0" stroke="#8a4b3a" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>';
  }

  function zoomSvg(shown) {
    var lo = Math.max(0, Math.floor(shown / 10) * 10 - 10), hi = Math.min(110, lo + 30);
    if (hi - lo < 30) lo = hi - 30;
    var H = 300, top = 20, bottom = H - 20, px = (bottom - top) / (hi - lo);
    var y = function (v) { return bottom - (v - lo) * px; };
    var ticks = '';
    for (var v = lo; v <= hi; v++) {
      var major = v % 10 === 0, mid = v % 5 === 0;
      var len = major ? 34 : mid ? 24 : 14;
      ticks += '<line x1="112" x2="' + (112 + len) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="currentColor" stroke-width="' + (major ? 2.4 : 1.4) + '"/>';
      if (major) ticks += '<text x="' + (112 + len + 8) + '" y="' + (y(v) + 6) + '" font-size="18" fill="currentColor">' + v + '</text>';
    }
    var colTop = Math.max(top - 10, Math.min(bottom + 10, y(shown)));
    return '<svg viewBox="0 0 220 ' + H + '" class="zoom-svg" role="img" aria-label="溫度計放大的刻度">' +
      '<rect x="78" y="0" width="30" height="' + H + '" rx="14" fill="#fff" fill-opacity=".85" stroke="currentColor" stroke-width="1.5"/>' +
      '<rect x="88" y="' + colTop + '" width="10" height="' + (H - colTop) + '" fill="#d64545"/>' +
      ticks + '<text x="0" y="18" font-size="16" fill="currentColor">單位 °C</text></svg>';
  }

  function App(root, renderer, opts) {
    opts = opts || {};
    var info = window.LabCore.LEVEL_INFO;
    buildDom(root, info, opts);
    var level = new window.LabCore.Level();
    var self = this;
    this.level = level;
    var sceneEl = $('#scene', root);
    renderer.mount(sceneEl, level);

    var statusEl = $('#status', root), clockEl = $('#clock', root), logEl = $('#log', root);
    var guideEl = $('#guideText', root);
    var lastStars = 1;
    var rngDepth = $('#rng_depth', root), rngRead = $('#rng_reading', root), rngRead2 = $('#rng_reading2', root);
    var outDepth = $('#out_depth', root), outRead = $('#out_reading', root), outRead2 = $('#out_reading2', root);
    var rngWall = $('#rng_wall', root), outWall = $('#out_wall', root);

    function say(text, kind) {
      logEl.textContent = text;
      logEl.className = 'log ' + (kind || 'info');
      if (guideEl) guideEl.textContent = text;
    }
    function open(id) { $(id, root).classList.add('show'); }
    function close(el) { el.classList.remove('show'); }

    function refresh(s) {
      // 道具狀態
      var tiles = root.querySelectorAll('.item');
      for (var i = 0; i < tiles.length; i++) {
        var st = level.itemState(tiles[i].getAttribute('data-item'));
        tiles[i].classList.toggle('used', st === 'used');
      }
      var z = level.zone();
      var dz = window.LabCore.zoneOf(s.depth);
      outDepth.textContent = '距杯底 ' + s.depth.toFixed(1) + ' cm' + (s.thermo ? (dz === 'bottom' ? '（碰到杯底）' : dz === 'air' ? '（在水面上）' : '（在水中）') : '');
      outDepth.className = s.thermo && dz !== 'water' ? 'warn' : '';
      rngDepth.value = s.depth; rngDepth.disabled = !s.thermo;
      outWall.textContent = s.wall.toFixed(1) + ' cm' + (s.thermo ? (s.wall < 0.5 ? '（貼著杯壁）' : '（沒碰到）') : '');
      outWall.className = s.thermo && s.wall < 0.5 ? 'warn' : '';
      rngWall.value = s.wall; rngWall.disabled = !s.thermo;
      outRead.textContent = s.reading + ' °C'; outRead2.textContent = s.reading + ' °C';
      rngRead.value = s.reading; rngRead2.value = s.reading;
      var st = s.passed ? '過關' : s.paused && s.lit ? '已暫停' : s.boiling && s.lit ? '沸騰中' : s.lit ? '加熱中' : s.recorded ? '已記錄' : '準備中';
      statusEl.textContent = st;
      statusEl.className = 'badge ' + (s.boiling && s.lit ? 'boil' : s.lit ? 'hot' : s.passed ? 'done' : '');
      clockEl.textContent = 't = ' + fmtTime(s.t);
      $('#btnPause', root).textContent = s.paused && s.lit ? '繼續' : '暫停';
      $('#btnPause', root).disabled = !s.lit;
      var hud = root.querySelectorAll('.stars-hud i');
      hud[0].className = s.passed ? 'on' : '';
      hud[1].className = s.stops === 0 ? 'on' : 'off';
      hud[2].className = s.decoys === 0 && !s.hintUsedL2 ? 'on' : 'off';
      if ($('#ovZoom', root).classList.contains('show')) $('#zoomWrap', root).innerHTML = zoomSvg(s.shown);
    }

    level.on(function (s, ev) {
      if (ev.type === 'note') say(ev.text, ev.kind);
      if (ev.type === 'boil') say('水大量冒泡，沸騰了！讀一讀溫度計。', 'ok');
      if (ev.type === 'stop') {
        if (window.LabRecords) window.LabRecords.onStop(ev.cat, ev.text);
        $('#stopCat', root).textContent = '這一條在防：' + (CAT_NAME[ev.cat] || ev.cat);
        $('#stopText', root).textContent = ev.text;
        open('#ovStop');
        say('老師喊停：' + ev.text, 'stop');
      }
      if (ev.type === 'hint') {
        say((ev.level === 2 ? '提示：' : '想一想：') + ev.text, 'hint');
        if (ev.target) {
          var sel = ev.target.indexOf('item:') === 0 ? '[data-item="' + ev.target.slice(5) + '"]' : '[data-ctl="' + ev.target.slice(4) + '"]';
          var el = $(sel, root);
          if (el) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); setTimeout(function () { el.classList.remove('pulse'); }, 3200); }
        }
      }
      if (ev.type === 'pass') {
        var labels = ['達成目標', '全程沒有被老師喊停', '沒有用到多餘或錯誤的道具，也沒有用「指出來」的提示'];
        lastStars = ev.stars.filter(Boolean).length;
        if (window.LabRecords) window.LabRecords.onPass('J8-' + info.mapNo, lastStars);
        $('#passStars', root).innerHTML = ev.stars.map(function (on) { return '<i class="' + (on ? 'on' : 'off') + '">★</i>'; }).join('');
        $('#passReasons', root).innerHTML = ev.stars.map(function (on, i) { return '<li class="' + (on ? 'ok' : 'no') + '">' + (on ? '✓ ' : '✗ ') + labels[i] + '</li>'; }).join('');
        setTimeout(function () { open('#ovPass'); }, 500);
      }
      if (ev.type === 'reset') say('把需要的道具拖到實驗桌上，或點一下道具。', 'info');
      refresh(s);
      renderer.render(s, level, ev);
    });

    // 道具：點一下或拖到實驗桌
    var ghost = $('#ghost', root), drag = null;
    root.addEventListener('pointerdown', function (e) {
      var tile = e.target.closest && e.target.closest('.item');
      if (!tile || tile.classList.contains('used')) return;
      drag = { id: tile.getAttribute('data-item'), x: e.clientX, y: e.clientY, moving: false, tile: tile };
      tile.setPointerCapture && tile.setPointerCapture(e.pointerId);
    });
    root.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moving && dx * dx + dy * dy > 64) {
        drag.moving = true;
        ghost.innerHTML = window.LabIcons(drag.id, 56);
        ghost.classList.add('show');
        sceneEl.classList.add('drop-ready');
      }
      if (drag.moving) {
        ghost.style.transform = 'translate(' + (e.clientX - 28) + 'px,' + (e.clientY - 28) + 'px)';
        var r = sceneEl.getBoundingClientRect();
        sceneEl.classList.toggle('drop-over', e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
      }
    });
    function endDrag(e, cancel) {
      if (!drag) return;
      var d = drag; drag = null;
      ghost.classList.remove('show');
      sceneEl.classList.remove('drop-ready'); sceneEl.classList.remove('drop-over');
      if (cancel) return;
      if (!d.moving) { level.useItem(d.id); return; }
      var r = sceneEl.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) level.useItem(d.id);
      else say('道具要放到實驗桌上才有作用。');
    }
    root.addEventListener('pointerup', function (e) { endDrag(e, false); });
    root.addEventListener('pointercancel', function (e) { endDrag(e, true); });

    // 拉桿與＋／－
    rngDepth.addEventListener('input', function () { level.setDepth(parseFloat(rngDepth.value)); });
    rngWall.addEventListener('input', function () { level.setWall(parseFloat(rngWall.value)); });
    rngRead.addEventListener('input', function () { level.setReading(parseFloat(rngRead.value)); });
    rngRead2.addEventListener('input', function () { level.setReading(parseFloat(rngRead2.value)); });
    root.addEventListener('click', function (e) {
      // 用鍵盤（Enter／空白鍵）按道具時沒有 pointer 事件，這裡補上
      var it = e.detail === 0 && e.target.closest && e.target.closest('.item');
      if (it && !it.classList.contains('used')) level.useItem(it.getAttribute('data-item'));
      var b = e.target.closest && e.target.closest('.step');
      if (b) {
        var f = b.getAttribute('data-for'), k = parseInt(b.getAttribute('data-step'), 10);
        if (f === 'depth') { if (level.s.thermo) level.setDepth(level.s.depth + 0.5 * k); }
        else if (f === 'wall') { if (level.s.thermo) level.setWall(level.s.wall + 0.5 * k); }
        else level.setReading(level.s.reading + k);
      }
      if (e.target.hasAttribute && e.target.hasAttribute('data-close')) {
        var ov = e.target.closest('.overlay');
        close(ov);
        if (ov && ov.id === 'ovIntro') {            // 按「我知道了」＝開始玩這一關：記遊玩次數、送一次計數（每台裝置只送一次）
          if (window.LabRecords) window.LabRecords.markPlay();
          if (window.LabCounter) window.LabCounter.reportOnce();
        }
      }
    });
    $('#btnPause', root).addEventListener('click', function () { level.togglePause(); });
    $('#btnZoom', root).addEventListener('click', function () {
      if (!level.s.thermo) { say('還沒有放溫度計。'); return; }
      $('#zoomWrap', root).innerHTML = zoomSvg(level.s.shown);
      open('#ovZoom');
    });
    $('#btnRecord', root).addEventListener('click', function () { level.record(); });
    $('#btnReset', root).addEventListener('click', function () { level.reset(); });
    $('#btnHint', root).addEventListener('click', function () { level.hint(); });
    $('#btnStopOk', root).addEventListener('click', function () { close($('#ovStop', root)); if (level.s.lit) level.resume(); });
    $('#btnAgain', root).addEventListener('click', function () { close($('#ovPass', root)); level.reset(); });
    $('#btnNext', root).addEventListener('click', function () {
      location.href = 'map.html?done=' + info.mapNo + '&stars=' + lastStars;   // 回地圖，這一關標成已過
    });

    open('#ovIntro');
    if (/[?&]nointro/.test(location.search)) close($('#ovIntro', root));

    var last = performance.now();
    function loop(now) {
      var dt = Math.min(0.1, (now - last) / 1000); last = now;
      level.tick(dt);
      if (renderer.frame) renderer.frame(dt, level.s);
      requestAnimationFrame(loop);
    }
    refresh(level.s);
    renderer.render(level.s, level, { type: 'init' });
    requestAnimationFrame(loop);

    // 測試與截圖用：網址加 ?demo=boil 直接跳到沸騰中的畫面
    var m = /[?&]demo=(\w+)/.exec(location.search);
    if (m) {
      window.LAB_NO_RECORD = true;                   // 截圖示範模式不寫玩家紀錄
      close($('#ovIntro', root));
      level.useItem('beaker'); level.useItem('thermo'); level.setDepth(2.5); level.setWall(3);
      level.useItem('goggles'); level.useItem('lamp'); level.useItem('igniter');
      if (m[1] === 'boil') { for (var i = 0; i < 1200; i++) level.tick(0.05); }
      if (m[1] === 'stop') { level.reset(); level.useItem('beaker'); level.useItem('lamp'); level.useItem('igniter'); }
    }
    window.__lab = level;
  }

  window.LabUI = { App: App };
})();
