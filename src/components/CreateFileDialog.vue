<template>
  <transition name="dialog-fade">
    <div v-if="showDialog" class="dialog-overlay" @click="handleClose">
      <div class="dialog-content" @click.stop>
        <!-- 标题 -->
        <div class="dialog-header">
          <h2 class="dialog-title">新建思维导图</h2>
          <button class="dialog-close" @click="handleClose">×</button>
        </div>

        <!-- 内容区 -->
        <div class="dialog-body">
          <!-- 模板选择 -->
          <div class="form-group">
            <label class="form-label">选择模板</label>
            <div class="templates-grid">
              <div
                v-for="template in templates"
                :key="template.id"
                class="template-card"
                :class="{ selected: selectedTemplateId === template.id }"
                @click="handleTemplateSelect(template)"
              >
                <div class="template-icon">{{ template.icon }}</div>
                <div class="template-info">
                  <div class="template-name">{{ template.name }}</div>
                  <div class="template-desc">{{ template.description }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 文件名输入 -->
          <div class="form-group">
            <label class="form-label">文件名</label>
            <input
              v-model="fileName"
              type="text"
              placeholder="输入文件名（如：我的项目规划）"
              class="input"
              @input="handleNameInput"
              @keyup.enter="confirmCreate"
              ref="inputRef"
            />
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="dialog-footer">
          <button class="dialog-btn dialog-btn-secondary" @click="handleClose">取消</button>
          <button class="dialog-btn dialog-btn-primary" :disabled="!fileName.trim()" @click="confirmCreate">
            创建
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { TEMPLATE_LIST } from '@/constants/templates'
import type { MindmapTemplate } from '@/constants/templates'

const emit = defineEmits<{
  'create': [fileName: string, templateId: string]
  'close': []
}>()

const fileName = ref('我的思维导图')
const selectedTemplateId = ref<string>('blank')
const templates = ref<MindmapTemplate[]>(TEMPLATE_LIST)
const inputRef = ref<HTMLInputElement | null>(null)
const isManualFileName = ref(false)
const showDialog = ref(false)
let dialogPromiseResolve: ((value: { fileName: string; templateId: string } | null) => void) | null = null

// 监听 showDialog 变化，自动聚焦
watch(() => showDialog.value, (newVal) => {
  if (newVal) {
    isManualFileName.value = false
    if (selectedTemplateId.value === 'blank') {
      fileName.value = '我的思维导图'
    }
    nextTick(() => {
      inputRef.value?.focus()
      inputRef.value?.select()
    })
  }
})

const handleTemplateSelect = (template: MindmapTemplate) => {
  selectedTemplateId.value = template.id
  if (!isManualFileName.value) {
    fileName.value = template.id === 'blank' ? '我的思维导图' : template.name
    nextTick(() => inputRef.value?.select())
  }
}

const handleNameInput = () => {
  isManualFileName.value = true
}

const confirmCreate = () => {
  if (!fileName.value.trim()) return
  console.log('[CreateFileDialog.confirmCreate] fileName:', fileName.value, 'templateId:', selectedTemplateId.value)
  const result = { fileName: fileName.value, templateId: selectedTemplateId.value }
  
  // 如果有 Promise 等待（从 showDialog 方法调用），直接resolve
  if (dialogPromiseResolve) {
    console.log('[CreateFileDialog.confirmCreate] resolving promise')
    dialogPromiseResolve(result)
    dialogPromiseResolve = null
  }
  
  // 同时触发事件（保持向后兼容）
  emit('create', result.fileName, result.templateId)
  showDialog.value = false
  reset()
}

// 处理关闭
const handleClose = () => {
  console.log('[CreateFileDialog.handleClose] called')
  if (dialogPromiseResolve) {
    console.log('[CreateFileDialog.handleClose] resolving promise with null')
    dialogPromiseResolve(null)
    dialogPromiseResolve = null
  }
  emit('close')
  showDialog.value = false
  reset()
}

// 暴露重置方法
const reset = () => {
  fileName.value = '我的思维导图'
  selectedTemplateId.value = 'blank'
  isManualFileName.value = false
}

// 暴露 showDialog 方法，返回 Promise
const openDialog = (): Promise<{ fileName: string; templateId: string } | null> => {
  console.log('[CreateFileDialog.openDialog] called')
  return new Promise((resolve) => {
    console.log('[CreateFileDialog.openDialog] setting showDialog to true')
    dialogPromiseResolve = resolve
    showDialog.value = true
    console.log('[CreateFileDialog.openDialog] showDialog is now:', showDialog.value)
  })
}

defineExpose({
  reset,
  showDialog: openDialog
})
</script>

<style scoped>
.form-group {
  margin-bottom: 24px;
}

.form-label {
  display: block;
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
  font-weight: 500;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.template-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 12px 8px;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-default);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: all 0.2s ease;
}

.template-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.template-card.selected {
  background: rgba(14, 165, 233, 0.15);
  border-color: var(--color-accent);
}

.template-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.template-info {
  width: 100%;
  min-width: 0;
}

.template-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-main);
  margin-bottom: 2px;
}

.template-desc {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
