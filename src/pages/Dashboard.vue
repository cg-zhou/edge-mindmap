<template>
  <div class="dashboard">
    <!-- 侧边栏 -->
    <aside class="sidebar" :class="{ collapsed: !showSidebar }">
      <FileListPanel :selectedFileId="selectedFileId" :loading="loading" @select-file="handleSelectFile"
        @create-file="handleCreateFile" @ai-create="handleAICreate" @delete-file="handleDeleteFile" @logout="handleLogout" />
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 顶部工具栏 -->
      <header v-if="selectedFile" class="header">
        <button class="toggle-btn" @click="showSidebar = !showSidebar">
          {{ showSidebar ? '‹' : '›' }}
        </button>
        <h1 class="title">{{ selectedFile.title }}</h1>
        <div class="actions">
          <span v-if="fileStore.saveState.message || lastSaveTime" class="save-status" :class="`status-${fileStore.saveState.status}`">
            <span class="status-text">{{ fileStore.saveState.message }}</span>
            <span v-if="lastSaveTime" class="status-time">{{ lastSaveTime }}</span>
          </span>

          <!-- 分享按钮 -->
          <button class="share-btn-top" @click="handleShare" :disabled="!selectedFile">
            <span class="share-icon">🔗</span>
            分享
          </button>

          <!-- 导出菜单 -->
          <div class="export-container">
            <button class="export-btn" @click="showExportDropdown = !showExportDropdown">
              导出
            </button>
            <transition name="fade">
              <div v-if="showExportDropdown" class="export-menu" @click.stop>
                <div class="menu-header">导出思维导图</div>
                <button @click="handleExport('png')">PNG 图片 (.png)</button>
                <button @click="handleExport('svg')">SVG 矢量图 (.svg)</button>
                <button @click="handleExport('markdown')">Markdown 格式 (.md)</button>
                <button @click="handleExport('json')">KityMinder 格式 (.km)</button>
              </div>
            </transition>
          </div>

          <button class="save-btn" @click="handleSave" :disabled="fileStore.saveState.status === 'saving'">
            保存
          </button>
        </div>
      </header>

      <!-- 编辑器区域 -->
      <div class="editor-area">
        <!-- 空状态 -->
        <div v-if="!selectedFile" class="empty-state">
          <p>选择左侧文件开始编辑</p>
        </div>

        <!-- 加载中 -->
        <div v-else-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>加载中...</p>
        </div>

        <!-- 编辑器 -->
        <KityMinderEditor ref="editorRef" v-else v-model="currentData" />
      </div>
    </main>

    <!-- 移动端遮罩 -->
    <div v-if="showSidebar && isMobile" class="overlay" @click="showSidebar = false" />

    <!-- AI 创作对话框 -->
    <AIDialog ref="aiDialogRef" @success="handleAISuccess" />

    <!-- 分享对话框 -->
    <ShareDialog ref="shareDialogRef" @confirm="performShare" @cancel="handleCancelShare" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useFileStore } from '@/stores/files'
import { dialog, message, file } from '@/utils/message'
import KityMinderEditor from '@/components/KityMinderEditor.vue'
import FileListPanel from '@/components/FileListPanel.vue'
import AIDialog from '@/components/AIDialog.vue'
import ShareDialog from '@/components/ShareDialog.vue'
import fileService from '@/utils/files'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const fileStore = useFileStore()

// 引用
const aiDialogRef = ref<any>(null)
const editorRef = ref<any>(null)
const shareDialogRef = ref<any>(null)

// 状态
const selectedFileId = ref<string | null>(null)
const currentData = ref<any>(null)
const showSidebar = ref(true)
const showExportDropdown = ref(false)
const hasChanges = ref(false)
const lastSaveTime = ref<string>('')
const isLoadingFile = ref(false)  // 标记是否正在加载文件
const isSyncingShare = ref(false) // 标记是否正在同步分享内容
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let timeUpdateTimer: ReturnType<typeof setInterval> | null = null

// 计算属性
const files = computed(() => fileStore.files)
const loading = computed(() => fileStore.loading)
const selectedFile = computed(() =>
  files.value.find(f => f.id === selectedFileId.value)
)
const isMobile = computed(() => window.innerWidth < 768)

// 分享逻辑
const sharedFiles = ref<Set<string>>(new Set()) // 记录本会话中分享过的文件

const handleShare = async () => {
  if (!selectedFile.value) return

  // 1. 获取分享状态
  const shareId = selectedFile.value.id
  const targetUrl = `${window.location.origin}/share/${shareId}`
  
  // 2. 如果已经分享过，直接带链接打开；否则打开引导页（不传参数）
  if (selectedFile.value.isShared) {
    shareDialogRef.value.show(targetUrl)
  } else {
    shareDialogRef.value.show()
  }
}

