/* game-uno.js — UNO 桌（玩家 + 3 位 NPC；底注 $1，先清空手牌者赢走 $4 底池）
 * 规则：出牌需匹配台面颜色或数字/符号；跳=跳过下家、转=反转方向、+2=下家罚抽2、万能=换色、+4=换色且下家罚抽4。
 * 金额单位：内部一律「分」；入场费 $1 直扣（作弊不退），赢家底池走 settleBet（作弊照加）。 */
"use strict";

var UNO_COLORS = ["红", "黄", "绿", "蓝"];
var UNO_FUNC = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "跳", "转", "+2"];

/* 108 张：每色 0×1 + 其余 ×2；万能 ×4、+4 ×4 */
function unoMakeDeck() {
  var d = [];
  UNO_COLORS.forEach(function (c) {
    d.push({ c: c, v: "0" });
    UNO_FUNC.forEach(function (v) { d.push({ c: c, v: v }, { c: c, v: v }); });
  });
  for (var i = 0; i < 4; i++) { d.push({ c: "", v: "万能" }); d.push({ c: "", v: "+4" }); }
  return d;
}

/* 能否打出该牌 */
function unoCanPlay(card, curColor, curValue) {
  if (card.v === "万能" || card.v === "+4") return true;
  return card.c === curColor || card.v === curValue;
}

/* 显示文本 */
function unoFmt(card) { return (card.c ? card.c : "★") + card.v; }

