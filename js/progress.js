/* progress.js — 游戏进度系统：时间（早晨/中午/晚上）、日历、心情、家具、进出计数
 * 纯逻辑模块（不依赖 DOM/Engine），状态随钱包存档（wallet.progress）。
 *
 * 时间规则（用户需求）：
 * - 一天三段：早晨 → 中午 → 晚上
 * - 每「进出大厅游戏」1 次（进游戏再退出回大厅）：早晨 5 次 → 中午；再 5 次 → 晚上
 * - 入夜后最多再进出 2 次，主角自动回房睡觉（次日早晨）
 * - 主动睡觉 = 睡到次日早晨（跳过当前时间段）
 */
"use strict";

var PERIODS = {
  morning: { name: "早晨", icon: "☀️", tint: "rgba(255,200,120,0.05)" },
  noon:    { name: "中午", icon: "🌞", tint: "rgba(255,255,255,0)" },
  evening: { name: "晚上", icon: "🌙", tint: "rgba(28,38,84,0.30)" },
};

var MOOD_FACES = [
  { max: 20, face: "😢", label: "低落" },
  { max: 40, face: "😞", label: "不快" },
  { max: 65, face: "😐", label: "平常" },
  { max: 85, face: "🙂", label: "不错" },
  { max: 100, face: "😄", label: "畅快" },
];

var WEEKDAYS = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期天"];
var MONTH_DAYS = 30;

/* 日赢钱上限（分）：老板 $20；普通 NPC（醉汉/村民/旅客）$8；贪吃蛇无 NPC 不封顶。
 * DAILY_WIN_CAP_ENABLED=false 时对所有游戏开放（=无限，当前需求）。 */
var BOSS_DAILY_CAP = 2000;
var NPC_DAILY_CAP = 800;
var CAP_GAMES = { blackjack: BOSS_DAILY_CAP, poker: NPC_DAILY_CAP, doudizhu: NPC_DAILY_CAP, pong: NPC_DAILY_CAP };
var DAILY_WIN_CAP_ENABLED = false;

/* 经济设定：$50 是巨款（当地一年收入水平），消费低 */
var WALLET_MIN = -3000;        // 钱包最低 -$30：老板赊账上限，再低不再赊
var ALLOWANCE = 700;           // 奶奶零花钱：每 3 天 $7
var ALLOWANCE_INTERVAL = 3;
var LOAN_DAILY_RATE = 0.05;    // 商人贷款日息 5%（睡一觉算一天）
var LOAN_AMOUNTS = [1000, 2000, 5000];  // 可贷 $10 / $20 / $50

/* 对手（老板/NPC）钱包上限（分）：下注/加注不能超过他们兜里的钱 */
var BOSS_WALLET = 5000;        // 老板（21点）$50
var NPC_WALLET = 5000;         // 醉汉/村民/旅客/村民（德州/斗地主/乒乓）$50

/* 主角设定：默认男性，名字 JACK BLACK（首日确认，之后 $5 改名） */
var DEFAULT_NAME = "JACK BLACK";
var RENAME_COST = 500;         // 改名费 $5

/* 农业经济（农夫艾尔 / 建筑工罗伯特）
 * 回本周期（刻意拉长，农业是长线投资）：
 * 单块地成本 $22（地 $20 + 种子 $2），每 3 天净收 $4（收成 $7 - 雇工 $1×3），
 * 约 5.5 个收成周期 ≈ 17 天回本。 */
var LAND_PRICE = 2000;        // 买地 $20/块
var SEED_PRICE = 200;         // 种子 $2/袋
var WORKER_WAGE = 100;        // 雇工 $1/块/天（只扣已播种地块，睡醒结算）
var HARVEST_PRICE = 700;      // 每块地收成 $7（无仓库贱卖；有仓库存入）
var HARVEST_DAYS = 3;         // 种下到收成 3 天
var WAREHOUSE_PRICE = 3000;   // 盖仓库 $30，3 天建成

/* 农业二期（2026-08-17）：田格可视化 + 河西果园 + 池塘
 * 田格：农田地图上 2×3=6 格可视化，买地 6 块封顶（地图格子上限）
 * 果园：河西果园 3 棵果树，$35 投入（地$25+苗$10），5 天收 $18，
 *       不耗雇工（果树自己长，长线省心），约 2 个收成周期回本
 * 池塘：村边水塘，$0.2/次捞鱼，期望 ~$0.45（与河边钓鱼区分：便宜/快/低回报） */
var FARMLAND_MAX = 6;         // 农田格子上限（地图 2×3 格）
var ORCHARD_LAND_PRICE = 2500; // 果林地 $25/块
var SAPLING_PRICE = 1000;     // 果苗 $10/袋
var ORCHARD_HARVEST = 1800;   // 每棵挂果树收成 $18
var ORCHARD_DAYS = 5;         // 种下到挂果 5 天
var ORCHARD_MAX = 3;          // 果园格子上限
var POND_COST = 20;           // 池塘捞一次 $0.2

/* 丽塔（老板女儿）：红发开朗女孩，好感度系统（剧情暂不做） */
var RITA_GIFT_PRICE = 200;     // 花/蛋糕 $2
var RITA_GIFT_MOOD = 5;

/* 随机访客 NPC（每天随机 2 位出现在大厅；可进 21点 陪坐并增减老板日赢上限）
 * bjMod：21点 老板日赢上限修正（分）——精灵/领主的人抬盘，穷苦人压盘 */
var VISITOR_POOL = [
  { id: "billy", char: "billy", name: "比利",    bjMod: 500,  desc: "精灵治安官，据说是村里最能打的。" },
  { id: "tommy", char: "tommy", name: "汤米",    bjMod: 200,  desc: "比利的手下，爱跟着长官耍威风。" },
  { id: "will",  char: "will",  name: "威尔",    bjMod: 200,  desc: "比利的手下，话少，眼神凶。" },
  { id: "higg",  char: "higg",  name: "希格",    bjMod: 300,  desc: "领主家的老仆人，替老爷跑腿。" },
  { id: "mark",  char: "mark",  name: "马克",    bjMod: -200, desc: "邮差，三天两头往渡口跑。" },
  { id: "mary",  char: "mary",  name: "玛丽",    bjMod: -200, desc: "农妇，来买黑面包的。" },
  { id: "anna",  char: "anna",  name: "安娜",    bjMod: -300, desc: "养鸡户，篮子里还提着鸡蛋。" },
  { id: "lord",  char: "lord",  name: "领主·柳叶", bjMod: 300, desc: "精灵领主，庄园不大，架子不小，偶尔上桌。" },
  { id: "husk",  char: "husk",  name: "管家哈斯克", bjMod: 200, desc: "领主的管家，替老爷跑腿买酒，顺道看看闲人。" },
];

/* 大厅可对话 NPC 上限（常驻 5 + 随机访客，不得超过 7） */
var LOBBY_NPC_MAX = 7;
var LOBBY_NPC_FIXED = 5;
var VISITOR_PER_DAY = 2;

/* 认同度档位 */
var REP_LEVELS = [
  { min: 0,  title: "生面孔" },
  { min: 20, title: "熟面孔" },
  { min: 45, title: "酒馆常客" },
  { min: 70, title: "村里人" },
  { min: 90, title: "柳溪村的贵人" },
];

/* 默认进度 */
function defaultProgress() {
  return {
    period: "morning", day: 1, weekday: 0, month: 1, monthDay: 1,
    mood: 60, visits: 0, furniture: [], reputation: 10, dailyWin: {},
    loan: 0,                  // 欠商人的贷款（分）
    nextAllowanceDay: 3,      // 奶奶下次送零花钱在第几天
    playerName: null,         // 主角名字（首日确认，默认 JACK BLACK）
    rita: 0,                  // 丽塔好感度（0~100）
    ritaGiftDay: 0,           // 最近一次给丽塔送礼的天数（一天一次）
    visitors: [],             // 今天在大厅的随机访客（最多 2 位）
    bjTable: [],              // 今天 21点 上桌 NPC（最多 2 位，真打牌）
    bjNpcNet: 0,              // 今天 NPC 从老板净赢（分，正=NPC赢老板；联动玩家可赢额度）
    pokerTable: [],           // 今天 德州 上桌 NPC（最多 4 位，真打牌）
    trophies: [],             // 房间墙上挂的鱼标本（最多 2 条）
    letterDay: 0,             // 最近寄信的天数（0=未寄；3 天后奶奶回信）
    letterText: "",           // 最近寄出的信的内容（奶奶回信时引用）
    farmland: 0,              // 拥有的农田块数
    seeds: 0,                 // 种子袋数
    workerDays: 0,            // 雇工剩余天数
    planted: 0,               // 已播种待收成的地块数
    harvestDay: 0,            // 收成日（第几天）
    warehouse: 0,             // 仓库：0=未建 1=建造中 2=已建成
    warehouseDay: 0,          // 仓库建成日
    stored: 0,                // 仓库里存的农产品（分）
    orchard: 0,               // 拥有的果园地块数（河西果园，3 块封顶）
    saplings: 0,              // 果苗袋数
    orchardPlanted: 0,        // 已种待挂果的果苗数
    orchardDay: 0,            // 挂果日（第几天）
  };
}

