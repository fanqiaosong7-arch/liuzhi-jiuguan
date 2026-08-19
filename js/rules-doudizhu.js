/* rules-doudizhu.js — 斗地主规则（移植 games/doudizhu.py：牌型判定/管牌/AI/结算） */
"use strict";

var DDZ_BASE_MAX = 3;      // 底分上限
var DDZ_MULT_MAX = 16;     // 倍数封顶
var DDZ_NAMES = ["你", "村民", "旅客"];

var DDZ_TYPE_NAMES = {
  single: "单张", pair: "对子", triple: "三张",
  triple1: "三带一", triple2: "三带二", straight: "顺子",
  chain_pair: "连对", plane: "飞机", plane1: "飞机带单",
  bomb: "炸弹", rocket: "王炸",
};

function ddzIsConsecutive(rs) {
  if (rs.length < 2) return false;
  for (var i = 1; i < rs.length; i++) if (rs[i] !== rs[0] + i) return false;
  return true;
}

/* 判定一组牌：返回 [type, mainRank, extra] 或 null（非法） */
function ddzClassify(cardsIn) {
  var n = cardsIn.length;
  if (n === 0) return null;
  var ranks = cardsIn.map(ddzRank).sort(function (a, b) { return b - a; });
  var counts = {};
  for (var i = 0; i < ranks.length; i++) counts[ranks[i]] = (counts[ranks[i]] || 0) + 1;
  var uniq = Object.keys(counts).map(Number).sort(function (a, b) { return a - b; });
  var values = Object.keys(counts).map(function (k) { return counts[k]; }).sort(function (a, b) { return a - b; });

  if (n === 2 && ranks.indexOf(16) >= 0 && ranks.indexOf(17) >= 0) return ["rocket", 99, 0];
  if (n === 4 && values.length === 1) return ["bomb", ranks[0], 0];
  if (n === 1) return ["single", ranks[0], 0];
  if (n === 2 && values.length === 1) return ["pair", ranks[0], 0];
  if (n === 3 && values.length === 1) return ["triple", ranks[0], 0];
  if (n === 4 && values.join(",") === "1,3") return ["triple1", tripleRank(counts), 0];
  if (n === 5 && values.join(",") === "2,3") return ["triple2", tripleRank(counts), 0];
  if (n >= 5 && Math.max.apply(null, ranks) <= 14 && uniq.length === n && ddzIsConsecutive(uniq))
    return ["straight", Math.max.apply(null, ranks), n];
  if (n >= 6 && n % 2 === 0 && Math.max.apply(null, ranks) <= 14 &&
      values.every(function (v) { return v === 2; }) && ddzIsConsecutive(uniq))
    return ["chain_pair", Math.max.apply(null, ranks), n];
  // 飞机：≥2 组三张连续，可带同数单张
  var trips = uniq.filter(function (r) { return counts[r] >= 3; });
  if (trips.length >= 2 && Math.max.apply(null, trips) <= 14 && ddzIsConsecutive(trips)) {
    var k = trips.length;
    var rest = n - 3 * k;
    if (rest === 0) return ["plane", Math.max.apply(null, trips), k];
    if (rest === k && uniq.filter(function (r) { return trips.indexOf(r) < 0; })
        .every(function (r) { return counts[r] === 1; }))
      return ["plane1", Math.max.apply(null, trips), k];
  }
  return null;
}

function tripleRank(counts) {
  for (var k in counts) if (counts[k] === 3) return Number(k);
  return 0;
}

/* 管牌判定：last 为 null 表示自由出牌 */
function ddzCanBeat(mine, last) {
  if (last === null) return true;
  var mt = mine[0];
  if (mt === "rocket") return true;
  if (last[0] === "rocket") return false;
  if (mt === "bomb") return last[0] !== "bomb" || mine[1] > last[1];
  if (mt !== last[0]) return false;
  return mine[1] > last[1] && mine[2] === last[2];
}

function ddzFmtType(t) { return DDZ_TYPE_NAMES[t[0]]; }
function ddzFmtPlay(cardsIn, t) {
  if (!cardsIn || !cardsIn.length) return "不出";
  return cardsIn.join(" ") + " (" + ddzFmtType(t) + ")";
}

/* 手牌粗略牌力（叫地主用） */
function ddzHandPower(hand) {
  var ranks = hand.map(ddzRank);
  var score = 0;
  score += 3 * ranks.filter(function (r) { return r === 17; }).length;
  score += 3 * ranks.filter(function (r) { return r === 16; }).length;
  score += 2 * ranks.filter(function (r) { return r === 15; }).length;
  var seen = {};
  ranks.forEach(function (r) {
    if (!seen[r]) { seen[r] = 0; }
    seen[r]++;
  });
  for (var k in seen) if (seen[k] === 4) score += 4;
  return score;
}

function ddzWantDizhu(hand) { return ddzHandPower(hand) >= 11; }

