/* sprites.js — 程序化像素精灵与场景绘制（canvas 2D，零图片资源）
 * 内部分辨率 16px/格；所有角色/家具均由调色板数组或矩形填充生成。 */
"use strict";

var T = 16; // 每格像素

/* ---------------- 调色板 ---------------- */
var PAL = {
  ".": null,              // 透明
  "k": [26, 16, 37],      // 描边/深色
  "K": [0, 0, 0],         // 纯黑
  "s": [240, 200, 160],   // 肤色
  "S": [216, 168, 120],   // 肤色影
  "h": [74, 47, 29],      // 发色(棕)
  "H": [107, 68, 35],     // 发色亮
  "e": [26, 26, 46],      // 眼睛
  "E": [150, 190, 230],   // 眼睛上缘高光（亮蓝白，二次元大眼）
  "i": [200, 225, 245],   // 眼神光（瞳孔内高光点）
  "u": [180, 96, 110],    // 唇色
  "q": [236, 168, 156],   // 腮红
  "w": [245, 239, 224],   // 白/米白
  "r": [192, 57, 43],     // 红
  "R": [229, 72, 77],     // 亮红
  "b": [59, 91, 219],     // 蓝(主角上衣)
  "B": [42, 63, 158],     // 深蓝
  "g": [63, 158, 79],     // 绿
  "G": [111, 208, 122],   // 亮绿
  "y": [255, 215, 94],    // 金
  "o": [217, 122, 58],    // 橙
  "p": [122, 79, 191],    // 紫
  "m": [107, 68, 35],     // 棕
  "M": [74, 47, 29],      // 深棕
  "l": [139, 90, 43],     // 皮革
  "c": [92, 214, 214],    // 青
  "v": [138, 90, 43],     // 背心棕
  "t": [216, 180, 138],   // 浅棕
  "z": [154, 143, 184],   // 灰紫
  "Z": [90, 82, 112],     // 深灰
  "d": [104, 76, 56],     // 木地板
  "D": [84, 60, 44],      // 木地板影
};

/* 行数组 → 像素缓冲 {id,w,h,data:[r,g,b,a...]} */
var SPRITE_ID = 0;
function rowsToPixels(rows) {
  var h = rows.length, w = rows[0].length;
  var data = new Array(w * h * 4);
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var c = PAL[rows[y].charAt(x)];
      var i = (y * w + x) * 4;
      if (!c) { data[i] = data[i + 1] = data[i + 2] = 0; data[i + 3] = 0; continue; }
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
  }
  return { id: ++SPRITE_ID, w: w, h: h, data: data };
}

/* 精灵 → 离屏 canvas（透明正确合成；翻转在缓存内完成） */
var SPRITE_CACHE = {};
function spriteCanvas(spr, flip) {
  var key = "s" + spr.id + (flip ? "f" : "");
  var c = SPRITE_CACHE[key];
  if (c) return c;
  c = document.createElement("canvas");
  c.width = spr.w; c.height = spr.h;
  var cctx = c.getContext("2d");
  var img = cctx.createImageData(spr.w, spr.h);
  img.data.set(spr.data);
  if (flip) {
    var w = spr.w, h = spr.h;
    for (var yy = 0; yy < h; yy++) {
      for (var xx = 0; xx < w / 2; xx++) {
        for (var cc = 0; cc < 4; cc++) {
          var a = (yy * w + xx) * 4 + cc, b = (yy * w + (w - 1 - xx)) * 4 + cc;
          var t = img.data[a]; img.data[a] = img.data[b]; img.data[b] = t;
        }
      }
    }
  }
  cctx.putImageData(img, 0, 0);
  SPRITE_CACHE[key] = c;
  return c;
}

function drawPixels(ctx, spr, x, y, flip) {
  ctx.drawImage(spriteCanvas(spr, flip), Math.round(x), Math.round(y));
}

/* ---------------- 角色生成 ---------------- */
/* 头部模板：14 行 × 12 宽（2026-08-18 升级版，4 行高眼睛+嘴+腮红）
 * 布局: x1=k, x2=h, x3-8=脸(6宽), x9=h, x10=k; 眼 x3-4/x7-8; 嘴 x4-7 */
var HEADS = {
  hair: [
    "....kkkk....",
    "...khhhhk...",
    "..khhhhhhk..",
    "..khhhhhhk..",
    ".khhsssshhk.",
    ".khhsssshhk.",
    ".khsssssshk.",
    ".khee..eehk.",
    ".kheE..eEhk.",
    ".khii..iihk.",
    ".khqq..qqhk.",
    ".khssuuushk.",
    "..ksssssk...",
    "...kkkkkk...",
  ],
  bald: [
    "....kkkk....",
    "...kssssk...",
    "..ksssssk...",
    "..ksssssk...",
    "..ksssssk...",
    "..ksssssk...",
    ".khsssssshk.",
    ".khee..eehk.",
    ".kheE..eEhk.",
    ".khii..iihk.",
    ".khqq..qqhk.",
    ".khssuuushk.",
    "..ksssssk...",
    "...kkkkkk...",
  ],
  cap: [
    "....kkkk....",
    "...kllllk...",
    "..kllllllk..",
    "..kkhkhkk...",
    ".khhsssshhk.",
    ".khhsssshhk.",
    ".khsssssshk.",
    ".khee..eehk.",
    ".kheE..eEhk.",
    ".khii..iihk.",
    ".khqq..qqhk.",
    ".khssuuushk.",
    "..ksssssk...",
    "...kkkkkk...",
  ],
  scarf: [
    "....kkkk....",
    "...krrrrk...",
    "..krrrrrrk..",
    "..krrrrrrk..",
    ".khhsssshhk.",
    ".khhsssshhk.",
    ".khsssssshk.",
    ".khee..eehk.",
    ".kheE..eEhk.",
    ".khii..iihk.",
    ".khqq..qqhk.",
    ".khssuuushk.",
    "..ksssssk...",
    "...kkkkkk...",
  ],
  tallhat: [
    ".....kk.....",
    ".....kk.....",
    "....kkkk....",
    "...kllllk...",
    ".khhsssshhk.",
    ".khhsssshhk.",
    ".khsssssshk.",
    ".khee..eehk.",
    ".kheE..eEhk.",
    ".khii..iihk.",
    ".khqq..qqhk.",
    ".khssuuushk.",
    "..ksssssk...",
    "...kkkkkk...",
  ],
  elf: [
    "....kkkk....",
    "...khhhhk...",
    "..khhhhhhk..",
    "..khhhhhhk..",
    ".kShssssShk.",
    ".kShssssShk.",
    ".kSssssssSk.",
    ".kSsee..eSSk",
    ".kSeE..eESk.",
    ".kSsi..iSSk.",
    ".kSsq..qSSk.",
    "..kssuuusk..",
    "..kssssssk..",
    "...kkkkkk...",
  ],
  rita: [
    "....kkkk....",
    "...kRRRRk...",
    "..kRRRRRRk..",
    "..kRwRRwRk..",
    ".khhsssshhk.",
    ".khhsssshhk.",
    ".khsssssshk.",
    ".khee..eehk.",
    ".kheE..eEhk.",
    ".khii..iihk.",
    ".khqq..qqhk.",
    ".khssuuushk.",
    "..ksssssk...",
    "...kkkkkk...",
  ],
};

/* 身体行：t=上衣色, s=肤色, w=白（模板字符按参数替换）2026-08-18 升级 8 行 */
function bodyRows(t, s, w) {
  var rows = [
    "...kttttk...",
    "..kttttttk..",
    "..ktwttwtk..",
    ".kskttttks..",
    ".kskttttks..",
    ".kskttttks..",
    "..kskttks...",
    "..kskttks...",
  ];
  return rows.map(function (r) {
    return r.replace(/t/g, t).replace(/s/g, s).replace(/w/g, w);
  });
}

/* 腿行（三帧）：裤色 p，鞋 k。2026-08-18 升级 3 行加膝盖 */
function legRows(p, f) {
  var rows = f === 0
    ? ["..kpp..ppk..", "..kppp.ppk..", "..kkk..kkk.."]
    : ["..kppp.ppk..", "..kppppppk..", "..kkkk.kkk.."];
  return rows.map(function (r) { return r.replace(/p/g, p); });
}

/* ---------------- 对话大头像（二次元风，20×24，2026-08-18） ----------------
 * 供 UI.npcTalk 对话面板展示：大眼（4×5，瞳孔+双层高光）+ 刘海 + 嘴 + 腮红。
 * 模板字符：h=发色(替换) s=肤色 S=肤影 e=瞳孔 E=上缘高光 i=眼神光 u=唇色 q=腮红
 * k=描边 w=白 l=帽/头饰色（按头型替换）
 */
var PORTRAITS = {
  hair: [
    "......kkkkkk........",
    "....khhhhhhhhhhk....",
    "...khhhhhhhhhhhhk...",
    "..khhhhhhhhhhhhhhk..",
    "..khhhhhhhhhhhhhhk..",
    "..khh.ssssssss.hhk..",
    "...khhsssssssshhk...",
    "...khhsssssssshhk...",
    "...khheee..eeehhk...",
    "...khheEe..eEehhk...",
    "...khhsii..iishhk...",
    "...khhsq....qshhk...",
    "...khhssuuuuushhk...",
    "...khhsssssssshhk...",
    "...khhsssssssshhk...",
    "....ksssssssssk.....",
    ".....ksssssssk......",
    "......kkkkkk........",
  ],
  bald: [
    "......kkkkkk........",
    "....kssssssssk......",
    "...kssssssssssk.....",
    "...kssssssssssk.....",
    "..ksssssssssssk.....",
    "..ksssssssssssk.....",
    "...khhsssssssshhk...",
    "...khhsssssssshhk...",
    "...khheee..eeehhk...",
    "...khheEe..eEehhk...",
    "...khhsii..iishhk...",
    "...khhsq....qshhk...",
    "...khhssuuuuushhk...",
    "...khhsssssssshhk...",
    "...khhsssssssshhk...",
    "....ksssssssssk.....",
    ".....ksssssssk......",
    "......kkkkkk........",
  ],
  cap: [
    "......kkkkkk........",
    "....klllllllk.......",
    "...kllllllllllk.....",
    "...kkllllllllkk.....",
    "...khhllllllhhk.....",
    "..khh.ssssssss.hhk..",
    "...khhsssssssshhk...",
    "...khhsssssssshhk...",
    "...khheee..eeehhk...",
    "...khheEe..eEehhk...",
    "...khhsii..iishhk...",
    "...khhsq....qshhk...",
    "...khhssuuuuushhk...",
    "...khhsssssssshhk...",
    "...khhsssssssshhk...",
    "....ksssssssssk.....",
    ".....ksssssssk......",
    "......kkkkkk........",
  ],
  scarf: [
    "......kkkkkk........",
    "....krrrrrrrk.......",
    "...krrrrrrrrrk......",
    "...krrrrrrrrrk......",
    "..krrrrrrrrrrrk.....",
    "..khh.ssssssss.hhk..",
    "...khhsssssssshhk...",
    "...khhsssssssshhk...",
    "...khheee..eeehhk...",
    "...khheEe..eEehhk...",
    "...khhsii..iishhk...",
    "...khhsq....qshhk...",
    "...khhssuuuuushhk...",
    "...khhsssssssshhk...",
    "...khhsssssssshhk...",
    "....ksssssssssk.....",
    ".....ksssssssk......",
    "......kkkkkk........",
  ],
  tallhat: [
    ".......kk...........",
    ".......kk...........",
    "......kkkk..........",
    "......kkkk..........",
    "....kkkkkkkk........",
    "...kllllllllllk.....",
    "...khhsssssssshhk...",
    "...khhsssssssshhk...",
    "...khheee..eeehhk...",
    "...khheEe..eEehhk...",
    "...khhsii..iishhk...",
    "...khhsq....qshhk...",
    "...khhssuuuuushhk...",
    "...khhsssssssshhk...",
    "...khhsssssssshhk...",
    "....ksssssssssk.....",
    ".....ksssssssk......",
    "......kkkkkk........",
  ],
  elf: [
    "......kkkkkk........",
    "....khhhhhhhhhhk....",
    "...khhhhhhhhhhhhk...",
    "..khhhhhhhhhhhhhhk..",
    "..khhhhhhhhhhhhhhk..",
    "..khh.ssssssss.hhk..",
    "...khhsssssssshhk...",
    "...khhsssssssshhk...",
    "...khheee..eeehhk...",
    "...khheEe..eEehhk...",
    "...khhsii..iishhk...",
    "...khhsq....qshhk...",
    "...khhssuuuuushhk...",
    "...khhsssssssshhk...",
    "...khhsssssssshhk...",
    "....ksssssssssk.....",
    ".....ksssssssk......",
    "......kkkkkk........",
  ],
  rita: [
    "......kkkkkk........",
    "....kRRRRRRRRk......",
    "...kRRRRRRRRRRk.....",
    "...kRRRRRRRRRRk.....",
    "..kRwRRRRRRwRk......",
    "..khh.ssssssss.hhk..",
    "...khhsssssssshhk...",
    "...khhsssssssshhk...",
    "...khheee..eeehhk...",
    "...khheEe..eEehhk...",
    "...khhsii..iishhk...",
    "...khhsq....qshhk...",
    "...khhssuuuuushhk...",
    "...khhsssssssshhk...",
    "...khhsssssssshhk...",
    "....ksssssssssk.....",
    ".....ksssssssk......",
    "......kkkkkk........",
  ],
};

