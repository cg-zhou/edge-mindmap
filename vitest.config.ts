import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    // 使用 happy-dom 作为测试环境
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.ts'],
    // 测试超时时间（ms）
    testTimeout: 30000,
    // 钩子超时时间（ms）
    hookTimeout: 30000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
