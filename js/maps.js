/* maps.js — 场景数据（二楼房间 / 一楼大厅）
 * objects: 交互物或装饰物。有 action 的为交互物；无 action 的仅装饰/碰撞。
 * 所有坐标以「格」为单位。 */
"use strict";

function roomGrid() {
  var wall = "####################";
  var row = "#..................#";
  var g = [wall];
  for (var i = 0; i < 10; i++) g.push(row);
  g.push(wall);
  return g;
}

function lobbyGrid() {
  var wall = "########################";
  var row = "#......................#";
  var g = [wall];
  for (var i = 0; i < 13; i++) g.push(row);
  g.push(wall);
  return g;
}

var SCENES = {
  room: {
    name: "二楼 · 我的房间",
    w: 20, h: 12,
    floor: "wood",
    grid: roomGrid(),
    spawn: { x: 10, y: 7 },
    // 出生后朝向
    spawnDir: "down",
    objects: [
      { id: "bed",      x: 14, y: 2, w: 3, h: 2, solid: true, label: "床 · 休息", action: "rest" },
      { id: "bedside",  x: 17, y: 3, w: 1, h: 1, solid: true, label: "床头柜 · 钱包", action: "wallet" },
      { id: "door",     x: 10, y: 11, w: 1, h: 1, solid: true, label: "门 · 下楼去大厅", action: "goto_lobby" },
      { id: "window",   x: 8, y: 0, w: 2, h: 1, solid: false, label: "窗 · 夜色", action: "flavor_window" },
      { id: "poster",   x: 3, y: 0, w: 1, h: 1, solid: false, label: "墙上告示", action: "flavor_poster" },
      { id: "calendar", x: 12, y: 0, w: 1, h: 1, solid: false, label: "日历", action: "calendar" },
      { id: "rug",      x: 7, y: 5, w: 4, h: 2, solid: false },
      { id: "lantern",  x: 1, y: 2, w: 1, h: 1, solid: false },
      { id: "lantern",  x: 18, y: 8, w: 1, h: 1, solid: false },
      { id: "candle",   x: 4, y: 8, w: 1, h: 1, solid: false },   // 2026-08-18 点缀
    ],
  },
  lobby: {
    name: "一楼 · 柳枝酒馆",
    w: 24, h: 15,
    floor: "stone",
    grid: lobbyGrid(),
    spawn: { x: 12, y: 10 },
    spawnDir: "up",
    objects: [
      { id: "bjtable",  x: 3, y: 6, w: 2, h: 2, solid: true, label: "21点牌桌（老板坐庄）", action: "play_blackjack" },
      { id: "pokertable", x: 16, y: 5, w: 4, h: 2, solid: true, label: "德州牌桌（醉汉作陪）", action: "play_poker" },
      { id: "ddztable", x: 6, y: 9, w: 3, h: 2, solid: true, label: "斗地主桌（村民·旅客）", action: "play_doudizhu" },
      { id: "unotable", x: 11, y: 4, w: 3, h: 2, solid: true, label: "UNO 牌桌（比手速抢出牌）", action: "play_uno" },
      { id: "pongtable", x: 16, y: 11, w: 4, h: 2, solid: true, label: "乒乓球台（村民应战）", action: "play_pong" },
      { id: "cabinet",  x: 2, y: 11, w: 2, h: 2, solid: true, label: "蛇笼 · 贪吃蛇", action: "play_snake" },
      { id: "desk",     x: 20, y: 2, w: 2, h: 1, solid: true, label: "账房（商人）", action: "ledger" },
      { id: "bar",      x: 8, y: 1, w: 8, h: 1, solid: true, label: "吧台", action: "flavor_bar" },
      { id: "door",     x: 12, y: 14, w: 1, h: 1, solid: true, label: "楼梯口 · 回房休息", action: "goto_room" },
      { id: "door",     x: 23, y: 7, w: 1, h: 1, solid: true, label: "酒馆大门 · 出门", action: "goto_village" },
      { id: "al_stand", x: 3, y: 3, w: 1, h: 1, solid: false, label: "艾尔的农具摊", action: "farm_manage" },
      { id: "rob_site", x: 22, y: 10, w: 2, h: 1, solid: false, label: "罗伯特的工地告示", action: "warehouse_manage" },
      { id: "sign",     x: 11, y: 0, w: 2, h: 1, solid: false, label: "招牌 · 柳枝酒馆", action: "flavor_sign" },
      { id: "window",   x: 3, y: 0, w: 2, h: 1, solid: false },
      { id: "window",   x: 17, y: 0, w: 2, h: 1, solid: false },
      { id: "chair",    x: 15, y: 5, w: 1, h: 1, solid: true, dir: "right" },
      { id: "chair",    x: 20, y: 5, w: 1, h: 1, solid: true, dir: "left" },
      { id: "chair",    x: 17, y: 7, w: 1, h: 1, solid: true, dir: "up" },
      { id: "chair",    x: 18, y: 7, w: 1, h: 1, solid: true, dir: "up" },
      { id: "chair",    x: 5, y: 9, w: 1, h: 1, solid: true, dir: "right" },
      { id: "chair",    x: 9, y: 9, w: 1, h: 1, solid: true, dir: "left" },
      { id: "chair",    x: 7, y: 11, w: 1, h: 1, solid: true, dir: "up" },
      { id: "barrel",   x: 6, y: 2, w: 1, h: 1, solid: true },
      { id: "barrel",   x: 7, y: 2, w: 1, h: 1, solid: true },
      { id: "mug",      x: 10, y: 0, w: 1, h: 1, solid: false },  // 吧台装饰（画在 bar 上沿）
      { id: "lantern",  x: 5, y: 3, w: 1, h: 1, solid: false },
      { id: "lantern",  x: 14, y: 3, w: 1, h: 1, solid: false },
      { id: "rug",      x: 9, y: 9, w: 4, h: 2, solid: false },
      /* 2026-08-18 美化：盆栽/烛台点缀 */
      { id: "plant",    x: 2, y: 4, w: 1, h: 1, solid: false },
      { id: "plant",    x: 21, y: 8, w: 1, h: 1, solid: false },
      { id: "candle",   x: 4, y: 4, w: 1, h: 1, solid: false },
    ],
  },
};

