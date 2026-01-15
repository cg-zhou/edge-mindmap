# KityMinder Editor Iframe 集成指南

为了在你的 Vue/React 或其它前端应用中低成本集成 KityMinder，我们为你提取并精简了这个集成包。

## 目录结构
- `index.html`: 编辑器入口文件，已预设 `postMessage` 通信逻辑。
- `kityminder.editor.min.js/css`: 编辑器核心代码。
- `lib/`: 提取出的必要第三方依赖（jQuery, Angular 1.x, KityCore 等）。
- `images/`: 按钮、图标等资源。

## 快速集成步骤

### 1. 部署资源
将此 `kityminder-integration` 文件夹（或其中的所有内容）放置在你主应用的静态资源目录下（例如 Vue 的 `public/kityminder`）。

### 2. 在主应用中插入 Iframe
```html
<iframe 
  id="km-iframe" 
  src="/path/to/kityminder/index.html" 
  width="100%" 
  height="600px" 
  frameborder="0">
</iframe>
```

### 3. 数据通信
你可以通过 `window.postMessage` 与内部的编辑器交互：

#### 从主应用发送数据给编辑器：
```javascript
const iframe = document.getElementById('km-iframe').contentWindow;
iframe.postMessage({
  type: 'importJson',
  data: { /* 你的脑图 JSON 数据 */ }
}, '*');
```

#### 从主应用请求导出数据：
```javascript
// 发送指令
iframe.postMessage({ type: 'exportJson' }, '*');

// 监听返回
window.addEventListener('message', (event) => {
  if (event.data.type === 'exportJson') {
    console.log('导出的数据：', event.data.data);
  }
});
```

### 4. 注意事项
- **图片与链接功能**: 已在 `index.html` 的 `<style>` 中默认隐藏。如需恢复，请删除 CSS 中的 `display: none !important`。
- **marked.js**: 如果在运行中发现提示 `lib/marked.js` 找不到，请从 [CDN](https://cdn.jsdelivr.net/npm/marked/marked.min.js) 下载并保存至 `lib/marked.js`。
- **样式冲突**: 因为在 Iframe 中运行，你不需要担心它是如何污染主页面样式的。
- **图片上传**: 默认已禁用。如需启用，请取消 `index.html` 脚本中 `imageUpload` 配置的注释并设置地址。
