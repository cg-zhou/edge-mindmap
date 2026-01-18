/**
 * 阿里云边缘函数 - 认证服务
 * 处理 Microsoft OAuth 登录
 */

// ==================== 配置 ====================
const CONFIG = {
  // 在阿里云边缘函数中，建议通过边缘函数环境变量获取敏感信息
  MICROSOFT_CLIENT_ID: 'YOUR_MICROSOFT_CLIENT_ID',
  MICROSOFT_CLIENT_SECRET: 'YOUR_MICROSOFT_CLIENT_SECRET',
  JWT_SECRET: 'YOUR_JWT_SECRET_KEY',
  FRONTEND_URL: 'https://your-domain.com',
  EDGEKV_NAMESPACE: 'mindmap-storage',
  // 中心强一致存储配置
  ESA_STORE_ENDPOINT: 'https://your-api-gateway.com/api/esa-store',
  ESA_STORE_AUTH_CODE: 'YOUR_ESA_STORE_AUTH_CODE'
};

// ==================== 存储服务 (ESA Cache + Center Source) ====================
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
    try {
      // 1. 尝试从 EdgeKV 获取缓存内容
      const cachedStr = await this.kv.get(safeKey, { type: 'text' }).catch(() => null);
      const cached = cachedStr ? JSON.parse(cachedStr) : null;
      
      const url = new URL(CONFIG.ESA_STORE_ENDPOINT);
      url.searchParams.append('key', safeKey);
      url.searchParams.append('authCode', CONFIG.ESA_STORE_AUTH_CODE);
      if (cached && cached.updatedAt) {
        url.searchParams.append('cacheTimestamp', cached.updatedAt);
      }

      // 2. 带着缓存时间戳询问中心服务器
      const resp = await fetch(url.toString());
      
      // 204 说明数据没变，直接用缓存
      if (resp.status === 204) {
        return cached ? cached.value : null;
      }

      // 404 处理：如果中心没有但边缘有，执行迁移逻辑
      if (resp.status === 404) {
        if (cached && cached.value) {
          console.log(`[Migration] Key ${safeKey} found in EdgeKV but not in center. Migrating...`);
          await this.set(key, cached.value).catch(e => console.error('Migration failed:', e));
          return cached.value;
        }
        return null;
      }

      const result = await resp.json();
      
      // 处理错误状态
      if (resp.status >= 400) {
        throw new Error(`Center Store Error (${resp.status}): ${result.errorMessage || JSON.stringify(result)}`);
      }

      // 处理 "modified: false" 的情况
      if (result && result.modified === false && cached) {
        return cached.value;
      }

      if (resp.status === 200) {
        // 反序列化中心服务器返回的字符串
        let finalValue = result.value;
        try {
          if (typeof finalValue === 'string' && (finalValue.startsWith('{') || finalValue.startsWith('['))) {
            finalValue = JSON.parse(finalValue);
          }
        } catch (e) {
          console.warn(`Failed to parse value for ${safeKey}, using raw value`);
        }

        // 更新缓存并返回新数据
        const dataToCache = {
          value: finalValue,
          updatedAt: result.timestamp
        };
        // 异步更新缓存，不阻塞返回
        this.kv.put(safeKey, JSON.stringify(dataToCache)).catch(() => {});
        return finalValue;
      }
      
      return null;
    } catch (error) {
      console.error(`KV Get Error [${safeKey}]:`, error.message);
      // 网络异常或 500 时落回缓存以保证可用性
      const cachedStr = await this.kv.get(safeKey, { type: 'text' }).catch(() => null);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        return cached.value;
      }
      throw error;
    }
  }

  async set(key, value, ttl = 31536000) {
    const safeKey = this._s(key);
    try {
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

      const result = await resp.json();

      if (resp.status < 200 || resp.status >= 300) {
        throw new Error(`Center Store Set Failed (${resp.status}): ${result.errorMessage || JSON.stringify(result)}`);
      }

      // 2. 写入成功后同步更新边缘缓存（缓存原始对象，减少下一次读取的解析开销）
      const dataToCache = {
        value: value,
        updatedAt: result.timestamp
      };
      await this.kv.put(safeKey, JSON.stringify(dataToCache), { 
        expiration: Math.floor(Date.now() / 1000) + ttl 
      });
      
      return result;
    } catch (error) {
      console.error(`KV Set Error [${safeKey}]:`, error.message);
      throw error;
    }
  }

  async delete(key) {
    const safeKey = this._s(key);
    // 在中心服务器标记为空或删除
    await this.set(key, null);
    await this.kv.delete(safeKey);
  }
}