// 真正执行分享的操作（由对话框确认触发）
const performShare = async () => {
  if (!selectedFile.value || !editorRef.value) return

  // 1. 设置加载状态
  shareDialogRef.value.setLoading(true)
  sharedFiles.value.add(selectedFile.value.id)

  try {
    // 2. 获取脑图截图 (SVG)
    const svgData = await editorRef.value.getExportData('svg')
    
    // 3. 调用后端分享接口 
    const shareId = selectedFile.value.id
    const shareUrl = await fileService.shareFile(
      shareId,
      currentData.value, // JSON 数据用于 SEO
      svgData,           // SVG 数据用于展示
      selectedFile.value.title
    )

    // 4. 更新对话框状态并同步本地状态
    shareDialogRef.value.setUrl(shareUrl)
    fileStore.setSharedStatus(selectedFile.value.id, true)
  } catch (error: any) {
    console.error('Share failed:', error)
    shareDialogRef.value.setLoading(false)
  }
}

// 取消分享
const handleCancelShare = async () => {
  if (!selectedFile.value) return
  
  const confirmed = await dialog.confirm({
    title: '停止分享',
    message: '确定要停止分享该思维导图吗？停止后已发出的链接将失效。',
    confirmText: '确定停止',
    isDanger: true
  })

  if (!confirmed) return

  try {
    shareDialogRef.value.setCancelling(true)
    const success = await fileService.cancelShare(selectedFile.value.id)
    if (success) {
      sharedFiles.value.delete(selectedFile.value.id)
      fileStore.setSharedStatus(selectedFile.value.id, false)
      shareDialogRef.value.setUrl('')
      message.success('已停止分享')
    } else {
      message.error('取消分享失败')
      shareDialogRef.value.setCancelling(false)
    }
  } catch (err) {
    message.error('操作失败')
    shareDialogRef.value.setCancelling(false)
  }
}

// 静默同步分享内容
const syncShareContent = async () => {
  if (!selectedFile.value || !editorRef.value || !selectedFile.value.isShared) return

  isSyncingShare.value = true
  try {
    const svgData = await editorRef.value.getExportData('svg')
    await fileService.shareFile(
      selectedFile.value.id,
      currentData.value,
      svgData,
      selectedFile.value.title
    )
    console.log('[Dashboard] Share snapshot synced automatically')
  } catch (error) {
    console.warn('[Dashboard] Silent share sync failed:', error)
  } finally {
    isSyncingShare.value = false
  }
}

// 选择文件
const handleSelectFile = async (fileId: string) => {
  console.log(`[Dashboard] handleSelectFile called: ${fileId}, currentSelected: ${selectedFileId.value}`)
  if (selectedFileId.value === fileId) {
    console.log('[Dashboard] Same file, skipping')
    return
  }

  selectedFileId.value = fileId
  hasChanges.value = false
  lastSaveTime.value = '' // 切换文件时重置保存时间

  // 更新 URL 路由
  if (route.params.fileId !== fileId) {
    router.push(`/file/${fileId}`)
  }

  console.log(`[Dashboard] Setting isLoadingFile=true before loading`)
  isLoadingFile.value = true  // 标记开始加载文件
  try {
    console.log(`[Dashboard] Calling fileStore.loadFile(${fileId})`)
    await fileStore.loadFile(fileId)
    console.log(`[Dashboard] fileStore.loadFile completed, isLoadingFile=${isLoadingFile.value}`)
    if (fileStore.currentFile) {
      // 确保数据格式正确
      const content = fileStore.currentFile.content
      // 检查是否是有效的 KityMinder 内容（包含 root 属性）
      console.log(`[Dashboard] About to assign currentData.value, isLoadingFile=${isLoadingFile.value}`)
      if (content && typeof content === 'object' && 'root' in content) {
        console.log(`[Dashboard] Assigning valid KityMinder content`)
        currentData.value = content
      } else {
        // 使用默认数据结构
        console.log(`[Dashboard] Assigning default KityMinder`)
        currentData.value = {
          root: { data: { text: selectedFile.value?.title || '新思维导图' }, children: [] },
          template: 'default',
          theme: 'fresh-blue'
        }
      }
      console.log(`[Dashboard] currentData assigned, isLoadingFile=${isLoadingFile.value}`)
    }
  } finally {
    console.log(`[Dashboard] Calling nextTick to defer isLoadingFile=false`)
    // 使用 nextTick 延迟重置 flag，确保 watch 在 flag=true 时执行
    await nextTick()
    console.log(`[Dashboard] Setting isLoadingFile=false after nextTick`)
    isLoadingFile.value = false  // 标记加载完成
  }
}

