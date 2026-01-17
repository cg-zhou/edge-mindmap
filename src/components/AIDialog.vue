<template>
    <transition name="dialog-fade">
        <div v-if="isVisible" class="dialog-overlay">
            <div class="dialog-content ai-dialog">
                <!-- 标题栏：对齐主页工具栏风格 -->
                <header class="ai-header">
                    <div class="header-left">
                        <span class="ai-icon">✨</span>
                        <h2 class="ai-title">AI 创作</h2>
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
                                输入一些想法或关键词，使用 AI 辅助创作思维导图：
                            </div>

                            <!-- 灵感标签 -->
                            <div class="inspiration-tags">
                                <button v-for="tag in inspirationExamples" :key="tag.title" class="tag-item"
                                    @click="useInspiration(tag)">
                                    <span class="tag-text">{{ tag.title }}</span>
                                </button>
                            </div>

                            <div class="flex-fill">
                                <textarea v-model="prompt"
                                    placeholder="试试看：&#10;1. 粘贴一段复杂的文章，让我帮你理清逻辑&#10;2. 输入一个简单的词（如‘元宇宙’），看我为你发散脑洞&#10;3. 描述一个项目目标，自动生成执行计划..."
                                    class="ai-textarea" :disabled="isGenerating"></textarea>
                            </div>

                            <!-- 底部操作按钮：使用全局按钮样式 -->
                            <div class="side-actions">
                                <button class="btn btn-primary full-width" :disabled="!prompt.trim() || isGenerating"
                                    @click="handleGenerate">
                                    <span v-if="isGenerating" class="loading-spinner"></span>
                                    {{ isGenerating ? '正在生成...' : (hasFinished ? '重新生成' : '开始创作') }}
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
                            <!-- AI 预览工具栏 -->
                            <div class="preview-toolbar">
                                <div class="toolbar-left">
                                    <AIProgressLine :currentStep="currentStep" :generatedCount="generatedCount" />
                                </div>
                                <div class="toolbar-right">
                                    <div class="ai-export-container">
                                        <button class="ai-export-btn" @click="showExportDropdown = !showExportDropdown">
                                            导出
                                        </button>
                                        <transition name="fade">
                                            <div v-if="showExportDropdown" class="ai-export-menu" @click.stop>
                                                <button @click="handleExport('png')">PNG 图片 (.png)</button>
                                                <button @click="handleExport('svg')">SVG 矢量图 (.svg)</button>
                                                <button @click="handleExport('markdown')">Markdown 格式 (.md)</button>
                                                <button @click="handleExport('json')">KityMinder 格式 (.km)</button>
                                            </div>
                                        </transition>
                                    </div>
                                </div>
                            </div>
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
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import aiService from '@/utils/ai'
import AIProgressLine from './AIProgressLine.vue'

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
const showExportDropdown = ref(false)
const finalResult = ref<any>(null)

const useInspiration = (tag: any) => {
    if (isGenerating.value) return
    prompt.value = tag.content
}

// 灵感示例数据
const PROTAGONISTS = ['张无忌', '杨过', '令狐冲', '郭靖', '乔峰', '段誉']
const DESTINATIONS = [
    { name: '川西', spots: '鱼子西、四姑娘山', tip: '防高反提示' },
    { name: '新疆', spots: '赛里木湖、喀纳斯', tip: '注意防吹风防晒' },
    { name: '大理', spots: '洱海、喜洲古镇', tip: '享受慢生活' },
    { name: '西安', spots: '兵马俑、大唐不夜城', tip: '探寻古都文化' },
    { name: '北京', spots: '故宫、环球影城', tip: '感受古今交融' },
    { name: '成都', spots: '大熊猫基地、太古里', tip: '品尝地道美食' },
    { name: '杭州', spots: '西湖、灵隐寺', tip: '漫步如画江南' },
    { name: '西藏', spots: '布达拉宫、纳木错', tip: '预防高原反应' },
    { name: '厦门', spots: '鼓浪屿、环岛路', tip: '吹吹海边的风' }
]