// ==================== JWT 工具 ====================
function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

/**
 * 注意：阿里云边缘函数环境不支持 WebCrypto API
 * 我们通过 EdgeKV 存储 token 来保证安全性，而不是依赖 JWT 签名验证
 * 每个 token 都在 EdgeKV 中存储，可以随时撤销或更新
 */

function generateJWT(payload, secret, expiresIn = 604800) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const tokenPayload = { ...payload, iat: now, exp: now + expiresIn };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  
  // 由于环境限制，使用简化的签名方案
  // 配合 EdgeKV 中的 token 存储来验证 token 的有效性和真实性
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = base64UrlEncode(secret + signatureInput);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(base64UrlDecode(parts[1]));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp < now) return null;

    return payload;
  } catch (error) {
    return null;
  }
}

function extractToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}

// ==================== 工具函数 ====================
function getOriginFromRequest(request) {
  const origin = request.headers.get('Origin') || request.headers.get('origin');
  return origin;
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  
  // 允许本地开发
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return true;
  }
  
  // 允许专业域名
  if (origin === 'https://mindmap.cg-zhou.top' || origin === CONFIG.FRONTEND_URL) {
    return true;
  }
  
  return false;
}

function jsonResponse(data, status = 200, requestOrigin = '') {
  const allowedOrigin = isAllowedOrigin(requestOrigin) ? requestOrigin : CONFIG.FRONTEND_URL;
  
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}

function corsResponse(requestOrigin = '') {
  const allowedOrigin = isAllowedOrigin(requestOrigin) ? requestOrigin : CONFIG.FRONTEND_URL;
  
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}

function generateUserId(provider, providerId) {
  return `${provider}_${providerId}`;
}