// 创建文件
const handleCreateFile = async () => {
  console.log('[Dashboard] handleCreateFile called')
  // 弹出创建文件对话框（包含文件名和模板选择）
  const result = await file.createFile()
  console.log('[Dashboard] createFile result:', result)
  
  // 如果用户取消了，直接返回
  if (!result) {
    console.log('[Dashboard] User cancelled')
    return
  }

  // 创建文件（使用选中的模板）
  const newFile = await fileStore.createFile(result.fileName, result.templateId)
  await handleSelectFile(newFile.id)
}

// AI 创作相关
const handleAICreate = () => {
  if (aiDialogRef.value) {
    aiDialogRef.value.show()
  }
}

const handleAISuccess = async (mindmapData: any) => {
  try {
    // 自动取根节点的文字作为文件名
    const rootText = mindmapData.root?.data?.text || 'AI 生成的思维导图'
    // 创建文件（不使用模板，直接传 customContent）
    const newFile = await fileStore.createFile(rootText, undefined, mindmapData)
    await handleSelectFile(newFile.id)
  } catch (error: any) {
    console.error('Failed to create AI file:', error)
  }
}

// 删除文件
const handleDeleteFile = async (fileId: string) => {
  // 获取文件名用于确认提示
  const fileToDelete = files.value.find(f => f.id === fileId)
  const fileName = fileToDelete?.title || '此文件'
  
  const confirmed = await dialog.confirmDelete(fileName)
  if (!confirmed) return

  await fileStore.deleteFile(fileId)
  if (selectedFileId.value === fileId) {
    selectedFileId.value = null
    currentData.value = null
    // 删除当前文件后，导航到文件列表或第一个文件
    if (files.value.length > 0) {
      await handleSelectFile(files.value[0]!.id)
    } else {
      router.push('/dashboard')
    }
  }
}

// 格式化显示时间 HH:MM 或 HH:MM:SS
const formatSaveTime = () => {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  // 显示分钟级别
  return `${hours}:${minutes}`
}

// 启动时间更新
const startTimeUpdate = () => {
  if (timeUpdateTimer) {
    clearInterval(timeUpdateTimer)
  }
  timeUpdateTimer = setInterval(() => {
    if (fileStore.saveState.status === 'saved') {
      lastSaveTime.value = formatSaveTime()
    }
  }, 1000)
}

// 保存文件 - 支持手动同步（无需修改也能保存）
const handleSave = async () => {
  if (!selectedFile.value) return

  try {
    // 既然使用了 v-model，currentData.value 已经是最新数据
    const latestData = currentData.value
    
    await fileStore.saveFile(selectedFile.value.id, latestData)
    hasChanges.value = false
    
    // 更新时间显示
    lastSaveTime.value = formatSaveTime()
    startTimeUpdate()

    // 如果该文件处于分享状态，自动同步到快照
    syncShareContent()
  } catch (err) {
    console.error('保存失败:', err)
  }
}
// 导出脑图
const handleExport = (format: any) => {
  if (editorRef.value) {
    editorRef.value.exportData(format)
  }
  showExportDropdown.value = false
}
// 自动保存 - 防抖实现
const triggerAutoSave = async () => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }
  
  // 2秒后自动保存
  autoSaveTimer = setTimeout(async () => {
    console.log(`[Dashboard] Auto-save timer fired at ${new Date().toISOString()}, hasChanges=${hasChanges.value}, selectedFile=${selectedFile.value?.id}`)
    if (hasChanges.value && selectedFile.value) {
      try {
        console.log(`[Dashboard] Starting auto-save for file: ${selectedFile.value.id}`)
        const latestData = currentData.value
        await fileStore.saveFile(selectedFile.value.id, latestData)
        hasChanges.value = false
        
        // 更新时间显示
        lastSaveTime.value = formatSaveTime()
        startTimeUpdate()
        console.log(`[Dashboard] Auto-save completed for file: ${selectedFile.value.id}`)

        // 如果该文件处于分享状态，自动同步到快照
        syncShareContent()
      } catch (err) {
        console.error('自动保存失败:', err)
      }
    }
    autoSaveTimer = null
  }, 2000)
}

// 退出登录
const handleLogout = async () => {
  const confirmed = await dialog.confirmExit()
  if (!confirmed) return
  await authStore.logout()
  router.push('/')
}

// 响应式处理
const handleResize = () => {
  if (window.innerWidth >= 1200) {
    showSidebar.value = true
  } else if (window.innerWidth < 768) {
    showSidebar.value = false
  }
}