var GS = {
  /* 内存态单例：首次从钱包初始化；保存时由 Wallet.save 自动写回 */
  state: null,

  /* 强制从钱包（重）加载 */
  init: function (wallet) {
    this.state = this.loadFrom(wallet);
    return this.state;
  },

  /* 取内存态；未初始化时从钱包加载 */
  load: function (wallet) {
    if (!this.state) this.state = this.loadFrom(wallet);
    return this.state;
  },

  /* 把内存态写回钱包（Wallet.save 自动调用） */
  syncToWallet: function (wallet) {
    if (this.state) wallet.progress = this.state;
  },

  loadFrom: function (wallet) {
    var p = (wallet && wallet.progress) || {};
    var d = defaultProgress();
    for (var k in d) if (typeof p[k] === "undefined") p[k] = d[k];
    // 第一天（或存档无访客时）也补 2 位随机访客，大厅不至于只有常驻 NPC
    if (!p.visitors || !p.visitors.length) p.visitors = this.pickVisitors();
    return p;
  },

  reset: function () { this.state = null; },

  /* ---------- 时间 ---------- */
  advancePeriod: function (p) {
    if (p.period === "morning") p.period = "noon";
    else if (p.period === "noon") p.period = "evening";
    return p.period;
  },

  /* 睡觉：跳过当前时间段 → 次日早晨（重置当日赢钱额度） */
  sleep: function (p) {
    p.period = "morning";
    p.day += 1;
    p.weekday = (p.weekday + 1) % 7;
    p.monthDay += 1;
    if (p.monthDay > MONTH_DAYS) { p.monthDay = 1; p.month += 1; }
    p.visits = 0;
    p.mood = Math.min(100, p.mood + 15);   // 睡饱回心情
    p.dailyWin = {};                       // 新的一天，赢钱额度恢复
    p.visitors = this.pickVisitors();      // 新的一天，换一批访客
    p.bjTable = [];                        // 21点上桌 NPC 重置（进 21点 再定）
    p.bjNpcNet = 0;
    p.pokerTable = [];                     // 德州上桌 NPC 重置（进德州再定）
    return p;
  },

  /* 随机选当天访客（每天 2 位，不重复） */
  pickVisitors: function () {
    var pool = VISITOR_POOL.slice();
    var out = [];
    while (out.length < VISITOR_PER_DAY && pool.length) {
      var i = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(i, 1)[0].id);
    }
    return out;
  },

  /* 21点 上桌选人：当天首次进入时随机 0~2 位真打牌（影响老板日赢上限） */
  pickBjTable: function (p) {
    if (!p.bjTable || !p.bjTable.length) {
      var n = [0, 1, 1, 2][Math.floor(Math.random() * 4)];   // 0/1/1/2 概率
      p.bjTable = this._pickFromPool(n);
    }
    return p.bjTable;
  },

  /* 德州 上桌选人：当天首次进入时随机 0~4 位（真打牌） */
  pickPokerTable: function (p) {
    if (!p.pokerTable || !p.pokerTable.length) {
      p.pokerTable = this._pickFromPool(Math.floor(Math.random() * 5));  // 0~4
    }
    return p.pokerTable;
  },

  _pickFromPool: function (n) {
    var pool = VISITOR_POOL.slice();
    var out = [];
    while (out.length < n && pool.length) {
      var i = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(i, 1)[0].id);
    }
    return out;
  },

  /* NPC 与老板结算：累计今日 NPC 净赢（正=赢老板；负=输给老板） */
  npcNetResult: function (p, netCents) {
    p.bjNpcNet = (p.bjNpcNet || 0) + netCents;
    return p.bjNpcNet;
  },

  visitorById: function (id) {
    for (var i = 0; i < VISITOR_POOL.length; i++) if (VISITOR_POOL[i].id === id) return VISITOR_POOL[i];
    return null;
  },

  /* 21点 老板日赢上限（基础 $20 + 上桌 NPC 修正之和） */
  bjCap: function (p) {
    var mod = 0;
    (p.bjTable || []).forEach(function (id) {
      var v = VISITOR_POOL.filter(function (x) { return x.id === id; })[0];
      if (v) mod += v.bjMod;
    });
    return BOSS_DAILY_CAP + mod;
  },

  /* 跨天结算：睡觉推进时间 + 贷款计息 + 奶奶零花钱。返回事件台词数组 */
  dayRollover: function (wallet) {
    var p = this.load(wallet);
    this.sleep(p);
    var events = [];
    if (p.loan > 0) {
      var interest = Math.max(1, Math.round(p.loan * LOAN_DAILY_RATE));
      p.loan += interest;
      events.push("商人拨着算盘：你的贷款又滚了 " + G.fmtCents(interest) + " 利息，共欠 " +
        G.fmtCents(p.loan) + "。");
    }
    if (p.day >= p.nextAllowanceDay) {
      p.nextAllowanceDay += ALLOWANCE_INTERVAL;
      wallet.settle(ALLOWANCE / 100, "allowance", "奶奶的零花钱");
      events.push("奶奶托渡口的人捎来 " + G.fmtCents(ALLOWANCE) + " 零花钱！（每 " +
        ALLOWANCE_INTERVAL + " 天一次）");
    }
    if (p.letterDay > 0 && p.day >= p.letterDay + 3) {
      p.letterDay = 0;
      p.mood = Math.min(100, p.mood + 5);
      var quote = p.letterText ? "（你上封信说：\u201c" + p.letterText + "\u201d）" : "";
      events.push("邮差捎来奶奶的回信：" + quote + "\u201c多吃点，别老赌钱。\u201d（心情 +5）");
    }
    // 农业：雇工工钱（按已播种地块计）/ 收成 / 仓库
    if (p.workerDays > 0 && p.planted > 0) {
      var wage = WORKER_WAGE * p.planted;
      p.workerDays -= 1;
      wallet.settle(-wage / 100, "farm", "雇工工钱");
      events.push("雇工又打理了 " + p.planted + " 块地（工钱 " + G.fmtCents(wage) + "），还剩 " + p.workerDays + " 天。");
      if (p.workerDays <= 0) events.push("雇工的活儿干完了，田里没人打理了。");
    }
    // 先落成仓库，再收成（否则收成会误走"无仓库贱卖"）
    if (p.warehouse === 1 && p.day >= p.warehouseDay) {
      p.warehouse = 2;
      events.push("罗伯特抻着腰喊：仓库盖好了！以后收成有地方存了。");
    }
    if (p.planted > 0 && p.day >= p.harvestDay) {
      var gain = p.planted * HARVEST_PRICE;
      if (p.warehouse === 2) {
        p.stored += gain;
        events.push("收成装进了仓库（存货 +" + G.fmtCents(gain) + "）。");
      } else {
        wallet.settle(gain / 100, "farm", "卖麦子(无仓库贱卖)");
        events.push("雇工把收成挑去集市贱卖了 " + G.fmtCents(gain) + "——没有仓库，存不住。");
      }
      p.planted = 0;
    }
    // 果园：挂果自动收（不耗雇工，果树自己长；收成直接入账）
    if (p.orchardPlanted > 0 && p.day >= p.orchardDay) {
      var ogain = p.orchardPlanted * ORCHARD_HARVEST;
      wallet.settle(ogain / 100, "farm", "卖果园收成");
      events.push("果园里的果子熟了，摘下来卖得 " + G.fmtCents(ogain) +
        "（果树不用雇工，省心）。");
      p.orchardPlanted = 0;
    }
    return events;
  },

  /* ---------- 赊账/贷款 ---------- */
  /* 钱包还能赊多少（分）：balance + $30 */
  credit: function (wallet) {
    return wallet.balanceCents() - WALLET_MIN;
  },

  /* 还能不能进赌局（老板不赊账的门槛：余额 ≤ -$30 禁止） */
  canGamble: function (wallet) {
    return wallet.balanceCents() > WALLET_MIN;
  },

  /* 向商人贷款：现金入账 + 债务记录 */
  takeLoan: function (wallet, amountCents) {
    var p = this.load(wallet);
    wallet.settle(amountCents / 100, "loan", "向商人贷款");
    p.loan += amountCents;
    return p.loan;
  },

  /* 还贷款（现金够才还） */
  repayLoan: function (wallet, amountCents) {
    var p = this.load(wallet);
    if (wallet.balanceCents() < amountCents) return null;   // 现金不够
    wallet.settle(-amountCents / 100, "loan", "偿还贷款");
    p.loan = Math.max(0, p.loan - amountCents);
    return p.loan;
  },

  /* ---------- 日赢钱上限 ---------- */
  winCapFor: function (gameKey) {
    if (!DAILY_WIN_CAP_ENABLED) return null;               // 已开放：日赢无限
    if (gameKey === "blackjack") return this.bjCap(this.state);
    return CAP_GAMES[gameKey] || null;
  },

  /* 今日已从该 NPC 赢了多少（分） */
  winUsed: function (p, gameKey) { return p.dailyWin[gameKey] || 0; },

  /* 今日还能赢多少（分）；无上限返回 null。
   * 21点：老板的钱先被上桌 NPC 赢走的话，玩家能赢的更少（NPC 输回来则恢复）。 */
  winRemain: function (p, gameKey) {
    var cap = this.winCapFor(gameKey);
    if (cap === null) return null;
    var pool = cap;
    if (gameKey === "blackjack") pool = Math.max(0, cap - (p.bjNpcNet || 0));
    return Math.max(0, pool - this.winUsed(p, gameKey));
  },

  /* 封顶：返回实际可入账金额（分）。输钱/作弊模式不封顶 */
  applyWinCap: function (p, gameKey, deltaCents) {
    if (deltaCents <= 0) return deltaCents;
    var cap = this.winCapFor(gameKey);
    if (cap === null) return deltaCents;
    if (typeof cheatActive === "function" && cheatActive()) return deltaCents;  // 作弊豁免
    var remain = this.winRemain(p, gameKey);
    var actual = Math.min(deltaCents, remain);
    p.dailyWin[gameKey] = (p.dailyWin[gameKey] || 0) + actual;
    return actual;
  },

  /* ---------- 主角 ---------- */
  playerName: function (p) {
    return p.playerName || DEFAULT_NAME;
  },

  /* 改名（扣 $5）：现金够才改 */
  rename: function (wallet, newName) {
    var p = this.load(wallet);
    if (wallet.balanceCents() < RENAME_COST) return null;
    wallet.settle(-RENAME_COST / 100, "misc", "改名");
    p.playerName = newName;
    return p.playerName;
  },

  /* ---------- 丽塔好感度 ---------- */
  addRita: function (p, delta) {
    p.rita = Math.max(0, Math.min(100, (p.rita || 0) + delta));
    return p.rita;
  },

  canGiftRita: function (p) { return p.day !== p.ritaGiftDay; },

  giftRita: function (p) {
    p.ritaGiftDay = p.day;
    this.addRita(p, 1);
    return p.rita;
  },

  /* ---------- 农业（艾尔卖地/种子/招工，罗伯特盖仓库） ---------- */
  /* 买地：6 块封顶（地图 2×3 田格上限）；返回块数 / null(钱不够) / "full"(买满) */
  buyLand: function (wallet) {
    var p = this.load(wallet);
    if (p.farmland >= FARMLAND_MAX) return "full";
    if (wallet.balanceCents() < LAND_PRICE) return null;
    wallet.settle(-LAND_PRICE / 100, "farm", "买农田");
    p.farmland += 1;
    return p.farmland;
  },

  buySeeds: function (wallet, n) {
    var p = this.load(wallet);
    var cost = SEED_PRICE * n;
    if (wallet.balanceCents() < cost) return null;
    wallet.settle(-cost / 100, "farm", "买种子×" + n);
    p.seeds += n;
    return p.seeds;
  },

  hireWorker: function (wallet, days) {
    var p = this.load(wallet);
    var cost = WORKER_WAGE * days;
    if (wallet.balanceCents() < cost) return null;
    wallet.settle(-cost / 100, "farm", "雇工" + days + "天");
    p.workerDays += days;
    return p.workerDays;
  },

  /* 播种：需要空闲地 + 种子 + 雇工 */
  plant: function (p) {
    var free = p.farmland - p.planted;
    if (free <= 0 || p.seeds <= 0 || p.workerDays <= 0) return null;
    p.seeds -= 1;
    p.planted += 1;
    p.harvestDay = Math.max(p.harvestDay, p.day + HARVEST_DAYS);
    return p.planted;
  },

  /* 盖仓库：罗伯特收费 $30，3 天建成 */
  hireBuilder: function (wallet) {
    var p = this.load(wallet);
    if (p.warehouse === 2) return "done";
    if (p.warehouse === 1) return "building";
    if (wallet.balanceCents() < WAREHOUSE_PRICE) return null;
    wallet.settle(-WAREHOUSE_PRICE / 100, "farm", "盖仓库");
    p.warehouse = 1;
    p.warehouseDay = p.day + 3;
    return "start";
  },

  /* 卖仓库存货 */
  sellStored: function (wallet) {
    var p = this.load(wallet);
    if (!p.stored) return null;
    wallet.settle(p.stored / 100, "farm", "卖仓库存货");
    var s = p.stored;
    p.stored = 0;
    return s;
  },

  /* ---------- 农业二期：果园（河西果园） + 池塘 ---------- */

  /* 买果园地：3 块封顶；返回块数 / null(钱不够) / "full"(买满) */
  buyOrchardLand: function (wallet) {
    var p = this.load(wallet);
    if (p.orchard >= ORCHARD_MAX) return "full";
    if (wallet.balanceCents() < ORCHARD_LAND_PRICE) return null;
    wallet.settle(-ORCHARD_LAND_PRICE / 100, "farm", "买果园地");
    p.orchard += 1;
    return p.orchard;
  },

  buySaplings: function (wallet, n) {
    var p = this.load(wallet);
    var cost = SAPLING_PRICE * n;
    if (wallet.balanceCents() < cost) return null;
    wallet.settle(-cost / 100, "farm", "买果苗×" + n);
    p.saplings += n;
    return p.saplings;
  },

  /* 种果：需要空闲果园地 + 果苗（不耗雇工——果树自己长，长线省心） */
  plantOrchard: function (p) {
    var free = p.orchard - p.orchardPlanted;
    if (free <= 0 || p.saplings <= 0) return null;
    p.saplings -= 1;
    p.orchardPlanted += 1;
    p.orchardDay = Math.max(p.orchardDay, p.day + ORCHARD_DAYS);
    return p.orchardPlanted;
  },

  /* 池塘捞鱼：$0.2/次，随机池塘鱼；返回鱼对象或 null(钱不够) */
  pondFish: function (wallet) {
    var p = this.load(wallet);
    if (wallet.balanceCents() < POND_COST) return null;
    wallet.settle(-POND_COST / 100, "farm", "池塘捞鱼");
    var r = Math.random();
    if (r < 0.3) return { name: "泥鳅", price: 30, desc: "滑溜溜的泥鳅，池塘里最常见。" };
    if (r < 0.7) return { name: "草鱼", price: 50, desc: "吃水草的草鱼，肉厚实。" };
    if (r < 0.9) return { name: "鲢鱼", price: 80, desc: "白鲢，能卖个好价。" };
    return { name: "烂草鞋", price: 5, desc: "池塘底捞上来的烂草鞋……谁扔的？" };
  },

  /* ---------- 钓鱼 / 寄信 ---------- */
  /* 钓到的鱼池：name/卖价(分)/描述 */
  fishPool: function () {
    var r = Math.random();
    if (r < 0.3) return { name: "鳊鱼", price: 50, desc: "河里的鳊鱼，肉嫩但小。" };
    if (r < 0.7) return { name: "鲈鱼", price: 100, desc: "渡口人爱吃的鲈鱼。" };
    if (r < 0.9) return { name: "鳗鱼", price: 200, desc: "滑溜溜的鳗鱼，值钱。" };
    return { name: "烂靴子", price: 10, desc: "一只泡烂的靴子……谁扔的？" };
  },

  /* 挂鱼标本（房间墙，最多 2 条） */
  addTrophy: function (p, fishName) {
    if (!p.trophies) p.trophies = [];
    if (p.trophies.length >= 2) return false;
    p.trophies.push(fishName);
    return true;
  },

  /* 寄信给奶奶（$0.5 邮资，内容自定义，奶奶回信时引用） */
  sendLetter: function (wallet, text) {
    var p = this.load(wallet);
    if (wallet.balanceCents() < 50) return null;
    wallet.settle(-0.5, "misc", "寄信给奶奶");
    p.letterDay = p.day;
    p.letterText = (text || "").toString().slice(0, 60);
    return p.letterDay;
  },

  /* 统一结算入口：作弊归零 + 赢钱封顶 + 记账（钱包最低 -$30 由 Wallet.settle 兜底）。
   * 替代各游戏里的 cheatSettle；贪吃蛇无 NPC 上限故不封顶。 */
  settleBet: function (wallet, deltaDollars, game, reason) {
    var p = this.load(wallet);
    var cents = toCents(deltaDollars);
    if (typeof cheatActive === "function" && cheatActive() && cents < 0) {
      cents = 0;
      reason += "(酒馆睁一只眼闭一只眼)";
    }
    var capped = this.applyWinCap(p, game, cents);
    if (capped < cents) reason += "(今日已赢够" + G.fmtCents(this.winCapFor(game)) + "，超出没给)";
    wallet.settle(capped / 100, game, reason);
    return capped;
  },

  /* ---------- 认同度 ---------- */
  addReputation: function (p, delta) {
    p.reputation = Math.max(0, Math.min(100, (p.reputation || 10) + delta));
    return p.reputation;
  },

  repLevel: function (p) {
    var rep = p.reputation || 10;
    for (var i = REP_LEVELS.length - 1; i >= 0; i--) {
      if (rep >= REP_LEVELS[i].min) return i;
    }
    return 0;
  },

  repTitle: function (p) { return REP_LEVELS[this.repLevel(p)].title; },

  /* 每退出一次大厅游戏调用：推进时间/触发提醒/自动睡觉。
   * 返回 { action: 'ok'|'noon'|'evening'|'sleep', text } */
  onLeaveGame: function (p) {
    p.visits += 1;
    if (p.period === "morning" && p.visits >= 5) {
      p.period = "noon"; p.visits = 0;
      return { action: "noon", text: "抬头一看，太阳已经挂到头顶——中午了。" };
    }
    if (p.period === "noon" && p.visits >= 5) {
      p.period = "evening"; p.visits = 0;
      return { action: "evening", text: "天黑了。主角伸个懒腰，自言自语：“该睡觉了……再来一两局。”" };
    }
    if (p.period === "evening" && p.visits >= 2) {
      return { action: "sleep", text: "主角打了个大大的哈欠，揉揉眼睛，自己走回二楼睡了……" };
    }
    return { action: "ok", text: "" };
  },

  /* 时段信息 */
  periodInfo: function (p) { return PERIODS[p.period] || PERIODS.morning; },

  /* ---------- 心情 ---------- */
  addMood: function (p, delta) {
    p.mood = Math.max(0, Math.min(100, p.mood + delta));
    return p.mood;
  },

  moodFace: function (mood) {
    for (var i = 0; i < MOOD_FACES.length; i++) if (mood <= MOOD_FACES[i].max) return MOOD_FACES[i];
    return MOOD_FACES[MOOD_FACES.length - 1];
  },

  /* 赌局净额 → 心情变化（净赢升、净输降）：赢 $1 → +3，赢 $5 → +7；输 $1 → -5 */
  moodDeltaForBet: function (netCents) {
    if (netCents > 0) return Math.min(8, 3 + Math.floor((netCents - 100) / 100));
    if (netCents < 0) return -Math.min(10, 5 + Math.floor((-netCents - 100) / 100));
    return 0;
  },

  /* ---------- 日历 ---------- */
  calendarText: function (p) {
    return "柳溪历 " + p.month + "月 " + p.monthDay + "日 · " + WEEKDAYS[p.weekday] +
      "（第 " + p.day + " 天）";
  },

  /* 当前时段内的进出游戏进度（日历面板展示用） */
  progressText: function (p) {
    var need = p.period === "evening" ? 2 : 5;
    return p.period === "evening"
      ? "入夜了，最多还能进出 " + Math.max(0, need - p.visits) + " 次游戏，然后就得睡了"
      : PERIODS[p.period].name + "（进出游戏 " + p.visits + "/" + need + " 次后进入下一时段）";
  },
};