const inspirationExamples = ref([
    {
        title: '📝 示例 1：Vibe Coding',
        content: `“Vibe Coding”是软件开发中一个新兴且定义较为宽泛的术语，指的是引导 AI 工具生成代码而不是手动编写代码的做法。

在软件工程中，开发正在从严格的手动编码转向更灵活、由 AI 驱动的方式，而 Vibe Coding正处于这一变革的前沿。Vibe Coding是由著名计算机科学家 Andrej Karpathy 在 2025 年 2 月提出的，并强调了 AI 工具在软件开发中的重要性。

这一概念与人工智能 (AI) 技术的发展趋势相一致，尤其是大语言模型 (LLM)，如 ChatGPT、Claude 以及 OpenAI 的 Codex，它们帮助开发者保持创作状态并实现编码工作的自动化。

Vibe Coding是一种新的编程方式，用户可以用自然语言表达意图，AI 会将这些想法转换为可执行代码。Vibe Coding的目标是创建一个人工智能驱动的开发环境，在该环境中，AI 智能体可作为编码助手，实时提出建议、自动执行繁琐的流程，甚至生成标准的代码库结构。

通过优先进行实验，然后再优化结构和性能，Vibe Coding采用了一种“先编码，后优化”的思维方式。这为开发者提供了机会，使他们能够先构建，再优化。此外，在敏捷框架中，Vibe Coding符合快速原型设计、迭代开发和周期性反馈循环原则。这使企业能够专注于这些原则，同时促进创新、本能式问题解决能力以及灵活的编码能力。然而，AI 只能生成代码，而真正的创造力、目标一致性以及跳出固有框架的思维仍然是人类独有的，因此人类的参与和监督非常重要，不能被取代。`
    },
    {
        title: '🔍 示例 2：张无忌',
        content: '张无忌'
    },
    {
        title: '📅 示例 3：周报计划',
        content: '一份的项目周报思维导图框架，包含：本周进展、问题与方案、下周计划、风险预警'
    },
    {
        title: '🏔️ 示例 4：川西旅游规划',
        content: '我想去川西旅游，请帮我规划一个 5 天左右的自驾游行程。需要包含：必去景点（如鱼子西、四姑娘山）、住宿建议、防高反提示、以及每个站点的特色体验。'
    }
])

