// 测试全局设置
import { beforeAll, afterAll } from 'vitest'

// 设置测试环境变量
process.env.EDGE_FUNCTION_API = process.env.EDGE_FUNCTION_API || 'http://localhost:8787/api'
process.env.VITE_API_URL = process.env.EDGE_FUNCTION_API

beforeAll(() => {
  console.log(`测试环境: ${process.env.EDGE_FUNCTION_API}`)
})

afterAll(() => {
  console.log('所有测试已完成')
})
