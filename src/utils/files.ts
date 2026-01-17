import axios from 'axios'
import type { AxiosInstance } from 'axios'
import type { File, FileListItem, MindmapContent, SaveState } from '@/types/files'
import authService from './auth'
import localStorageService from '@/services/localStorageService'

/**
 * 文件管理Service - 混合本地存储和云端同步
 * 
 * 核心逻辑:
 * 1. 使用 UTC 时间戳 (updatedAt) 判断文件新旧
 * 2. 每次获取数据时,也从云端获取,如果云端时间戳更新则使用云端数据
 * 3. 每次保存时,既保存本地也保存云端,并启动异步重试机制
 * 4. fileList 和 file 都由客户端维护,服务端只做时间戳比较
 */

const API_BASE = import.meta.env.VITE_API_BASE || ''

interface StoredFile extends File {
  _deleted?: boolean
}

interface StoredFileList {
  files: FileListItem[]
  updatedAt: number
}

export interface SaveResult {
  file: File
  saveState: SaveState
  syncPromise?: Promise<void>
}

interface RetryTask {
  fileId: string
  fileData: StoredFile
  fileList: StoredFileList
  retryCount: number
  timeoutId: NodeJS.Timeout
  resolveSync?: () => void
}

// 云端同步完成事件回调
type SyncCompleteCallback = (fileId: string) => void

