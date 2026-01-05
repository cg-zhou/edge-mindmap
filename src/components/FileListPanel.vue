<template>
  <div class="file-list-panel">
    <!-- 头部 - 新建按钮 -->
    <div class="panel-header">
      <button class="btn-new-file" @click="createNewFile">+ 新建</button>
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
            <div class="file-name">{{ file.title }}</div>
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
  background: var(--bg-panel);
  border-right: 1px solid var(--border-glass);
  backdrop-filter: blur(20px);
}

.panel-header {
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.btn-new-file {
  width: 100%;
  padding: 8px 12px;
  background: var(--color-primary);
  color: #0f172a;
  border: none;
  border-radius: var(--radius-default);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-new-file:hover {
  background: #f8fafc;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(255, 255, 255, 0.15);
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
  gap: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: var(--radius-default);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.file-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
}

.file-item.active {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
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
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-item.active .file-name {
  color: var(--color-accent);
}

.file-time {
  font-size: 12px;
  color: var(--color-text-muted);
}

.file-actions {
  display: flex;
  gap: 4px;
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
  padding: 6px;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-rename:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-accent);
}

.btn-delete:hover {
  background: rgba(239, 68, 68, 0.1);
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
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.user-avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text-main);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: none;
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-logout {
  width: 100%;
  padding: 10px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  border-radius: var(--radius-default);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.btn-logout:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-2px);
}

.btn-logout:active {
  transform: translateY(0);
}
</style>
