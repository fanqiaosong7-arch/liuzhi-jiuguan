/* rules-cards.js — 扑克工具（移植 core/cards.py）
 * 牌面格式 "10♠"；大小王 "小王"/"大王"（斗地主预留）。 */
"use strict";

var SUITS = ["♠", "♥", "♦", "♣"];
var RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
var HIDDEN = "🂠";

function makeDeck() {
  var d = [];
  for (var s = 0; s < SUITS.length; s++) {
    for (var r = 0; r < RANKS.length; r++) d.push(RANKS[r] + SUITS[s]);
  }
  return d;
}

function makeDdzDeck() { return makeDeck().concat(["小王", "大王"]); }

function suitOf(card) {
  if (card === "小王" || card === "大王") return "王";
  return card.charAt(card.length - 1);
}

function rankOf(card) { return card.slice(0, -1); }

function blackjackValue(card) {
  var rank = rankOf(card);
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  if (rank === "A") return 11;
  return parseInt(rank, 10);
}

function handValue(hand) {
  var total = 0, aces = 0, i;
  for (i = 0; i < hand.length; i++) {
    total += blackjackValue(hand[i]);
    if (rankOf(hand[i]) === "A") aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isBlackjack(hand) { return hand.length === 2 && handValue(hand) === 21; }

function isSoft(hand) {
  var hasA = false, total = 0, i;
  for (i = 0; i < hand.length; i++) {
    if (rankOf(hand[i]) === "A") hasA = true;
    total += blackjackValue(hand[i]);
  }
  return hasA && total <= 21;
}

function pokerRank(card) {
  var rank = rankOf(card);
  var map = { A: 14, K: 13, Q: 12, J: 11 };
  return map[rank] || parseInt(rank, 10);
}

function ddzRank(card) {
  if (card === "大王") return 17;
  if (card === "小王") return 16;
  var rank = rankOf(card);
  var map = { "2": 15, A: 14, K: 13, Q: 12, J: 11 };
  return map[rank] || parseInt(rank, 10);
}

function shuffle(deck) {
  for (var i = deck.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = deck[i]; deck[i] = deck[j]; deck[j] = t;
  }
  return deck;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SUITS: SUITS, RANKS: RANKS, HIDDEN: HIDDEN,
    makeDeck: makeDeck, makeDdzDeck: makeDdzDeck,
    suitOf: suitOf, rankOf: rankOf,
    blackjackValue: blackjackValue, handValue: handValue,
    isBlackjack: isBlackjack, isSoft: isSoft,
    pokerRank: pokerRank, ddzRank: ddzRank, shuffle: shuffle,
  };
}
