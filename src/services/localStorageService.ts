/**
 * localStorage 本地存储服务
 * 存储文件列表和所有文件内容
 * 关键：所有key都包含userId，确保不同用户的数据隔离
 */

import type { File, FileListItem } from '@/types/files'

interface StoredFile extends File {
  _deleted?: boolean
}

interface StoredFileList {
  files: FileListItem[]
  updatedAt: number
}

const STORAGE_KEYS = {
  FILE_LIST: (userId: string) => `mindmap:${userId}:fileList`,
  FILE_PREFIX: (userId: string) => `mindmap:${userId}:file:`,
  SYNC_TIMESTAMP: (userId: string) => `mindmap:${userId}:syncTimestamp`
}

class LocalStorageService {
  /**
   * 获取本地文件列表
   */
  getFileList(userId: string): StoredFileList {
    const stored = localStorage.getItem(STORAGE_KEYS.FILE_LIST(userId))
    return stored
      ? JSON.parse(stored)
      : { files: [], updatedAt: 0 }
  }

  /**
   * 保存文件列表到本地
   */
  setFileList(userId: string, fileList: StoredFileList): void {
    localStorage.setItem(STORAGE_KEYS.FILE_LIST(userId), JSON.stringify(fileList))
  }

  /**
   * 获取本地单个文件
   */
  getFile(userId: string, fileId: string): StoredFile | null {
    const stored = localStorage.getItem(STORAGE_KEYS.FILE_PREFIX(userId) + fileId)
    return stored ? JSON.parse(stored) : null
  }

  /**
   * 保存单个文件到本地
   */
  setFile(userId: string, file: StoredFile): void {
    localStorage.setItem(STORAGE_KEYS.FILE_PREFIX(userId) + file.id, JSON.stringify(file))
  }

  /**
   * 删除本地文件
   */
  deleteFile(userId: string, fileId: string): void {
    localStorage.removeItem(STORAGE_KEYS.FILE_PREFIX(userId) + fileId)
  }

  /**
   * 获取所有本地文件
   */
  getAllFiles(userId: string): StoredFile[] {
    const files: StoredFile[] = []
    const prefix = STORAGE_KEYS.FILE_PREFIX(userId)
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        const stored = localStorage.getItem(key)
        if (stored) {
          files.push(JSON.parse(stored))
        }
      }
    }
    
    return files
  }

  /**
   * 清除指定用户的所有本地数据
   */
  clear(userId: string): void {
    const keysToRemove: string[] = []
    const fileListKey = STORAGE_KEYS.FILE_LIST(userId)
    const filePrefix = STORAGE_KEYS.FILE_PREFIX(userId)
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith(filePrefix) || key === fileListKey)) {
        keysToRemove.push(key)
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key))
  }
}

export default new LocalStorageService()
