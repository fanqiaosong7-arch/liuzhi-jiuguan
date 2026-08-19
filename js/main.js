/* main.js — 启动与场景动作接线
 * G.ACTIONS: 场景交互对象 → 行为（开游戏/看钱包/换场景/剧情台词） */
"use strict";

G.ACTIONS = {
  /* ---------- 二楼房间 ---------- */
  rest: function () {
    var w = Wallet.load();
    var p = GS.load(w);
    var events = GS.dayRollover(w);       // 睡到次日早晨 + 贷款利息 + 奶奶零花钱
    w.save();
    var lines = "你躺在床上，窗外柳枝河的流水声渐渐远去……<br>醒来已是第二天早晨 —— " +
      GS.calendarText(p) + "（心情 +15）";
    if (events.length) lines += "<br>· " + events.join("<br>· ");
    UI.say("一夜好眠", lines);
  },

  calendar: function () {
    UI.calendarPanel();
  },

  wallet: function () {
    UI.walletPanel();
  },

  goto_lobby: function () {
    var w = Wallet.load();
    w.save();
    Engine.setScene("lobby");
    UI.say("下楼", "你推开门走下楼梯，酒馆大堂灯火通明，人声鼎沸。");
  },

  goto_room: function () {
    var w = Wallet.load();
    w.save();
    Engine.setScene("room");
    UI.say("回房", "你沿楼梯回到二楼的小房间。累了就睡一觉，明天再说。");
  },

  flavor_window: function () {
    var w = Wallet.load();
    var p = GS.load(w);
    var lines = {
      morning: "窗外是清晨的柳溪村，柳枝河在薄雾里泛着光，渡口已经有人影了。",
      noon: "正午的日头晒着柳枝河，渔民父子正在河滩上晾鱼干。",
      evening: "夜色下的柳溪村，领主庄园的灯亮着，河面黑沉沉的——该睡了。",
    };
    UI.say("窗", lines[p.period] || lines.morning);
  },

  flavor_poster: function () {
    UI.say("告示", "墙上贴着一张泛黄的告示：\u201c柳枝酒馆 · 二楼客房 · 掌柜奥托敬告\u201d——奶奶替你付了两年的租金和伙食。");
  },

  /* 已购家具：展示介绍（书架另开书单） */
  furniture_talk: function (o) {
    var name = o && o.label ? o.label : "";
    var f = null;
    for (var i = 0; i < FURNITURE.length; i++) if (FURNITURE[i].name === name) f = FURNITURE[i];
    if (!f) { UI.say("家具", "（你伸手摸了摸，买都买了，心里还挺美。）"); return; }
    UI.furnitureShow(f);
  },

  /* 鱼标本展示 */
  trophy_talk: function (o) {
    var fish = (o && o.label ? o.label : "").replace("鱼标本：", "");
    UI.trophyShow(fish);
  },

  /* ---------- 户外 ---------- */
  goto_village: function () {
    Wallet.load().save();
    Engine.setScene("village");
    UI.say("村口", "你推开酒馆的门，来到村口的空地上。夜风里夹着河水的潮气。");
  },

  goto_lobby_from: function () {
    Wallet.load().save();
    Engine.setScene("lobby");
    UI.say("酒馆", "你推开酒馆的门走了进去，暖气扑面而来。");
  },

  goto_riverside: function () {
    Wallet.load().save();
    Engine.setScene("riverside");
    UI.say("小河边", "柳枝河在眼前流淌，水声哗哗的。渡口的船夫摆渡一人两铜板，老渔夫在岸边支着竿。");
  },

  goto_farmland: function () {
    Wallet.load().save();
    Engine.setScene("farmland");
    UI.say("农地", "村边的麦田在风里沙沙响——种的是麦和黑麦，秋天领主派人来收租。");
  },

  goto_orchard: function () {
    Wallet.load().save();
    Engine.setScene("orchard");
    UI.say("河西果园", "过了河，河西的果园里果木成排。老园丁靠在木牌边打盹。");
  },

  goto_farmland_from: function () {
    Wallet.load().save();
    Engine.setScene("farmland");
    UI.say("农地", "你沿小路回到村边的农地。");
  },

  goto_chapel: function () {
    Wallet.load().save();
    Engine.setScene("chapel");
    UI.say("密林小教堂", "林子深处的石头小教堂，烛火通明。老牧师在祭坛边整理烛台。");
  },

  goto_manor: function () {
    Wallet.load().save();
    Engine.setScene("manor");
    UI.say("庄园前", "领主庄园的石墙立在北边，门口站着两个持矛的卫兵。墙边支着葡萄架，听说今年又歉收。");
  },

  goto_oldhouse: function () {
    Wallet.load().save();
    Engine.setScene("oldhouse");
    UI.say("精灵旧屋", "村西沿河的一排旧宅，最里头那间是薇拉的家——屋瓦漏雨，祖上阔过。");
  },

  /* 精灵旧屋入口：先敲门，薇拉应门才进（牌友熟脸：薇拉与老板奥托是牌友，认得酒馆住客）
   * 正式版（规划.md）：认习度/事件门槛，先开不了门，经历事件后才解锁进屋 */
  knock_oldhouse: function () {
    var self = this;
    UI.dialog("精灵旧屋", [
      "你走到村西沿河那排旧宅前。最里头那间是薇拉的家——屋瓦漏雨，门虚掩着。",
      "你抬手敲了敲门。",
    ], [
      { label: "敲门", act: "knock", fn: function () {
        UI.close();  // 关掉敲门遮罩，再进场景
        self.goto_oldhouse();
        UI.say("薇拉", "……（门开了一条缝，探出半个头）是你？酒馆楼上那位吧。进来坐，屋里乱，别嫌。");
      } },
      { label: "改天再来", act: "cancel" },
    ]);
  },

  /* ---------- 精灵旧屋 flavor ---------- */
  flavor_leakyroof: function () {
    UI.say("漏雨的屋瓦", "屋瓦缺了好几块，晴天漏光，雨天漏雨。屋角摆着接雨的盆——薇拉说，体面要紧，天也要紧。");
  },

  flavor_heirloom: function () {
    UI.say("祖传银器盒", "一只磨得发亮的银器盒，锁扣都旧了。薇拉宁可摆盆接雨，也不肯贱卖祖上传下来的东西。");
  },

  flavor_oldledger: function () {
    UI.say("窗台的旧账本", "窗台上压着半本旧账，记的是一百年前的葡萄账、酒账、人情账。最后一行写着：欠柳溪村一回体面。");
  },

  goto_village_from: function () {
    Wallet.load().save();
    Engine.setScene("village");
    UI.say("村口", "你沿着小路走回村口的空地。");
  },

  /* ---------- 户外交互 ---------- */
  fish: function () {
    UI.fishingPanel();
  },

  send_letter: function () {
    var w = Wallet.load();
    if (w.balanceCents() < 50) {
      UI.say("邮筒", "寄信要 $0.50 邮资，你连这点都没有……");
      return;
    }
    UI.askText("📮 给奶奶寄信", "写几句话捎给奶奶（邮资 $0.50，3 天后她回信）：",
      "奶奶，我在这边一切都好，您多保重。", function (text) {
        var w2 = Wallet.load();
        GS.sendLetter(w2, text);
        w2.save();
        UI.say("邮筒", "你把信塞进邮筒。三两天后，奶奶应该就能收到了。");
      });
  },

  guard_shoo: function () {
    var self = this;
    UI.say("卫兵", "老爷的地盘，闲人免进！再往前走，别怪矛不长眼！");
  },

  farm_manage: function () {
    UI.farmPanel();
  },

  warehouse_manage: function () {
    UI.warehousePanel();
  },

  /* 农业二期：果园 / 池塘 / 田格 / 教堂 */
  orchard_manage: function () {
    UI.orchardPanel();
  },

  pond_fish: function () {
    UI.pondPanel();
  },

  plot_talk: function (o) {
    var w = Wallet.load();
    var p = GS.load(w);
    var idx = (o && typeof o.idx === "number") ? o.idx : 0;
    var state = (typeof plotStateText === "function") ? plotStateText(p, idx) : "";
    UI.say("田地", "这是第 " + (idx + 1) + " 块田，现在" + state +
      "。（想买地/买种子，去艾尔的农具摊。）");
  },

  pray: function () {
    UI.prayPanel();
  },

  /* 靠近 NPC 说话 */
  npc_talk: function (npc) {
    UI.npcTalk(npc);
  },

  /* ---------- 一楼大厅 ---------- */
  play_blackjack: function () {
    BJGame.start();
  },

  play_poker: function () {
    PokerGame.start();
  },

  play_doudizhu: function () {
    DDZGame.start();
  },

  play_uno: function () {
    UnoGame.start();
  },

  play_snake: function () {
    SnakeGame.start();
  },

  play_pong: function () {
    PongGame.start();
  },

  ledger: function () {
    UI.ledgerPanel();
  },

  flavor_bar: function () {
    UI.barMenu();
  },

  flavor_sign: function () {
    UI.say("招牌", "“柳枝酒馆”的招牌在夜色里轻轻摇晃，♠♥♦♣ 的刻痕若隐若现。");
  },
};

