/* game-poker.js — 德州扑克多人桌（玩家 + 醉汉 + 最多 4 位访客，移植 games/poker.py 规则）
 * 金额单位：内部一律「分」（cents）；每轮 NPC 先表态 → 玩家表态 → 玩家加注后 NPC 响应。 */
"use strict";

var STAGES = [
  { name: "翻牌前", cards: 0 },
  { name: "翻牌", cards: 3 },
  { name: "转牌", cards: 1 },
  { name: "河牌", cards: 1 },
];

var PokerGame = {
  w: null, stats: null,
  deck: [], shoes: [],
  seats: [],        // [{who:'p'|'npc', id, name, hole, cIn, folded, allIn}]
  board: [], pot: 0, cur: 0,
  logs: [],
  quit: false,

  start: function () {
    if (typeof G !== "undefined" && G.canGamble && !G.canGamble()) return;
    cheatReset();
    this.w = Wallet.load();
    this.stats = this.w.statsFor("poker");
    this.deck = shuffle(makeDeck());
    this.shoes = [];
    GS.pickPokerTable(GS.load(this.w));   // 当天上桌 NPC（最多 4 位）
    this.playHand();
  },

  exit: function () {
    // 中途退出 = 弃牌认输：扣掉已投入（结算后离开不扣）
    if (this.midQuit && this.seats && this.seats.length) {
      var p0 = this.seats[0];
      if (p0.cIn > 0) {
        var d = GS.settleBet(this.w, -p0.cIn / 100, "poker", "中途退出");
        this.stats.record("lose", p0.cIn, [], d);
        this.mood(d);
      }
    }
    this.w.save();
    UI.close();
    if (typeof G !== "undefined" && G.afterLeaveGame) G.afterLeaveGame();
  },

  mood: function (netCents) {
    if (typeof GS !== "undefined" && GS.state) GS.addMood(GS.state, GS.moodDeltaForBet(netCents));
  },

  /* ---------- 界面 ---------- */
  header: function () {
    var seats = '';
    if (typeof GS !== "undefined" && GS.state && GS.state.pokerTable && GS.state.pokerTable.length) {
      seats = ' ｜ 上桌 ' + GS.state.pokerTable.map(function (id) {
        var v = GS.visitorById(id);
        return v ? v.name : id;
      }).join("、");
    }
    return '<div class="table-line">钱包 ' + UI.moneySpan(this.w.balanceCents()) +
      this.winRemainHtml("poker") + seats + ' ｜ 底注 $1 ｜ 单局投入上限 ' +
      (cheatActive() ? '∞ <span style="color:var(--dim)">(作弊豁免)</span>' : G.fmtCents(MAX_COMMIT)) +
      (cheatActive() ? ' ｜ <span style="color:var(--dim)">(有人睁一只眼闭一只眼)</span>' : '') + '</div>';
  },

  winRemainHtml: function (gameKey) {
    if (typeof GS === "undefined" || !GS.state) return "";
    var remain = GS.winRemain(GS.state, gameKey);
    if (remain === null) return "";
    if (remain <= 0) return ' <span style="color:var(--red)">｜ 今日已赢够，明天再来</span>';
    return ' ｜ 今日还能赢 ' + G.fmtCents(remain);
  },

  openScreen: function (body, actions) {
    var html = '<div class="panel game-screen"><h2>♠ 德州扑克 · 醉汉作陪 ♠</h2>' + this.header() +
      '<div id="pk-log"></div>' + body + '<div class="actions">' + actions + '</div></div>';
    UI.open(html);
    this.renderLog();
    this.refresh();
  },

  tableHTML: function () {
    var board = this.board.length ? UI.cardsHtml(this.board) : '(无)';
    var s = '';
    s += '<div class="table-line"><b>公共牌</b> ' + board + ' ｜ 底池 ' + UI.moneySpan(this.pot) + '</div>';
    for (var i = 0; i < this.seats.length; i++) {
      var st = this.seats[i];
      s += '<div class="table-line"><b>' + st.name + '</b> ' +
        (st.folded
          ? '<span style="color:var(--dim)">已弃牌</span>（投入 ' + UI.moneySpan(st.cIn) + '）'
          : UI.cardsHtml(st.hole, this.showdown ? -1 : (st.who === "p" ? -1 : 1)) +
            ' 已投入 ' + UI.moneySpan(st.cIn)) + '</div>';
    }
    return s;
  },

  refresh: function () {
    var el = document.getElementById("pk-table");
    if (el) el.innerHTML = this.tableHTML();
  },

  log: function (text, cls) {
    this.logs.push({ text: text, cls: cls });
    this.renderLog();
  },

  renderLog: function () {
    var el = document.getElementById("pk-log");
    if (!el) return;
    el.innerHTML = "";
    for (var i = 0; i < this.logs.length; i++) {
      var line = document.createElement("div");
      line.className = "table-line";
      line.style.color = this.logs[i].cls || "var(--dim)";
      line.textContent = this.logs[i].text;
      el.appendChild(line);
    }
    el.scrollTop = el.scrollHeight;
  },

  bind: function (sel, fn) {
    var el = UI.overlay.querySelector(sel);
    if (el) el.addEventListener("click", fn);
  },

  actButtons: function (need) {
    var s = '';
    if (need > 0) s += '<button class="pix-btn" id="pk-call">跟注 ' + G.fmtCents(need) + '</button>';
    else s += '<button class="pix-btn" id="pk-call">过牌</button>';
    s += '<button class="pix-btn" id="pk-raise">加注</button>' +
         '<button class="pix-btn" id="pk-allin">全下</button>' +
         '<button class="pix-btn" id="pk-fold">弃牌</button>' +
         '<button class="pix-btn danger" id="pk-quit">退出</button>';
    return s;
  },

  /* ---------- 一局 ---------- */
  playHand: async function () {
    var self = this;
    this.quit = false;
    this.midQuit = false;
    this.logs = [];
    this.board = [];
    this.showdown = false;

    var allInEnd = false;

    // 座位：玩家 + 醉汉 + 当天上桌访客（0~4）
    this.seats = [];
    this.seats.push({ who: "p", id: "player", name: "你", hole: [], cIn: ANTE, folded: false, allIn: false });
    this.seats.push({ who: "npc", id: "drunk", name: "醉汉", hole: [], cIn: ANTE, folded: false, allIn: false, drunk: true });
    if (typeof GS !== "undefined" && GS.state && GS.state.pokerTable) {
      var self2 = this;
      GS.state.pokerTable.forEach(function (id) {
        var v = GS.visitorById(id);
        if (v) self2.seats.push({ who: "npc", id: id, name: v.name, hole: [], cIn: ANTE, folded: false, allIn: false, gentle: true });
      });
    }
    this.seats.forEach(function (st) { st.hole = [self.deal(), self.deal()]; });
    this.pot = ANTE * this.seats.length;
    this.cur = ANTE;
    var p = this.seats[0];

    this.openScreen('<div id="pk-table"></div>', "");
    this.log("新一局，底注 $1 已入池。" + (this.seats.length > 2 ? " 今儿人多，热闹。" : ""), "var(--gold)");
    this.log("醉汉：" + G.pick(["嗝~ 坐下！陪老子打两把！", "咦？又来一个冤大头，嗝~"]));
    await sleep(350);

    var alive = function () {
      return self.seats.filter(function (s) { return !s.folded && !s.allIn; });
    };

    for (var si = 0; si < STAGES.length; si++) {
      var stage = STAGES[si];
      if (alive().length <= 1) break;
      this.log("── " + stage.name + " ──");
      if (stage.cards) {
        for (var c = 0; c < stage.cards; c++) this.board.push(this.deal());
        this.refresh();
        await sleep(300);
      }

      // NPC 依次主动表态（醉汉激进，访客温和）
      for (var i = 1; i < this.seats.length; i++) {
        var st = this.seats[i];
        if (st.folded || st.allIn) continue;
        var strength = cpuStrength(st.hole, this.board);
        var act = st.drunk
          ? cpuRespond({ cur: this.cur, cIn: st.cIn, allIn: false }, strength, this.pot)
          : cpuRespondGentle({ cur: this.cur, cIn: st.cIn, allIn: false }, strength, this.pot);
        if (act.type === "raise") {
          this.cur += act.amt;
          st.cIn += act.amt; this.pot += act.amt;
          this.log(st.name + "加注到 " + G.fmtCents(this.cur) + "。", "var(--cyan)");
        } else if (act.type === "fold") {
          st.folded = true;
          this.log(st.name + "弃牌。", "var(--dim)");
        } else {
          var d = this.cur - st.cIn;
          if (d > 0) { st.cIn += d; this.pot += d; this.log(st.name + "跟注 " + G.fmtCents(d) + "。", "var(--cyan)"); }
          else this.log(st.name + "过牌。");
        }
        this.refresh();
        await sleep(260);
      }
      if (alive().length <= 1) break;
      if (p.folded) break;

      // 玩家表态（加注可取消重选）
      var done = false;
      while (!done) {
        var need = Math.max(0, this.cur - p.cIn);
        var act2 = await this.askPlayer(need);
        if (this.quit) return this.exit();
        if (act2 === "fold") {
          p.folded = true;
          this.log("你弃牌了。", "var(--red)");
          done = true;
        } else if (act2 === "allin") {
          // 作弊模式：全下无上限（正常模式仍受防刷/赊账约束）
          var ad = cheatActive()
            ? 1e9 - p.cIn
            : Math.min(MAX_COMMIT - p.cIn, this.w.balanceCents() + 3000 - p.cIn);
          if (ad > 0) { p.cIn += ad; this.pot += ad; }
          p.allIn = true;
          this.log("你全下! 本局投入达 " + G.fmtCents(p.cIn) + "。", "var(--gold)");
          await this.npcsRespondToRaise(p.cIn);   // NPC 按玩家全下额跟/弃
          done = true;
          allInEnd = true;                        // 全下后直接摊牌
        } else if (act2 === "raise") {
          var amt = await this.askRaise(need);
          if (amt === null) continue;
          this.cur += amt;
          p.cIn += amt; this.pot += amt;
          this.log("你加注到 " + G.fmtCents(this.cur) + "。", "var(--gold)");
          await this.npcsRespondToRaise(this.cur);
          done = true;
        } else { // call
          if (need > 0) { p.cIn += need; this.pot += need; this.log("你跟注 " + G.fmtCents(need) + "。"); }
          else this.log("你过牌。");
          done = true;
        }
        this.refresh();
      }
      if (p.folded || allInEnd) break;
    }

    // 摊牌
    this.showdown = true;
    this.refresh();
    var alive2 = this.seats.filter(function (s) { return !s.folded; });
    if (alive2.length <= 1) {
      // 只剩一家（其余全弃）
      var winner = alive2[0];
      if (winner.who === "p") {
        var net = this.pot - p.cIn;
        var d1 = GS.settleBet(this.w, net / 100, "poker", "其余人弃牌");
        this.stats.record("win", p.cIn, [], d1);
        this.mood(d1);
        this.finishHand("★ 你赢了! 净赢 " + UI.moneySpan(d1, true));
      } else {
        var d2 = GS.settleBet(this.w, -p.cIn / 100, "poker", "对手赢底池");
        this.stats.record("lose", p.cIn, [], d2);
        this.mood(d2);
        this.finishHand("✗ " + winner.name + " 赢走底池，你失去 " + G.fmtCents(p.cIn) + "。");
      }
      return;
    }

    // 比牌
    this.log("── 摊牌 ──", "var(--gold)");
    // 公共牌不足 5 张则补发：翻牌前/早期弃牌后只剩多家时，
    // 需凑满 7 张（2 手牌 + 5 公共牌）才能比牌，否则 bestHand 返回 null 会崩（2026-08-17 修复）
    while (this.board.length < 5) this.board.push(this.deal());
    var results = [];
    for (var k = 0; k < alive2.length; k++) {
      var s2 = alive2[k];
      var bh = bestHand(s2.hole.concat(this.board));
      if (!bh) continue;      // 兜底：牌不齐时跳过（正常补发后不会走到）
      results.push({ seat: s2, score: bh.score, handName: handName(bh.score) });
      this.log(s2.name + "：" + handName(bh.score));
    }
    var best = results[0].score;
    for (var b = 1; b < results.length; b++) if (cmpScore(results[b].score, best) > 0) best = results[b].score;
    var winners = results.filter(function (r) { return cmpScore(r.score, best) === 0; });
    var pWin = winners.some(function (r) { return r.seat.who === "p"; });

    var d3, lines;
    if (winners.length === 1 && winners[0].seat.who === "p") {
      d3 = GS.settleBet(this.w, (this.pot - p.cIn) / 100, "poker", "赢底池(" + winners[0].handName + ")");
      this.stats.record("win", p.cIn, [], d3);
      this.mood(d3);
      lines = "★ 你赢了! 净赢 " + UI.moneySpan(d3, true);
    } else if (winners.length === 1) {
      d3 = GS.settleBet(this.w, -p.cIn / 100, "poker", "输给" + winners[0].handName);
      this.stats.record("lose", p.cIn, [], d3);
      this.mood(d3);
      lines = "✗ " + winners[0].seat.name + " 赢了(" + winners[0].handName + ")，你失去 " + G.fmtCents(p.cIn) + "。";
    } else if (pWin) {
      d3 = GS.settleBet(this.w, (this.pot / winners.length - p.cIn) / 100, "poker", "平分底池(" + winners.length + "人)");
      this.stats.record("push", p.cIn, [], d3);
      this.mood(d3);
      lines = "＝ 与 " + winners.map(function (r) { return r.seat.name; }).join("、") +
        " 平分底池，净 " + UI.moneySpan(d3, true);
    } else {
      d3 = GS.settleBet(this.w, -p.cIn / 100, "poker", "输给" + winners.map(function (r) { return r.seat.name; }).join("、"));
      this.stats.record("lose", p.cIn, [], d3);
      this.mood(d3);
      lines = "✗ " + winners.map(function (r) { return r.seat.name; }).join("、") + " 平分底池，你失去 " + G.fmtCents(p.cIn) + "。";
    }
    this.finishHand(lines);
  },

  /* 玩家加注/全下后：其余未弃牌 NPC 响应（call/fold）。target 为目标注额（加注=cur，全下=p.cIn） */
  npcsRespondToRaise: async function (target) {
    var self = this;
    for (var i = 1; i < this.seats.length; i++) {
      var st = this.seats[i];
      if (st.folded || st.allIn) continue;
      var strength = cpuStrength(st.hole, this.board);
      if (cpuAfterRaise(strength) === "fold") {
        st.folded = true;
        this.log(st.name + "弃牌。", "var(--dim)");
      } else {
        var d = target - st.cIn;
        if (d > 0) { st.cIn += d; this.pot += d; this.log(st.name + "跟注 " + G.fmtCents(d) + "。", "var(--cyan)"); }
      }
      this.refresh();
      await sleep(260);
    }
  },

  askPlayer: function (need) {
    var self = this;
    return new Promise(function (res) {
      var p = self.seats[0];
      var credit = cheatActive() ? 1e9 - p.cIn : self.w.balanceCents() + 3000 - p.cIn;
      var canAfford = need <= credit + 1e-9;
      var buttons = canAfford
        ? self.actButtons(need)
        : '<button class="pix-btn" id="pk-fold">弃牌</button><button class="pix-btn danger" id="pk-quit">退出</button>';
      UI.open('<div class="panel game-screen"><h2>♠ 德州扑克 · 醉汉作陪 ♠</h2>' + self.header() +
        '<div id="pk-log"></div><div id="pk-table"></div>' +
        (canAfford ? '' : '<p class="flavor" style="color:var(--red)">欠账太多，跟不起了，只能弃牌。</p>') +
        '<div class="actions">' + buttons + '</div></div>');
      self.renderLog();
      self.refresh();
      self.log("你的行动：" + (need > 0 ? "需跟注 " + G.fmtCents(need) : "可过牌"));
      self.bind("#pk-call", function () { res("call"); });
      self.bind("#pk-raise", function () { res("raise"); });
      self.bind("#pk-allin", function () { res("allin"); });
      self.bind("#pk-fold", function () { res("fold"); });
      self.bind("#pk-quit", function () { self.quit = true; self.midQuit = true; res("quit"); });
    });
  },

  askRaise: function (need) {
    var self = this;
    return new Promise(function (res) {
      var p = self.seats[0];
      var walletC = self.w.balanceCents();
      // 作弊模式：重注无上限（可超越钱包/老板筹码/赊账额度）；正常模式仍受防刷约束
      var maxRaise = cheatActive()
        ? 1e9 - p.cIn
        : Math.min(MAX_COMMIT - p.cIn, CPU_CHIPS - p.cIn, walletC > 0 ? walletC : MAX_COMMIT, walletC + 3000 - p.cIn);
      if (maxRaise <= 0) { res(null); return; }
      var html = '<div class="panel game-screen"><h2>♠ 德州扑克 · 醉汉作陪 ♠</h2>' + self.header() +
        '<p class="flavor">加注金额（当前需跟 ' + G.fmtCents(need) + '，最多 ' + G.fmtCents(maxRaise) + '，0 取消）</p>' +
        '<input id="pk-amt" type="text" inputmode="decimal" placeholder="金额（$）" ' +
        'style="width:100%;font-family:inherit;font-size:15px;padding:6px;background:#120c22;color:var(--cream);border:3px solid var(--line)">' +
        '<div class="actions"><button class="pix-btn" id="pk-ok">确定</button>' +
        '<button class="pix-btn" id="pk-cancel">取消</button></div></div>';
      UI.open(html);
      var input = document.getElementById("pk-amt");
      input.focus();
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") document.getElementById("pk-ok").click();
      });
      self.bind("#pk-ok", function () {
        var v = parseFloat(input.value);
        if (!isFinite(v) || v <= 0) { res(null); return; }
        var cents = Math.round(v * 100);
        if (cents > maxRaise) {
          UI.dialog("提示", ["加注不能超过 " + G.fmtCents(maxRaise) + "。"],
            [{ label: "好", act: "ok", fn: function () { self.askRaise(need).then(res); } }]);
          return;
        }
        res(cents);
      });
      self.bind("#pk-cancel", function () { res(null); });
    });
  },

  finishHand: function (summary) {
    var self = this;
    var html = '<div class="panel game-screen"><h2>♠ 德州扑克 · 醉汉作陪 ♠</h2>' + this.header() +
      '<p class="text" style="line-height:1.9">' + summary + '<br>钱包 ' + UI.moneySpan(this.w.balanceCents()) + '</p>' +
      '<div class="actions"><button class="pix-btn" id="pk-again">再来一局</button>' +
      '<button class="pix-btn" id="pk-back">离开牌桌</button></div></div>';
    UI.open(html);
    this.w.save();
    this.bind("#pk-again", function () { self.playHand(); });
    this.bind("#pk-back", function () { self.exit(); });
  },

  deal: function () {
    if (!this.deck.length) {
      this.deck = shuffle(makeDeck());
      this.shoes.push(this.deck.slice());
    }
    return this.deck.pop();
  },
};