/* 大头像配色表（char → 头型/发色/肤影），与 CHARS 的 buildChar 参数对齐 */
var PORTRAIT_COLORS = {
  player:  { head: "hair",    hair: "h" },
  boss:    { head: "bald",    hair: "s" },
  drunk:   { head: "cap",     hair: "h" },
  villager:{ head: "scarf",   hair: "h" },
  merchant:{ head: "tallhat", hair: "h" },
  rita:    { head: "rita",    hair: "R" },
  billy:   { head: "elf",     hair: "y" },
  tommy:   { head: "hair",    hair: "h" },
  will:    { head: "cap",     hair: "h" },
  higg:    { head: "bald",    hair: "s" },
  mark:    { head: "cap",     hair: "h" },
  mary:    { head: "scarf",   hair: "h" },
  anna:    { head: "scarf",   hair: "h" },
  fisher:  { head: "cap",     hair: "h" },
  farmer:  { head: "bald",    hair: "s" },
  guard:   { head: "cap",     hair: "h" },
  al:      { head: "scarf",   hair: "h" },
  robert:  { head: "bald",    hair: "s" },
  gardener:{ head: "elf",     hair: "w" },
  priest:  { head: "elf",     hair: "w" },
  lord:    { head: "elf",     hair: "y" },
  vera:    { head: "elf",     hair: "z" },
  husk:    { head: "bald",    hair: "h" },
};

/* 生成对话大头像像素缓冲；charKey 查 PORTRAIT_COLORS，缺省用 hair
 * 头饰字符（cap 的 l 帽色 / scarf 的 r 头巾红 / rita 的 R 发色 / 白发带 w）
 * 走 PAL 字面色，只替换发色占位 h。 */
function buildPortrait(charKey) {
  var cfg = PORTRAIT_COLORS[charKey] || { head: "hair", hair: "h" };
  var rows = PORTRAITS[cfg.head] || PORTRAITS.hair;
  var hairC = cfg.hair || "h";
  var out = rows.map(function (r) {
    return r.replace(/h/g, hairC);   // 发色（h 是模板发色占位）
  });
  return rowsToPixels(out);
}

/* 组装一个角色：返回 {down:[f0,f1], up:[f0,f1], side:[f0,f1]}，每帧为像素缓冲 */
function buildChar(headKey, hairC, tunicC, skinC, pantC) {
  var rows = function (dir, f) {
    var head = HEADS[headKey].slice();
    // 背面：眼睛与高光换成发色（否则背面露眼）
    if (dir === "up") head = head.map(function (r) {
      return r.replace(/e/g, hairC).replace(/E/g, hairC);
    });
    var out = [];
    var hh = head.length;
    // 头部（走路时身体上移 1px 制造起伏）
    var shift = f === 1 ? 0 : 1;
    for (var i = 0; i < hh - shift; i++) out.push(head[i]);
    // 身体
    var body = bodyRows(tunicC, skinC, "w");
    for (var j = 0; j < body.length - shift; j++) out.push(body[j]);
    // 腿
    var legs = legRows(pantC, f);
    for (var k = 0; k < legs.length; k++) out.push(legs[k]);
    return rowsToPixels(out);
  };
  var mk = function (dir) {
    var f0 = rows(dir, 0), f1 = rows(dir, 1);
    return [f0, f1];
  };
  return { down: mk("down"), up: mk("up"), side: mk("down") };
}

/* 预定义角色 */
var CHARS = {};
(function () {
  var c;
  c = buildChar("hair", "h", "b", "s", "M");           // 主角：棕发蓝衣
  CHARS.player = c;
  c = buildChar("bald", "s", "v", "s", "M");           // 老板：秃头背心
  CHARS.boss = c;
  c = buildChar("cap", "h", "g", "s", "Z");            // 醉汉：绿衣
  CHARS.drunk = c;
  c = buildChar("scarf", "h", "r", "s", "Z");          // 村民：红衣头巾
  CHARS.villager = c;
  c = buildChar("tallhat", "h", "p", "s", "M");        // 商人：紫衣高帽
  CHARS.merchant = c;
  c = buildChar("rita", "R", "p", "s", "Z");             // 丽塔：红发紫裙
  CHARS.rita = c;
  // 随机访客（每天 2 位进酒馆）
  c = buildChar("elf",   "y", "b", "s", "M");             // 比利：金发精灵、蓝制服（治安官）
  CHARS.billy = c;
  c = buildChar("hair",  "h", "v", "s", "Z");             // 汤米：棕发、棕衣（手下）
  CHARS.tommy = c;
  c = buildChar("cap",   "h", "r", "s", "M");             // 威尔：歪帽、红衣（手下）
  CHARS.will = c;
  c = buildChar("bald",  "s", "z", "s", "M");             // 希格：秃头、灰衣（领主老仆）
  CHARS.higg = c;
  c = buildChar("cap",   "h", "g", "s", "M");             // 马克：邮差帽、绿衣（邮差）
  CHARS.mark = c;
  c = buildChar("scarf", "h", "o", "s", "Z");             // 玛丽：头巾、橙衣（农妇）
  CHARS.mary = c;
  c = buildChar("scarf", "h", "y", "s", "Z");             // 安娜：头巾、黄衣（养鸡户）
  CHARS.anna = c;
  // 户外 NPC
  c = buildChar("cap",   "h", "b", "s", "M");             // 渔夫：帽、蓝衣
  CHARS.fisher = c;
  c = buildChar("bald",  "s", "g", "s", "M");             // 农夫：秃头、绿衣
  CHARS.farmer = c;
  c = buildChar("cap",   "h", "z", "s", "M");             // 卫兵：帽、灰衣
  CHARS.guard = c;
  c = buildChar("scarf", "h", "v", "s", "M");             // 艾尔：头巾、棕衣（农夫）
  CHARS.al = c;
  c = buildChar("bald",  "s", "l", "s", "M");             // 罗伯特：秃头、皮衣（建筑工）
  CHARS.robert = c;
  // 农业二期（2026-08-17）：河西果园 / 密林教堂
  c = buildChar("elf",   "w", "g", "s", "M");             // 老园丁：白发精灵、绿衣（河西果园）
  CHARS.gardener = c;
  c = buildChar("elf",   "w", "t", "s", "Z");             // 老牧师：白发精灵、米白长袍（密林教堂）
  CHARS.priest = c;
  // 储备角色（背景设定.md 人物志，2026-08-18 进 Web 版）
  c = buildChar("elf",   "y", "p", "s", "M");             // 领主·柳叶：金发精灵、深紫袍（小庄园主）
  CHARS.lord = c;
  c = buildChar("elf",   "z", "t", "s", "M");             // 薇拉：灰发精灵、素衣（精灵穷鬼）
  CHARS.vera = c;
  c = buildChar("scarf", "h", "z", "s", "M");             // 哈斯克：棕发灰衣带围巾（领主管家）
  CHARS.husk = c;
})();

/* ---------------- 家具与物件绘制（矩形像素风） ---------------- */

function rect(ctx, x, y, w, h, color) {
  if (typeof color === "string") ctx.fillStyle = color;
  else ctx.fillStyle = "rgb(" + color.join(",") + ")";
  ctx.fillRect(x, y, w, h);
}

function px(ctx, x, y, color) { rect(ctx, x, y, 1, 1, color); }

/* 木地板：升级版，3 色阶板色 + 木纹 + 偶发污点 + 拼接细节（2026-08-18 HD 版） */
function drawFloor(ctx, x, y, variant) {
  var X = x * T, Y = y * T;
  // 优先用 Kenney dungeon 木地板瓦片（0029/0030 木色推测）
  if (TILES.ready.dungeon) {
    var idx = tilePick([29, 30], x, y);
    drawTile(ctx, "dungeon", idx, X, Y);
    return;
  }
  var v = (variant * 7) % 9;
  var d = v < 4 ? PAL.d : (v < 7 ? PAL.D : [116, 86, 64]);
  rect(ctx, X, Y, T, T, d);
  // 木纹（细横线，位置随格变化）
  ctx.fillStyle = "rgba(0,0,0,.10)";
  var gx = (x * 3 + y * 5) % 4;
  ctx.fillRect(X + 3, Y + 3 + gx, 5, 1);
  ctx.fillRect(X + 9, Y + 9 + ((gx + 1) % 3), 4, 1);
  // 偶发污点
  if ((x * 7 + y * 11) % 13 === 0) {
    ctx.fillStyle = "rgba(60,40,28,.30)";
    ctx.fillRect(X + 4 + (x % 5), Y + 5 + (y % 6), 3, 2);
  }
  // 板缝（保留）
  ctx.fillStyle = "rgba(0,0,0,.18)";
  if ((x + y) % 2 === 0) ctx.fillRect(X, Y + T - 2, T, 2);
  else ctx.fillRect(X + T - 2, Y, 2, T);
  // 微弱高光
  ctx.fillStyle = "rgba(255,255,255,.04)";
  ctx.fillRect(X + 1, Y + 1, T - 2, 1);
  // 🆕 木节
  if ((x * 13 + y * 7) % 11 === 0) {
    ctx.fillStyle = "rgba(40,28,16,.35)";
    ctx.fillRect(X + 5, Y + 5, 3, 3);
    ctx.fillRect(X + 6, Y + 6, 1, 1);
  }
}

/* 大厅石板地：3 色阶 + 石缝变化 + 微光（保留主色，2026-08-18 美化） */
function drawLobbyFloor(ctx, x, y) {
  var X = x * T, Y = y * T;
  // 优先用 Kenney dungeon 浅色石板瓦片（0002/0004 浅色推测）
  if (TILES.ready.dungeon) {
    drawTile(ctx, "dungeon", tilePick([2, 4, 5], x, y), X, Y);
    return;
  }
  var v = (x * 5 + y * 7) % 8;
  var base = v < 4 ? [74, 58, 46] : (v < 6 ? [66, 52, 41] : [84, 66, 52]);
  rect(ctx, X, Y, T, T, base);
  // 石缝（十字 + 随机断点，比纯 1px 边丰富）
  ctx.fillStyle = "rgba(0,0,0,.22)";
  ctx.fillRect(X, Y, T, 1);
  ctx.fillRect(X, Y, 1, T);
  if ((x + y) % 3 === 0) ctx.fillRect(X + T - 1, Y, 1, T);
  if ((x * 3 + y) % 4 === 0) ctx.fillRect(X, Y + T - 1, T, 1);
  // 石面微光
  ctx.fillStyle = "rgba(255,255,255,.05)";
  ctx.fillRect(X + 2, Y + 2, 2, 1);
  // 偶发裂纹
  if ((x * 11 + y * 7) % 17 === 0) {
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.fillRect(X + 6 + (y % 4), Y + 3, 1, 5);
  }
}

/* 石墙：优先 Kenney dungeon 砖墙瓦片，回退程序化 */
function drawWall(ctx, x, y) {
  var X = x * T, Y = y * T;
  // dungeon 暖棕/建筑瓦片（0000-0015 推测为砖墙/石墙）
  if (TILES.ready.dungeon) {
    drawTile(ctx, "dungeon", tilePick([0, 1, 3], x, y), X, Y);
    return;
  }
  var base = [58, 48, 74];
  rect(ctx, X, Y, T, T, base);
  // 砖块纹理（错落排布）
  ctx.fillStyle = "rgba(0,0,0,.12)";
  var brickPat = (x + y * 3) % 4;
  if (brickPat === 0) ctx.fillRect(X + 1, Y + 2, 6, 1);
  else if (brickPat === 1) ctx.fillRect(X + 4, Y + 6, 8, 1);
  else if (brickPat === 2) ctx.fillRect(X + 2, Y + 10, 5, 1);
  // 墙顶面：底边 5px 浅色条（俯视时墙顶可见）
  ctx.fillStyle = "rgba(120,108,150,.55)";
  ctx.fillRect(X, Y + T - 5, T, 5);
  ctx.fillStyle = "rgba(150,138,180,.35)";
  ctx.fillRect(X, Y + T - 5, T, 2);
  // 左上深色描边 + 右下暗影（立体感）
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.fillRect(X, Y, T, 2);
  ctx.fillRect(X, Y, 2, T);
  ctx.fillStyle = "rgba(0,0,0,.18)";
  ctx.fillRect(X, Y + T - 2, T, 2);
  ctx.fillRect(X + T - 2, Y, 2, T);
  // 砖缝（错落感）
  ctx.fillStyle = "rgba(0,0,0,.2)";
  if (y % 2 === 0) ctx.fillRect(X, Y + T / 2, T, 1);
  else ctx.fillRect(X + 3, Y + T - 2, T - 6, 1);
  // 高光斑（随机 2px 亮块，打破平涂）
  ctx.fillStyle = "rgba(255,255,255,.05)";
  ctx.fillRect(X + 3, Y + 3, 2, 2);
  // 🆕 底部阴影过渡
  ctx.fillStyle = "rgba(0,0,0,.06)";
  ctx.fillRect(X, Y + T - 8, T, 3);
}

