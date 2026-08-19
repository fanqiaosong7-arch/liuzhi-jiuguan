/* game-snake.js — 贪吃蛇（移植 games/snake.py：入场费 $1，吃满 20 个食物过关 +$2）
 * 画面：独立小画布 30×18 格，8px/格 → 240×144。 */
"use strict";

var SnakeGame = {
  w: null, stats: null,
  running: false, rafId: null, last: 0, acc: 0,
  snake: [], dx: 1, dy: 0, eaten: 0, food: null,
  frame: 0.14, keys: null,
  W: 30, H: 18, CELL: 8,

  start: function () {
    if (typeof G !== "undefined" && G.canGamble && !G.canGamble()) return;
    this.w = Wallet.load();
    this.stats = this.w.statsFor("snake");
    this.w.settle(-1, "snake", "入场费");
    this.w.save();
    this.keys = {};
    this.boardScreen();
    var self = this;
    window.addEventListener("keydown", this.keysHandler = function (e) { self.onKey(e); });
  },

  /* 入场确认界面 */
  boardScreen: function () {
    var self = this;
    var html = '<div class="panel game-screen"><h2>🐍 贪吃蛇 · 独自练习</h2>' +
      '<div class="table-line">钱包 ' + UI.moneySpan(this.w.balanceCents()) +
      ' ｜ 入场费 $1 已扣除 ｜ 吃满 ' + TARGET_SNAKE + ' 个食物过关 奖金 $2（净+$1）</div>' +
      '<canvas id="snake-board" width="' + this.W * this.CELL + '" height="' + this.H * this.CELL + '"></canvas>' +
      '<p class="flavor">方向键/WASD 移动 ｜ Q/Esc 放弃</p>' +
      '<div class="actions"><button class="pix-btn" id="sn-start">开始</button>' +
      '<button class="pix-btn danger" id="sn-quit">离开</button></div></div>';
    UI.open(html);
    this.drawStatic();
    this.bind("#sn-start", function () { self.begin(); });
    this.bind("#sn-quit", function () { self.exit(); });
  },

  begin: function () {
    this.resetGame();
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    var self = this;
    this.rafId = requestAnimationFrame(function loop(t) {
      self.step(t);
      self.rafId = requestAnimationFrame(loop);
    });
  },

  resetGame: function () {
    this.snake = [{ x: Math.floor(this.W / 2), y: Math.floor(this.H / 2) }];
    this.dx = 1; this.dy = 0;
    this.eaten = 0;
    this.frame = 0.14;
    this.food = this.spawnFood();
  },

  spawnFood: function () {
    for (;;) {
      var f = { x: G.randInt(1, this.W - 2), y: G.randInt(1, this.H - 2) };
      var hit = this.snake.some(function (s) { return s.x === f.x && s.y === f.y; });
      if (!hit) return f;
    }
  },

  step: function (t) {
    if (!this.running) return;
    this.acc += (t - this.last) / 1000;
    this.last = t;
    if (this.acc < this.frame) { this.draw(); return; }
    this.acc = 0;

    // 移动
    var head = { x: this.snake[0].x + this.dx, y: this.snake[0].y + this.dy };
    if (head.x <= 0 || head.x >= this.W - 1 || head.y <= 0 || head.y >= this.H - 1 ||
        this.snake.some(function (s) { return s.x === head.x && s.y === head.y; })) {
      this.end(false);
      return;
    }
    this.snake.unshift(head);
    if (head.x === this.food.x && head.y === this.food.y) {
      this.eaten++;
      this.frame = Math.max(0.05, 0.14 - this.eaten * 0.004);
      this.food = this.spawnFood();
      if (this.eaten >= TARGET_SNAKE) { this.end(true); return; }
    } else {
      this.snake.pop();
    }
    this.draw();
  },

  draw: function () {
    var cv = document.getElementById("snake-board");
    if (!cv) return;
    var ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0e1116";
    ctx.fillRect(0, 0, cv.width, cv.height);
    // 墙壁
    ctx.fillStyle = "#4a3a6b";
    for (var x = 0; x < this.W; x++) {
      ctx.fillRect(x * this.CELL, 0, this.CELL, this.CELL);
      ctx.fillRect(x * this.CELL, (this.H - 1) * this.CELL, this.CELL, this.CELL);
    }
    for (var y = 0; y < this.H; y++) {
      ctx.fillRect(0, y * this.CELL, this.CELL, this.CELL);
      ctx.fillRect((this.W - 1) * this.CELL, y * this.CELL, this.CELL, this.CELL);
    }
    // 食物（苹果）
    var fx = this.food.x * this.CELL, fy = this.food.y * this.CELL;
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(fx + 1, fy + 1, this.CELL - 2, this.CELL - 2);
    ctx.fillStyle = "#e5484d";
    ctx.fillRect(fx + 2, fy + 2, this.CELL - 4, 3);
    ctx.fillStyle = "#3f9e4f";
    ctx.fillRect(fx + 6, fy, 2, 3);
    // 蛇
    for (var i = this.snake.length - 1; i >= 0; i--) {
      var s = this.snake[i];
      var col = i === 0 ? "#6fd07a" : (i % 2 === 0 ? "#3f9e4f" : "#357a45");
      ctx.fillStyle = col;
      ctx.fillRect(s.x * this.CELL + 1, s.y * this.CELL + 1, this.CELL - 2, this.CELL - 2);
    }
    // 蛇头眼睛
    var hd = this.snake[0];
    ctx.fillStyle = "#0e1116";
    if (this.dx === 1) { ctx.fillRect(hd.x * this.CELL + 9, hd.y * this.CELL + 4, 2, 2); ctx.fillRect(hd.x * this.CELL + 9, hd.y * this.CELL + 10, 2, 2); }
    else if (this.dx === -1) { ctx.fillRect(hd.x * this.CELL + 5, hd.y * this.CELL + 4, 2, 2); ctx.fillRect(hd.x * this.CELL + 5, hd.y * this.CELL + 10, 2, 2); }
    else if (this.dy === -1) { ctx.fillRect(hd.x * this.CELL + 4, hd.y * this.CELL + 5, 2, 2); ctx.fillRect(hd.x * this.CELL + 10, hd.y * this.CELL + 5, 2, 2); }
    else { ctx.fillRect(hd.x * this.CELL + 4, hd.y * this.CELL + 9, 2, 2); ctx.fillRect(hd.x * this.CELL + 10, hd.y * this.CELL + 9, 2, 2); }
    // 分数
    ctx.fillStyle = "#ffd75e";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "left";
    ctx.fillText("食物 " + this.eaten + "/" + TARGET_SNAKE, 6, 12);
  },

  drawStatic: function () {
    var cv = document.getElementById("snake-board");
    if (!cv) return;
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "#0e1116";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "#4a3a6b";
    ctx.fillRect(0, 0, cv.width, this.CELL);
    ctx.fillRect(0, cv.height - this.CELL, cv.width, this.CELL);
    ctx.fillRect(0, 0, this.CELL, cv.height);
    ctx.fillRect(cv.width - this.CELL, 0, this.CELL, cv.height);
    ctx.fillStyle = "#3f9e4f";
    ctx.fillRect(cv.width / 2 - 4, cv.height / 2 - 4, 8, 8);
    ctx.fillStyle = "#ffd75e";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("WASD/方向键", cv.width / 2, cv.height / 2 + 18);
  },

  onKey: function (e) {
    if (!this.running) return;
    var k = e.key.toLowerCase();
    if (k === "arrowup" || k === "w") { if (this.dy !== 1) { this.dx = 0; this.dy = -1; } }
    else if (k === "arrowdown" || k === "s") { if (this.dy !== -1) { this.dx = 0; this.dy = 1; } }
    else if (k === "arrowleft" || k === "a") { if (this.dx !== 1) { this.dx = -1; this.dy = 0; } }
    else if (k === "arrowright" || k === "d") { if (this.dx !== -1) { this.dx = 1; this.dy = 0; } }
    else if (k === "q" || k === "escape") { this.end(false); }
  },

  end: function (win) {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
    var self = this;
    var summary, delta;
    if (win) {
      delta = this.w.settle(2, "snake", "过关奖金");
      this.stats.record("win", 100, [], 100);
      if (typeof GS !== "undefined" && GS.state) GS.addMood(GS.state, GS.moodDeltaForBet(100));
      summary = "★ 你过关了! 奖金 " + UI.moneySpan(200, true) + "<br>钱包 " + UI.moneySpan(this.w.balanceCents());
    } else {
      this.stats.record("lose", 100, [], -100);
      if (typeof GS !== "undefined" && GS.state) GS.addMood(GS.state, GS.moodDeltaForBet(-100));
      summary = "✗ 你失败了，失去入场费 $1.00<br>钱包 " + UI.moneySpan(this.w.balanceCents());
    }
    this.w.save();
    var html = '<div class="panel game-screen"><h2>🐍 贪吃蛇</h2>' +
      '<p class="text" style="line-height:1.9">' + summary + '</p>' +
      '<div class="actions"><button class="pix-btn" id="sn-again">再来一局 ($1)</button>' +
      '<button class="pix-btn" id="sn-back">离开</button></div></div>';
    UI.open(html);
    this.bind("#sn-again", function () {
      self.w = Wallet.load();
      self.stats = self.w.statsFor("snake");
      self.w.settle(-1, "snake", "入场费");
      self.w.save();
      self.boardScreen();
    });
    this.bind("#sn-back", function () { self.exit(); });
  },

  exit: function () {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    if (this.keysHandler) window.removeEventListener("keydown", this.keysHandler);
    this.keysHandler = null;
    this.w.save();
    UI.close();
    if (typeof G !== "undefined" && G.afterLeaveGame) G.afterLeaveGame();
  },

  bind: function (sel, fn) {
    var el = UI.overlay.querySelector(sel);
    if (el) el.addEventListener("click", fn);
  },
};

var TARGET_SNAKE = 20;
