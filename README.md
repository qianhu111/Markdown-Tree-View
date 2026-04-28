<div align="center">

# 📚 Markdown Tree View

> 🧠 一个类 Obsidian 的本地 Markdown 知识库系统  
> ⚡ 支持双链 / 标签 / 搜索 / 静态构建 / 本地服务

---

</div>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-16%2B-green?logo=node.js">
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

---

## 📂 目录结构

```text
project/
├── content/        # Markdown 源文件
├── public/         # 构建输出（HTML）
├── templates/      # 页面模板
├── assets/         # 静态资源
├── build.js        # 构建系统
├── server.js       # 本地服务
└── package.json
```

## ⚙️ 使用方式

### 🗂️ 克隆项目
```bash
git clone https://github.com/qianhu111/Markdown-Tree-View.git
```

### 📦 安装依赖
```bash
npm install
```

### 🏗️ 构建项目

```bash
node build.js
```

### 👀 监听模式（开发）

```bash
node build.js --watch
```

### 🚀 启动服务

```bash
node server.js
```

访问：

- 🌐 http://127.0.0.1:3000
- ✏️ 编辑页：http://127.0.0.1:3000/edit

## 🧠 实现能力
- Markdown → HTML 静态生成
- 类 Hexo 构建流程
- 双链知识网络结构
- 本地可运行知识库系统

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

## 📄 License
[MIT License](https://github.com/qianhu111/Markdown-Tree-View/blob/main/LICENSE)
