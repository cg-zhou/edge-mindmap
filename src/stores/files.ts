import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import fileService from '@/utils/files'
import type { File, FileListItem, MindmapContent, SaveState } from '@/types/files'

export const useFileStore = defineStore('files', () => {
  const files = ref<FileListItem[]>([])
  const currentFile = ref<File | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const saveState = ref<SaveState>({
    status: 'idle',
    message: ''
  })

  const hasFiles = computed(() => files.value.length > 0)

  /**
   * 初始化store - 订阅fileService事件
   */
  const initializeStore = () => {
    fileService.onSyncComplete((fileId: string) => {
      // 云端同步完成，更新保存状态
      if (currentFile.value?.id === fileId) {
        saveState.value = {
          status: 'saved',
          message: '已同步到云端',
          lastSyncTime: Date.now()
        }
      }
    })
  }

  /**
   * 初始化 - 从本地加载,同时和云端同步
   */
  const initialize = async () => {
    try {
      loading.value = true
      error.value = null
      
      // 先清空（防止旧用户数据残留）
      files.value = []
      
      // 然后从云端同步（云端会返回当前用户的数据）
      files.value = await fileService.getFileList()
      
      // 初始化事件监听（只需执行一次）
      initializeStore()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to initialize files'
    } finally {
      loading.value = false
    }
  }

  /**
   * 加载文件列表 - 同时从本地和云端
   */
  const loadFiles = async () => {
    try {
      loading.value = true
      error.value = null
      files.value = await fileService.getFileList()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load files'
    } finally {
      loading.value = false
    }
  }

  /**
   * 创建新文件
   */
  const createFile = async (title: string = '无标题思维导图', templateId?: string) => {
    try {
      loading.value = true
      error.value = null
      const newFile = await fileService.createFile(title, templateId)
      currentFile.value = newFile
      
      // 刷新列表
      await loadFiles()
      
      return newFile
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create file'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 加载文件详情
   */
  const loadFile = async (fileId: string) => {
    try {
      loading.value = true
      error.value = null
      currentFile.value = await fileService.getFile(fileId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load file'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 保存文件内容 - 同时保存本地和云端
   */
  const saveFile = async (fileId: string, content: MindmapContent) => {
    try {
      saveState.value.status = 'saving'
      saveState.value.message = '保存中...'
      error.value = null

      const result = await fileService.saveFile(fileId, content)
      currentFile.value = result.file

      // 本地已保存
      saveState.value = {
        status: 'saved',
        message: '已保存到本地',
        lastSyncTime: Date.now()
      }

      // 如果有syncPromise，在后台等待云端同步完成后更新状态
      if (result.syncPromise) {
        result.syncPromise.then(() => {
          saveState.value = {
            status: 'saved',
            message: '已同步到云端',
            lastSyncTime: Date.now()
          }
        }).catch(() => {
          // 同步失败，保持当前状态
          console.warn('Cloud sync completed with error, state remains as local saved')
        })
      }

      return result.file
    } catch (err) {
      saveState.value = {
        status: 'error',
        message: '保存失败'
      }
      error.value = err instanceof Error ? err.message : 'Failed to save file'
      throw err
    }
  }

  /**
   * 重命名文件 - 同时保存本地和云端
   */
  const renameFile = async (fileId: string, title: string) => {
    try {
      saveState.value.status = 'saving'
      saveState.value.message = '保存中...'
      error.value = null

      const result = await fileService.renameFile(fileId, title)
      currentFile.value = result.file

      // 更新列表中的文件信息
      const index = files.value.findIndex((f: FileListItem) => f.id === fileId)
      if (index !== -1 && files.value[index]) {
        files.value[index]!.title = title
        files.value[index]!.updatedAt = result.file.updatedAt
      }

      saveState.value = {
        status: 'saved',
        message: '已保存到本地',
        lastSyncTime: Date.now()
      }

      return result.file
    } catch (err) {
      saveState.value = {
        status: 'error',
        message: '保存失败'
      }
      error.value = err instanceof Error ? err.message : 'Failed to rename file'
      throw err
    }
  }

  /**
   * 删除文件
   */
  const deleteFile = async (fileId: string) => {
    try {
      error.value = null
      await fileService.deleteFile(fileId)
      
      // 从列表中移除
      files.value = files.value.filter((f: FileListItem) => f.id !== fileId)
      
      // 如果删除的是当前文件，清除
      if (currentFile.value?.id === fileId) {
        currentFile.value = null
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete file'
      throw err
    }
  }

  /**
   * 清除当前文件
   */
  const clearCurrentFile = () => {
    currentFile.value = null
  }

  return {
    files,
    currentFile,
    loading,
    error,
    saveState,
    hasFiles,
    initialize,
    loadFiles,
    createFile,
    loadFile,
    saveFile,
    renameFile,
    deleteFile,
    clearCurrentFile
  }
})
