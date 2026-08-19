/* wallet.js — 统一钱包（移植 core/wallet.py）
 * 余额用整数「分」存储，避免 JS float 精度问题；存档在 localStorage。 */
"use strict";

var SAVE_KEY = "willow_tavern_save";
var STARTING_CENTS = 500;      // $5.00
var LEDGER_MAX = 100;
var STATS_MAX_LOG = 50;

/* 任意数值 → 整数分（美元字符串/数字均可） */
function toCents(x) {
  var n = typeof x === "string" ? parseFloat(x) : Number(x);
  if (!isFinite(n)) return STARTING_CENTS;
  return Math.round(n * 100);
}

function Stats() {
  this.games = 0; this.wins = 0; this.losses = 0; this.pushes = 0;
  this.blackjacks = 0; this.net = 0; this.log = [];
}
Stats.prototype.toJSON = function () {
  return { games: this.games, wins: this.wins, losses: this.losses, pushes: this.pushes,
           blackjacks: this.blackjacks, net: this.net, log: this.log };
};
Stats.fromJSON = function (d) {
  var s = new Stats();
  if (!d) return s;
  s.games = d.games || 0; s.wins = d.wins || 0; s.losses = d.losses || 0;
  s.pushes = d.pushes || 0; s.blackjacks = d.blackjacks || 0;
  s.net = d.net || 0; s.log = d.log || [];
  return s;
};
Stats.prototype.record = function (result, betCents, tags, netCents) {
  this.games++;
  if (result === "win_bj" || result === "win") this.wins++;
  else if (result === "lose") this.losses++;
  else this.pushes++;
  if (result === "win_bj") this.blackjacks++;
  this.net += netCents;
  var label = { win_bj: "黑杰克", win: "赢", lose: "输", push: "平" }[result] || result;
  var tag = (tags && tags.length) ? tags.join("/") : "普通";
  this.log.push("#" + String(this.games).padStart(4, " ") + " 下注" + G.fmtCents(betCents)
                + "(" + tag + ") " + label + " " + G.fmtCents(netCents, true));
  if (this.log.length > STATS_MAX_LOG) this.log = this.log.slice(-STATS_MAX_LOG);
};

function Wallet() {
  this.chips = STARTING_CENTS;
  this.settings = { difficulty: "standard" };
  this.stats = {};      // {gameKey: Stats}
  this.ledger = [];     // [{t, game, delta(cents), reason, balance(cents)}]
  this.progress = null; // 游戏进度（时间/心情/家具等，见 progress.js）
}

Wallet.prototype.toJSON = function () {
  var stats = {};
  for (var k in this.stats) stats[k] = this.stats[k].toJSON();
  return { chips: this.chips, settings: this.settings, stats: stats, ledger: this.ledger, progress: this.progress };
};

Wallet.fromJSON = function (d) {
  var w = new Wallet();
  if (!d) return w;
  w.chips = (typeof d.chips === "number" && isFinite(d.chips))
    ? Math.round(d.chips) : STARTING_CENTS;   // chips 本身即以「分」存储
  w.settings = Object.assign({ difficulty: "standard" }, d.settings || {});
  for (var k in (d.stats || {})) w.stats[k] = Stats.fromJSON(d.stats[k]);
  w.ledger = Array.isArray(d.ledger) ? d.ledger : [];
  w.progress = (d.progress && typeof d.progress === "object") ? d.progress : null;
  return w;
};

/* 存档读写（localStorage；node 测试时注入 stub；保存前自动同步游戏进度 GS） */
Wallet.prototype.save = function () {
  try {
    if (typeof GS !== "undefined" && GS.syncToWallet) GS.syncToWallet(this);
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.toJSON()));
    return true;
  } catch (e) { return false; }
};

Wallet.load = function () {
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (raw) return Wallet.fromJSON(JSON.parse(raw));
  } catch (e) { /* 存档损坏则重开 */ }
  return new Wallet();
};

Wallet.prototype.balanceCents = function () { return this.chips; };
Wallet.prototype.statsFor = function (game) {
  if (!this.stats[game]) this.stats[game] = new Stats();
  return this.stats[game];
};
Wallet.prototype.totalGames = function () {
  var t = 0;
  for (var k in this.stats) t += this.stats[k].games;
  return t;
};

/* 收支结算：delta 为美元（数字/字符串），内部转分累加；钱包最低 -$30（老板赊账上限） */
Wallet.prototype.settle = function (deltaDollars, game, reason) {
  var cents = toCents(deltaDollars);
  this.chips += cents;
  if (typeof WALLET_MIN !== "undefined" && this.chips < WALLET_MIN) this.chips = WALLET_MIN;
  this.ledger.push({
    t: G.ts(), game: game, delta: cents, reason: reason, balance: this.chips,
  });
  if (this.ledger.length > LEDGER_MAX) this.ledger = this.ledger.slice(-LEDGER_MAX);
  return this.chips;
};

/* ---------- 作弊码（酒馆彩蛋，仅纸牌游戏） ---------- */
var cheatEnabled = false;
function cheatReset() { cheatEnabled = false; }
function cheatActive() { return cheatEnabled; }
function cheatEnable() { cheatEnabled = true; }

/* 结算封装：作弊模式下负数归零，返回实际入账金额（分） */
function cheatSettle(wallet, deltaDollars, game, reason) {
  var cents = toCents(deltaDollars);
  if (cheatEnabled && cents < 0) {
    cents = 0;
    reason += "(酒馆睁一只眼闭一只眼)";
  }
  wallet.settle(cents / 100, game, reason);
  return cents;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SAVE_KEY: SAVE_KEY, STARTING_CENTS: STARTING_CENTS,
    toCents: toCents, Stats: Stats, Wallet: Wallet,
    cheatReset: cheatReset, cheatActive: cheatActive,
    cheatEnable: cheatEnable, cheatSettle: cheatSettle,
  };
}
