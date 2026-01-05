import axios from 'axios'
import type { AxiosInstance } from 'axios'
import type { UserProfile } from '@/types/auth'

/**
 * 前端认证模块
 * 负责Token管理和API调用
 */

const API_BASE = import.meta.env.VITE_API_BASE || ''
const TOKEN_KEY = 'authToken'
const TOKEN_EXPIRY_KEY = 'tokenExpiry'

class AuthService {
  private api: AxiosInstance
  private token: string | null = null
  private tokenExpiry: number = 0
  private currentUserCache: UserProfile | null = null
  private currentUserCacheTime: number = 0
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // 请求拦截器 - 添加token
    this.api.interceptors.request.use((config) => {
      const token = this.getToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    // 响应拦截器 - 处理401
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.clearToken()
          window.location.href = '/'
        }
        return Promise.reject(error)
      }
    )

    // 初始化时从localStorage读取token
    this.loadTokenFromStorage()
  }

  /**
   * 从localStorage加载token
   */
  private loadTokenFromStorage() {
    const token = localStorage.getItem(TOKEN_KEY)
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)

    if (token && expiry) {
      const expiryTime = parseInt(expiry, 10)
      if (expiryTime > Date.now()) {
        this.token = token
        this.tokenExpiry = expiryTime
      } else {
        this.clearToken()
      }
    }
  }

  /**
   * 获取当前token
   */
  getToken(): string | null {
    if (!this.token) {
      this.loadTokenFromStorage()
    }

    // 检查token是否过期
    if (this.token && this.tokenExpiry < Date.now()) {
      this.clearToken()
      return null
    }

    return this.token
  }

  /**
   * 保存token
   * @param token JWT Token
   * @param expiresIn Token有效期（秒）
   */
  setToken(token: string, expiresIn: number = 7 * 24 * 60 * 60) {
    this.token = token
    this.tokenExpiry = Date.now() + expiresIn * 1000

    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(TOKEN_EXPIRY_KEY, this.tokenExpiry.toString())
  }

  /**
   * 清除token
   */
  clearToken() {
    this.token = null
    this.tokenExpiry = 0
    this.currentUserCache = null
    this.currentUserCacheTime = 0
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
  }

  /**
   * 检查token是否有效
   */
  isAuthenticated(): boolean {
    return this.getToken() !== null
  }

  /**
   * 处理OAuth回调
   * @param token 从OAuth重定向得到的token
   */
  handleAuthCallback(token: string) {
    const expiresIn = 7 * 24 * 60 * 60 // 7天
    this.setToken(token, expiresIn)
    // 清理URL
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  /**
   * 游客登录（共享账号）
   */
  async guestLogin(): Promise<string> {
    try {
      const response = await this.api.post('/api/auth/guest')
      
      if (!response.data.token) {
        throw new Error(response.data.error || 'Guest login failed')
      }

      return response.data.token
    } catch (error) {
      throw error
    }
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<UserProfile> {
    // 检查缓存
    const now = Date.now()
    if (this.currentUserCache && (now - this.currentUserCacheTime) < this.CACHE_DURATION) {
      return this.currentUserCache
    }

    const response = await this.api.get('/api/auth/me')
    // 服务端返回完整的用户对象
    this.currentUserCache = response.data
    this.currentUserCacheTime = now
    return response.data
  }

  /**
   * 注销账户
   */
  async logout(): Promise<void> {
    this.clearToken()
  }

  /**
   * 删除账户
   */
  async deleteAccount(): Promise<void> {
    await this.api.delete('/api/auth/account')
    this.clearToken()
  }

  /**
   * 绑定额外的OAuth源
   */
  async bindOAuthProvider(provider: 'github' | 'microsoft', code: string): Promise<void> {
    await this.api.post('/api/auth/bind', { provider, code })
  }

  /**
   * 解除绑定的OAuth源
   */
  async unbindOAuthProvider(provider: 'github' | 'microsoft'): Promise<void> {
    await this.api.post('/api/auth/unbind', { provider })
  }
}

export default new AuthService()
