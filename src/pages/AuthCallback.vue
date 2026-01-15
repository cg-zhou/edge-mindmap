<template>
  <div class="auth-callback-page">
    <div class="auth-callback-card" v-if="loading">
      <div class="spinner"></div>
      <p class="callback-text">正在验证登录信息...</p>
    </div>

    <div class="auth-callback-card error" v-else-if="error">
      <p class="callback-title error-title">❌ 登录失败</p>
      <p class="callback-message">{{ error }}</p>
      <button class="btn btn-primary" @click="goToLogin" style="margin-top: 20px;">返回登录</button>
    </div>

    <div class="auth-callback-card success" v-else-if="success">
      <p class="callback-title success-title">✓ 登录成功</p>
      <p class="callback-message">正在跳转...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const error = ref<string | null>(null)
const success = ref(false)

onMounted(async () => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s超时

  try {
    // 从URL获取code（OAuth回调）
    const searchParams = new URLSearchParams(window.location.search)
    const code = searchParams.get('code')
    const token = searchParams.get('token')

    if (code) {
      // 获取登录方式
      const provider = sessionStorage.getItem('oauth_provider') || 'microsoft'
      sessionStorage.removeItem('oauth_provider')
      
      let receivedToken: string
      
      if (provider === 'microsoft') {
        // Microsoft: 调用后端换取 token
        const apiBase = import.meta.env.VITE_API_BASE || 'https://mindmap.cg-zhou.top'
        const response = await fetch(`${apiBase}/api/auth/microsoft?code=${code}`, {
          signal: controller.signal
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        
        const data = await response.json()
        if (data.token) {
          receivedToken = data.token
        } else {
          error.value = data.error || '登录失败'
          return
        }
      } else {
        error.value = '未知的登录方式'
        return
      }
      
      // 保存 token 并延迟跳转，让用户看到成功提示
      await authStore.handleAuthCallback(receivedToken)
      success.value = true
      await new Promise(r => setTimeout(r, 1500))
      
      // 最后才清理URL
      window.history.replaceState({}, document.title, window.location.pathname)
      router.push('/dashboard')
    } else if (token) {
      // 直接收到token（从后端重定向）
      await authStore.handleAuthCallback(token)
      success.value = true
      await new Promise(r => setTimeout(r, 1500))
      window.history.replaceState({}, document.title, window.location.pathname)
      router.push('/dashboard')
    } else {
      error.value = '未获取到授权信息'
    }
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        error.value = '登录请求超时，请重试'
      } else {
        error.value = err.message
      }
    } else {
      error.value = '登录失败，请重试'
    }
  } finally {
    clearTimeout(timeoutId)
    loading.value = false
  }
})

function goToLogin() {
  router.push('/')
}
</script>

<style scoped>
.auth-callback-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg-gradient);
  padding: 20px;
}

.auth-callback-card {
  background: #ffffff;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  padding: 40px;
  width: 100%;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  color: var(--color-text-main);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f4f6;
  border-top-color: var(--color-primary);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
  margin: 0 auto 20px;
}


@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.callback-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 10px;
}

.success-title {
  color: var(--color-text-main);
}

.error-title {
  color: var(--color-danger);
}

.callback-message {
  margin: 10px 0 20px;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.callback-text {
  margin-top: 20px;
  font-size: 14px;
  color: var(--color-text-secondary);
}
</style>
