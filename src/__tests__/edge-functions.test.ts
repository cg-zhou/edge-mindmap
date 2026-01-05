import { describe, it, expect, beforeEach } from 'vitest'

/**
 * 边缘函数完整测试
 * 测试 API 合约和时间戳比较逻辑
 */

const API_URL = process.env.EDGE_FUNCTION_API || 'http://localhost:8787/api'

// ==================== 辅助函数 ====================

async function request(
  method: string,
  endpoint: string,
  body?: Record<string, any>,
  token?: string
): Promise<any> {
  const url = `${API_URL}${endpoint}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  let data: any = null
  const text = await response.text()

  if (text) {
    try {
      data = JSON.parse(text)
    } catch (e) {
      data = text
    }
  }

  return {
    status: response.status,
    ok: response.ok,
    data
  }
}

/**
 * 等待文件列表同步
 */
async function waitForFileListSync(
  expectedUpdatedAt: number,
  token: string,
  maxRetries = 20,
  retryDelay = 500
): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    const result = await request('GET', '/files', undefined, token)
    
    if (result.status === 200 && result.data.updatedAt >= expectedUpdatedAt) {
      return result
    }
    
    await new Promise(r => setTimeout(r, retryDelay))
  }
  
  throw new Error(`FileList sync timeout after ${maxRetries * retryDelay}ms`)
}

/**
 * 等待文件同步（检查文件存在且时间戳正确）
 */
async function waitForFileSync(
  fileId: string,
  expectedUpdatedAt: number,
  token: string,
  maxRetries = 20,
  retryDelay = 500
): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    const result = await request('GET', `/files/${fileId}`, undefined, token)
    
    if (result.status === 200 && result.data.updatedAt >= expectedUpdatedAt) {
      return result
    }
    
    await new Promise(r => setTimeout(r, retryDelay))
  }
  
  throw new Error(`File sync timeout for ${fileId} after ${maxRetries * retryDelay}ms`)
}

// ==================== 测试 ====================

describe('认证接口', () => {
  describe('游客登录', () => {
    it('应该成功获取游客 token', async () => {
      const result = await request('POST', '/auth/guest')

      expect(result.status).toBe(200)
      expect(result.data).toHaveProperty('token')
      expect(result.data).toHaveProperty('user')
      expect(result.data.user.id).toBe('guest')
      expect(result.data.user.provider).toBe('guest')
    })

    it('多次游客登录应该返回不同 token', async () => {
      const result1 = await request('POST', '/auth/guest')
      const result2 = await request('POST', '/auth/guest')

      expect(result1.data.token).not.toBe(result2.data.token)
      expect(result1.data.user.id).toBe(result2.data.user.id) // 但 userId 相同
    })
  })

  describe('获取当前用户信息', () => {
    it('应该返回当前登录用户信息', async () => {
      const loginResult = await request('POST', '/auth/guest')
      const token = loginResult.data.token

      const meResult = await request('GET', '/auth/me', undefined, token)

      expect(meResult.status).toBe(200)
      expect(meResult.data.id).toBe('guest')
      expect(meResult.data.provider).toBe('guest')
    })

    it('无效 token 应该返回 401', async () => {
      const result = await request('GET', '/auth/me', undefined, 'invalid-token')

      expect(result.status).toBe(401)
      expect(result.data.error).toBe('Invalid token')
    })

    it('无 token 应该返回 401', async () => {
      const result = await request('GET', '/auth/me')

      expect(result.status).toBe(401)
      expect(result.data.error).toBe('Unauthorized')
    })
  })
})

describe('文件管理接口', () => {
  let authToken: string

  beforeEach(async () => {
    const loginResult = await request('POST', '/auth/guest')
    authToken = loginResult.data.token
  })

  describe('创建文件（POST /api/files）', () => {
    it('应该成功创建文件和更新 fileList', async () => {
      const clientTime = Date.now()

      const result = await request(
        'POST',
        '/files',
        {
          file: {
            id: `test-${clientTime}`,
            name: `test-${clientTime}.md`,
            content: '# 测试内容',
            updatedAt: clientTime,
            _deleted: false
          },
          fileList: {
            files: [
              { id: `test-${clientTime}`, name: `test-${clientTime}.md`, updatedAt: clientTime }
            ],
            updatedAt: clientTime
          }
        },
        authToken
      )

      // 允许 201 或 599（网络超时但可能已成功）
      expect([201, 599]).toContain(result.status)
      
      // 如果返回 201，验证响应
      if (result.status === 201) {
        expect(result.data.success).toBe(true)
      }
      
      // 无论如何，等待同步后验证数据已保存
      const syncResult = await waitForFileSync(`test-${clientTime}`, clientTime, authToken)
      expect(syncResult.status).toBe(200)
      expect(syncResult.data.content).toBe('# 测试内容')
    }, 30000) // 增加超时时间到 30s)

    it('缺少 updatedAt 应该返回 422', async () => {
      const clientTime = Date.now()

      const result = await request(
        'POST',
        '/files',
        {
          file: {
            id: `test-${clientTime}`,
            name: 'test.md',
            content: 'content'
            // 缺少 updatedAt
          },
          fileList: {
            files: [],
            updatedAt: clientTime
          }
        },
        authToken
      )

      expect(result.status).toBe(422)
    })

    it('无 token 应该返回 401', async () => {
      const clientTime = Date.now()

      const result = await request('POST', '/files', {
        file: {
          id: `test-${clientTime}`,
          name: 'test.md',
          content: 'content',
          updatedAt: clientTime
        },
        fileList: {
          files: [],
          updatedAt: clientTime
        }
      })

      expect(result.status).toBe(401)
    })
  })

  describe('获取文件列表（GET /api/files）', () => {
    it('应该返回空文件列表和 updatedAt', async () => {
      const result = await request('GET', '/files', undefined, authToken)

      expect(result.status).toBe(200)
      expect(Array.isArray(result.data.files)).toBe(true)
      expect(typeof result.data.updatedAt).toBe('number')
    })

    it('应该返回之前创建的文件', async () => {
      const t1 = Date.now()

      // 创建文件
      await request(
        'POST',
        '/files',
        {
          file: {
            id: `list-test-${t1}`,
            name: `list-test-${t1}.md`,
            content: '测试内容',
            updatedAt: t1
          },
          fileList: {
            files: [
              { id: `list-test-${t1}`, name: `list-test-${t1}.md`, updatedAt: t1 }
            ],
            updatedAt: t1
          }
        },
        authToken
      )

      // 等待同步后获取列表
      const getResult = await waitForFileListSync(t1, authToken)

      expect(getResult.status).toBe(200)
      expect(getResult.data.files.length).toBeGreaterThan(0)
      expect(getResult.data.files.some((f: any) => f.id === `list-test-${t1}`)).toBe(true)
    })
  })

  describe('获取单个文件（GET /api/files/:fileId）', () => {
    it('应该返回文件内容', async () => {
      const t1 = Date.now()

      // 创建文件
      const createResult = await request(
        'POST',
        '/files',
        {
          file: {
            id: `fetch-test-${t1}`,
            name: `fetch-test-${t1}.md`,
            content: '# 获取测试',
            updatedAt: t1
          },
          fileList: {
            files: [{ id: `fetch-test-${t1}`, name: `fetch-test-${t1}.md`, updatedAt: t1 }],
            updatedAt: t1
          }
        },
        authToken
      )

      expect(createResult.status).toBe(201)

      // 等待同步后获取文件
      const getResult = await waitForFileSync(`fetch-test-${t1}`, t1, authToken)

      expect(getResult.status).toBe(200)
      expect(getResult.data.id).toBe(`fetch-test-${t1}`)
      expect(getResult.data.content).toBe('# 获取测试')
      expect(getResult.data.updatedAt).toBe(t1)
    })

    it('不存在的文件应该返回 404', async () => {
      const result = await request('GET', '/files/nonexistent', undefined, authToken)

      expect(result.status).toBe(404)
    })
  })

  describe('更新文件（PUT /api/files/:fileId）', () => {
    it('时间戳较新时应该接受更新', async () => {
      const t1 = Date.now()

      // 创建文件
      await request(
        'POST',
        '/files',
        {
          file: {
            id: `update-test-${t1}`,
            name: `update-test-${t1}.md`,
            content: '初始内容',
            updatedAt: t1
          },
          fileList: {
            files: [{ id: `update-test-${t1}`, name: `update-test-${t1}.md`, updatedAt: t1 }],
            updatedAt: t1
          }
        },
        authToken
      )

      // 等待文件同步完成
      await waitForFileSync(`update-test-${t1}`, t1, authToken)

      // 更新文件
      await new Promise(r => setTimeout(r, 100))
      const t2 = Date.now()

      const updateResult = await request(
        'PUT',
        `/files/update-test-${t1}`,
        {
          file: {
            id: `update-test-${t1}`,
            name: `update-test-${t1}.md`,
            content: '更新内容',
            updatedAt: t2
          },
          fileList: {
            files: [{ id: `update-test-${t1}`, name: `update-test-${t1}.md`, updatedAt: t2 }],
            updatedAt: t2
          }
        },
        authToken
      )

      expect(updateResult.status).toBe(200)
      expect(updateResult.data.success).toBe(true)

      // 等待同步后验证更新成功
      const getResult = await waitForFileSync(`update-test-${t1}`, t2, authToken)
      expect(getResult.data.content).toBe('更新内容')
      expect(getResult.data.updatedAt).toBe(t2)
    })

    it('时间戳较旧时应该拒绝（409 冲突）', async () => {
      const t1 = Date.now()

      // 创建文件
      await request(
        'POST',
        '/files',
        {
          file: {
            id: `conflict-test-${t1}`,
            name: `conflict-test-${t1}.md`,
            content: '初始内容',
            updatedAt: t1
          },
          fileList: {
            files: [{ id: `conflict-test-${t1}`, name: `conflict-test-${t1}.md`, updatedAt: t1 }],
            updatedAt: t1
          }
        },
        authToken
      )

      // 等待文件同步完成
      await waitForFileSync(`conflict-test-${t1}`, t1, authToken)

      // 用更旧时间戳更新
      const t0 = t1 - 1000

      const updateResult = await request(
        'PUT',
        `/files/conflict-test-${t1}`,
        {
          file: {
            id: `conflict-test-${t1}`,
            name: `conflict-test-${t1}.md`,
            content: '冲突内容',
            updatedAt: t0
          },
          fileList: {
            files: [],
            updatedAt: t0
          }
        },
        authToken
      )

      expect(updateResult.status).toBe(409)
      expect(updateResult.data.serverUpdatedAt).toBe(t1)
    })
  })

  describe('删除文件（DELETE /api/files/:fileId）', () => {
    it('时间戳较新时应该标记删除', async () => {
      const t1 = Date.now()

      // 创建文件
      await request(
        'POST',
        '/files',
        {
          file: {
            id: `delete-test-${t1}`,
            name: `delete-test-${t1}.md`,
            content: '将被删除',
            updatedAt: t1
          },
          fileList: {
            files: [{ id: `delete-test-${t1}`, name: `delete-test-${t1}.md`, updatedAt: t1 }],
            updatedAt: t1
          }
        },
        authToken
      )

      // 等待文件同步完成
      await waitForFileSync(`delete-test-${t1}`, t1, authToken)

      // 删除文件
      await new Promise(r => setTimeout(r, 100))
      const t2 = Date.now()

      const deleteResult = await request(
        'DELETE',
        `/files/delete-test-${t1}`,
        {
          file: {
            id: `delete-test-${t1}`,
            name: `delete-test-${t1}.md`,
            content: '将被删除',
            updatedAt: t2
          },
          fileList: {
            files: [],
            updatedAt: t2
          }
        },
        authToken
      )

      expect(deleteResult.status).toBe(200)
      expect(deleteResult.data.success).toBe(true)

      // 等待同步后验证文件被标记删除
      const getResult = await waitForFileSync(`delete-test-${t1}`, t2, authToken)
      expect(getResult.status).toBe(200)
      expect(getResult.data._deleted).toBe(true)
    })

    it('时间戳较旧时应该拒绝', async () => {
      const t1 = Date.now()

      // 创建文件
      await request(
        'POST',
        '/files',
        {
          file: {
            id: `delete-conflict-${t1}`,
            name: `delete-conflict-${t1}.md`,
            content: '内容',
            updatedAt: t1
          },
          fileList: {
            files: [{ id: `delete-conflict-${t1}`, name: `delete-conflict-${t1}.md`, updatedAt: t1 }],
            updatedAt: t1
          }
        },
        authToken
      )

      // 等待文件同步完成
      await waitForFileSync(`delete-conflict-${t1}`, t1, authToken)

      // 用更旧时间戳删除
      const t0 = t1 - 1000

      const deleteResult = await request(
        'DELETE',
        `/files/delete-conflict-${t1}`,
        {
          file: {
            id: `delete-conflict-${t1}`,
            name: `delete-conflict-${t1}.md`,
            content: '内容',
            updatedAt: t0
          },
          fileList: {
            files: [],
            updatedAt: t0
          }
        },
        authToken
      )

      expect(deleteResult.status).toBe(409)
    })
  })
})
