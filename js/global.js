/* global.js — 命名空间与通用工具（浏览器全局 + node 可测） */
"use strict";

var G = (typeof window !== "undefined") ? window : globalThis;

/* 版本号：每次改动更新（web/ 目录实时生效，刷新即最新） */
G.VERSION = "2026-08-19 12:49";

/* 随机 */
G.rand = function (a, b) { return a + Math.random() * (b - a); };
G.randInt = function (a, b) { return Math.floor(G.rand(a, b + 1)); };
G.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
G.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

/* 金额格式（分 → 文本） */
G.fmtCents = function (cents, plus) {
  cents = Math.round(Number(cents) || 0);
  var sign = cents < 0 ? "-" : (plus ? "+" : "");
  var abs = Math.abs(cents);
  var s = sign + "$" + (abs / 100).toFixed(2);
  return s;
};

/* 时间戳 "MM-DD HH:MM" */
G.ts = function () {
  var d = new Date();
  var p = function (n) { return (n < 10 ? "0" : "") + n; };
  return p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
};

/* node 兼容导出（浏览器忽略） */
if (typeof module !== "undefined" && module.exports) {
  module.exports = G;
}
