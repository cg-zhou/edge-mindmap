[English](./README.en.md) | 中文

<div align="center">
  <img src="./esa.png" alt="ESA" />
</div>

本项目由[阿里云ESA](https://cn.aliyun.com/product/esa)提供加速、计算和保护。

# Edge Mindmap - 在线思维导图编辑器

一个基于[阿里云 ESA](https://www.aliyun.com/product/esa) 边缘计算的高性能在线思维导图编辑器。支持实时保存、云端同步、OAuth 登录等功能。

## ✨ 核心特性

### 🏗️ 轻量级无服务架构
- **边缘函数驱动**：所有后端逻辑运行在阿里云 ESA 边缘函数上
- **边缘存储**：数据存储在 ESA EdgeKV 边缘存储中，无需管理数据库
- **无传统服务端**：完全 Serverless 架构，零服务器运维
- **就近服务**：边缘节点就近响应用户请求，极低延迟

### 🚀 性能优化
- **本地优先策略**：文件内容本地缓存，秒速打开，后台同步
- **智能缓存机制**：防止服务端返回旧数据，自动选择最新版本

### 💾 数据管理
- **实时自动保存**：编辑时自动保存，不丢失数据
- **云端同步**：文件列表和内容均支持本地和云端同步
- **时间戳对比**：对比本地和云端时间戳，确保数据一致性
- **自动重试机制**：网络不稳定时自动重试，最多 3 次

### 👥 账号系统
- **Microsoft OAuth 登录**：企业账号支持
- **游客登录**：无需注册即可使用（共享账户）

### 🎨 交互设计
- **粒子背景动效**：响应式粒子系统，窗口缩放时自动适应
- **流畅动画**：按钮点击爆裂效果，页面过渡动画
- **暗色主题**：护眼设计，减少用户疲劳

### 📝 编辑功能
- **思维导图编辑**：基于 Mind Elixir 的完整编辑能力
- **文件模板**：预设多个开箱即用的模板
- **快速创建**：支持快速新建文件和模板选择

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/cg-zhou/edge-mindmap
cd edge-mindmap
```

### 2. 安装依赖
```bash
npm install
# 或
yarn install
```

### 3. 配置环境变量
复制 `.env.example` 到 `.env.local`：
```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入你的配置：
```env
# API 基础 URL
VITE_API_BASE=https://your-api-domain.com

# Microsoft OAuth
VITE_MICROSOFT_CLIENT_ID=your_client_id
VITE_MICROSOFT_REDIRECT_URI=http://localhost:5173/auth/callback
```

### 4. 启动开发服务器
```bash
npm run dev
```

打开 http://localhost:5173 即可看到应用。

### 5. 构建生产版本
```bash
npm run build
```

## 🔐 认证流程

### Microsoft OAuth 登录
1. 用户在首页点击 "Microsoft 登录"
2. 重定向到 Microsoft 登录页面
3. 用户授权后获得 `code`
4. 前端将 `code` 发送到后端
5. 后端用 `code` 和 `client_secret` 换取 ID Token
6. 后端生成 JWT Token 返回给前端
7. 前端保存 Token 到 localStorage，后续请求携带

## 📝 主要 API 端点

### 认证
- `POST /api/auth/guest` - 游客登录
- `GET /api/auth/microsoft?code=<code>` - Microsoft OAuth 回调
- `GET /api/auth/me` - 获取当前用户信息

### 文件管理
- `GET /api/files` - 获取文件列表
- `GET /api/files/:fileId` - 获取文件内容
- `POST /api/files` - 创建文件
- `PUT /api/files/:fileId` - 更新文件
- `DELETE /api/files/:fileId` - 删除文件

## 💾 数据同步策略

### 文件列表
- 每次获取时从云端获取最新列表
- 与本地时间戳对比，选择较新的数据
- 防止服务端返回旧数据

### 文件内容
- 优先返回本地缓存内容（秒速打开）
- 后台异步从云端同步，有更新时自动刷新
- 编辑时使用 500ms 轮询检测变化
- 自动保存失败时重试 3 次，间隔 30 秒

## 📄 许可证

MIT