/* ---------- 吧台菜单（酒水小吃） ---------- */
var BAR_MENU = [
  { id: "ale",   name: "麦酒",   price: 100, mood: 10, desc: "奥托家传的麦酒，微苦回甘。" },
  { id: "bread", name: "黑面包", price: 50,  mood: 5,  desc: "粗粝的黑面包，管饱。" },
  { id: "fish",  name: "烤鲈鱼", price: 200, mood: 15, desc: "渡口渔户今早送来的鲈鱼。" },
  { id: "soup",  name: "热汤",   price: 150, mood: 12, desc: "洋葱和剩肉熬的，暖胃。" },
];

/* 请全场喝酒：花钱换村民认同度 */
var TREAT_OPTIONS = [
  { id: "treat1", name: "请一轮麦酒", price: 300, rep: 3,  desc: "给在座每人来一杯麦酒。" },
  { id: "treat2", name: "请顿好酒好菜", price: 800, rep: 8, desc: "麦酒烤鱼管够——村里人都会记你的好。" },
];

/* ---------- 家具目录（商店出售，14 种） ---------- */
var FURNITURE = [
  { id: "desk2",     name: "书桌",     price: 800,  w: 2, h: 1, draw: "desk2",     solid: true,  desc: "读书写字，也放账本。",
    story: "桌面磨得发亮，边角有个浅浅的凹痕——像是以前有人在这儿记账，算盘珠子都拍出了印。" },
  { id: "bookshelf", name: "书架",     price: 600,  w: 1, h: 1, draw: "bookshelf", solid: true,  desc: "摆着几本旧书的架子。",
    story: "书脊都翻卷了。有一本《柳溪河志》，扉页写着谁的名字，已经看不太清。" },
  { id: "wardrobe",  name: "衣柜",     price: 1000, w: 1, h: 1, draw: "wardrobe",  solid: true,  desc: "装得下两季衣裳。",
    story: "拉开柜门，一股樟木味。角落里挂着件洗得发白的旧袄——奶奶说，天冷要记得穿。" },
  { id: "chest",     name: "钱箱",     price: 1200, w: 1, h: 1, draw: "chest",     solid: true,  desc: "上锁的木箱——虽然是空的。",
    story: "锁是新配的，箱子是旧的。箱底刻着个歪歪扭扭的“柳”字，像小孩子的手笔。" },
  { id: "plant",     name: "盆栽",     price: 300,  w: 1, h: 1, draw: "plant",     solid: false, desc: "一盆绿油油的不知名草。",
    story: "叶子油亮亮的，几天不浇水也精神。老渔夫说，柳溪村的水土养东西。" },
  { id: "painting",  name: "挂画",     price: 400,  w: 1, h: 1, draw: "painting",  solid: false, desc: "画的是柳枝河，挂在墙上。",
    story: "画里的柳枝河拐了个弯，河湾里隐约有个小人——画它的人，大概就住在这条河边。" },
  { id: "candle",    name: "落地烛台", price: 500,  w: 1, h: 1, draw: "candle",    solid: false, desc: "夜里看书就靠它了。",
    story: "烛泪一层叠一层。要是半夜点着它往窗外看，能看见河上晃动的灯影。" },
  { id: "rug2",      name: "织花地毯", price: 700,  w: 3, h: 2, draw: "rug2",      solid: false, desc: "比原来的地毯暖和。",
    story: "踩上去软软的。织的纹样是麦穗和柳叶——村里姑娘出嫁前都织一条。" },
  { id: "rocking",   name: "摇椅",     price: 900,  w: 1, h: 1, draw: "rocking",   solid: true,  desc: "吱呀吱呀的摇椅。",
    story: "坐上去一摇，木头就吱呀吱呀地响。奶奶说，人老了就爱听这个声儿。" },
  { id: "roundtable",name: "小圆桌",   price: 500,  w: 1, h: 1, draw: "roundtable",solid: true,  desc: "一张小圆桌，两条凳。",
    story: "桌面不大，刚好放一壶酒两只杯。要是哪天有客人来，正好坐这儿。" },
  { id: "vase",      name: "花瓶",     price: 350,  w: 1, h: 1, draw: "vase",      solid: false, desc: "白瓷瓶，插着几枝野花。",
    story: "瓶里的野花蔫了，换水又能活两天。安娜说，村东头那片紫花最衬这个瓶子。" },
  { id: "lampstand", name: "灯笼架",   price: 550,  w: 1, h: 1, draw: "lampstand", solid: false, desc: "立式的灯笼架。",
    story: "晚上点上，满屋都是暖黄的。挂在窗口那盏，能从楼下远远看见。" },
  { id: "instrument",name: "墙上笛子", price: 450,  w: 1, h: 1, draw: "instrument",solid: false, desc: "一支竹笛挂在墙上。",
    story: "笛子磨得油亮。吹起来，调子像渡口的船歌——下过雨之后尤其好听。" },
  { id: "mirror",    name: "落地镜",   price: 800,  w: 1, h: 1, draw: "mirror",    solid: false, desc: "一面铜边穿衣镜。",
    story: "镜面起了雾似的旧。照久了，总觉得镜子里的人比自己慢半拍。" },
];