/* 随机访客的锚点（今天在大厅的 2 位访客从这些位置随机走动） */
var VISITOR_ANCHORS = {
  billy: { x: 13, y: 12, radius: 3 },
  tommy: { x: 9,  y: 4,  radius: 3 },
  will:  { x: 21, y: 9,  radius: 3 },
  higg:  { x: 18, y: 3,  radius: 3 },
  mark:  { x: 3,  y: 4,  radius: 3 },
  mary:  { x: 14, y: 4,  radius: 3 },
  anna:  { x: 10, y: 13, radius: 3 },
  lord:  { x: 4,  y: 13, radius: 3 },
  husk:  { x: 15, y: 13, radius: 3 },
};

/* ---------------- 户外场景 ---------------- */

/* 户外网格：四角留开口（视觉去盒子感，物理边界仍靠边框段 #）2026-08-18 美化 */
function outdoorGrid(w, h, waterRows, fieldRect) {
  var g = [];
  for (var y = 0; y < h; y++) {
    var row = "";
    for (var x = 0; x < w; x++) {
      var onBorder = (x === 0 || y === 0 || x === w - 1 || y === h - 1);
      var corner = (x <= 1 && y <= 1) || (x >= w - 2 && y <= 1) ||
                   (x <= 1 && y >= h - 2) || (x >= w - 2 && y >= h - 2);
      if (onBorder && !corner) row += "#";
      else if (waterRows && y >= waterRows) row += "~";
      else if (fieldRect && x >= fieldRect.x && x < fieldRect.x + fieldRect.w &&
               y >= fieldRect.y && y < fieldRect.y + fieldRect.h) row += "F";
      else row += ".";
    }
    g.push(row);
  }
  return g;
}

/* 教堂内景：石地板 + 石墙边界（密林教堂教义：只能用石头搭建） */
function chapelGrid() {
  var wall = "####################";
  var row = "#..................#";
  var g = [wall];
  for (var i = 0; i < 10; i++) g.push(row);
  g.push(wall);
  return g;
}

/* 农田可购田格（2×3=6 格，落在 F 麦田区内；engine.js 按 farmland 数量动态显示） */
var FARMLAND_PLOTS = [
  { x: 6, y: 6 }, { x: 10, y: 6 }, { x: 14, y: 6 },
  { x: 6, y: 8 }, { x: 10, y: 8 }, { x: 14, y: 8 },
];

