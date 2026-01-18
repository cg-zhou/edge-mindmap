/**
 * 阿里云边缘函数 - 分享服务
 * 
 * 功能：
 * 1. 存储共享脑图 (JSON + SVG)
 * 2. 多态展现：
 *    - 真人访问：返回带数据的预览 HTML
 *    - 爬虫访问：返回 SEO 友好的 HTML 列表
 *    - .svg 访问：直接返回 SVG 图片
 */

const CONFIG = {
  JWT_SECRET: 'YOUR_JWT_SECRET_KEY', // 请与 auth_service.js 保持一致
  EDGEKV_NAMESPACE: 'mindmap-storage',
  // 中心强一致存储配置 (同步 files_service.js 的配置)
  ESA_STORE_ENDPOINT: 'https://your-api-gateway.com/api/esa-store',
  ESA_STORE_AUTH_CODE: 'YOUR_ESA_STORE_AUTH_CODE'
};

class KVService {
  constructor() {
    this.kv = new EdgeKV({ namespace: CONFIG.EDGEKV_NAMESPACE });
  }

  // 内部工具：安全化 Key 命名 (长度<=50，字符为 a-z A-Z 0-9 _ -)
  _s(key) {
    // 1. 基础清理
    let safe = key.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    
    // 2. 长度控制：如果超过 50，截断并附加确定性哈希
    if (safe.length > 50) {
      let hash = 0;
      for (let i = 0; i < key.length; i++) {
        hash = ((hash << 5) - hash) + key.charCodeAt(i);
        hash |= 0; 
      }
      const hashStr = Math.abs(hash).toString(36);
      safe = safe.substring(0, 42) + '-' + hashStr;
    }
    return safe;
  }

  async get(key) {
    const safeKey = this._s(key);
    // 1. 尝试从 EdgeKV 获取缓存内容
    const cachedStr = await this.kv.get(safeKey, { type: 'text' }).catch(() => null);
    const cached = cachedStr ? JSON.parse(cachedStr) : null;
    
    const url = new URL(CONFIG.ESA_STORE_ENDPOINT);
    url.searchParams.append('key', safeKey);
    url.searchParams.append('authCode', CONFIG.ESA_STORE_AUTH_CODE);
    if (cached && cached.updatedAt) {
      url.searchParams.append('cacheTimestamp', String(cached.updatedAt));
    }

    // 2. 带着缓存时间戳询问中心服务器
    const resp = await fetch(url.toString());
    
    // 404 说明中心存储已删除或不存在
    if (resp.status === 404) {
      await this.kv.delete(safeKey).catch(() => {});
      return null;
    }

    // 处理返回状态
    if (resp.status === 200) {
      const result = await resp.json();
      
      // 处理中心端的 cacheHit 逻辑
      if (result.cacheHit && cached) {
        if (cached.value && cached.value.__deleted) return null;
        return cached.value;
      }

      let finalValue = result.value;
      if (finalValue === undefined || finalValue === null) {
        return (cached && !cached.value?.__deleted) ? cached.value : null;
      }

      try {
        if (typeof finalValue === 'string' && (finalValue.startsWith('{') || finalValue.startsWith('['))) {
          finalValue = JSON.parse(finalValue);
        }
      } catch (e) {}

      // 检查墓碑标记
      if (finalValue && finalValue.__deleted) {
        await this.kv.delete(safeKey).catch(() => {});
        return null;
      }

      const dataToCache = {
        value: finalValue,
        updatedAt: result.timestamp || Date.now()
      };
      // 异步更新缓存
      this.kv.put(safeKey, JSON.stringify(dataToCache)).catch(() => {});
      return finalValue;
    }

    // 如果不是 200/404/204，抛出详细错误供前端调试
    const errorBody = await resp.text().catch(() => 'No body');
    throw new Error(`Center Store Error [${resp.status}]: ${errorBody} (URL: ${url.origin}${url.pathname})`);
  }

  async set(key, value) {
    const safeKey = this._s(key);
    // 序列化 value：中心服务器只接受字符串
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    // 1. 强一致性写入中心服务器
    const url = new URL(CONFIG.ESA_STORE_ENDPOINT);
    url.searchParams.append('key', safeKey);
    url.searchParams.append('authCode', CONFIG.ESA_STORE_AUTH_CODE);

    const resp = await fetch(url.toString(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: stringValue })
    });

    if (resp.status < 200 || resp.status >= 300) {
      const errorBody = await resp.text().catch(() => 'No body');
      throw new Error(`Center Store Set Failed [${resp.status}]: ${errorBody}`);
    }

    const result = await resp.json();

    // 2. 写入成功后同步更新边缘缓存
    const dataToCache = {
      value: value,
      updatedAt: result.timestamp || Date.now()
    };
    await this.kv.put(safeKey, JSON.stringify(dataToCache));
    return true;
  }

  async delete(key) {
    const safeKey = this._s(key);
    // 1. 先删边缘缓存（追求快速生效）
    await this.kv.delete(safeKey).catch(() => {});
    
    // 2. 由于中心端没有 DELETE 接口，我们通过 PUT 一个含有 __deleted 标记的“墓碑”对象来模拟删除
    const url = new URL(CONFIG.ESA_STORE_ENDPOINT);
    url.searchParams.append('key', safeKey);
    url.searchParams.append('authCode', CONFIG.ESA_STORE_AUTH_CODE);
    
    const tombstone = {
      __deleted: true,
      updatedAt: Date.now()
    };

    try {
      await fetch(url.toString(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(tombstone) })
      });
    } catch (e) {
      console.error('Delete (Tombstone) center source failed:', e);
    }
    return true;
  }
}

