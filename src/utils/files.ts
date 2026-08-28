import axios from 'axios'
import type { File, FileListItem, MindmapContent, SaveState } from '@/types/files'
import localStorageService from '@/services/localStorageService'
import { TEMPLATE_LIST } from '@/constants/templates'

const API_BASE = import.meta.env.VITE_API_BASE || ''
const LOCAL_USER_ID = 'guest'

export interface SaveResult {
  file: File
  saveState: SaveState
}

class FileService {
  private readonly shareApi = axios.create({
    baseURL: API_BASE,
    timeout: 60000,
    headers: { 'Content-Type': 'application/json' }
  })

  private cloneContent(content: MindmapContent): MindmapContent {
    return JSON.parse(JSON.stringify(content)) as MindmapContent
  }

  private generateFileId(): string {
    const timestamp = Date.now().toString(36).slice(-5)
    const random = Math.random().toString(36).slice(2, 7)
    return `${timestamp}${random}`
  }

  private seedExamplesIfNeeded(): void {
    const currentList = localStorageService.getFileList(LOCAL_USER_ID)
    if (currentList.files.length > 0 || localStorageService.hasSeededExamples()) {
      return
    }

    const now = Date.now()
    const examples = TEMPLATE_LIST
      .filter(template => template.id !== 'blank')
      .slice(0, 3)
      .map((template, index) => {
        const timestamp = new Date(now - index * 60_000).toISOString()
        const example: File = {
          id: `example-${template.id}`,
          userId: LOCAL_USER_ID,
          title: template.name,
          content: this.cloneContent(template.content),
          createdAt: timestamp,
          updatedAt: timestamp,
          isShared: false
        }
        localStorageService.setFile(LOCAL_USER_ID, example)
        return {
          id: example.id,
          title: example.title,
          createdAt: example.createdAt,
          updatedAt: example.updatedAt,
          isShared: false
        } satisfies FileListItem
      })

    localStorageService.setFileList(LOCAL_USER_ID, { files: examples, updatedAt: now })
    localStorageService.markExamplesSeeded()
  }

  async getFileList(): Promise<FileListItem[]> {
    this.seedExamplesIfNeeded()
    return localStorageService.getFileList(LOCAL_USER_ID).files
  }

  async createFile(title: string, templateId?: string, customContent?: MindmapContent): Promise<File> {
    const fileId = this.generateFileId()
    const now = Date.now()
    const isoNow = new Date(now).toISOString()
    let content: MindmapContent = customContent
      ? this.cloneContent(customContent)
      : { root: { data: { text: '根节点' }, children: [] } }

    if (!customContent && templateId) {
      const template = TEMPLATE_LIST.find(item => item.id === templateId)
      if (template) {
        content = this.cloneContent(template.content)
      }
    }

    const newFile: File = {
      id: fileId,
      userId: LOCAL_USER_ID,
      title,
      content,
      createdAt: isoNow,
      updatedAt: isoNow,
      isShared: false
    }

    const currentList = localStorageService.getFileList(LOCAL_USER_ID)
    const nextList = {
      files: [
        {
          id: fileId,
          title,
          createdAt: isoNow,
          updatedAt: isoNow,
          isShared: false
        },
        ...currentList.files
      ],
      updatedAt: now
    }

    localStorageService.setFile(LOCAL_USER_ID, newFile)
    localStorageService.setFileList(LOCAL_USER_ID, nextList)
    return newFile
  }

  async getFile(fileId: string): Promise<File> {
    const stored = localStorageService.getFile(LOCAL_USER_ID, fileId)
    if (!stored) {
      throw new Error('File not found')
    }
    return stored
  }

  async updateFile(fileId: string, updates: { title?: string; content?: MindmapContent; isShared?: boolean }): Promise<SaveResult> {
    const current = localStorageService.getFile(LOCAL_USER_ID, fileId)
    if (!current) {
      throw new Error('File not found')
    }

    const now = Date.now()
    const isoNow = new Date(now).toISOString()
    const updatedFile: File = {
      ...current,
      ...updates,
      content: updates.content ? this.cloneContent(updates.content) : current.content,
      updatedAt: isoNow
    }
    const currentList = localStorageService.getFileList(LOCAL_USER_ID)
    const files = currentList.files.map(item => item.id === fileId
      ? { ...item, title: updatedFile.title, updatedAt: isoNow, isShared: updatedFile.isShared }
      : item)

    localStorageService.setFile(LOCAL_USER_ID, updatedFile)
    localStorageService.setFileList(LOCAL_USER_ID, { files, updatedAt: now })

    return {
      file: updatedFile,
      saveState: { status: 'saved', message: '已保存到本地', lastSyncTime: now }
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    const now = Date.now()
    const currentList = localStorageService.getFileList(LOCAL_USER_ID)
    localStorageService.deleteFile(LOCAL_USER_ID, fileId)
    localStorageService.setFileList(LOCAL_USER_ID, {
      files: currentList.files.filter(item => item.id !== fileId),
      updatedAt: now
    })
  }

  async saveFile(fileId: string, content: MindmapContent): Promise<SaveResult> {
    return this.updateFile(fileId, { content })
  }

  async renameFile(fileId: string, title: string): Promise<SaveResult> {
    return this.updateFile(fileId, { title })
  }

  async shareFile(fileId: string, json: MindmapContent, svg: string, title: string): Promise<string> {
    const response = await this.shareApi.post('/api/share', { id: fileId, json, svg, title })
    if (!response.data?.shareUrl) {
      throw new Error('分享失败')
    }
    return `${API_BASE}${response.data.shareUrl}`
  }

  async cancelShare(fileId: string): Promise<boolean> {
    try {
      await this.shareApi.delete(`/api/share?id=${fileId}`)
      return true
    } catch (error) {
      console.error('Cancel share error', error)
      return false
    }
  }
}

export default new FileService()
