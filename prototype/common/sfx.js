/* 瘋狂實驗室：音效（老闆 10/19：「其他音效也要製作」）
 * 音效檔在 sfx/（由 音效/make_sfx.py 產生）。用法：LabSfx.play('pass')、LabSfx.play('star2', 0.6)（0.6 秒後播）。
 * - 用 Web Audio 播放：延遲低、可以同時疊好幾個聲音。瀏覽器規定要使用者先點過畫面才能出聲，所以第一次點畫面時才開始載入。
 * - 直接雙擊 html（file://）時瀏覽器不讓程式讀檔，就改用 <audio> 播放。
 * - 靜音設定存在這台裝置（localStorage 的 lab_sfx），不會上傳。 */
(function () {
  'use strict';
  var NAMES = ['ui_tap', 'item_pick', 'item_place', 'slider_tick', 'action', 'pass', 'star1', 'star2', 'star3', 'miss',
    'danger', 'warn', 'reset', 'unlock', 'pour', 'splash', 'stir', 'shake', 'bubble', 'ball_roll', 'ball_land', 'cup_hit',
    'swish', 'rim', 'board', 'bell', 'arrow_hit', 'whoosh', 'pop'];
  var script = document.currentScript;
  var BASE = script && script.src ? script.src.replace(/common\/sfx\.js(\?.*)?$/, 'sfx/') : 'sfx/';
  var useWebAudio = /^https?:/.test(location.protocol) && !!(window.AudioContext || window.webkitAudioContext);
  var ctx = null, master = null, buffers = {}, loading = null, muted = false, lastTick = 0, listeners = [];
  try { muted = localStorage.getItem('lab_sfx') === 'off'; } catch (e) { /* 無痕模式讀不到就當開著 */ }

  function ensureCtx() {
    if (ctx || !useWebAudio) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    } catch (e) { useWebAudio = false; ctx = null; }
    return ctx;
  }
  function decode(buf) {   // Safari 舊版只支援 callback 寫法
    return new Promise(function (ok, bad) { ctx.decodeAudioData(buf, ok, bad); });
  }
  function load() {
    if (loading || !ensureCtx()) return loading || Promise.resolve();
    loading = Promise.all(NAMES.map(function (n) {
      return fetch(BASE + n + '.mp3').then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(decode).then(function (b) { buffers[n] = b; }).catch(function () { /* 單一檔案失敗就不播那個聲音 */ });
    }));
    return loading;
  }
  function startBuffer(name, delay) {
    var src = ctx.createBufferSource();
    src.buffer = buffers[name]; src.connect(master);
    src.start(ctx.currentTime + (delay || 0));
  }
  function playTag(name, delay) {   // 備用：<audio>
    setTimeout(function () {
      try { var a = new Audio(BASE + name + '.mp3'); a.volume = 0.9; var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* 不支援就算了 */ }
    }, (delay || 0) * 1000);
  }
  function play(name, delay) {
    if (muted || NAMES.indexOf(name) < 0) return;
    if (name === 'slider_tick') {   // 拉桿拉很快時不要連發
      var now = Date.now(); if (now - lastTick < 70) return; lastTick = now;
    }
    if (!useWebAudio || !ensureCtx()) return playTag(name, delay);
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    if (buffers[name]) return startBuffer(name, delay);
    load().then(function () { if (buffers[name]) startBuffer(name, delay); });
  }
  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem('lab_sfx', muted ? 'off' : 'on'); } catch (e) { /* 存不了就只在這頁有效 */ }
    listeners.forEach(function (f) { f(muted); });
  }
  // 第一次碰畫面時解鎖聲音、開始載入
  function unlock() {
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.removeEventListener(ev, unlock, true); });
    if (ensureCtx()) { if (ctx.state === 'suspended' && ctx.resume) ctx.resume(); load(); }
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, unlock, true); });

  window.LabSfx = {
    names: NAMES, play: play, setMuted: setMuted,
    isMuted: function () { return muted; },
    onChange: function (f) { listeners.push(f); }
  };
})();
