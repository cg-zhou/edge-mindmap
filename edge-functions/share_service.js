/**
 * 阿里云 ESA 边缘函数 - 公开分享服务
 *
 * R2 是分享快照的唯一存储；边缘函数通过 S3 SigV4 直接读写私有 bucket。
 * 每个分享使用公开 shareId 和仅保存在创建者浏览器中的 edit token。
 */

const textEncoder = new TextEncoder();
const SHARE_ID_PATTERN = /^[a-f0-9]{32}$/;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

function getR2Config(env = {}) {
  const config = {
    accountId: env.R2_ACCOUNT_ID,
    bucket: env.R2_BUCKET_NAME,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing R2 configuration: ${missing.join(', ')}`);
  }

  return config;
}

function toHex(value) {
  return Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value) {
  const bytes = typeof value === 'string' ? textEncoder.encode(value) : value;
  return toHex(await crypto.subtle.digest('SHA-256', bytes));
}

async function hmac(key, value) {
  const rawKey = typeof key === 'string' ? textEncoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, textEncoder.encode(value)));
}

function encodePathSegment(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, character =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

class R2Service {
  constructor(env) {
    this.config = getR2Config(env);
  }

  objectPath(shareId) {
    return `shares/${shareId}.json`;
  }

  async request(method, objectKey, body) {
    const { accountId, bucket, accessKeyId, secretAccessKey } = this.config;
    const path = `/${[bucket, ...objectKey.split('/')].map(encodePathSegment).join('/')}`;
    const url = new URL(`https://${accountId}.r2.cloudflarestorage.com${path}`);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payload = body ?? '';
    const payloadHash = await sha256(payload);
    const canonicalHeaders =
      `host:${url.host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [
      method,
      url.pathname,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');
    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      await sha256(canonicalRequest)
    ].join('\n');

    const dateKey = await hmac(`AWS4${secretAccessKey}`, dateStamp);
    const regionKey = await hmac(dateKey, 'auto');
    const serviceKey = await hmac(regionKey, 's3');
    const signingKey = await hmac(serviceKey, 'aws4_request');
    const signature = toHex(await hmac(signingKey, stringToSign));
    const headers = {
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json;charset=utf-8';
    }

    return fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : body
    });
  }

  async get(shareId) {
    const response = await this.request('GET', this.objectPath(shareId));
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`R2 GET failed with status ${response.status}`);
    }
    return response.json();
  }

  async put(shareId, value) {
    const response = await this.request('PUT', this.objectPath(shareId), JSON.stringify(value));
    if (!response.ok) {
      throw new Error(`R2 PUT failed with status ${response.status}`);
    }
  }

  async delete(shareId) {
    const response = await this.request('DELETE', this.objectPath(shareId));
    if (!response.ok && response.status !== 404) {
      throw new Error(`R2 DELETE failed with status ${response.status}`);
    }
  }
}

function jsonResponse(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      'Access-Control-Allow-Origin': origin === 'null' ? '*' : origin,
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Share-Token',
      'Cache-Control': 'no-store'
    }
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function generateSEOText(json) {
  if (!json?.root) return '';

  function walk(node) {
    let html = `<li>${escapeHtml(node?.data?.text)}`;
    if (Array.isArray(node.children) && node.children.length > 0) {
      html += `<ul>${node.children.map(walk).join('')}</ul>`;
    }
    return `${html}</li>`;
  }

  return `<ul>${walk(json.root)}</ul>`;
}

function isBot(userAgent) {
  if (!userAgent) return false;
  const bots = ['googlebot', 'baiduspider', 'bingbot', 'slurp', 'duckduckbot', 'yandexbot', 'spider', 'robot', 'crawl'];
  const normalized = userAgent.toLowerCase();
  return bots.some(bot => normalized.includes(bot));
}

function normalizeShareId(value) {
  return typeof value === 'string' && SHARE_ID_PATTERN.test(value) ? value : null;
}

function normalizeToken(value) {
  return typeof value === 'string' && TOKEN_PATTERN.test(value) ? value : null;
}

async function handleCreateShare(request, origin, storage) {
  const body = await request.json();
  const id = normalizeShareId(body.id);
  const token = normalizeToken(body.token);
  if (!id || !token || !body.json) {
    return jsonResponse({ success: false, error: 'Invalid request' }, 400, origin);
  }

  const tokenHash = await sha256(token);
  const existing = await storage.get(id);
  if (existing?.ownerTokenHash && existing.ownerTokenHash !== tokenHash) {
    return jsonResponse({ success: false, error: 'Forbidden' }, 403, origin);
  }

  await storage.put(id, {
    json: body.json,
    svg: typeof body.svg === 'string' ? body.svg : '',
    title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : '未命名思维导图',
    ownerTokenHash: tokenHash,
    updatedAt: Date.now()
  });

  return jsonResponse({ success: true, shareUrl: `/share/${id}` }, 200, origin);
}

async function handleDeleteShare(request, url, origin, storage) {
  const id = normalizeShareId(url.searchParams.get('id'));
  const token = normalizeToken(request.headers.get('X-Share-Token'));
  if (!id || !token) {
    return jsonResponse({ success: false, error: 'Invalid request' }, 400, origin);
  }

  const existing = await storage.get(id);
  if (!existing) {
    return jsonResponse({ success: true }, 200, origin);
  }
  if (existing.ownerTokenHash !== await sha256(token)) {
    return jsonResponse({ success: false, error: 'Forbidden' }, 403, origin);
  }

  await storage.delete(id);
  return jsonResponse({ success: true }, 200, origin);
}

async function handleGetShare(request, url, forcedView, storage) {
  let rawId = decodeURIComponent(url.pathname.replace('/share/', ''));
  let isSvgRequest = forcedView === 'svg';
  if (rawId.endsWith('.svg')) {
    rawId = rawId.slice(0, -4);
    isSvgRequest = true;
  }

  const shareId = normalizeShareId(rawId);
  if (!shareId) {
    return new Response('Share not found', { status: 404 });
  }

  const shareData = await storage.get(shareId);
  if (!shareData) {
    return new Response('Share not found', { status: 404 });
  }

  if (isSvgRequest) {
    return new Response(shareData.svg || '', {
      headers: {
        'Content-Type': 'image/svg+xml;charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }

  const safeTitle = escapeHtml(shareData.title);
  const botMatch = isBot(request.headers.get('User-Agent')) || forcedView === 'seo';
  if (botMatch) {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle} - Edge Mindmap</title>
  <meta name="description" content="AI 辅助生成的思维导图：${safeTitle}">
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
  <h1>${safeTitle}</h1>
  <div id="seo-content">${generateSEOText(shareData.json)}</div>
</body>
</html>`;
    return new Response(html, {
      headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }

  const serializedData = JSON.stringify(shareData.json)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle} - Edge Mindmap</title>
  <style>
    body, html { margin: 0; width: 100%; height: 100%; overflow: hidden; background: white; }
    iframe { width: 100%; height: 100%; border: 0; }
  </style>
</head>
<body>
  <iframe id="minder-iframe" title="${safeTitle}" src="/kityminder/index.html?mode=preview&mode=readonly"></iframe>
  <script>
    const shareData = ${serializedData};
    const iframe = document.getElementById('minder-iframe');
    iframe.onload = () => iframe.contentWindow.postMessage({ type: 'importJson', data: shareData }, '*');
  </script>
</body>
</html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '*';

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin === 'null' ? '*' : origin,
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Share-Token',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  try {
    const storage = new R2Service(env);
    if (url.pathname === '/api/share' && request.method === 'POST') {
      return await handleCreateShare(request, origin, storage);
    }
    if (url.pathname === '/api/share' && request.method === 'DELETE') {
      return await handleDeleteShare(request, url, origin, storage);
    }
    if (url.pathname.startsWith('/share/') && request.method === 'GET') {
      return await handleGetShare(request, url, url.searchParams.get('view'), storage);
    }
    return new Response('Not Found', { status: 404 });
  } catch (error) {
    console.error('Share service error', error);
    return jsonResponse({ success: false, error: 'Share service unavailable' }, 500, origin);
  }
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  }
};
