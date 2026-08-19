/* game-pong.js — 乒乓球（移植 games/pong.py：入场费 $1、先到 7 分、W/S 或触摸控制）
 * 画面：canvas 46×22 格、8px/格；触摸/鼠标在画布上移动直接控制左挡板。 */
"use strict";

var PongGame = {
  w: null, stats: null,
  running: false, rafId: null, last: 0, acc: 0,
  HEIGHT: 22, WIDTH: 46, PADDLE_H: 4, CELL: 8,
  py: 11, cy: 11, bx: 23, by: 11, vx: 1, vy: 1,
  ps: 0, cs: 0, frameCount: 0, frame: 0.085, cpuN: 2,
  keysHandler: null, ptrHandler: null,

  start: function () {
    if (typeof G !== "undefined" && G.canGamble && !G.canGamble()) return;
    this.w = Wallet.load();
    this.stats = this.w.statsFor("pong");
    this.w.settle(-1, "pong", "入场费");
    this.w.save();
    var dk = this.w.settings.difficulty;
    this.frame = { easy: 0.11, standard: 0.085, hard: 0.06 }[dk] || 0.085;
    this.cpuN = { easy: 3, standard: 2, hard: 1 }[dk] || 2;
    this.boardScreen();
    var self = this;
    window.addEventListener("keydown", this.keysHandler = function (e) { self.onKey(e); });
  },

  boardScreen: function () {
    var self = this;
    var html = '<div class="panel game-screen"><h2>🏓 乒乓球 · 村民应战</h2>' +
      '<div class="table-line">钱包 ' + UI.moneySpan(this.w.balanceCents()) +
      ' ｜ 入场费 $1 已扣除 ｜ 先到 7 分赢 奖金 $2（净+$1）</div>' +
      '<canvas id="pong-board" width="' + this.WIDTH * this.CELL + '" height="' + this.HEIGHT * this.CELL +
      '" style="width:100%;max-width:420px;height:auto;image-rendering:pixelated;background:#0e1116;border:3px solid var(--line)"></canvas>' +
      '<p class="flavor">W/S 或 在画布上滑动 控制左挡板 ｜ Q/Esc 放弃</p>' +
      '<div class="actions"><button class="pix-btn" id="pg-start">开始</button>' +
      '<button class="pix-btn danger" id="pg-quit">离开</button></div></div>';
    UI.open(html);
    this.drawStatic();
    this.bind("#pg-start", function () { self.begin(); });
    this.bind("#pg-quit", function () { self.exit(); });
  },

  begin: function () {
    this.py = this.cy = this.HEIGHT / 2;
    this.bx = this.WIDTH / 2; this.by = this.HEIGHT / 2;
    this.vx = Math.random() < 0.5 ? 1 : -1;
    this.vy = Math.random() < 0.5 ? -1 : 1;
    this.ps = 0; this.cs = 0; this.frameCount = 0;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    var self = this;
    // 触摸/鼠标：位置直接映射挡板
    var cv = document.getElementById("pong-board");
    if (cv) {
      this.ptrHandler = function (e) {
        var rect = cv.getBoundingClientRect();
        var y = (e.clientY - rect.top) / rect.height * self.HEIGHT;
        self.py = Math.max(self.PADDLE_H / 2 + 1, Math.min(self.HEIGHT - self.PADDLE_H / 2 - 2, y));
      };
      cv.addEventListener("pointermove", this.ptrHandler);
      cv.addEventListener("pointerdown", this.ptrHandler);
    }
    this.rafId = requestAnimationFrame(function loop(t) {
      self.step(t);
      self.rafId = requestAnimationFrame(loop);
    });
  },

  onKey: function (e) {
    if (!this.running) return;
    var k = e.key.toLowerCase();
    if (k === "w") { if (this.py - this.PADDLE_H / 2 > 1) this.py -= 1; }
    else if (k === "s") { if (this.py + this.PADDLE_H / 2 < this.HEIGHT - 2) this.py += 1; }
    else if (k === "q" || k === "escape") { this.end(false); }
  },

  step: function (t) {
    if (!this.running) return;
    this.acc += (t - this.last) / 1000;
    this.last = t;
    if (this.acc < this.frame) { this.draw(); return; }
    this.acc = 0;

    // 电脑 AI（每 cpuN 帧一步）
    this.frameCount++;
    if (this.frameCount % this.cpuN === 0) {
      if (this.cy < this.by && this.cy + this.PADDLE_H / 2 < this.HEIGHT - 2) this.cy += 1;
      else if (this.cy > this.by && this.cy - this.PADDLE_H / 2 > 1) this.cy -= 1;
    }
    // 球移动
    this.bx += this.vx; this.by += this.vy;
    if (this.by <= 1) { this.by = 2; this.vy = Math.abs(this.vy); }
    else if (this.by >= this.HEIGHT - 2) { this.by = this.HEIGHT - 3; this.vy = -Math.abs(this.vy); }
    // 挡板碰撞
    if (this.vx < 0 && this.bx === 3 && Math.abs(this.by - this.py) <= this.PADDLE_H / 2 + 1) {
      this.vx = 1; this.vy = Math.random() < 0.5 ? -1 : 1;
    }
    if (this.vx > 0 && this.bx === this.WIDTH - 4 && Math.abs(this.by - this.cy) <= this.PADDLE_H / 2 + 1) {
      this.vx = -1; this.vy = Math.random() < 0.5 ? -1 : 1;
    }
    // 得分
    if (this.bx <= 0) { this.cs++; this.resetBall(1); }
    else if (this.bx >= this.WIDTH - 1) { this.ps++; this.resetBall(-1); }
    if (this.ps >= 7 || this.cs >= 7) { this.end(this.ps >= 7); return; }
    this.draw();
  },

  resetBall: function (direction) {
    this.bx = this.WIDTH / 2; this.by = this.HEIGHT / 2;
    this.vx = direction; this.vy = Math.random() < 0.5 ? -1 : 1;
  },

  draw: function () {
    var cv = document.getElementById("pong-board");
    if (!cv) return;
    var ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0e1116";
    ctx.fillRect(0, 0, cv.width, cv.height);
    // 边框
    ctx.fillStyle = "#4a3a6b";
    ctx.fillRect(0, 0, cv.width, this.CELL);
    ctx.fillRect(0, cv.height - this.CELL, cv.width, this.CELL);
    ctx.fillRect(0, 0, this.CELL, cv.height);
    ctx.fillRect(cv.width - this.CELL, 0, this.CELL, cv.height);
    // 中网
    ctx.fillStyle = "rgba(154,143,184,.5)";
    for (var y = 0; y < this.HEIGHT; y += 2) ctx.fillRect(cv.width / 2 - 1, y * this.CELL + 2, 2, this.CELL - 4);
    // 挡板
    ctx.fillStyle = "#5cd6d6";
    for (var i = 0; i < this.PADDLE_H; i++) {
      var yp = this.py + i - this.PADDLE_H / 2;
      var yc = this.cy + i - this.PADDLE_H / 2;
      if (yp > 0 && yp < this.HEIGHT - 1) ctx.fillRect(2 * this.CELL, yp * this.CELL, 4, this.CELL);
      if (yc > 0 && yc < this.HEIGHT - 1) ctx.fillRect((this.WIDTH - 3) * this.CELL, yc * this.CELL, 4, this.CELL);
    }
    // 球
    ctx.fillStyle = "#ffd75e";
    ctx.fillRect(this.bx * this.CELL, this.by * this.CELL, this.CELL, this.CELL);
    // 比分
    ctx.fillStyle = "#f2e8cf";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "left";
    ctx.fillText("你 " + this.ps + " : " + this.cs + " 村民", 8, 11);
  },

  drawStatic: function () {
    var cv = document.getElementById("pong-board");
    if (!cv) return;
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "#0e1116";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "#4a3a6b";
    ctx.fillRect(0, 0, cv.width, this.CELL);
    ctx.fillRect(0, cv.height - this.CELL, cv.width, this.CELL);
    ctx.fillRect(0, 0, this.CELL, cv.height);
    ctx.fillRect(cv.width - this.CELL, 0, this.CELL, cv.height);
    ctx.fillStyle = "rgba(154,143,184,.5)";
    for (var y = 0; y < this.HEIGHT; y += 2) ctx.fillRect(cv.width / 2 - 1, y * this.CELL + 2, 2, this.CELL - 4);
    ctx.fillStyle = "#5cd6d6";
    ctx.fillRect(2 * this.CELL, 8 * this.CELL, 4, this.PADDLE_H * this.CELL);
    ctx.fillRect((this.WIDTH - 3) * this.CELL, 8 * this.CELL, 4, this.PADDLE_H * this.CELL);
    ctx.fillStyle = "#ffd75e";
    ctx.fillRect((this.WIDTH / 2) * this.CELL, (this.HEIGHT / 2) * this.CELL, this.CELL, this.CELL);
    ctx.fillStyle = "#f2e8cf";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("点击 开始", cv.width / 2, 12);
  },

  end: function (win) {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
    var cv = document.getElementById("pong-board");
    if (cv && this.ptrHandler) { cv.removeEventListener("pointermove", this.ptrHandler); cv.removeEventListener("pointerdown", this.ptrHandler); }
    var self = this;
    var summary;
    if (win) {
      this.w.settle(2, "pong", "胜利奖金");
      this.stats.record("win", 100, [], 100);
      if (typeof GS !== "undefined" && GS.state) GS.addMood(GS.state, GS.moodDeltaForBet(100));
      summary = "★ 你赢了! 奖金 " + UI.moneySpan(200, true) + "<br>钱包 " + UI.moneySpan(this.w.balanceCents());
    } else {
      this.stats.record("lose", 100, [], -100);
      if (typeof GS !== "undefined" && GS.state) GS.addMood(GS.state, GS.moodDeltaForBet(-100));
      summary = "✗ 你输了，失去入场费 $1.00<br>钱包 " + UI.moneySpan(this.w.balanceCents());
    }
    this.w.save();
    var html = '<div class="panel game-screen"><h2>🏓 乒乓球</h2>' +
      '<p class="text" style="line-height:1.9">' + summary + '</p>' +
      '<div class="actions"><button class="pix-btn" id="pg-again">再来一局 ($1)</button>' +
      '<button class="pix-btn" id="pg-back">离开</button></div></div>';
    UI.open(html);
    this.bind("#pg-again", function () {
      self.w = Wallet.load();
      self.stats = self.w.statsFor("pong");
      self.w.settle(-1, "pong", "入场费");
      self.w.save();
      self.boardScreen();
    });
    this.bind("#pg-back", function () { self.exit(); });
  },

  exit: function () {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    var cv = document.getElementById("pong-board");
    if (cv && this.ptrHandler) { cv.removeEventListener("pointermove", this.ptrHandler); cv.removeEventListener("pointerdown", this.ptrHandler); }
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
