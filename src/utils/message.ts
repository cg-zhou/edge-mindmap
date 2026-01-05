/**
 * 确认对话框的选项
 */
export interface DialogOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  isDanger?: boolean
}

/**
 * 输入对话框的选项
 */
export interface InputDialogOptions {
  title?: string
  placeholder?: string
  defaultValue?: string
  confirmText?: string
  cancelText?: string
  inputType?: 'text' | 'number'
}

// Toast 实例引用
let toastInstance: {
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info', duration?: number) => string
  removeToast: (id: string) => void
  clearAll: () => void
} | null = null

// Dialog 实例引用
let dialogInstance: {
  showDialog: (options: DialogOptions) => Promise<boolean>
} | null = null

// InputDialog 实例引用
let inputDialogInstance: {
  showDialog: (options: InputDialogOptions) => Promise<string | null>
} | null = null

// CreateFileDialog 实例引用
let createFileDialogInstance: {
  showDialog: () => Promise<{ fileName: string; templateId: string } | null>
  reset: () => void
} | null = null

export const setToastInstance = (instance: any) => {
  toastInstance = instance
}

export const setDialogInstance = (instance: any) => {
  dialogInstance = instance
}

export const setInputDialogInstance = (instance: any) => {
  inputDialogInstance = instance
}

export const setCreateFileDialogInstance = (instance: any) => {
  createFileDialogInstance = instance
}

/**
 * 消息提示 - 成功
 */
export const message = {
  success: (text: string, duration = 3000) => {
    if (toastInstance) {
      toastInstance.addToast(text, 'success', duration)
    }
  },

  /**
   * 消息提示 - 错误
   */
  error: (text: string, duration = 3000) => {
    if (toastInstance) {
      toastInstance.addToast(text, 'error', duration)
    }
  },

  /**
   * 消息提示 - 警告
   */
  warning: (text: string, duration = 3000) => {
    if (toastInstance) {
      toastInstance.addToast(text, 'warning', duration)
    }
  },

  /**
   * 消息提示 - 信息
   */
  info: (text: string, duration = 3000) => {
    if (toastInstance) {
      toastInstance.addToast(text, 'info', duration)
    }
  },
}

/**
 * 确认对话框
 */
export const dialog = {
  confirm: async (options: DialogOptions | string): Promise<boolean> => {
    const opts: DialogOptions = typeof options === 'string' ? { message: options } : options
    if (dialogInstance) {
      return await dialogInstance.showDialog(opts)
    }
    return false
  },

  /**
   * 删除确认
   */
  confirmDelete: async (name?: string): Promise<boolean> => {
    const message = name ? `确定要删除"${name}"吗？删除后无法恢复。` : '确定要删除吗？删除后无法恢复。'
    if (dialogInstance) {
      return await dialogInstance.showDialog({
        title: '删除确认',
        message,
        confirmText: '删除',
        cancelText: '取消',
        isDanger: true,
      })
    }
    return false
  },

  /**
   * 退出确认
   */
  confirmExit: async (): Promise<boolean> => {
    if (dialogInstance) {
      return await dialogInstance.showDialog({
        title: '退出确认',
        message: '确定要退出吗？',
        confirmText: '退出',
        cancelText: '取消',
      })
    }
    return false
  },
}

/**
 * 输入对话框
 */
export const input = {
  /**
   * 文本输入框
   */
  promptText: async (options: InputDialogOptions | string): Promise<string | null> => {
    const opts: InputDialogOptions = typeof options === 'string' ? { placeholder: options } : options
    if (inputDialogInstance) {
      return await inputDialogInstance.showDialog(opts)
    }
    return null;
  },
}

/**
 * 文件创建
 */
export const file = {
  /**
   * 创建文件（包含文件名和模板选择）
   */
  createFile: async (): Promise<{ fileName: string; templateId: string } | null> => {
    console.log('[message.file.createFile] called, instance:', !!createFileDialogInstance)
    if (createFileDialogInstance) {
      console.log('[message.file.createFile] calling showDialog')
      const result = await createFileDialogInstance.showDialog()
      console.log('[message.file.createFile] showDialog result:', result)
      return result
    }
    console.warn('[message.file.createFile] No dialog instance found!')
    return null
  },
}
