/**
 * 文件管理相关类型定义
 */

export interface KMNode {
  data: {
    text: string
    id?: string
    priority?: number
    progress?: number
    [key: string]: any
  }
  children?: KMNode[]
}

export interface MindmapContent {
  root: KMNode
  template?: string
  theme?: string
  version?: string
}

export interface File {
  id: string
  userId: string
  title: string
  content: MindmapContent
  createdAt: string
  updatedAt: string
  isShared?: boolean
  shareId?: string
  shareToken?: string
}

export interface FileListItem {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  isShared?: boolean
  shareId?: string
}

/**
 * 本地存储的文件(包含软删除标记)
 */
export interface StoredFile extends File {
  _deleted?: boolean
}

/**
 * 本地存储的文件列表
 */
export interface StoredFileList {
  files: FileListItem[]
  updatedAt: number
}

/**
 * 保存状态
 */
export interface SaveState {
  status: 'idle' | 'saving' | 'saved' | 'error'
  message: string
  lastSyncTime?: number
}