/* 书架里的书（背景故事/村里传说） */
var BOOKS = [
  { title: "《柳溪河志·渡口篇》", text: "柳枝河拐弯处的渡口，摆渡的船家换了一茬又一茬。老人们说，那年河汛卷走的船夫里，有一个是玛莎的男人。船没找回来，人也没有。" },
  { title: "《柳溪村·雨夜的柳树》", text: "村口那棵老柳，逢雨夜会“说话”。风穿过树洞的呜呜声，被说成是柳树在念叨谁的名字。没人当真，可雨夜没人愿意从它底下过。" },
  { title: "《精灵旧屋的账本》", text: "村西精灵旧屋的窗台上压着半本旧账。记的是一百年前的葡萄账、酒账、人情账。最后一行写着：欠柳溪村一回体面。" },
  { title: "《领主庄园记事》", text: "庄园不大，规矩不小。老仆希格记的流水账里，年年都有“葡萄歉收”四个字——可葡萄架下埋着的酒桶，一年比一年多。" },
  { title: "《手气》", text: "村里人赌钱，看的是牌。只有老渔夫说，看的是水——水顺的时候，手气也顺。他活了这么大岁数，从不说死话。" },
  { title: "《柳溪村·精灵祖坟的灯影》", text: "村北的精灵祖坟，每逢百年必闹一回“灯影”——夜里坟头会浮起一点幽幽的亮，走近就散。老人们说是祖上惦记后人，回来看看；年轻人说，那是磷火。可村里没人敢在灯影出现的夜里去祖坟边——连最胆大的醉汉都不敢。" },
  { title: "《柳溪河·水鬼的传闻》", text: "老辈人都说，柳枝河里有水鬼，专挑雨夜拉人下水。渡口的船夫从不在雨夜摆渡，宁可白等一夜。可谁也没真见过水鬼——倒是有一回，河面浮起一只湿漉漉的旧靴子，漂到岸边，自己立住了。那夜之后，渡口的灯，再没熄过。" },
];

