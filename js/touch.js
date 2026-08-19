/* touch.js — 移动端触摸控制（虚拟方向键 + 交互/菜单按钮）
 * 仅触屏设备启用；复用 Engine.keys 与既有交互逻辑，桌面环境完全无影响。
 * 覆盖层打开时触摸层由 CSS（#overlay.open ~ #touch）自动隐藏。 */
"use strict";

(function () {
  var G2 = (typeof window !== "undefined") ? window : globalThis;

  var T = {
    enabled: false,
    el: null,

    /* 触屏检测：触摸事件 / 触点数量 / 粗指针（平板、触屏笔记本） */
    isTouchDevice: function () {
      var w = (typeof window !== "undefined") ? window : null;
      var nav = (typeof navigator !== "undefined") ? navigator : null;
      if (w && "ontouchstart" in w) return true;
      if (nav && nav.maxTouchPoints > 0) return true;
      if (w && w.matchMedia && w.matchMedia("(pointer: coarse)").matches) return true;
      return false;
    },

    init: function () {
      if (!this.isTouchDevice()) return;
      if (typeof document === "undefined") return;
      this.el = document.getElementById("touch");
      if (!this.el) return;
      this.enabled = true;
      this.el.classList.add("visible");

      var self = this;
      // 虚拟方向键：按下/抬起 → Engine.keys（与键盘同一条通道）
      var dpadBtns = this.el.querySelectorAll("#touch-dpad .tbtn");
      dpadBtns.forEach(function (btn) {
        var key = btn.getAttribute("data-key");
        var press = function (e) {
          if (e && e.preventDefault) e.preventDefault();
          self.press(key, true);
          btn.classList.add("pressed");
        };
        var release = function (e) {
          if (e && e.preventDefault) e.preventDefault();
          self.press(key, false);
          btn.classList.remove("pressed");
        };
        btn.addEventListener("pointerdown", press);
        btn.addEventListener("pointerup", release);
        btn.addEventListener("pointercancel", release);
        btn.addEventListener("pointerleave", release);
        btn.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      });

      // 交互按钮（对应 E）
      var it = document.getElementById("t-interact");
      if (it) {
        it.addEventListener("pointerdown", function (e) {
          e.preventDefault();
          self.interact();
        });
      }
      // 菜单按钮（对应 Esc）
      var mn = document.getElementById("t-menu");
      if (mn) {
        mn.addEventListener("pointerdown", function (e) {
          e.preventDefault();
          self.menu();
        });
      }
    },

    press: function (key, down) {
      if (typeof Engine !== "undefined" && Engine.keys) Engine.keys[key] = down;
    },

    interact: function () {
      if (typeof Engine !== "undefined") Engine.interact();
    },

    menu: function () {
      if (typeof UI !== "undefined") UI.pauseMenu();
    },
  };

  G2.Touch = T;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { T.init(); });
    } else {
      T.init();
    }
  }
})();
