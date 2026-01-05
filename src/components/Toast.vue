<template>
  <div class="toast-container">
    <transition-group name="toast" tag="div">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast', `toast-${toast.type}`]"
        role="alert"
      >
        <div class="toast-icon">
          <span v-if="toast.type === 'success'" class="icon-check">✓</span>
          <span v-else-if="toast.type === 'error'" class="icon-error">✕</span>
          <span v-else-if="toast.type === 'warning'" class="icon-warning">⚠</span>
          <span v-else class="icon-info">ℹ</span>
        </div>
        <div class="toast-message">{{ toast.message }}</div>
        <button class="toast-close" @click="removeToast(toast.id)">×</button>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

export interface ToastMessage {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

const toasts = ref<ToastMessage[]>([])
let nextId = 0

const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration = 3000) => {
  const id = `toast-${nextId++}`
  const toast: ToastMessage = { id, message, type, duration }
  toasts.value.push(toast)

  if (duration > 0) {
    setTimeout(() => removeToast(id), duration)
  }

  return id
}

const removeToast = (id: string) => {
  const index = toasts.value.findIndex(t => t.id === id)
  if (index > -1) {
    toasts.value.splice(index, 1)
  }
}

const clearAll = () => {
  toasts.value = []
}

// 导出方法供其他组件使用
defineExpose({ addToast, removeToast, clearAll })
</script>
