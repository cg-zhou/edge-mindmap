import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'

// 版本管理：当后端 KV 结构发生重大变更时，通过提升版本号强制清空本地过时的 Token 和缓存
const APP_STORAGE_VERSION = 'v1.1-20260115'
const currentVersion = localStorage.getItem('app_storage_version')
if (currentVersion !== APP_STORAGE_VERSION) {
  localStorage.clear()
  localStorage.setItem('app_storage_version', APP_STORAGE_VERSION)
}

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