/* 床（3×2 格） */
function drawBed(ctx, x, y) {
  var X = x * T, Y = y * T;
  // 床架
  rect(ctx, X, Y, T * 3, T * 2, PAL.M);
  // 床头（左侧，木色）
  rect(ctx, X, Y, 4, T * 2, PAL.m);
  // 床垫
  rect(ctx, X + 4, Y + 2, T * 3 - 6, T * 2 - 4, PAL.w);
  // 枕头
  rect(ctx, X + 6, Y + 3, 9, 5, PAL.w);
  ctx.fillStyle = "rgba(0,0,0,.15)";
  ctx.fillRect(X + 6, Y + 3, 9, 2);
  // 被子
  rect(ctx, X + 16, Y + 4, T * 2 - 8, T * 2 - 6, PAL.r);
  rect(ctx, X + 16, Y + 4, T * 2 - 8, 3, PAL.R);
  // 床腿
  rect(ctx, X + 2, Y + T * 2 - 2, 2, 2, PAL.K);
  rect(ctx, X + T * 3 - 4, Y + T * 2 - 2, 2, 2, PAL.K);
}

/* 床头柜（1×1 格，带蜡烛与钱袋） */
function drawBedsideTable(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 1, Y + 6, T - 2, T - 6, PAL.m);      // 柜身
  rect(ctx, X + 1, Y + 6, T - 2, 2, PAL.M);          // 柜面影
  rect(ctx, X + 3, Y + 11, 2, 3, PAL.M);             // 柜腿
  rect(ctx, X + 11, Y + 11, 2, 3, PAL.M);
  rect(ctx, X + 3, Y + 8, T - 6, 3, PAL.D);          // 抽屉
  rect(ctx, X + 6, Y + 9, 4, 1, PAL.y);              // 拉手
  rect(ctx, X + 7, Y + 2, 2, 4, PAL.w);              // 蜡烛
  px(ctx, X + 7, Y + 1, PAL.y);                      // 烛火
  px(ctx, X + 8, Y + 1, PAL.y);
  px(ctx, X + 7, Y, PAL.o);
  rect(ctx, X + 12, Y + 7, 3, 3, PAL.l);             // 钱袋
  px(ctx, X + 12, Y + 6, PAL.l);
}

/* 门（1×2 格：下半门板+上半雕花，升级版） */
function drawDoor(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 2, Y, T - 4, T * 2, PAL.m);          // 门板
  rect(ctx, X + 2, Y, T - 4, 2, PAL.M);
  // 上半雕花格
  rect(ctx, X + 4, Y + 3, T - 8, 5, [90, 56, 30]);
  rect(ctx, X + 4, Y + 3, T - 8, 1, PAL.M);
  // 下半浮雕
  rect(ctx, X + 4, Y + 8, T - 8, T - 8, PAL.M);
  px(ctx, X + 5, Y + 11, PAL.y);                     // 门环
  px(ctx, X + 6, Y + 11, PAL.y);
  px(ctx, X + 10, Y + 11, PAL.y);
  rect(ctx, X, Y, 2, T * 2, PAL.M);                  // 门框
  rect(ctx, X + T - 2, Y, 2, T * 2, PAL.M);
  // 🆕 门框阴影
  ctx.fillStyle = "rgba(0,0,0,.15)";
  ctx.fillRect(X + T - 1, Y + 2, 1, T * 2 - 4);
}

/* 窗（2×1 格，墙上）——天色随时段变化（早晨阳光/中午蓝天/晚上夜色） */
function drawWindow(ctx, x, y, period) {
  var X = x * T, Y = y * T;
  rect(ctx, X, Y, T * 2, T, PAL.m);                  // 框
  var sky = [46, 74, 96];
  if (period === "morning") sky = [255, 214, 150];   // 早晨金黄
  else if (period === "noon") sky = [122, 178, 226]; // 中午亮蓝
  else sky = [38, 48, 92];                           // 晚上深蓝
  rect(ctx, X + 2, Y + 2, T * 2 - 4, T - 4, sky);
  rect(ctx, X + T - 1, Y + 2, 2, T - 4, PAL.m);      // 中梃
  if (period === "morning") {
    px(ctx, X + 4, Y + 3, PAL.y); px(ctx, X + 5, Y + 3, PAL.y); px(ctx, X + 4, Y + 4, PAL.y);
    rect(ctx, X + 11, Y + 8, 4, 2, PAL.g);           // 河对岸的树影
  } else if (period === "noon") {
    rect(ctx, X + 5, Y + 3, 5, 2, PAL.w);            // 白云
    rect(ctx, X + 13, Y + 5, 4, 2, PAL.w);
    rect(ctx, X + 11, Y + 8, 4, 2, PAL.g);
  } else {
    px(ctx, X + 20, Y + 3, PAL.w);                    // 月亮
    px(ctx, X + 19, Y + 4, PAL.w);
    px(ctx, X + 6, Y + 4, PAL.w); px(ctx, X + 9, Y + 6, PAL.w); px(ctx, X + 13, Y + 4, PAL.w); // 星
    px(ctx, X + 16, Y + 8, PAL.y);                    // 河面灯影
    px(ctx, X + 4, Y + 8, PAL.y);
  }
}

/* 挂画/告示（1×1，墙上） */
function drawPoster(ctx, x, y, kind) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 3, Y + 3, T - 6, T - 6, PAL.w);
  rect(ctx, X + 3, Y + 3, T - 6, 2, PAL.k);
  if (kind === "letter") {
    px(ctx, X + 6, Y + 7, PAL.k); px(ctx, X + 8, Y + 7, PAL.k); px(ctx, X + 10, Y + 7, PAL.k);
    px(ctx, X + 6, Y + 9, PAL.k); px(ctx, X + 8, Y + 9, PAL.k); px(ctx, X + 10, Y + 9, PAL.k);
  } else {
    rect(ctx, X + 5, Y + 5, 6, 6, PAL.r);
    px(ctx, X + 7, Y + 6, PAL.y);
    px(ctx, X + 8, Y + 7, PAL.y);
    px(ctx, X + 7, Y + 8, PAL.y);
    px(ctx, X + 8, Y + 9, PAL.y);
  }
}

/* 地毯（4×2 格） */
function drawRug(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X, Y + 4, T * 4, T * 2 - 6, PAL.r);
  rect(ctx, X + 2, Y + 5, T * 4 - 4, T * 2 - 8, PAL.R);
  rect(ctx, X + 4, Y + 6, T * 4 - 8, 3, PAL.y);
  px(ctx, X + 3, Y + 8, PAL.y);
  px(ctx, X + T * 4 - 4, Y + 8, PAL.y);
}

/* 吧台（横向多格 1 高 + 台面） */
function drawBar(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X, Y, T, T, PAL.m);
  rect(ctx, X, Y, T, 3, PAL.l);            // 台面（亮色木纹）
  rect(ctx, X, Y + 1, T, 1, [180, 140, 90]); // 台面高光
  rect(ctx, X + 2, Y + 6, T - 4, 2, PAL.M); // 装饰条
  // 🆕 装饰条阴影
  ctx.fillStyle = "rgba(0,0,0,.12)";
  ctx.fillRect(X + 2, Y + 8, T - 4, 1);
  rect(ctx, X + 3, Y + 12, 3, 3, PAL.M);    // 腿
  rect(ctx, X + 10, Y + 12, 3, 3, PAL.M);
  // 🆕 吧台底部阴影
  ctx.fillStyle = "rgba(0,0,0,.1)";
  ctx.fillRect(X, Y + T - 1, T, 1);
}

/* 啤酒杯（吧台上） */
function drawMug(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 4, Y + 4, 8, 9, PAL.w);
  rect(ctx, X + 4, Y + 4, 8, 3, PAL.y);     // 泡沫
  rect(ctx, X + 12, Y + 6, 2, 4, PAL.w);    // 把手
  rect(ctx, X + 3, Y + 12, 10, 2, PAL.z);
}

/* 酒桶 */
function drawBarrel(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 2, Y + 3, T - 4, T - 6, PAL.l);
  rect(ctx, X + 2, Y + 3, T - 4, 2, PAL.M);
  rect(ctx, X + 2, Y + 11, T - 4, 2, PAL.M);
  rect(ctx, X + 5, Y + 6, 6, 2, PAL.y);
}

/* 21点圆桌（2×2 格） */
function drawBJTable(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 1, Y + 4, T * 2 - 2, T * 2 - 6, PAL.m);      // 桌面
  rect(ctx, X + 3, Y + 2, T * 2 - 6, T * 2 - 2, PAL.t);      // 台呢
  rect(ctx, X + 6, Y + 6, T * 2 - 12, T * 2 - 12, PAL.g);    // 绿色赌面
  rect(ctx, X + 5, Y + 5, 2, 2, PAL.y);                      // 角标
  rect(ctx, X + T + 1, Y + 5, 2, 2, PAL.y);
  px(ctx, X + 8, Y + 9, PAL.K);
  px(ctx, X + 9, Y + 8, PAL.K);
  px(ctx, X + 10, Y + 9, PAL.K);
  px(ctx, X + 11, Y + 8, PAL.K);
  rect(ctx, X + 4, Y + 12, 4, 3, PAL.M);                     // 桌腿
  rect(ctx, X + T, Y + 12, 4, 3, PAL.M);
}

/* 德州椭圆桌（4×2 格） */
function drawPokerTable(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 2, Y + 3, T * 4 - 4, T * 2 - 5, PAL.m);
  rect(ctx, X + 6, Y + 1, T * 4 - 12, T * 2 - 1, PAL.t);
  rect(ctx, X + 8, Y + 4, T * 4 - 16, T * 2 - 7, PAL.g);     // 赌面
  rect(ctx, X + 7, Y + 3, T * 4 - 14, 2, PAL.g);             // 高光
  px(ctx, X + 10, Y + 6, PAL.y); px(ctx, X + 14, Y + 6, PAL.y);
  px(ctx, X + 18, Y + 6, PAL.y); px(ctx, X + 22, Y + 6, PAL.y);
  px(ctx, X + 26, Y + 6, PAL.y); px(ctx, X + 30, Y + 6, PAL.y);
  rect(ctx, X + 6, Y + 13, 4, 3, PAL.M);
  rect(ctx, X + 14, Y + 13, 4, 3, PAL.M);
  rect(ctx, X + 22, Y + 13, 4, 3, PAL.M);
  rect(ctx, X + 30, Y + 13, 4, 3, PAL.M);
}

/* 椅子（1×1） */
function drawChair(ctx, x, y, dir) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 2, Y + 4, T - 4, T - 6, PAL.m);   // 座
  rect(ctx, X + 2, Y + 4, T - 4, 2, PAL.l);
  if (dir === "up") rect(ctx, X + 2, Y + 1, T - 4, 3, PAL.m);   // 靠背
  else rect(ctx, X + 2, Y + 4, 3, 5, PAL.m);
  rect(ctx, X + 4, Y + 12, 2, 3, PAL.M);
  rect(ctx, X + 10, Y + 12, 2, 3, PAL.M);
}

/* 蛇笼（2×2 格：木笼+蛇） */
function drawSnakeCabinet(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 1, Y + 2, T * 2 - 2, T * 2 - 4, PAL.m);   // 笼架
  rect(ctx, X + 1, Y + 2, T * 2 - 2, 2, PAL.l);
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.fillRect(X + 3, Y + 6, T * 2 - 6, T * 2 - 9);       // 暗笼内
  // 蛇（S 形）
  var snake = [[5, 9], [6, 9], [7, 8], [8, 8], [9, 9], [10, 9], [11, 10], [12, 10], [13, 9]];
  for (var i = 0; i < snake.length; i++) px(ctx, X + snake[i][0], Y + snake[i][1], i === 0 ? PAL.G : PAL.g);
  px(ctx, X + 5, Y + 8, PAL.G); px(ctx, X + 6, Y + 8, PAL.G);
  rect(ctx, X + 8, Y + 13, T - 6, 2, PAL.l);              // 铭牌
  rect(ctx, X + 9, Y + 13, T - 8, 1, PAL.M);
}

/* 账房桌（2×1 格） */
function drawDesk(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X, Y + 3, T * 2, T - 3, PAL.m);
  rect(ctx, X, Y + 3, T * 2, 3, PAL.l);
  rect(ctx, X + 2, Y + 7, 6, 5, PAL.t);                    // 账本
  rect(ctx, X + 3, Y + 8, 4, 1, PAL.k);
  px(ctx, X + 10, Y + 8, PAL.y); px(ctx, X + 11, Y + 8, PAL.y); px(ctx, X + 12, Y + 8, PAL.y);
  px(ctx, X + 10, Y + 9, PAL.y); px(ctx, X + 12, Y + 9, PAL.y);
  rect(ctx, X + 4, Y + 12, 3, 3, PAL.M);
  rect(ctx, X + 11, Y + 12, 3, 3, PAL.M);
}

/* 灯笼（1×1） */
function drawLantern(ctx, x, y) {
  var X = x * T, Y = y * T;
  // 光晕（2026-08-18 美化：暖黄半透明罩）
  ctx.fillStyle = "rgba(255,215,94,.14)";
  ctx.fillRect(X - 1, Y - 1, T + 2, T + 2);
  ctx.fillStyle = "rgba(255,215,94,.10)";
  ctx.fillRect(X - 3, Y - 3, T + 6, T + 6);
  rect(ctx, X + 7, Y + 2, 2, 2, PAL.M);                    // 挂绳
  rect(ctx, X + 5, Y + 4, 6, 7, PAL.R);                    // 灯体
  rect(ctx, X + 6, Y + 5, 4, 5, PAL.y);                    // 光
  rect(ctx, X + 5, Y + 11, 6, 2, PAL.M);
}

