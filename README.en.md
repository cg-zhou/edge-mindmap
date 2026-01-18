[中文](./README.md) | English

<div align="center">
  <img src="./esa.png" alt="ESA" />
</div>

This project is powered by [Alibaba Cloud ESA](https://www.alibabacloud.com/product/esa) providing acceleration, computing, and protection.

# Edge Mindmap - Online Mind Map Editor

A high-performance online mind map editor powered by [Alibaba Cloud ESA](https://www.aliyun.com/product/esa) edge computing. Unleash creativity and sharing with AI-driven insights and edge acceleration.

## ✨ Key Features

### 🤖 AI Creation
- **Instant Inspiration**: Integrated with **Alibaba Qwen** (Tongyi Qianwen) to generate complex mind maps from simple prompts.
- **Streaming UI**: Utilizes **SSE (Server-Sent Events)** for real-time node rendering.

### 🌐 Effortless Sharing & SEO
- **Semantic SEO**: Edge functions automatically detect bots and render semantic `<ul><li>` structures for search engines.
- **Native SVG Support**: Simply append `.svg` to share links to get high-quality vector images for documents.
- **Instant Loading**: Sharing data is injected directly into HTML by edge workers, bypassing client-side API calls.

### 🏗️ Edge-First Architecture
- **Edge Acceleration**: Core business logic and high-frequency I/O are handled by ESA Workers using **EdgeKV** for millisecond responses.
- **Hybrid Persistence**: Features a robust EdgeKV + Central Storage synchronization strategy to balance speed and data durability.

### 🎨 Premium Editing Experience
- **KityMinder Core**: Supports multiple layout modes and deep style customization.
- **Local-First Sync**: Ensures uninterrupted editing during network flickers with automated retry logic and local caching.

## 🚀 Quick Start

### 1. Setup Environment
Copy `.env.example` to `.env.local`:
```env
# API Base URL (Your ESA Worker Domain)
VITE_API_BASE=https://your-api-domain.com

# Microsoft OAuth
VITE_MICROSOFT_CLIENT_ID=your_client_id
```

### 2. Development
```bash
yarn install
yarn dev    # Start dev server
yarn build  # Build for production
```

## 📄 License
MIT
