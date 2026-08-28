[English](./README.en.md) | 中文

<div align="center">
  <img src="./esa.png" alt="ESA" />
</div>

本项目由[阿里云ESA](https://cn.aliyun.com/product/esa)提供加速、计算和保护。

# Edge Mindmap - 在线思维导图编辑器

一个基于 [阿里云 ESA](https://www.aliyun.com/product/esa) 边缘计算的高性能在线思维导图编辑器。通过 AI 赋能和边缘分发，实现极速的创作与分享体验。

## 项目状态

`contest-final` 用于归档赛事版本。当前版本面向作品展示与轻量创作，采用本地文件管理，并保留 AI 创作与公开分享能力。

## ✨ 核心特性

### 🤖 AI 创作
- **零灵感启航**：集成阿里云百炼 **通义千问** 大模型，一键生成思维导图。
- **增量渲染**：基于 **SSE (Server-Sent Events)** 流式传输技术，节点实时预览。

### 🌐 极速分享与 SEO 优化
- **语义化直出**：边缘函数识别爬虫并渲染语义化 `<ul><li>` 结构，解决 SPA 站点的 SEO 难题。
- **SVG 原生支持**：支持分享链接加 `.svg` 后缀直接输出矢量图，方便嵌入文档。
- **零 API 加载**：分享页数据通过边缘函数直接注入 HTML，实现秒级开启。

### 🏗️ 轻量架构设计
- **本地文件管理**：无需注册登录，脑图保存在当前浏览器中，打开即可使用。
- **边缘能力**：AI 生成与公开分享由 ESA 边缘函数提供。

### 🎨 卓越的编辑体验
- **内核驱动**：基于 **KityMinder**，支持多种布局模式及丰富的样式编辑。
- **示例即用**：首次打开自动提供精选示例，也可以从模板、AI 或空白脑图开始创作。

## 🚀 快速开始

### 1. 配置环境变量
复制 `.env.example` 到 `.env.local`：
```env
# API 基础 URL (指向 ESA 边缘函数域名)
VITE_API_BASE=https://your-api-domain.com

```

### 2. 开发与构建
```bash
yarn install
yarn dev    # 本地开发
yarn build  # 构建发布
```

## 📄 许可证
MIT