/* 招牌（2×1，墙上）——像素图形，不用 canvas 小字（避免放大发虚） */
function drawSign(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X, Y + 4, T * 2, T - 4, PAL.m);
  rect(ctx, X + 1, Y + 5, T * 2 - 2, T - 6, PAL.y);
  // 红标（酒）
  px(ctx, X + 5, Y + 6, PAL.r); px(ctx, X + 6, Y + 6, PAL.r); px(ctx, X + 7, Y + 6, PAL.r);
  px(ctx, X + 5, Y + 7, PAL.r); px(ctx, X + 7, Y + 7, PAL.r);
  px(ctx, X + 6, Y + 8, PAL.r);
  // 金杯
  px(ctx, X + 11, Y + 6, PAL.M); px(ctx, X + 12, Y + 6, PAL.M); px(ctx, X + 13, Y + 6, PAL.M);
  px(ctx, X + 10, Y + 7, PAL.w); px(ctx, X + 11, Y + 7, PAL.w); px(ctx, X + 12, Y + 7, PAL.w);
  px(ctx, X + 13, Y + 7, PAL.w); px(ctx, X + 14, Y + 7, PAL.w);
  px(ctx, X + 10, Y + 8, PAL.w); px(ctx, X + 14, Y + 8, PAL.w);
  px(ctx, X + 11, Y + 9, PAL.w); px(ctx, X + 13, Y + 9, PAL.w);
  px(ctx, X + 12, Y + 10, PAL.w);
}

/* 楼梯口（通往二楼，2×2 格） */
function drawStairs(ctx, x, y) {
  var X = x * T, Y = y * T;
  for (var i = 0; i < 4; i++) {
    rect(ctx, X + 2 + i * 3, Y + i * 3 + 2, T * 2 - 6 - i * 2, 3, PAL.z);
    rect(ctx, X + 2 + i * 3, Y + i * 3 + 2, T * 2 - 6 - i * 2, 1, PAL.w);
  }
}

/* 酒馆门面（标题画面用，直接画大图） */
function drawTavernFront(ctx, cx, cy) {
  var W = 96, H = 56;
  var X = Math.round(cx - W / 2), Y = Math.round(cy - H / 2);
  // 天空
  rect(ctx, X, Y, W, H, [16, 20, 38]);
  // 屋顶
  ctx.fillStyle = "rgb(107,68,35)";
  ctx.beginPath();
  ctx.moveTo(X, Y + 22); ctx.lineTo(X + W / 2, Y + 4); ctx.lineTo(X + W, Y + 22); ctx.fill();
  ctx.fillStyle = "rgb(139,90,43)";
  ctx.beginPath();
  ctx.moveTo(X + 2, Y + 22); ctx.lineTo(X + W / 2, Y + 7); ctx.lineTo(X + W - 2, Y + 22); ctx.fill();
  // 屋身
  rect(ctx, X, Y + 22, W, H - 22, [139, 90, 43]);
  rect(ctx, X + 4, Y + 24, W - 8, H - 28, [104, 68, 40]);
  // 窗
  rect(ctx, X + 10, Y + 30, 14, 12, [46, 74, 96]);
  rect(ctx, X + 72, Y + 30, 14, 12, [46, 74, 96]);
  rect(ctx, X + 12, Y + 32, 4, 4, PAL.y);
  rect(ctx, X + 74, Y + 32, 4, 4, PAL.y);
  // 招牌
  rect(ctx, X + W / 2 - 16, Y + 26, 32, 12, PAL.y);
  ctx.fillStyle = "rgb(74,47,29)";
  ctx.font = "bold 8px monospace";
  ctx.textAlign = "center";
  ctx.fillText("柳枝酒馆", X + W / 2, Y + 35);
  // 门
  rect(ctx, X + W / 2 - 7, Y + 40, 14, H - 44, [74, 47, 29]);
  rect(ctx, X + W / 2 - 3, Y + 44, 6, H - 50, [46, 30, 19]);
  px(ctx, X + W / 2 + 2, Y + 46, PAL.y);
  // 灯笼
  rect(ctx, X + 4, Y + 26, 4, 8, PAL.R);
  rect(ctx, X + W - 8, Y + 26, 4, 8, PAL.R);
  // 草地
  rect(ctx, X, Y + H - 4, W, 4, [30, 70, 44]);
}

/* ---------------- 日历（墙上） ---------------- */
function drawCalendar(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 3, Y + 2, T - 6, T - 5, [46, 34, 24]);      // 背板
  rect(ctx, X + 4, Y + 3, T - 8, T - 7, PAL.w);             // 纸
  px(ctx, X + 5, Y + 4, PAL.r);                             // 红字
  px(ctx, X + 6, Y + 4, PAL.r);
  px(ctx, X + 9, Y + 4, PAL.k);
  px(ctx, X + 10, Y + 4, PAL.k);
  px(ctx, X + 5, Y + 6, PAL.k); px(ctx, X + 6, Y + 6, PAL.k); px(ctx, X + 7, Y + 6, PAL.k);
  px(ctx, X + 9, Y + 6, PAL.k); px(ctx, X + 10, Y + 6, PAL.k); px(ctx, X + 11, Y + 6, PAL.k);
  rect(ctx, X + 8, Y + 5, 1, 1, PAL.r);                     // 今天的红圈
  rect(ctx, X + 5, Y + 9, 6, 1, PAL.z);                     // 表格线
  rect(ctx, X + 5, Y + 10, 6, 1, PAL.z);
  rect(ctx, X + 5, Y + 11, 6, 1, PAL.z);
  rect(ctx, X + 6, Y + 2, 4, 1, PAL.l);                     // 挂环
}

/* ---------------- 家具（商店购置，房间内） ---------------- */

/* 书桌（2×1） */
function drawDesk2(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 1, Y + 6, T * 2 - 2, T - 6, PAL.m);
  rect(ctx, X + 1, Y + 6, T * 2 - 2, 3, PAL.l);
  rect(ctx, X + 3, Y + 9, 4, 4, PAL.t);                     // 摊开的书
  rect(ctx, X + 4, Y + 10, 2, 1, PAL.k);
  rect(ctx, X + 11, Y + 9, 3, 2, PAL.y);                    // 烛台
  rect(ctx, X + 4, Y + 12, 3, 3, PAL.M);                    // 桌腿
  rect(ctx, X + 10, Y + 12, 3, 3, PAL.M);
  rect(ctx, X + 16, Y + 12, 3, 3, PAL.M);
}

/* 书架（1×1） */
function drawBookshelf(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 2, Y + 1, T - 4, T - 4, PAL.M);             // 架体
  rect(ctx, X + 2, Y + 5, T - 4, 2, PAL.m);                 // 隔板
  rect(ctx, X + 2, Y + 10, T - 4, 2, PAL.m);
  rect(ctx, X + 4, Y + 2, 2, 3, PAL.r);                     // 书脊
  rect(ctx, X + 7, Y + 2, 2, 3, PAL.g);
  rect(ctx, X + 10, Y + 2, 3, 3, PAL.b);
  rect(ctx, X + 4, Y + 7, 3, 3, PAL.y);
  rect(ctx, X + 8, Y + 7, 2, 3, PAL.p);
  rect(ctx, X + 11, Y + 7, 2, 3, PAL.t);
}

/* 衣柜（1×1） */
function drawWardrobe(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 2, Y + 1, T - 4, T - 3, PAL.M);             // 柜体
  rect(ctx, X + 2, Y + 1, T - 4, 2, PAL.l);
  rect(ctx, X + 3, Y + 4, T - 6, T - 7, PAL.D);             // 柜门
  rect(ctx, X + 4, Y + 5, 1, 6, PAL.m);                     // 门缝
  px(ctx, X + 10, Y + 8, PAL.y);                            // 把手
  rect(ctx, X + 2, Y + 13, T - 4, 2, PAL.M);                // 底座
}

/* 钱箱（1×1） */
function drawChest(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 2, Y + 6, T - 4, T - 7, PAL.m);             // 箱体
  rect(ctx, X + 2, Y + 6, T - 4, 2, PAL.l);
  rect(ctx, X + 3, Y + 9, T - 6, 3, PAL.y);                 // 铜条
  rect(ctx, X + 6, Y + 7, 4, 2, PAL.K);                     // 锁扣
  px(ctx, X + 7, Y + 8, PAL.y);
  rect(ctx, X + 4, Y + 12, 2, 3, PAL.M);                    // 腿
  rect(ctx, X + 10, Y + 12, 2, 3, PAL.M);
}

/* 盆栽（1×1） */
function drawPlant(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 4, Y + 11, T - 8, 4, PAL.M);                // 盆
  rect(ctx, X + 4, Y + 11, T - 8, 2, PAL.l);
  ctx.fillStyle = "rgb(63,158,79)";
  ctx.beginPath(); ctx.moveTo(X + 8, Y + 11); ctx.lineTo(X + 5, Y + 4); ctx.lineTo(X + 7, Y + 3); ctx.lineTo(X + 8, Y + 6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(X + 8, Y + 11); ctx.lineTo(X + 11, Y + 4); ctx.lineTo(X + 9, Y + 3); ctx.lineTo(X + 8, Y + 6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(X + 8, Y + 11); ctx.lineTo(X + 8, Y + 2); ctx.lineTo(X + 9, Y + 2); ctx.lineTo(X + 8, Y + 6); ctx.fill();
  ctx.fillStyle = "rgb(111,208,122)";
  ctx.fillRect(X + 6, Y + 3, 1, 1);
  ctx.fillRect(X + 10, Y + 3, 1, 1);
}

/* 挂画（1×1，墙上） */
function drawPainting(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 3, Y + 3, T - 6, T - 6, PAL.m);             // 框
  rect(ctx, X + 4, Y + 4, T - 8, T - 8, PAL.w);
  rect(ctx, X + 4, Y + 7, T - 8, 3, PAL.b);                 // 河水
  rect(ctx, X + 6, Y + 6, 3, 3, PAL.g);                     // 柳树
  px(ctx, X + 10, Y + 5, PAL.y);                            // 灯影
}

/* 落地烛台（1×1） */
function drawCandle(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 7, Y + 3, 2, 3, PAL.w);                     // 烛身
  px(ctx, X + 7, Y + 2, PAL.y);                             // 火
  px(ctx, X + 8, Y + 2, PAL.y);
  px(ctx, X + 7, Y + 1, PAL.o);
  rect(ctx, X + 4, Y + 6, 8, 2, PAL.m);                     // 托盘
  rect(ctx, X + 6, Y + 8, 4, 5, PAL.M);                     // 立杆
  rect(ctx, X + 3, Y + 13, 10, 2, PAL.M);                   // 底座
}

/* 织花地毯（3×2） */
function drawRug2(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X, Y + 4, T * 3, T * 2 - 7, PAL.p);             // 紫底
  rect(ctx, X + 2, Y + 5, T * 3 - 4, T * 2 - 9, PAL.R);     // 红内圈
  rect(ctx, X + 4, Y + 6, T * 3 - 8, 4, PAL.y);             // 金纹
  px(ctx, X + 5, Y + 8, PAL.y); px(ctx, X + 9, Y + 8, PAL.y); px(ctx, X + 13, Y + 8, PAL.y);
  px(ctx, X + 21, Y + 8, PAL.y); px(ctx, X + 25, Y + 8, PAL.y);
  px(ctx, X + 4, Y + 7, PAL.y); px(ctx, X + 30, Y + 7, PAL.y);
}

/* UNO 桌（3×2）——红呢桌面 + 四色圆点 */
function drawUNOTable(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 1, Y + 3, T * 3 - 2, T * 2 - 4, PAL.m);      // 桌身
  rect(ctx, X + 3, Y + 1, T * 3 - 6, T * 2 - 2, PAL.t);      // 台面
  rect(ctx, X + 5, Y + 4, T * 3 - 10, T * 2 - 7, "#a8382f"); // 红呢
  rect(ctx, X + 4, Y + 3, T * 3 - 8, 2, "#c24b40");          // 高光
  var cols = ["#e5523f", "#f0c33e", "#43a047", "#3f7ae5"];
  for (var i = 0; i < 4; i++) {
    rect(ctx, X + 7 + i * 8, Y + 7, 5, 4, cols[i]);          // 四色牌点
  }
  px(ctx, X + 11, Y + 6, PAL.w); px(ctx, X + 19, Y + 6, PAL.w);
}

/* 斗地主方桌（3×2 格） */
function drawDDZTable(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 1, Y + 3, T * 3 - 2, T * 2 - 4, PAL.m);      // 桌身
  rect(ctx, X + 3, Y + 1, T * 3 - 6, T * 2 - 2, PAL.t);      // 台面
  rect(ctx, X + 5, Y + 4, T * 3 - 10, T * 2 - 7, PAL.g);     // 绿呢
  rect(ctx, X + 4, Y + 3, T * 3 - 8, 2, PAL.g);              // 高光
  px(ctx, X + 7, Y + 6, PAL.y); px(ctx, X + 12, Y + 6, PAL.y); px(ctx, X + 17, Y + 6, PAL.y);
  px(ctx, X + 22, Y + 6, PAL.y); px(ctx, X + 27, Y + 6, PAL.y);
  px(ctx, X + 9, Y + 9, PAL.r); px(ctx, X + 17, Y + 9, PAL.r); px(ctx, X + 25, Y + 9, PAL.r);
  rect(ctx, X + 5, Y + 13, 4, 3, PAL.M);
  rect(ctx, X + 13, Y + 13, 4, 3, PAL.M);
  rect(ctx, X + 21, Y + 13, 4, 3, PAL.M);
  rect(ctx, X + 29, Y + 13, 4, 3, PAL.M);
}

