/* 任務關共用外框（老闆 10/19：給目標讓玩家完成，像密室逃脫的解謎關）
 * 一關＝任務卡（要達成什麼）＋道具盤（有陷阱）＋實驗桌＋玩家自己設定的數值＋「執行」→ 遊戲用玩家的數據算出結果、判定過關。
 * 危險操作直接失敗（例如「強酸飛濺」），按「重來」從頭開始。
 * 安全說明：innerHTML 只放程式內寫死的字串與數字，沒有玩家輸入。 */
(function () {
  'use strict';
  function $(s, el) { return (el || document).querySelector(s); }

  // 危險失敗的圖示（老闆 10/19：要更誇張）：紅黃爆炸鋸齒底、液滴往外噴、整個畫面閃紅震動；仍然不畫人受傷
  var BURST = '<g class="burst"><path d="M100 11 L115 43 L146 17 L141 58 L179 49 L160 81 L189 93 L166 112 L183 136 L154 141 L159 171 L129 159 L123 194 L100 173 L78 192 L71 160 L35 177 L42 144 L9 138 L36 112 L5 92 L43 82 L16 46 L58 56 L58 24 L85 44Z" fill="#e5484d" stroke="#1d2a36" stroke-width="5" stroke-linejoin="round"/>' +
    '<path d="M117 36 L125 58 L145 53 L142 75 L169 78 L149 98 L172 113 L143 121 L155 142 L132 140 L134 170 L112 152 L100 174 L88 153 L67 167 L68 140 L38 147 L52 122 L31 112 L50 98 L32 78 L56 74 L51 48 L78 61 L82 29 L100 57Z" fill="#ffd23f"/></g>';
  var DROP = 'd="M0 -10 C4 -4 7 0 7 4 A7 7 0 0 1 -7 4 C-7 0 -4 -4 0 -10Z"';
  function drops(list) {
    return '<g fill="#f6a03a" stroke="#1d2a36" stroke-width="2.5">' + list.map(function (d) {
      return '<g class="drop" style="--dx:' + (d[0] - 100) + 'px;--dy:' + (d[1] - 96) + 'px"><path transform="translate(' + d[0] + ' ' + d[1] + ') rotate(' + d[2] + ') scale(' + d[3] + ')" ' + DROP + '/></g>';
    }).join('') + '</g>';
  }
  var BANG = '<path d="M86 40 h28 l-5 74 h-18 z" fill="#1d2a36"/><circle cx="100" cy="136" r="13" fill="#1d2a36"/>';
  var FAIL_ICON = {
    // 強酸飛濺：爆炸鋸齒底上，燒杯歪一邊、酸液像皇冠一樣往上噴，液滴四散
    splash: '<svg class="dz" viewBox="0 0 200 200" width="200" height="200" aria-hidden="true">' + BURST +
      '<g transform="rotate(-8 100 150)"><g class="spray"><path d="M82 106 C74 92 62 84 48 80 C62 76 74 80 82 86 C76 70 68 58 58 48 C74 52 86 64 90 80 C90 62 94 46 100 30 C106 46 110 62 110 80 C114 64 126 52 142 48 C132 58 124 70 118 86 C126 80 138 76 152 80 C138 84 126 92 118 106 Z" fill="#f6a03a" stroke="#1d2a36" stroke-width="4" stroke-linejoin="round"/></g>' +
      '<path d="M76 104 h48 l-4 52 h-40 z" fill="#fff" stroke="#1d2a36" stroke-width="5" stroke-linejoin="round"/><path d="M79 124 h42 l-2.4 30 h-37.2 z" fill="#f6a03a"/>' +
      '<path d="M71 104 h58" stroke="#1d2a36" stroke-width="6" stroke-linecap="round"/><circle cx="92" cy="140" r="3" fill="#fff"/><circle cx="106" cy="134" r="2.4" fill="#fff"/><circle cx="100" cy="146" r="2" fill="#fff"/></g>' +
      drops([[34, 50, 125, 1.1], [22, 98, 89, 1], [168, 52, -123, 1.15], [180, 100, -87, 1], [58, 18, 152, .9], [146, 20, -149, 1], [30, 150, 52, .85], [174, 150, -54, .9], [100, 12, 180, .8], [78, 36, 160, .7], [124, 36, -158, .7]]) + '</svg>',
    // 落地區有人：爆炸鋸齒底＋大驚嘆號＋高速飛來的鋼珠
    ball: '<svg class="dz" viewBox="0 0 200 200" width="200" height="200" aria-hidden="true">' + BURST +
      '<g transform="translate(-34 -2)">' + BANG + '</g>' +
      '<g class="spray"><path d="M110 122 h18 M104 138 h24 M112 154 h16" stroke="#1d2a36" stroke-width="6" stroke-linecap="round"/>' +
      '<circle cx="154" cy="138" r="22" fill="#b8c2cc" stroke="#1d2a36" stroke-width="5"/><circle cx="147" cy="130" r="7" fill="#fff"/></g></svg>',
    // 其他危險（沒戴防護就碰濃酸等）：爆炸鋸齒底＋大驚嘆號
    danger: '<svg class="dz" viewBox="0 0 200 200" width="200" height="200" aria-hidden="true">' + BURST + BANG + '</svg>',
    miss: '<svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true"><circle cx="60" cy="60" r="50" fill="#fff" stroke="#1d2a36" stroke-width="6"/><circle cx="60" cy="60" r="30" fill="none" stroke="#e5484d" stroke-width="6"/><circle cx="60" cy="60" r="10" fill="#e5484d"/><circle cx="96" cy="30" r="9" fill="#1d2a36"/></svg>',
    ok: '<svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true"><circle cx="60" cy="60" r="52" fill="#2c8a5a"/><path d="M34 62 l18 18 l34 -38" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  FAIL_ICON.warn = FAIL_ICON.danger;

  function Shell(root, cfg) {
    this.root = root; this.cfg = cfg;
    var items = cfg.items.map(function (it) {
      return '<button class="item" type="button" data-item="' + it.id + '" aria-label="' + it.name + '：' + it.tip + '">' +
        '<span class="item-ico">' + (cfg.icon ? cfg.icon(it.id) : '') + '</span><span class="item-name">' + it.name + '</span></button>';
    }).join('');
    root.innerHTML =
      '<header class="top"><a class="back" href="../index.html" aria-label="回原型首頁">‹</a>' +
      '<div class="titles"><span class="stage">' + cfg.stage + '</span><h1>' + cfg.title + '</h1></div>' +
      '<span class="diff" title="難度">' + cfg.diff + '</span></header>' +
      '<section class="mission"><b>任務</b><p>' + cfg.mission + '</p><small>' + cfg.missionNote + '</small></section>' +
      '<main class="layout">' +
        '<section class="card scene-card"><div class="scene-head"><span class="badge" id="status">準備中</span><span class="clock" id="tries">試做 0 次</span></div>' +
        '<div class="scene" id="scene"></div><p class="log" id="log" role="status">' + cfg.intro + '</p>' +
        '<div class="row btns" id="actions"></div></section>' +
        '<div class="side"><section class="card tray-card"><h2>器材與藥品</h2><p class="sub">自己挑需要的，有些是陷阱。</p><div class="tray" id="tray">' + items + '</div></section>' +
        '<section class="card ctl-card"><h2>設定與紀錄</h2><div id="controls"></div><div id="datalog"></div>' +
        '<div class="row btns"><button class="btn ghost" type="button" id="btnReset">重來</button></div></section></div>' +
      '</main>' +
      '<div class="overlay" id="ovFail"><div class="sheet fail"><div class="fail-ico" id="failIco"></div><h2 id="failTitle"></h2><p id="failText"></p>' +
        '<button class="btn primary wide" type="button" id="btnRetry">重來</button></div></div>' +
      '<div class="overlay" id="ovResult"><div class="sheet"><div class="fail-ico" id="resIco"></div><h2 id="resTitle"></h2><p id="resText"></p><div class="kcard" id="resCard"></div>' +
        '<div class="row btns"><button class="btn" type="button" id="btnAgain">再挑戰一次</button><button class="btn primary" type="button" id="btnClose">繼續調整</button><a class="btn primary" id="btnNext" href="../index.html">回任務列表</a></div></div></div>';
    var self = this;
    this.statusEl = $('#status', root); this.logEl = $('#log', root); this.triesEl = $('#tries', root);
    $('#btnReset', root).addEventListener('click', function () { self.reset(); });
    $('#btnRetry', root).addEventListener('click', function () { $('#ovFail', root).classList.remove('show'); self.reset(); });
    $('#btnAgain', root).addEventListener('click', function () { $('#ovResult', root).classList.remove('show'); self.reset(); });
    $('#btnClose', root).addEventListener('click', function () { $('#ovResult', root).classList.remove('show'); });
    // 道具：點一下或拖到實驗桌
    var drag = null, ghost = document.createElement('div');
    ghost.className = 'ghost-item'; document.body.appendChild(ghost);
    var scene = $('#scene', root);
    root.addEventListener('pointerdown', function (e) {
      var t = e.target.closest && e.target.closest('.item');
      if (!t || t.classList.contains('used')) return;
      drag = { id: t.getAttribute('data-item'), x: e.clientX, y: e.clientY, moving: false };
      try { if (t.setPointerCapture) t.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件沒有指標可抓，忽略 */ }
    });
    root.addEventListener('pointermove', function (e) {
      if (!drag) return;
      if (!drag.moving && Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 10) {
        drag.moving = true; ghost.innerHTML = cfg.icon ? cfg.icon(drag.id, 56) : ''; ghost.classList.add('show'); scene.classList.add('drop-ready');
      }
      if (drag.moving) ghost.style.transform = 'translate(' + (e.clientX - 28) + 'px,' + (e.clientY - 28) + 'px)';
    });
    function end(e, cancel) {
      if (!drag) return;
      var d = drag; drag = null; ghost.classList.remove('show'); scene.classList.remove('drop-ready');
      if (cancel) return;
      var r = scene.getBoundingClientRect();
      if (!d.moving || (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)) self.cfg.onItem(d.id);
      else self.say('器材要放到實驗桌上。');
    }
    root.addEventListener('pointerup', function (e) { end(e, false); });
    root.addEventListener('pointercancel', function (e) { end(e, true); });
    root.addEventListener('click', function (e) {
      var it = e.detail === 0 && e.target.closest && e.target.closest('.item');
      if (it && !it.classList.contains('used')) self.cfg.onItem(it.getAttribute('data-item'));
    });
  }
  Shell.prototype.$ = function (s) { return $(s, this.root); };
  Shell.prototype.say = function (t, kind) { this.logEl.textContent = t; this.logEl.className = 'log ' + (kind || 'info'); };
  Shell.prototype.status = function (t, cls) { this.statusEl.textContent = t; this.statusEl.className = 'badge ' + (cls || ''); };
  Shell.prototype.tries = function (n) { this.triesEl.textContent = '試做 ' + n + ' 次'; };
  Shell.prototype.used = function (id, on) { var b = this.$('[data-item="' + id + '"]'); if (b) b.classList.toggle('used', on !== false); };
  Shell.prototype.fail = function (icon, title, text) {
    this.$('#failIco').innerHTML = FAIL_ICON[icon] || FAIL_ICON.warn;
    this.$('#failTitle').textContent = title; this.$('#failText').textContent = text;
    // 閃紅、震動的動畫每次都重播；手機有震動功能就短震兩下（iPhone 不支援，會自動略過）
    var ov = this.$('#ovFail'), body = document.body;
    ov.classList.remove('show'); body.classList.remove('dz-quake'); void ov.offsetWidth;
    ov.classList.add('danger', 'show'); body.classList.add('dz-quake');
    setTimeout(function () { body.classList.remove('dz-quake'); }, 700);
    if (navigator.vibrate) { try { navigator.vibrate([90, 50, 160]); } catch (e) { /* 不支援就算了 */ } }
    if (window.LabRecords) window.LabRecords.onStop(icon === 'splash' ? '毒' : '傷', title.replace(/！(?=.)/g, '：'));
  };
  Shell.prototype.result = function (ok, title, text, card) {
    this.$('#resIco').innerHTML = ok ? FAIL_ICON.ok : FAIL_ICON.miss;
    this.$('#resTitle').textContent = title; this.$('#resText').textContent = text;
    this.$('#resCard').textContent = card || ''; this.$('#resCard').style.display = card ? '' : 'none';
    this.$('#btnClose').style.display = ok ? 'none' : '';
    this.$('#btnNext').style.display = ok ? '' : 'none';
    this.$('#ovResult').classList.add('show');
  };
  Shell.prototype.reset = function () {
    var tiles = this.root.querySelectorAll('.item');
    for (var i = 0; i < tiles.length; i++) tiles[i].classList.remove('used');
    this.cfg.onReset();
  };
  window.MissionShell = Shell;
})();
