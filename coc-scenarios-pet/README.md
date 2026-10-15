# 绘本工作台

静态绘本，支持小狗、小猫、小鸟切换；13 张半页（`cover`、01–12）及可选字条，按 A4 横向双页打印。默认正文字体为龙藏体。

## 项目结构

- `picture-book/`：静态网页服务根目录，包含 `index.html`、`js/` 和 `css/`。`css/page.css` 管工作台与阅读栏；`css/book.css` 管绘本、字体与打印（独立打印窗口只加载后者）。
- `picture-book/assets/illustrations/`：`cover.png` 和 01–10 页插画。
- `picture-book/assets/pets/{dog,cat,bird}/`：每种动物 12 张页面在用透明 PNG；02 与 03 页复用蜷缩姿态。
- `picture-book/assets/pets/poses/`：每种动物 01–03 原始完整图集；页面不直接加载。
- `picture-book/assets/textures/`、`effects/`：在用边饰、文字底色、垃圾桶、墨迹及 04 页光圈。
- `picture-book/assets/fonts/`：本地字体与许可文本。
- `docs/绘本文本.md`：文案编辑源；`scripts/build_text.py` 生成 `picture-book/js/data.js`。
- `docs/新增宠物流程.md`：根据用户形象描述制作 12 动作图集、裁切和接入新物种的标准流程及现有工具限制。
- `refs/prompts/`：仍有参考价值的插画、宠物与道具提示词，不参与网页运行。
- `source/`：被 Git 忽略的私人资料；未纳入网页，也不应作为静态服务根目录。

## 预览和打印

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory /Users/soulran/code/pages/coc-scenarios-pet/picture-book
```

访问 <http://127.0.0.1:8765/> 。整本打印输出 7 张 A4 横向纸；选择 100%／实际大小，关闭页眉页脚，建议开启背景图形。打印当前页输出 1 张纸。

## 维护

- `picture-book/js/pet-layout.js` 管理各动物在 `cover`、01–10 页的位置和大小；`picture-book/js/prop-layout.js` 管理 03 页垃圾桶与 11–12 页墨迹。预览与打印共用两份配置。
- 编辑 `docs/绘本文本.md` 后运行 `python3 scripts/build_text.py`；使用 `--check` 检查同步状态。
- `scripts/publish_selected_pet_poses.py` 从 `poses/<动物>-01.png` 的原有 alpha 中提取每种动物 12 张角色图，发布前在系统临时目录备份当前页面素材。依赖 Pillow、NumPy、OpenCV；不会用白底阈值重新抠图。更换 01 图集后，先运行 `python3 tests/test_selected_pet_poses.py` 核对分格。
- 新增宠物先按 `docs/新增宠物流程.md` 制作并由用户选择完整图集；当前发布脚本仍固定处理狗、猫、鸟，新增物种不是一键发布。

```sh
node --test tests/*.test.cjs
python3 tests/test_selected_pet_poses.py
python3 scripts/build_text.py --check
git diff --check
```

`tests/browser-check.js`、`tests/layers-check.js`、`tests/print-regression.js` 在 Playwright 环境下验证交互与打印。不要将项目根目录的 `source/` 或 `refs/` 作为 HTTP 服务根目录。
