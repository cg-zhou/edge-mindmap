import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import fileService from '@/utils/files'
import type { File, FileListItem, MindmapContent, SaveState } from '@/types/files'

export const useFileStore = defineStore('files', () => {
  const files = ref<FileListItem[]>([])
  const currentFile = ref<File | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const saveState = ref<SaveState>({ status: 'idle', message: '' })
  const hasFiles = computed(() => files.value.length > 0)

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

  const initialize = loadFiles

  const createFile = async (title = '无标题思维导图', templateId?: string, customContent?: MindmapContent) => {
    try {
      loading.value = true
      error.value = null
      const newFile = await fileService.createFile(title, templateId, customContent)
      currentFile.value = newFile
      await loadFiles()
      return newFile
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create file'
      throw err
    } finally {
      loading.value = false
    }
  }

  const loadFile = async (fileId: string) => {
    try {
      loading.value = true
      error.value = null
      saveState.value = { status: 'idle', message: '' }
      currentFile.value = await fileService.getFile(fileId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load file'
      throw err
    } finally {
      loading.value = false
    }
  }

  const saveFile = async (fileId: string, content: MindmapContent) => {
    try {
      saveState.value = { status: 'saving', message: '保存中...' }
      error.value = null
      const result = await fileService.saveFile(fileId, content)
      currentFile.value = result.file
      saveState.value = result.saveState
      return result.file
    } catch (err) {
      saveState.value = { status: 'error', message: '保存失败' }
      error.value = err instanceof Error ? err.message : 'Failed to save file'
      throw err
    }
  }

  const renameFile = async (fileId: string, title: string) => {
    const result = await fileService.renameFile(fileId, title)
    currentFile.value = result.file
    const index = files.value.findIndex(item => item.id === fileId)
    if (index !== -1) {
      files.value[index] = { ...files.value[index]!, title: result.file.title, updatedAt: result.file.updatedAt }
    }
    saveState.value = result.saveState
    return result.file
  }

  const deleteFile = async (fileId: string) => {
    await fileService.deleteFile(fileId)
    files.value = files.value.filter(item => item.id !== fileId)
    if (currentFile.value?.id === fileId) {
      currentFile.value = null
    }
  }

  const clearCurrentFile = () => {
    currentFile.value = null
  }

  const setSharedStatus = async (fileId: string, isShared: boolean) => {
    const result = await fileService.updateFile(fileId, { isShared })
    currentFile.value = currentFile.value?.id === fileId ? result.file : currentFile.value
    const index = files.value.findIndex(item => item.id === fileId)
    if (index !== -1) {
      files.value[index] = {
        ...files.value[index]!,
        isShared,
        shareId: result.file.shareId,
        updatedAt: result.file.updatedAt
      }
    }
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
    clearCurrentFile,
    setSharedStatus
  }
})
