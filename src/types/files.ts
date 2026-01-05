/**
 * 文件管理相关类型定义
 */

export interface MindmapNode {
  id: string
  topic: string
  children?: MindmapNode[]
  [key: string]: any
}

export interface MindmapContent {
  nodeData: MindmapNode
  arrows: any[]
  summaries: any[]
  direction: number
  theme?: {
    name: string
    type: string
    palette: string[]
    cssVar: {
      [key: string]: string
    }
  }
}

export interface File {
  id: string
  userId: string
  title: string
  content: MindmapContent
  createdAt: string
  updatedAt: string
}

export interface FileListItem {
  id: string
  title: string
  createdAt: string
  updatedAt: string
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
  status: 'idle' | 'saving' | 'saved' | 'cloud-pending' | 'error'
  message: string
  lastSyncTime?: number
  retryCount?: number
  nextRetryTime?: number
}

/**
 * API 响应类型(旧版,保留兼容性)
 */
export interface FileListResponse {
  success?: boolean
  files: FileListItem[]
  updatedAt?: number
  error?: string
}

export interface FileResponse {
  success?: boolean
  file?: File
  error?: string
}

/**
 * API 请求类型(旧版,保留兼容性)
 */
export interface CreateFileRequest {
  title: string
}

export interface UpdateFileRequest {
  title?: string
  content?: MindmapContent
}