const kv = new KVService();

// ==================== 工具函数 ====================

function jsonResponse(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin === 'null' ? '*' : origin,
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}

// 将脑图 JSON 转换为 SEO 友好的 HTML 列表
function generateSEOText(json) {
  if (!json || !json.root) return '';

  function walk(node) {
    let html = `<li>${node.data.text || ''}`;
    if (node.children && node.children.length > 0) {
      html += '<ul>';
      node.children.forEach(child => {
        html += walk(child);
      });
      html += '</ul>';
    }
    html += '</li>';
    return html;
  }

  return `<ul>${walk(json.root)}</ul>`;
}

// 检查是否为爬虫
function isBot(userAgent) {
  if (!userAgent) return false;
  const bots = ['googlebot', 'baiduspider', 'bingbot', 'slurp', 'duckduckbot', 'yandexbot', 'spider', 'robot', 'crawl'];
  const ua = userAgent.toLowerCase();
  return bots.some(bot => ua.includes(bot));
}

// ==================== 路由逻辑 ====================

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const origin = request.headers.get('Origin') || '*';
  const view = url.searchParams.get('view');

  // 处理预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
      }
    });
  }

  // 1. 创建/更新分享 (POST /api/share)
  if (path === '/api/share' && request.method === 'POST') {
    return handleCreateShare(request, origin);
  }

  // 1b. 取消分享 (DELETE /api/share)
  if (path === '/api/share' && request.method === 'DELETE') {
    const shareId = url.searchParams.get('id');
    if (!shareId) return jsonResponse({ success: false }, 400, origin);
    await kv.delete(`share:${shareId}`);
    return jsonResponse({ success: true }, 200, origin);
  }

  // 2. 访问分享 (GET /share/:id)
  if (path.startsWith('/share/')) {
    // 支持通过 ?view=seo 或 ?view=svg 强制切换显示模式
    return handleGetShare(request, url, view);
  }

  return new Response('Not Found', { status: 404 });
}

// 处理创建分享
async function handleCreateShare(request, origin) {
  try {
    const body = await request.json();
    const { id, json, svg, title } = body;

    if (!id || !json) {
      return jsonResponse({ success: false, error: 'Invalid request' }, 400, origin);
    }

    // 存储分享内容，包含 JSON 和 SVG
    const shareData = {
      json,
      svg,
      title: title || '未命名思维导图',
      updatedAt: Date.now()
    };

    await kv.set(`share:${id}`, shareData);

    return jsonResponse({ success: true, shareUrl: `/share/${id}` }, 200, origin);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500, origin);
  }
}

// 处理获取分享
async function handleGetShare(request, url, forcedView) {
  try {
    const path = url.pathname;
    let shareId = decodeURIComponent(path.replace('/share/', ''));
    let isSvgRequest = forcedView === 'svg';

    // 如果以 .svg 结尾，返回纯图片
    if (shareId.endsWith('.svg')) {
      shareId = shareId.replace('.svg', '');
      isSvgRequest = true;
    }

    const shareData = await kv.get(`share:${shareId}`);
    if (!shareData) {
      return new Response('Share not found (Key deleted or never existed)', { status: 404 });
    }

    // A. 资产视图：返回纯 SVG
    if (isSvgRequest) {
      return new Response(shareData.svg || '', {
        headers: {
          'Content-Type': 'image/svg+xml;charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    const userAgent = request.headers.get('User-Agent');
    const botMatch = isBot(userAgent) || forcedView === 'seo';

    // B. 语义视图 (SEO)
    if (botMatch) {
      const seoContent = generateSEOText(shareData.json);
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${shareData.title} - Edge Mindmap 思维导图</title>
          <meta name="description" content="AI 辅助生成的思维导图：${shareData.title}">
          <style>
            body { font-family: -apple-system, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; }
            h1 { border-bottom: 2px solid #2a5fbd; padding-bottom: 10px; color: #1e293b; }
            ul { padding-left: 20px; }
            li { margin: 8px 0; }
            .nav-back { margin-bottom: 20px; display: block; color: #2a5fbd; text-decoration: none; }
          </style>
        </head>
        <body>
          <a href="${url.pathname}" class="nav-back">← 返回图形界面</a>
          <h1>${shareData.title}</h1>
          <div id="seo-content">${seoContent}</div>
          <hr>
          <p><small>本页面由 Edge Mindmap 边缘函数自动生成，用于 SEO 优化。</small></p>
        </body>
        </html>
      `;
      return new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=utf-8' }
      });
    }

    // C. 交互视图 (真人)
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${shareData.title} - Edge Mindmap</title>
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: white; }
    #container { width: 100%; height: 100%; box-sizing: border-box; }
    iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <div id="container">
    <iframe id="minder-iframe" src="/kityminder/index.html?mode=preview&mode=readonly"></iframe>
  </div>

  <script>
    window.__SHARE_DATA__ = ${JSON.stringify(shareData.json)};
    const iframe = document.getElementById('minder-iframe');
    
    // 监听 iframe 加载完毕
    iframe.onload = () => {
      iframe.contentWindow.postMessage({
        type: 'importJson',
        data: window.__SHARE_DATA__
      }, '*');
    };
  </script>
</body>
</html>
    `;
    return new Response(html, {
      headers: { 'Content-Type': 'text/html;charset=utf-8' }
    });
  } catch (err) {
    // 关键修复：抛出完整的错误堆栈到浏览器页面，方便调试 (调试完可删除)
    return new Response(`[DEBUG ERROR]\nMessage: ${err.message}\n\nStack:\n${err.stack}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
  }
}

// ==================== 导出 ====================

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request);
  }
};
