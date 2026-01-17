<template>
  <div class="km-editor-container">
    <iframe
      ref="iframeRef"
      :src="iframeSrc"
      class="km-iframe"
      @load="onIframeLoad"
    ></iframe>
    <div v-if="!isReady" class="loading-overlay">
      <div class="spinner"></div>
      <p>正在初始化思维导图编辑器...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import type { MindmapContent } from '@/types/files'

interface Props {
  modelValue?: MindmapContent
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false
})

const iframeSrc = computed(() => {
  let url = '/kityminder/index.html'
  if (props.readonly) {
    url += '?mode=preview&mode=readonly'
  }
  return url
})

const emit = defineEmits<{
  'update:modelValue': [value: MindmapContent]
}>()

const iframeRef = ref<HTMLIFrameElement | null>(null)
const isReady = ref(false)
let isInternalUpdate = false

// 处理来自 iframe 的消息
const handleMessage = (event: MessageEvent) => {
  if (event.source !== iframeRef.value?.contentWindow) return

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
  } else if (event.data && event.data.type === 'exportDataResult') {
    // 触发下载逻辑
    const { format, content, silent } = event.data;
    if (!silent) {
        handleDownload(format, content);
    }
  }
}

// 导出方法：供外部组件调用
const exportData = (format: 'png' | 'jpg' | 'svg' | 'markdown' | 'json') => {
  if (isReady.value && iframeRef.value?.contentWindow) {
    iframeRef.value.contentWindow.postMessage({
      type: 'exportData',
      format: format
    }, '*');
  }
}

// 导出并获取原始数据 (用于分享或同步)
const getExportData = (format: 'png' | 'svg' | 'markdown' | 'json'): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!isReady.value || !iframeRef.value?.contentWindow) {
      reject(new Error('编辑器未就绪'))
      return
    }

    const handler = (event: MessageEvent) => {
      // 必须验证来源和类型
      if (event.source !== (iframeRef.value ? iframeRef.value.contentWindow : null)) return
      if (event.data && event.data.type === 'exportDataResult' && event.data.format === format) {
        window.removeEventListener('message', handler)
        resolve(event.data.content)
      }
    }

    window.addEventListener('message', handler)

    // 设置超时，防止死等
    setTimeout(() => {
      window.removeEventListener('message', handler)
      reject(new Error('导出接口响应超时'))
    }, 5000)

    iframeRef.value.contentWindow.postMessage({
      type: 'exportData',
      format: format,
      silent: true // 告诉 iframe 和 父组件：不需要触发浏览器下载
    }, '*')
  })
}

// 通用下载处理
const handleDownload = (format: string, content: any) => {
  let blob: Blob;
  let filename = `mindmap_${new Date().getTime()}`;

  if (format === 'png' || format === 'jpg') {
    // content 是 DataURL (base64)
    const byteString = atob(content.split(',')[1]);
    const mimeString = content.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    blob = new Blob([ab], { type: mimeString });
    filename += `.${format}`;
  } else if (format === 'svg') {
    blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
    filename += '.svg';
  } else if (format === 'markdown') {
    blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    filename += '.md';
  } else {
    // JSON / KM
    const jsonStr = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    filename += '.km';
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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

defineExpose({ exportData, getExportData })
</script>

<style scoped>
.km-editor-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f8fafc;
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
  background: #ffffff;
  z-index: 10;
  color: var(--color-text-secondary);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f4f6;
  border-top-color: var(--color-primary);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}


@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
