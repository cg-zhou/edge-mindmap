<template>
  <div class="file-list-panel">
    <!-- 头部 - 新建按钮 -->
    <div class="panel-header">
      <button class="btn-new-file" @click="createNewFile">+ 新建</button>
      <button class="btn-ai-file" @click="$emit('ai-create')">✨ AI 创作</button>
    </div>

    <!-- 文件列表 -->
    <div class="panel-content">
      <div v-if="loading && files.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>

      <div v-else-if="files.length === 0" class="empty-state">
        <p>还没有内容</p>
        <p style="font-size: 12px; opacity: 0.6;">点击上方"新建"开始</p>
      </div>

      <div v-else class="file-list">
        <div
          v-for="file in files"
          :key="file.id"
          class="file-item"
          :class="{ active: selectedFileId === file.id }"
          @click="selectFile(file.id)"
          @dblclick="renameFile(file.id, file.title)"
          @contextmenu.prevent="showFileMenu($event, file.id, file.title)"
        >
          <div class="file-info">
            <div class="file-name">
              {{ file.title }}
              <span v-if="file.isShared" class="share-badge" title="已分享">🔗</span>
            </div>
            <div class="file-time" :title="new Date(file.updatedAt).toLocaleString('zh-CN')">
              {{ formatDate(file.updatedAt) }}
            </div>
          </div>
          <div class="file-actions">
            <button class="btn-rename" @click.stop="renameFile(file.id, file.title)" title="重命名">✎</button>
            <button class="btn-delete" @click.stop="deleteFile(file.id)" title="删除">✕</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部 - 本地存储说明 -->
    <div class="panel-footer">
      <span class="local-badge">本地保存</span>
      <span class="local-tip">内容仅保存在当前浏览器</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFileStore } from '@/stores/files'
import { message, input } from '@/utils/message'

interface Props {
  selectedFileId: string | null
  loading: boolean
}

interface Emits {
  (e: 'select-file', fileId: string): void
  (e: 'create-file'): void
  (e: 'ai-create'): void
  (e: 'delete-file', fileId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const fileStore = useFileStore()

const files = computed(() => fileStore.files)

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) {
    return '刚刚'
  } else if (minutes < 60) {
    return `${minutes}分钟前`
  } else if (hours < 24) {
    return `${hours}小时前`
  } else if (days === 1) {
    return '昨天'
  } else if (days < 7) {
    return `${days}天前`
  } else {
    return date.toLocaleDateString('zh-CN')
  }
}

const selectFile = (fileId: string) => {
  emit('select-file', fileId)
}

const createNewFile = async () => {
  emit('create-file')
}

const deleteFile = (fileId: string) => {
  // 直接触发事件，由 Dashboard 负责确认
  emit('delete-file', fileId)
}

const renameFile = async (fileId: string, currentTitle: string) => {
  const newTitle = await input.promptText({
    title: '重命名文件',
    placeholder: '请输入新的文件名',
    defaultValue: currentTitle
  })

  if (newTitle && newTitle.trim() && newTitle !== currentTitle) {
    try {
      await fileStore.renameFile(fileId, newTitle.trim())
      message.success('文件已重命名')
    } catch (error) {
      message.error('重命名失败，请重试')
      console.error('Rename error:', error)
    }
  }
}

const showFileMenu = (_event: MouseEvent, fileId: string, title: string) => {
  // 右键菜单处理 - 现在只支持重命名
  renameFile(fileId, title)
}

</script>

<style scoped>
.file-list-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-right: 1px solid var(--border-glass);
}

.panel-header {
  padding: 10px;
  border-bottom: 1px solid var(--border-glass);
  flex-shrink: 0;
  display: flex;
  gap: 8px;
}

.btn-new-file {
  flex: 1;
  padding: 6px 12px;
  background: var(--color-primary);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.btn-new-file:hover {
  background: #0284c7;
  transform: translateY(-1px);
}

.btn-ai-file {
  flex: 1;
  padding: 6px 12px;
  background-color: #f0f7ff;
  color: var(--color-primary);
  border: 1px dashed var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.btn-ai-file:hover {
  background-color: #e1f0ff;
  border-style: solid;
}

.btn-new-file:active {
  transform: translateY(0);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
}

.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.file-item:hover {
  background: #f3f4f6;
}

.file-item.active {
  background: #eff6ff;
  border-color: #dbeafe;
}

.file-info {
  flex: 1;
  min-width: 0;
  margin-right: 12px;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-main);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 6px;
}

.share-badge {
  font-size: 10px;
  background: #f0f7ff;
  color: #2a5fbd;
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid #dbeafe;
  flex-shrink: 0;
}

.file-item.active .file-name {
  color: var(--color-primary);
}

.file-time {
  font-size: 11px;
  color: var(--color-text-muted);
}

.file-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.file-item:hover .file-actions {
  opacity: 1;
}

.btn-rename,
.btn-delete {
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 14px;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-rename:hover {
  background: #e5e7eb;
  color: var(--color-primary);
}

.btn-delete:hover {
  background: #fee2e2;
  color: var(--color-danger);
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: var(--color-text-secondary);
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

.panel-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-glass);
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.local-badge {
  padding: 3px 7px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #047857;
  font-size: 11px;
  font-weight: 500;
}

.local-tip {
  color: var(--color-text-muted);
  font-size: 11px;
}

</style>