var SCENES = SCENES || {};
SCENES.village = {
  name: "村口 · 户外",
  w: 20, h: 12,
  floor: "grass",
  grid: outdoorGrid(20, 12),
  spawn: { x: 10, y: 9 },
  spawnDir: "up",
  objects: [
    { id: "door",      x: 10, y: 11, w: 1, h: 1, solid: true, label: "酒馆后门 · 回酒馆", action: "goto_lobby_from" },
    { id: "road_sign", x: 10, y: 1, w: 1, h: 1, solid: false, label: "往北 · 庄园", action: "goto_manor" },
    { id: "road_sign", x: 1, y: 6, w: 1, h: 1, solid: false, label: "往西 · 小河边", action: "goto_riverside" },
    { id: "road_sign", x: 1, y: 4, w: 1, h: 1, solid: false, label: "往西 · 精灵旧屋", action: "knock_oldhouse" },
    { id: "road_sign", x: 18, y: 6, w: 1, h: 1, solid: false, label: "往东 · 农地", action: "goto_farmland" },
    { id: "road_sign", x: 2, y: 2, w: 1, h: 1, solid: false, label: "往密林 · 小教堂", action: "goto_chapel" },
    { id: "tree",      x: 3, y: 2, w: 1, h: 1, solid: true },
    { id: "tree",      x: 16, y: 2, w: 1, h: 1, solid: true },
    { id: "tree",      x: 4, y: 9, w: 1, h: 1, solid: true },
    { id: "tree",      x: 15, y: 9, w: 1, h: 1, solid: true },
    { id: "tree",      x: 18, y: 10, w: 1, h: 1, solid: true },
    /* 2026-08-18 美化：泥土小路（村口十字路）+ 花草装饰 */
    { id: "path",      x: 5, y: 8, w: 1, h: 1, solid: false },
    { id: "path",      x: 6, y: 8, w: 1, h: 1, solid: false },
    { id: "path",      x: 7, y: 8, w: 1, h: 1, solid: false },
    { id: "path",      x: 8, y: 8, w: 1, h: 1, solid: false },
    { id: "path",      x: 9, y: 8, w: 1, h: 1, solid: false },
    { id: "path",      x: 10, y: 8, w: 1, h: 1, solid: false },
    { id: "path",      x: 11, y: 8, w: 1, h: 1, solid: false },
    { id: "path",      x: 12, y: 8, w: 1, h: 1, solid: false },
    { id: "path",      x: 13, y: 8, w: 1, h: 1, solid: false },
    { id: "path",      x: 14, y: 8, w: 1, h: 1, solid: false },
    { id: "path",      x: 10, y: 3, w: 1, h: 1, solid: false },
    { id: "path",      x: 10, y: 4, w: 1, h: 1, solid: false },
    { id: "path",      x: 10, y: 5, w: 1, h: 1, solid: false },
    { id: "path",      x: 10, y: 6, w: 1, h: 1, solid: false },
    { id: "path",      x: 10, y: 7, w: 1, h: 1, solid: false },
    { id: "flower",    x: 2, y: 7, w: 1, h: 1, solid: false },
    { id: "flower",    x: 17, y: 5, w: 1, h: 1, solid: false },
    { id: "flower",    x: 4, y: 3, w: 1, h: 1, solid: false },
    { id: "flower",    x: 16, y: 11, w: 1, h: 1, solid: false },
  ],
};

SCENES.riverside = {
  name: "小河边",
  w: 24, h: 14,
  floor: "grass",
  grid: outdoorGrid(24, 14, 10),
  spawn: { x: 12, y: 7 },
  spawnDir: "up",
  objects: [
    { id: "fishing",   x: 8, y: 9, w: 1, h: 1, solid: false, label: "钓鱼", action: "fish" },
    { id: "mailbox",   x: 16, y: 9, w: 1, h: 1, solid: false, label: "邮筒 · 寄信", action: "send_letter" },
    { id: "road_sign", x: 12, y: 1, w: 1, h: 1, solid: false, label: "回村", action: "goto_village_from" },
    { id: "tree",      x: 2, y: 3, w: 1, h: 1, solid: true },
    { id: "tree",      x: 21, y: 3, w: 1, h: 1, solid: true },
    { id: "tree",      x: 3, y: 6, w: 1, h: 1, solid: true },
    { id: "tree",      x: 20, y: 6, w: 1, h: 1, solid: true },
  ],
};

