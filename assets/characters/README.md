# 人物精灵素材

## 来源：LPC 角色生成器

打开 https://gaurav.munjal.us/Universal-LPC-Spritesheet-Character-Generator/
捏好角色后导出 sprite sheet PNG，放在 `characters/` 目录下。

## 命名规则

文件名 = 角色键（`charKey`），对应 `js/sprites.js` 里的 `CHARS` 对象键名：

- `player.png` → 主角
- `boss.png` → 酒馆老板
- `drunk.png` → 醉汉
- `villager.png` → 村民
- `merchant.png` → 商人
- `rita.png` → 丽塔
- `billy.png` → 比利
- `tommy.png` → 汤米
- `will.png` → 威尔
- `higg.png` → 希格
- `mark.png` → 马克
- `mary.png` → 玛丽
- `anna.png` → 安娜
- `fisher.png` → 渔夫
- `farmer.png` → 农夫
- `guard.png` → 卫兵
- `al.png` → 艾尔
- `robert.png` → 罗伯特
- `gardener.png` → 老园丁
- `priest.png` → 老牧师
- `lord.png` → 领主·柳叶
- `vera.png` → 薇拉
- `husk.png` → 哈斯克

## 格式要求

- 推荐 32x32 或 64x64 每帧
- 精灵表布局：4 列（down/left/right/up）× 4 行（行走帧）
- 若格式不同，在 `main.js` 的 `loadSpriteSheet` 调用中指定 `opts`
- 游戏自动加载：有 PNG 就用精灵表，没有就回退到程序化绘制

## 许可证

LPC 素材是 CC-BY-SA 3.0 或 GPL 3.0，使用时需在游戏内保留署名。