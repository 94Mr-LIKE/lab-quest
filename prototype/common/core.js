/* 實驗闖關 原型：關卡規則（三個版本共用）
 * 示範關：國二理化「水溫與加熱時間」——把水加熱到沸騰，讀出溫度計讀數，最後用燈蓋熄火。
 * 不計算：玩家只放道具、調高度、讀刻度、設定讀數。
 * 依據：112 會考「溫度計懸吊在水中，不接觸杯底」；106 會考「量筒不可加熱」；課綱 Ab-Ⅳ-2、Bb-Ⅳ-5、Ea-Ⅳ-3。
 */
(function () {
  'use strict';

  var ITEMS = [
    { id: 'beaker',   name: '燒杯',   tip: '耐熱玻璃容器，可以放在陶瓷纖維網上加熱。' },
    { id: 'cylinder', name: '量筒',   tip: '用來量液體體積的細長玻璃筒。' },
    { id: 'thermo',   name: '溫度計', tip: '酒精溫度計，量程 0～110 °C，每一小格 1 °C。' },
    { id: 'ice',      name: '冰塊',   tip: '一杯碎冰。' },
    { id: 'goggles',  name: '護目鏡', tip: '保護眼睛，防止液體噴濺。' },
    { id: 'lamp',     name: '酒精燈', tip: '加熱用的火源，酒精不可裝滿。' },
    { id: 'igniter',  name: '點火槍', tip: '用來點燃酒精燈。' },
    { id: 'cap',      name: '燈蓋',   tip: '蓋上就能讓酒精燈熄滅。' }
  ];

  var SIM_SPEED = 45;      // 1 秒真實時間 = 45 秒模擬時間（約 15 秒煮沸）
  var ROOM = 25;           // 室溫（設計值）
  var WATER_TOP = 6.0;     // 水深（cm，設計值）
  var DEPTH_MAX = 9.0;
  var WALL_MAX = 3.5;      // 溫度計離杯壁最遠 3.5 cm（燒杯半徑約 4.4 cm，3.5 cm 大約在中間）

  // 依「距杯底」判斷；碰杯底優先於貼杯壁
  function zoneOf(d) {
    if (d < 0.5) return 'bottom';
    if (d <= WATER_TOP - 1.0) return 'water';
    return 'air';
  }
  function placeOf(d, w) {
    var z = zoneOf(d);
    if (z === 'water' && w < 0.5) return 'wall';
    return z;
  }

  function Level() {
    this.listeners = [];
    this.reset();
  }

  Level.prototype.reset = function () {
    this.s = {
      container: null,    // 'beaker'
      thermo: false,
      depth: 0,           // 溫度計球部距杯底（cm）
      wall: 0,            // 溫度計球部離杯壁（cm）；0＝貼著杯壁
      goggles: false,
      lamp: false,
      lit: false,
      water: ROOM,        // 真實水溫
      shown: ROOM,        // 溫度計顯示（有延遲）
      boiling: false,
      t: 0,               // 模擬秒數
      paused: false,
      reading: 25,        // 玩家設定的讀數
      recorded: false,
      passed: false,
      used: {},           // 已用掉的道具
      stops: 0,
      decoys: 0,
      hintLevel: 0,
      hintUsedL2: false
    };
    this.emit({ type: 'reset' });
  };

  Level.prototype.on = function (fn) { this.listeners.push(fn); };
  Level.prototype.emit = function (ev) {
    for (var i = 0; i < this.listeners.length; i++) this.listeners[i](this.s, ev || {});
  };

  Level.prototype.zone = function () { return placeOf(this.s.depth, this.s.wall); };

  Level.prototype.itemState = function (id) {
    var s = this.s;
    if (id === 'beaker') return s.container ? 'used' : 'ready';
    if (id === 'thermo') return s.thermo ? 'used' : 'ready';
    if (id === 'goggles') return s.goggles ? 'used' : 'ready';
    if (id === 'lamp') return s.lamp ? 'used' : 'ready';
    if (id === 'igniter') return s.lit ? 'used' : 'ready';
    return 'ready';
  };

  // 老師喊停：畫面定格、說明、倒回違規前（這裡的違規都不會改變狀態，只記一次）
  Level.prototype.stop = function (cat, text) {
    this.s.stops++;
    this.s.paused = true;
    this.emit({ type: 'stop', cat: cat, text: text });
  };
  Level.prototype.note = function (text, kind) {
    this.emit({ type: 'note', kind: kind || 'info', text: text });
  };

  Level.prototype.useItem = function (id) {
    var s = this.s;
    if (s.passed) return;
    switch (id) {
      case 'beaker':
        if (s.container) return this.note('燒杯已經放好了。');
        s.container = 'beaker';
        this.emit({ type: 'place', item: id });
        return this.note('燒杯放到陶瓷纖維網上了，裡面有 200 mL 的水。', 'ok');
      case 'cylinder':
        s.decoys++;
        if (!s.container) {
          return this.stop('傷', '量筒不能拿來加熱，加熱容易破裂！請改用可以加熱的容器。');
        }
        return this.note('這關用不到量筒（量筒只用來量液體體積，不能加熱）。', 'warn');
      case 'thermo':
        if (!s.container) return this.note('先放好要加熱的容器，再放溫度計。');
        if (s.thermo) return this.note('溫度計已經放好了。');
        s.thermo = true; s.depth = 0; s.wall = 0; s.shown = s.water + (s.lit ? 6 : 0);
        this.emit({ type: 'place', item: id });
        return this.note('溫度計滑到杯底，還貼著杯壁！用下面兩個拉桿，把它調到水的中間。', 'warn');
      case 'ice':
        s.decoys++;
        if (s.container) {
          s.water = Math.max(3, s.water - 20);
          if (s.boiling) s.boiling = false;
          this.emit({ type: 'place', item: id });
          return this.note('冰塊讓水溫下降了。這關用不到冰塊。', 'warn');
        }
        return this.note('這關用不到冰塊。', 'warn');
      case 'goggles':
        if (s.goggles) return;
        s.goggles = true;
        this.emit({ type: 'place', item: id });
        return this.note('戴好護目鏡了。', 'ok');
      case 'lamp':
        if (s.lamp) return;
        s.lamp = true;
        this.emit({ type: 'place', item: id });
        return this.note('酒精燈放到三腳架下面了。', 'ok');
      case 'igniter':
        if (!s.lamp) return this.note('先把酒精燈放到三腳架下面，才能點火。');
        if (s.lit) return this.note('酒精燈已經點著了。');
        if (!s.goggles) return this.stop('火', '點火前要先戴好護目鏡！加熱時水可能噴濺，會傷到眼睛。');
        if (!s.container) return this.note('網子上還沒有容器，先放好要加熱的容器再點火。', 'warn');
        s.lit = true; s.paused = false;
        this.emit({ type: 'place', item: id });
        return this.note('酒精燈點著了，開始加熱。', 'ok');
      case 'cap':
        if (!s.lit) return this.note('酒精燈沒有點著，現在不用燈蓋。');
        s.lit = false;
        this.emit({ type: 'place', item: id });
        if (s.recorded) return this.pass();
        return this.note('酒精燈熄滅了。還沒記錄讀數的話，要再點火加熱喔。');
    }
  };

  Level.prototype.setDepth = function (d) {
    this.s.depth = Math.max(0, Math.min(DEPTH_MAX, Math.round(d * 2) / 2));
    this.emit({ type: 'depth' });
  };
  Level.prototype.setWall = function (w) {
    this.s.wall = Math.max(0, Math.min(WALL_MAX, Math.round(w * 2) / 2));
    this.emit({ type: 'wall' });
  };
  Level.prototype.setReading = function (v) {
    this.s.reading = Math.max(0, Math.min(110, Math.round(v)));
    this.emit({ type: 'reading' });
  };

  Level.prototype.record = function () {
    var s = this.s;
    if (s.passed) return;
    if (!s.thermo) return this.note('還沒有放溫度計。');
    var z = this.zone();
    if (z === 'bottom') return this.note('溫度計碰到杯底了！量到的是杯底的溫度，不是水溫。把溫度計往上調一點。', 'warn');
    if (z === 'air') return this.note('溫度計的球部沒有泡在水裡，量到的不是水溫。', 'warn');
    if (z === 'wall') return this.note('溫度計貼到杯壁了！量到的會受杯壁影響，不是水溫。讓溫度計離開杯壁，懸在水的中間。', 'warn');
    if (!s.boiling) return this.note('水還沒有沸騰，等水大量冒泡再記錄。', 'warn');
    if (Math.abs(s.reading - Math.round(s.shown)) > 1) {
      return this.note('讀數不對喔。按「近看」仔細讀刻度：每一小格是 1 °C，視線要和液柱頂端一樣高。', 'warn');
    }
    s.recorded = true;
    this.emit({ type: 'recorded' });
    if (!s.lit) return this.pass();
    return this.note('記錄好了！最後一步：把酒精燈安全熄滅。', 'ok');
  };

  Level.prototype.pass = function () {
    var s = this.s;
    s.passed = true; s.paused = true;
    var stars = [true, s.stops === 0, s.decoys === 0 && !s.hintUsedL2];
    this.emit({ type: 'pass', stars: stars });
  };

  Level.prototype.togglePause = function () {
    this.s.paused = !this.s.paused;
    this.emit({ type: 'pause' });
  };
  Level.prototype.resume = function () { this.s.paused = false; this.emit({ type: 'pause' }); };

  // 提示：第 1 次說「想一想」，第 2 次指出道具或控制項（會拿不到第 3 顆星）
  Level.prototype.hint = function () {
    var s = this.s, z = this.zone();
    var steps = [
      [!s.container, '找一個可以直接加熱的玻璃容器，放到陶瓷纖維網上。', 'item:beaker'],
      [!s.thermo, '要知道水有多熱，需要哪一樣工具？', 'item:thermo'],
      [s.thermo && (z === 'bottom' || z === 'air'), '溫度計的球部要泡在水裡，但是不能碰到杯底。', 'ctl:depth'],
      [s.thermo && z === 'wall', '溫度計不可以貼著杯壁，要懸在水的中間。', 'ctl:wall'],
      [!s.goggles, '用火加熱之前，先保護好眼睛。', 'item:goggles'],
      [!s.lamp, '需要火源才能加熱。', 'item:lamp'],
      [!s.lit && !s.recorded, '把酒精燈點著。', 'item:igniter'],
      [!s.boiling && !s.recorded, '等水大量冒泡（沸騰）。', ''],
      [!s.recorded, '按「近看」讀溫度計，把「我讀到的溫度」設好，再按「記錄讀數」。', 'ctl:zoom'],
      [s.lit, '用燈蓋把酒精燈蓋熄。不可以用嘴吹。', 'item:cap']
    ];
    for (var i = 0; i < steps.length; i++) {
      if (steps[i][0]) {
        s.hintLevel = s.hintLevel >= 1 ? 2 : 1;
        if (s.hintLevel === 2 && steps[i][2]) s.hintUsedL2 = true;
        return this.emit({ type: 'hint', level: s.hintLevel, text: steps[i][1], target: s.hintLevel === 2 ? steps[i][2] : '' });
      }
    }
  };

  // 每一格動畫呼叫：dt 為真實秒數
  Level.prototype.tick = function (dt) {
    var s = this.s;
    if (s.paused || s.passed) return;
    var sim = dt * SIM_SPEED;
    var running = s.lit || s.water > ROOM + 0.01 || Math.abs(s.shown - s.water) > 0.05;
    if (!running && !s.thermo) return;
    if (s.lit) s.t += sim;
    if (s.container) {
      if (s.lit) {
        var rate = 0.16 * (1 - 0.35 * (s.water - ROOM) / 75); // °C／模擬秒（設計值）
        s.water = Math.min(100, s.water + rate * sim);
        if (s.water >= 99.95 && !s.boiling) { s.boiling = true; this.emit({ type: 'boil' }); }
      } else {
        if (s.water > ROOM) s.water = Math.max(ROOM, s.water - 0.02 * sim);
        else s.water = Math.min(ROOM, s.water + 0.02 * sim);
        if (s.water < 99.5) s.boiling = false;
      }
    }
    if (s.thermo) {
      var z = this.zone(), target;
      if (z === 'water') target = s.water;
      else if (z === 'bottom') target = s.water + (s.lit ? 6 : 1);
      else if (z === 'wall') target = s.water + (s.lit ? 3 : 0.5);   // 貼杯壁讀數偏差（遊戲設計值）
      else target = ROOM + (s.water - ROOM) * 0.4;
      var k = Math.min(1, sim * 0.08);
      s.shown += (target - s.shown) * k;
    }
    this.emit({ type: 'tick' });
  };

  window.LabCore = {
    ITEMS: ITEMS,
    WATER_TOP: WATER_TOP,
    DEPTH_MAX: DEPTH_MAX,
    WALL_MAX: WALL_MAX,
    placeOf: placeOf,
    zoneOf: zoneOf,
    Level: Level,
    LEVEL_INFO: {
      stage: '國二 理化',
      no: '第 19 關',
      mapNo: 19,
      title: '水在幾度沸騰？',
      goal: '把燒杯裡的水加熱到沸騰，讀出溫度計的溫度，最後安全熄火。',
      card: '在 1 大氣壓下，水大約在 100 °C 沸騰；沸騰時繼續加熱，溫度幾乎不再上升。量水溫時，溫度計的球部要泡在水的中間：不可碰到杯底，也不可貼著杯壁。量筒不可以加熱。',
      refs: '課綱 Ab-Ⅳ-2、Bb-Ⅳ-5、Ea-Ⅳ-3｜112 會考「水溫與加熱時間的關係」｜106 會考「量筒不可加熱」'
    }
  };
})();