/* 家具 → 房间摆放位置（x,y 与绘制 id） */
var FURNITURE_POS = {
  desk2:     { x: 2,  y: 2 },
  bookshelf: { x: 18, y: 2 },
  wardrobe:  { x: 18, y: 6 },
  chest:     { x: 1,  y: 10 },
  plant:     { x: 5,  y: 2 },
  painting:  { x: 5,  y: 0 },
  candle:    { x: 1,  y: 7 },
  rug2:      { x: 6,  y: 9 },
  rocking:   { x: 4,  y: 9 },
  roundtable:{ x: 12, y: 5 },
  vase:      { x: 18, y: 4 },
  lampstand: { x: 18, y: 8 },
  instrument:{ x: 13, y: 0 },
  mirror:    { x: 2,  y: 5 },
};

/* 已购家具 → 房间 objects 列表（由 Engine.setScene 拼入） */
function furnitureObjects(furnitureIds) {
  var out = [];
  (furnitureIds || []).forEach(function (id) {
    var f = FURNITURE.filter(function (x) { return x.id === id; })[0];
    var pos = FURNITURE_POS[id];
    if (!f || !pos) return;
    out.push({
      id: f.draw, x: pos.x, y: pos.y, w: f.w, h: f.h,
      solid: f.solid, furniture: true, label: f.name, action: "furniture_talk",
    });
  });
  return out;
}

/* ---------- 随机 NPC 闲谈台词池（按时段/心情/认同度引用） ---------- */
var SMALLTALK = {
  boss: [
    "（老板擦着杯子）今晚的麦酒又少了一桶。",
    "（老板拨着算盘）承让了，承让了。",
    "（老板）楼上客房就你一个，清静。",
    "（老板）手气这东西，跟天气一样说不准。",
  ],
  drunk: [
    "（醉汉）嗝~ 再来一瓶！",
    "（醉汉）我跟你说，渡口的鱼，昨天咬了我一口！",
    "（醉汉）这牌……这牌跟我的酒一样，上头。",
    "（醉汉歪在椅子上）账……先记着，记着。",
  ],
  villager: [
    "（村民）今儿地里活儿干完了，来耍两把。",
    "（村民）俺家那只鸡，又跑到领主地里去了……",
    "（村民）这雨再下下去，渡口的船可要歇了。",
    "（村民）你奶奶捎话来了，说让你别赌太大。",
  ],
  merchant: [
    "（商人）今日账目，分毫不差。",
    "（商人）听说河对岸的集市，这两天热闹。",
    "（商人）客官，欠账的滋味不好受，悠着点。",
    "（商人敲着算盘）一厘不让，是规矩。",
    "（商人点着铜板）$1 折一银毫，零头当面点清——铜板这玩意儿，一厘不让。",
  ],
  rita: [
    "（丽塔端着托盘）要喝点什么？我爹请你的。",
    "（丽塔）今天渡口来了个卖艺的，可热闹了！",
    "（丽塔朝你眨眨眼）输光啦？我请你喝杯水。",
    "（丽塔哼着歌擦杯子）这破店，就靠你这样的熟客撑着了。",
    "（丽塔把一缕红发别到耳后）别老盯着我看，看牌！",
  ],
  billy: [
    "（比利按着佩剑）本官今日巡视到此，顺路喝一杯。",
    "（比利）柳溪村看着太平，我这治安官也清闲。",
    "（比利眯起眼）赌桌上的事归你，出了这门归我。",
    "（比利）精灵的规矩和人类的差不多——愿赌服输。",
  ],
  tommy: [
    "（汤米挺着胸脯）我们长官可厉害了，一条河都管得住！",
    "（汤米）嘿嘿，跟长官出来，今儿有肉吃。",
    "（汤米搓着手）这位客官，借两个铜板……回头还你。",
  ],
  will: [
    "（威尔抱着手臂，一言不发）……",
    "（威尔点点头）……嗯。",
    "（威尔盯着你的钱包看了很久）",
  ],
  higg: [
    "（希格佝偻着腰）老爷让捎句话：葡萄园今年要减租。",
    "（希格）老骨头了，跑一趟腿得歇三趟。",
    "（希格压低声音）听说庄园账房最近……咳，老奴多嘴了。",
  ],
  mark: [
    "（马克拍拍邮包）今儿送了三封信，两封是催债的。",
    "（马克）奶奶的信我搁柜台了，别忘了取。",
    "（马克擦汗）渡口的船夫说，明天河上有大风。",
  ],
  mary: [
    "（玛丽）给我称半斤黑面包，家里仨孩子等着呢。",
    "（玛丽叹气）这年头，麦子贱，什么都贵。",
    "（玛丽）你奶奶让我带话：天冷加衣裳。",
  ],
  anna: [
    "（安娜护着篮子）我的鸡蛋可不赊账！",
    "（安娜）今儿捡了八个蛋，卖完就回家喂鸡。",
    "（安娜）要买鸡蛋吗？便宜，一个铜板俩。",
  ],
  fisher: [
    "（老渔夫眯着眼）今儿鱼不咬钩，怕是水凉。",
    "（老渔夫）这河里的鲈鱼，渡口的老主顾都认。",
    "（老渔夫）钓到鳗鱼别慌，它滑，手要稳。",
    "（老渔夫）听说河底沉过一口铁锅，谁也没捞着。",
  ],
  farmer: [
    "（农夫直起腰）这地是好地，就是缺个仓库。",
    "（农夫）听商人说要倒腾个粮仓，村里人都盼着。",
    "（农夫）俺家地租年年涨，老爷的管家不好说话。",
    "（农夫）麦子熟了得赶天，一场雨就全完了。",
  ],
  guard: [
    "（卫兵抱着长矛）老爷的地盘，闲人免进。",
    "（卫兵）庄园重地，没事别在门口晃。",
    "（卫兵打了个哈欠）这班岗，站得人发困。",
  ],
  al: [
    "（艾尔）这地是好地，卖给你，保你回本。",
    "（艾尔）种子是去年的陈麦种，出芽慢点，便宜。",
    "（艾尔）雇工我有门路，河对岸的壮劳力，一天管饭就行。",
    "（艾尔）你一个赌钱的买地？新鲜——不过钱给够就行。",
  ],
  robert: [
    "（罗伯特拍了拍手上的灰）仓库图纸我都画好了。",
    "（罗伯特）盖仓库要木料要人手，$30 不讲价。",
    "（罗伯特）老渔夫说河运便宜，可这木头还得从山上拉。",
    "（罗伯特）等仓库盖好，你这庄稼汉就当定了。",
  ],
  gardener: [
    "（老园丁剪着枝）果树这东西，急不得。",
    "（老园丁）河西的果子甜，水汽足。",
    "（老园丁）果苗十年成大木，人都老了一茬。",
    "（老园丁）等果子红了，记得来摘。",
  ],
  priest: [
    "（老牧师低声）见过修剪过耳朵的人吗？见过就当没见过——人家活着，已经不容易了。",
    "（老牧师拨着烛芯）生命之神赐予万物生命，也赐予你。",
    "（老牧师）石头教堂不挑人，神也不挑人。",
    "（老牧师拨着烛芯）这教堂的规矩：石头搭的，人类也能进。别处可没这恩典。",
    "（老牧师）香油钱不拘多少，心诚则灵。",
  ],
  /* 储备角色闲谈（背景设定.md 人物志，2026-08-18 进 Web 版） */
  lord: [
    "（领主端详着酒杯）今年的麦酒……差些火候。",
    "（领主）本爵爷的葡萄园今年又歉收，工钱怕是要赊一赊。",
    "（领主哼了一声）跟你们赌，本爵爷只是让让你们。",
  ],
  vera: [
    "（薇拉拢了拢衣袖）屋瓦又漏了……雨夜有得忙了。",
    "（薇拉）替领主抄完账，来坐坐——输赢都不大，就是图个热闹。",
    "（薇拉轻声）祖上阔过……这话，我都快说厌了。",
  ],
  husk: [
    "（哈斯克）替老爷买两壶酒，顺道看看账。",
    "（哈斯克）楼上那位吃闲饭的，老爷迟早要赶。",
    "（哈斯克压低声）老爷家的葡萄园，账上又是一年歉收。",
  ],
};

