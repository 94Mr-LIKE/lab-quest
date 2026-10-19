/* 道具圖示（線條圖，顏色跟著版面主題） */
(function () {
  'use strict';
  var S = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
  var ICONS = {
    beaker: '<path ' + S + ' d="M14 8h20M16 8v28a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4V8"/><path ' + S + ' d="M16 24h16" opacity=".55"/><path d="M17 25h14v11a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3z" fill="currentColor" opacity=".18"/>',
    cylinder: '<path ' + S + ' d="M19 6h10M20 6v34h8V6M16 40h16"/><path ' + S + ' d="M20 14h3M20 20h3M20 26h3M20 32h3" opacity=".6"/>',
    thermo: '<path ' + S + ' d="M21 8a3 3 0 0 1 6 0v22a6 6 0 1 1-6 0z"/><path d="M24 18v14" stroke="#d64545" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="35" r="3.2" fill="#d64545"/>',
    ice: '<path ' + S + ' d="M10 22l9-5 9 5v10l-9 5-9-5z"/><path ' + S + ' d="M10 22l9 5 9-5M19 27v10" opacity=".6"/><path ' + S + ' d="M28 14l6-3 6 3v7l-6 3" opacity=".7"/>',
    goggles: '<path ' + S + ' d="M6 20c0-4 4-6 9-6h18c5 0 9 2 9 6v6c0 4-3 6-7 6h-4l-3-4h-4l-3 4h-4c-4 0-7-2-7-6z"/><path ' + S + ' d="M2 22h4M42 22h4" />',
    lamp: '<path ' + S + ' d="M14 40h20l-3-14H17z"/><path ' + S + ' d="M21 26v-4h6v4"/><path d="M24 22c-3-3-3-7 0-11 3 4 3 8 0 11z" fill="#f2a33a"/>',
    igniter: '<path ' + S + ' d="M8 30h16l4-6h12M24 30v8h-8l-2-8"/><path d="M42 21c-2-1-3-3-2-6 2 1 4 3 2 6z" fill="#f2a33a"/>',
    cap: '<path ' + S + ' d="M14 30c0-8 4-14 10-14s10 6 10 14z"/><path ' + S + ' d="M12 30h24M24 16v-4"/>'
  };
  window.LabIcons = function (id, size) {
    size = size || 40;
    return '<svg viewBox="0 0 48 48" width="' + size + '" height="' + size + '" aria-hidden="true">' + (ICONS[id] || '') + '</svg>';
  };
})();
