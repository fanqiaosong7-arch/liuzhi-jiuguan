/* rules-poker.js — 德州扑克规则与 AI（移植 games/poker.py）
 * 金额单位：内部统一用「分」(cents)，结算时转回美元交给钱包。 */
"use strict";

var ANTE = 100;          // 底注 $1
var MAX_COMMIT = 2000;   // 玩家单局总投入上限 $20
var CPU_CHIPS = 5000;    // 电脑虚拟筹码 $50
var RAISE_THRESHOLD = 0.55;  // 醉汉加注门槛
var CALL_THRESHOLD = 0.25;   // 醉汉跟注门槛

var HAND_NAMES = {
  8: "同花顺", 7: "四条", 6: "葫芦", 5: "同花", 4: "顺子",
  3: "三条", 2: "两对", 1: "一对", 0: "高牌",
};

/* 5 张牌打分：返回数组 [牌型, kicker...]，用 cmpScore 比较 */
function handScore(cards5) {
  var ranks = cards5.map(pokerRank).sort(function (a, b) { return b - a; });
  var suits = {};
  for (var i = 0; i < cards5.length; i++) suits[suitOf(cards5[i])] = 1;
  var flush = Object.keys(suits).length === 1;

  var rs = [];
  for (var j = 0; j < ranks.length; j++) if (rs.indexOf(ranks[j]) < 0) rs.push(ranks[j]);
  rs.sort(function (a, b) { return a - b; });
  var st = null;
  if (rs.length === 5) {
    if (rs[4] - rs[0] === 4) st = rs[4];
    else if (rs.join(",") === "2,3,4,5,14") st = 5;
  }
  if (flush && st !== null) return [8, st];
  if (st !== null) return [4, st];
  if (flush) return [5].concat(ranks);

  var freq = [];
  for (var r = 0; r < ranks.length; r++) {
    var found = null;
    for (var f = 0; f < freq.length; f++) if (freq[f][1] === ranks[r]) found = f;
    if (found === null) freq.push([1, ranks[r]]);
    else freq[found][0]++;
  }
  freq.sort(function (a, b) { return (b[0] - a[0]) || (b[1] - a[1]); });
  var pattern = freq.map(function (x) { return x[0]; }).join(",");
  if (pattern === "4,1") return [7, freq[0][1], freq[1][1]];
  if (pattern === "3,2") return [6, freq[0][1], freq[1][1]];
  if (pattern === "3,1,1") return [3, freq[0][1], freq[1][1], freq[2][1]];
  if (pattern === "2,2,1") {
    var hi = Math.max(freq[0][1], freq[1][1]), lo = Math.min(freq[0][1], freq[1][1]);
    return [2, hi, lo, freq[2][1]];
  }
  if (pattern === "2,1,1,1") return [1, freq[0][1], freq[1][1], freq[2][1], freq[3][1]];
  return [0].concat(ranks);
}

/* 分数比较：a > b → 1, a < b → -1, 相等 → 0 */
function cmpScore(a, b) {
  var n = Math.min(a.length, b.length);
  for (var i = 0; i < n; i++) {
    if (a[i] > b[i]) return 1;
    if (a[i] < b[i]) return -1;
  }
  return 0;
}

/* 7 张选最佳 5 张：返回 { score, hand } */
function bestHand(cards7) {
  var best = null;
  var combos = combinations(cards7, 5);
  for (var i = 0; i < combos.length; i++) {
    var score = handScore(combos[i]);
    if (best === null || cmpScore(score, best.score) > 0) best = { score: score, hand: combos[i] };
  }
  return best;
}

function combinations(arr, k) {
  var out = [];
  var combo = [];
  (function rec(start) {
    if (combo.length === k) { out.push(combo.slice()); return; }
    for (var i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      rec(i + 1);
      combo.pop();
    }
  })(0);
  return out;
}

function handName(score) { return HAND_NAMES[score[0]]; }

/* 电脑手牌强度 0~1（移植 poker.py cpu_strength） */
function cpuStrength(hole, board) {
  if (board.length === 0) {
    var r1 = pokerRank(hole[0]), r2 = pokerRank(hole[1]);
    var hi = Math.max(r1, r2), lo = Math.min(r1, r2);
    var pair = r1 === r2 ? 0.55 : 0.0;
    var suited = suitOf(hole[0]) === suitOf(hole[1]) ? 0.18 : 0.0;
    var connected = (hi - lo <= 2) ? 0.15 : 0.0;
    return Math.min(0.95, hi / 14 * 0.35 + pair + suited + connected);
  }
  var best = bestHand(hole.concat(board));
  var base = best.score[0] / 8.0;
  if (best.score[0] >= 7) return 1.0;
  if (best.score[0] === 6) return 0.9;
  if (best.score[0] >= 4) return base + 0.25;
  return Math.min(0.85, base + 0.12);
}

/* 电脑行动（自己主动轮）。h: {cur, cIn, allIn}（分）。返回 {type:'raise',amt} / {type:'call'} / {type:'fold'} */
function cpuRespond(h, strength, pot) {
  var need = h.cur - h.cIn;
  if (strength >= RAISE_THRESHOLD && !h.allIn) {
    var raiseAmt = Math.min(pot / 2, CPU_CHIPS - h.cIn);
    if (raiseAmt >= 100) return { type: "raise", amt: Math.round(raiseAmt) };
    return { type: "call" };
  }
  if (strength >= CALL_THRESHOLD) return { type: "call" };
  if (need > 50 && strength < 0.15) return { type: "fold" };
  return { type: "call" };
}

/* 玩家加注/全下后电脑响应 */
function cpuAfterRaise(strength) { return strength >= 0.4 ? "call" : "fold"; }

/* 访客（普通村民）温和 AI：加注门槛高、更怂 */
function cpuRespondGentle(h, strength, pot) {
  var need = h.cur - h.cIn;
  if (strength >= 0.7 && !h.allIn) {
    var amt = Math.min(pot / 2, CPU_CHIPS - h.cIn);
    if (amt >= 100) return { type: "raise", amt: Math.round(amt) };
    return { type: "call" };
  }
  if (strength >= 0.4) return { type: "call" };
  if (need > 50 && strength < 0.2) return { type: "fold" };
  return { type: "call" };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ANTE: ANTE, MAX_COMMIT: MAX_COMMIT, CPU_CHIPS: CPU_CHIPS,
    RAISE_THRESHOLD: RAISE_THRESHOLD, CALL_THRESHOLD: CALL_THRESHOLD,
    HAND_NAMES: HAND_NAMES,
    handScore: handScore, cmpScore: cmpScore, bestHand: bestHand,
    handName: handName, cpuStrength: cpuStrength,
    cpuRespond: cpuRespond, cpuAfterRaise: cpuAfterRaise, cpuRespondGentle: cpuRespondGentle,
    combinations: combinations,
  };
}
