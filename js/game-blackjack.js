/* game-blackjack.js — 21点（移植 games/blackjack.py 全部规则：保险/分牌/双倍/庄家三档）
 * 界面：DOM 面板 + 异步行动流程；作弊码 NOTTHISTIME 在下注框输入。 */
"use strict";

var BJGame = {
  w: null, stats: null,
  deck: [], shoes: [],
  playerHands: [], playerBets: [], dealerHand: [],
  insurance: 0, split: false, diff: null,
  dealerRevealed: false,
  quit: false, midQuit: false,

  start: function () {
    if (typeof G !== "undefined" && G.canGamble && !G.canGamble()) return;
    cheatReset();                       // 作弊码每次进游戏重新输入
    this.w = Wallet.load();
    this.stats = this.w.statsFor("blackjack");
    this.deck = shuffle(makeDeck());
    this.shoes = [];
    var dk = this.w.settings.difficulty;
    this.diff = BJ_DIFFICULTIES[dk] || BJ_DIFFICULTIES.standard;
    GS.pickBjTable(GS.load(this.w));    // 当天上桌 NPC（最多 2 位真打牌，影响老板日赢上限）
    this.betScreen();
  },

  exit: function () {
    // 中途退出 = 认输：扣掉已下注的钱（结算后离开不扣）
    if (this.midQuit && this.playerBets && this.playerBets.length) {
      var lose = -this.playerBets.reduce(function (a, b) { return a + b; }, 0);
      var d = GS.settleBet(this.w, lose, "blackjack", "中途退出认输");
      this.stats.record("lose", toCents(-lose), ["中途退出"], d);
      this.mood(d);
    }
    this.w.save();
    UI.close();
    if (typeof G !== "undefined" && G.afterLeaveGame) G.afterLeaveGame();
  },

  /* 赌局净额 → 心情 */
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
    var bj = '';
    if (typeof GS !== "undefined" && GS.state) {
      var seats = (GS.state.bjTable || []).map(function (id) {
        var v = GS.visitorById(id);
        return v ? v.name : id;
      });
      bj = seats.length
        ? ' ｜ 上桌 ' + seats.join("、")
        : ' ｜ 无人上桌';
    }
    return '<div class="table-line">钱包 ' + UI.moneySpan(this.w.balanceCents()) + this.winRemainHtml("blackjack") + bj + ' ｜ 老板强度 ' +
      this.diff.name + (cheatActive() ? ' ｜ <span style="color:var(--dim)">(有人睁一只眼闭一只眼)</span>' : '') + '</div>';
  },

  openScreen: function (body, actions) {
    var html = '<div class="panel game-screen"><h2>♠ 21点 · 老板坐庄 ♠</h2>' + this.header() +
      '<div id="bj-table"></div>' + body + '<div class="actions">' + actions + '</div></div>';
    UI.open(html);
    this.refreshTable();
  },

  /* 实时牌面（要牌后立即刷新） */
  tableHTML: function () {
    var s = '';
    s += '<div class="table-line"><b>老板手牌</b> ' + UI.cardsHtml(this.dealerHand, this.dealerRevealed ? -1 : 1) +
      (this.dealerRevealed ? ' <span class="money-zero">' + handValue(this.dealerHand) + '点</span>' : '') + '</div>';
    if (this.npcSeats && this.npcSeats.length) {
      for (var k = 0; k < this.npcSeats.length; k++) {
        var st = this.npcSeats[k];
        s += '<div class="table-line"><b>' + st.name + '</b> ' + UI.cardsHtml(st.hand) +
          ' <span class="money-zero">' + handValue(st.hand) + '点</span>（下注 ' +
          G.fmtCents(st.bet) + '）</div>';
      }
    }
    for (var i = 0; i < this.playerHands.length; i++) {
      var h = this.playerHands[i];
      var tag = this.playerHands.length > 1 ? ' 第' + (i + 1) + '手' : '';
      s += '<div class="table-line"><b>你的手牌' + tag + '</b> ' + UI.cardsHtml(h) +
        ' <span class="money-zero">' + handValue(h) + '点</span></div>';
    }
    return s;
  },

  refreshTable: function () {
    var el = document.getElementById("bj-table");
    if (el) el.innerHTML = this.tableHTML();
  },

  msgLine: function (text) {
    this.refreshTable();
    var p = UI.overlay.querySelector(".game-screen");
    if (p) {
      var line = document.createElement("div");
      line.className = "table-line";
      line.style.color = "var(--dim)";
      line.textContent = text;
      p.insertBefore(line, p.querySelector(".actions"));
    }
  },

  bind: function (sel, fn) {
    var el = UI.overlay.querySelector(sel);
    if (el) el.addEventListener("click", fn);
  },

  /* ---------- 下注 ---------- */
  betScreen: function () {
    var self = this;
    this.dealerRevealed = false;
    var flavor = '深夜的酒馆，老板奥托擦着杯子等你下注。';
    if (typeof GS !== "undefined" && GS.state && GS.state.bjTable && GS.state.bjTable.length) {
      var names = GS.state.bjTable.map(function (id) {
        var v = GS.visitorById(id);
        return v ? v.name : id;
      }).join("、");
      flavor += '<br>' + names + '也挤到桌边，摸出铜板要跟一注。';
    }
    this.openScreen(
      '<p class="flavor">' + flavor + '</p>' +
      '<input id="bj-bet" type="text" inputmode="decimal" placeholder="输入金额（$），0 退出" ' +
      'style="width:100%;font-family:inherit;font-size:15px;padding:6px;background:#120c22;color:var(--cream);border:3px solid var(--line)">',
      '<button class="pix-btn" id="bj-go">下注</button>' +
      '<button class="pix-btn danger" id="bj-quit">离开牌桌</button>'
    );
    var input = document.getElementById("bj-bet");
    input.focus();
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") document.getElementById("bj-go").click();
    });
    this.bind("#bj-go", function () {
      var raw = (input.value || "").trim().toUpperCase();
      if (raw === "NOTTHISTIME") {
        cheatEnable();
        UI.dialog("彩蛋", ["酒馆里有人睁一只眼闭一只眼：本局起输钱不扣。"],
          [{ label: "好", act: "ok", fn: function () { self.betScreen(); } }]);
        return;
      }
      var bet = parseFloat(raw);
      if (!isFinite(bet) || bet <= 0) {
        UI.dialog("提示", ["请输入有效的下注金额。"],
          [{ label: "好", act: "ok", fn: function () { self.betScreen(); } }]);
        return;
      }
      // 下注上限 = min(赊账额度(钱包+$30), 老板钱包 $50)；作弊模式不受限（能下重注）
      var maxBet = cheatActive() ? 1e9 : Math.min(self.w.balanceCents() + 3000, BOSS_WALLET) / 100;
      if (bet > maxBet + 1e-9) {
        UI.dialog("老板", ["小本生意，一注最多 " + G.fmtCents(toCents(Math.min(self.w.balanceCents() + 3000, BOSS_WALLET))) +
          "，多了我这桌赔不起。"],
          [{ label: "好", act: "ok", fn: function () { self.betScreen(); } }]);
        return;
      }
      self.playRound(bet);
    });
    this.bind("#bj-quit", function () { self.exit(); });
  },

  /* ---------- 一局 ---------- */
  playRound: async function (bet) {
    var self = this;
    this.playerHands = [[this.deal(), this.deal()]];
    this.playerBets = [bet];
    this.dealerHand = [this.deal(), this.deal()];
    this.insurance = 0;
    this.split = false;
    this.dealerRevealed = false;
    this.quit = false;
    this.midQuit = false;
    // 上桌 NPC：每人下注 $1~3 并发两张
    this.npcSeats = [];
    if (typeof GS !== "undefined" && GS.state && GS.state.bjTable) {
      var self0 = this;
      GS.state.bjTable.forEach(function (id) {
        var v = GS.visitorById(id);
        if (!v) return;
        self0.npcSeats.push({
          id: id, name: v.name, bet: (Math.floor(Math.random() * 3) + 1) * 100,
          hand: [self0.deal(), self0.deal()],
        });
      });
    }

    // 保险（老板明牌 A）
    if (this.dealerHand[0].charAt(0) === "A") {
      var ins = await this.askYesNo("买保险", "老板明牌 A。买保险吗？<br>保费为下注一半 " +
        G.fmtCents(toCents(bet / 2)) + "，庄家黑杰克按 2:1 赔付。", "买保险", "不买");
      if (this.quit) return;
      if (ins) this.insurance = bet / 2;
    }

    // 老板黑杰克 → 提前结算
    if (isBlackjack(this.dealerHand)) {
      this.dealerRevealed = true;
      this.refreshTable();
      var mainNet = 0, lines = [];
      // 上桌 NPC 先结算（黑杰克抵消，其余输注）
      for (var k = 0; k < this.npcSeats.length; k++) {
        var st0 = this.npcSeats[k];
        var n0 = isBlackjack(st0.hand) ? 0 : -st0.bet;
        GS.npcNetResult(GS.state, n0);
        lines.push(st0.name + (n0 < 0 ? " 输 " + G.fmtCents(-n0) : " 黑杰克抵消，平局"));
      }
      for (var i = 0; i < this.playerHands.length; i++) {
        if (isBlackjack(this.playerHands[i])) lines.push("第" + (i + 1) + "手 黑杰克抵消，平局");
        else { mainNet -= this.playerBets[i]; lines.push("第" + (i + 1) + "手 输 " + G.fmtCents(toCents(this.playerBets[i]))); }
      }
      var net = mainNet + this.insurance * 2;
      var reason = "老板黑杰克" + (this.insurance ? "，保险2:1赔付" : "");
      var delta = GS.settleBet(this.w, net, "blackjack", reason);
      var result = mainNet === 0 ? "push" : "lose";
      var betCents = toCents(this.playerBets.reduce(function (a, b) { return a + b; }, 0));
      this.stats.record(result, betCents, this.insurance ? ["保险"] : [], delta);
      this.mood(delta);
      lines.push("净额 " + UI.moneySpan(delta, true));
      this.finishRound(lines.join("<br>"));
      return;
    }

    // 分牌（前两张同点）
    var first = this.playerHands[0];
    if (first.length === 2 && blackjackValue(first[0]) === blackjackValue(first[1])) {
      var sp = await this.askYesNo("分牌", "前两张同点，要分牌吗？<br>每手追加一份下注。", "分牌", "不分");
      if (this.quit) return;
      if (sp) {
        this.split = true;
        this.playerHands = [[first[0]], [first[1]]];
        this.playerBets = [bet, bet];
        this.playerHands.forEach(function (h) { h.push(self.deal()); });
        this.refreshTable();
      }
    }

    // 玩家回合
    if (!this.split && isBlackjack(this.playerHands[0])) {
      this.msgLine("★ 你拿到了 Blackjack! ★");
    } else {
      for (var hi = 0; hi < this.playerHands.length; hi++) {
        if (this.quit) return this.exit();
        var hand = this.playerHands[hi];
        if (this.split && hand[0].charAt(0) === "A") { this.msgLine("分出的 A 只补一张，本手停牌。"); continue; }
        var doubled = false;
        while (handValue(hand) < 21) {
          var canDouble = hand.length === 2 && !doubled;   // 与 Python 版一致：分牌手也可双倍
          var act = await this.askAction(hi, canDouble);
          if (this.quit) return this.exit();
          if (act === "d") {
            doubled = true;
            this.playerBets[hi] *= 2;
            hand.push(this.deal());
            this.msgLine("◆ 双倍下注! 下注变为 " + G.fmtCents(toCents(this.playerBets[hi])));
            if (handValue(hand) > 21) this.msgLine("✗ 爆牌!");
            break;
          } else if (act === "h") {
            hand.push(this.deal());
            this.msgLine("要牌 → " + handValue(hand) + "点");
            if (handValue(hand) > 21) { this.msgLine("✗ 爆牌!"); break; }
          } else {
            this.msgLine("停牌。");
            break;
          }
        }
      }
    }
    if (this.quit) return this.exit();

    // 庄家回合（延时演牌）
    this.dealerRevealed = true;
    this.refreshTable();
    await sleep(400);
    while (dealerShouldHit(handValue(this.dealerHand), isSoft(this.dealerHand), this.diff)) {
      this.dealerHand.push(this.deal());
      this.msgLine("老板要牌 → " + handValue(this.dealerHand) + "点");
      await sleep(420);
    }
    this.msgLine("老板停牌。");

    // 上桌 NPC 要牌（17 停）并结算 vs 老板
    for (var k2 = 0; k2 < this.npcSeats.length; k2++) {
      var st2 = this.npcSeats[k2];
      while (handValue(st2.hand) < 17) st2.hand.push(this.deal());
      var n2 = resolveHand(st2.hand, st2.bet, false, this.dealerHand);
      GS.npcNetResult(GS.state, n2);
      var label2 = n2 > 0 ? "赢 " + G.fmtCents(n2) : (n2 < 0 ? "输 " + G.fmtCents(-n2) : "平局");
      this.msgLine(st2.name + " " + handValue(st2.hand) + "点，" + label2);
    }
    this.refreshTable();

    // 结算
    var r = settleRound(this.playerHands, this.playerBets, this.insurance, this.dealerHand);
    var tags = [];
    if (this.split) tags.push("分牌");
    if (this.playerBets.some(function (b) { return b > bet + 1e-9; })) tags.push("双倍");
    if (this.insurance) tags.push("保险");
    var delta = GS.settleBet(this.w, r.net, "blackjack", r.reason);
    var betCents2 = toCents(this.playerBets.reduce(function (a, b) { return a + b; }, 0));
    this.stats.record(r.result, betCents2, tags, delta);
    this.mood(delta);
    var lines = [];
    for (var j = 0; j < this.playerHands.length; j++) {
      var ht = handResultText(this.playerHands[j], this.playerBets[j], this.split, this.dealerHand);
      lines.push(ht.label);
    }
    if (this.insurance) lines.push("保险 $" + this.insurance.toFixed(2) + " 作废");
    var winText = r.result === "win" ? "★ 你赢了!" : (r.result === "win_bj" ? "★ 黑杰克!" :
      (r.result === "lose" ? "✗ 你输了" : "＝ 平局，不输不赢"));
    lines.push(winText + " 净额 " + UI.moneySpan(delta, true));
    this.finishRound(lines.join("<br>"));
  },

  askAction: function (handIdx, canDouble) {
    var self = this;
    return new Promise(function (res) {
      var opts = canDouble
        ? '<button class="pix-btn" id="bj-h">要牌</button><button class="pix-btn" id="bj-s">停牌</button><button class="pix-btn" id="bj-d">双倍</button><button class="pix-btn danger" id="bj-q">退出</button>'
        : '<button class="pix-btn" id="bj-h">要牌</button><button class="pix-btn" id="bj-s">停牌</button><button class="pix-btn danger" id="bj-q">退出</button>';
      self.openScreen(
        '<p class="flavor">你的行动</p>',
        opts
      );
      self.bind("#bj-h", function () { res("h"); });
      self.bind("#bj-s", function () { res("s"); });
      self.bind("#bj-d", function () { res("d"); });
      self.bind("#bj-q", function () { self.quit = true; self.midQuit = true; res("q"); });
    });
  },

  askYesNo: function (title, text, yesLabel, noLabel) {
    var self = this;
    return new Promise(function (res) {
      self.openScreen(
        '<div class="dialog"><p class="text">' + text + '</p></div>',
        '<button class="pix-btn" id="bj-y">' + yesLabel + '</button>' +
        '<button class="pix-btn" id="bj-n">' + noLabel + '</button>'
      );
      self.bind("#bj-y", function () { res(true); });
      self.bind("#bj-n", function () { res(false); });
    });
  },

  finishRound: function (summary) {
    var self = this;
    var html = '<div class="panel game-screen"><h2>♠ 21点 · 老板坐庄 ♠</h2>' + this.header() +
      '<p class="text" style="line-height:1.9">' + summary + '</p>' +
      '<div class="actions"><button class="pix-btn" id="bj-again">再来一局</button>' +
      '<button class="pix-btn" id="bj-back">离开牌桌</button></div></div>';
    UI.open(html);
    this.w.save();
    this.bind("#bj-again", function () { self.playRound(self.playerBets[0]); });
    this.bind("#bj-back", function () { self.exit(); });
  },

  deal: function () {
    if (!this.deck.length) {
      this.deck = shuffle(makeDeck());
      this.shoes.push(this.deck.slice());
    }
    return this.deck.pop();
  },
};

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
