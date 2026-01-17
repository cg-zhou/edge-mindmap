<template>
    <transition name="dialog-fade">
        <div v-if="isVisible" class="dialog-overlay" @click="handleClose">
            <div class="dialog-content ai-dialog" @click.stop>
                <!-- 标题栏：对齐主页工具栏风格 -->
                <header class="ai-header">
                    <div class="header-left">
                        <span class="ai-icon">✨</span>
                        <h2 class="ai-title">AI 创作</h2>
                    </div>

                    <div class="header-center">
                        <!-- 运行状态与进度详情 -->
                        <transition name="fade">
                            <div v-if="hasStartedGenerating" class="ai-progress-info">
                                <span :class="['status-tag', isGenerating ? 'status-running' : 'status-done']">
                                    {{ isGenerating ? '正在构建' : '生成完毕' }}
                                </span>
                                <span class="node-count">
                                    已处理 <strong>{{ generatedCount }}</strong> 个思维节点
                                </span>
                                <span v-if="isGenerating" class="pulse-dot"></span>
                            </div>
                        </transition>
                    </div>

                    <div class="header-right">
                        <button class="close-btn" @click="handleClose" :disabled="isGenerating">✕</button>
                    </div>
                </header>

                <!-- 内容区 -->
                <div class="dialog-body">
                    <div class="layout-split">
                        <!-- 左侧：工作面板 -->
                        <div class="layout-left">
                            <div class="ai-hint">
                                在这里输入或粘贴您的想法，AI 会自动为您梳理层级结构并即时在右侧绘图。
                            </div>

                            <div class="flex-fill">
                                <textarea v-model="prompt" placeholder="例如：整理项目启动会的议程、总结一篇深度好文的要点、或是规划下个季度的学习计划..."
                                    class="ai-textarea" :disabled="isGenerating"></textarea>
                            </div>

                            <!-- 底部操作按钮：使用全局按钮样式 -->
                            <div class="side-actions">
                                <button class="btn btn-primary full-width" :disabled="!prompt.trim() || isGenerating"
                                    @click="handleGenerate">
                                    <span v-if="isGenerating" class="loading-spinner"></span>
                                    {{ isGenerating ? '正在思考中...' : (hasFinished ? '重新生成' : '开始创作') }}
                                </button>

                                <button v-if="hasFinished" class="btn btn-secondary full-width" @click="handleApply">
                                    完成，立即创建文件
                                </button>

                                <button class="btn btn-ghost full-width" @click="handleClose" :disabled="isGenerating">
                                    取消
                                </button>
                            </div>
                        </div>

                        <!-- 右侧：实时预览 -->
                        <div class="layout-right">
                            <div class="preview-container">
                                <!-- 独立 Iframe 隔离 -->
                                <iframe ref="previewIframe" src="/kityminder/index.html?mode=preview"
                                    class="preview-iframe"></iframe>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import aiService from '@/utils/ai'

const emit = defineEmits<{
    'success': [data: any]
    'close': []
}>()

const isVisible = ref(false)
const prompt = ref('')
const isGenerating = ref(false)
const hasFinished = ref(false)
const hasStartedGenerating = ref(false)
const currentStep = ref(0)
const generatedCount = ref(0)
const previewIframe = ref<HTMLIFrameElement | null>(null)
const previewReady = ref(false)
const finalResult = ref<any>(null)

// 引导页脑图数据
const INTRO_DATA = {
    root: {
        data: { text: '✨ AI 创作' },
        children: [
            {
                data: { text: '💡 功能说明' },
                children: [
                    { data: { text: '长文转脑图，智能提炼核心观点' } },
                    { data: { text: '层级自动分析' } }
                ]
            },
            {
                data: { text: '🚀 智能补全' },
                children: [
                    { data: { text: '短文补全，50字内自动发散思路' } },
                    { data: { text: '支持扩写，根据背景知识增强深度' } }
                ]
            },
            {
                data: { text: '⚡ 极速体验' },
                children: [
                    { data: { text: '流式渲染，节点实时同步展示' } },
                    { data: { text: '一键应用，直接创建思维导图' } }
                ]
            },
            {
                data: { text: '▶️ 操作简单' },
                children: [
                    { data: { text: '输入点什么' } },
                    { data: { text: '点击 “开始创作” ' } }
                ]
            }
        ]
    },
    template: 'right',
    theme: 'classic-compact'
}

// 增量更新维护的状态
let addedNodesSet = new Set<string>()

const handleMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === 'ready') {
        if (event.source === previewIframe.value?.contentWindow) {
            previewReady.value = true
        }
    }
}

onMounted(() => {
    window.addEventListener('message', handleMessage)
})

onBeforeUnmount(() => {
    window.removeEventListener('message', handleMessage)
})

const show = async () => {
    isVisible.value = true
    prompt.value = ''
    isGenerating.value = false
    hasFinished.value = false
    hasStartedGenerating.value = false
    currentStep.value = 0
    generatedCount.value = 0
    finalResult.value = null
    previewReady.value = false
    addedNodesSet.clear()

    // 等待并加载引导说明脑图
    let attempts = 0
    while (!previewReady.value && attempts < 50) {
        await new Promise(r => setTimeout(r, 100))
        attempts++
    }
    if (previewReady.value) {
        postToPreview('importJson', { data: INTRO_DATA })
    }
}

const handleClose = () => {
    if (isGenerating.value) return
    isVisible.value = false
    emit('close')
}

// 辅助方法：向预览 iframe 发送消息
const postToPreview = (type: string, data: any) => {
    if (previewIframe.value?.contentWindow) {
        previewIframe.value.contentWindow.postMessage({ type, ...data }, '*')
    }
}

