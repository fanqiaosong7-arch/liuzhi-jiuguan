/* engine.js — 像素引擎：场景渲染、角色移动/碰撞、NPC 游走、交互提示
 * 依赖：sprites.js（T/draw*）、maps.js（SCENES/SCENE_NPCS） */
"use strict";

/* 田格状态文案（第 idx+1 块田：空闲/已种/待收） */
function plotStateText(p, idx) {
  if (p.planted > idx) return p.day >= p.harvestDay ? "熟了可收" : "麦子正在长";
  return "空闲";
}

var Engine = {
  canvas: null,
  ctx: null,
  sceneName: null,
  scene: null,
  player: null,
  npcs: [],
  keys: {},
  prompt: null,          // 当前可交互对象
  overlayOpen: false,
  lastTime: 0,
  rafId: null,
  PLAYER_SPEED: 3.6,     // 格/秒
  NPC_SPEED: 1.1,
  INTERACT_RANGE: 1.55,  // 格

  init: function () {
    this.canvas = document.getElementById("game");
    this.ctx = this.canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    // 交互提示气泡：用 DOM（清晰），不再画在低分辨率 canvas 上
    this.promptEl = null;
    if (typeof document !== "undefined" && document.body && document.createElement) {
      this.promptEl = document.createElement("div");
      this.promptEl.id = "prompt-bubble";
      document.body.appendChild(this.promptEl);
    }
    var self = this;
    window.addEventListener("keydown", function (e) { self.onKeyDown(e); });
    window.addEventListener("keyup", function (e) { self.keys[e.key.toLowerCase()] = false; });
    this.lastTime = performance.now();
    var loop = function (t) {
      var dt = Math.min(0.05, (t - self.lastTime) / 1000);
      self.lastTime = t;
      self.update(dt);
      self.render();
      self.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  },

  onKeyDown: function (e) {
    var k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].indexOf(k) >= 0) e.preventDefault();
    this.keys[k] = true;
    if (this.overlayOpen) return;
    if (k === "e" || k === "enter") {
      this.interact();
    } else if (k === "escape") {
      if (typeof G.UI !== "undefined") G.UI.pauseMenu();
    }
  },

  /* ---------- 场景切换 ---------- */
  setScene: function (name) {
    this.sceneName = name;
    var sc = SCENES[name];
    // 房间：拼入已购家具（不污染 SCENES 数据）
    var objects = sc.objects.slice();
    // 农田：仓库未建成时不显示也不挡路
    if (name === "farmland" && typeof GS !== "undefined" && GS.state && GS.state.warehouse !== 2) {
      objects = objects.filter(function (o) { return o.id !== "warehouse"; });
    }
    // 农田：按已购数量拼入田格（前 farmland 块显示为田，其余为荒地；可交互查看）
    if (name === "farmland" && typeof GS !== "undefined" && GS.state) {
      FARMLAND_PLOTS.forEach(function (pos, idx) {
        var owned = GS.state.farmland > idx;
        objects.push({
          id: "plot", x: pos.x, y: pos.y, w: 1, h: 1, solid: false, idx: idx,
          label: owned ? ("第 " + (idx + 1) + " 块田 · " + plotStateText(GS.state, idx)) : "荒地 · 可买",
          action: "plot_talk",
        });
      });
    }
    if (name === "room" && typeof GS !== "undefined" && GS.state) {
      objects = objects.concat(furnitureObjects(GS.state.furniture));
      // 鱼标本（墙上最多 2 条）
      (GS.state.trophies || []).forEach(function (fishName, idx) {
        objects.push({ id: "trophy", x: 15 + idx, y: 0, w: 1, h: 1, solid: false,
          label: "鱼标本：" + fishName, action: "trophy_talk" });
      });
    }
    this.scene = {
      name: sc.name, w: sc.w, h: sc.h, floor: sc.floor, grid: sc.grid,
      spawn: sc.spawn, spawnDir: sc.spawnDir, objects: objects,
    };
    this.canvas.width = this.scene.w * T;
    this.canvas.height = this.scene.h * T;
    var aspect = this.scene.w / this.scene.h;
    this.canvas.style.aspectRatio = String(aspect);
    this.canvas.style.width = "min(96vw, calc(96vh * " + aspect + "))";
    // 出生点
    var s = this.scene.spawn;
    this.player = { x: s.x + 0.5, y: s.y + 0.5, dir: this.scene.spawnDir || "down", moving: false, animT: 0 };
    // NPC：常驻 + 当天随机访客（大厅最多 7 位可对话 NPC）
    var npcDefs = (SCENE_NPCS[name] || []).slice();
    if (name === "lobby" && typeof GS !== "undefined" && GS.state && GS.state.visitors) {
      GS.state.visitors.forEach(function (vid) {
        var v = GS.visitorById(vid);
        var anchor = VISITOR_ANCHORS[vid];
        if (v && anchor) npcDefs.push({ id: vid, char: v.char, anchor: anchor, radius: anchor.radius || 3 });
      });
    }
    this.npcs = npcDefs.map(function (d) {
      return {
        def: d,
        char: d.char,
        x: d.anchor.x + 0.5 + (Math.random() * 2 - 1) * 0.4,
        y: d.anchor.y + 0.5 + (Math.random() * 2 - 1) * 0.4,
        dir: "down", moving: false, animT: 0,
        state: "idle", timer: Math.random() * 1.5,
        tx: null, ty: null,
      };
    });
    this.prompt = null;
    if (typeof G.UI !== "undefined") G.UI.updateHud();
  },

  /* ---------- 碰撞 ---------- */
  isSolidTile: function (tx, ty) {
    var g = this.scene.grid;
    if (tx < 0 || ty < 0 || tx >= this.scene.w || ty >= this.scene.h) return true;
    var tc = g[ty].charAt(tx);
    if (tc === "#" || tc === "~") return true;
    for (var i = 0; i < this.scene.objects.length; i++) {
      var o = this.scene.objects[i];
      if (!o.solid) continue;
      if (tx >= o.x && tx < o.x + o.w && ty >= o.y && ty < o.y + o.h) return true;
    }
    return false;
  },

  canStand: function (x, y) {
    var r = 0.3;
    var x0 = Math.floor(x - r), x1 = Math.floor(x + r);
    var y0 = Math.floor(y - r), y1 = Math.floor(y + r);
    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) {
        if (this.isSolidTile(tx, ty)) return false;
      }
    }
    return true;
  },

  moveEntity: function (ent, dx, dy, speed, dt) {
    var nx = ent.x + dx * speed * dt;
    if (this.canStand(nx, ent.y)) ent.x = nx;
    var ny = ent.y + dy * speed * dt;
    if (this.canStand(ent.x, ny)) ent.y = ny;
  },

  /* ---------- 更新 ---------- */
  update: function (dt) {
    if (this.overlayOpen || !this.player) return;
    var p = this.player;
    var dx = 0, dy = 0;
    if (this.keys["w"] || this.keys["arrowup"]) dy -= 1;
    if (this.keys["s"] || this.keys["arrowdown"]) dy += 1;
    if (this.keys["a"] || this.keys["arrowleft"]) dx -= 1;
    if (this.keys["d"] || this.keys["arrowright"]) dx += 1;
    p.moving = (dx !== 0 || dy !== 0);
    if (p.moving) {
      if (Math.abs(dx) > Math.abs(dy)) p.dir = dx < 0 ? "left" : "right";
      else p.dir = dy < 0 ? "up" : "down";
      this.moveEntity(p, dx, dy, this.PLAYER_SPEED, dt);
      p.animT += dt;
    }
    // NPC 游走
    for (var i = 0; i < this.npcs.length; i++) this.updateNpc(this.npcs[i], dt);
    // 随机 NPC 闲谈（每 7~15 秒）：约四成概率触发 NPC 间互动对话，否则单句闲谈
    if (this.npcs.length && typeof GS !== "undefined" && GS.state) {
      this.speechTimer = (this.speechTimer || 0) - dt;
      if (this.speechTimer <= 0) {
        this.speechTimer = 7 + Math.random() * 8;
        var played = false;
        if (typeof NPC_INTERACT !== "undefined" && this.npcs.length >= 2 && Math.random() < 0.4) {
          var ia = Math.floor(Math.random() * this.npcs.length);
          var ib = Math.floor(Math.random() * this.npcs.length);
          if (ia !== ib) {
            var script = this.interactScript(this.npcs[ia].def.id, this.npcs[ib].def.id);
            if (script) { this.playInteract(script); played = true; }
          }
        }
        if (!played) {
          var n = this.npcs[Math.floor(Math.random() * this.npcs.length)];
          var text = smalltalkFor(n.def.id, GS.state.period, GS.state.mood, GS.state.reputation);
          if (typeof UI !== "undefined" && UI.speech) UI.speech(text, 2600);
        }
      }
    }
    this.prompt = this.findInteract();
  },

  /* NPC 间互动对话脚本：按 "idA-idB"（双向）查 NPC_INTERACT（progress.js） */
  interactScript: function (idA, idB) {
    if (typeof NPC_INTERACT === "undefined") return null;
    return NPC_INTERACT[idA + "-" + idB] || NPC_INTERACT[idB + "-" + idA] || null;
  },

  /* 依次播报对话行（逐句显示在台词条，模拟 A 说 B 回） */
  playInteract: function (script) {
    if (typeof UI === "undefined" || !UI.speech) return;
    var ttl = 2800;
    for (var i = 0; i < script.length; i++) {
      (function (idx) {
        setTimeout(function () { UI.speech(script[idx], ttl); }, idx * (ttl + 600));
      })(i);
    }
  },

  updateNpc: function (n, dt) {
    if (n.state === "idle") {
      n.timer -= dt;
      if (n.timer <= 0) {
        var d = n.def;
        // 在锚点半径内找一块空地
        for (var tries = 0; tries < 12; tries++) {
          var tx = Math.round(d.anchor.x + (Math.random() * 2 - 1) * d.radius);
          var ty = Math.round(d.anchor.y + (Math.random() * 2 - 1) * d.radius);
          if (tx >= 1 && ty >= 1 && tx < this.scene.w - 1 && ty < this.scene.h - 1 && this.canStand(tx + 0.5, ty + 0.5)) {
            n.tx = tx + 0.5; n.ty = ty + 0.5;
            n.state = "walk";
            break;
          }
        }
        if (n.state === "idle") n.timer = 0.8;
      }
    } else { // walk
      var ex = n.tx - n.x, ey = n.ty - n.y;
      var dist = Math.sqrt(ex * ex + ey * ey);
      if (dist < 0.06) {
        n.state = "idle";
        n.timer = 1 + Math.random() * 2;
        n.moving = false;
      } else {
        n.moving = true;
        if (Math.abs(ex) > Math.abs(ey)) n.dir = ex < 0 ? "left" : "right";
        else n.dir = ey < 0 ? "up" : "down";
        this.moveEntity(n, ex / dist, ey / dist, this.NPC_SPEED, dt);
        n.animT += dt;
      }
    }
  },

  /* ---------- 交互（场景对象 + 可对话 NPC） ---------- */
  findInteract: function () {
    var p = this.player;
    var best = null, bestD = this.INTERACT_RANGE;
    for (var i = 0; i < this.scene.objects.length; i++) {
      var o = this.scene.objects[i];
      if (!o.action) continue;
      var cx = Math.max(o.x, Math.min(p.x, o.x + o.w));
      var cy = Math.max(o.y, Math.min(p.y, o.y + o.h));
      var dx = p.x - cx, dy = p.y - cy;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { bestD = d; best = o; }
    }
    // 靠近 NPC 也能说话（距离更近时优先于场景对象）
    for (var k = 0; k < this.npcs.length; k++) {
      var n = this.npcs[k];
      var dx2 = p.x - n.x, dy2 = p.y - n.y;
      var d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      if (d2 < bestD) { bestD = d2; best = { npc: n }; }
    }
    return best;
  },

  interact: function () {
    var o = this.findInteract();
    if (!o) return;
    if (o.npc) {
      if (typeof G.ACTIONS !== "undefined" && G.ACTIONS.npc_talk) G.ACTIONS.npc_talk(o.npc);
      return;
    }
    if (o.action && typeof G.ACTIONS !== "undefined" && G.ACTIONS[o.action]) {
      G.ACTIONS[o.action](o);
    }
  },

  /* ---------- 渲染 ---------- */
  render: function () {
    if (!this.scene) return;
    var ctx = this.ctx;
    var sc = this.scene;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 地面与墙
    for (var y = 0; y < sc.h; y++) {
      for (var x = 0; x < sc.w; x++) {
        var c = sc.grid[y].charAt(x);
        if (c === "#") {
          if (sc.floor === "grass") drawBush(ctx, x, y);
          else drawWall(ctx, x, y);
        } else if (c === "~") drawRiver(ctx, x, y);
        else if (c === "F") drawField(ctx, x, y);
        else if (sc.floor === "wood") drawFloor(ctx, x, y, x + y);
        else if (sc.floor === "stone") drawLobbyFloor(ctx, x, y);
        else drawGrass(ctx, x, y);
      }
    }
    // 实体对象（家具/碰撞物）——先画半透明地面投影（2026-08-18 美化）
    for (var i = 0; i < sc.objects.length; i++) {
      var o = sc.objects[i];
      if (o.solid) { this.drawObjectShadow(o); this.drawObject(o); }
    }
    // 装饰（非实体，画在实体之上）
    for (var j = 0; j < sc.objects.length; j++) {
      var o2 = sc.objects[j];
      if (!o2.solid) this.drawObject(o2);
    }
    // NPC（按 y 排序）与玩家
    var chars = this.npcs.slice().sort(function (a, b) { return a.y - b.y; });
    for (var k = 0; k < chars.length; k++) this.drawChar(chars[k]);
    this.drawChar(this.player);
    // 交互提示气泡
    this.drawPrompt();
    // 时段色调（早晨暖、晚上暗蓝）
    if (typeof GS !== "undefined" && GS.state) {
      var tint = GS.periodInfo(GS.state).tint;
      if (tint && tint !== "rgba(255,255,255,0)") {
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  },

  /* 对象地面投影（半透明椭圆，落在对象底部）2026-08-18 美化
   * 不用 ctx.ellipse（node 无头 canvas mock 缺该方法），用缩放 arc 画椭圆 */
  drawObjectShadow: function (o) {
    var ctx = this.ctx;
    var w = o.w || 1, h = o.h || 1;
    var X = (o.x + w / 2) * T, Y = (o.y + h) * T;
    ctx.save();
    ctx.translate(X, Y + 2);
    ctx.scale(1, 0.28);
    ctx.fillStyle = "rgba(0,0,0,.20)";
    ctx.beginPath();
    ctx.arc(0, 0, w * T * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  drawObject: function (o) {
    var ctx = this.ctx, x = o.x, y = o.y;
    switch (o.id) {
      case "bed": drawBed(ctx, x, y); break;
      case "bedside": drawBedsideTable(ctx, x, y); break;
      case "door": drawDoor(ctx, x, y - 1); break;
      case "window":
        drawWindow(ctx, x, y, (typeof GS !== "undefined" && GS.state) ? GS.state.period : "evening");
        break;
      case "poster": drawPoster(ctx, x, y, o.kind); break;
      case "rug": drawRug(ctx, x, y); break;
      case "lantern": drawLantern(ctx, x, y); break;
      case "bar":
        for (var i = 0; i < o.w; i++) drawBar(ctx, x + i, y);
        break;
      case "barrel": drawBarrel(ctx, x, y); break;
      case "mug": drawMug(ctx, x, y); break;
      case "bjtable": drawBJTable(ctx, x, y); break;
      case "pokertable": drawPokerTable(ctx, x, y); break;
      case "ddztable": drawDDZTable(ctx, x, y); break;
      case "unotable": drawUNOTable(ctx, x, y); break;
      case "pongtable": drawPongTable(ctx, x, y); break;
      case "chair": drawChair(ctx, x, y, o.dir || "up"); break;
      case "cabinet": drawSnakeCabinet(ctx, x, y); break;
      case "desk": drawDesk(ctx, x, y); break;
      case "sign": drawSign(ctx, x, y); break;
      case "calendar": drawCalendar(ctx, x, y); break;
      /* 商店家具 */
      case "desk2": drawDesk2(ctx, x, y); break;
      case "bookshelf": drawBookshelf(ctx, x, y); break;
      case "wardrobe": drawWardrobe(ctx, x, y); break;
      case "chest": drawChest(ctx, x, y); break;
      case "plant": drawPlant(ctx, x, y); break;
      case "painting": drawPainting(ctx, x, y); break;
      case "candle": drawCandle(ctx, x, y); break;
      case "rug2": drawRug2(ctx, x, y); break;
      case "rocking": drawRockingChair(ctx, x, y); break;
      case "roundtable": drawRoundTable(ctx, x, y); break;
      case "vase": drawVase(ctx, x, y); break;
      case "lampstand": drawLampstand(ctx, x, y); break;
      case "instrument": drawInstrument(ctx, x, y); break;
      case "mirror": drawMirror(ctx, x, y); break;
      /* 户外 */
      case "tree": drawTree(ctx, x, y); break;
      case "mailbox": drawMailbox(ctx, x, y); break;
      case "fishing": drawFishingSpot(ctx, x, y); break;
      case "manor_gate": drawManorGate(ctx, x, y); break;
      case "manor_wall": drawManorWall(ctx, x, y); break;
      case "scarecrow": drawScarecrow(ctx, x, y); break;
      case "road_sign": drawRoadSign(ctx, x, y); break;
      case "trophy": drawFishTrophy(ctx, x, y); break;
      case "al_stand": drawFarmStand(ctx, x, y); break;
      case "rob_site": drawBuildSite(ctx, x, y); break;
      case "warehouse":
        if (typeof GS !== "undefined" && GS.state && GS.state.warehouse === 2) drawWarehouse(ctx, x, y);
        break;
      /* 农业二期（2026-08-17）：田格 / 池塘 / 果园 / 教堂 / 葡萄园 */
      case "plot": drawPlot(ctx, x, y, o.idx); break;
      case "pond": drawPond(ctx, x, y); break;
      case "fruit_tree": drawFruitTree(ctx, x, y, o.idx); break;
      case "orchard_sign": drawOrchardSign(ctx, x, y); break;
      case "chapel_door": drawChapelDoor(ctx, x, y); break;
      case "altar": drawAltar(ctx, x, y); break;
      case "stained_window": drawStainedWindow(ctx, x, y); break;
      case "pew": drawPew(ctx, x, y); break;
      case "grapevine": drawGrapevine(ctx, x, y); break;
      /* 2026-08-18 美化：泥土小路 / 小花 */
      case "path": drawPath(ctx, x, y); break;
      case "flower":
        px(ctx, x * T + 6 + ((x * 3) % 4), y * T + 7 + ((y * 5) % 4), [255, 240, 200]);
        px(ctx, x * T + 8 + ((x * 5) % 3), y * T + 10 + ((y * 3) % 3), [240, 200, 120]);
        break;
      /* 精灵旧屋（2026-08-18，储备角色薇拉的破屋） */
      case "bedroll": drawBedroll(ctx, x, y); break;
      case "table": drawTable(ctx, x, y); break;
      case "stool": drawStool(ctx, x, y); break;
      case "basin": drawBasin(ctx, x, y); break;
      case "leakyroof": drawLeakyRoof(ctx, x, y); break;
      case "heirloom": drawHeirloom(ctx, x, y); break;
      case "oldledger": drawOldLedger(ctx, x, y); break;
    }
  },

  drawChar: function (c) {
    var ctx = this.ctx;
    var dir = c.dir || "down";
    var frame = c.moving ? (Math.floor(c.animT * 5) % 2) : 0;
    var px = (c.x - 0.5) * T;
    var py = (c.y - 0.5) * T + 1;
    // 脚下影子（椭圆半透明，随行走轻微起伏）
    ctx.save();
    ctx.translate(c.x * T, (c.y + 0.44) * T);
    ctx.scale(1, 0.30);
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.beginPath();
    ctx.arc(0, 0, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 优先用 LPC 角色（64→32 半缩，占 2×2 格，脚锚定格底）
    var charKey = c.char || "player";
    if (typeof drawLPCChar === "function" && LPC.ready && LPC.presets[charKey]) {
      drawLPCChar(ctx, charKey, (c.x - 1) * T, (c.y + 0.5) * T - 32, dir, frame);
    } else {
      var sprSet = CHARS[charKey];
      if (sprSet) {
        var spr;
        if (dir === "left" || dir === "right") {
          spr = sprSet.side[frame];
        } else {
          spr = sprSet[dir] ? sprSet[dir][frame] : sprSet.down[0];
        }
        if (spr) drawPixels(ctx, spr, px + (T - spr.w) / 2, py, dir === "left");
      }
    }
  },

  drawPrompt: function () {
    if (!this.promptEl || !this.canvas.getBoundingClientRect) return;
    var el = this.promptEl;
    if (!this.prompt || this.overlayOpen || !this.player) {
      el.style.display = "none";
      return;
    }
    var p = this.player;
    var rect = this.canvas.getBoundingClientRect();
    var sx = rect.width / this.canvas.width;
    var sy = rect.height / this.canvas.height;
    el.style.display = "block";
    var label = this.prompt.label;
    if (this.prompt.npc) {
      var nm = (typeof NPC_NAMES !== "undefined" && NPC_NAMES[this.prompt.npc.def.id]) || "这个人";
      label = "跟 " + nm + " 说话";
    } else if (this.prompt.id === "window" && typeof GS !== "undefined" && GS.state && GS.state.period) {
      // 窗外景色随时段，提示文案也跟着变
      var wl = { morning: "窗 · 清晨薄雾", noon: "窗 · 晴空万里", evening: "窗 · 夜色" };
      label = wl[GS.state.period] || "窗 · 夜色";
    }
    el.textContent = "[E] " + (label || "");
    el.style.left = (rect.left + p.x * T * sx) + "px";
    el.style.top = (rect.top + (p.y - 0.5) * T * sy - 10) + "px";
  },
};