/* 生成候选出牌 [(cards数组, classify结果)] */
function ddzGenPlays(hand) {
  var result = [];
  var byRank = {};
  hand.forEach(function (c) {
    var r = ddzRank(c);
    if (!byRank[r]) byRank[r] = [];
    byRank[r].push(c);
  });
  var singles = Object.keys(byRank).map(Number).sort(function (a, b) { return a - b; });

  hand.forEach(function (c) { result.push([[c], ddzClassify([c])]); });
  singles.forEach(function (r) {
    if (byRank[r].length >= 2) result.push([byRank[r].slice(0, 2), ddzClassify(byRank[r].slice(0, 2))]);
  });
  singles.forEach(function (r) {
    if (byRank[r].length >= 3) {
      var t3 = byRank[r].slice(0, 3);
      result.push([t3, ddzClassify(t3)]);
      hand.forEach(function (c) {
        if (ddzRank(c) !== r) {
          var p = t3.concat([c]);
          result.push([p, ddzClassify(p)]);
        }
      });
      singles.forEach(function (r2) {
        if (r2 !== r && byRank[r2].length >= 2) {
          var p2 = t3.concat(byRank[r2].slice(0, 2));
          result.push([p2, ddzClassify(p2)]);
        }
      });
    }
  });
  // 顺子
  singles.forEach(function (start) {
    if (start > 14) return;
    for (var length = 5; length <= 12; length++) {
      var seg = [];
      for (var s = 0; s < length; s++) seg.push(start + s);
      if (seg[seg.length - 1] > 14) break;
      var ok = seg.every(function (r) { return byRank[r]; });
      if (!ok) continue;
      var p = seg.map(function (r) { return byRank[r][0]; });
      result.push([p, ddzClassify(p)]);
    }
  });
  // 连对
  var pairRanks = singles.filter(function (r) { return byRank[r].length >= 2; });
  pairRanks.forEach(function (start) {
    if (start > 14) return;
    for (var length = 3; length <= 7; length++) {
      var seg2 = [];
      for (var q = 0; q < length; q++) seg2.push(start + q);
      if (seg2[seg2.length - 1] > 14) break;
      var ok2 = seg2.every(function (r) { return byRank[r] && byRank[r].length >= 2; });
      if (!ok2) continue;
      var p2 = [];
      seg2.forEach(function (r) { p2.push(byRank[r][0], byRank[r][1]); });
      result.push([p2, ddzClassify(p2)]);
    }
  });
  // 炸弹/王炸
  singles.forEach(function (r) {
    if (byRank[r].length === 4) result.push([byRank[r], ddzClassify(byRank[r])]);
  });
  if (byRank[16] && byRank[17]) {
    var pj = [byRank[16][0], byRank[17][0]];
    result.push([pj, ddzClassify(pj)]);
  }
  // 去重
  var seen2 = {}, out = [];
  result.forEach(function (item) {
    var key = item[0].slice().sort().join("|");
    if (!seen2[key] && item[1] !== null) {
      seen2[key] = true;
      out.push(item);
    }
  });
  return out;
}

/* 电脑出牌决策（返回要出的牌数组 或 [] 过）
 * conservative=true 表示村民人设：自由出牌先小牌 */
function ddzAiPlay(hand, last, lastOwner, role, myRole, conservative) {
  var plays = ddzGenPlays(hand);
  if (last === null) {
    if (conservative) {
      // 村民：保守，先出最小单张/对子，不主动拆长牌
      var cands1 = plays.filter(function (p) { return p[1][0] === "single" || p[1][0] === "pair"; });
      if (cands1.length) return minPlay(cands1);
    }
    var pref = ["straight", "chain_pair", "triple", "triple1", "triple2", "plane", "plane1"];
    for (var i = 0; i < pref.length; i++) {
      var cands = plays.filter(function (p) { return p[1][0] === pref[i]; });
      if (cands.length) return minPlay(cands).slice();
    }
    var singles = plays.filter(function (p) { return p[1][0] === "single"; });
    if (singles.length) return minPlay(singles).slice();
    return [];
  }
  var beatable = plays.filter(function (p) { return ddzCanBeat(p[1], last); });
  if (beatable.length) return minPlay(beatable).slice();
  return [];
}

function minPlay(plays) {
  var best = null;
  plays.forEach(function (p) {
    if (best === null || p[1][1] < best[1][1]) best = p;
  });
  return best[0];
}

/* 结算（移植 doudizhu.py settle）：返回 {mult, spring, w, l, winnerIsDizhu, delta} */
function ddzCalcSettlement(winner, dizhu, base, bombMult, playedCount) {
  var mult = Math.min(DDZ_MULT_MAX, Math.pow(2, bombMult));
  var losers = [0, 1, 2].filter(function (i) { return i !== winner; });
  var spring = losers.length === 2 && losers.every(function (i) { return playedCount[i] === 0; });
  if (spring) mult = Math.min(DDZ_MULT_MAX, mult * 2);
  var winnerIsDizhu = winner === dizhu;
  var w, l;
  if (winnerIsDizhu) { w = 2 * base * mult; l = base * mult; }
  else { w = base * mult; l = 2 * base * mult; }
  return { mult: mult, spring: spring, w: w, l: l, winnerIsDizhu: winnerIsDizhu };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DDZ_BASE_MAX: DDZ_BASE_MAX, DDZ_MULT_MAX: DDZ_MULT_MAX, DDZ_NAMES: DDZ_NAMES,
    DDZ_TYPE_NAMES: DDZ_TYPE_NAMES,
    ddzIsConsecutive: ddzIsConsecutive, ddzClassify: ddzClassify,
    ddzCanBeat: ddzCanBeat, ddzFmtType: ddzFmtType, ddzFmtPlay: ddzFmtPlay,
    ddzHandPower: ddzHandPower, ddzWantDizhu: ddzWantDizhu,
    ddzGenPlays: ddzGenPlays, ddzAiPlay: ddzAiPlay,
    ddzCalcSettlement: ddzCalcSettlement,
  };
}