/* 认同度解锁的台词（level 1/2/3 追加；现在只写闲话，不推进剧情） */
var REP_TALK = {
  boss: [
    "（老板）昨晚的麦酒卖得不错，今儿该去渡口补货了。",
    "（老板）你奶奶年轻时候，在这酒馆打过下手，账算得比我还精。",
    "（老板难得地笑了）手气旺的时候，记得请我喝一杯。",
  ],
  drunk: [
    "（醉汉凑近）告诉你个秘密……我根本没那么醉。",
    "（醉汉）欠你的那顿酒，改天连本带利还你。",
    "（醉汉）整个村子，就你懂我为什么爱喝酒。",
  ],
  villager: [
    "（村民）俺家登记在柳叶老爷名下，收租服劳役，一年到头图个安稳——比城里差，可比逃难的强。",
    "（村民压低声音）城里头，人类和精灵结亲是死罪，多少年才出一个案子——听说男的那位没了，唉，何苦呢。",
    "（村民）听说大城请了魔法师修桥，咱们村要是有半个就好了。",
    "（村民）你是个好孩子，比俺家那俩强。",
    "（村民）要不……俺教你认地里的庄稼？省得天天赌钱。",
    "（村民抹抹眼睛）你奶奶上回来，念叨了你一路。",
  ],
  merchant: [
    "（商人）魔法师都登记在册，领主的府邸里也养着几个——那是人才，不是传说。",
    "（商人）你在这村里的名声，可比你账上的钱值钱。",
    "（商人）要我说，这酒馆的客人里，就你最靠得住。",
    "（商人）以后用钱周转，先找我，利息给你算最低的。",
  ],
  lord: [
    "（领主难得正眼瞧你）听说你牌运不错？改日跟本爵爷过两招。",
    "（领主压低声音）庄园的账……最近有点对不上。你若是闲着，帮本爵爷留意着点。",
    "（领主拍了拍你的肩）后生可畏。本爵爷认你这个朋友——咳，休要声张。",
  ],
  vera: [
    "（薇拉朝你点点头）你这个人，倒不算俗气。",
    "（薇拉犹豫了一下）那半本旧账……你若是有空，帮我看看。有些字，我认不全。",
    "（薇拉难得笑了）屋瓦补上了，雨天总算能睡个安稳觉。多谢你惦记。",
  ],
  husk: [
    "（哈斯克打量你一眼）啧，倒是个懂规矩的。",
    "（哈斯克凑近）老爷最近心情不错——你若是缺钱周转，趁这时候开口。",
    "（哈斯克搓着手）以后在这村里，有人欺负你，报老爷的名号——咳，报我老哈斯克的也行。",
  ],
};

/* 按时段/心情/认同度挑一句闲谈 */
function smalltalkFor(npcId, period, mood, reputation) {
  var pool = SMALLTALK[npcId] || SMALLTALK.merchant;
  var lines = pool.slice();
  var rep = reputation || 10;
  if (rep >= 30 && REP_TALK[npcId]) lines = lines.concat(REP_TALK[npcId].slice(0, 1));
  if (rep >= 60 && REP_TALK[npcId]) lines = lines.concat(REP_TALK[npcId].slice(1, 2));
  if (rep >= 90 && REP_TALK[npcId]) lines = lines.concat(REP_TALK[npcId].slice(2, 3));
  if (mood >= 70) lines.push("（心情不错）今天的日子，值得来一杯！");
  if (mood <= 25) lines.push("（唉声叹气）这日子……过得没什么滋味。");
  if (period === "evening") lines.push("（夜色渐深）都这个时辰了，明儿还得赶早。");
  return lines[Math.floor(Math.random() * lines.length)];
}

/* NPC 名字与可交互对话（E 键靠近说话；greet 打招呼 / village 聊村里 / self 说说自己） */
var NPC_NAMES = {
  boss: "老板", drunk: "醉汉", villager: "村民", merchant: "商人", rita: "丽塔",
  fisher: "老渔夫", al: "艾尔", robert: "罗伯特", guard1: "卫兵", guard2: "卫兵",
  billy: "比利", tommy: "汤米", will: "威尔", higg: "希格", mark: "马克",
  mary: "玛丽", anna: "安娜",
  gardener: "老园丁", priest: "老牧师",
  lord: "领主·柳叶", vera: "薇拉", husk: "管家哈斯克",
};

var NPC_TALK = {
  boss: {
    greet: ["哟，客官，今天玩点什么？", "老规矩？"],
    village: ["村里的麦子快收了，赌桌上的彩头也跟着多了。", "听说领主又要涨地租，大家伙儿都压着气。"],
    self: ["我年轻时在庄园当过护院，攒了点钱盘下这酒馆，图个安稳。", "这酒馆开二十年了，进进出出的脸，我记着大半。"],
  },
  drunk: {
    greet: ["嗝~ 来了啊！", "咦？熟人！"],
    village: ["渡口的鱼，昨天的比今天的大。", "听说河对岸新来个卖艺的，改天咱去瞅瞅？"],
    self: ["跟你说，我根本没醉——是这板凳自己在晃。", "我赊的账，等手气好了连本带利还。"],
  },
  villager: {
    greet: ["来了啊，坐！", "今儿得空，耍两把。"],
    village: ["俺家地里的麦子，今年能多收两斗。", "这雨再下，渡口的船该歇了。"],
    self: ["俺男人走得早，俩孩子全靠这点地。", "俺不是会赌的人，就是图个热闹。"],
  },
  merchant: {
    greet: ["客官，有什么能帮忙的？", "今日账目，分毫不差。"],
    village: ["河对岸的集市，这两天要开市了，货价该动了。", "村里欠账的不少，就你这里还算清爽。"],
    self: ["账要一笔一笔记，人也要一个一个看。", "做生意，一厘不让，是规矩，也是活命的本事。"],
  },
  rita: {
    greet: ["嗨！今天喝点什么？", "你来啦！"],
    village: ["我爹说，你最近手气不错？", "渡口那边又来了卖艺的，我想去看，我爹不让。"],
    self: ["我想去河对岸看看，听说那边的集市比这儿热闹十倍。", "这酒馆是挺吵的，不过……也有意思。"],
  },
  fisher: {
    greet: ["嗯？你也来钓鱼？", "今儿鱼不咬钩，改天再来。"],
    village: ["河里的鱼，认水不认人。", "河汛那年的事……不提也罢。"],
    self: ["我在这河边钓了四十年，啥都见过。", "钓到的鱼，留着吃，或做成标本，都是缘分。"],
  },
  al: {
    greet: ["看地？还是看种子？", "来了啊，伙计。"],
    village: ["这地是好地，就是缺人打理。", "等罗伯特的仓库盖起来，村里就能囤粮了。"],
    self: ["我爷爷那辈就是种地的，到我这儿还是。", "庄稼人，信的是土，不是命。"],
  },
  robert: {
    greet: ["忙着呢，有事说事。", "哟，你来啦。"],
    village: ["等仓库盖起来，村里就有地方存粮了。", "这木头是山上拉下来的，老渔夫说走水路便宜，我嫌慢。"],
    self: ["干我们这行，手上有茧，心里有数。", "盖房子跟做人一样，地基打牢了才不倒。"],
  },
  gardener: {
    greet: ["看果苗？还是看地？", "河西的风土，最适合果树。"],
    village: ["河西的地，比村南肥，就是过河麻烦。", "等集市开了，果园的果子能卖个好价。"],
    self: ["我在这儿种了六十年果树，树比人活得久。", "果树不吭声，但最认人——你对它好，它就结果。"],
  },
  priest: {
    greet: ["愿生命之神保佑你。", "迷途的羔羊，进来坐坐？"],
    village: ["这教堂只能用石头搭——木头会朽，石头不会，神记着最普通的人。",
      "村里人都信生命之神，逢节就来烛前坐坐。你们人类能进来参拜，是这村子的恩典。"],
    self: ["我在这密林里守了五十年烛火，看着一代代人来，一代代走。",
      "石头教堂比人活得久。我这把老骨头，大概也会变成它的一部分。"],
    story: [
      "这教堂的规矩是祖辈传下来的：只能用石头搭。石头最朴素，象征生命之神关怀最普通的生灵——木头会朽，石头不会。",
      "书上说生命之神是位绿发黑瞳的圣母，赐万物以生命。可我也没见过祂的衣角——信，就对了。",
      "你们人类能进这教堂参拜，是这村子的恩典——别处可没这规矩。神不挑人，可规矩挑地方。",
      "传说密林深处有妖魔的地界，祖辈在林子边立了界碑，谁也不许越过。我在这守了五十年，没见过谁跨过那碑。",
      "渡口的老周，天天吹河底有条大鱼。我年轻时真信过，后来才明白，他说的是他自己那个胖儿子。",
      "老板奥托年轻时在庄园当护院，有晚喝多了，把看门狗认成贼，追了半宿——第二天全村都知道了。",
      "你奶奶年轻时在这酒馆帮过工，账算得比谁都精。老板到现在还念叨，说她要留下来，账房轮不到佩尔。",
      "河边老渔夫钓到过一条鳗鱼，说那鱼会朝人眨眼。他儿子说是水光晃的，爷俩为这事拌了一辈子嘴。",
    ],
  },
  guard: {
    greet: ["……（示意你站远点）", "有事说事，别靠近大门。"],
    village: ["庄园里头的事，不该问别问。", "领主老爷最近……反正你少打听。"],
    self: ["站岗二十年，这腿比柱子还直。", "这活儿枯燥，但管饭。"],
  },
  billy: {
    greet: ["哟，本官认得你。", "治安官比利在此。"],
    village: ["柳溪村看着太平，我这治安官也清闲。", "精灵的规矩和人类的差不多——愿赌服输。"],
    self: ["本官年轻时也赌过，后来当了差，就戒了。", "当差这些年，看人看牌都准。"],
  },
  tommy: {
    greet: ["嘿嘿，长官的跟班儿，汤米。", "有啥吩咐？"],
    village: ["跟着长官，今儿有肉吃。", "村里的事，我们长官门儿清。"],
    self: ["我腿脚快，跑腿的活儿都归我。", "借两个铜板……回头还你，真的。"],
  },
  will: {
    greet: ["……（点点头）", "……嗯。"],
    village: ["……（摇头）", "……（指指渡口）"],
    self: ["……（拍了拍腰间的短刀）", "……（难得开口）话少，手稳。"],
  },
  higg: {
    greet: ["老奴给……咳，您来了。", "老爷家的老仆，希格。"],
    village: ["葡萄园今年又歉收，老爷愁着呢。", "庄园的账……老奴不敢多嘴。"],
    self: ["在庄园干了三十年，跑断腿的老骨头。", "精灵的体面，有时比命还重。"],
  },
  mark: {
    greet: ["邮差马克，今儿三封信。", "有你的信吗？"],
    village: ["渡口的船夫说，明天河上有大风。", "河对岸集市开了，托我带东西的多了。"],
    self: ["这活儿腿脚要快，嘴要严。", "信上写的都是别人的日子，我替人传话。"],
  },
  mary: {
    greet: ["哎，是你啊。", "买黑面包吗？"],
    village: ["麦子贱，什么都贵。", "你奶奶让我带话：天冷加衣裳。"],
    self: ["家里仨孩子，就指着我这点力气。", "日子紧是紧，能过。"],
  },
  anna: {
    greet: ["我的鸡蛋可不赊账！……是你啊，那没事。", "今儿蛋都卖出去了。"],
    village: ["鸡下蛋也看天气，雨天少两个。", "等仓库盖好，我家的蛋也有地方囤了。"],
    self: ["养鸡比种地省心，就是起得早。", "鸡蛋换钱，钱换米，米养鸡——日子就这么转。"],
  },
  /* 储备角色（背景设定.md 人物志，2026-08-18 进 Web 版） */
  lord: {
    greet: ["哼，本爵爷今日得闲，来你酒馆坐坐。", "这酒馆倒还干净……咳，摆一桌牌。"],
    village: ["本爵爷的葡萄园今年又歉收，工钱怕是要赊一赊。", "这村子的租子就是本爵爷的体面——咳，说多了。"],
    self: ["本爵爷的庄园不大，可规矩不小。雇工做事，讲究个本分。", "精灵活了三百年，什么场面没见过——当然，牌面除外。"],
    story: [
      "葡萄园的事……年年歉收，可地窖里的酒桶一年比一年多。账房说这叫存粮，本爵爷觉得，这叫体面。",
      "哈斯克那老东西，贪小便宜，可办事还算牢靠。收租算账这种事，本爵爷懒得亲自过问。",
      "精灵穷鬼？哼，端体面的破落户罢了。不过……薇拉那丫头，账算得确实利索，本爵爷的账房都夸她。",
      "听说大城里有会修桥的魔法师，本事要登记在册。本爵爷这穷乡僻壤，有个算账的就够用了。",
    ],
  },
  vera: {
    greet: ["你也来……？我只是路过，顺道坐坐。", "今天替领主抄完了账，来歇歇。"],
    village: ["我那屋瓦又漏了，雨天屋里摆满盆——体面要紧，天也要紧。", "祖上阔过……如今只剩一身体面了。"],
    self: ["精灵的体面，有时比命还重。日子虽紧，可不能让人看扁了。", "替领主抄账挣几个铜板，够买米就行。别的不敢想。"],
    story: [
      "这屋子是祖上传下来的，窗台上还压着半本旧账。记的是一百年前的葡萄账、酒账、人情账——最后一行写着：欠柳溪村一回体面。",
      "祖上那会儿，庄园可比柳叶家气派。如今……铜板落进铁锅都听不见响。",
      "有一回漏雨漏得厉害，我拿祖传的银器去换铜板修瓦。掌柜说东西太旧不值钱——我扭头就走了。宁可接着摆盆，也不贱卖祖上。",
    ],
  },
  husk: {
    greet: ["你就是楼上那位吃闲饭的？别挡道。", "替老爷买两壶酒……顺道看看你们这些闲人。"],
    village: ["替老爷收租得会算——算少了自己贴，算多了老爷骂。", "楼上那位吃闲饭的房客，老爷迟早要赶。"],
    self: ["在老爷家干了三十年，跑断腿的老骨头。", "做人呐，得懂规矩。懂规矩的人，才有饭吃。"],
  },
};

