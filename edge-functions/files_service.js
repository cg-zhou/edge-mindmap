/**
 * 阿里云边缘函数 - 文件管理服务（极简版）
 * 
 * 核心设计：
 * - 使用 UTC 时间戳（updatedAt）判断新旧
 * - fileList 和 file 一样，都由客户端维护
 * - 服务端只做时间戳比较和存储
 * - 同步上传：file + fileList 一起发送
 */

const CONFIG = {
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
    const value = await this.kv.get(key, { type: 'text' });
    return value ? JSON.parse(value) : null;
  }

  async set(key, value) {
    await this.kv.put(key, JSON.stringify(value), { expiration: Math.floor(Date.now() / 1000) + 31536000 });
  }

  async delete(key) {
    await this.kv.delete(key);
  }
}

// ==================== JWT 验证 ====================

function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

function verifyJWT(token, secret = CONFIG.JWT_SECRET) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Invalid token format' };
  }
  
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    
    // 检查过期时间
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'Token expired' };
    }
    
    // 验证签名
    const signatureInput = `${parts[0]}.${parts[1]}`;
    const expectedSignature = base64UrlEncode(secret + signatureInput);
    if (parts[2] !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: 'Token parse error' };
  }
}

function extractToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  return parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;
}

async function verifyToken(token) {
  const result = verifyJWT(token);
  if (!result.valid) {
    return { valid: false, error: result.error };
  }
  return { valid: true, userId: result.payload.userId, provider: result.payload.provider };
}

// ==================== CORS ====================

function getOrigin(request) {
  return request.headers.get('Origin') || request.headers.get('origin');
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return origin.includes('localhost') || origin.includes('127.0.0.1') || 
         origin === 'https://mindmap.cg-zhou.top' || origin === CONFIG.FRONTEND_URL;
}

function response(data, status = 200, origin = '') {
  const allowedOrigin = isAllowedOrigin(origin) ? origin : CONFIG.FRONTEND_URL;
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

function corsResponse(origin = '') {
  const allowedOrigin = isAllowedOrigin(origin) ? origin : CONFIG.FRONTEND_URL;
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

// ==================== 主处理函数 ====================

async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;
  const origin = getOrigin(request);

  if (method === 'OPTIONS') {
    return corsResponse(origin);
  }

  // 验证 token
  const token = extractToken(request);
  if (!token) {
    return response({ error: 'Unauthorized', message: 'Missing token' }, 401, origin);
  }

  const tokenData = await verifyToken(token);
  if (!tokenData.valid) {
    return response({ error: 'Unauthorized', message: tokenData.error }, 401, origin);
  }

  const userId = tokenData.userId;

  const kvService = new KVService(CONFIG.EDGEKV_NAMESPACE);

  // ==================== GET /api/files - 获取所有文件和 fileList ====================
  if (pathname === '/api/files' && method === 'GET') {
    const fileList = await kvService.get(`fileList:${userId}`) || { files: [], updatedAt: 0 };
    return response({ files: fileList.files || [], updatedAt: fileList.updatedAt || 0 }, 200, origin);
  }

  // ==================== POST /api/files - 创建文件 ====================
  if (pathname === '/api/files' && method === 'POST') {
    const body = await request.json();
    const { file, fileList } = body;

    if (!file || !file.name || file.content === undefined || !file.updatedAt) {
      return response({ error: 'Invalid file data' }, 422, origin);
    }

    if (!fileList || !Array.isArray(fileList.files) || !fileList.updatedAt) {
      return response({ error: 'Invalid fileList data' }, 422, origin);
    }

    // 检查并存储文件
    const existingFile = await kvService.get(`files:${userId}:${file.id}`);
    if (!existingFile || file.updatedAt > existingFile.updatedAt) {
      await kvService.set(`files:${userId}:${file.id}`, {
        id: file.id,
        userId,
        name: file.name,
        content: file.content,
        updatedAt: file.updatedAt,
        _deleted: file._deleted || false
      });
    }

    // 检查并存储 fileList
    const existingFileList = await kvService.get(`fileList:${userId}`);
    const existingUpdatedAt = existingFileList?.updatedAt || 0;
    if (!existingFileList || fileList.updatedAt > existingUpdatedAt) {
      await kvService.set(`fileList:${userId}`, fileList);
    }

    return response({ success: true }, 201, origin);
  }

  // ==================== PUT /api/files/:fileId - 更新文件（直接保存，不做冲突检测） ====================
  if (pathname.startsWith('/api/files/') && method === 'PUT') {
    const fileId = pathname.split('/')[3];
    const body = await request.json();
    const { file, fileList } = body;

    if (!file || !file.updatedAt) {
      return response({ error: 'Invalid file data' }, 422, origin);
    }

    if (!fileList || !fileList.updatedAt) {
      return response({ error: 'Invalid fileList data' }, 422, origin);
    }

    // 直接保存，不检查存在性，避免边缘存储延迟问题
    await kvService.set(`files:${userId}:${fileId}`, {
      id: fileId,
      userId,
      name: file.name,
      content: file.content,
      updatedAt: file.updatedAt,
      _deleted: file._deleted || false
    });

    // 存储 fileList
    const existingFileList = await kvService.get(`fileList:${userId}`);
    const existingUpdatedAt = existingFileList?.updatedAt || 0;
    if (!existingFileList || fileList.updatedAt > existingUpdatedAt) {
      await kvService.set(`fileList:${userId}`, fileList);
    }

    return response({ success: true }, 200, origin);
  }

  // ==================== DELETE /api/files/:fileId - 删除文件（直接标记删除，不做冲突检测） ====================
  if (pathname.startsWith('/api/files/') && method === 'DELETE') {
    const fileId = pathname.split('/')[3];
    const body = await request.json() || {};
    const { file, fileList } = body;

    if (!file || !file.updatedAt) {
      return response({ error: 'Invalid file data' }, 422, origin);
    }

    if (!fileList || !fileList.updatedAt) {
      return response({ error: 'Invalid fileList data' }, 422, origin);
    }

    // 直接标记删除，不检查存在性，避免边缘存储延迟问题
    await kvService.set(`files:${userId}:${fileId}`, {
      id: fileId,
      userId,
      name: file.name,
      content: file.content,
      updatedAt: file.updatedAt,
      _deleted: true
    });

    // 存储 fileList
    const existingFileList = await kvService.get(`fileList:${userId}`);
    const existingUpdatedAt = existingFileList?.updatedAt || 0;
    if (!existingFileList || fileList.updatedAt > existingUpdatedAt) {
      await kvService.set(`fileList:${userId}`, fileList);
    }

    return response({ success: true }, 200, origin);
  }

  // ==================== GET /api/files/:fileId - 获取单个文件 ====================
  if (pathname.startsWith('/api/files/') && method === 'GET') {
    const fileId = pathname.split('/')[3];
    const file = await kvService.get(`files:${userId}:${fileId}`);

    if (!file) {
      return response({ error: 'File not found' }, 404, origin);
    }

    if (file.userId !== userId) {
      return response({ error: 'Forbidden' }, 403, origin);
    }

    return response(file, 200, origin);
  }

  return response({ error: 'Not found' }, 404, origin);
}

export default {
  async fetch(request) {
    return handleRequest(request);
  }
};
