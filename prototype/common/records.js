/* 玩家紀錄（只存在這台裝置的 localStorage，不上傳）
 * 鍵名一律 lab_ 開頭，不和勇者大冒險（bq_、bq4_）衝突。
 * 存檔碼＝紀錄的 JSON 轉成 base64，換裝置時貼上就能還原。 */
(function () {
  'use strict';
  var KEY = 'lab_rec';

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function blank() { return { v: 1, first: today(), plays: 0, levels: {}, rules: {} }; }

  function load() {
    try {
      var r = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (r && r.v === 1 && r.levels && r.rules) return r;
    } catch (e) { /* 壞掉的資料當作沒有 */ }
    return blank();
  }
  function save(r) {
    if (window.LAB_NO_RECORD) return false;           // 截圖示範模式不寫紀錄
    try { localStorage.setItem(KEY, JSON.stringify(r)); return true; } catch (e) { return false; }
  }

  var Rec = {
    load: load,
    /** 開始玩一關（算遊玩次數） */
    markPlay: function () { var r = load(); r.plays++; save(r); },
    /** 過關：留最佳星數 */
    onPass: function (levelId, stars) {
      var r = load(), L = r.levels[levelId] || { best: 0, clears: 0 };
      L.best = Math.max(L.best, stars); L.clears++; L.last = today();
      r.levels[levelId] = L; save(r);
    },
    /** 被老師喊停：記下學到的守則（同一條只記次數） */
    onStop: function (cat, text) {
      var r = load(), k = text.split('！')[0].split('，')[0].slice(0, 30);
      var o = r.rules[k] || { cat: cat, n: 0 };
      o.n++; r.rules[k] = o; save(r);
    },
    /** 存檔碼：JSON → UTF-8 → base64 */
    exportCode: function () {
      var s = JSON.stringify(load());
      return 'LAB1-' + btoa(unescape(encodeURIComponent(s)));
    },
    /** 匯入存檔碼；格式不對回傳 false，不覆蓋原本的紀錄 */
    importCode: function (code) {
      try {
        code = String(code || '').trim();
        if (code.indexOf('LAB1-') !== 0) return false;
        var r = JSON.parse(decodeURIComponent(escape(atob(code.slice(5)))));
        if (!r || r.v !== 1 || typeof r.levels !== 'object' || typeof r.rules !== 'object') return false;
        return save(r);
      } catch (e) { return false; }
    },
    clear: function () { try { localStorage.removeItem(KEY); } catch (e) { /* 忽略 */ } }
  };
  window.LabRecords = Rec;
})();
