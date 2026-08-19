/* game-doudizhu.js — 斗地主（移植 games/doudizhu.py：1玩家+2电脑、叫地主、11类牌型、倍数封顶×16）
 * 选牌：点击手牌卡片选中/取消，出牌/过/提示/退出按钮。 */
"use strict";

var DDZGame = {
  w: null, stats: null,
  deck: [],
  hands: [], bottom: [], dizhu: -1, base: 1,
  turn: 0, lastPlay: null, lastOwner: -1, passStreak: 0,
  bombMult: 0, playedCount: [], sel: [],
  quit: false,

  start: function () {
    if (typeof G !== "undefined" && G.canGamble && !G.canGamble()) return;
    cheatReset();
    this.w = Wallet.load();
    this.stats = this.w.statsFor("doudizhu");
    this.deck = shuffle(makeDdzDeck());
    this.baseScreen();
  },

  exit: function () {
    // 中途退出 = 离桌认输：扣底分（叫地主前退出不扣）
    if (this.midQuit && this.dizhu >= 0 && this.base > 0) {
      var d = GS.settleBet(this.w, -this.base, "doudizhu", "中途退出");
      this.stats.record("lose", this.base * 100, [], d);
      this.mood(d);
    }
    this.w.save();
    UI.close();
    if (typeof G !== "undefined" && G.afterLeaveGame) G.afterLeaveGame();
  },

  mood: function (netCents) {
    if (typeof GS !== "undefined" && GS.state) GS.addMood(GS.state, GS.moodDeltaForBet(netCents));
  },

  /* ---------- 界面 ---------- */
    winRemainHtml: function (gameKey) {
    if (typeof GS === "undefined" || !GS.state) return "";
    var remain = GS.winRemain(GS.state, gameKey);
    if (remain === null) return "";
    if (remain <= 0) return ' <span style="color:var(--red)">｜ 今日已赢够，明天再来</span>';
    return ' ｜ 今日还能赢 ' + G.fmtCents(remain);
  },
  header: function () {
    return '<div class="table-line">钱包 ' + UI.moneySpan(this.w.balanceCents()) +
      this.winRemainHtml("doudizhu") + ' ｜ 底分 ' + this.base + ' ｜ 倍数 ' + Math.min(DDZ_MULT_MAX, Math.pow(2, this.bombMult)) +
      (cheatActive() ? ' ｜ <span style="color:var(--dim)">(有人睁一只眼闭一只眼)</span>' : '') + '</div>';
  },

  openScreen: function (body, actions) {
    var html = '<div class="panel game-screen"><h2>♠ 斗地主 · 村民·旅客 ♠</h2>' + this.header() +
      '<div id="ddz-log"></div>' + body + '<div class="actions">' + actions + '</div></div>';
    UI.open(html);
    this.renderLog();
  },

  bind: function (sel, fn) {
    var el = UI.overlay.querySelector(sel);
    if (el) el.addEventListener("click", fn);
  },

  log: function (text, cls) {
    var el = document.getElementById("ddz-log");
    if (el) {
      var line = document.createElement("div");
      line.className = "table-line";
      line.style.color = cls || "var(--dim)";
      line.textContent = text;
      el.appendChild(line);
      el.scrollTop = el.scrollHeight;
    }
  },

  renderLog: function () {
    var el = document.getElementById("ddz-log");
    if (!el) return;
    var lines = this._logLines || [];
    el.innerHTML = "";
    for (var i = 0; i < lines.length; i++) {
      var line = document.createElement("div");
      line.className = "table-line";
      line.style.color = lines[i].cls || "var(--dim)";
      line.textContent = lines[i].text;
      el.appendChild(line);
    }
    el.scrollTop = el.scrollHeight;
  },

  addLog: function (text, cls) {
    if (!this._logLines) this._logLines = [];
    this._logLines.push({ text: text, cls: cls });
    this.renderLog();
  },

  /* ---------- 底分选择 ---------- */
  baseScreen: function () {
    var self = this;
    this._logLines = [];
    this.openScreen(
      '<p class="flavor">村民和旅客已经坐下，等你定底分（输赢 = 底分 × 倍数，炸弹×2、春天×2，封顶×16）。</p>',
      (this.w.balanceCents() < 0
        ? '<p class="flavor" style="color:var(--red)">账上还欠着钱，只能玩底分 1 的局。</p>'
        : '<button class="pix-btn" data-base="2">底分 2</button><button class="pix-btn" data-base="3">底分 3</button>') +
      '<button class="pix-btn" data-base="1">底分 1</button>' +
      '<button class="pix-btn danger" id="ddz-quit">离开牌桌</button>'
    );
    [1, 2, 3].forEach(function (b) {
      self.bind('[data-base="' + b + '"]', function () { self.playHand(b); });
    });
    this.bind("#ddz-quit", function () { self.exit(); });
  },

  /* ---------- 一局 ---------- */
  playHand: async function (base) {
    var self = this;
    this.quit = false;
    this.midQuit = false;
    this.base = base;
    this._logLines = [];
    this.deck = shuffle(makeDdzDeck());
    this.hands = [this.deck.slice(0, 17), this.deck.slice(17, 34), this.deck.slice(34, 51)];
    this.bottom = this.deck.slice(51);
    this.playedCount = [0, 0, 0];
    this.bombMult = 0;
    this.passStreak = 0;
    this.lastPlay = null;
    this.lastOwner = -1;
    this.sel = [];

    // 玩家手牌排序（从大到小）
    this.hands[0].sort(function (a, b) { return ddzRank(b) - ddzRank(a); });

    this.openScreen('<div id="ddz-board"></div>', "");
    this.renderBoard();
    this.addLog("发牌完毕。", "var(--gold)");

    // 叫地主
    var order = [0, 1, 2];
    var found = null;
    for (var i = 0; i < order.length; i++) {
      var idx = order[i];
      var want = false;
      if (idx === 0) {
        want = await this.askBid();
        if (this.quit) return this.exit();
      } else {
        want = ddzWantDizhu(this.hands[idx]);
      }
      if (want) { found = idx; this.addLog("★ " + DDZ_NAMES[idx] + " 叫地主!", "var(--gold)"); break; }
    }
    if (found === null) {
      var best = 0;
      for (var k = 1; k < 3; k++) if (ddzHandPower(this.hands[k]) > ddzHandPower(this.hands[best])) best = k;
      found = best;
      this.addLog("无人叫地主，牌力最强的 " + DDZ_NAMES[best] + " 当地主。");
    }
    this.dizhu = found;
    this.hands[found] = this.hands[found].concat(this.bottom);
    if (found === 0) {
      this.hands[0].sort(function (a, b) { return ddzRank(b) - ddzRank(a); });
      this.addLog("★ 你是地主! 底牌: " + this.bottom.join(" "), "var(--gold)");
    } else {
      this.addLog("地主是 " + DDZ_NAMES[found] + "，底牌: " + this.bottom.join(" "));
    }

    // 游戏循环
    this.turn = found;
    var winner = -1;
    while (winner < 0) {
      if (this.quit) return this.exit();
      var h = this.hands[this.turn];
      var canPass = this.lastPlay !== null;
      if (this.turn === 0) {
        this.sel = [];
        var acted = await this.playerTurn(canPass);
        if (this.quit) return this.exit();
        if (acted === "pass") {
          this.addLog("你不出。");
          this.passStreak++;
        } else {
          this.applyPlay(0, acted.cards, acted.type);
        }
      } else {
        this.renderBoard();
        this.addLog(DDZ_NAMES[this.turn] + " 思考中……");
        await sleep(650);
        if (this.quit) return this.exit();
        var sel2 = ddzAiPlay(h, this.lastPlay ? this.lastPlay.type : null, this.lastOwner,
          this.turn === this.dizhu ? "dizhu" : "nongmin",
          this.dizhu === 0 ? "dizhu" : "nongmin",
          this.turn === 1);
        if (!sel2.length) {
          this.addLog(DDZ_NAMES[this.turn] + " 不出。");
          this.passStreak++;
        } else {
          this.applyPlay(this.turn, sel2, ddzClassify(sel2));
        }
      }
      this.renderBoard();
      if (!this.hands[this.turn].length) winner = this.turn;
      if (winner < 0 && this.passStreak >= 2) {
        this.lastPlay = null; this.lastOwner = -1; this.passStreak = 0;
      }
      this.turn = (this.turn + 1) % 3;
    }
    this.settle(winner);
  },

  applyPlay: function (who, cards, type) {
    var self = this;
    cards.forEach(function (c) {
      var i = self.hands[who].indexOf(c);
      if (i >= 0) self.hands[who].splice(i, 1);
    });
    if (who === 0) this.sel = [];   // 玩家出牌后清空选牌索引，防止 renderHand 用旧索引取牌崩溃
    if (type[0] === "bomb" || type[0] === "rocket") this.bombMult++;
    this.playedCount[who] += cards.length;
    this.lastPlay = { cards: cards, type: type };
    this.lastOwner = who;
    this.passStreak = 0;
    this.addLog(DDZ_NAMES[who] + " 出了: " + ddzFmtPlay(cards, type), who === 0 ? "var(--gold)" : "var(--cyan)");
  },

  /* 玩家回合：返回 {cards, type} / 'pass' / null(退出) */
  playerTurn: function (canPass) {
    var self = this;
    return new Promise(function (res) {
      self.renderBoard();
      self.renderHand();
      var actions = '<button class="pix-btn" id="ddz-play">出牌</button>' +
        (canPass ? '<button class="pix-btn" id="ddz-pass">不出</button>' : '') +
        '<button class="pix-btn" id="ddz-clear">清空</button>' +
        '<button class="pix-btn" id="ddz-hint">提示</button>' +
        '<button class="pix-btn danger" id="ddz-quit">退出</button>';
      var act = document.querySelector(".actions");
      if (act) act.innerHTML = actions;
      self.bind("#ddz-play", function () {
        var cards = self.sel.map(function (i) { return self.hands[0][i]; });
        if (!cards.length) { self.addLog("先选几张牌。", "var(--red)"); return; }
        var t = ddzClassify(cards);
        if (!t) { self.addLog("这不是合法牌型。", "var(--red)"); return; }
        if (self.lastPlay && !ddzCanBeat(t, self.lastPlay.type)) {
          self.addLog("管不住上家的 " + ddzFmtType(self.lastPlay.type) + "。", "var(--red)");
          return;
        }
        res({ cards: cards, type: t });
      });
      self.bind("#ddz-pass", function () { res("pass"); });
      self.bind("#ddz-clear", function () {
        self.sel = [];
        self.renderBoard();
        self.renderHand();
      });
      self.bind("#ddz-hint", function () {
        var plays = ddzGenPlays(self.hands[0]);
        var cands = self.lastPlay ? plays.filter(function (p) { return ddzCanBeat(p[1], self.lastPlay.type); }) : plays;
        if (!cands.length) { self.addLog("提示：只能不出。"); return; }
        var best = null;
        cands.forEach(function (p) { if (best === null || p[1][1] < best[1][1]) best = p; });
        self.sel = best[0].map(function (c) { return self.hands[0].indexOf(c); });
        self.renderHand();
        self.addLog("提示：可出 " + best[0].join(" "));
      });
      self.bind("#ddz-quit", function () { self.quit = true; self.midQuit = true; res(null); });
    });
  },

  askBid: function () {
    var self = this;
    return new Promise(function (res) {
      self.renderBoard();
      var act = document.querySelector(".actions");
      if (act) {
        act.innerHTML = '<button class="pix-btn" id="ddz-bid-y">要地主</button>' +
          '<button class="pix-btn" id="ddz-bid-n">不要</button>';
      }
      self.bind("#ddz-bid-y", function () { res(true); });
      self.bind("#ddz-bid-n", function () { res(false); });
    });
  },

  /* ---------- 渲染 ---------- */
  renderBoard: function () {
    var el = document.getElementById("ddz-board");
    if (!el) return;
    var s = '';
    if (this.lastPlay && this.lastOwner >= 0) {
      s += '<div class="table-line"><b>' + DDZ_NAMES[this.lastOwner] + '</b> 出: ' +
        ddzFmtPlay(this.lastPlay.cards, this.lastPlay.type) + '</div>';
    }
    s += '<div class="table-line">' + DDZ_NAMES[1] + ': <b>' + this.hands[1].length + '</b> 张 ｜ ' +
      DDZ_NAMES[2] + ': <b>' + this.hands[2].length + '</b> 张 ｜ 地主: ' +
      (this.dizhu >= 0 ? DDZ_NAMES[this.dizhu] : "？") + '</div>';
    s += '<div id="ddz-selinfo" class="table-line" style="min-height:20px"></div>';
    s += '<div id="ddz-hand" class="cards"></div>';
    el.innerHTML = s;
    this.renderHand();
    // 手牌选牌：事件委托绑在容器上（renderHand 重刷内层时监听不丢）
    var self = this;
    var handEl = document.getElementById("ddz-hand");
    if (handEl) {
      handEl.addEventListener("click", function (e) {
        var t = e.target;
        while (t && t !== handEl && !t.getAttribute("data-i")) t = t.parentNode;
        if (!t || t === handEl) return;
        var i = Number(t.getAttribute("data-i"));
        var pos = self.sel.indexOf(i);
        if (pos >= 0) self.sel.splice(pos, 1);
        else self.sel.push(i);
        self.renderHand();
      });
    }
  },

  renderHand: function () {
    var self = this;
    var el = document.getElementById("ddz-hand");
    if (!el) return;
    var s = '';
    for (var i = 0; i < this.hands[0].length; i++) {
      var card = this.hands[0][i];
      var red = card.indexOf("♥") >= 0 || card.indexOf("♦") >= 0;
      var isSel = this.sel.indexOf(i) >= 0;
      s += '<span class="pcard ' + (red ? "red" : "") + (isSel ? " sel" : "") + '" data-i="' + i + '">' +
        card.slice(0, -1) + '<span class="suit">' + card.slice(-1) + '</span></span>';
    }
    el.innerHTML = s;
    // 实时牌型提示（手机上选牌不盲点）
    var info = document.getElementById("ddz-selinfo");
    if (info) {
      var cards = this.sel.map(function (i) { return self.hands[0][i]; });
      if (!cards.length) info.textContent = "";
      else {
        var t = ddzClassify(cards);
        var canBeatText = "";
        if (t && this.lastPlay && !ddzCanBeat(t, this.lastPlay.type)) canBeatText = "（管不住上家）";
        info.textContent = "已选 " + cards.length + " 张" + (t ? " → " + ddzFmtType(t) + canBeatText : "（不是合法牌型）");
        info.style.color = t && (!this.lastPlay || ddzCanBeat(t, this.lastPlay.type)) ? "var(--green)" : "var(--red)";
      }
    }
  },

  /* ---------- 结算 ---------- */
  settle: function (winner) {
    var self = this;
    var res = ddzCalcSettlement(winner, this.dizhu, this.base, this.bombMult, this.playedCount);
    var delta = winner === 0 ? res.w : -res.l;
    var roleText = this.dizhu === 0 ? "地主" : "农民";
    var reason = (winner === 0 ? roleText + "赢" : roleText + "输") +
      "(底分" + this.base + "×" + res.mult + (res.spring ? "，春天" : "") + ")";
    var delta2 = GS.settleBet(this.w, delta, "doudizhu", reason);
    this.stats.record(winner === 0 ? "win" : "lose", this.base * res.mult * 100, [], delta2);
    this.mood(delta2);
    this.w.save();

    var lines = "★ " + DDZ_NAMES[winner] + " 出完牌，获胜!<br>倍数：炸弹" + this.bombMult + "个 → x" +
      Math.pow(2, this.bombMult) + (res.spring ? "，春天 → x" + res.mult : " → x" + res.mult) +
      "<br>" + (winner === 0 ? "你赢了 " : "你输了 ") + UI.moneySpan(Math.abs(delta2), winner === 0) +
      "<br>钱包 " + UI.moneySpan(this.w.balanceCents());
    var html = '<div class="panel game-screen"><h2>♠ 斗地主 · 村民·旅客 ♠</h2>' + this.header() +
      '<p class="text" style="line-height:1.9">' + lines + '</p>' +
      '<div class="actions"><button class="pix-btn" id="ddz-again">再来一局</button>' +
      '<button class="pix-btn" id="ddz-back">离开牌桌</button></div></div>';
    UI.open(html);
    this.bind("#ddz-again", function () { self.baseScreen(); });
    this.bind("#ddz-back", function () { self.exit(); });
  },
};
