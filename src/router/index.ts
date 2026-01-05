import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/pages/Home.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/auth/callback',
    name: 'AuthCallback',
    component: () => import('@/pages/AuthCallback.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/pages/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/file/:fileId',
    name: 'FileEditor',
    component: () => import('@/pages/Dashboard.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

/**
 * 路由守卫 - 检查认证状态
 */
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  // 检查目标路由是否需要认证
  if (to.meta.requiresAuth) {
    // 如果用户信息为空且token也为空，则需要初始化认证状态
    if (!authStore.user && !authStore.isAuthenticated) {
      // 尝试从localStorage恢复
      await authStore.initAuth()
    }
    
    // 检查认证是否成功
    if (!authStore.isAuthenticated) {
      // 需要认证但未认证，重定向到登录页
      next('/')
      return
    }
  }

  // 允许导航
  next()
})

export default router