/* 乒乓球台（4×2 格，带网） */
function drawPongTable(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 1, Y + 5, T * 4 - 2, T * 2 - 8, [46, 74, 96]); // 台面（玻璃蓝）
  rect(ctx, X + 1, Y + 5, T * 4 - 2, 2, PAL.c);              // 高光
  rect(ctx, X + 1, Y + 5, T * 4 - 2, T * 2 - 8, "rgba(92,214,214,.25)"); // 微光
  ctx.fillStyle = "rgba(245,239,224,.85)";                   // 白网
  for (var i = 0; i < 8; i++) ctx.fillRect(X + 4 + i * 7, Y + 4, 2, 3);
  ctx.fillStyle = "rgb(92,214,214)";
  ctx.fillRect(X + 3, Y + 6, 4, 3);                          // 球
  rect(ctx, X + 8, Y + 13, 4, 3, PAL.M);                     // 桌腿
  rect(ctx, X + 20, Y + 13, 4, 3, PAL.M);
  rect(ctx, X + 36, Y + 13, 4, 3, PAL.M);
  rect(ctx, X + 52, Y + 13, 4, 3, PAL.M);
}

/* ---------------- 户外（草地/河/农田/庄园） ---------------- */

/* 草地：优先 Kenney 瓦片，回退程序化 */
function drawGrass(ctx, x, y) {
  var X = x * T, Y = y * T;
  // 优先用 Kenney 瓦片
  if (TILES.ready.town) {
    var detail = (x * 13 + y * 17) % 5 === 0 ? tilePick(TILE_MAP.grassFlower, x, y) : null;
    if (detail !== undefined && detail !== null) drawTile(ctx, "town", detail, X, Y);
    else drawTile(ctx, "town", tilePick(TILE_MAP.grass, x, y), X, Y);
    return;
  }
  var base = (x + y) % 2 === 0 ? [52, 96, 58] : [46, 88, 52];
  rect(ctx, X, Y, T, T, base);
  ctx.fillStyle = "rgba(0,0,0,.12)";
  ctx.fillRect(X, Y, T, 1);
  ctx.fillRect(X, Y, 1, T);
  // 草叶（每格约 2/3 概率，两簇）
  if ((x * 7 + y * 13) % 3 !== 0) {
    ctx.fillStyle = "rgb(72,124,66)";
    ctx.fillRect(X + 3 + ((x * 5) % 8), Y + 4 + ((y * 7) % 8), 1, 3);
    ctx.fillRect(X + 9 + ((y * 5) % 5), Y + 7 + ((x * 3) % 6), 1, 2);
  } else {
    ctx.fillStyle = "rgb(80,132,72)";
    ctx.fillRect(X + 4 + ((y * 3) % 7), Y + 6 + ((x * 5) % 6), 1, 2);
  }
  // 散点小花（约 1/8 格）
  if ((x * 13 + y * 17) % 8 === 0) {
    var fx = X + 3 + ((x * 7) % 9), fy = Y + 4 + ((y * 5) % 7);
    ctx.fillStyle = "rgba(255,240,200,.9)";
    ctx.fillRect(fx, fy, 1, 1);
    ctx.fillStyle = "rgba(240,200,120,.7)";
    ctx.fillRect(fx + 1, fy, 1, 1);
  }
}

/* 河水：优先 Kenney 瓦片，回退程序化 */
function drawRiver(ctx, x, y) {
  var X = x * T, Y = y * T;
  if (TILES.ready.town) {
    drawTile(ctx, "town", tilePick(TILE_MAP.water, x, y), X, Y);
    return;
  }
  var base = (x + y) % 2 === 0 ? [46, 86, 120] : [42, 80, 112];
  rect(ctx, X, Y, T, T, base);
  ctx.fillStyle = "rgba(255,255,255,.10)";
  ctx.fillRect(X + 2, Y + 3 + ((x * 5) % 8), 4, 2);
  ctx.fillRect(X + 9, Y + 8 + ((y * 3) % 5), 3, 1);
}

/* 农田 */
function drawField(ctx, x, y) {
  var X = x * T, Y = y * T;
  var base = (x + y) % 2 === 0 ? [158, 128, 62] : [146, 118, 56];
  rect(ctx, X, Y, T, T, base);
  // 垄沟
  ctx.fillStyle = "rgba(74,56,26,.35)";
  for (var i = 0; i < 4; i++) ctx.fillRect(X, Y + i * 4 + 2, T, 1);
  // 麦苗
  ctx.fillStyle = "rgb(104,156,64)";
  ctx.fillRect(X + 3, Y + 2, 1, 2); ctx.fillRect(X + 9, Y + 6, 1, 2); ctx.fillRect(X + 13, Y + 10, 1, 2);
}

/* 小路（泥土）：优先 Kenney 瓦片，回退程序化 */
function drawPath(ctx, x, y) {
  var X = x * T, Y = y * T;
  if (TILES.ready.town) {
    drawTile(ctx, "town", tilePick(TILE_MAP.path, x, y), X, Y);
    return;
  }
  rect(ctx, X, Y, T, T, [150, 122, 86]);
  ctx.fillStyle = "rgba(90,70,46,.35)";
  ctx.fillRect(X + 2, Y + 4, 3, 2); ctx.fillRect(X + 9, Y + 9, 4, 3); ctx.fillRect(X + 5, Y + 1, 2, 2);
}

/* 树（1×1，solid） */
function drawTree(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 6, Y + 10, 4, 5, PAL.M);                 // 树干
  ctx.fillStyle = "rgb(52,110,62)";
  ctx.beginPath();
  ctx.moveTo(X + 8, Y + 2); ctx.lineTo(X + 2, Y + 12); ctx.lineTo(X + 14, Y + 12); ctx.fill();
  ctx.fillStyle = "rgb(70,132,74)";
  ctx.beginPath();
  ctx.moveTo(X + 8, Y); ctx.lineTo(X + 4, Y + 9); ctx.lineTo(X + 12, Y + 9); ctx.fill();
  ctx.fillStyle = "rgb(96,156,84)";
  ctx.fillRect(X + 5, Y + 2, 2, 2);
}

/* 邮筒（1×1） */
function drawMailbox(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 5, Y + 8, 6, 6, PAL.M);                  // 柱
  rect(ctx, X + 3, Y + 4, 10, 5, PAL.r);                 // 箱
  rect(ctx, X + 3, Y + 4, 10, 2, PAL.R);
  rect(ctx, X + 9, Y + 5, 2, 3, PAL.K);                  // 口
  rect(ctx, X + 5, Y + 14, 6, 1, PAL.M);
}

/* 钓鱼点（岸边石头 + 浮标） */
function drawFishingSpot(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 2, Y + 8, 5, 4, PAL.z);                  // 石头
  rect(ctx, X + 9, Y + 10, 4, 3, PAL.Z);
  rect(ctx, X + 11, Y + 3, 1, 8, PAL.M);                 // 鱼竿
  rect(ctx, X + 10, Y + 2, 3, 1, PAL.M);
  px(ctx, X + 13, Y + 4, PAL.r);                         // 浮标
}

/* 庄园大门（2×2 铁门） */
function drawManorGate(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X, Y, 6, T * 2, PAL.z);                      // 石柱
  rect(ctx, X + T * 2 - 6, Y, 6, T * 2, PAL.z);
  rect(ctx, X, Y, 6, 3, PAL.w); rect(ctx, X + T * 2 - 6, Y, 6, 3, PAL.w);
  ctx.fillStyle = "rgba(40,34,58,.9)";                   // 铁门
  ctx.fillRect(X + 6, Y + 2, T * 2 - 12, T * 2 - 4);
  for (var i = 0; i < 6; i++) {
    ctx.fillStyle = "rgba(154,143,184,.6)";
    ctx.fillRect(X + 8 + i * 4, Y + 2, 1, T * 2 - 4);
    ctx.fillRect(X + 6, Y + 4 + i * 4, T * 2 - 12, 1);
  }
  px(ctx, X + 15, Y + 14, PAL.y);                        // 门环
  px(ctx, X + 16, Y + 14, PAL.y);
}

/* 庄园围墙（1×1 solid 装饰） */
function drawManorWall(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X, Y, T, T, [120, 118, 128]);
  rect(ctx, X, Y, T, 3, [150, 148, 158]);
  rect(ctx, X, Y + 10, T, 3, [150, 148, 158]);
  rect(ctx, X + 2, Y, 3, T, [96, 94, 104]);
  rect(ctx, X + 11, Y, 3, T, [96, 94, 104]);
}

/* 稻草人（1×1） */
function drawScarecrow(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 7, Y + 2, 2, 8, PAL.m);                  // 杆
  rect(ctx, X + 3, Y + 4, 10, 5, PAL.l);                 // 旧衣
  rect(ctx, X + 4, Y + 5, 2, 2, PAL.t);                  // 脸（布）
  px(ctx, X + 4, Y + 5, PAL.k); px(ctx, X + 5, Y + 6, PAL.k);
  rect(ctx, X + 2, Y + 4, 12, 1, PAL.M);                 // 帽沿
  rect(ctx, X + 5, Y + 2, 6, 2, PAL.M);                  // 帽顶
  rect(ctx, X + 5, Y + 10, 2, 4, PAL.m);                 // 腿
  rect(ctx, X + 9, Y + 10, 2, 4, PAL.m);
}

/* 鱼标本（挂在房间墙上，1×1） */
function drawFishTrophy(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 3, Y + 3, T - 6, T - 6, PAL.m);          // 木牌
  rect(ctx, X + 4, Y + 4, T - 8, T - 8, PAL.t);
  ctx.fillStyle = "rgb(120,150,190)";                    // 鱼身
  ctx.beginPath();
  ctx.moveTo(X + 5, Y + 9); ctx.lineTo(X + 11, Y + 6); ctx.lineTo(X + 11, Y + 12); ctx.fill();
  px(ctx, X + 6, Y + 8, PAL.k);                          // 鱼眼
  ctx.fillStyle = "rgb(70,90,120)";
  ctx.fillRect(X + 9, Y + 7, 2, 3);                      // 尾
  rect(ctx, X + 5, Y + 13, 6, 1, PAL.m);                 // 铭牌
}

/* 灌木丛（户外障碍墙） */
function drawBush(ctx, x, y) {
  var X = x * T, Y = y * T;
  ctx.fillStyle = "rgb(40,86,48)";
  ctx.beginPath();
  ctx.moveTo(X + 8, Y + 2); ctx.lineTo(X + 2, Y + 13); ctx.lineTo(X + 14, Y + 13); ctx.fill();
  ctx.fillStyle = "rgb(56,104,58)";
  ctx.beginPath();
  ctx.moveTo(X + 8, Y); ctx.lineTo(X + 4, Y + 11); ctx.lineTo(X + 12, Y + 11); ctx.fill();
  ctx.fillStyle = "rgb(78,132,72)";
  ctx.fillRect(X + 6, Y + 3, 2, 2);
  ctx.fillRect(X + 10, Y + 6, 2, 2);
}

/* 路标（木牌） */
function drawRoadSign(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 7, Y + 6, 2, 9, PAL.m);                  // 杆
  rect(ctx, X + 3, Y + 2, 10, 5, PAL.m);                 // 牌
  rect(ctx, X + 4, Y + 3, 8, 3, PAL.t);
  rect(ctx, X + 6, Y + 4, 4, 1, PAL.k);
}

/* 农具摊（艾尔，1×1） */
function drawFarmStand(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 1, Y + 5, T - 2, T - 5, PAL.m);            // 柜台
  rect(ctx, X + 1, Y + 5, T - 2, 3, PAL.l);
  rect(ctx, X + 2, Y + 8, 4, 2, PAL.y);                    // 麦袋
  rect(ctx, X + 9, Y + 8, 4, 2, PAL.t);
  rect(ctx, X + 2, Y + 11, 3, 2, PAL.g);                   // 苗
  rect(ctx, X + 10, Y + 11, 3, 2, PAL.g);
  rect(ctx, X + 4, Y + 12, 2, 3, PAL.M);                   // 腿
  rect(ctx, X + 10, Y + 12, 2, 3, PAL.M);
  rect(ctx, X + 6, Y + 2, 4, 3, PAL.M);                    // 招牌
  rect(ctx, X + 7, Y + 3, 2, 1, PAL.y);
}

/* 工地/脚手架（罗伯特，2×1） */
function drawBuildSite(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 1, Y + 2, 2, T - 4, PAL.m);                // 立柱
  rect(ctx, X + T + 1, Y + 2, 2, T - 4, PAL.m);
  rect(ctx, X + 1, Y + 6, T + 2, 2, PAL.l);                // 踏板
  rect(ctx, X + 1, Y + 11, T + 2, 2, PAL.l);
  rect(ctx, X + 4, Y + 3, 2, 2, PAL.m);                    // 斜撑
  rect(ctx, X + 9, Y + 3, 2, 2, PAL.m);
  rect(ctx, X + 7, Y + 1, 3, 2, PAL.y);                    // 帽子
}