SCENES.farmland = {
  name: "村边农地",
  w: 24, h: 14,
  floor: "grass",
  grid: outdoorGrid(24, 14, null, { x: 4, y: 5, w: 16, h: 5 }),
  spawn: { x: 12, y: 11 },
  spawnDir: "up",
  objects: [
    { id: "al_stand",  x: 11, y: 8, w: 1, h: 1, solid: false, label: "艾尔的农具摊", action: "farm_manage" },
    { id: "rob_site",  x: 16, y: 8, w: 2, h: 1, solid: false, label: "工地 · 盖仓库", action: "warehouse_manage" },
    { id: "warehouse", x: 17, y: 10, w: 2, h: 2, solid: true },
    { id: "scarecrow", x: 5, y: 6, w: 1, h: 1, solid: false },
    { id: "scarecrow", x: 20, y: 5, w: 1, h: 1, solid: false },
    { id: "road_sign", x: 12, y: 1, w: 1, h: 1, solid: false, label: "回村", action: "goto_village_from" },
    { id: "road_sign", x: 21, y: 8, w: 1, h: 1, solid: false, label: "往西 · 河西果园", action: "goto_orchard" },
    { id: "pond",      x: 1, y: 10, w: 2, h: 2, solid: true, label: "池塘 · 捞鱼", action: "pond_fish" },
    { id: "tree",      x: 2, y: 3, w: 1, h: 1, solid: true },
    { id: "tree",      x: 21, y: 3, w: 1, h: 1, solid: true },
  ],
};

SCENES.orchard = {
  name: "河西果园",
  w: 24, h: 14,
  floor: "grass",
  grid: outdoorGrid(24, 14, 11),        // 南侧沿河（河西）
  spawn: { x: 12, y: 9 },               // 出生在岸上草地（y≥11 是河，原 y=11 会卡在水里）
  spawnDir: "up",
  objects: [
    { id: "orchard_sign", x: 11, y: 8, w: 2, h: 1, solid: false, label: "果园木牌", action: "orchard_manage" },
    { id: "fruit_tree", x: 5, y: 5, w: 1, h: 1, solid: false, idx: 0 },
    { id: "fruit_tree", x: 9, y: 5, w: 1, h: 1, solid: false, idx: 1 },
    { id: "fruit_tree", x: 13, y: 5, w: 1, h: 1, solid: false, idx: 2 },
    { id: "road_sign", x: 12, y: 1, w: 1, h: 1, solid: false, label: "回农地", action: "goto_farmland_from" },
    { id: "tree",      x: 2, y: 3, w: 1, h: 1, solid: true },
    { id: "tree",      x: 21, y: 3, w: 1, h: 1, solid: true },
    { id: "tree",      x: 3, y: 8, w: 1, h: 1, solid: true },
    { id: "tree",      x: 20, y: 8, w: 1, h: 1, solid: true },
  ],
};

SCENES.chapel = {
  name: "密林小教堂",
  w: 20, h: 12,
  floor: "stone",
  grid: chapelGrid(),
  spawn: { x: 10, y: 9 },
  spawnDir: "up",
  objects: [
    { id: "chapel_door",  x: 10, y: 11, w: 1, h: 1, solid: true, label: "门 · 回村口", action: "goto_village_from" },
    { id: "altar",        x: 9, y: 2, w: 2, h: 1, solid: false, label: "石祭坛 · 祈祷", action: "pray" },
    { id: "stained_window", x: 3, y: 2, w: 1, h: 1, solid: false },
    { id: "stained_window", x: 16, y: 2, w: 1, h: 1, solid: false },
    { id: "pew",          x: 4, y: 5, w: 3, h: 1, solid: true },
    { id: "pew",          x: 9, y: 5, w: 3, h: 1, solid: true },
    { id: "pew",          x: 14, y: 5, w: 3, h: 1, solid: true },
    { id: "candle",       x: 8, y: 3, w: 1, h: 1, solid: false },
    { id: "candle",       x: 12, y: 3, w: 1, h: 1, solid: false },
  ],
};

