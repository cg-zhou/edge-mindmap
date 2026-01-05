import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import authService from '@/utils/auth'
import type { UserProfile } from '@/types/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // isAuthenticated 现在直接看 user 是否存在，不依赖 token 的延迟读取
  const isAuthenticated = computed(() => user.value !== null)

  /**
   * 初始化认证状态（从localStorage恢复）
   */
  const initAuth = async () => {
    if (!authService.isAuthenticated()) {
      user.value = null
      return
    }

    try {
      loading.value = true
      user.value = await authService.getCurrentUser()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load user'
      authService.clearToken()
      user.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * 处理OAuth回调
   */
  const handleAuthCallback = async (token: string) => {
    try {
      loading.value = true
      authService.handleAuthCallback(token)
      user.value = await authService.getCurrentUser()
      error.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Authentication failed'
      authService.clearToken()
      user.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * 游客登录
   */
  const guestLogin = async () => {
    try {
      loading.value = true
      const token = await authService.guestLogin()
      authService.handleAuthCallback(token)
      user.value = await authService.getCurrentUser()
      error.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Guest login failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 注销
   */
  const logout = async () => {
    try {
      loading.value = true
      await authService.logout()
      user.value = null
      error.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Logout failed'
    } finally {
      loading.value = false
    }
  }

  /**
   * 删除账户
   */
  const deleteAccount = async () => {
    try {
      loading.value = true
      await authService.deleteAccount()
      user.value = null
      error.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Delete account failed'
    } finally {
      loading.value = false
    }
  }

  return {
    user,
    loading,
    error,
    isAuthenticated,
    initAuth,
    handleAuthCallback,
    guestLogin,
    logout,
    deleteAccount
  }
})