var UnoGame = {
  w: null, stats: null,
  deck: [], discard: [],
  hands: [[], [], [], []],
  seats: [], turn: 0, dir: 1,
  curColor: "", curValue: "",
  skipNext: false, _res: null,
  logs: [], quit: false, midQuit: false,

  start: function () {
    if (typeof G !== "undefined" && G.canGamble && !G.canGamble()) return;
    cheatReset();
    this.w = Wallet.load();
    this.stats = this.w.statsFor("uno");
    this.newRound();
  },

  /* 开新一局 */
  newRound: function () {
    var self = this;
    this.quit = false; this.midQuit = false;
    this._res = null; this.skipNext = false; this.dir = 1;
    // 座位：你 + 3 位（优先当天大厅访客，不足补常客）
    var names = [];
    var p = GS.load(this.w);
    (p.visitors || []).forEach(function (id) {
      var v = GS.visitorById(id);
      if (v && names.length < 3 && names.indexOf(v.name) < 0) names.push(v.name);
    });
    ["村民", "旅客", "醉汉"].forEach(function (n) {
      if (names.length < 3 && names.indexOf(n) < 0) names.push(n);
    });
    this.seats = [{ who: "p", name: GS.playerName(p) }];
    names.forEach(function (n) { self.seats.push({ who: "npc", name: n }); });
    // 发牌：每人 7 张
    this.deck = shuffle(unoMakeDeck());
    this.hands = [[], [], [], []];
    for (var i = 0; i < 7; i++) for (var s = 0; s < 4; s++) this.hands[s].push(this.deck.pop());
    // 起牌（功能牌做台面太麻烦，翻到普通牌为止）
    this.discard = [];
    var first;
    do { first = this.deck.pop(); } while (first.v === "万能" || first.v === "+4");
    this.discard.push(first);
    this.curColor = first.c; this.curValue = first.v;
    this.turn = 0;
    this.logs = ["开局台面：" + unoFmt(first) + "。先清完手牌者赢走 $4 底池。"];
    // 入场费 $1（直扣；作弊不退，赢家底池照加）
    this.w.settle(-1, "uno", "UNO 入场费");
    this.w.save();
    this.updateHud();
    this.playHand();
  },

  /* 抽牌堆空了：把弃牌（留顶牌）洗回抽牌堆 */
  refillDeck: function () {
    var top = this.discard.pop();
    this.deck = shuffle(this.discard);
    this.discard = top ? [top] : [];
    this.logs.push("抽牌堆空了，弃牌重新洗回。");
    if (!this.deck.length) return { c: "", v: "万能" };   // 理论到不了，兜底
    return this.deck.pop();
  },

  /* 主循环 */
  playHand: async function () {
    var self = this;
    var winner = -1;
    while (winner < 0 && !this.quit) {
      this.render();
      if (this.turn === 0) {
        var act = await this.playerTurn();
        if (this.quit) return this.exit();
        if (act.pass) {
          this.logs.push("你过牌。");
          this.turn = this.nextTurn();
        } else {
          this.applyCard(0, act.card, act.color);
          if (!this.hands[0].length) winner = 0;
          else this.turn = this.nextTurn();
        }
      } else {
        await this.npcTurn(this.turn);
        if (this.quit) return this.exit();
        if (!this.hands[this.turn].length) winner = this.turn;
        else this.turn = this.nextTurn();
      }
    }
    if (winner >= 0 && !this.quit) this.settle(winner);
  },

  /* 下一家（跳过的玩家被跳开） */
  nextTurn: function () {
    var n = (this.turn + this.dir + 4) % 4;
    if (this.skipNext) { n = (n + this.dir + 4) % 4; this.skipNext = false; }
    return n;
  },

  /* 出牌：结算功能牌效果 */
  applyCard: function (who, card, color) {
    var idx = this.hands[who].indexOf(card);
    if (idx >= 0) this.hands[who].splice(idx, 1);
    this.discard.push(card);
    this.curColor = card.c || color;
    this.curValue = card.v;
    var nm = who === 0 ? "你" : this.seats[who].name;
    this.logs.push(nm + " 出了 " + unoFmt(card) + (card.c ? "" : "（改" + color + "）") + "。");
    if (card.v === "转") { this.dir *= -1; this.logs.push("方向反了！"); return; }
    if (card.v === "跳") { this.skipNext = true; this.logs.push("下一个玩家被跳过。"); return; }
    if (card.v === "+2" || card.v === "+4") {
      var target = (who + this.dir + 4) % 4;
      this.giveCards(target, card.v === "+2" ? 2 : 4);
      this.skipNext = true;
      this.logs.push((target === 0 ? "你" : this.seats[target].name) + " 被罚抽 " + (card.v === "+2" ? 2 : 4) + " 张，跳过回合。");
    }
  },

  giveCards: function (seat, n) {
    for (var i = 0; i < n; i++) this.hands[seat].push(this.deck.length ? this.deck.pop() : this.refillDeck());
  },

  /* ---------- 玩家回合 ---------- */
  playerTurn: function () {
    var self = this;
    return new Promise(function (res) { self._res = res; });
  },

  resolvePlayer: function (result) {
    if (this._res) { var r = this._res; this._res = null; r(result); }
  },

  /* 万能牌选色 */
  chooseWildColor: function (card, cb) {
    var self = this;
    if (card.c) { cb(""); return; }
    var act = UI.overlay.querySelector("#uno-actions");
    if (!act) { cb(UNO_COLORS[0]); return; }
    act.innerHTML = '<span class="flavor">选颜色：</span>' +
      UNO_COLORS.map(function (c) {
        return '<button class="pix-btn uno-color" data-color="' + c + '" style="background:' +
          self.colorCSS(c) + ';color:#000">' + c + '</button>';
      }).join("") +
      '<button class="pix-btn danger" id="uno-wild-cancel">取消</button>';
    UNO_COLORS.forEach(function (c) {
      var b = act.querySelector('[data-color="' + c + '"]');
      if (b) b.addEventListener("click", function () { cb(c); });
    });
    var cancel = act.querySelector("#uno-wild-cancel");
    if (cancel) cancel.addEventListener("click", function () { self.render(); });
  },

  /* ---------- NPC 回合 ---------- */
  npcTurn: function (seat) {
    var self = this;
    return new Promise(function (res) {
      setTimeout(function () {
        var hand = self.hands[seat];
        var legal = hand.filter(function (c) { return unoCanPlay(c, self.curColor, self.curValue); });
        if (legal.length) {
          // AI：优先出普通牌（数字/功能），万能与 +4 留在最后
          var normal = legal.filter(function (c) { return c.c !== ""; });
          var card = (normal.length ? normal : legal)[0];
          var color = card.c || UNO_COLORS[Math.floor(Math.random() * 4)];
          self.applyCard(seat, card, color);
        } else {
          // 抽一张，能出就出，不能出过
          var c = self.deck.length ? self.deck.pop() : self.refillDeck();
          self.hands[seat].push(c);
          if (unoCanPlay(c, self.curColor, self.curValue)) {
            var col2 = c.c || UNO_COLORS[Math.floor(Math.random() * 4)];
            self.applyCard(seat, c, col2);
          } else {
            self.logs.push(self.seats[seat].name + " 抽了一张牌，没得打，过。");
          }
        }
        res();
      }, 650);
    });
  },

  /* ---------- 渲染 ---------- */
  render: function () {
    var self = this;
    var turnName = this.turn === 0 ? "你" : this.seats[this.turn].name;
    var curCss = this.colorCSS(this.curColor);
    var html = '<div class="panel game-screen"><h2>🎴 UNO · 底注 $1</h2>' +
      '<div class="table-line">台面：<b style="color:' + curCss + '">' + this.curColor + ' ' + this.curValue +
      '</b> ｜ 方向 ' + (this.dir > 0 ? "→" : "←") + ' ｜ 轮到：' + turnName + '</div>';
    for (var s = 1; s < 4; s++) {
      html += '<div class="table-line">' + this.seats[s].name + '：<b>' + this.hands[s].length + '</b> 张</div>';
    }
    html += '<div class="table-line" style="color:var(--dim)">你的手牌（' + this.hands[0].length + ' 张）——点牌出，点「抽牌」摸牌：</div>';
    html += '<div class="cards">';
    this.hands[0].forEach(function (c, i) {
      var legal = unoCanPlay(c, self.curColor, self.curValue);
      html += '<button class="pix-btn uno-card' + (legal ? "" : " uno-dim") + '" data-i="' + i +
        '" style="background:' + (c.c ? self.colorCSS(c.c) : "linear-gradient(135deg,#cfd3d8,#8b9096)") +
        ';color:#000;' + (legal ? "" : "opacity:.5") + '">' + unoFmt(c) + '</button>';
    });
    html += '</div>';
    html += '<div class="table-line" id="uno-log" style="min-height:18px">' + this.logs[this.logs.length - 1] + '</div>';
    html += '<div class="actions" id="uno-actions">' +
      '<button class="pix-btn" id="uno-draw">抽牌</button>' +
      '<button class="pix-btn danger" id="uno-quit">退出</button></div></div>';
    UI.open(html);
    // 手牌点击
    UI.overlay.querySelectorAll(".uno-card").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var i = +btn.getAttribute("data-i");
        var card = self.hands[0][i];
        if (!card) return;
        if (!unoCanPlay(card, self.curColor, self.curValue)) {
          self.logs.push("这张打不了，要 " + self.curColor + " 色或 " + self.curValue + "。");
          self.render();
          return;
        }
        self.chooseWildColor(card, function (color) { self.resolvePlayer({ card: card, color: color }); });
      });
    });
    // 抽牌
    this.bind("#uno-draw", function () {
      if (self.turn !== 0 || self._res === null) return;   // 非玩家回合点了没用
      var c = self.deck.length ? self.deck.pop() : self.refillDeck();
      self.hands[0].push(c);
      self.logs.push("你抽了一张牌。");
      self.render();
      if (unoCanPlay(c, self.curColor, self.curValue)) {
        var act = UI.overlay.querySelector("#uno-actions");
        if (act) {
          act.innerHTML = '<button class="pix-btn" id="uno-play-drawn">出刚抽的</button>' +
            '<button class="pix-btn" id="uno-pass">过</button>' +
            '<button class="pix-btn danger" id="uno-quit">退出</button>';
        }
        self.bind("#uno-play-drawn", function () {
          self.chooseWildColor(c, function (color) { self.resolvePlayer({ card: c, color: color }); });
        });
        self.bind("#uno-pass", function () { self.resolvePlayer({ pass: true }); });
        self.bind("#uno-quit", function () { self.midQuit = true; self.quit = true; self.resolvePlayer({ quit: true }); });
      } else {
        self.resolvePlayer({ pass: true });
      }
    });
    // 退出
    this.bind("#uno-quit", function () { self.midQuit = true; self.quit = true; self.resolvePlayer({ quit: true }); });
  },

  /* ---------- 结算 / 退出 ---------- */
  settle: function (winnerIdx) {
    var self = this;
    var nm = winnerIdx === 0 ? "你" : this.seats[winnerIdx].name;
    var d = 0;
    if (winnerIdx === 0) {
      d = GS.settleBet(this.w, 4, "uno", "UNO 获胜");
      this.stats.record("win", 100, ["UNO"], d);
      this.mood(d);
    } else {
      this.stats.record("lose", 100, ["UNO"], -100);
      this.mood(-100);
    }
    this.w.save();
    this.updateHud();
    var rows = '<p class="flavor">' + nm + ' 率先出完了手牌，赢走 $4 底池！</p>' +
      '<div class="row"><span>你</span><span>' + (winnerIdx === 0 ? "🎉 赢了 " + G.fmtCents(d, true) : "输掉入场费 $1") + '</span></div>' +
      '<div class="row"><span>本局同桌</span><span>' + this.seats.slice(1).map(function (s) { return s.name; }).join("、") + '</span></div>';
    UI.open('<div class="panel"><h2>🎴 UNO 结束</h2>' + rows +
      '<div class="actions"><button class="pix-btn" id="uno-again">再来一局</button>' +
      '<button class="pix-btn" id="uno-back">回酒馆</button></div></div>');
    this.bind("#uno-again", function () { self.newRound(); });
    this.bind("#uno-back", function () {
      UI.close();
      if (typeof G !== "undefined" && G.afterLeaveGame) G.afterLeaveGame();
    });
  },

  exit: function () {
    if (this.midQuit && this.hands && this.hands.length) {
      this.stats.record("lose", 100, ["中途退出"], -100);
      this.mood(-100);
    }
    this.w.save();
    UI.close();
    if (typeof G !== "undefined" && G.afterLeaveGame) G.afterLeaveGame();
  },

  mood: function (netCents) {
    if (typeof GS !== "undefined" && GS.state) GS.addMood(GS.state, GS.moodDeltaForBet(netCents));
  },

  updateHud: function () {
    if (typeof UI !== "undefined" && UI.updateHud) UI.updateHud();
  },

  bind: function (sel, fn) {
    var el = UI.overlay.querySelector(sel);
    if (el) el.addEventListener("click", fn);
  },

  colorCSS: function (c) {
    return { 红: "#e5523f", 黄: "#f0c33e", 绿: "#43a047", 蓝: "#3f7ae5" }[c] || "#9aa0a6";
  },
};
