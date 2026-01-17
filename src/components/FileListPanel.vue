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

    <!-- 底部 - 用户信息 -->
    <div class="panel-footer">
      <div class="user-info">
        <img
          v-if="authStore.user?.avatar_url"
          :src="authStore.user.avatar_url"
          :alt="authStore.user?.name"
          class="user-avatar"
        />
        <div v-else class="user-avatar-placeholder">{{ authStore.user?.name?.charAt(0) || '游' }}</div>
        <div class="user-details">
          <div class="user-name">{{ authStore.user?.name }}</div>
        </div>
      </div>
      <button class="btn-logout" @click="logout">退出</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
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
  (e: 'logout'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const authStore = useAuthStore()
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

const logout = async () => {
  // 直接触发事件，由 Dashboard 负责确认
  emit('logout')
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
  padding: 16px;
  border-top: 1px solid var(--border-glass);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
  border: 1px solid var(--border-glass);
}

.user-avatar-placeholder {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #e5e7eb;
  color: #4b5563;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--color-text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-logout {
  width: 100%;
  padding: 8px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  color: #4b5563;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-logout:hover {
  background: #f9fafb;
  border-color: #9ca3af;
  color: var(--color-danger);
}

</style>
