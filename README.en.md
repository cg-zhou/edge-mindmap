[中文](./README.md) | English

<div align="center">
  <img src="./esa.png" alt="ESA" />
</div>

This project is powered by [Alibaba Cloud ESA](https://www.alibabacloud.com/product/esa) providing acceleration, computing, and protection.

# Edge Mindmap - Online Mind Map Editor

A high-performance online mind map editor powered by [Alibaba Cloud ESA](https://www.aliyun.com/product/esa) edge computing. Supports real-time saving, cloud synchronization, OAuth login, and more.

## ✨ Key Features

### 🏗️ Lightweight Serverless Architecture
- **Edge Functions Powered**: All backend logic runs on Alibaba Cloud ESA edge functions
- **Edge Storage**: Data stored in ESA EdgeKV edge storage, no database management needed
- **No Traditional Server**: Complete Serverless architecture with zero server maintenance
- **Proximity Service**: Edge nodes serve users from the nearest location with ultra-low latency

### 🚀 Performance Optimization
- **Local-First Strategy**: Cache file content locally, instant open with background sync
- **Intelligent Caching**: Prevent stale data from server, automatically select the latest version

### 💾 Data Management
- **Real-time Auto-save**: Automatically save edits without data loss
- **Cloud Synchronization**: Support local and cloud sync for both file lists and content
- **Timestamp Comparison**: Compare local and cloud timestamps to ensure data consistency
- **Automatic Retry**: Auto-retry on network failures, up to 3 attempts

### 👥 Account System
- **Microsoft OAuth Login**: Enterprise account support
- **Guest Login**: Use without registration (shared account)

### 🎨 Interactive Design
- **Particle Background Effects**: Responsive particle system with auto-scaling on window resize
- **Smooth Animations**: Button burst effects and page transitions
- **Dark Theme**: Eye-friendly design to reduce user fatigue

### 📝 Editing Features
- **Mind Map Editing**: Complete editing capabilities based on Mind Elixir
- **File Templates**: Pre-set templates ready to use
- **Quick Create**: Support quick file creation and template selection

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/cg-zhou/edge-mindmap
cd edge-mindmap
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:
```env
# API Base URL
VITE_API_BASE=https://your-api-domain.com

# Microsoft OAuth
VITE_MICROSOFT_CLIENT_ID=your_client_id
VITE_MICROSOFT_REDIRECT_URI=http://localhost:5173/auth/callback
```

### 4. Start Development Server
```bash
npm run dev
```

Open http://localhost:5173 to see the app.

### 5. Build for Production
```bash
npm run build
```

## 🔐 Authentication Flow

### Microsoft OAuth Login
1. User clicks "Microsoft Login" on home page
2. Redirect to Microsoft login page
3. After authorization, user receives a `code`
4. Frontend sends `code` to backend
5. Backend exchanges `code` and `client_secret` for ID Token
6. Backend generates JWT Token and returns to frontend
7. Frontend saves Token to localStorage and includes in subsequent requests

## 📝 Main API Endpoints

### Authentication
- `POST /api/auth/guest` - Guest login
- `GET /api/auth/microsoft?code=<code>` - Microsoft OAuth callback
- `GET /api/auth/me` - Get current user info

### File Management
- `GET /api/files` - Get file list
- `GET /api/files/:fileId` - Get file content
- `POST /api/files` - Create file
- `PUT /api/files/:fileId` - Update file
- `DELETE /api/files/:fileId` - Delete file

## 💾 Data Sync Strategy

### File List
- Fetch from cloud on every request
- Compare with local timestamp, use newer data
- Prevent stale server data

### File Content
- Return local cache immediately (instant open)
- Background async sync from cloud, auto-refresh on updates
- Poll every 500ms during editing
- Retry 3 times on save failure with 30-second intervals

## 📄 License

MIT
