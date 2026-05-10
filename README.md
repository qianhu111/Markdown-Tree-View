<div align="center">

# 📚 Markdown Tree View

> 🧠 一个类 Obsidian 的本地 Markdown 知识库系统  
> ⚡ 支持双链 / 标签 / 搜索 / 静态构建 / 本地服务 / 桌面端

---

</div>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js">
  <img src="https://img.shields.io/badge/Electron-Desktop-blueviolet?logo=electron">
  <img src="https://img.shields.io/badge/Markdown-Renderer-blue">
  <img src="https://img.shields.io/badge/License-MIT-yellow">
</p>

---

## ✨ 项目特性

- 📁 递归目录树扫描（content → 自动结构化）
- ⚡ Markdown 自动渲染为 HTML
- 🔗 支持 `[[双链引用]]`
- 🧠 自动生成 backlinks 反向链接
- 🏷️ 标签系统（自动分类）
- 🔍 静态搜索（search.json + 前端搜索）
- 📦 一键构建静态站点
- 🌙 暗色模式支持
- 🖥️ 本地 HTTP 服务预览
- ✏️ **就地编辑**：文章页右上角 `✏️ 编辑` 按钮 → 进入 GitHub 风格的 编辑 / 预览 双 tab 页面，保存后自动重建并跳回文章
- 🪟 **桌面端 `start.exe`**：原生窗口、首次自动释放默认资源、内置启停按钮，无需 Node / 浏览器依赖

---

## 📂 目录结构

```text
project/
├── content/        # Markdown 源文件（同时作为 exe 内置默认资源）
├── public/         # 构建输出（HTML，构建时生成，已忽略）
├── templates/      # 页面模板
├── assets/         # 静态资源（styles.css / app.js / edit.js / ...）
├── build/icon.ico  # 应用图标（多分辨率 BMP-encoded）
├── lib/            # paths / config / builder / server 共用模块
├── electron/       # main.js / preload.js / renderer.html|js
├── build.js        # 构建 CLI 入口
├── server.js       # 本地服务 CLI 入口
├── launcher.js     # 浏览器版控制台（保留用于 dev）
└── package.json
```

---

## 🚀 三种使用方式

### A. 桌面端（普通用户推荐）

下载 [Releases](https://github.com/qianhu111/Markdown-Tree-View/releases) 中的 `start.exe`，放到任意**自己有写权限**的目录双击：

- 首次启动会**自动在同目录释放** `config.json` / `content/` / `templates/` / `assets/`；
- 弹出原生窗口"运行控制台"，可改站点标题、端口、目录、是否启用在线编辑；
- 点 **打开站点** 用默认浏览器查看 `http://127.0.0.1:3000`；
- 在任意文章页右上角点 **`✏️ 编辑`** 进入编辑器：左边写 markdown，点 **预览** 即可看到渲染效果（含 `[[双链]]` 解析），`Ctrl+S` 或点击保存即重建并跳回文章；
- 点 **停止** 关闭服务并退出（关闭窗口同样效果，无需任务管理器）。

> ⚠️ 之后再次启动**不会**覆盖你已修改的内容；想恢复默认值就把对应文件/目录删掉再启动。
>
> ⚠️ 首次运行 Windows SmartScreen 会提示"未知发布者"——`start.exe` 未做代码签名是已知的，点"更多信息 → 仍要运行"即可。同一台机器只需做一次。

### B. 命令行（开发者）

```bash
# 克隆
git clone https://github.com/qianhu111/Markdown-Tree-View.git
cd Markdown-Tree-View
npm install

# 一次性构建
npm run build      # 等价于 node build.js

# 监听模式（自动重建）
npm run watch      # 等价于 node build.js --watch

# 启动 HTTP 服务
npm run serve      # 等价于 node server.js
```

服务起来后：

- 浏览：`http://127.0.0.1:3000`
- 在任意文章页点 **`✏️ 编辑`** 即可进编辑器（兼容老用法 `?file=...`）

### C. Electron 开发态

```bash
npm run electron   # 直接以开发模式启动桌面端，等同于 start.exe 的体验
```

---

## 📦 打包成 start.exe

```bash
npm run dist       # 输出 dist/start.exe（portable，单文件，~70MB）
```

> ℹ️ 在**普通用户权限**的 Windows 上首次执行 `npm run dist` 时，`electron-builder` 会下载 `winCodeSign-2.6.0.7z`，里面包含 macOS dylib 符号链接；若未启用 Windows 开发者模式，符号链接创建会失败。解决：把 `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0\` 预解压（用 `-xr'!darwin'` 排除 macOS 子目录），或开启 Windows 开发者模式。

---

## ⚙️ 配置

`config.json`：

| 字段 | 默认值 | 说明 |
|---|---|---|
| `siteTitle` | `"Markdown Tree View"` | 站点标题 |
| `host` | `"127.0.0.1"` | 监听地址 |
| `port` | `3000` | 服务端口 |
| `enableEdit` | `true` | 是否启用 `/edit` 编辑页 |
| `contentDir` | `"content"` | Markdown 源目录 |
| `publicDir` | `"public"` | 构建输出目录 |
| `templatesDir` | `"templates"` | 模板目录 |
| `assetsDir` | `"assets"` | 静态资源目录 |

---

## 🧠 实现能力

- Markdown → HTML 静态生成
- 类 Hexo 构建流程
- 双链知识网络结构
- 浏览器端编辑器 + 服务端渲染预览（共用同一套构建管线）
- 本地可运行知识库系统
- 单文件桌面分发（Windows）

---

## 🚀 预览效果

<table>
  <tr>
    <td align="center"><b>首页</b></td>
    <td align="center"><b>目录</b></td>
  </tr>
  <tr>
    <td><img src="https://img.qianhu.nyc.mn/file/1777384281755_PixPin_2026-04-28_21-40-53.png" width="400"/></td>
    <td><img src="https://img.qianhu.nyc.mn/file/1777384276885_PixPin_2026-04-28_21-41-11.png" width="400"/></td>
  </tr>

  <tr>
    <td align="center"><b>标签</b></td>
    <td align="center"><b>搜索</b></td>
  </tr>
  <tr>
    <td><img src="https://img.qianhu.nyc.mn/file/1777384274460_PixPin_2026-04-28_21-41-22.png" width="400"/></td>
    <td><img src="https://img.qianhu.nyc.mn/file/1777384280804_PixPin_2026-04-28_21-41-40.png" width="400"/></td>
  </tr>
</table>

---

## 🗑️ 卸载

```powershell
# 桌面端
Remove-Item -LiteralPath "D:\路径\到\start.exe 所在目录" -Recurse -Force

# 源码项目
Remove-Item -LiteralPath "D:\Markdown-Tree-View" -Recurse -Force
```

---

## 📄 License

[MIT License](https://github.com/qianhu111/Markdown-Tree-View/blob/main/LICENSE)