/* 玩家可以询问 NPC 的问题（2026-08-17）：
 * generic = 任何 NPC 都能回答的通用问题；npc = 各 NPC 专属问题。
 * 答案贴合人设与世界观（含伏笔：渡口/领主/奶奶/传说）。 */
var QUESTIONS = {
  generic: [
    { q: "我该怎么赚点钱？", a: "赌桌碰运气、河边钓鱼、种地收粮、果园挂果——哪样都能来钱，就看你肯下哪边的手。" },
    { q: "领主是个什么样的人？", a: "柳叶老爷？架子摆得大，其实也不宽裕——葡萄园收成一年不如一年，工钱有时候都发不顺。" },
    { q: "你认识我奶奶吗？", a: "艾格尼丝？她年轻时在酒馆帮过工，账算得比谁都精，全村都认得她。你住这酒馆的钱，大半是她攒的。" },
    { q: "村里有什么传说？", a: "河里有水鬼的传闻，古柳树逢雨夜会说话，密林深处的界碑不许人靠近……都是老一辈传的，谁也没真见过。" },
    { q: "渡口的船，现在摆渡要多少钱？", a: "一人 $0.5，船夫老周吆喝一声就来。河对岸的日子跟这边差不多，都是挣命。" },
    { q: "魔法师真有传说里那么神？", a: "大城里的魔法师能修桥铺路、跟着军队打仗，本事都登记在册。咱们这种小村，一辈子也见不到一个——都当故事听。" },
    { q: "老辈传的迁徙旧话，是真的吗？", a: "祖辈传下来的话：千年前，为了躲开故土一场没完没了的战乱，一些人离开家远渡而来。人不多，日子也苦——再早的事，谁也说不清了。" },
    ],
    npc: {
      boss: [{ q: "丽塔最近怎么样？", a: "那丫头，一天到晚想往河对岸跑，说要去看集市。她娘走得早，我就剩这么个闺女，舍不得。" }],
      drunk: [{ q: "你为啥总喝这么多？", a: "嗝~ 喝多了看啥都顺眼。庄稼人嘛，愁事多，酒是唯一不讲价的伙计。" }],
      villager: [{ q: "你家的地种得怎么样？", a: "俺那三亩麦子，够俩孩子吃饱。收成好的年头，还能存俩铜板过年。" }],
      merchant: [{ q: "你这里能借钱吗？", a: "能。$10/$20/$50，日息 5%，睡一觉滚一次。丑话说前头——一厘不让。" },
        { q: "你见过魔法师吗？", a: "大城的桥就是他们修的，一根梁不用人抬，本事都登记在册。听说脾气也大，不好请。" }],
      rita: [{ q: "你想去河对岸吗？", a: "想啊！听说那边的集市热闹十倍，还有卖艺的。我爹老不让，说等我长大了再说。" }],
      fisher: [{ q: "河底真有大鱼吗？", a: "老周吹的。不过那年汛期，我是真见过一条黑影，比船还长……兴许是看花了。" }],
      al: [{ q: "庄稼怎么种才能丰收？", a: "地要歇、种子要挑、雇工要勤。最要紧的——仓库得先盖起来，不然收成白搭。" }],
      robert: [{ q: "盖仓库要多久？", a: "三天，$30，先付定金。木头从山上拉，人手我有门路，包你结实。" }],
      billy: [{ q: "村里治安怎么样？", a: "太平。真有事，本官一炷香就到——当然，赌债不归我管。" }],
      higg: [{ q: "老爷最近忙什么？", a: "葡萄园的事，还有账……老奴不敢多嘴，您也别打听。" }],
      priest: [{ q: "生命之神真的存在吗？", a: "神在不在，看你的心诚不诚。石头教堂不挑人，神也不挑人——信了，祂就在。" },
        { q: "人类为啥能进教堂？", a: "这村子开明，允许人类参拜——别处可没这恩典。听说在靠妖魔地界的边边上，人类才准自己盖教堂——可那地方隔着万重山水，是块被封锁的烂地，连奴隶都宁愿挨打不愿去。咱们这儿，算是头一份的体面。" }],
      gardener: [{ q: "果树怎么种？", a: "河西地肥水汽足，种下等五年……咳，是等五天挂果。树不吭声，但最认人。" }],
      lord: [
        { q: "葡萄园今年收成怎么样？", a: "又歉收啦。天时不济，雇工的工钱都发不利索——可地窖里的酒桶，倒是一年比一年多。怪事。" },
        { q: "你家的账，真有人做手脚吗？", a: "咳……本爵爷也是听下人风言风语。管家哈斯克跟了三十年，不该出岔子——但愿是我想多了。" },
      ],
      vera: [
        { q: "你家的祖屋，为什么不去修？", a: "修一修要一吊钱，我抄一年的账都攒不齐。再说了——这屋子是祖上传的，瓦能换，梁不能换，地不能卖。" },
        { q: "祖传的银器，真舍得当掉？", a: "宁可摆盆接雨，也不贱卖祖上的东西。体面这个东西……没了，就真没了。" },
      ],
      husk: [
        { q: "替老爷收租，油水不小吧？", a: "哎哟，这话可不敢乱说！算少了老奴自己贴，算多了老爷骂。做下人的，夹在中间最是难做人。" },
        { q: "老爷最近在忙什么？", a: "葡萄园的事，还有账……老奴不敢多嘴，您也别打听。" },
      ],
    },
};