SCENES.manor = {
  name: "庄园前",
  w: 24, h: 14,
  floor: "grass",
  grid: outdoorGrid(24, 14),
  spawn: { x: 12, y: 10 },
  spawnDir: "up",
  objects: [
    { id: "manor_gate", x: 11, y: 1, w: 2, h: 1, solid: true, label: "庄园大门", action: "guard_shoo" },
    { id: "manor_wall", x: 2, y: 1, w: 1, h: 1, solid: false },
    { id: "manor_wall", x: 6, y: 1, w: 1, h: 1, solid: false },
    { id: "manor_wall", x: 15, y: 1, w: 1, h: 1, solid: false },
    { id: "manor_wall", x: 19, y: 1, w: 1, h: 1, solid: false },
    { id: "grapevine",  x: 3, y: 8, w: 2, h: 1, solid: false },
    { id: "grapevine",  x: 16, y: 8, w: 2, h: 1, solid: false },
    { id: "road_sign", x: 12, y: 12, w: 1, h: 1, solid: false, label: "回村", action: "goto_village_from" },
    { id: "tree",      x: 2, y: 10, w: 1, h: 1, solid: true },
    { id: "tree",      x: 21, y: 10, w: 1, h: 1, solid: true },
  ],
};

SCENES.oldhouse = {
  name: "精灵旧屋",
  w: 20, h: 12,
  floor: "wood",
  grid: roomGrid(),
  spawn: { x: 10, y: 7 },
  spawnDir: "down",
  objects: [
    { id: "door",      x: 10, y: 11, w: 1, h: 1, solid: true, label: "门 · 回村口", action: "goto_village_from" },
    { id: "leakyroof", x: 5, y: 0, w: 2, h: 1, solid: false, label: "漏雨的屋瓦", action: "flavor_leakyroof" },
    { id: "heirloom",  x: 2, y: 2, w: 1, h: 1, solid: false, label: "祖传银器盒", action: "flavor_heirloom" },
    { id: "oldledger", x: 16, y: 2, w: 1, h: 1, solid: false, label: "窗台的旧账本", action: "flavor_oldledger" },
    { id: "window",    x: 8, y: 0, w: 2, h: 1, solid: false },
    { id: "bedroll",   x: 3, y: 7, w: 2, h: 1, solid: true },
    { id: "table",     x: 13, y: 6, w: 2, h: 1, solid: true },
    { id: "stool",     x: 13, y: 8, w: 1, h: 1, solid: true },
    { id: "basin",     x: 6, y: 9, w: 1, h: 1, solid: false, label: "接雨的盆", action: "flavor_leakyroof" },
    { id: "lantern",   x: 1, y: 5, w: 1, h: 1, solid: false },
  ],
};

/* 每个场景的 NPC 锚点（人物会在锚点附近随机走动） */
var SCENE_NPCS = {
  room: [],
  village: [],
  riverside: [
    { id: "fisher", char: "fisher", anchor: { x: 11, y: 5 }, radius: 4 },
  ],
  farmland: [
    { id: "al",     char: "al",     anchor: { x: 9, y: 11 }, radius: 3 },
    { id: "robert", char: "robert", anchor: { x: 16, y: 11 }, radius: 3 },
  ],
  orchard: [
    { id: "gardener", char: "gardener", anchor: { x: 12, y: 9 }, radius: 3 },
  ],
  chapel: [
    { id: "priest", char: "priest", anchor: { x: 10, y: 7 }, radius: 3 },
  ],
  oldhouse: [
    { id: "vera", char: "vera", anchor: { x: 11, y: 5 }, radius: 3 },
  ],
  manor: [
    { id: "guard1", char: "guard", anchor: { x: 10, y: 3 }, radius: 2 },
    { id: "guard2", char: "guard", anchor: { x: 14, y: 3 }, radius: 2 },
  ],
  lobby: [
    { id: "boss",     char: "boss",     anchor: { x: 6, y: 8 }, radius: 4 },
    { id: "drunk",    char: "drunk",    anchor: { x: 21, y: 7 }, radius: 4 },
    { id: "villager", char: "villager", anchor: { x: 6, y: 11 }, radius: 4 },
    { id: "merchant", char: "merchant", anchor: { x: 21, y: 3 }, radius: 3 },
    { id: "rita",     char: "rita",     anchor: { x: 12, y: 3 }, radius: 3 },
  ],
};
