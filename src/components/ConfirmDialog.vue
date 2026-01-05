<template>
  <transition name="dialog-fade">
    <div v-if="isVisible" class="dialog-overlay" @click="handleBackdropClick">
      <div class="dialog-content" @click.stop>
        <div class="dialog-header">
          <h2 class="dialog-title">{{ title }}</h2>
          <button class="dialog-close" @click="cancel">×</button>
        </div>
        <div class="dialog-body">
          <p>{{ message }}</p>
        </div>
        <div class="dialog-footer">
          <button class="dialog-btn dialog-btn-secondary" @click="cancel">{{ cancelText }}</button>
          <button class="dialog-btn dialog-btn-primary" @click="confirm" :class="{ danger: isDanger }">
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref } from 'vue'

export interface DialogOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  isDanger?: boolean
}

const isVisible = ref(false)
const title = ref('确认')
const message = ref('')
const confirmText = ref('确认')
const cancelText = ref('取消')
const isDanger = ref(false)

let resolveCallback: ((value: boolean) => void) | null = null

const showDialog = (options: DialogOptions): Promise<boolean> => {
  return new Promise((resolve) => {
    title.value = options.title || '确认'
    message.value = options.message
    confirmText.value = options.confirmText || '确认'
    cancelText.value = options.cancelText || '取消'
    isDanger.value = options.isDanger ?? false
    isVisible.value = true
    resolveCallback = resolve
  })
}

const confirm = () => {
  isVisible.value = false
  if (resolveCallback) {
    resolveCallback(true)
    resolveCallback = null
  }
}

const cancel = () => {
  isVisible.value = false
  if (resolveCallback) {
    resolveCallback(false)
    resolveCallback = null
  }
}

const handleBackdropClick = () => {
  cancel()
}

defineExpose({ showDialog })
</script>