/* NPC 之间的互动对话（2026-08-17）：
 * key = "idA-idB"（顺序无关，触发时双向查）；值 = 对话行数组（A 说、B 回、可交替），行首带名字。 */
var NPC_INTERACT = {
  "boss-drunk": [
      "老板：又赊账？这个月账上都快记不下了。",
      "醉汉：嗝~ 老规矩，赢了就还，输了……下次一起还。",
      "老板：……我就当没听见。",
    ],
    "boss-villager": [
      "村民：老板，来杯麦酒，记账上。",
      "老板：你上次记的还没清呢。",
      "村民：嘿嘿，等俺家麦子收了，连本带利。",
    ],
    "boss-rita": [
      "丽塔：爹，渡口那边又来卖艺的了，我能不能去看看？",
      "老板：不能。先把桌上的杯子擦了。",
      "丽塔：（小声）等我长大，看你还管不管得着。",
    ],
    "drunk-villager": [
      "醉汉：玛莎，今儿地里的活儿干完了？来，喝一杯！",
      "村民：俺可不喝你那种酒，回家还得喂鸡呢。",
      "醉汉：嗝~ 鸡有福气，有人惦记。",
    ],
    "merchant-drunk": [
      "商人：托比，你欠我的那笔账，啥时候还？",
      "醉汉：等手气好……嗝，连本带利。",
      "商人：（翻账本）你这句话，我听了三年了。",
    ],
    "merchant-villager": [
      "商人：大城请了魔法师修桥，一根梁不用人抬，本事都登记在册。",
      "村民：当真？咱村要是有半个，地都不用自己刨了。",
      "商人：别想啦，人家的日程排到领主的府邸里去了，轮不到咱这小村。",
    ],
    "rita-merchant": [
      "丽塔：佩尔叔，河对岸的集市，真有你说的那么热闹？",
      "商人：逢五逢十，人挤人。卖艺的、卖糖的、还有杂耍——你爹不带你去，我可没办法。",
      "丽塔：（叹气）大人说话都一个样。",
    ],
    "al-robert": [
      "艾尔：仓库啥时候能开工？地里的麦子等不起。",
      "罗伯特：图纸画好了，$30 定金一到就动工。",
      "艾尔：那行，我去催催东家。",
    ],
    "fisher-villager": [
      "老渔夫：今儿网到两条鲈鱼，渡口的老主顾订了。",
      "村民：你家那口子念叨的腌鱼，啥时候能好？",
      "老渔夫：急啥，好东西都得等。",
    ],
    "priest-fisher": [
      "老牧师：渔夫，你天天在河边，可曾见过什么……不寻常的？",
      "老渔夫：河里的东西，见过也不敢说。石头教堂的事，我不也闭嘴了几十年。",
      "老牧师：……心照不宣就好。",
    ],
    "gardener-fisher": [
      "老园丁：河西的果子熟了，要不要带两条鱼来换？",
      "老渔夫：行，明儿给你留两条大的。",
      "老园丁：树换鱼，公平。",
    ],
    "lord-husk": [
      "领主·柳叶：哈斯克，葡萄园的账，怎么又对不上？",
      "管家哈斯克：老爷，是天灾……天灾，老奴可没动过一个铜板。",
      "领主·柳叶：（哼了一声）你最好如此。",
    ],
    "lord-vera": [
      "领主·柳叶：薇拉，听说你抄账又快又准，改日来庄园帮忙？",
      "薇拉：工钱怎么算？",
      "领主·柳叶：咳……本爵爷请人，从不亏待——包一顿饭。",
      "薇拉：（微微一笑）那我还是先修屋瓦吧。",
    ],
    "husk-boss": [
      "管家哈斯克：老板，两壶麦酒，记老爷账上。",
      "老板：老爷的账……上回还没清呢。",
      "管家哈斯克：老爷的账，就是村里的体面——先赊着，赊着。",
    ],
  };


/* 钓到的鱼 → 标本展示介绍 */
var FISH_INFO = {
  "鳊鱼": "鳊鱼，河里的寻常货。鳞片银亮，肉嫩刺多。做成标本后眼睛还是亮亮的，像随时要游走。",
  "鲈鱼": "鲈鱼，渡口老主顾最爱的一口。背脊乌青，肚皮雪白。挂在墙上，倒有几分河鲜铺子的意思。",
  "鳗鱼": "鳗鱼，滑不溜秋的家伙。晒干能卖个好价钱，做成标本倒是少见——你这条算是独一份。",
  "烂靴子": "一只泡烂的靴子。标本？你大概是喝多了。不过……挂在这儿，倒像在嘲笑谁。",
};

/* 常量/数据导出：node 测试 export；浏览器下同步挂到 GS 对象，
 * 供 ui.js/main.js/game-*.js 以 GS.xxx 读取（2026-08-17 修复：
 * 此前只 export 没挂 GS，导致浏览器里 GS.LOAN_AMOUNTS 等全为 undefined——
 * 贷款面板点击崩溃、仓库价格/利息/天数等显示 NaN/undefined） */
var GS_EXPORTS = {
  PERIODS: PERIODS, MOOD_FACES: MOOD_FACES, WEEKDAYS: WEEKDAYS, MONTH_DAYS: MONTH_DAYS,
  defaultProgress: defaultProgress, GS: GS, BAR_MENU: BAR_MENU, TREAT_OPTIONS: TREAT_OPTIONS,
  FURNITURE: FURNITURE, FURNITURE_POS: FURNITURE_POS, furnitureObjects: furnitureObjects,
  SMALLTALK: SMALLTALK, REP_TALK: REP_TALK, smalltalkFor: smalltalkFor, BOOKS: BOOKS, FISH_INFO: FISH_INFO,
  NPC_NAMES: NPC_NAMES, NPC_TALK: NPC_TALK,
  QUESTIONS: QUESTIONS, NPC_INTERACT: NPC_INTERACT,
  BOSS_DAILY_CAP: BOSS_DAILY_CAP, NPC_DAILY_CAP: NPC_DAILY_CAP, CAP_GAMES: CAP_GAMES,
  DAILY_WIN_CAP_ENABLED: DAILY_WIN_CAP_ENABLED,
  REP_LEVELS: REP_LEVELS,
  WALLET_MIN: WALLET_MIN, ALLOWANCE: ALLOWANCE, ALLOWANCE_INTERVAL: ALLOWANCE_INTERVAL,
  LOAN_DAILY_RATE: LOAN_DAILY_RATE, LOAN_AMOUNTS: LOAN_AMOUNTS,
  BOSS_WALLET: BOSS_WALLET, NPC_WALLET: NPC_WALLET,
  DEFAULT_NAME: DEFAULT_NAME, RENAME_COST: RENAME_COST,
  RITA_GIFT_PRICE: RITA_GIFT_PRICE, RITA_GIFT_MOOD: RITA_GIFT_MOOD,
  VISITOR_POOL: VISITOR_POOL, LOBBY_NPC_MAX: LOBBY_NPC_MAX,
  LOBBY_NPC_FIXED: LOBBY_NPC_FIXED, VISITOR_PER_DAY: VISITOR_PER_DAY,
  LAND_PRICE: LAND_PRICE, SEED_PRICE: SEED_PRICE, WORKER_WAGE: WORKER_WAGE,
  HARVEST_PRICE: HARVEST_PRICE, HARVEST_DAYS: HARVEST_DAYS, WAREHOUSE_PRICE: WAREHOUSE_PRICE,
  FARMLAND_MAX: FARMLAND_MAX, ORCHARD_LAND_PRICE: ORCHARD_LAND_PRICE,
  SAPLING_PRICE: SAPLING_PRICE, ORCHARD_HARVEST: ORCHARD_HARVEST,
  ORCHARD_DAYS: ORCHARD_DAYS, ORCHARD_MAX: ORCHARD_MAX, POND_COST: POND_COST,
};
Object.keys(GS_EXPORTS).forEach(function (k) { GS[k] = GS_EXPORTS[k]; });
if (typeof module !== "undefined" && module.exports) module.exports = GS_EXPORTS;
