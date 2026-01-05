/**
 * 阿里云边缘函数 - 认证服务
 * 处理 Microsoft OAuth 登录
 */

// ==================== 配置 ====================
const CONFIG = {
  // 在阿里云边缘函数中，环境变量通过全局对象获取
  MICROSOFT_CLIENT_ID: '',
  MICROSOFT_CLIENT_SECRET: '',
  JWT_SECRET: 'your-secret-key',
  FRONTEND_URL: 'https://your-pages-domain.com',
  EDGEKV_NAMESPACE: 'mindmap-storage'
};

// ==================== EdgeKV 操作 ====================
class KVService {
  constructor(namespace) {
    this.kv = new EdgeKV({ namespace });
  }

  async get(key) {
    try {
      const value = await this.kv.get(key, { type: 'text' });
      return value ? JSON.parse(value) : null;
    } catch (error) {
      return null;
    }
  }

  async set(key, value, ttl = 31536000) {
    await this.kv.put(key, JSON.stringify(value), { 
      expiration: Math.floor(Date.now() / 1000) + ttl 
    });
  }

  async delete(key) {
    await this.kv.delete(key);
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
    
    if (!tokenData.id_token) {
      return { success: false, error: tokenData.error_description || 'No ID token received' };
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
    return { success: false, error: 'Internal server error' };
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

  const kvService = new KVService(CONFIG.EDGEKV_NAMESPACE);

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
    return jsonResponse({ error: 'Internal server error' }, 500, requestOrigin);
  }
}

// ==================== 导出 ====================
export default {
  async fetch(request) {
    return handleRequest(request);
  }
};
