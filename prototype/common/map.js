/* 關卡地圖（像 Candy Crush 一關接一關往上走；三個版本共用，外觀由各版 CSS 決定）
 * 資料：levels_j8.js（國二 50 關草案）。原型只有一關能玩（LAB_MAP.proto）。
 * 安全說明：innerHTML 只放程式內的關卡資料與數字，沒有玩家輸入。 */
(function () {
  'use strict';
  var D = window.LAB_MAP, LV = D.levels, N = LV.length;
  var STEP = 96, TOP = 90;
  var SUBJ = { '生物': 'bio', '物理': 'phy', '化學': 'chem', '地科': 'earth', '共通': 'all', '跨科': 'all' };
  var KIND_DESC = {
    '教學': '新手教學：學會拖道具、拉桿、近看讀數，認識老師喊停。',
    '基本': '道具少，每一步都有提示，學會這個實驗。',
    '加陷阱': '陷阱道具變多，還有老師會喊停的安全點。',
    '換數值': '目標數值或條件改變，要重新讀刻度、重新調整。',
    '修正型': '一開始給一套裝錯的裝置，找出錯在哪裡並修好。',
    '挑戰': '沒有「指出來」提示，每樣道具只能放一次。'
  };

  function $(s) { return document.querySelector(s); }
  var q = location.search;
  var doneUpTo = D.proto - 1, protoStars = 0;
  var m = /[?&]done=(\d+)&stars=(\d)/.exec(q);
  if (m && +m[1] === D.proto) { doneUpTo = D.proto; protoStars = +m[2]; }
  // 玩家紀錄裡有過關紀錄的話，用最佳星數
  var rec = window.LabRecords && window.LabRecords.load().levels['J8-' + D.proto];
  if (rec && rec.best) { doneUpTo = D.proto; protoStars = Math.max(protoStars, rec.best); }
  // 示範用的星星（前面的關卡假裝已經玩過）
  function starsOf(n) {
    if (n === D.proto && protoStars) return protoStars;
    return [3, 2, 3, 3, 1, 2, 3, 2, 3, 3, 2, 1][n % 12];
  }
  var current = Math.min(N, doneUpTo + 1);

  function xOf(n) { return 50 + 30 * Math.sin(n * 0.85); }          // 百分比
  var CH = Math.ceil(N / 10), GAP = 70, BOTTOM = 150;                  // 章與章之間多留一條章名橫幅的空間
  function yOf(n) { return TOP + (N - n) * STEP + ((CH - 1) - Math.floor((n - 1) / 10)) * GAP; }   // px，由下往上

  function build() {
    var h = yOf(1) + BOTTOM;
    var map = $('#map');
    map.style.height = h + 'px';
    // 章節色帶與章名橫幅（橫幅放在每一章的入口，也就是色帶最下面）
    var bands = '';
    for (var c = 0; c < CH; c++) {
      var first = c * 10 + 1, last = Math.min(N, first + 9);
      var yTop = c === CH - 1 ? 0 : yOf(last) - STEP / 2 - GAP / 2;
      var yBot = c === 0 ? h : yOf(first) + STEP / 2 + GAP / 2;
      var names = [];
      for (var i = first - 1; i < last; i++) if (LV[i].k !== '教學' && names.indexOf(LV[i].t) < 0) names.push(LV[i].t);
      var ribbonY = c === 0 ? yOf(1) + 70 : yOf(first) + (STEP + GAP) / 2;
      bands += '<div class="band band' + (c % 5) + '" style="top:' + yTop + 'px;height:' + (yBot - yTop) + 'px"></div>' +
        '<div class="chapter" style="top:' + ribbonY + 'px"><b>第 ' + (c + 1) + ' 章</b><span>' + names.slice(0, 3).join('・') + (names.length > 3 ? '…' : '') + '</span></div>';
    }
    // 路徑（SVG）
    var w = map.clientWidth || 400, d = '';
    for (var n = 1; n <= N; n++) {
      var x = xOf(n) / 100 * w, y = yOf(n);
      if (n === 1) d = 'M' + x + ' ' + y;
      else {
        var px = xOf(n - 1) / 100 * w, py = yOf(n - 1);
        d += ' C' + px + ' ' + (py - STEP / 2) + ' ' + x + ' ' + (y + STEP / 2) + ' ' + x + ' ' + y;
      }
    }
    var svg = '<svg class="path-svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' +
      '<path class="path-under" d="' + d + '"/><path class="path-line" d="' + d + '"/></svg>';
    // 節點
    var nodes = '';
    for (var k = 1; k <= N; k++) {
      var L = LV[k - 1], st = k <= doneUpTo ? 'done' : k === current ? 'now' : 'lock';
      var stars = st === 'done' ? starsOf(k) : 0;
      nodes += '<button type="button" class="node ' + st + ' s-' + (SUBJ[L.s] || 'all') + (L.k === '挑戰' || L.k === '修正型' ? ' hard' : '') + '" data-n="' + k + '" style="left:' + xOf(k) + '%;top:' + yOf(k) + 'px" aria-label="第 ' + k + ' 關 ' + L.t + '">' +
        '<span class="num">' + (st === 'lock' ? '' : k) + '</span>' +
        (st === 'done' ? '<span class="mini-stars">' + '★★★'.slice(0, stars) + '<i>' + '★★★'.slice(0, 3 - stars) + '</i></span>' : '') +
        (st === 'now' ? '<span class="here">你在這裡</span>' : '') + '</button>';
    }
    map.innerHTML = bands + svg + nodes;
    var total = 0;
    for (var t = 1; t <= doneUpTo; t++) total += starsOf(t);
    $('#starTotal').textContent = '★ ' + total + ' / ' + N * 3;
    $('#progress').textContent = '已過 ' + doneUpTo + ' / ' + N + ' 關・我的紀錄 ›';
  }

  function openSheet(n) {
    var L = LV[n - 1], st = n <= doneUpTo ? 'done' : n === current ? 'now' : 'lock';
    var playable = n === D.proto;
    $('#sheetTitle').textContent = '第 ' + n + ' 關';
    $('#sheetSubj').textContent = L.s + (L.c && L.c !== 'T' ? '・' + L.c : '');
    $('#sheetName').textContent = L.t + (L.k === '教學' ? '' : '（' + L.k + '）');
    $('#sheetDesc').textContent = KIND_DESC[L.k] || '';
    var s = st === 'done' ? starsOf(n) : 0;
    $('#sheetStars').innerHTML = '<i class="on">' + '★★★'.slice(0, s) + '</i><i class="off">' + '★★★'.slice(0, 3 - s) + '</i>';
    var btn = $('#sheetGo'), note = $('#sheetNote');
    if (st === 'lock') { btn.disabled = true; note.textContent = '先過前面的關卡，才會解鎖這一關。'; }
    else if (!playable) { btn.disabled = true; note.textContent = '原型只開放第 ' + D.proto + ' 關可以玩（其他關正式版才會做）。'; }
    else { btn.disabled = false; note.textContent = ''; }
    $('#sheet').classList.add('show');
  }

  document.addEventListener('click', function (e) {
    var node = e.target.closest && e.target.closest('.node');
    if (node) openSheet(+node.getAttribute('data-n'));
    if (e.target.id === 'sheetClose' || e.target.id === 'sheet') $('#sheet').classList.remove('show');
  });
  $('#sheetGo').addEventListener('click', function () { location.href = 'index.html'; });
  $('#entryTitle').textContent = D.entry;

  build();
  window.addEventListener('resize', build);
  // 捲到目前這一關
  var target = yOf(current) - window.innerHeight * 0.6;
  window.scrollTo(0, Math.max(0, target + $('#map').offsetTop));
})();
