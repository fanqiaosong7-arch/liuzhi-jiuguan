/* rules-blackjack.js — 21点规则（移植 games/blackjack.py 的结算逻辑） */
"use strict";

var BLACKJACK_PAY = 1.5;

var BJ_DIFFICULTIES = {
  easy:     { name: "简单", stand: 16, hitSoft17: false },
  standard: { name: "标准", stand: 17, hitSoft17: false },
  hard:     { name: "困难", stand: 18, hitSoft17: true },
};

/* 庄家是否继续要牌（移植 blackjack.py 主循环判定） */
function dealerShouldHit(total, soft, diff) {
  return total < diff.stand || (diff.hitSoft17 && total === 17 && soft);
}

/* 结算一手 vs 庄家手牌，返回净额（美元，与 Python 版一致） */
function resolveHand(pHand, bet, isSplit, dHand) {
  var pv = handValue(pHand);
  if (!isSplit && isBlackjack(pHand)) return bet * BLACKJACK_PAY;
  if (pv > 21) return -bet;
  var dv = handValue(dHand);
  if (dv > 21) return bet;
  if (dv > pv) return -bet;
  if (pv > dv) return bet;
  return 0.0;
}

/* 一手的结果文本（UI 用）：返回 {label, style} */
function handResultText(pHand, bet, isSplit, dHand) {
  var pv = handValue(pHand), dv = handValue(dHand);
  if (!isSplit && isBlackjack(pHand)) return { label: "★ 黑杰克! +$" + (bet * BLACKJACK_PAY).toFixed(2), style: "win" };
  if (pv > 21) return { label: "✗ 爆牌! 输 $" + bet.toFixed(2), style: "lose" };
  if (dv > 21) return { label: "✓ 老板爆牌! 赢 $" + bet.toFixed(2), style: "win" };
  if (dv > pv) return { label: "✗ " + pv + " < 老板 " + dv + "，输 $" + bet.toFixed(2), style: "lose" };
  if (pv > dv) return { label: "✓ " + pv + " > 老板 " + dv + "，赢 $" + bet.toFixed(2), style: "win" };
  return { label: "＝ " + pv + " = " + dv + "，平局", style: "push" };
}

/* 一局结算：整手牌（含分牌/保险），移植 blackjack.py 的结算段。
 * 返回 { net, mainNet, insPnl, result, reason } */
function settleRound(playerHands, playerBets, insurance, dHand) {
  var mainNet = 0, i;
  for (i = 0; i < playerHands.length; i++) {
    var isSplit = playerHands.length > 1;
    mainNet += resolveHand(playerHands[i], playerBets[i], isSplit, dHand);
  }
  var insPnl = -insurance; // 庄家未黑杰克时保险作废（黑杰克分支在 UI 层处理）
  var net = mainNet + insPnl;
  var result, reason;
  var isSplit = playerHands.length > 1;
  if (net > 1e-9) {
    result = (!isSplit && isBlackjack(playerHands[0]) && !isBlackjack(dHand)) ? "win_bj" : "win";
    reason = result === "win_bj" ? "黑杰克" : "赢";
  }
  else if (net < -1e-9) { result = "lose"; reason = "输"; }
  else { result = "push"; reason = "平局"; }
  return { net: net, mainNet: mainNet, insPnl: insPnl, result: result, reason: reason };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    BLACKJACK_PAY: BLACKJACK_PAY,
    BJ_DIFFICULTIES: BJ_DIFFICULTIES,
    dealerShouldHit: dealerShouldHit,
    resolveHand: resolveHand,
    handResultText: handResultText,
    settleRound: settleRound,
  };
}
