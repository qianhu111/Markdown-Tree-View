# Markdown Tree View

一个轻量本地 Markdown 知识库系统（Node.js + 少量依赖）。

## 目录结构

```text
project/
├── content/
├── public/
├── templates/
├── build.js
├── server.js
├── assets/
└── package.json
```

## 安装

```bash
npm install
```

## 构建

```bash
node build.js
```

## 监听构建

```bash
node build.js --watch
```

## 启动服务

```bash
node server.js
```

打开：

- http://127.0.0.1:3000
- 可选在线编辑： http://127.0.0.1:3000/edit?file=notes/intro.md

## 已实现

- 递归扫描 `content/` 生成目录树
- Markdown 渲染（标题、代码块、表格、链接）
- 每个 `.md` 对应 `.html`
- 自动生成 `index.html`
- 资源复制到 `public/assets`
- `[[双链]]` 转 HTML 链接
- backlinks 反向链接
- 标签页与标签索引页
- 构建时生成 `search.json`，前端静态搜索
- 简单暗色模式