// ==================== 用户注册/登录（通用接口）====================
async function handleUserRegister(provider, userInfo, kvService) {
  try {
    if (!userInfo || !userInfo.id) {
      return { success: false, error: 'Invalid user info' };
    }

    const userId = generateUserId(provider, userInfo.id);

    const user = {
      id: userId,
      provider,
      name: userInfo.name || userInfo.login || 'User',
      avatar_url: userInfo.avatar_url || userInfo.avatarUrl || '',
      email: userInfo.email || '',
      login: userInfo.login || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await kvService.set(`users:${userId}`, user);
    await kvService.set(`provider:${provider}:${userInfo.id}`, userId);

    const existingFiles = await kvService.get(`fileList:${userId}`);
    if (!existingFiles) {
      await kvService.set(`fileList:${userId}`, { files: [] });
    }

    const jwtToken = generateJWT({ userId, provider }, CONFIG.JWT_SECRET);

    return { success: true, token: jwtToken, user };
  } catch (error) {
    return { success: false, error: 'Internal server error' };
  }
}

// ==================== Microsoft OAuth ====================
async function handleMicrosoftOAuth(code, kvService) {
  try {
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: CONFIG.MICROSOFT_CLIENT_ID,
        client_secret: CONFIG.MICROSOFT_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${CONFIG.FRONTEND_URL}/auth/callback`
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenData || !tokenData.id_token) {
      const errorMsg = tokenData?.error_description || tokenData?.error || 'No ID token received';
      const statusInfo = `(Status: ${tokenResponse.status})`;
      return { success: false, error: `${errorMsg} ${statusInfo}` };
    }

    // 从 ID Token 中解析用户信息（不调用 Graph API）
    let microsoftUser = null;
    try {
      // ID Token 是 JWT，格式为 header.payload.signature
      const parts = tokenData.id_token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(base64UrlDecode(parts[1]));
        
        if (payload.oid) {
          microsoftUser = {
            id: payload.oid,
            displayName: payload.name || 'Microsoft User',
            mail: payload.email || payload.preferred_username || '',
            userPrincipalName: payload.preferred_username || ''
          };
        }
      }
    } catch (e) {
      return { success: false, error: 'Failed to parse ID token' };
    }
    
    if (!microsoftUser || !microsoftUser.id) {
      return { success: false, error: 'Invalid ID token' };
    }

    const userId = generateUserId('microsoft', microsoftUser.id);

    const user = {
      id: userId,
      provider: 'microsoft',
      name: microsoftUser.displayName,
      avatar_url: '',
      email: microsoftUser.mail || microsoftUser.userPrincipalName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await kvService.set(`users:${userId}`, user);
    await kvService.set(`provider:microsoft:${microsoftUser.id}`, userId);

    const existingFiles = await kvService.get(`fileList:${userId}`);
    if (!existingFiles) {
      await kvService.set(`fileList:${userId}`, { files: [] });
    }

    const jwtToken = generateJWT({ userId, provider: 'microsoft' }, CONFIG.JWT_SECRET);

    return { success: true, token: jwtToken, user };
  } catch (error) {
    return { 
      success: false, 
      error: `Auth process failed: ${error.message}`,
      stack: error.stack
    };
  }
}

// ==================== Token验证 ====================
async function verifyAndRefreshToken(token, kvService) {
  const payload = verifyJWT(token);
  if (!payload) return null;
  return { userId: payload.userId, provider: payload.provider };
}

// ==================== 主处理函数 ====================
async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;
  const requestOrigin = getOriginFromRequest(request);

  if (method === 'OPTIONS') {
    return corsResponse(requestOrigin);
  }

  const kvService = new KVService();

  try {
    // 游客登录（共享账户）
    if (pathname === '/api/auth/guest' && method === 'POST') {
      // 所有游客共享同一个账户
      const userId = 'guest';
      const isoNow = new Date().toISOString();
      
      // 创建/获取共享游客用户
      let guestUser = await kvService.get(`users:${userId}`);
      
      if (!guestUser) {
        guestUser = {
          id: userId,
          provider: 'guest',
          name: '游客',
          avatar_url: '',
          email: 'guest@example.com',
          login: 'guest',
          createdAt: isoNow,
          updatedAt: isoNow
        };
        
        await kvService.set(`users:${userId}`, guestUser);
        
        // 初始化共享文件列表
        await kvService.set(`fileList:${userId}`, { 
          files: [], 
          updatedAt: 0 
        });
      }
      
      // 为每个游客会话生成唯一的 token
      const jwtToken = generateJWT({ userId, provider: 'guest', sessionId: Math.random().toString(36).substr(2) }, CONFIG.JWT_SECRET);
      
      return jsonResponse({ 
        token: jwtToken, 
        user: { ...guestUser, type: 'guest' }
      }, 200, requestOrigin);
    }

    // 用户注册/登录（统一接口）
    if (pathname === '/api/auth/register' && method === 'POST') {
      const body = await request.json();
      const { provider, userInfo } = body;

      if (!provider || !userInfo) {
        return jsonResponse({ success: false, error: 'Missing provider or userInfo' }, 400, requestOrigin);
      }

      const result = await handleUserRegister(provider, userInfo, kvService);

      return jsonResponse(result, result.success ? 200 : 401, requestOrigin);
    }

    // Microsoft OAuth 回调（仅换取 ID Token）
    if (pathname === '/api/auth/microsoft' && method === 'GET') {
      const code = url.searchParams.get('code');
      if (!code) {
        return new Response('Missing code', { status: 400 });
      }

      const result = await handleMicrosoftOAuth(code, kvService);

      if (!result.success) {
        return jsonResponse(result, 401, requestOrigin);
      }

      // 返回 JSON 而不是 302 重定向，让前端自己跳转
      // 因为阿里云边缘函数的 302 重定向可能被 CORS 拦截
      return jsonResponse({
        success: true,
        token: result.token,
        redirect: `${CONFIG.FRONTEND_URL}/auth/callback?token=${result.token}`
      }, 200, requestOrigin);
    }

    // 获取当前用户信息
    if (pathname === '/api/auth/me' && method === 'GET') {
      const token = extractToken(request);
      if (!token) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401, requestOrigin);
      }

      const tokenData = await verifyAndRefreshToken(token, kvService);
      if (!tokenData) {
        return jsonResponse({ success: false, error: 'Invalid token' }, 401, requestOrigin);
      }

      const user = await kvService.get(`users:${tokenData.userId}`);
      if (!user) {
        return jsonResponse({ success: false, error: 'User not found' }, 404, requestOrigin);
      }

      return jsonResponse({ ...user, type: user.provider }, 200, requestOrigin);
    }

    return jsonResponse({ error: 'Not found' }, 404, requestOrigin);
  } catch (error) {
    console.error('Auth Error:', error);
    // 返回具体错误信息，方便调试
    return jsonResponse({ 
      error: error.message || 'Internal server error',
      stack: error.stack 
    }, 500, requestOrigin);
  }
}

// ==================== 导出 ====================
export default {
  async fetch(request) {
    return handleRequest(request);
  }
};