/* 建成的仓库（2×2，农田场景） */
function drawWarehouse(ctx, x, y) {
  var X = x * T, Y = y * T;
  ctx.fillStyle = "rgb(96,70,44)";                          // 屋顶
  ctx.beginPath();
  ctx.moveTo(X, Y + 8); ctx.lineTo(X + T, Y + 2); ctx.lineTo(X + T * 2, Y + 8); ctx.fill();
  ctx.fillStyle = "rgb(139,90,43)";
  ctx.beginPath();
  ctx.moveTo(X + 2, Y + 8); ctx.lineTo(X + T, Y + 4); ctx.lineTo(X + T * 2 - 2, Y + 8); ctx.fill();
  rect(ctx, X + 2, Y + 8, T * 2 - 4, T - 8, PAL.m);        // 墙体
  rect(ctx, X + 8, Y + 10, 4, 6, PAL.M);                   // 门
  rect(ctx, X + 4, Y + 12, 3, 3, PAL.y);                   // 麦堆
  rect(ctx, X + 11, Y + 13, 3, 2, PAL.y);
}

/* 农田可购田格（2×3，engine.js 按 farmland 数量 push；idx=格序号）
 * 状态：未购=荒草；已购未种=褐土垄沟；已种未熟=麦苗；已熟=金麦穗
 * （简化：前 planted 块显示"已种"，不区分具体哪块） */
function drawPlot(ctx, x, y, idx) {
  var X = x * T, Y = y * T;
  var st = (typeof GS !== "undefined" && GS.state) ? GS.state : null;
  var owned = st && st.farmland > idx;
  if (!owned) {
    // 未购：荒草地 + 田埂
    rect(ctx, X, Y, T, T, [60, 104, 62]);
    ctx.fillStyle = "rgba(0,0,0,.15)";
    ctx.fillRect(X, Y, T, 1); ctx.fillRect(X, Y, 1, T);
    ctx.fillStyle = "rgb(96,150,74)";
    ctx.fillRect(X + 3, Y + 4, 1, 3); ctx.fillRect(X + 9, Y + 8, 1, 2); ctx.fillRect(X + 12, Y + 3, 1, 3);
    return;
  }
  rect(ctx, X, Y, T, T, [158, 128, 62]);                    // 褐土
  ctx.fillStyle = "rgba(74,56,26,.35)";
  ctx.fillRect(X, Y + 4, T, 1); ctx.fillRect(X, Y + 8, T, 1); ctx.fillRect(X, Y + 12, T, 1);
  ctx.fillStyle = "rgb(139,90,43)";                         // 田埂
  ctx.fillRect(X, Y, T, 1); ctx.fillRect(X, Y + T - 1, T, 1);
  ctx.fillRect(X, Y, 1, T); ctx.fillRect(X + T - 1, Y, 1, T);
  var seeded = st.planted > idx;
  if (!seeded) return;                                      // 已购未种
  if (st.day < st.harvestDay) {
    // 麦苗
    ctx.fillStyle = "rgb(104,156,64)";
    ctx.fillRect(X + 3, Y + 2, 1, 3); ctx.fillRect(X + 8, Y + 6, 1, 3); ctx.fillRect(X + 12, Y + 4, 1, 3);
  } else {
    // 熟麦 + 金穗
    ctx.fillStyle = "rgb(104,156,64)";
    ctx.fillRect(X + 2, Y + 8, 1, 4); ctx.fillRect(X + 8, Y + 6, 1, 5); ctx.fillRect(X + 13, Y + 7, 1, 4);
    ctx.fillStyle = "rgb(255,215,94)";
    ctx.fillRect(X + 1, Y + 4, 3, 2); ctx.fillRect(X + 7, Y + 2, 3, 2); ctx.fillRect(X + 12, Y + 3, 3, 2);
  }
}

/* 村边池塘（2×2，水塘 + 芦苇，solid 挡路） */
function drawPond(ctx, x, y) {
  var X = x * T, Y = y * T;
  ctx.fillStyle = "rgb(70,110,60)";                         // 岸边草底
  ctx.fillRect(X, Y, T * 2, T * 2);
  ctx.fillStyle = "rgb(46,86,120)";                         // 水面（像素圆角矩形）
  ctx.fillRect(X + 1, Y + 2, T * 2 - 2, T * 2 - 4);
  ctx.fillRect(X + 2, Y + 1, T * 2 - 4, T * 2 - 2);
  ctx.fillStyle = "rgb(42,80,112)";                         // 水心
  ctx.fillRect(X + 4, Y + 4, T * 2 - 8, T * 2 - 8);
  ctx.fillStyle = "rgba(255,255,255,.25)";                  // 波纹
  ctx.fillRect(X + T - 3, Y + T - 4, 6, 1); ctx.fillRect(X + T - 2, Y + T + 2, 4, 1);
  ctx.fillStyle = "rgb(104,156,64)";                        // 芦苇
  ctx.fillRect(X + 1, Y + 10, 1, 4); ctx.fillRect(X + 2, Y + 9, 1, 4);
  ctx.fillStyle = "rgb(217,122,58)";                        // 苇穗
  ctx.fillRect(X + 1, Y + 8, 1, 2); ctx.fillRect(X + 2, Y + 7, 1, 2);
}

/* 果园果树（1×1，idx=格序号；未购/已购未种=树桩、已种未熟=绿树、已熟=挂红果） */
function drawFruitTree(ctx, x, y, idx) {
  var X = x * T, Y = y * T;
  var st = (typeof GS !== "undefined" && GS.state) ? GS.state : null;
  var planted = st && st.orchardPlanted > idx;
  if (!planted) {
    rect(ctx, X + 6, Y + 12, 4, 2, PAL.M);                  // 小树桩
    return;
  }
  rect(ctx, X + 6, Y + 10, 4, 5, PAL.M);                    // 树干
  var ripe = st.day >= st.orchardDay;
  ctx.fillStyle = ripe ? "rgb(96,156,84)" : "rgb(63,158,79)";
  ctx.fillRect(X + 3, Y + 3, 10, 5);                        // 树冠
  ctx.fillRect(X + 4, Y + 1, 8, 3);
  ctx.fillRect(X + 5, Y + 7, 6, 3);
  if (ripe) {
    ctx.fillStyle = "rgb(229,72,77)";                       // 红果
    px(ctx, X + 5, Y + 4, [229, 72, 77]); px(ctx, X + 10, Y + 3, [229, 72, 77]);
    px(ctx, X + 8, Y + 7, [229, 72, 77]); px(ctx, X + 12, Y + 6, [229, 72, 77]);
  } else {
    ctx.fillStyle = "rgb(255,215,94)";                      // 花
    px(ctx, X + 5, Y + 4, [255, 215, 94]); px(ctx, X + 10, Y + 3, [255, 215, 94]);
  }
}

/* 果园木牌（2×1，果园面板入口） */
function drawOrchardSign(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 1, Y + 5, T * 2 - 2, T - 6, PAL.m);         // 板
  rect(ctx, X + 1, Y + 5, T * 2 - 2, 3, PAL.l);
  ctx.fillStyle = "rgb(63,158,79)";                         // 叶
  ctx.fillRect(X + 3, Y + 8, 2, 3); ctx.fillRect(X + 7, Y + 7, 2, 4); ctx.fillRect(X + 11, Y + 8, 2, 3);
  ctx.fillStyle = "rgb(229,72,77)";                         // 果
  ctx.fillRect(X + 3, Y + 7, 2, 2); ctx.fillRect(X + 11, Y + 7, 2, 2);
  rect(ctx, X + T - 1, Y + 10, 2, 4, PAL.M);                // 桩
}

/* 教堂石拱门（1×1，密林教堂教义：只能用石头搭建） */
function drawChapelDoor(ctx, x, y) {
  var X = x * T, Y = y * T;
  ctx.fillStyle = "rgb(90,82,112)";                         // 石框（像素拱）
  ctx.fillRect(X + 1, Y + 2, 14, 13);
  ctx.fillRect(X + 2, Y + 1, 12, 3);
  ctx.fillRect(X + 3, Y, 10, 2);
  rect(ctx, X + 4, Y + 5, 8, 10, PAL.m);                    // 木门
  ctx.fillStyle = "rgb(139,90,43)";
  ctx.fillRect(X + 7, Y + 7, 2, 2);                         // 门环
  rect(ctx, X + 4, Y + 5, 8, 2, "rgb(74,47,29)");
}

/* 石祭坛（2×1，祈祷入口） */
function drawAltar(ctx, x, y) {
  var X = x * T, Y = y * T;
  ctx.fillStyle = "rgb(122,114,150)";                       // 石面
  ctx.fillRect(X + 1, Y + 8, T * 2 - 2, 6);
  ctx.fillStyle = "rgb(154,143,184)";
  ctx.fillRect(X + 1, Y + 8, T * 2 - 2, 2);
  rect(ctx, X + 5, Y + 13, 4, 2, "rgb(90,82,112)");         // 石柱
  rect(ctx, X + 23, Y + 13, 4, 2, "rgb(90,82,112)");
  ctx.fillStyle = "rgb(255,215,94)";                        // 烛火
  ctx.fillRect(X + 14, Y + 6, 2, 3);
  ctx.fillStyle = "rgb(229,72,77)";
  ctx.fillRect(X + 15, Y + 5, 1, 1);
}

/* 教堂彩窗（1×1，圣母精灵剪影：绿发黑瞳；光色随时段） */
function drawStainedWindow(ctx, x, y) {
  var X = x * T, Y = y * T;
  ctx.fillStyle = "rgb(26,16,37)";
  ctx.fillRect(X, Y, T, T);
  var period = (typeof GS !== "undefined" && GS.state) ? GS.state.period : "noon";
  var bg = period === "morning" ? [255, 200, 110]
    : (period === "evening" ? [120, 90, 160] : [140, 190, 230]);
  ctx.fillStyle = "rgb(" + bg.join(",") + ")";
  ctx.fillRect(X + 2, Y + 2, T - 4, T - 4);
  ctx.fillStyle = "rgb(63,158,79)";                         // 绿发
  ctx.fillRect(X + 4, Y + 4, T - 8, 4);
  ctx.fillStyle = "rgb(240,200,160)";                       // 脸
  ctx.fillRect(X + 6, Y + 7, T - 12, 3);
  ctx.fillStyle = "rgb(26,26,46)";                          // 黑瞳
  ctx.fillRect(X + 7, Y + 8, 1, 1); ctx.fillRect(X + 10, Y + 8, 1, 1);
  ctx.fillStyle = "rgb(216,180,138)";                       // 米白长袍
  ctx.fillRect(X + 5, Y + 10, T - 10, T - 12);
}

/* 教堂长椅（3×1，solid） */
function drawPew(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 1, Y + 8, T * 3 - 2, 5, PAL.m);             // 座
  rect(ctx, X + 1, Y + 8, T * 3 - 2, 2, PAL.l);
  rect(ctx, X + 3, Y + 5, 3, 4, PAL.m);                     // 靠背
  rect(ctx, X + 10, Y + 5, 3, 4, PAL.m);
  rect(ctx, X + 26, Y + 5, 3, 4, PAL.m);
  rect(ctx, X + 7, Y + 13, 2, 2, PAL.M);                    // 腿
  rect(ctx, X + 28, Y + 13, 2, 2, PAL.M);
}

/* 葡萄架（2×1，庄园远景装饰：呼应"庄园带葡萄园"） */
function drawGrapevine(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 2, Y + 10, 2, 4, PAL.m);                    // 柱
  rect(ctx, X + 28, Y + 10, 2, 4, PAL.m);
  rect(ctx, X + 1, Y + 4, T * 2 - 2, 2, PAL.l);             // 架
  ctx.fillStyle = "rgb(63,158,79)";                         // 藤叶
  ctx.fillRect(X + 3, Y + 6, 4, 3); ctx.fillRect(X + 10, Y + 6, 5, 4); ctx.fillRect(X + 19, Y + 6, 4, 3);
  ctx.fillStyle = "rgb(122,79,191)";                        // 葡萄串
  ctx.fillRect(X + 12, Y + 9, 2, 3); ctx.fillRect(X + 15, Y + 10, 2, 2);
}

/* 摇椅（1×1） */
function drawRockingChair(ctx, x, y) {
  var X = x * T, Y = y * T;
  ctx.fillStyle = "rgb(139,90,43)";
  ctx.beginPath(); ctx.moveTo(X + 2, Y + 13); ctx.quadraticCurveTo(X + 8, Y + 8, X + 14, Y + 13); ctx.fill();
  rect(ctx, X + 4, Y + 6, 8, 7, PAL.m);                  // 座
  rect(ctx, X + 4, Y + 2, 3, 5, PAL.l);                  // 靠背
  rect(ctx, X + 9, Y + 3, 2, 5, PAL.l);
  px(ctx, X + 5, Y + 4, PAL.M); px(ctx, X + 10, Y + 5, PAL.M);
}

/* 小圆桌（1×1） */
function drawRoundTable(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 2, Y + 5, T - 4, T - 6, PAL.m);
  rect(ctx, X + 2, Y + 5, T - 4, 2, PAL.l);
  px(ctx, X + 6, Y + 7, PAL.w); px(ctx, X + 9, Y + 7, PAL.w); px(ctx, X + 8, Y + 7, PAL.w);
  rect(ctx, X + 6, Y + 11, 2, 3, PAL.M);
  rect(ctx, X + 9, Y + 11, 2, 3, PAL.M);
}