// 增量同步节点：只添加尚未添加过的“完整”节点
const syncNodesIncrementally = (rawNodes: any[]) => {
    rawNodes.forEach((node: any) => {
        const nodeKey = `${node.parent || 'ROOT'}-${node.text}`

        if (!addedNodesSet.has(nodeKey)) {
            if (!node.parent) {
                // 根节点：使用 index.html 既有的 importJson 逻辑
                postToPreview('importJson', {
                    data: {
                        root: { data: node, children: [] },
                        theme: 'classic-compact',
                        template: 'right'
                    }
                })
            } else {
                // 子节点：适配 index.html 既有的 appendNode 字段 (parentText, node)
                postToPreview('appendNode', {
                    parentText: node.parent,
                    node: node
                })
            }
            addedNodesSet.add(nodeKey)
            generatedCount.value++
        }
    })
}

const handleGenerate = async () => {
    if (!prompt.value.trim()) return

    isGenerating.value = true
    hasFinished.value = false
    hasStartedGenerating.value = true
    currentStep.value = 0
    generatedCount.value = 0
    addedNodesSet.clear()
    finalResult.value = null

    // 等待 Iframe Ready
    const checkReady = async () => {
        let attempts = 0
        while (!previewReady.value && attempts < 50) {
            await new Promise(r => setTimeout(r, 100))
            attempts++
        }
    }
    await checkReady()

    // 清空预览区域的旧内容，并显示初始加载状态
    postToPreview('importJson', {
        data: {
            root: { data: { text: '正在规划结构...' }, children: [] },
            theme: 'classic-compact',
            template: 'right'
        }
    })

    // 模拟初始连接步进
    const timer = setTimeout(() => {
        if (currentStep.value === 0) currentStep.value = 1
    }, 1000)

    try {
        const result = await aiService.generateMindmap(prompt.value, (_tree, rawNodes) => {
            if (rawNodes.length > 0) {
                if (currentStep.value < 2) currentStep.value = 2
                // 执行增量同步
                syncNodesIncrementally(rawNodes)
            }
        })

        clearTimeout(timer)
        finalResult.value = result
        currentStep.value = 3
        isGenerating.value = false
        hasFinished.value = true
    } catch (error: any) {
        clearTimeout(timer)
        isGenerating.value = false
        alert(error.message || '生成失败，请重试')
    }
}

const handleApply = () => {
    if (finalResult.value) {
        // 注入选定的主题和模板
        const dataToApply = {
            ...finalResult.value,
            theme: 'classic-compact',
            template: 'right'
        }
        emit('success', dataToApply)
        isVisible.value = false
    }
}

defineExpose({ show })
</script>

<style scoped>
.ai-dialog {
    width: 100vw !important;
    max-width: none !important;
    height: 100vh !important;
    border-radius: 0 !important;
    display: flex;
    flex-direction: column;
    background: white;
}

/* 顶部栏风格对齐 Dashboard.vue */
.ai-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 24px;
    background: #ffffff;
    border-bottom: 1px solid var(--border-glass);
    height: 60px;
    box-sizing: border-box;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 12px;
}

.ai-icon {
    font-size: 20px;
}

.ai-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-main);
    margin: 0;
}

.header-center {
    flex: 1;
    display: flex;
    justify-content: center;
}

.ai-progress-info {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 16px;
    background: #f8fafc;
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-full);
    font-size: 13px;
}

.status-tag {
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
}

.status-running {
    background: #eff6ff;
    color: #3b82f6;
}

.status-done {
    background: #f0fdf4;
    color: #10b981;
}

.node-count strong {
    color: var(--color-primary);
    font-size: 15px;
}

.pulse-dot {
    width: 8px;
    height: 8px;
    background: #3b82f6;
    border-radius: 50%;
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0% {
        transform: scale(0.8);
        opacity: 0.5;
    }

    50% {
        transform: scale(1.2);
        opacity: 1;
    }

    100% {
        transform: scale(0.8);
        opacity: 0.5;
    }
}

.close-btn {
    background: var(--color-secondary);
    border: 1px solid var(--border-glass);
    color: var(--color-text-main);
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.close-btn:hover {
    background: #fee2e2;
    color: #ef4444;
    border-color: #fecaca;
}

/* 布局拆分 */
.dialog-body {
    flex: 1;
    overflow: hidden;
}

.layout-split {
    display: flex;
    height: 100%;
}

.layout-left {
    width: 380px;
    padding: 24px;
    border-right: 1px solid var(--border-glass);
    display: flex;
    flex-direction: column;
    background: #ffffff;
    gap: 16px;
}

.ai-hint {
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.6;
}

.ai-textarea {
    width: 100%;
    height: 100%;
    padding: 16px;
    border: 1px solid #e5e7eb;
    border-radius: var(--radius-lg);
    resize: none;
    line-height: 1.6;
    transition: all 0.2s;
    box-sizing: border-box;
    background: #f9fafb;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.ai-textarea:focus {
    outline: none;
    background: #ffffff;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 4px rgba(42, 95, 189, 0.1);
}

.side-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.full-width {
    width: 100%;
}

/* 右侧预览 */
.layout-right {
    flex: 1;
    background: #f1f5f9;
    position: relative;
    overflow: hidden;
}

.preview-container {
    width: 100%;
    height: 100%;
}

.preview-iframe {
    width: 100%;
    height: 100%;
    border: none;
    background: white;
}

.preview-placeholder {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    text-align: center;
}

.placeholder-icon {
    font-size: 48px;
    margin-bottom: 20px;
    opacity: 0.2;
}

.flex-fill {
    flex: 1;
}

/* 动画 */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.5s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
    transition: opacity 0.3s;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
    opacity: 0;
}
</style>