// 生命周期
onMounted(async () => {
  await fileStore.loadFiles()
  
  // 优先从 URL 路由参数获取 fileId
  const fileIdFromRoute = route.params.fileId as string | undefined
  if (fileIdFromRoute) {
    // 检查文件是否存在
    const fileExists = files.value.some(f => f.id === fileIdFromRoute)
    if (fileExists) {
      await handleSelectFile(fileIdFromRoute)
    } else {
      // 文件不存在，使用第一个文件
      if (files.value.length > 0) {
        await handleSelectFile(files.value[0]!.id)
      }
    }
  } else if (files.value.length > 0) {
    // 如果没有 fileId 参数，选择第一个文件
    await handleSelectFile(files.value[0]!.id)
  }

  window.addEventListener('resize', handleResize)
  
  handleResize()
})

// 监听路由参数变化
watch(
  () => route.params.fileId,
  async (newFileId) => {
    if (newFileId && newFileId !== selectedFileId.value) {
      await handleSelectFile(newFileId as string)
    }
  }
)

// 监听编辑内容变化，触发自动保存
watch(
  () => currentData.value,
  () => {
    console.log(`[Dashboard] watch callback triggered: isLoadingFile=${isLoadingFile.value}, hasChanges=${hasChanges.value}`)
    if (!isLoadingFile.value) {
      console.log(`[Dashboard] currentData changed (isLoadingFile=false), triggering auto-save`)
      hasChanges.value = true
      triggerAutoSave()
    } else {
      console.log(`[Dashboard] currentData changed but isLoadingFile=true, skipping auto-save`)
    }
  },
  { deep: true }
)

onBeforeUnmount(() => {
  // 清理定时器
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }
  if (timeUpdateTimer) {
    clearInterval(timeUpdateTimer)
  }
  
  window.removeEventListener('resize', handleResize)
  
  // 最后的机会保存未保存的改动
  if (hasChanges.value && selectedFile.value) {
    const latestData = currentData.value
    fileStore.saveFile(selectedFile.value.id, latestData).catch(err => {
      console.error('卸载时保存失败:', err)
    })
  }
})
</script>

<style scoped>
.dashboard {
  display: flex;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  background: var(--bg-gradient);
}

.sidebar {
  width: 280px;
  flex-shrink: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 10;
  box-shadow: 2px 0 8px #0000001a;
}

.sidebar.collapsed {
  width: 0;
  opacity: 0;
  overflow: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
}

.header {
  display: flex;
  align-items: center;
  padding: 0 20px;
  background: #ffffff;
  border-bottom: 1px solid var(--border-glass);
  gap: 16px;
  padding: 10px 24px;
}

.toggle-btn {
  background: var(--color-secondary);
  border: 1px solid var(--border-glass);
  color: var(--color-text-main);
  font-size: 20px;
  cursor: pointer;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
  line-height: 1;
}

.toggle-btn:hover {
  background: #e5e7eb;
  border-color: #d1d5db;
}

.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-main);
  margin: 0;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.save-status {
  font-size: 13px;
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-secondary);
  background: var(--color-secondary);
  border: 1px solid var(--border-glass);
}

.status-text {
  display: inline-block;
}

.status-time {
  display: inline-block;
  font-size: 12px;
  opacity: 0.6;
  border-left: 1px solid var(--border-glass);
  padding-left: 8px;
}

.save-status.status-saving {
  color: var(--color-primary);
  background: #eff6ff;
  border-color: #dbeafe;
}

.save-status.status-saved {
  color: var(--color-success);
  background: #f0fdf4;
  border-color: #dcfce7;
}

.save-status.status-error {
  color: var(--color-danger);
  background: #fef2f2;
  border-color: #fee2e2;
}

.save-btn {
  padding: 6px 20px;
  background: var(--color-primary);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.save-btn:hover:not(:disabled) {
  background: #0284c7;
  transform: translateY(-1px);
}

.save-btn:active:not(:disabled) {
  transform: translateY(0);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: #9ca3af;
}

/* 编辑器区域 */
.editor-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #f8fafc;
}

.empty-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-secondary);
  background: #ffffff;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f4f6;
  border-top-color: var(--color-primary);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}


@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 遮罩 */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  backdrop-filter: blur(2px);
}

/* 导出菜单 */
.export-container {
  position: relative;
}

.share-btn-top {
  padding: 6px 12px;
  background-color: #f0f7ff;
  color: var(--color-primary);
  border: 1px dashed var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.share-btn-top:hover:not(:disabled) {
  background-color: #e1f0ff;
  border-style: solid;
}

.share-icon {
  font-size: 12px;
}

.share-btn-top:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-btn {
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

.export-btn:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.export-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 180px;
  background: white;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  padding: 4px;
  display: flex;
  flex-direction: column;
}

.menu-header {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: 4px;
}

.export-menu button {
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

.export-menu button:hover {
  background: #f1f5f9;
  color: var(--color-primary);
}
</style>