/* 花瓶（1×1） */
function drawVase(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 5, Y + 6, 6, 8, PAL.w);                  // 瓷瓶
  rect(ctx, X + 5, Y + 6, 6, 2, PAL.z);
  rect(ctx, X + 4, Y + 13, 8, 1, PAL.z);
  ctx.fillStyle = "rgb(122,79,191)";                     // 紫花
  px(ctx, X + 5, Y + 3); px(ctx, X + 9, Y + 2); px(ctx, X + 11, Y + 4);
  ctx.fillStyle = "rgb(63,158,79)";
  rect(ctx, X + 7, Y + 4, 1, 3, "rgb(63,158,79)");       // 茎
  px(ctx, X + 10, Y + 5, "rgb(63,158,79)");
}

/* 灯笼架（1×1，立式） */
function drawLampstand(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 7, Y + 2, 2, 3, PAL.M);
  rect(ctx, X + 5, Y + 5, 6, 6, PAL.R);
  rect(ctx, X + 6, Y + 6, 4, 4, PAL.y);
  rect(ctx, X + 5, Y + 11, 6, 1, PAL.M);
  rect(ctx, X + 6, Y + 12, 4, 2, PAL.M);
  rect(ctx, X + 4, Y + 14, 8, 1, PAL.M);
}

/* 墙上笛子（1×1） */
function drawInstrument(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 2, Y + 3, T - 4, 2, PAL.m);              // 挂板
  rect(ctx, X + 4, Y + 5, 8, 2, PAL.l);                  // 笛身
  rect(ctx, X + 4, Y + 6, 8, 1, PAL.t);
  px(ctx, X + 6, Y + 6, PAL.M); px(ctx, X + 8, Y + 6, PAL.M); px(ctx, X + 10, Y + 6, PAL.M);
  px(ctx, X + 11, Y + 4, PAL.y);                         // 穗
  px(ctx, X + 11, Y + 5, PAL.y);
}

/* 落地镜（1×1） */
function drawMirror(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 3, Y + 2, T - 6, 10, PAL.m);             // 框
  rect(ctx, X + 4, Y + 3, T - 8, 8, [150, 190, 210]);    // 镜面
  ctx.fillStyle = "rgba(255,255,255,.4)";
  ctx.fillRect(X + 5, Y + 4, 2, 6);
  rect(ctx, X + 5, Y + 12, T - 10, 2, PAL.M);            // 底座
  px(ctx, X + 10, Y + 6, PAL.g);                         // 镜中树影
}

/* ---------------- 精灵旧屋（2026-08-18，储备角色薇拉的破屋） ---------------- */

/* 地铺（2×1，薇拉的床榻） */
function drawBedroll(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 1, Y + 7, T * 2 - 2, 7, PAL.d);          // 褥子
  rect(ctx, X + 1, Y + 7, T * 2 - 2, 2, PAL.t);          // 垫沿
  rect(ctx, X + 3, Y + 4, T - 4, 4, PAL.z);              // 旧被
  rect(ctx, X + 3, Y + 4, T - 4, 1, PAL.Z);              // 被边
}

/* 粗木桌（2×1） */
function drawTable(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 1, Y + 6, T * 2 - 2, 3, PAL.m);          // 桌面
  rect(ctx, X + 1, Y + 6, T * 2 - 2, 1, PAL.l);          // 桌沿
  rect(ctx, X + 3, Y + 9, 2, 5, PAL.M);                  // 桌腿
  rect(ctx, X + T * 2 - 5, Y + 9, 2, 5, PAL.M);
}

/* 木凳（1×1） */
function drawStool(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 3, Y + 7, T - 6, 3, PAL.m);              // 凳面
  rect(ctx, X + 4, Y + 10, 2, 4, PAL.M);                 // 腿
  rect(ctx, X + 10, Y + 10, 2, 4, PAL.M);
}

/* 接雨的盆（1×1） */
function drawBasin(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 2, Y + 8, T - 4, 5, PAL.z);              // 盆身
  rect(ctx, X + 2, Y + 8, T - 4, 1, PAL.Z);              // 盆沿
  ctx.fillStyle = "rgba(120,180,220,.5)";
  ctx.fillRect(X + 4, Y + 9, T - 8, 2);                  // 积水
  rect(ctx, X + 1, Y + 10, 1, 2, PAL.M);                 // 凳腿
  rect(ctx, X + 14, Y + 10, 1, 2, PAL.M);
}

/* 漏雨的屋瓦（2×1，墙上） */
function drawLeakyRoof(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 1, Y + 3, T * 2 - 2, 3, PAL.m);          // 屋瓦
  rect(ctx, X + 4, Y + 3, 1, 3, PAL.K);                  // 破洞
  rect(ctx, X + 10, Y + 3, 1, 3, PAL.K);
  ctx.fillStyle = "rgba(120,180,220,.6)";
  ctx.fillRect(X + 4, Y + 6, 1, 2);                      // 滴漏
  ctx.fillRect(X + 10, Y + 6, 1, 2);
}

/* 祖传银器盒（1×1） */
function drawHeirloom(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 2, Y + 5, T - 4, 6, PAL.w);              // 盒身（旧银）
  rect(ctx, X + 2, Y + 5, T - 4, 2, PAL.l);              // 盒沿
  rect(ctx, X + 4, Y + 7, T - 8, 2, PAL.Z);              // 旧纹
  rect(ctx, X + 6, Y + 6, 4, 2, PAL.y);                  // 锁扣
rect(ctx, X + 4, Y + 11, 1, 3, PAL.M);                 // 腿
	rect(ctx, X + 11, Y + 11, 1, 3, PAL.M);
}

/* 窗台的旧账本（1×1） */
function drawOldLedger(ctx, x, y) {
  var X = x * T, Y = y * T;
  rect(ctx, X + 3, Y + 6, T - 6, 6, PAL.l);              // 账本
  rect(ctx, X + 3, Y + 6, T - 6, 1, PAL.m);              // 封脊
  rect(ctx, X + 4, Y + 8, T - 8, 3, PAL.w);              // 纸页
  rect(ctx, X + 5, Y + 9, 4, 1, PAL.K);                  // 字行
  rect(ctx, X + 9, Y + 10, 3, 1, PAL.K);
}

/* ================ 🆕 精灵表（Sprite Sheet）系统 ================
 * 支持从 PNG 精灵表切图绘制角色，替代程序化像素小人。
 * 若某个角色加载了精灵表 → 优先用表，否则回退到 buildChar。 */

/** 精灵表注册表：{ charKey: { img, cols, rows, fw, fh, dirMap } } */
var SPRITE_SHEETS = {};

/** 加载一张精灵表
 *  @param charKey  — 角色键（如 "player"/"boss"）
 *  @param url      — 相对于 index.html 的路径（如 "assets/characters/player.png"）
 *  @param opts     — 可选 { fw, fh, cols, rows, dirRows }
 *    fw/fh: 每帧像素宽高（默认 32/32）
 *    cols:   每行帧数（默认 4，对应 down/left/right/up）
 *    rows:   总行数（默认 4）
 *    dirRow: 方向映射 { down:0, left:1, right:2, up:3 }（默认 LPC 格式）
 */
function loadSpriteSheet(charKey, url, opts) {
  opts = opts || {};
  var img = new Image();
  img.onload = function () {
    SPRITE_SHEETS[charKey] = {
      img: img,
      fw: opts.fw || 32,
      fh: opts.fh || 32,
      cols: opts.cols || 4,
      rows: opts.rows || 4,
      dirRow: opts.dirRow || { down: 0, left: 1, right: 2, up: 3 }
    };
  };
  img.onerror = function () {
    console.warn("sprites: 加载精灵表失败", url);
  };
  img.src = url;
}

/** 从精灵表绘制角色（带方向+帧动画）；无表时回退到程序化绘制 */
function drawSpriteSheetChar(ctx, charKey, x, y, dir, frame) {
  var sheet = SPRITE_SHEETS[charKey];
  if (!sheet) {
    // 回退：用程序化角色
    drawPixels(ctx, charFrame(charKey, dir, frame), x, y);
    return;
  }
  var ri = sheet.dirRow[dir] || 0;
  var ci = (frame || 0) % sheet.cols;
  ctx.drawImage(sheet.img,
    ci * sheet.fw, ri * sheet.fh, sheet.fw, sheet.fh,
    Math.round(x), Math.round(y), sheet.fw, sheet.fh
  );
}

/** 获取精灵表头像（用于对话框），无表时回退到程序化 buildPortrait */
function drawSpriteSheetPortrait(ctx, charKey, canvas, scale) {
  var sheet = SPRITE_SHEETS[charKey];
  if (!sheet) {
    // 回退到程序化头像
    var spr = buildPortrait(charKey);
    canvas.width = spr.w; canvas.height = spr.h;
    var img = ctx.createImageData(spr.w, spr.h);
    img.data.set(spr.data);
    ctx.putImageData(img, 0, 0);
    canvas.style.width = (spr.w * (scale || 3)) + "px";
    canvas.style.height = (spr.h * (scale || 3)) + "px";
    return;
  }
  // 从精灵表切第一帧（down 方向第一帧）作为头像
  var s = scale || 3;
  var fw = sheet.fw, fh = sheet.fh;
  canvas.width = fw; canvas.height = fh;
  ctx.drawImage(sheet.img, 0, 0, fw, fh, 0, 0, fw, fh);
  canvas.style.width = (fw * s) + "px";
  canvas.style.height = (fh * s) + "px";
}

/** 辅助：获取角色的程序化绘制帧（回退用） */
function charFrame(charKey, dir, frame) {
  var c = CHARS[charKey] || CHARS.player;
  if (!c) return null;
  var frames = c[dir] || c.down;
  return frames[frame || 0] || frames[0];
}

/* ================ 🆕 HD 像素增强系统（2026-08-18） ================
 * 将 16×16 程序化角色 → 32×32 精致像素（算法增强，非盲画）。
 * 原理：以现有角色数据为参考，用像素艺术算法进行智能缩放 + 颜色过渡。 */

/** 像素缩放因子（1 = 保持原尺寸仅加光影，2 = 2x 放大给头像用） */
var HD_SCALE = 1;

/** 为每个方向生成颜色过渡表（阴影→中间色→高光） */
function buildColorRamp(baseColor) {
  var r = baseColor[0], g = baseColor[1], b = baseColor[2];
  // 生成 5 级颜色：从暗到亮
  var ramp = [];
  for (var i = 0; i < 5; i++) {
    var t = i / 4;
    var dark = 0.6 + t * 0.4;  // 60% → 100% 亮度范围
    ramp.push([
      Math.min(255, Math.round(r * dark)),
      Math.min(255, Math.round(g * dark)),
      Math.min(255, Math.round(b * dark))
    ]);
  }
  return ramp;
}

/** 缓存已生成的 HD 精灵 */
var HD_CACHE = {};

/** 生成 HD 版角色精灵（2x~3x 缩放 + 颜色过渡）
 *  @param spr  — 原始像素缓冲（16×16 角色帧）
 *  @param pal  — 该帧的颜色映射表 { colorIndex: rampLevel }，用于确定光照方向
 *  @returns    — 新的像素缓冲（HD_SCALE × 原始尺寸）
 */
function hdSprite(spr, pal) {
  var key = "hd_" + spr.id + "_" + HD_SCALE;
  if (HD_CACHE[key]) return HD_CACHE[key];
  var s = HD_SCALE;
  var w = spr.w * s, h = spr.h * s;
  var data = new Array(w * h * 4);
  // 1) 最近邻缩放（保留像素边缘清晰）
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var sx = Math.floor(x / s), sy = Math.floor(y / s);
      var si = (sy * spr.w + sx) * 4;
      var di = (y * w + x) * 4;
      data[di] = spr.data[si];
      data[di + 1] = spr.data[si + 1];
      data[di + 2] = spr.data[si + 2];
      data[di + 3] = spr.data[si + 3];
    }
  }
  // 2) 颜色过渡：对非透明像素做简易光照渐变
  //    从顶部（亮）到底部（暗），模拟顶光
  for (var y = 0; y < h; y++) {
    var lightT = 1 - y / h;  // 顶部亮，底部暗
    for (var x = 0; x < w; x++) {
      var di = (y * w + x) * 4;
      if (data[di + 3] < 128) continue;  // 跳过透明
      // 轻微调整亮度（顶部亮一点，底部暗一点）
      var adjust = 0.85 + lightT * 0.3;
      data[di] = Math.min(255, Math.round(data[di] * adjust));
      data[di + 1] = Math.min(255, Math.round(data[di + 1] * adjust));
      data[di + 2] = Math.min(255, Math.round(data[di + 2] * adjust));
    }
  }
  var result = { id: ++SPRITE_ID, w: w, h: h, data: data };
  HD_CACHE[key] = result;
  return result;
}

/** 覆写 drawPixels：当 HD_SCALE > 0 时自动使用 HD 版绘制 */
var _origDrawPixels = drawPixels;
drawPixels = function (ctx, spr, x, y, flip) {
  if (HD_SCALE > 0 && spr && spr.w <= 16) {
    spr = hdSprite(spr);
  }
  _origDrawPixels(ctx, spr, x, y, flip);
};