/* 每退出一次大厅游戏调用：推进时间段 / 提醒睡觉 / 自动回房睡觉 */
G.afterLeaveGame = function () {
  if (typeof GS === "undefined" || !GS.state) return;
  var r = GS.onLeaveGame(GS.state);
  if (r.action === "sleep") {
    var w = Wallet.load();
    var events = GS.dayRollover(w);       // 自动睡到次日早晨 + 利息 + 零花钱
    w.save();
    var text = r.text + "（醒来已是 " + GS.calendarText(GS.state) + "，心情 +15）";
    if (events.length) text += " " + events.join(" ");
    UI.speech(text, 4200);
    Engine.setScene("room");
  } else if (r.text) {
    UI.speech(r.text, 2800);
    if (typeof G !== "undefined" && G.UI) G.UI.updateHud();
  }
};

/* 赊账门槛：余额 ≤ -$30 时老板不再赊账（进赌局前调用） */
G.canGamble = function () {
  if (typeof GS === "undefined") return true;
  var w = Wallet.load();
  if (!GS.canGamble(w)) {
    UI.say("老板", "客官，账上欠得太多了，恕不赊账。去找商人贷款周转，或者等奶奶的零花钱——" +
      GS.ALLOWANCE_INTERVAL + "天一捎，一次" + G.fmtCents(GS.ALLOWANCE) + "。");
    return false;
  }
  return true;
};

