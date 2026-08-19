/* ui.js — DOM 界面层：HUD、对话框、面板、菜单（像素风，无外部资源） */
"use strict";

var UI = {
  overlay: null,
  speechTimer: null,

  init: function () {
    this.overlay = document.getElementById("overlay");
    var self = this;
    document.getElementById("btn-ledger").addEventListener("click", function () { self.ledgerPanel(); });
    document.getElementById("btn-quit").addEventListener("click", function () { self.quitToTitle(); });
    document.getElementById("hud-wallet").addEventListener("click", function () { self.walletPanel(); });
  },

  open: function (html) {
    this.overlay.innerHTML = html;
    this.overlay.classList.add("open");
    Engine.overlayOpen = true;
  },

  /* ---------- 🆕 升级版对话系统（2026-08-18）---------- */
  /* 显示底部台词（打字机效果，支持精灵表头像） */
  speechSay: function (npcName, text, charKey) {
    var box = document.getElementById("speech-box");
    if (!box) return;
    box.style.display = "";
    document.getElementById("speech-name").textContent = npcName + "：";
    document.getElementById("speech-actions").innerHTML = "";
    // 打字机效果
    var contentEl = document.getElementById("speech-content");
    contentEl.className = "speech-typing";
    contentEl.textContent = "";
    var self = this;
    var idx = 0;
    (function type() {
      if (idx < text.length) {
        contentEl.textContent = text.slice(0, idx + 1);
        idx++;
        setTimeout(type, 30);
      } else {
        contentEl.className = "";
      }
    })();
    // 头像（优先 LPC 大头像，回退到程序化 buildPortrait）
    var pDiv = document.getElementById("speech-portrait");
    var cv = document.getElementById("speech-canvas");
    if (charKey && typeof drawLPCHeadshot === "function" && LPC.ready) {
      try {
        var cctx = cv.getContext("2d");
        drawLPCHeadshot(cctx, charKey, cv, 3);
        pDiv.style.display = "";
      } catch (e) {
        try {
          var spr = buildPortrait(charKey);
          cv.width = spr.w; cv.height = spr.h;
          cv.style.width = (spr.w * 3) + "px";
          cv.style.height = (spr.h * 3) + "px";
          var cctx = cv.getContext("2d");
          var img = cctx.createImageData(spr.w, spr.h);
          img.data.set(spr.data);
          cctx.putImageData(img, 0, 0);
          pDiv.style.display = "";
        } catch (e2) { pDiv.style.display = "none"; }
      }
    } else if (charKey && typeof buildPortrait === "function") {
      try {
        var spr = buildPortrait(charKey);
        cv.width = spr.w; cv.height = spr.h;
        cv.style.width = (spr.w * 3) + "px";
        cv.style.height = (spr.h * 3) + "px";
        var cctx = cv.getContext("2d");
        var img = cctx.createImageData(spr.w, spr.h);
        img.data.set(spr.data);
        cctx.putImageData(img, 0, 0);
        pDiv.style.display = "";
      } catch (e) { pDiv.style.display = "none"; }
    } else { pDiv.style.display = "none"; }
    // 自动关闭计时器（5秒）
    if (this.speechTimer) clearTimeout(this.speechTimer);
    this.speechTimer = setTimeout(function () { UI.speechClose(); }, 5000);
    // 点击 speech-frame 立即关闭（无按钮时，不等5秒）
    var frame = box.querySelector(".speech-frame");
    if (frame) {
      var closeHandler = function (e) {
        if (e.target.tagName !== "BUTTON" && !e.target.closest(".speech-actions")) {
          UI.speechClose();
          frame.removeEventListener("click", closeHandler);
        }
      };
      frame.addEventListener("click", closeHandler);
    }
  },

  /* 关闭底部文本框 */
  speechClose: function () {
    var box = document.getElementById("speech-box");
    if (box) box.style.display = "none";
    if (this.speechTimer) { clearTimeout(this.speechTimer); this.speechTimer = null; }
  },

  /* NPC 对话：底部文本框 + 头像 + 按钮（升级版：精灵表头像 + 打字机） */
  speechNpcTalk: function (npc) {
    var self = this;
    var id = npc.def ? npc.def.id : npc.id;
    var charKey = npc.def ? npc.def.char : (npc.char || id);
    var name = NPC_NAMES[id] || (typeof G !== "undefined" && G.visitorById ? (function () {
      var v = GS.visitorById(id);
      return v ? v.name : id;
    })() : id);
    var talk = NPC_TALK[id] || NPC_TALK.generic || { greet: ["……"], village: ["……"], self: ["……"] };
    var hasStory = talk.story && talk.story.length;
    var box = document.getElementById("speech-box");
    if (!box) return;
    box.style.display = "";
    document.getElementById("speech-name").textContent = name + "：";
    // 打字机效果
    var contentEl = document.getElementById("speech-content");
    contentEl.className = "speech-typing";
    contentEl.textContent = "";
    var greetText = G.pick(talk.greet);
    (function type() {
      var idx = 0;
      (function t() {
        if (idx < greetText.length) {
          contentEl.textContent = greetText.slice(0, idx + 1);
          idx++;
          setTimeout(t, 30);
        } else {
          contentEl.className = "";
        }
      })();
    })();
    // 头像（优先 LPC 大头像，回退到程序化 buildPortrait）
    var pDiv = document.getElementById("speech-portrait");
    var cv = document.getElementById("speech-canvas");
    if (typeof drawLPCHeadshot === "function" && LPC.ready) {
      try {
        var cctx = cv.getContext("2d");
        drawLPCHeadshot(cctx, charKey, cv, 3);
        pDiv.style.display = "";
      } catch (e) {
        try {
          var spr = buildPortrait(charKey);
          cv.width = spr.w; cv.height = spr.h;
          cv.style.width = (spr.w * 3) + "px";
          cv.style.height = (spr.h * 3) + "px";
          var cctx = cv.getContext("2d");
          var img = cctx.createImageData(spr.w, spr.h);
          img.data.set(spr.data);
          cctx.putImageData(img, 0, 0);
          pDiv.style.display = "";
        } catch (e2) { pDiv.style.display = "none"; }
      }
    } else if (typeof buildPortrait === "function") {
      try {
        var spr = buildPortrait(charKey);
        cv.width = spr.w; cv.height = spr.h;
        cv.style.width = (spr.w * 3) + "px";
        cv.style.height = (spr.h * 3) + "px";
        var cctx = cv.getContext("2d");
        var img = cctx.createImageData(spr.w, spr.h);
        img.data.set(spr.data);
        cctx.putImageData(img, 0, 0);
        pDiv.style.display = "";
      } catch (e) { pDiv.style.display = "none"; }
    } else { pDiv.style.display = "none"; }
    // 按钮
    var acts = document.getElementById("speech-actions");
    var btns = [
      { label: "聊聊村里", topic: "village" },
      { label: "说点别的", topic: "self" },
      { label: "再打个招呼", topic: "greet" },
    ];
    if (hasStory) btns.push({ label: "📖 听故事", topic: "story" });
    btns.push({ label: "❓ 问问题", topic: "ask" });
    btns.push({ label: "走了", topic: "leave" });
    acts.innerHTML = btns.map(function (b) {
      return '<button class="rpg-choice" data-topic="' + b.topic + '">' + b.label + '</button>';
    }).join("");
    // 绑定按钮事件
    ["greet", "village", "self", "story"].forEach(function (topic) {
      var btn = acts.querySelector('[data-topic="' + topic + '"]');
      if (btn) btn.addEventListener("click", function () {
        self.speechSay(name, G.pick(talk[topic] || ["……"]), charKey);
      });
    });
    var askBtn = acts.querySelector('[data-topic="ask"]');
    if (askBtn) askBtn.addEventListener("click", function () { self.askPanel(id); });
    var leaveBtn = acts.querySelector('[data-topic="leave"]');
    if (leaveBtn) leaveBtn.addEventListener("click", function () { self.speechClose(); });
    if (this.speechTimer) clearTimeout(this.speechTimer);
  },

  close: function () {
    this.overlay.classList.remove("open");
    this.overlay.innerHTML = "";
    Engine.overlayOpen = false;
    this.updateHud();
  },

  /* ---------- HUD ---------- */
  updateHud: function () {
    var w = Wallet.load();
    var el = document.getElementById("hud-money");
    var cents = w.balanceCents();
    el.textContent = G.fmtCents(cents);
    el.style.color = cents < 0 ? "var(--red)" : "var(--gold)";
    document.getElementById("hud-scene").textContent = Engine.scene ? Engine.scene.name : "";
    if (cents < 0) document.getElementById("hud-scene").textContent += "  ⚠ 负债中";
    var dk = w.settings.difficulty;
    var dn = (BJ_DIFFICULTIES[dk] || BJ_DIFFICULTIES.standard).name;
    document.getElementById("hud-diff").textContent = "难度 " + dn;
    // 时间 + 心情
    var p = GS.load(w);
    var pi = GS.periodInfo(p);
    var face = GS.moodFace(p.mood);
    var clock = document.getElementById("hud-clock");
    if (clock) {
      clock.textContent = pi.icon + " " + pi.name + " ｜ 第" + p.day + "天 ｜ " + face.face + " " + face.label + "(" + p.mood + ")";
      clock.title = GS.calendarText(p);
    }
  },

  /* ---------- 输入名字（首日确认 / 改名） ---------- */
  askName: function (callback, defaultValue) {
    var self = this;
    var html = '<div class="panel dialog"><h2>✒️ 掌柜的问你的名字</h2>' +
      '<p class="text">奥托拿起笔：“客官怎么称呼？住店要登记。”（之后可花 ' + G.fmtCents(GS.RENAME_COST) + ' 改名）</p>' +
      '<input id="name-input" type="text" maxlength="16" value="' + defaultValue + '" ' +
      'style="width:100%;font-family:inherit;font-size:16px;padding:8px;background:#120c22;color:var(--cream);border:3px solid var(--line)">' +
      '<div class="actions"><button class="pix-btn" id="name-ok">就叫这个</button></div></div>';
    this.open(html);
    var input = document.getElementById("name-input");
    input.focus();
    input.select();
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") document.getElementById("name-ok").click();
    });
    document.getElementById("name-ok").addEventListener("click", function () {
      self.close();  // 先关遮罩（UI.say 走底部框不会自动关）
      callback((input.value || "").trim() || defaultValue);
    });
  },

  /* ---------- 通用文本输入（寄信等） ---------- */
  askText: function (title, prompt, defaultText, callback) {
    var html = '<div class="panel dialog"><h2>' + title + '</h2>' +
      '<p class="text">' + prompt + '</p>' +
      '<input id="text-input" type="text" maxlength="60" value="' + defaultText + '" ' +
      'style="width:100%;font-family:inherit;font-size:15px;padding:8px;background:#120c22;color:var(--cream);border:3px solid var(--line)">' +
      '<div class="actions"><button class="pix-btn" id="text-ok">寄出去</button>' +
      '<button class="pix-btn" id="text-cancel">算了</button></div></div>';
    this.open(html);
    var input = document.getElementById("text-input");
    input.focus();
    document.getElementById("text-ok").addEventListener("click", function () {
      self.close();  // 先关遮罩（UI.say 走底部框不会自动关）
      callback((input.value || "").trim());
    });
    document.getElementById("text-cancel").addEventListener("click", function () { this.close(); }.bind(this));
  },

  /* ---------- 底部台词条（随机对话/系统提醒） ---------- */
  speech: function (text, ttl) {
    var self = this;
    var bar = document.getElementById("speech-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "speech-bar";
      document.body.appendChild(bar);
    }
    bar.textContent = text;
    bar.classList.add("show");
    if (this._speechTimer) clearTimeout(this._speechTimer);
    this._speechTimer = setTimeout(function () {
      bar.classList.remove("show");
      self._speechTimer = null;
    }, ttl || 2600);
  },

  /* ---------- 日历面板 ---------- */
  calendarPanel: function () {
    var w = Wallet.load();
    var p = GS.load(w);
    var pi = GS.periodInfo(p);
    var face = GS.moodFace(p.mood);
    var self = this;
    var rows = '<div class="row"><span>日期</span><span>' + GS.calendarText(p) + '</span></div>';
    rows += '<div class="row"><span>时间段</span><span>' + pi.icon + ' ' + pi.name + '</span></div>';
    rows += '<div class="row"><span>心情</span><span>' + face.face + ' ' + face.label + ' (' + p.mood + '/100)</span></div>';
    rows += '<div class="row"><span>村里印象</span><span>' + GS.repTitle(p) + ' (' + (p.reputation || 10) + '/100)</span></div>';
    rows += '<div class="row"><span>进度</span><span>' + GS.progressText(p) + '</span></div>';
    rows += '<div class="row"><span>版本</span><span style="color:var(--dim)">' + G.VERSION + '</span></div>';
    rows += '<p class="flavor">墙上挂着一本旧日历，页脚用炭笔写着：\u201c别赌太大。\u201d——像是奶奶的字。</p>';
    var html = '<div class="panel"><h2>📅 日历</h2>' + rows +
      '<div class="actions"><button class="pix-btn" id="cal-close">合上</button>' +
      '<button class="pix-btn" id="cal-sleep">睡觉（到明天早晨）</button>' +
      '<button class="pix-btn" id="cal-log">📜 更新记录</button></div></div>';
    this.open(html);
    document.getElementById("cal-close").addEventListener("click", function () { self.close(); });
    document.getElementById("cal-sleep").addEventListener("click", function () { self.close(); G.ACTIONS.rest(); });
    var logBtn = document.getElementById("cal-log");
    if (logBtn) logBtn.addEventListener("click", function () { UI.changelogPanel(); });
  },

  /* ---------- 通用对话框 ---------- */
  dialog: function (title, lines, buttons) {
    var html = '<div class="panel dialog"><h2>' + title + '</h2>';
    lines.forEach(function (l) { html += '<p class="text">' + l + '</p>'; });
    html += '<div class="actions">';
    (buttons || [{ label: "好", act: "close", cls: "" }]).forEach(function (b) {
      html += '<button class="pix-btn ' + (b.cls || "") + '" data-act="' + b.act + '">' + b.label + '</button>';
    });
    html += '</div></div>';
    this.open(html);
    var self = this;
    this.overlay.querySelectorAll("button[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var act = btn.getAttribute("data-act");
        var hit = (buttons || []).find(function (b) { return b.act === act; });
        if (hit && hit.fn) hit.fn();
        else self.close();
      });
    });
  },

  /* ---------- 暂停菜单 ---------- */
  pauseMenu: function () {
    var self = this;
    var buttons = [{ label: "继续", act: "resume", fn: function () { self.close(); } }];
    if (Engine.sceneName === "lobby") {
      buttons.push({ label: "回房休息", act: "room", fn: function () {
        self.close();
        Engine.setScene("room");
        UI.say("你沿楼梯回到二楼的小房间。");
      }});
    }
    buttons.push({ label: "退出酒馆", act: "quit", cls: "danger", fn: function () { self.quitToTitle(); } });
    this.dialog("⏸ 歇一歇", ["夜深了，酒馆里还亮着灯。", "想继续玩，还是回去休息？"], buttons);
  },

  quitToTitle: function () {
    Wallet.load().save();
    var self = this;
    var html = '<div class="panel" id="title-screen"><div class="logo">♠ 柳枝酒馆 ♠</div>' +
      '<div class="sub">Willow Tavern · 柳溪村</div>' +
      '<p class="flavor">钱包：<b id="tt-money">' + this.moneySpan(Wallet.load().balanceCents()) + '</b> 已保存</p>' +
      '<p class="flavor">推开酒馆的门，夜风扑面。要再进来坐坐吗？</p>' +
      '<div class="actions"><button class="pix-btn" id="tt-enter">再进酒馆</button></div></div>';
    this.open(html);
    document.getElementById("tt-enter").addEventListener("click", function () {
      self.close();
      Engine.setScene("room");
    });
  },

  /* ---------- 钱包面板（床头柜） ---------- */
  walletPanel: function () {
    var w = Wallet.load();
    var p = GS.load(w);
    var pi = GS.periodInfo(p);
    var face = GS.moodFace(p.mood);
    var self = this;
    var rows = "";
    rows += '<div class="row"><span>名字</span><span>' + GS.playerName(p) + '</span></div>';
    rows += '<div class="row"><span>钱包余额</span><span>' + this.moneySpan(w.balanceCents()) + '</span></div>';
    rows += '<div class="row"><span>总对局</span><span>' + w.totalGames() + ' 局</span></div>';
    rows += '<div class="row"><span>时间</span><span>' + pi.icon + ' ' + pi.name + ' ｜ ' + GS.calendarText(p) + '</span></div>';
    rows += '<div class="row"><span>心情</span><span>' + face.face + ' ' + face.label + ' (' + p.mood + '/100)</span></div>';
    rows += '<p class="flavor">村里通用：$1 折一银毫，零头铜板当面点清。</p>';
    if (w.balanceCents() < 0) rows += '<p class="flavor" style="color:var(--red)">⚠ 客官，账上负数了，悠着点。</p>';
    if (p.loan > 0) rows += '<div class="row"><span>欠商人贷款</span><span>' + this.moneySpan(-p.loan) + '（日息' + (GS.LOAN_DAILY_RATE * 100) + '%）</span></div>';
    // 难度
    var dk = w.settings.difficulty;
    rows += '<div class="row"><span>酒馆难度</span><span>';
    ["easy", "standard", "hard"].forEach(function (k) {
      rows += '<button class="pix-btn small" data-diff="' + k + '" style="' +
        (k === dk ? "border-color:var(--gold);color:var(--gold)" : "") + '">' +
        BJ_DIFFICULTIES[k].name + '</button> ';
    });
    rows += '</span></div>';
    // 最近流水
    rows += '<p class="flavor">— 最近流水 —</p>';
    var led = w.ledger.slice(-6).reverse();
    led.forEach(function (e) {
      rows += '<div class="row"><span>' + e.t + ' ' + e.game + '</span><span>' + e.reason + ' ' +
        self.moneySpan(e.delta, true) + '</span></div>';
    });
    if (!led.length) rows += '<p class="flavor">还没有收支记录。</p>';
    var html = '<div class="panel"><h2>💰 床头柜上的钱包</h2>' + rows +
      '<div class="actions">' +
      '<button class="pix-btn" data-act="close">收起</button>' +
      '<button class="pix-btn" data-act="rename">改名 ($' + (GS.RENAME_COST / 100) + ')</button>' +
      '<button class="pix-btn" data-act="export">导出存档</button>' +
      '<button class="pix-btn" data-act="import">导入存档</button>' +
      '<button class="pix-btn danger" data-act="quit">退出酒馆</button>' +
      '</div></div>';
    this.open(html);
    this.overlay.querySelectorAll("button[data-diff]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var w2 = Wallet.load();
        w2.settings.difficulty = btn.getAttribute("data-diff");
        w2.save();
        self.walletPanel();
      });
    });
    this.overlay.querySelectorAll("button[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var act = btn.getAttribute("data-act");
        if (act === "quit") self.quitToTitle();
        else if (act === "rename") self.renamePanel();
        else if (act === "export") self.exportSave();
        else if (act === "import") self.importSave();
        else self.close();
      });
    });
  },

  /* 导出存档：复制文本到剪贴板/手动复制（跨设备迁移） */
  exportSave: function () {
    var raw = "{}";
    try { raw = localStorage.getItem(SAVE_KEY) || "{}"; } catch (e) {}
    var self = this;
    var html = '<div class="panel dialog"><h2>📤 导出存档</h2>' +
      '<p class="text">把下面这段文本存好（发给自己/备忘录），到另一台设备上用它「导入存档」即可迁移进度。不同网址的存档不通用，迁移后统一用新链接玩。</p>' +
      '<textarea id="export-text" readonly style="width:100%;height:120px;font-family:inherit;font-size:11px;background:#120c22;color:var(--cream);border:3px solid var(--line);padding:6px">' + raw + '</textarea>' +
      '<div class="actions"><button class="pix-btn" id="export-copy">复制</button>' +
      '<button class="pix-btn" id="export-close">关闭</button></div></div>';
    this.open(html);
    document.getElementById("export-copy").addEventListener("click", function () {
      var ta = document.getElementById("export-text");
      ta.select();
      ta.setSelectionRange(0, 999999);
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value).then(function () { ok = true; });
      }
      UI.speech(ok ? "已复制到剪贴板。" : "请手动长按选择并复制。");
    });
    document.getElementById("export-close").addEventListener("click", function () { self.close(); });
  },

  /* 导入存档：粘贴文本恢复（覆盖当前进度） */
  importSave: function () {
    var self = this;
    var html = '<div class="panel dialog"><h2>📥 导入存档</h2>' +
      '<p class="text">粘贴从另一台设备「导出存档」得到的文本。导入会<b>覆盖当前进度</b>，导入成功后刷新页面生效。</p>' +
      '<textarea id="import-text" placeholder="粘贴存档文本…" style="width:100%;height:120px;font-family:inherit;font-size:11px;background:#120c22;color:var(--cream);border:3px solid var(--line);padding:6px"></textarea>' +
      '<div class="actions"><button class="pix-btn" id="import-ok">导入</button>' +
      '<button class="pix-btn" id="import-cancel">取消</button></div></div>';
    this.open(html);
    document.getElementById("import-ok").addEventListener("click", function () {
      var raw = (document.getElementById("import-text").value || "").trim();
      var data;
      try { data = JSON.parse(raw); } catch (e) { UI.say("导入", "这看起来不是有效的存档文本……"); return; }
      if (!data || typeof data !== "object" || typeof data.chips === "undefined") {
        UI.say("导入", "存档内容不对，确认是完整复制了吗？");
        return;
      }
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        if (typeof GS !== "undefined") GS.reset();
        UI.say("导入", "导入成功！刷新页面后生效。");
      } catch (e) { UI.say("导入", "写入失败：" + e.message); }
    });
    document.getElementById("import-cancel").addEventListener("click", function () { self.close(); });
  },

  /* 改名（花 $5） */
  renamePanel: function () {
    var self = this;
    this.askName(function (name) {
      var w = Wallet.load();
      var r = GS.rename(w, name);
      w.save();
      if (r === null) {
        UI.dialog("商人", ["改名要花 " + G.fmtCents(GS.RENAME_COST) + "，你账上不够。"],
          [{ label: "好", act: "ok", fn: function () { self.walletPanel(); } }]);
        return;
      }
      UI.say("商人", "得，账册上改成 " + r + " 了。");
    }, GS.playerName(GS.load(Wallet.load())));
  },

  /* 给丽塔送礼（花/蛋糕）：$2、好感+1、一天一次 */
  buyRitaGift: function (kind) {
    var self = this;
    var w = Wallet.load();
    var p = GS.load(w);
    if (!GS.canGiftRita(p)) {
      UI.dialog("丽塔", ["今天已经收过你的心意啦，明天再来吧。"],
        [{ label: "好", act: "ok", fn: function () { self.close(); } }]);
      return;
    }
    if (w.balanceCents() < GS.RITA_GIFT_PRICE) {
      UI.dialog("丽塔", ["你的好意我心领啦——不过你好像连 " + G.fmtCents(GS.RITA_GIFT_PRICE) + " 都没有？"],
        [{ label: "好", act: "ok", fn: function () { self.close(); } }]);
      return;
    }
    w.settle(-GS.RITA_GIFT_PRICE / 100, "rita", kind === "cake" ? "送丽塔蛋糕" : "送丽塔花");
    GS.giftRita(p);
    GS.addMood(p, GS.RITA_GIFT_MOOD);
    w.save();
    this.updateHud();
    var lines = kind === "cake"
      ? ["你把刚买的蛋糕递过去。", "丽塔眼睛一亮：“给我的？……谢谢！这蛋糕闻着就香！”"]
      : ["你把一束野花递过去。", "丽塔愣了一下，红着脸接过去：“呀，还挺好看的……谢谢你！”"];
    UI.dialog("🌷 丽塔", lines.concat(["丽塔对你的好感 +1（" + p.rita + "）"]),
      [{ label: "好", act: "ok", fn: function () { self.close(); } }]);
  },

  /* ---------- 账册面板（商人） ---------- */
  ledgerPanel: function () {
    var w = Wallet.load();
    var self = this;
    var rows = '<p class="flavor">— 战绩总览 —</p>';
    var names = {
      blackjack: "21点", poker: "德州扑克", snake: "贪吃蛇", uno: "UNO",
    };
    var keys = Object.keys(w.stats);
    if (!keys.length) {
      rows += '<p class="flavor">还没有对局记录。</p>';
    } else {
      keys.forEach(function (k) {
        var s = w.stats[k];
        var rate = s.games ? (s.wins / s.games * 100).toFixed(1) + "%" : "-";
        rows += '<div class="row"><span>' + (names[k] || k) + ' ' + s.games + '局</span><span>胜' + s.wins +
          '/负' + s.losses + '/平' + s.pushes + ' 胜率' + rate + ' 净' + self.moneySpan(s.net, true) + '</span></div>';
      });
    }
    rows += '<p class="flavor">— 最近流水 —</p>';
    var led = w.ledger.slice(-8).reverse();
    led.forEach(function (e) {
      rows += '<div class="row"><span>' + e.t + ' ' + e.game + '</span><span>' + e.reason + ' ' +
        self.moneySpan(e.delta, true) + '</span></div>';
    });
    if (!led.length) rows += '<p class="flavor">账本还是空白。</p>';
    var html = '<div class="panel"><h2>📒 商人的账册</h2>' + rows +
      '<div class="actions"><button class="pix-btn" data-act="close">合上账本</button>' +
      '<button class="pix-btn" id="ledger-shop">🛒 购置家具</button>' +
      '<button class="pix-btn" id="ledger-loan">💰 贷款</button></div></div>';
    this.open(html);
    this.overlay.querySelectorAll("button[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function () { self.close(); });
    });
    document.getElementById("ledger-shop").addEventListener("click", function () { self.shopPanel(); });
    document.getElementById("ledger-loan").addEventListener("click", function () { self.loanPanel(); });
  },

  /* ---------- 贷款（商人） ---------- */
  loanPanel: function () {
    var self = this;
    var w = Wallet.load();
    var p = GS.load(w);
    var loan = p.loan || 0;
    var rows = '<p class="flavor">商人拨着算盘：“周转的钱，我这儿有——利息嘛，一厘不让。”</p>';
    rows += '<div class="row"><span>钱包现金</span><span>' + this.moneySpan(w.balanceCents()) + '</span></div>';
    rows += '<div class="row"><span>欠商人的贷款</span><span>' + (loan > 0 ? this.moneySpan(-loan) : "没有") + '</span></div>';
    if (loan > 0) {
      rows += '<p class="flavor" style="color:var(--red)">日息 ' + (GS.LOAN_DAILY_RATE * 100) + '%，睡一觉就滚一次利息。债多压身，尽快还清。</p>';
    } else {
      rows += '<p class="flavor">可贷 $10 / $20 / $50（日息 ' + (GS.LOAN_DAILY_RATE * 100) + '%，睡一觉计一次）。</p>';
    }
    var html = '<div class="panel"><h2>💰 佩尔的放贷</h2>' + rows +
      '<div class="actions">' +
      GS.LOAN_AMOUNTS.map(function (a) {
        return '<button class="pix-btn" data-loan="' + a + '">贷 ' + G.fmtCents(a) + '</button>';
      }).join("") +
      (loan > 0 ? '<button class="pix-btn" data-repay="500">还 $5</button>' +
        '<button class="pix-btn" data-repay="1000">还 $10</button>' +
        '<button class="pix-btn" data-repay="' + loan + '">还清</button>' : '') +
      '<button class="pix-btn" id="loan-close">不借了</button></div></div>';
    this.open(html);
    GS.LOAN_AMOUNTS.forEach(function (a) {
      var btn = document.querySelector('[data-loan="' + a + '"]');
      if (btn) btn.addEventListener("click", function () {
        GS.takeLoan(w, a);
        w.save();
        UI.say("商人", "银毫当面点清，账上记着：" + G.fmtCents(GS.load(w).loan) + "。利息一厘不让，记得早点还。");
      });
    });
    var repBtns = UI.overlay.querySelectorAll('[data-repay]');
    repBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var amt = Number(btn.getAttribute("data-repay"));
        var left = GS.repayLoan(w, amt);
        w.save();
        if (left === null) {
          UI.dialog("商人", ["现金不够，先想法子弄点钱吧。"], [{ label: "好", act: "ok", fn: function () { self.loanPanel(); } }]);
          return;
        }
        if (left === 0) UI.say("商人", "账清了，银货两讫。以后缺钱，还来找我。");
        else UI.say("商人", "还了" + G.fmtCents(amt) + "，还欠 " + G.fmtCents(left) + "。");
      });
    });
    document.getElementById("loan-close").addEventListener("click", function () { self.close(); });
  },

  /* ---------- 吧台：酒水小吃 ---------- */
  barMenu: function () {
    var self = this;
    var w = Wallet.load();
    var p = GS.load(w);
    var rows = '<p class="flavor">奥托擦着杯子：“老规矩？今儿有刚到的麦酒。”</p>';
    rows += '<div class="row"><span>钱包</span><span>' + this.moneySpan(w.balanceCents()) +
      '</span><span>心情 ' + p.mood + '</span></div>';
    rows += '<div class="row"><span>村里对你的印象</span><span>' + GS.repTitle(p) + '（' + (p.reputation || 10) + '）</span></div>';
    BAR_MENU.forEach(function (item) {
      rows += '<div class="row" style="align-items:flex-start">' +
        '<span><b>' + item.name + '</b><br><small style="color:var(--dim)">' + item.desc + '</small></span>' +
        '<span style="text-align:right">' + self.moneySpan(item.price) + '<br><small style="color:var(--green)">心情+' + item.mood + '</small></span>' +
        '</div>';
    });
    rows += '<p class="flavor">—— 🎂 给丽塔（好感度系统，一天一次）——</p>';
    rows += '<div class="row"><span>丽塔对你的好感</span><span>' + (p.rita || 0) + '/100' +
      (GS.canGiftRita(p) ? ' <small style="color:var(--green)">（今天还没送）</small>' : ' <small style="color:var(--dim)">（今天送过了）</small>') + '</span></div>';
    rows += '<p class="flavor">—— 请客（提升村里对你的认同度）——</p>';
    TREAT_OPTIONS.forEach(function (t) {
      rows += '<div class="row" style="align-items:flex-start">' +
        '<span><b>🍻 ' + t.name + '</b><br><small style="color:var(--dim)">' + t.desc + '</small></span>' +
        '<span style="text-align:right">' + self.moneySpan(t.price) + '<br><small style="color:var(--cyan)">认同度+' + t.rep + '</small></span>' +
        '</div>';
    });
    var html = '<div class="panel"><h2>🍺 吧台</h2>' + rows +
      '<div class="actions">' +
      BAR_MENU.map(function (item) {
        return '<button class="pix-btn" data-buy="' + item.id + '">买 ' + item.name + '</button>';
      }).join("") +
      TREAT_OPTIONS.map(function (t) {
        return '<button class="pix-btn" data-treat="' + t.id + '">' + t.name + '</button>';
      }).join("") +
      (GS.canGiftRita(p) ? '<button class="pix-btn" data-rita="cake">🎂 买蛋糕送丽塔 $2</button>' : '') +
      '<button class="pix-btn" id="bar-close">不喝了</button></div></div>';
    this.open(html);
    BAR_MENU.forEach(function (item) {
      var btn = document.querySelector('[data-buy="' + item.id + '"]');
      if (btn) btn.addEventListener("click", function () { self.buyBarItem(item.id); });
    });
    TREAT_OPTIONS.forEach(function (t) {
      var btn = document.querySelector('[data-treat="' + t.id + '"]');
      if (btn) btn.addEventListener("click", function () { self.buyTreat(t.id); });
    });
    var ritaBtn = document.querySelector('[data-rita="cake"]');
    if (ritaBtn) ritaBtn.addEventListener("click", function () { self.buyRitaGift("cake"); });
    document.getElementById("bar-close").addEventListener("click", function () { self.close(); });
  },

  /* 请全场喝酒：扣钱 + 认同度 + NPC 道谢 */
  buyTreat: function (id) {
    var self = this;
    var w = Wallet.load();
    var p = GS.load(w);
    var t = TREAT_OPTIONS.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    if (w.balanceCents() < t.price) {
      UI.dialog("老板", ["钱包不够，先赢点钱再来吧。"], [{ label: "好", act: "ok", fn: function () { self.barMenu(); } }]);
      return;
    }
    // 先确认再扣钱（避免误触白花）
    UI.dialog("🍻 请客确认", [t.name + "：花 " + G.fmtCents(t.price) + "，村里认同度 +" + t.rep, t.desc, "要请吗？"],
      [
        { label: "请", act: "yes", fn: function () { self._doTreat(t); } },
        { label: "算了", act: "no", fn: function () { self.barMenu(); } },
      ]);
  },

  /* 确认后的请客扣款 */
  _doTreat: function (t) {
    var self = this;
    var w = Wallet.load();
    var p = GS.load(w);
    w.settle(-t.price / 100, "bar", "请客：" + t.name);
    GS.addReputation(p, t.rep);
    w.save();
    this.updateHud();
    var faces = ["老板举起酒杯：“谢啦！今天算你的。”",
      "醉汉一饮而尽：“好酒！你这人够意思。”",
      "村民腼腆地点头：“俺记住你的好。”",
      "商人抿了一口：“这份人情，我记在账上了。”"];
    UI.dialog("🍻 请客", [t.desc, faces[Math.floor(Math.random() * faces.length)],
      "村里人对你的认同度 +" + t.rep + "（" + GS.repTitle(p) + " " + p.reputation + "）"],
      [{ label: "好", act: "ok", fn: function () { self.barMenu(); } }]);
  },

  buyBarItem: function (id) {
    var self = this;
    var w = Wallet.load();
    var p = GS.load(w);
    var item = BAR_MENU.filter(function (x) { return x.id === id; })[0];
    if (!item) return;
    if (w.balanceCents() < item.price) {
      UI.dialog("老板", ["钱包不够，先赢点钱再来吧。"], [{ label: "好", act: "ok", fn: function () { self.barMenu(); } }]);
      return;
    }
    w.settle(-item.price / 100, "bar", "买了" + item.name);
    GS.addMood(p, item.mood);
    w.save();
    this.updateHud();
    UI.dialog("🍺 " + item.name, [item.desc, "你" + (item.id === "ale" ? "灌了一大口麦酒" : "吃了起来") + "，心情 " +
      (item.mood >= 0 ? "+" : "") + item.mood + "。"],
      [{ label: "好", act: "ok", fn: function () { self.barMenu(); } }]);
  },

  /* ---------- 商店：购置家具 ---------- */
  shopPanel: function () {
    var self = this;
    var w = Wallet.load();
    var p = GS.load(w);
    var owned = p.furniture || [];
    var rows = '<p class="flavor">佩尔摊开货单：“都是好东西，伙计——你屋里缺的。”</p>';
    rows += '<div class="row"><span>钱包</span><span>' + this.moneySpan(w.balanceCents()) + '</span></div>';
    rows += '<div class="row"><span>丽塔对你的好感</span><span>' + (p.rita || 0) + '/100' +
      (GS.canGiftRita(p) ? ' <small style="color:var(--green)">（今天还没送）</small>' : ' <small style="color:var(--dim)">（今天送过了）</small>') + '</span></div>';
    FURNITURE.forEach(function (f) {
      var has = owned.indexOf(f.id) >= 0;
      var name = f.name + (has ? " ✅" : "");
      var size = f.w > 1 || f.h > 1 ? "（" + f.w + "×" + f.h + " 格）" : "";
      rows += '<div class="row" style="align-items:flex-start">' +
        '<span><b>' + name + '</b>' + size + '<br><small style="color:var(--dim)">' + f.desc + '</small></span>' +
        '<span style="text-align:right">' + (has ? '<small style="color:var(--green)">已购置</small>' : self.moneySpan(f.price)) + '</span>' +
        '</div>';
    });
    var html = '<div class="panel"><h2>🛒 佩尔的杂货铺</h2>' + rows +
      '<div class="actions">' +
      FURNITURE.map(function (f) {
        var has = owned.indexOf(f.id) >= 0;
        return has ? '' : '<button class="pix-btn" data-buy="' + f.id + '">买 ' + f.name + '</button>';
      }).join("") +
      (GS.canGiftRita(p) ? '<button class="pix-btn" data-rita="flower">🌷 买花送丽塔 $2</button>' : '') +
      '<button class="pix-btn" id="shop-close">再看看</button></div></div>';
    this.open(html);
    FURNITURE.forEach(function (f) {
      var btn = document.querySelector('[data-buy="' + f.id + '"]');
      if (btn) btn.addEventListener("click", function () { self.buyFurniture(f.id); });
    });
    var ritaBtn = document.querySelector('[data-rita="flower"]');
    if (ritaBtn) ritaBtn.addEventListener("click", function () { self.buyRitaGift("flower"); });
    document.getElementById("shop-close").addEventListener("click", function () { self.close(); });
  },

  buyFurniture: function (id) {
    var self = this;
    var w = Wallet.load();
    var p = GS.load(w);
    var f = FURNITURE.filter(function (x) { return x.id === id; })[0];
    if (!f) return;
    if (w.balanceCents() < f.price) {
      UI.dialog("佩尔", ["钱不够，要不先赢两把再来？"], [{ label: "好", act: "ok", fn: function () { self.shopPanel(); } }]);
      return;
    }
    w.settle(-f.price / 100, "shop", "购置" + f.name);
    p.furniture = p.furniture || [];
    p.furniture.push(id);
    GS.addMood(p, 5);
    w.save();
    this.updateHud();
    UI.dialog("🛒 购置成功", [f.name + "已经送进你的房间了。（心情 +5）"],
      [{ label: "好", act: "ok", fn: function () { self.shopPanel(); } }]);
  },

  /* ---------- 钓鱼（河边，时机小游戏） ---------- */
  fishingPanel: function () {
    var self = this;
    this._fishTimer = null;
    this._fishBit = false;
    var html = '<div class="panel game-screen"><h2>🎣 河边钓鱼</h2>' +
      '<p class="flavor">浮标在河面上漂着，鱼咬钩时点「收杆」——收早了是空竿。</p>' +
      '<p class="table-line" id="fish-status">你把鱼饵挂好，抛下鱼竿……（鱼饵 $0.1）</p>' +
      '<div class="actions" id="fish-actions"></div></div>';
    this.open(html);
    this.fishCast();
  },

  fishCast: function () {
    var self = this;
    var w = Wallet.load();
    if (w.balanceCents() < 10) {
      var st = document.getElementById("fish-status");
      st.textContent = "连鱼饵都买不起了……（鱼饵 $0.1）";
      var ac = document.getElementById("fish-actions");
      ac.innerHTML = '<button class="pix-btn" id="fish-leave">收竿回家</button>';
      document.getElementById("fish-leave").addEventListener("click", function () { self.close(); });
      return;
    }
    w.settle(-0.1, "fish", "鱼饵");
    w.save();
    this._fishBit = false;
    var status = document.getElementById("fish-status");
    status.textContent = "你把鱼饵挂好，抛下鱼竿……";
    status.style.color = "";
    var actions = document.getElementById("fish-actions");
    actions.innerHTML = '<button class="pix-btn" id="fish-reel">收杆</button>' +
      '<button class="pix-btn" id="fish-leave">收竿回家</button>';
    document.getElementById("fish-reel").addEventListener("click", function () {
      if (self._fishBit) {
        // 咬钩后收杆：70% 上钩
        if (Math.random() < 0.7) self.fishResult(GS.fishPool());
        else self.fishAfter("鱼脱钩了……下次手要稳。");
      } else {
        self.fishAfter("还没上钩呢，收早了——空竿。");
      }
    });
    document.getElementById("fish-leave").addEventListener("click", function () {
      self._clearFishTimer();
      self.close();
    });
    // 等待 2~4 秒咬钩
    this._fishTimer = setTimeout(function () {
      if (Math.random() < 0.25) {
        // 假咬钩：浮标动了一下又没动静，继续等
        status.textContent = "浮标轻轻晃了一下……是水流，继续等。";
        self._fishTimer = setTimeout(function () {
          self._fishBit = true;
          status.textContent = "浮标猛地一沉——有鱼咬钩了！！！快收杆！";
          status.style.color = "var(--gold)";
          self._fishTimer = setTimeout(function () {
            self.fishAfter("……你慢了一步，鱼跑了。");
          }, 1800);
        }, 1500);
      } else {
        self._fishBit = true;
        status.textContent = "浮标猛地一沉——有鱼咬钩了！！！快收杆！";
        status.style.color = "var(--gold)";
        self._fishTimer = setTimeout(function () {
          self.fishAfter("……你慢了一步，鱼跑了。");
        }, 1800);
      }
    }, 2000 + Math.random() * 2000);
  },

  _clearFishTimer: function () {
    if (this._fishTimer) { clearTimeout(this._fishTimer); this._fishTimer = null; }
  },

  /* 钓鱼结束（空竿/跑掉） */
  fishAfter: function (msg) {
    var self = this;
    this._clearFishTimer();
    var status = document.getElementById("fish-status");
    status.textContent = msg || "今天没什么收获。";
    status.style.color = "";
    var actions = document.getElementById("fish-actions");
    actions.innerHTML = '<button class="pix-btn" id="fish-cast">再抛一竿</button>' +
      '<button class="pix-btn" id="fish-leave">收竿回家</button>';
    document.getElementById("fish-cast").addEventListener("click", function () { self.fishCast(); });
    document.getElementById("fish-leave").addEventListener("click", function () { self.close(); });
  },

  /* 钓到鱼：卖 / 制成标本 / 放生 */
  fishResult: function (fish) {
    var self = this;
    this._clearFishTimer();
    var w = Wallet.load();
    var p = GS.load(w);
    var status = document.getElementById("fish-status");
    status.textContent = "钓上来一条" + fish.name + "！" + fish.desc;
    status.style.color = "var(--gold)";
    var actions = document.getElementById("fish-actions");
    actions.innerHTML = '<button class="pix-btn" id="fish-sell">卖 ' + G.fmtCents(fish.price) + '</button>' +
      '<button class="pix-btn" id="fish-taxi">制成标本</button>' +
      '<button class="pix-btn" id="fish-free">放生</button>' +
      '<button class="pix-btn" id="fish-cast2">再抛一竿</button>' +
      '<button class="pix-btn" id="fish-leave2">收竿回家</button>';
    document.getElementById("fish-sell").addEventListener("click", function () {
      w.settle(fish.price / 100, "fish", "卖鱼(" + fish.name + ")");
      w.save();
      UI.say("老板", "这" + fish.name + "不错，收下了。" + G.fmtCents(fish.price) + " 拿好。");
    });
    document.getElementById("fish-taxi").addEventListener("click", function () {
      var ok = GS.addTrophy(p, fish.name);
      w.save();
      if (ok) UI.say("标本", "你把" + fish.name + "制成了标本，挂到了房间墙上。");
      else self.fishAfter("墙上已经挂满两条标本，没地方再挂了。");
    });
    document.getElementById("fish-free").addEventListener("click", function () {
      UI.say("放生", "你把" + fish.name + "轻轻放回河里，它一摆尾就没影了。");
    });
    document.getElementById("fish-cast2").addEventListener("click", function () { self.fishCast(); });
    document.getElementById("fish-leave2").addEventListener("click", function () { self.close(); });
  },

  /* ---------- 农田（艾尔：买地/种子/雇工/播种） ---------- */
  farmPanel: function () {
    var self = this;
    var w = Wallet.load();
    var p = GS.load(w);
    var free = p.farmland - p.planted;
    var whText = p.warehouse === 2 ? "已建成（存货 " + G.fmtCents(p.stored) + "）"
      : (p.warehouse === 1 ? "建造中（第 " + Math.max(0, p.warehouseDay - p.day) + " 天后好）"
        : "未建（找罗伯特，$30）");
    var rows = '<p class="flavor">艾尔蹲在摊边：“想置地？种子、雇工、地块，我这儿都齐活。”</p>';
    rows += '<div class="row"><span>钱包</span><span>' + this.moneySpan(w.balanceCents()) + '</span></div>';
    rows += '<div class="row"><span>农田</span><span>' + p.farmland + ' 块（已种 ' + p.planted + '）</span></div>';
    rows += '<div class="row"><span>种子</span><span>' + p.seeds + ' 袋</span></div>';
    rows += '<div class="row"><span>雇工</span><span>还剩 ' + p.workerDays + ' 天（$1/块/天，只算已播种）</span></div>';
    rows += '<div class="row"><span>仓库</span><span>' + whText + '</span></div>';
    var canPlant = free > 0 && p.seeds > 0 && p.workerDays > 0;
    var html = '<div class="panel"><h2>🌾 艾尔的农具摊</h2>' + rows +
      '<div class="actions">' +
      '<button class="pix-btn" data-farm="land">买地 $20</button>' +
      '<button class="pix-btn" data-farm="seed">买种子 $2</button>' +
      '<button class="pix-btn" data-farm="hire">雇工 $1/块/天</button>' +
      (canPlant ? '<button class="pix-btn" data-farm="plant">播种（1袋/块）</button>' : '') +
      '<button class="pix-btn" id="farm-close">走了</button></div></div>';
    this.open(html);
    [
      ["land", function () {
        var r = GS.buyLand(w); w.save();
        if (r === null) UI.dialog("艾尔", ["$20 都没有？那地可种不了。"], [{ label: "好", act: "ok", fn: function () { self.farmPanel(); } }]);
        else UI.say("艾尔", "地契画押，这块地归你了。" + r + " 块了。");
      }],
      ["seed", function () {
        var r = GS.buySeeds(w, 1); w.save();
        if (r === null) UI.dialog("艾尔", ["一袋 $2，掏钱吧。"], [{ label: "好", act: "ok", fn: function () { self.farmPanel(); } }]);
        else UI.say("艾尔", "陈年麦种，出芽慢点，能种。" + r + " 袋了。");
      }],
      ["hire", function () {
        var r = GS.hireWorker(w, 1); w.save();
        if (r === null) UI.dialog("艾尔", ["雇人要先付工钱 $5。"], [{ label: "好", act: "ok", fn: function () { self.farmPanel(); } }]);
        else UI.say("艾尔", "河对岸的壮劳力，明儿就来。" + r + " 天。");
      }],
      ["plant", function () {
        var r = GS.plant(p); w.save();
        if (r === null) UI.dialog("艾尔", ["得先有地、有种子、有雇工才行。"], [{ label: "好", act: "ok", fn: function () { self.farmPanel(); } }]);
        else UI.say("艾尔", "种下去了，" + GS.HARVEST_DAYS + " 天后收成。" + r + " 块在长。");
      }],
    ].forEach(function (pair) {
      var btn = document.querySelector('[data-farm="' + pair[0] + '"]');
      if (btn) btn.addEventListener("click", pair[1]);
    });
    document.getElementById("farm-close").addEventListener("click", function () { self.close(); });
  },

  /* ---------- 工地（罗伯特：盖仓库） ---------- */
  warehousePanel: function () {
    var self = this;
    var w = Wallet.load();
    var p = GS.load(w);
    var rows = '<p class="flavor">罗伯特把图纸铺在地上：“仓库，$" + (GS.WAREHOUSE_PRICE / 100) + "，三天盖好，不讲价。”</p>';
    rows += '<div class="row"><span>钱包</span><span>' + this.moneySpan(w.balanceCents()) + '</span></div>';
    if (p.warehouse === 0) {
      rows += '<div class="row"><span>仓库</span><span>未建</span></div>';
      rows += '<p class="flavor">没有仓库，收成只能贱卖。盖好以后，农产品就能存着了。</p>';
    } else if (p.warehouse === 1) {
      rows += '<div class="row"><span>仓库</span><span>建造中（' + Math.max(0, p.warehouseDay - p.day) + ' 天后好）</span></div>';
    } else {
      rows += '<div class="row"><span>仓库</span><span>已建成</span></div>';
      rows += '<div class="row"><span>存货</span><span>' + this.moneySpan(p.stored) + '</span></div>';
    }
    var html = '<div class="panel"><h2>🔨 罗伯特的工地</h2>' + rows +
      '<div class="actions">' +
      (p.warehouse === 0 ? '<button class="pix-btn" data-wh="build">盖仓库 $30</button>' : '') +
      (p.warehouse === 2 && p.stored > 0 ? '<button class="pix-btn" data-wh="sell">卖存货 ' + this.moneySpan(p.stored) + '</button>' : '') +
      '<button class="pix-btn" id="wh-close">走了</button></div></div>';
    this.open(html);
    var buildBtn = document.querySelector('[data-wh="build"]');
    if (buildBtn) buildBtn.addEventListener("click", function () {
      var r = GS.hireBuilder(w); w.save();
      if (r === null) UI.dialog("罗伯特", ["$30，先付定金。"], [{ label: "好", act: "ok", fn: function () { self.warehousePanel(); } }]);
      else UI.say("罗伯特", "成交。三天后来看，保你满意。");
    });
    var sellBtn = document.querySelector('[data-wh="sell"]');
    if (sellBtn) sellBtn.addEventListener("click", function () {
      var s = GS.sellStored(w); w.save();
      UI.say("罗伯特", "存货帮你卖了 " + G.fmtCents(s) + "。");
    });
    document.getElementById("wh-close").addEventListener("click", function () { self.close(); });
  },

  /* ---------- 果园（河西果园木牌：买地/买苗/种果；收成自动入账，不耗雇工） ---------- */
  orchardPanel: function () {
    var self = this;
    var w = Wallet.load();
    var p = GS.load(w);
    var free = p.orchard - p.orchardPlanted;
    var ripeText = p.orchardPlanted
      ? (p.day >= p.orchardDay ? "熟了！睡一觉就能摘" : "还有 " + Math.max(0, p.orchardDay - p.day) + " 天挂果")
      : "无";
    var rows = '<p class="flavor">老园丁靠着木牌：“河西的地肥，种果树不用雇工，就是来得慢——种下 ' +
      GS.ORCHARD_DAYS + ' 天才能挂果。”</p>';
    rows += '<div class="row"><span>钱包</span><span>' + this.moneySpan(w.balanceCents()) + '</span></div>';
    rows += '<div class="row"><span>果园</span><span>' + p.orchard + ' 棵（已种 ' + p.orchardPlanted + '）</span></div>';
    rows += '<div class="row"><span>果苗</span><span>' + p.saplings + ' 袋</span></div>';
    rows += '<div class="row"><span>挂果</span><span>' + ripeText + '</span></div>';
    var canPlant = free > 0 && p.saplings > 0;
    var html = '<div class="panel"><h2>🍊 河西果园</h2>' + rows +
      '<div class="actions">' +
      '<button class="pix-btn" data-oc="land">买果园地 $25</button>' +
      '<button class="pix-btn" data-oc="sapling">买果苗 $10</button>' +
      (canPlant ? '<button class="pix-btn" data-oc="plant">种果苗（1袋/棵）</button>' : '') +
      '<button class="pix-btn" id="oc-close">走了</button></div></div>';
    this.open(html);
    [
      ["land", function () {
        var r = GS.buyOrchardLand(w); w.save();
        if (r === null) UI.dialog("老园丁", ["$25 都没有？那地可不租。"], [{ label: "好", act: "ok", fn: function () { self.orchardPanel(); } }]);
        else if (r === "full") UI.dialog("老园丁", ["果园就三棵树的位子，种满了。"], [{ label: "好", act: "ok", fn: function () { self.orchardPanel(); } }]);
        else UI.say("老园丁", "地契画押。" + r + " 棵的位子了。");
      }],
      ["sapling", function () {
        var r = GS.buySaplings(w, 1); w.save();
        if (r === null) UI.dialog("老园丁", ["一袋果苗 $10，掏钱吧。"], [{ label: "好", act: "ok", fn: function () { self.orchardPanel(); } }]);
        else UI.say("老园丁", "好苗子，三年结两年果。" + r + " 袋了。");
      }],
      ["plant", function () {
        var r = GS.plantOrchard(p); w.save();
        if (r === null) UI.dialog("老园丁", ["得先有空地、有果苗才行。"], [{ label: "好", act: "ok", fn: function () { self.orchardPanel(); } }]);
        else UI.say("老园丁", "种下去了，" + GS.ORCHARD_DAYS + " 天后挂果。" + r + " 棵在长。");
      }],
    ].forEach(function (pair) {
      var btn = document.querySelector('[data-oc="' + pair[0] + '"]');
      if (btn) btn.addEventListener("click", pair[1]);
    });
    document.getElementById("oc-close").addEventListener("click", function () { self.close(); });
  },

  /* ---------- 池塘（村边水塘：$0.2 捞一次，便宜/快/低回报） ---------- */
  pondPanel: function () {
    var self = this;
    var w = Wallet.load();
    var html = '<div class="panel"><h2>🫧 村边池塘</h2>' +
      '<p class="flavor">水塘不大，泥鳅草鱼倒是不少。捞一网 ' + G.fmtCents(GS.POND_COST) + '，看手气。</p>' +
      '<div class="actions">' +
      '<button class="pix-btn" id="pond-cast">捞一网</button>' +
      '<button class="pix-btn" id="pond-leave">走了</button></div></div>';
    this.open(html);
    document.getElementById("pond-cast").addEventListener("click", function () {
      var fish = GS.pondFish(w); w.save();
      if (fish === null) {
        UI.dialog("池塘", ["连 " + G.fmtCents(GS.POND_COST) + " 都没有？水可不管这些。"],
          [{ label: "好", act: "ok", fn: function () { self.pondPanel(); } }]);
        return;
      }
      UI.pondResult(fish);
    });
    document.getElementById("pond-leave").addEventListener("click", function () { self.close(); });
  },

  /* 捞鱼结果：卖 / 放生 / 再捞一网 */
  pondResult: function (fish) {
    var self = this;
    var w = Wallet.load();
    var html = '<div class="panel"><h2>🫧 捞上来了……</h2>' +
      '<p class="flavor">' + fish.name + '：' + fish.desc + '</p>' +
      '<div class="actions">' +
      '<button class="pix-btn" id="pond-sell">卖 ' + G.fmtCents(fish.price) + '</button>' +
      '<button class="pix-btn" id="pond-free">放生</button>' +
      '<button class="pix-btn" id="pond-more">再捞一网</button>' +
      '<button class="pix-btn" id="pond-done">走了</button></div></div>';
    this.open(html);
    document.getElementById("pond-sell").addEventListener("click", function () {
      w.settle(fish.price / 100, "farm", "卖池塘鱼(" + fish.name + ")");
      w.save();
      UI.say("池塘", "卖了 " + G.fmtCents(fish.price) + "，够喝一杯的了。");
    });
    document.getElementById("pond-free").addEventListener("click", function () {
      UI.say("池塘", "你把" + fish.name + "放回水里，它一甩尾巴就没影了。");
    });
    document.getElementById("pond-more").addEventListener("click", function () { self.pondPanel(); });
    document.getElementById("pond-done").addEventListener("click", function () { self.close(); });
  },

  /* ---------- 教堂（密林小教堂：祈祷 $1 换心情，赞美生命之神赐生命与福泽） ---------- */
  prayPanel: function () {
    var self = this;
    var w = Wallet.load();
    var p = GS.load(w);
    var PRAY_COST = 100;
    var html = '<div class="panel"><h2>🕯️ 石祭坛</h2>' +
      '<p class="flavor">老牧师轻声道：“石头是最朴实的材料，象征生命之神关怀着最普通的生灵。捐 ' +
      G.fmtCents(PRAY_COST) + ' 香油钱，祈个平安吧。”</p>' +
      '<div class="actions">' +
      '<button class="pix-btn" id="pray-ok">祈祷（' + G.fmtCents(PRAY_COST) + '）</button>' +
      '<button class="pix-btn" id="pray-close">走了</button></div></div>';
    this.open(html);
    document.getElementById("pray-ok").addEventListener("click", function () {
      if (w.balanceCents() < PRAY_COST) {
        UI.say("祭坛", "你摸了摸口袋……连 " + G.fmtCents(PRAY_COST) + " 都没有。心诚则灵，神不会嫌你穷。");
        return;
      }
      w.settle(-PRAY_COST / 100, "church", "教堂香油钱");
      GS.addMood(p, 5);
      w.save();
      UI.say("祭坛", "烛火轻轻晃了晃，你心里平静了不少（心情 +5）。");
    });
    document.getElementById("pray-close").addEventListener("click", function () { self.close(); });
  },

  /* 家具展示环节（交互后弹出介绍） */
  furnitureShow: function (f) {
    var self = this;
    var story = f.story || "";
    var html = '<div class="panel dialog"><h2>🪑 ' + f.name + '</h2>' +
      '<p class="text">' + f.desc + '</p>' +
      '<p class="text" style="color:var(--dim)">' + story + '</p>' +
      '<div class="actions">' +
      (f.id === "bookshelf"
        ? '<button class="pix-btn" id="furn-books">📖 看书架上的书</button>'
        : '<button class="pix-btn" id="furn-close">看完了</button>') +
      '</div></div>';
    this.open(html);
    var booksBtn = document.getElementById("furn-books");
    if (booksBtn) booksBtn.addEventListener("click", function () { self.booksPanel(); });
    var close = document.getElementById("furn-close");
    if (close) close.addEventListener("click", function () { self.close(); });
  },

  /* 书架：书单 → 选书看背景故事 */
  booksPanel: function () {
    var self = this;
    var rows = '<p class="flavor">书脊都翻卷了，几本旧书立在架上。</p>';
    BOOKS.forEach(function (b, i) {
      rows += '<div class="row"><span>' + b.title + '</span>' +
        '<button class="pix-btn small" data-book="' + i + '">翻看</button></div>';
    });
    var html = '<div class="panel"><h2>📖 书架</h2>' + rows +
      '<div class="actions"><button class="pix-btn" id="books-close">合上书架</button></div></div>';
    this.open(html);
    BOOKS.forEach(function (b, i) {
      var btn = document.querySelector('[data-book="' + i + '"]');
      if (btn) btn.addEventListener("click", function () { self.bookShow(b); });
    });
    document.getElementById("books-close").addEventListener("click", function () { self.close(); });
  },

  bookShow: function (b) {
    var self = this;
    var html = '<div class="panel dialog"><h2>📖 ' + b.title + '</h2>' +
      '<p class="text">' + b.text + '</p>' +
      '<div class="actions"><button class="pix-btn" id="book-back">放回书架</button>' +
      '<button class="pix-btn" id="book-close">合上</button></div></div>';
    this.open(html);
    document.getElementById("book-back").addEventListener("click", function () { self.booksPanel(); });
    document.getElementById("book-close").addEventListener("click", function () { self.close(); });
  },

  /* 鱼标本展示 */
  trophyShow: function (fishName) {
    var self = this;
    var info = FISH_INFO[fishName] || "一条鱼。挂在这儿，还挺像那么回事。";
    var html = '<div class="panel dialog"><h2>🐟 鱼标本 · ' + fishName + '</h2>' +
      '<p class="text">墙上钉着一块木牌，' + fishName + '标本按在上面，鳞片在灯下泛着光。</p>' +
      '<p class="text" style="color:var(--dim)">' + info + '</p>' +
      '<div class="actions"><button class="pix-btn" id="trophy-close">看完了</button></div></div>';
    this.open(html);
    document.getElementById("trophy-close").addEventListener("click", function () { self.close(); });
  },

  /* NPC 对话面板（E 键靠近说话）：带二次元大头像（buildPortrait，sprites.js） */
  npcTalk: function (npc) {
    this.speechNpcTalk(npc);
  },

  /* 询问 NPC：通用问题 + 各 NPC 专属问题（QUESTIONS 数据在 progress.js） */
  askPanel: function (id) {
    var self = this;
    var name = NPC_NAMES[id] || id;
    var qs = (QUESTIONS && QUESTIONS.generic || []).concat(
      (QUESTIONS && QUESTIONS.npc && QUESTIONS.npc[id]) || []);
    var rows = qs.map(function (it, i) {
      return '<button class="pix-btn" data-q="' + i + '" id="ask-q-' + i + '" style="width:100%">❓ ' + it.q + '</button>';
    }).join("");
    var html = '<div class="panel dialog"><h2>❓ 问' + name + '</h2>' +
      '<div class="actions" style="flex-direction:column;align-items:stretch">' + rows +
      '<button class="pix-btn" id="ask-close">不问了</button></div></div>';
    this.open(html);
    qs.forEach(function (it, i) {
      var btn = document.getElementById("ask-q-" + i);
      if (btn) btn.addEventListener("click", function () { UI.say(name, it.a); });
    });
    document.getElementById("ask-close").addEventListener("click", function () { self.close(); });
  },

  /* ---------- 台词（文字冒险风：底部文本框，非遮罩） ---------- */
  say: function (npcName, text) {
    // 先关掉可能开着的遮罩（UI.say 走底部文本框，不占用 overlay）
    if (this.overlay && this.overlay.classList.contains("open")) this.close();
    // 尝试从 NPC_NAMES 反查 charKey（用于显示头像）
    var charKey = null;
    if (typeof NPC_NAMES !== "undefined") {
      for (var k in NPC_NAMES) {
        if (NPC_NAMES[k] === npcName) { charKey = k; break; }
      }
    }
    this.speechSay(npcName, text, charKey);
  },

  /* ---------- 辅助 ---------- */
  moneySpan: function (cents, plus) {
    var cls = cents > 0 ? "money-plus" : (cents < 0 ? "money-minus" : "money-zero");
    return '<span class="' + cls + '">' + G.fmtCents(cents, plus) + '</span>';
  },

  cardHtml: function (card, hidden) {
    if (hidden) return '<span class="pcard back">?</span>';
    var red = card.indexOf("♥") >= 0 || card.indexOf("♦") >= 0;
    var rank = card.slice(0, -1), suit = card.slice(-1);
    return '<span class="pcard ' + (red ? "red" : "") + '">' + rank + '<span class="suit">' + suit + '</span></span>';
  },

  cardsHtml: function (cards, hideIndex) {
    var s = "";
    for (var i = 0; i < cards.length; i++) s += this.cardHtml(cards[i], hideIndex === i);
    return s;
  },

  /* 🆕 RPG 风格选择对话框（带选项分支） */
  /* choices: [{ label, fn }] */
  showRPGChoice: function (title, text, choices) {
    var self = this;
    var html = '<div class="dialog-ornate"><h2>' + title + '</h2>';
    if (text) html += '<p class="text" style="margin-bottom:12px">' + text + '</p>';
    html += '<div class="ornate-divider"></div>';
    html += '<div class="rpg-choices">';
    choices.forEach(function (c) {
      html += '<button class="rpg-choice" data-idx="' + choices.indexOf(c) + '">' + c.label + '</button>';
    });
    html += '</div></div>';
    this.open(html);
    this.overlay.querySelectorAll(".rpg-choice").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.getAttribute("data-idx"));
        var choice = choices[idx];
        if (choice && choice.fn) {
          self.close();
          choice.fn();
        }
      });
    });
  },

  /* 🆕 预加载精灵表：遍历 CHARS 键，自动加载 assets/characters/{key}.png */
  loadCharacterSheets: function () {
    if (typeof CHARS === "undefined") return;
    var loaded = 0;
    Object.keys(CHARS).forEach(function (key) {
      var url = "assets/characters/" + key + ".png";
      // 检查文件是否存在（通过 Image onerror 自动跳过）
      if (typeof loadSpriteSheet === "function") {
        loadSpriteSheet(key, url);
        loaded++;
      }
    });
    if (loaded > 0) console.log("ui: 尝试加载 " + loaded + " 个精灵表");
  }
};
