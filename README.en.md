[中文](./README.md) | English

<div align="center">
  <img src="./esa.png" alt="ESA" />
</div>

This project is powered by [Alibaba Cloud ESA](https://www.alibabacloud.com/product/esa) providing acceleration, computing, and protection.

# Edge Mindmap - Online Mind Map Editor

A high-performance online mind map editor powered by [Alibaba Cloud ESA](https://www.aliyun.com/product/esa) edge computing. Unleash creativity and sharing with AI-driven insights and edge acceleration.

## Project Status

The `contest-final` tag archives the competition version. The current version focuses on showcasing and lightweight creation with local file management, AI creation, and public sharing.

## ✨ Key Features

### 🤖 AI Creation
- **Instant Inspiration**: Integrated with **Alibaba Qwen** (Tongyi Qianwen) to generate complex mind maps from simple prompts.
- **Streaming UI**: Utilizes **SSE (Server-Sent Events)** for real-time node rendering.

### 🌐 Effortless Sharing & SEO
- **Semantic SEO**: Edge functions automatically detect bots and render semantic `<ul><li>` structures for search engines.
- **Native SVG Support**: Simply append `.svg` to share links to get high-quality vector images for documents.
- **Instant Loading**: Sharing data is injected directly into HTML by edge workers, bypassing client-side API calls.

### 🏗️ Lightweight Architecture
- **Local File Management**: Start without an account; mind maps stay in the current browser.
- **Edge Features**: AI creation and public sharing continue to run on ESA edge functions.

### 🎨 Premium Editing Experience
- **KityMinder Core**: Supports multiple layout modes and deep style customization.
- **Ready-to-Use Examples**: First-time visitors get curated examples and can also start from a template, AI prompt, or blank map.

## 🚀 Quick Start

### 1. Setup Environment
Copy `.env.example` to `.env.local`:
```env
# API Base URL (Your ESA Worker Domain)
VITE_API_BASE=https://your-api-domain.com

```

### 2. Configure ESA Edge Functions

The public sharing service requires these environment variables:

```env
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_BUCKET_NAME=your_bucket_name
R2_ACCESS_KEY_ID=your_bucket_access_key
R2_SECRET_ACCESS_KEY=your_bucket_secret_key
```

AI creation also requires `QWEN_API_KEY`. Scope the R2 credentials to object read/write access for this bucket only.

### 3. Development
```bash
yarn install
yarn dev    # Start dev server
yarn build  # Build for production
```

## 📄 License
MIT
