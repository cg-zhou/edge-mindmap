<template>
  <div class="km-editor-container">
    <iframe
      ref="iframeRef"
      src="/kityminder/index.html"
      class="km-iframe"
      @load="onIframeLoad"
    ></iframe>
    <div v-if="!isReady" class="loading-overlay">
      <div class="spinner"></div>
      <p>正在初始化脑图编辑器...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import type { MindmapContent } from '@/types/files'

interface Props {
  modelValue?: MindmapContent
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false
})

const emit = defineEmits<{
  'update:modelValue': [value: MindmapContent]
}>()

const iframeRef = ref<HTMLIFrameElement | null>(null)
const isReady = ref(false)
let isInternalUpdate = false

// 处理来自 iframe 的消息
const handleMessage = (event: MessageEvent) => {
  if (event.data && event.data.type === 'ready') {
    isReady.value = true
    sendDataToEditor()
  } else if (event.data && event.data.type === 'exportJson') {
    const data = event.data.data
    isInternalUpdate = true
    emit('update:modelValue', data)
    // 重置 flag
    setTimeout(() => {
      isInternalUpdate = false
    }, 100)
  }
}

const onIframeLoad = () => {
  // iframe 加载完成后的备用处理逻辑
}

const sendDataToEditor = () => {
  if (isReady.value && iframeRef.value?.contentWindow && props.modelValue) {
    iframeRef.value.contentWindow.postMessage({
      type: 'importJson',
      data: JSON.parse(JSON.stringify(props.modelValue)) // 解除响应式连接
    }, '*')
  }
}

// 监听外部数据变化
watch(() => props.modelValue, () => {
  if (isInternalUpdate) return
  sendDataToEditor()
}, { deep: true })

onMounted(() => {
  window.addEventListener('message', handleMessage)
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage)
})
</script>

<style scoped>
.km-editor-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f5f5f5;
}

.km-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: white;
  z-index: 10;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