function boot() {
  UI.init();
  // 加载 LPC 组件（角色 PNG 精灵表）
  LPC.load(function () {
    console.log("LPC 角色组件已就绪");
  });
  // 加载 Kenney 瓦片包（场景贴图）
  loadTilePack("town");
  loadTilePack("dungeon");
  Engine.init();
  var w = Wallet.load();
  GS.init(w);                     // 进度系统（时间/心情/家具/名字）初始化
  Engine.setScene("room");
  if (!GS.state.playerName) {
    // 第一天：掌柜登记名字（默认 JACK BLACK，之后可花 $5 改）
    UI.askName(function (name) {
      GS.state.playerName = name || GS.DEFAULT_NAME;
      w.save();
      UI.say("佩尔 · 商人", "……" + GS.playerName(GS.state) +
        "，记下了。欢迎光临酒馆，账上还有 " + G.fmtCents(w.balanceCents()) +
        "，牌桌都在楼下等着呢。");
    }, GS.DEFAULT_NAME);
  } else {
    UI.say("佩尔 · 商人", "哟，" + GS.playerName(GS.state) + "，熟客了。账上还有 " +
      G.fmtCents(w.balanceCents()) + "，牌桌都在楼下等着呢。");
  }
}

/* 首帧加载后启动 */
window.addEventListener("DOMContentLoaded", boot);
