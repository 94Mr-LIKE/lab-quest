/* 2D 向量實驗桌（版本 1、3 共用；顏色由各版 CSS 決定） */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var PX = 9;                 // 1 cm = 9 px（示意比例）
  var IN_BOTTOM = 162;        // 燒杯內底的 y
  var WATER_Y = IN_BOTTOM - window.LabCore.WATER_TOP * PX;

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function SvgScene() { this.bubbles = []; this.iceT = 0; this.flameT = 0; }

  SvgScene.prototype.mount = function (host) {
    var svg = el('svg', { viewBox: '0 0 400 290', class: 'lab-svg', role: 'img', 'aria-label': '實驗桌示意圖' });
    var defs = el('defs', {}, svg);
    var cp = el('clipPath', { id: 'beakerIn' }, defs);
    el('rect', { x: 162, y: 60, width: 76, height: 102, rx: 3 }, cp);
    var glow = el('filter', { id: 'glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: 3, result: 'b' }, glow);
    var mg = el('feMerge', {}, glow); el('feMergeNode', { in: 'b' }, mg); el('feMergeNode', { in: 'SourceGraphic' }, mg);

    el('line', { x1: 10, y1: 272, x2: 390, y2: 272, class: 'table' }, svg);

    // 空位提示（放得下的位置都會亮）
    this.slotBox = el('rect', { x: 158, y: 86, width: 84, height: 80, rx: 8, class: 'slot' }, svg);
    this.slotLamp = el('rect', { x: 172, y: 222, width: 56, height: 50, rx: 8, class: 'slot' }, svg);

    // 鐵架（固定溫度計）
    el('rect', { x: 300, y: 264, width: 70, height: 8, rx: 3, class: 'metal' }, svg);
    el('line', { x1: 335, y1: 266, x2: 335, y2: 24, class: 'rod' }, svg);

    // 三腳架＋陶瓷纖維網
    el('path', { d: 'M146 272 L168 170 M254 272 L232 170 M200 272 L200 176', class: 'leg' }, svg);
    el('rect', { x: 140, y: 166, width: 120, height: 6, rx: 2, class: 'metal' }, svg);
    var mesh = el('g', { class: 'mesh-g' }, svg);
    el('rect', { x: 132, y: 160, width: 136, height: 7, rx: 2, class: 'mesh' }, mesh);
    el('ellipse', { cx: 200, cy: 163.5, rx: 30, ry: 2.6, class: 'mesh-core' }, mesh);

    // 酒精燈＋火焰
    this.lamp = el('g', { class: 'lamp' }, svg);
    el('path', { d: 'M176 272 L224 272 L216 240 Q200 234 184 240 Z', class: 'lamp-body' }, this.lamp);
    el('rect', { x: 193, y: 228, width: 14, height: 11, rx: 2, class: 'metal' }, this.lamp);
    el('line', { x1: 200, y1: 220, x2: 200, y2: 229, class: 'wick' }, this.lamp);
    this.flame = el('g', { class: 'flame-g' }, this.lamp);
    el('path', { d: 'M200 182 C188 198 190 212 200 220 C210 212 212 198 200 182 Z', class: 'flame-out' }, this.flame);
    el('path', { d: 'M200 198 C195 206 196 213 200 218 C204 213 205 206 200 198 Z', class: 'flame-in' }, this.flame);

    // 燒杯＋水
    this.beaker = el('g', { class: 'beaker-g' }, svg);
    var inner = el('g', { 'clip-path': 'url(#beakerIn)' }, this.beaker);
    this.water = el('rect', { x: 160, y: WATER_Y, width: 80, height: IN_BOTTOM - WATER_Y + 4, class: 'water' }, inner);
    this.bubbleG = el('g', { class: 'bubbles' }, inner);
    this.iceG = el('g', { class: 'ice' }, inner);
    for (var i = 0; i < 3; i++) el('rect', { x: 170 + i * 20, y: WATER_Y - 6, width: 13, height: 12, rx: 2, transform: 'rotate(' + (i * 17 - 12) + ' ' + (176 + i * 20) + ' ' + WATER_Y + ')' }, this.iceG);
    el('path', { d: 'M156 86 L161 90 L161 158 Q161 164 167 164 L233 164 Q239 164 239 158 L239 90 L244 86', class: 'glass' }, this.beaker);
    for (var g = 0; g < 4; g++) el('line', { x1: 226, x2: 236, y1: 152 - g * 18, y2: 152 - g * 18, class: 'grad' }, this.beaker);
    this.steam = el('g', { class: 'steam' }, this.beaker);
    el('path', { d: 'M184 80 C178 68 190 60 184 48', class: 'steam-p' }, this.steam);
    el('path', { d: 'M202 78 C196 64 208 56 202 42', class: 'steam-p' }, this.steam);
    el('path', { d: 'M218 80 C212 68 224 60 218 48', class: 'steam-p' }, this.steam);

    // 溫度計＋夾子（整組依高度上下移動）
    this.thermo = el('g', { class: 'thermo-g' }, svg);
    this.arm = el('line', { x1: 335, y1: -112, x2: 222, y2: -112, class: 'rod thin' }, this.thermo);
    el('rect', { x: 210, y: -118, width: 18, height: 12, rx: 3, class: 'metal' }, this.thermo);
    el('rect', { x: 214, y: -132, width: 8, height: 128, rx: 4, class: 'tglass' }, this.thermo);
    el('circle', { cx: 218, cy: -6, r: 6, class: 'tbulb' }, this.thermo);
    this.column = el('rect', { x: 216.6, y: -40, width: 2.8, height: 36, class: 'tcol' }, this.thermo);

    // 護目鏡狀態
    this.gog = el('g', { class: 'gog' }, svg);
    el('rect', { x: 12, y: 12, width: 112, height: 30, rx: 15, class: 'chip' }, this.gog);
    el('text', { x: 68, y: 32, 'text-anchor': 'middle', class: 'chip-t' }, this.gog).textContent = '已戴護目鏡';

    host.appendChild(svg);
    this.svg = svg;
  };

  SvgScene.prototype.render = function (s, level, ev) {
    var show = function (node, on) { node.style.display = on ? '' : 'none'; };
    show(this.beaker, !!s.container);
    show(this.slotBox, !s.container);
    show(this.lamp, s.lamp);
    show(this.slotLamp, !s.lamp);
    show(this.flame, s.lit);
    show(this.thermo, s.thermo);
    show(this.gog, s.goggles);
    var bulbY = IN_BOTTOM - s.depth * PX;
    var dx = (231.5 - s.wall * PX) - 218;            // 離杯壁 0 cm＝球部貼著右側杯壁
    this.thermo.setAttribute('transform', 'translate(' + dx + ',' + bulbY + ')');
    this.arm.setAttribute('x1', 335 - dx);            // 夾子的橫桿永遠接到鐵架
    var h = 12 + Math.max(0, Math.min(112, s.shown));
    this.column.setAttribute('y', -h); this.column.setAttribute('height', h - 4);
    this.steam.style.opacity = s.boiling && s.lit ? 1 : 0;
    if (ev && ev.type === 'place' && ev.item === 'ice') this.iceT = 4;
    if (ev && ev.type === 'reset') { this.iceT = 0; this.clearBubbles(); }
  };

  SvgScene.prototype.clearBubbles = function () {
    while (this.bubbleG.firstChild) this.bubbleG.removeChild(this.bubbleG.firstChild);
    this.bubbles = [];
  };

  SvgScene.prototype.frame = function (dt, s) {
    if (s.lit && !s.paused) {
      this.flameT += dt;
      var k = 1 + Math.sin(this.flameT * 17) * 0.05 + Math.sin(this.flameT * 7.3) * 0.04;
      var sx = (2 - k) * 0.5 + 0.5;
      this.flame.setAttribute('transform', 'translate(200 220) scale(' + sx + ' ' + k + ') translate(-200 -220)');
    }
    // 冰塊慢慢融化
    if (this.iceT > 0) { this.iceT -= s.paused ? 0 : dt; }
    this.iceG.style.opacity = Math.max(0, Math.min(1, this.iceT / 2));
    // 氣泡：水溫 70 °C 以上開始出現，沸騰時大量冒出
    var want = !s.container ? 0 : s.water < 70 ? 0 : s.boiling && s.lit ? 16 : Math.round((s.water - 70) / 30 * 7);
    while (this.bubbles.length < want) {
      var c = el('circle', { r: 1.5 + Math.random() * 2.5 }, this.bubbleG);
      this.bubbles.push({ n: c, x: 168 + Math.random() * 40 + (Math.random() < 0.5 ? 0 : 20), y: IN_BOTTOM - Math.random() * 40, v: 25 + Math.random() * 35 });
    }
    while (this.bubbles.length > want) { var b0 = this.bubbles.pop(); this.bubbleG.removeChild(b0.n); }
    if (s.paused) return;
    for (var i = 0; i < this.bubbles.length; i++) {
      var b = this.bubbles[i];
      b.y -= b.v * dt * (s.boiling ? 1.6 : 1);
      if (b.y < WATER_Y + 2) { b.y = IN_BOTTOM - 1; b.x = 166 + Math.random() * 46; }
      b.n.setAttribute('cx', b.x); b.n.setAttribute('cy', b.y);
    }
  };

  window.LabSvgScene = SvgScene;
})();