/* ================ 🆕 LPC 角色组装系统（2026-08-18） ================
 * 用 LPC 精灵组件（身体/头/发型/腿/鞋子）合成完整角色。
 * 每个组件是 32×32 4×4 精灵表（4方向×4帧）。
 * 组件 PNG 在 assets/characters/ 目录下。 */

/** LPC 组件注册表 */
var LPC = {
  images: {},   // 已加载的组件图片
  ready: false, // 全部加载完成？
  presets: {},  // 角色预设
  _cb: null,    // 加载完成回调
};

/** 定义 LPC 角色预设（哪些组件拼成什么角色） */
LPC.def = function (charKey, parts) {
  LPC.presets[charKey] = parts;
};

/** 加载 LPC 组件 PNG（从 base64 内嵌数据，不依赖 HTTP） */
LPC.load = function (callback) {
  LPC._cb = callback || null;
  if (typeof LPC_DATA === "undefined") {
    console.warn("LPC: LPC_DATA 未定义，跳过加载");
    if (LPC._cb) { LPC.ready = true; LPC._cb(); }
    return;
  }
  var pending = 0;
  Object.keys(LPC_DATA).forEach(function (key) {
    var img = new Image();
    img.onload = function () { pending--; if (pending <= 0 && LPC._cb) { LPC.ready = true; LPC._cb(); } };
    img.onerror = function () { pending--; };
    LPC.images[key] = img;
    img.src = LPC_DATA[key];
    pending++;
  });
  if (pending === 0) { LPC.ready = true; if (LPC._cb) LPC._cb(); }
};

/** 从精灵表切一帧（2026-08-18 修复：64×64 帧, 13 列, 方向 up/left/down/right, walk 行偏移 8） */
LPC.frame = function (img, dir, frame, fw, fh) {
  fw = fw || 64; fh = fh || 64;
  var cols = 13; // 每行 13 帧
  var dirRow = { up: 0, left: 1, down: 2, right: 3 };
  // 行走动画在第 8-11 行（walk 块），其他块暂不用
  var blockStart = 8; // walk 块起始行
  var ri = blockStart + (dirRow[dir] || 0);
  var ci = (frame || 0);
  if (ci >= cols) ci = ci % cols;
  var c = document.createElement("canvas");
  c.width = fw; c.height = fh;
  var ctx = c.getContext("2d");
  ctx.drawImage(img, ci * fw, ri * fh, fw, fh, 0, 0, fw, fh);
  return c;
};

/** 组装一个角色帧（多个组件叠在一起，64×64 输出）
 * 带缓存：按 charKey+dir+frame 缓存合成结果，避免每帧重建（手机性能优化） */
LPC._frameCache = {};
LPC.assemble = function (charKey, dir, frame) {
  var preset = LPC.presets[charKey] || LPC.presets.player;
  if (!preset) return null;
  var ck = charKey + "|" + (dir || "down") + "|" + (frame || 0);
  if (LPC._frameCache[ck]) return LPC._frameCache[ck];
  var fw = 64, fh = 64;
  var c = document.createElement("canvas");
  c.width = fw; c.height = fh;
  var ctx = c.getContext("2d");
  // 按 LPC zPos 层级绘制（body10 < legs20 < dress30/robe35/bodice45/chainmail50）：
  // 衣服/裙子画在腿之上、身体之下层，才能盖住腿露出裙摆
  var order = ["body", "legs", "feet", "chest", "head", "ears", "hair", "facial", "eyes"];
  order.forEach(function (layer) {
    var key = preset[layer];
    if (!key) return;
    var img = LPC.images[key];
    if (!img) return;
    var fc = LPC.frame(img, dir, frame, fw, fh);
    ctx.drawImage(fc, 0, 0);
  });
  LPC._frameCache[ck] = c;
  return c;
};

/** 绘制 LPC 角色到游戏画布（64→32 半缩，占 2×2 格，脚锚定格底） */
function drawLPCChar(ctx, charKey, x, y, dir, frame) {
  if (!LPC.ready) {
    drawPixels(ctx, charFrame(charKey, dir || "down", frame || 0), Math.round(x), Math.round(y));
    return;
  }
  var c = LPC.assemble(charKey, dir || "down", frame || 0);
  if (c) ctx.drawImage(c, Math.round(x), Math.round(y), 32, 32);
}

/** 绘制 LPC 对话头像（64×64 全身，显示 2× 放大） */
function drawLPCPortrait(ctx, charKey, canvas, scale) {
  if (!LPC.ready) {
    drawSpriteSheetPortrait(ctx, charKey, canvas, scale || 3);
    return;
  }
  var c = LPC.assemble(charKey, "down", 0);
  if (!c) return;
  var s = scale || 2;
  canvas.width = 64; canvas.height = 64;
  ctx.drawImage(c, 0, 0);
  canvas.style.width = (64 * s) + "px";
  canvas.style.height = (64 * s) + "px";
}

/** 🆕 绘制 LPC 大头像（仅头部+发型，裁切放大） */
function drawLPCHeadshot(ctx, charKey, canvas, scale) {
  if (!LPC.ready) {
    drawLPCPortrait(ctx, charKey, canvas, scale || 3);
    return;
  }
  var preset = LPC.presets[charKey] || LPC.presets.player;
  if (!preset) return;
  var fw = 64, fh = 64;
  var c = document.createElement("canvas");
  c.width = fw; c.height = fh;
  var ctx2 = c.getContext("2d");
  // 只画头部和发型（不画身体），让脸占满画面
  ["head", "hair", "eyes"].forEach(function (layer) {
    var key = preset[layer];
    if (!key) return;
    var img = LPC.images[key];
    if (!img) return;
    var fc = LPC.frame(img, "down", 0, fw, fh);
    ctx2.drawImage(fc, 0, 0);
  });
  // 裁切头部区域（x20-43, y14-36），放大 3×
  var sx = 18, sy = 12, sw = 28, sh = 28;
  var s = scale || 3;
  canvas.width = sw; canvas.height = sh;
  ctx.drawImage(c, sx, sy, sw, sh, 0, 0, sw, sh);
  canvas.style.width = (sw * s) + "px";
  canvas.style.height = (sh * s) + "px";
}

/* ---------- LPC 角色预设（按背景设定.md 配置性别/种族/年龄/衣着） ----------
 * 2026-08-19 全面差异化：精灵加 ears_elven，女性用 *_female 体，老人用 *_elderly，
 * 老板/渔夫/牧师等加胡子(facial)，按职业配衣服颜色。 */
LPC.def("player",   { body: "body_male_light", head: "head_male_light", chest: "chest_shirt_blue", legs: "legs", feet: "feet", hair: "bangs" });
LPC.def("boss",     { body: "body_male_light", head: "head_male_plump", chest: "chest_leather_black", legs: "legs", feet: "feet", hair: "hair_plain_darkbrown", facial: "beard_trimmed_darkbrown" });
LPC.def("drunk",    { body: "body_male_light", head: "head_male_light", chest: "chest_shirt_green", legs: "legs", feet: "feet", hair: "bangs", facial: "beard_shadow_lightbrown" });
LPC.def("villager", { body: "body_female_light", head: "head_female_light", chest: "chest_shirt_female_red", legs: "legs", feet: "feet", hair: "long_female" });
LPC.def("merchant", { body: "body_male_light", head: "head_male_light", chest: "collared_purple", legs: "legs", feet: "feet", hair: "hair_plain_darkbrown" });
LPC.def("rita",     { body: "body_female_light", head: "head_female_light", chest: "dress_sash_purple", legs: "legs", feet: "feet", hair: "hair_bangs_carrot" });
LPC.def("billy",    { body: "body_male_light", head: "head_male_light", ears: "ears_elven", chest: "chest_long_navy", legs: "legs", feet: "feet", hair: "hair_plain_blonde" });
LPC.def("tommy",    { body: "body_male_light", head: "head_male_light", chest: "chest_shirt_brown", legs: "legs", feet: "feet", hair: "bangs" });
LPC.def("will",     { body: "body_male_light", head: "head_male_light", chest: "chest_shirt_red", legs: "legs", feet: "feet", hair: "bangs" });
LPC.def("higg",     { body: "body_male_light", head: "head_male_elderly", chest: "collared_gray", legs: "legs", feet: "feet", hair: "hair_plain_gray", facial: "beard_basic_gray" });
LPC.def("mark",     { body: "body_male_light", head: "head_male_light", chest: "chest_shirt_green", legs: "legs", feet: "feet", hair: "hair_plain_darkbrown" });
LPC.def("mary",     { body: "body_female_light", head: "head_female_light", chest: "chest_shirt_female_orange", legs: "legs", feet: "feet", hair: "long_female" });
LPC.def("anna",     { body: "body_female_light", head: "head_female_light", chest: "chest_shirt_female_yellow", legs: "legs", feet: "feet", hair: "bangs_female" });
LPC.def("fisher",   { body: "body_male_light", head: "head_male_elderly", chest: "chest_shirt_blue", legs: "legs", feet: "feet", hair: "hair_plain_white", facial: "beard_winter_white" });
LPC.def("farmer",   { body: "body_male_light", head: "head_male_light", chest: "chest_shirt_green", legs: "legs", feet: "feet", hair: "hair_plain_gray" });
LPC.def("guard",    { body: "body_male_light", head: "head_male_light", chest: "chainmail_gray", legs: "legs", feet: "feet", hair: "bangs" });
LPC.def("al",       { body: "body_male_light", head: "head_male_light", chest: "chest_shirt_brown", legs: "legs", feet: "feet", hair: "hair_plain_darkbrown" });
LPC.def("robert",   { body: "body_male_light", head: "head_male_light", chest: "trench_gray", legs: "legs", feet: "feet", hair: "hair_plain_gray" });
LPC.def("gardener", { body: "body_male_light", head: "head_male_elderly", ears: "ears_elven", chest: "chest_shirt_green", legs: "legs", feet: "feet", hair: "hair_plain_white", facial: "beard_winter_white" });
LPC.def("priest",   { body: "body_male_light", head: "head_male_elderly", ears: "ears_elven", chest: "frock_white", legs: "legs", feet: "feet", hair: "hair_plain_white", facial: "beard_basic_white" });
LPC.def("lord",     { body: "body_male_light", head: "head_male_light", ears: "ears_elven", chest: "frock_purple", legs: "legs", feet: "feet", hair: "hair_plain_gold" });
LPC.def("vera",     { body: "body_female_light", head: "head_female_light", ears: "ears_elven", chest: "corset_slate", legs: "legs", feet: "feet", hair: "hair_long_gray" });
LPC.def("husk",     { body: "body_male_light", head: "head_male_light", chest: "collared_brown", legs: "legs", feet: "feet", hair: "hair_plain_darkbrown" });

/* ================ 🆕 Kenney 瓦片贴图系统（2026-08-19） ================
 * 用 Kenney Tiny Town / Tiny Dungeon 瓦片集替换程序化场景绘制。
 * 瓦片从 tilemap.png 切出（12×11 格，16px/格，1px 间距）。
 * 场景函数优先用瓦片，无瓦片时回退到程序化绘制。 */

var TILES = {
  imgs: {},    // 已加载的 tilemap 图
  loaded: {},  // 已切好的瓦片 canvas 数组
  ready: {}    // 该包是否就绪
};

/** 加载一个瓦片包（town/dungeon）并切出 132 个瓦片 */
function loadTilePack(pack) {
  if (TILES.loaded[pack]) { TILES.ready[pack] = true; return; }
  var img = new Image();
  img.onload = function () {
    var tiles = [];
    for (var i = 0; i < 132; i++) {
      var c = i % 12, r = Math.floor(i / 12);
      var cv = document.createElement("canvas");
      cv.width = 16; cv.height = 16;
      var cctx = cv.getContext("2d");
      cctx.drawImage(img, c * 17, r * 17, 16, 16, 0, 0, 16, 16);
      tiles.push(cv);
    }
    TILES.loaded[pack] = tiles;
    TILES.ready[pack] = true;
    console.log("tiles: " + pack + " 就绪（132 瓦片）");
  };
  img.onerror = function () { console.warn("tiles: 加载失败 " + pack); };
  img.src = "assets/tiles/" + pack + "/Tilemap/tilemap.png";
}

/** 绘制一个瓦片；成功返回 true，未就绪返回 false */
function drawTile(ctx, pack, idx, x, y) {
  var tiles = TILES.loaded[pack];
  if (!tiles || idx === undefined) return false;
  var t = tiles[idx];
  if (!t) return false;
  ctx.drawImage(t, Math.round(x), Math.round(y));
  return true;
}

/** 从一组瓦片里选一个（按位置伪随机，避免重复） */
function tilePick(arr, x, y) {
  if (!arr || !arr.length) return undefined;
  return arr[(x * 7 + y * 13 + Math.floor(x / 2) * 3) % arr.length];
}

/* Kenney 瓦片映射表（第一版，按颜色分类；可调整编号） */
var TILE_MAP = {
  grass:     [0, 1, 2],       // 草地基础色
  grassFlower:[4, 5, 6],      // 草地带花/细节
  dirt:      [9, 10, 11],     // 泥土地
  path:      [12, 13, 14],    // 土路/砂石路
  wood:      [24, 25, 26],    // 木板/木平台
  water:     [48, 49, 50],    // 水面
  waterEdge: [60, 61, 62],    // 水边
  wall:      [72, 73, 74],    // 建筑墙（推测）
  roof:      [84, 85, 86],    // 屋顶（推测）
};
