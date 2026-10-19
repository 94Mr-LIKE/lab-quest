/* 首頁「已有 N 位小科學家」計數器（做法同勇者大冒險，但用自己的計數端點，兩款遊戲分開計算）
 * - 只有兩個網址：GET /count → {"count":N}、POST /new → {"count":N+1}。不送名字、紀錄或任何資料。
 * - 第一次開始玩一關時送一次 +1；同一台裝置只送一次（localStorage 的 lab_counted）。先記旗標再送，失敗不重送。
 * - 讀數字 3 秒逾時；離線、錯誤、file:// 開啟 → 不顯示，不影響遊戲。
 * - 老闆照 10 號 SOP 建好 Cloudflare 端點後，把網址填進 URL、ENABLED 改成 true。
 *   在那之前一律不送任何網路請求。 */
(function () {
  'use strict';
  var ENABLED = false;
  var URL = '';                       // 例：https://lab-counter.mr-bigboss-office.workers.dev
  var FLAG_KEY = 'lab_counted';
  var TIMEOUT_MS = 3000;

  function canFetch() {
    if (!ENABLED || !URL || typeof fetch !== 'function') return false;
    try { if (location.protocol === 'file:') return false; } catch (e) { return false; }
    return true;
  }
  function request(path, method) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var opts = { method: method, mode: 'cors', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', keepalive: method === 'POST' };
    if (ctrl) opts.signal = ctrl.signal;
    return new Promise(function (resolve) {
      var done = false, finish = function (v) { if (!done) { done = true; clearTimeout(t); resolve(v); } };
      var t = setTimeout(function () { if (ctrl) { try { ctrl.abort(); } catch (e) { /* 忽略 */ } } finish(null); }, TIMEOUT_MS);
      fetch(URL + path, opts).then(function (res) {
        if (!res || !res.ok) return finish(null);
        res.json().then(finish, function () { finish(null); });
      }, function () { finish(null); });
    });
  }
  function valid(j) {
    var n = j && j.count;
    return typeof n === 'number' && isFinite(n) && n >= 0 && n < 1e9 && Math.floor(n) === n ? n : null;
  }

  window.LabCounter = {
    /** 首頁顯示：回傳 Promise<number|null> */
    fetchCount: function () { return canFetch() ? request('/count', 'GET').then(valid) : Promise.resolve(null); },
    /** 第一次開始玩：這台裝置還沒送過就送一次 */
    reportOnce: function () {
      if (!canFetch()) return;
      try { if (localStorage.getItem(FLAG_KEY)) return; localStorage.setItem(FLAG_KEY, '1'); } catch (e) { return; }
      request('/new', 'POST');
    },
    /** 把數字放進某個元素；讀不到就保持隱藏 */
    show: function (el) {
      if (!el) return;
      this.fetchCount().then(function (n) {
        if (n === null) return;
        el.textContent = '已經有 ' + n.toLocaleString('zh-TW') + ' 位小科學家來做實驗';
        el.hidden = false;
      });
    }
  };
})();