class FileService {
  private api: AxiosInstance
  private retryQueue = new Map<string, RetryTask>()
  private syncCompleteCallbacks: SyncCompleteCallback[] = []

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // 请求拦截器 - 添加token
    this.api.interceptors.request.use((config) => {
      const token = authService.getToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    // 响应拦截器 - 处理401
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          authService.clearToken()
          window.location.href = '/'
        }
        return Promise.reject(error)
      }
    )
  }

  /**
   * 订阅云端同步完成事件
   */
  onSyncComplete(callback: SyncCompleteCallback) {
    this.syncCompleteCallbacks.push(callback)
  }

  /**
   * 触发云端同步完成事件
   */
  private emitSyncComplete(fileId: string) {
    this.syncCompleteCallbacks.forEach(callback => callback(fileId))
  }

  /**
   * 清理重试任务的超时器
   */
  private clearRetryTask(fileId: string) {
    const task = this.retryQueue.get(fileId)
    if (task) {
      clearTimeout(task.timeoutId)
      this.retryQueue.delete(fileId)
      // 触发云端同步完成事件
      this.emitSyncComplete(fileId)
    }
  }

  /**
   * 调度重试 - 30s后重试，最多重试3次
   */
  private scheduleRetry(fileId: string, fileData: StoredFile, fileList: StoredFileList, retryCount: number = 0, resolveSync?: () => void) {
    if (retryCount >= 3) {
      console.warn(`File ${fileId} sync failed after 3 retries`)
      return
    }

    const timeoutId = setTimeout(() => {
      this.retrySync(fileId, fileData, fileList, retryCount, resolveSync)
    }, 30000) // 30秒后重试

    this.retryQueue.set(fileId, {
      fileId,
      fileData,
      fileList,
      retryCount,
      timeoutId,
      resolveSync
    })
  }

  /**
   * 重试同步到云端
   */
  private async retrySync(fileId: string, fileData: StoredFile, fileList: StoredFileList, retryCount: number, resolveSync?: () => void) {
    try {
      const now = Date.now()
      if (fileData._deleted) {
        // 重试删除
        await this.api.delete(`/api/files/${fileId}`, {
          data: {
            file: {
              id: fileData.id,
              name: fileData.title,
              content: fileData.content,
              updatedAt: now
            },
            fileList: fileList
          }
        })
      } else {
        // 重试更新
        await this.api.put(`/api/files/${fileId}`, {
          file: {
            id: fileData.id,
            name: fileData.title,
            content: fileData.content,
            updatedAt: now
          },
          fileList: fileList
        })
      }
      
      // 成功，清理重试任务
      this.clearRetryTask(fileId)
      console.log(`File ${fileId} synced to cloud successfully after retry`)
      
      // 调用resolve回调
      if (resolveSync) {
        resolveSync()
      }
      
      // 触发事件
      this.emitSyncComplete(fileId)
    } catch (error) {
      console.warn(`File ${fileId} retry ${retryCount + 1} failed, will retry in 30s`, error)
      // 继续重试
      this.scheduleRetry(fileId, fileData, fileList, retryCount + 1, resolveSync)
    }
  }

  /**
   * 获取文件列表 - 从云端获取，但与本地时间戳对比
   * 使用时间戳较新的数据，防止服务端返回旧数据
   */
  async getFileList(): Promise<FileListItem[]> {
    // 获取当前用户ID，用于本地存储隔离
    const user = await authService.getCurrentUser()
    if (!user?.id) {
      throw new Error('User not authenticated')
    }
    
    // 获取本地列表
    const localList = localStorageService.getFileList(user.id)
    
    try {
      // 从云端获取文件列表
      const response = await this.api.get('/api/files')
      const files = (response.data.files || []).map((f: any) => ({
        ...f,
        title: f.title || f.name || 'Untitled'
      }))
      
      const cloudList: StoredFileList = {
        files: files,
        updatedAt: response.data.updatedAt || 0
      }

      // 对比时间戳，选择较新的数据
      if (cloudList.updatedAt >= localList.updatedAt) {
        // 云端数据更新，使用云端数据并保存到本地
        localStorageService.setFileList(user.id, cloudList)
        return cloudList.files
      } else {
        // 本地数据更新，继续使用本地数据
        return localList.files
      }
    } catch (error) {
      // 网络错误时，降级使用本地缓存
      return localList.files
    }
  }

  /**
   * 创建文件
   */
  /**
   * 生成友好的文件 ID：使用标题 slug + 时间戳短版本
   * 例如：my-project_a2b1c9  而不是 file_1767061577096_w1f1sp8qc
   */
  private generateFileId(): string {
 
    // 时间戳短版本（Base36编码，5位左右）
    const timestamp = Date.now().toString(36).slice(-5)
    
    // 唯一随机后缀（3位）
    const random = Math.random().toString(36).slice(2, 5)

    return `${timestamp}${random}`
  }

  async createFile(title: string, templateId?: string, customContent?: MindmapContent): Promise<File> {
    // 获取当前用户ID
    const user = await authService.getCurrentUser()
    if (!user?.id) {
      throw new Error('User not authenticated')
    }

    const fileId = this.generateFileId()
    const now = Date.now()
    const isoNow = new Date(now).toISOString()
    
    // 获取模板内容
    let content = customContent || { root: { data: { text: '根节点' }, children: [] } } as any
    if (!customContent && templateId) {
      try {
        const { TEMPLATES } = await import('@/constants/templates')
        const template = TEMPLATES[templateId]
        if (template) {
          content = template.content
        }
      } catch (err) {
        console.warn('Failed to load template:', err)
      }
    }
    
    const newFile: StoredFile = {
      id: fileId,
      userId: user.id,
      title,
      content: content as MindmapContent,
      createdAt: isoNow,
      updatedAt: isoNow,
      _deleted: false
    }

    // 获取当前文件列表
    const localList = localStorageService.getFileList(user.id)
    const newFileList: StoredFileList = {
      files: [
        ...localList.files,
        {
          id: fileId,
          title,
          createdAt: isoNow,
          updatedAt: isoNow
        }
      ],
      updatedAt: now
    }

    // 本地保存
    localStorageService.setFile(user.id, newFile)
    localStorageService.setFileList(user.id, newFileList)

    try {
      // 云端保存 - 适配服务端格式
      await this.api.post('/api/files', {
        file: {
          id: newFile.id,
          name: newFile.title, // 服务端期望 name 而不是 title
          content: newFile.content,
          updatedAt: now // 服务端期望数字时间戳
        },
        fileList: newFileList
      })
    } catch (error) {
      console.warn('Failed to sync new file to cloud', error)
      // 本地保存成功即返回,稍后会重试同步
    }

    return newFile as File
  }

  /**
   * 获取文件详情 - 优先返回本地数据，后台异步同步
   * 不阻塞主流程，提升用户体验
   */
  async getFile(fileId: string): Promise<File> {
    // 获取当前用户ID
    const user = await authService.getCurrentUser()
    if (!user?.id) {
      throw new Error('User not authenticated')
    }

    const localFile = localStorageService.getFile(user.id, fileId)
    
    // 如果本地有数据，立即返回（不等待网络）
    if (localFile) {
      // 后台异步同步云端数据（非阻塞）
      this.syncFileInBackground(fileId, user.id)
      return localFile as File
    }

    // 本地没有数据，从云端获取
    try {
      const response = await this.api.get(`/api/files/${fileId}`)
      const data = response.data
      
      const cloudFile: StoredFile = {
        ...data,
        title: data.title || data.name || 'Untitled'
      }
      
      localStorageService.setFile(user.id, cloudFile)
      return cloudFile as File
    } catch (error) {
      throw new Error('File not found')
    }
  }

  /**
   * 后台异步同步文件数据（不阻塞主流程）
   */
  private async syncFileInBackground(fileId: string, userId: string): Promise<void> {
    try {
      const response = await this.api.get(`/api/files/${fileId}`)
      const data = response.data
      
      const localFile = localStorageService.getFile(userId, fileId)
      
      // 只有云端数据更新时才更新本地
      if (
        !localFile ||
        new Date(data.updatedAt).getTime() > new Date(localFile.updatedAt).getTime()
      ) {
        const cloudFile: StoredFile = {
          ...data,
          title: data.title || data.name || 'Untitled'
        }
        localStorageService.setFile(userId, cloudFile)
      }
    } catch (error) {
      // 后台同步失败，不影响主流程
      console.warn(`Background sync failed for file ${fileId}`, error)
    }
  }

  /**
   * 更新文件 - 保存到本地和云端，启动异步重试机制
   */
  async updateFile(fileId: string, updates: { title?: string; content?: MindmapContent; isShared?: boolean }): Promise<SaveResult> {
    // 获取当前用户ID
    const user = await authService.getCurrentUser()
    if (!user?.id) {
      throw new Error('User not authenticated')
    }

    const localFile = localStorageService.getFile(user.id, fileId)
    if (!localFile) {
      throw new Error('File not found')
    }

    const now = Date.now()
    const isoNow = new Date(now).toISOString()
    const updatedFile: StoredFile = {
      ...localFile,
      ...updates,
      updatedAt: isoNow
    }

    // 更新文件列表中的元数据
    const localList = localStorageService.getFileList(user.id)
    const fileIndex = localList.files.findIndex((f) => f.id === fileId)
    if (fileIndex !== -1 && localList.files[fileIndex]) {
      localList.files[fileIndex] = {
        id: fileId,
        title: updatedFile.title,
        createdAt: localList.files[fileIndex]!.createdAt,
        updatedAt: isoNow,
        isShared: updatedFile.isShared
      }
    }

    const newFileList: StoredFileList = {
      ...localList,
      updatedAt: now
    }

    // 1. 本地保存 - 同步，立即返回
    localStorageService.setFile(user.id, updatedFile)
    localStorageService.setFileList(user.id, newFileList)

    // 2. 创建Promise用于追踪云端同步
    const syncPromise = new Promise<void>((resolve) => {
      // 异步云端同步 + 重试机制，并在完成时resolve
      this.syncToCloudWithRetry(fileId, updatedFile, newFileList, resolve)
    })

    // 3. 返回结果，并在后台等待云端同步
    const result: SaveResult = {
      file: updatedFile as File,
      saveState: {
        status: 'saved',
        message: '已保存到本地'
      },
      syncPromise // 暴露Promise供调用者等待
    } as any

    return result
  }

  /**
   * 云端同步 + 重试机制
   */
  private async syncToCloudWithRetry(fileId: string, fileData: StoredFile, fileList: StoredFileList, resolveSync?: () => void) {
    try {
      const now = Date.now()
      
      if (fileData._deleted) {
        // 删除操作
        await this.api.delete(`/api/files/${fileId}`, {
          data: {
            file: {
              id: fileData.id,
              name: fileData.title,
              content: fileData.content,
              updatedAt: now
            },
            fileList: fileList
          }
        })
      } else {
        // 更新操作
        await this.api.put(`/api/files/${fileId}`, {
          file: {
            id: fileData.id,
            name: fileData.title,
            content: fileData.content,
            updatedAt: now
          },
          fileList: fileList
        })
      }

      // 成功，清理重试任务并触发事件
      this.clearRetryTask(fileId)
      console.log(`File ${fileId} synced to cloud successfully`)
      
      // 调用resolve回调，通知调用者同步完成
      if (resolveSync) {
        resolveSync()
      }
      
      // 触发事件
      this.emitSyncComplete(fileId)
    } catch (error) {
      console.warn(`Failed to sync file ${fileId} to cloud, will retry in 30s`, error)
      // 启动重试机制，传递resolveSync
      this.scheduleRetry(fileId, fileData, fileList, 0, resolveSync)
    }
  }

  /**
   * 删除文件 - 标记删除并同步
   */
  async deleteFile(fileId: string): Promise<void> {
    // 获取当前用户ID
    const user = await authService.getCurrentUser()
    if (!user?.id) {
      throw new Error('User not authenticated')
    }

    let localFile = localStorageService.getFile(user.id, fileId)
    
    // 如果本地没有文件详情（可能是仅同步了列表但未打开过文件）
    if (!localFile) {
       // 尝试从列表中查找基本信息
       const localList = localStorageService.getFileList(user.id)
       const fileItem = localList.files.find(f => f.id === fileId)
       
       if (fileItem) {
         // 构造一个临时的文件对象用于删除
         localFile = {
           id: fileId,
           userId: user.id,
           title: fileItem.title,
           // 使用最小化的空内容，因为我们只是要标记删除
           content: { root: { data: { text: 'Deleted' }, children: [] } } as any,
           createdAt: fileItem.createdAt,
           updatedAt: fileItem.updatedAt,
           _deleted: false
         }
       } else {
         // 列表里也没有，说明文件可能已经不存在了
         console.warn('File not found locally, skipping delete')
         return
       }
    }

    const now = Date.now()
    const isoNow = new Date(now).toISOString()
    const deletedFile: StoredFile = {
      ...localFile,
      _deleted: true,
      updatedAt: isoNow
    }

    // 更新文件列表
    const localList = localStorageService.getFileList(user.id)
    const newFileList: StoredFileList = {
      files: localList.files.filter((f) => f.id !== fileId),
      updatedAt: now
    }

    // 本地保存
    localStorageService.setFile(user.id, deletedFile)
    localStorageService.setFileList(user.id, newFileList)

    try {
      // 云端删除 - 适配服务端格式
      await this.api.delete(`/api/files/${fileId}`, {
        data: {
          file: {
            id: deletedFile.id,
            name: deletedFile.title,
            content: deletedFile.content,
            updatedAt: now
          },
          fileList: newFileList
        }
      })
    } catch (error) {
      console.warn('Failed to sync deleted file to cloud', error)
      // 本地保存成功即返回,稍后会重试同步
    }
  }

  /**
   * 保存文件内容
   */
  async saveFile(fileId: string, content: MindmapContent): Promise<SaveResult> {
    return this.updateFile(fileId, { content })
  }

  /**
   * 更新文件标题
   */
  async renameFile(fileId: string, title: string): Promise<SaveResult> {
    return this.updateFile(fileId, { title })
  }

  /**
   * 分享文件
   */
  async shareFile(fileId: string, json: any, svg: string, title: string): Promise<string> {
    try {
      const response = await this.api.post('/api/share', { id: fileId, json, svg, title })
      if (response.data && response.data.shareUrl) {
        // 返回完整的分享 URL
        const base = window.location.origin
        return `${base}${response.data.shareUrl}`
      }
      throw new Error('分享失败')
    } catch (error: any) {
      console.error('Share error:', error)
      throw new Error(error.response?.data?.message || '分享同步异常')
    }
  }

  async cancelShare(fileId: string): Promise<boolean> {
    try {
      await this.api.delete(`/api/share?id=${fileId}`)
      return true
    } catch (error) {
      console.error('Cancel share error:', error)
      return false
    }
  }
}

export default new FileService()
