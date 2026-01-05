<template>
  <transition name="dialog-fade">
    <div v-if="isVisible" class="dialog-overlay" @click="handleBackdropClick">
      <div class="dialog-content" @click.stop>
        <div class="dialog-header">
          <h2 class="dialog-title">{{ title }}</h2>
          <button class="dialog-close" @click="cancel">×</button>
        </div>
        <div class="dialog-body">
          <input
            v-model="inputValue"
            :type="inputType"
            :placeholder="placeholder"
            class="input"
            @keydown.enter="confirm"
            @keydown.escape="cancel"
            ref="inputRef"
            autofocus
          />
        </div>
        <div class="dialog-footer">
          <button class="dialog-btn dialog-btn-secondary" @click="cancel">{{ cancelText }}</button>
          <button class="dialog-btn dialog-btn-primary" @click="confirm" :disabled="!inputValue.trim()">
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

export interface InputDialogOptions {
  title?: string
  placeholder?: string
  defaultValue?: string
  confirmText?: string
  cancelText?: string
  inputType?: 'text' | 'number'
}

const isVisible = ref(false)
const title = ref('输入')
const placeholder = ref('请输入内容')
const inputValue = ref('')
const inputType = ref<'text' | 'number'>('text')
const confirmText = ref('确认')
const cancelText = ref('取消')
const inputRef = ref<HTMLInputElement | null>(null)

let resolveCallback: ((value: string | null) => void) | null = null

const showDialog = (options: InputDialogOptions): Promise<string | null> => {
  return new Promise((resolve) => {
    title.value = options.title || '输入'
    placeholder.value = options.placeholder || '请输入内容'
    inputValue.value = options.defaultValue || ''
    confirmText.value = options.confirmText || '确认'
    cancelText.value = options.cancelText || '取消'
    inputType.value = options.inputType || 'text'
    isVisible.value = true
    resolveCallback = resolve

    // 等待 DOM 更新后 focus
    nextTick(() => {
      inputRef.value?.focus()
      inputRef.value?.select()
    })
  })
}

const confirm = () => {
  const value = inputValue.value.trim()
  if (!value) return

  isVisible.value = false
  if (resolveCallback) {
    resolveCallback(value)
    resolveCallback = null
  }
}

const cancel = () => {
  isVisible.value = false
  if (resolveCallback) {
    resolveCallback(null)
    resolveCallback = null
  }
}

const handleBackdropClick = () => {
  cancel()
}

defineExpose({ showDialog })
</script>

<style scoped>
/* 样式已移至全局 style.css */
</style>