// 引导页脑图数据
const INTRO_DATA = {
    root: {
        data: { text: '✨ AI 创作' },
        children: [
            {
                data: { text: '💡 深度提炼' },
                children: [
                    { data: { text: '长文转脑图，秒出核心观点' } },
                    { data: { text: '自动理清逻辑层级' } }
                ]
            },
            {
                data: { text: '🚀 概念发散' },
                children: [
                    { data: { text: '输入词组，为你补全思维脉络' } },
                    { data: { text: '基于大模型能力增强深度' } }
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
                    { data: { text: '输入一些想法或关键词' } },
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
const listParentPriorityMap = new Map<string, number>()
const priorityParentSet = new Set<string>()

const handleMessage = (event: MessageEvent) => {
    // 必须验证消息来源，防止响应主编辑器或其他实例的导出请求
    if (event.source !== previewIframe.value?.contentWindow) return

    if (event.data && event.data.type === 'ready') {
        previewReady.value = true
    } else if (event.data && event.data.type === 'exportDataResult') {
        const { format, content } = event.data
        handleDownload(format, content)
    }
}

const handleExport = (format: string) => {
    postToPreview('exportData', { format })
    showExportDropdown.value = false
}

const handleDownload = (format: string, content: any) => {
    let blob: Blob
    let filename = `ai_mindmap_${new Date().getTime()}`

    if (format === 'png' || format === 'jpg') {
        const byteString = atob(content.split(',')[1])
        const mimeString = content.split(',')[0].split(':')[1].split(';')[0]
        const ab = new ArrayBuffer(byteString.length)
        const ia = new Uint8Array(ab)
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i)
        }
        blob = new Blob([ab], { type: mimeString })
        filename += `.${format}`
    } else if (format === 'svg') {
        blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' })
        filename += '.svg'
    } else if (format === 'markdown') {
        blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
        filename += '.md'
    } else {
        const jsonStr = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
        blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' })
        filename += '.km'
    }

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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
    listParentPriorityMap.clear()
    priorityParentSet.clear()

    // 随机化示例内容
    const hero = PROTAGONISTS[Math.floor(Math.random() * PROTAGONISTS.length)]
    inspirationExamples.value[1].title = `🔍 示例 2：${hero}`
    inspirationExamples.value[1].content = hero

    const dest = DESTINATIONS[Math.floor(Math.random() * DESTINATIONS.length)]
    inspirationExamples.value[3].title = `🏔️ 示例 4：${dest.name}旅游规划`
    inspirationExamples.value[3].content = `我想去${dest.name}旅游，请帮我规划一个 5 天左右的自驾游行程。需要包含：必去景点（如${dest.spots}）、住宿建议、${dest.tip}、以及每个站点的特色体验。`

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
            // 处理优先级逻辑：如果父节点被标记为 isList，则自动递增分配 priority
            if (node.parent && priorityParentSet.has(node.parent)) {
                const currentCount = (listParentPriorityMap.get(node.parent) || 0) + 1
                listParentPriorityMap.set(node.parent, currentCount)
                node.priority = currentCount
            }

            // 如果本节点被标记为 isList，记录它
            if (node.isList) {
                priorityParentSet.add(node.text)
            }

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
    listParentPriorityMap.clear()
    priorityParentSet.clear()
    finalResult.value = null

    // 重新初始化预览 iframe，防止之前的位移影响视觉
    previewReady.value = false
    if (previewIframe.value) {
        previewIframe.value.src = '/kityminder/index.html?mode=preview&t=' + Date.now()
    }

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
            root: { data: { text: '正在生成...' }, children: [] },
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
    width: 85vw !important;
    max-width: none !important;
    height: 85vh !important;
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

.header-right {
    display: flex;
    align-items: center;
}

/* AI 预览工具栏 */
.preview-toolbar {
    height: 48px;
    background: white;
    border-bottom: 1px solid var(--border-glass);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    z-index: 10;
}

.toolbar-left {
    display: flex;
    align-items: center;
}

.toolbar-right {
    display: flex;
    align-items: center;
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

.ai-export-container {
    position: relative;
    /* margin-right: 12px; */
}

.ai-export-btn {
    padding: 6px 16px;
    background: white;
    border: 1px solid var(--border-glass);
    color: var(--color-text-main);
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.ai-export-btn:hover {
    background: #f8fafc;
}

.ai-export-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 160px;
    background: white;
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    padding: 4px;
    display: flex;
    flex-direction: column;
}

.ai-export-menu button {
    width: 100%;
    padding: 8px 12px;
    text-align: left;
    background: transparent;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    color: var(--color-text-main);
    cursor: pointer;
    transition: all 0.2s;
}

.ai-export-menu button:hover {
    background: #f1f5f9;
    color: var(--color-primary);
}

/* 布局拆分 */
.dialog-body {
    flex: 1;
    overflow: hidden;
    padding-top: 0 !important;
}

.layout-split {
    display: flex;
    height: 100%;
}

.layout-left {
    width: 380px;
    padding: 16px;
    border-right: 1px solid var(--border-glass);
    display: flex;
    flex-direction: column;
    background: #ffffff;
    gap: 10px;
}

.ai-hint {
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.6;
}

.inspiration-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 4px;
}

.tag-item {
    padding: 6px 12px;
    background-color: #f0f7ff;
    color: var(--color-primary);
    border: 1px dashed var(--color-primary);
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    display: flex;
    align-items: center;
    justify-content: center;
}

.tag-item:hover {
    background-color: #e1f0ff;
    border-style: solid;
    transform: translateY(-1px);
}

.ai-textarea {
    width: 100%;
    height: 100%;
    padding: 12px;
    border: 1px solid #e5e7eb;
    border-radius: var(--radius-sm);
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
    display: flex;
    flex-direction: column;
}

.preview-container {
    flex: 1;
    width: 100%;
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
