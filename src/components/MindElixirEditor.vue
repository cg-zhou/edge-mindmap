<template>
  <div ref="container" class="mind-elixir-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import MindElixir from 'mind-elixir'
import 'mind-elixir/style.css'

interface Props {
  modelValue?: any
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false
})

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

const container = ref<HTMLDivElement>()
let mind: any = null
// @ts-ignore - 用于防止编辑器更新时的递归刷新
let isUpdating = false
let lastEmittedData: any = null
let pollTimer: number | null = null

// 初始化编辑器
const initMindElixir = () => {
  if (!container.value || mind) return

  mind = new MindElixir({
    el: container.value,
    locale: 'zh_CN' as any,
    theme: {
      name: 'LightBlue',
      type: 'dark',
      palette: ['rgba(255, 255, 255, 0.3)'],
      cssVar: {
        '--main-color': '#ffffff',
        '--main-bgcolor': '#111111',
        '--color': '#e2e8f0',
        '--bgcolor': '#111111',
        '--selected': '#ffffff',
        '--accent-color': '#ffffff',
        '--root-color': '#000000',
        '--root-bgcolor': '#ffffff',
        '--root-border-color': 'transparent',
        '--main-radius': '12px',
        '--root-radius': '12px',
        '--panel-color': '#ffffff',
        '--panel-bgcolor': '#222222',
        '--panel-border-color': 'rgba(255, 255, 255, 0.1)',
      } as any
    }
  })

  // 初始化数据
  const initialData = props.modelValue || MindElixir.new('新思维导图')
  mind.init(initialData)
  lastEmittedData = JSON.stringify(initialData)
  
  // 延迟启动轮询，避免初始化时误判数据变化
  // 延迟1秒后再启动轮询，此时数据应该已经稳定
  setTimeout(() => {
    // 使用轮询方式检测数据变化（MindElixir 的事件系统可能不稳定）
    pollTimer = window.setInterval(() => {
      if (!isUpdating && mind) {
        try {
          const currentData = mind.getData()
          const currentDataStr = JSON.stringify(currentData)
          
          // 避免重复发送相同数据
          if (currentDataStr !== lastEmittedData) {
            lastEmittedData = currentDataStr
            emit('update:modelValue', currentData)
          }
        } catch (error) {
          console.error('[MindElixirEditor] Error getting data:', error)
        }
      }
    }, 500)  // 每500ms检查一次
  }, 1000)  // 延迟1秒启动
}

// 监听数据变化 - 当从其他源（如切换文件）更新数据时刷新编辑器
watch(() => props.modelValue, (newData) => {
  if (mind && newData) {
    isUpdating = true
    try {
      mind.refresh(newData)
    } catch (error) {
      console.error('Failed to refresh mind data:', error)
    } finally {
      isUpdating = false
    }
  }
})

// 组件挂载
onMounted(() => {
  initMindElixir()
})

// 组件卸载
onBeforeUnmount(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (mind) {
    mind = null
  }
})

// 暴露方法
defineExpose({
  getData: () => mind?.getData(),
  refresh: (data: any) => {
    if (mind) {
      isUpdating = true
      mind.refresh(data)
      isUpdating = false
    }
  }
})
</script>

<style scoped>
.mind-elixir-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
