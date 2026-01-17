<template>
  <transition name="fade">
    <div v-if="visible" class="dialog-overlay" @click.self="close">
      <div class="dialog-content">
        <div class="dialog-header">
          <h3>分享</h3>
          <button class="close-btn" @click="close">&times;</button>
        </div>
        
        <div class="dialog-body">
          <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>正在同步分享内容...</p>
          </div>
          
          <div v-else class="share-info">
            <div class="sync-banner" :class="{ 'not-shared': !shareUrl }">
              <p v-if="shareUrl">已开启分享，后续编辑保存将自动同步至分享页面。</p>
              <p v-else>分享您的思维导图快照，后续的所有改动都会自动同步。</p>
            </div>

            <div class="share-section">
              <p class="share-label">分享链接 (只读):</p>
              <div class="url-container">
                <input 
                  type="text" 
                  readonly 
                  :value="shareUrl || '未开启分享'" 
                  :disabled="!shareUrl" 
                  @focus="handleInputFocus" 
                />
                <button class="copy-btn" :disabled="!shareUrl" @click="handleCopy(shareUrl)">复制</button>
                <button class="open-btn" :disabled="!shareUrl" @click="handleOpen(shareUrl)">打开</button>
              </div>
            </div>

            <div class="share-section">
              <p class="share-label">搜索引擎优化（SEO）:</p>
              <div class="url-container">
                <input 
                  type="text" 
                  readonly 
                  :value="shareUrl ? shareUrl + '?view=seo' : '未开启分享'" 
                  :disabled="!shareUrl" 
                  @focus="handleInputFocus" 
                />
                <button class="copy-btn" :disabled="!shareUrl" @click="handleCopy(shareUrl + '?view=seo')">复制</button>
                <button class="open-btn" :disabled="!shareUrl" @click="handleOpen(shareUrl + '?view=seo')">预览</button>
              </div>
            </div>

            <div class="share-section">
              <p class="share-label">矢量图链接 (SVG):</p>
              <div class="url-container">
                <input 
                  type="text" 
                  readonly 
                  :value="shareUrl ? shareUrl + '.svg' : '未开启分享'" 
                  :disabled="!shareUrl" 
                  @focus="handleInputFocus" 
                />
                <button class="copy-btn" :disabled="!shareUrl" @click="handleCopy(shareUrl + '.svg')">复制</button>
                <button class="open-btn" :disabled="!shareUrl" @click="handleOpen(shareUrl + '.svg')">查看</button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="dialog-footer">
          <button v-if="shareUrl" class="cancel-share-btn" @click="handleCancel" :disabled="cancelling">
            {{ cancelling ? '正在取消...' : '停止分享' }}
          </button>
          <button v-else-if="!loading" class="confirm-share-btn" @click="handleConfirm">
            开始分享
          </button>
          <div class="footer-spacer"></div>
          <button class="primary-btn" @click="close">关闭</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { message } from '@/utils/message'

const emit = defineEmits(['cancel', 'confirm'])

const visible = ref(false)
const loading = ref(false)
const cancelling = ref(false)
const shareUrl = ref('')

const show = (url?: string) => {
  visible.value = true
  shareUrl.value = url || ''
  loading.value = false
}

const setLoading = (val: boolean) => {
  loading.value = val
}

const setUrl = (url: string) => {
  shareUrl.value = url
  loading.value = false
  cancelling.value = false
}

const setCancelling = (val: boolean) => {
  cancelling.value = val
}

const close = () => {
  visible.value = false
}

const handleCopy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    message.success('已复制到剪贴板')
  } catch (err) {
    message.error('复制失败，请手动选择复制')
  }
}

const handleOpen = (url: string) => {
  window.open(url, '_blank')
}

const handleInputFocus = (event: FocusEvent) => {
  const target = event.target as HTMLInputElement
  if (target) {
    target.select()
  }
}

const handleCancel = () => {
  emit('cancel')
}

const handleConfirm = () => {
  emit('confirm')
}

defineExpose({ show, setLoading, setUrl, setCancelling, close })
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(8px);
}

.dialog-content {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 520px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.dialog-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}

.close-btn {
  background: #f1f5f9;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 20px;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.dialog-body {
  padding: 24px;
  min-height: 350px;
  display: flex;
  flex-direction: column;
}

.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #2a5fbd;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.share-info {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sync-banner {
  padding: 10px 14px;
  background: #f0f7ff;
  border-left: 4px solid #2a5fbd;
  border-radius: 4px;
}

.sync-banner.not-shared {
  background: #f8fafc;
  border-left-color: #cbd5e1;
  color: #64748b;
}

.sync-banner p {
  margin: 0;
  font-size: 13px;
  color: #1e40af;
  font-weight: 500;
}

.sync-banner.not-shared p {
  color: #64748b;
}

.share-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.share-label {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  margin: 0;
}

.url-container {
  display: flex;
  gap: 8px;
}

.url-container input {
  flex: 1;
  padding: 8px 12px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--color-text-main);
  transition: all 0.2s ease;
}

.url-container input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(42, 95, 189, 0.1);
}

.url-container input:disabled {
  background: #f9fafb;
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.copy-btn, .open-btn {
  padding: 0 12px;
  height: 34px;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: white;
  color: var(--color-text-main);
  transition: all 0.2s;
  white-space: nowrap;
}

.copy-btn:hover:not(:disabled), .open-btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.open-btn {
  color: var(--color-primary);
  background: #f0f7ff;
  border-color: #cce3ff;
}

.open-btn:hover:not(:disabled) {
  background: #e0f0ff;
  border-color: #b3d7ff;
}

.copy-btn:disabled, .open-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dialog-footer {
  padding: 12px 24px;
  background: #f9fafb;
  border-top: 1px solid var(--border-glass);
  display: flex;
  align-items: center;
}

.footer-spacer {
  flex: 1;
}

.primary-btn {
  padding: 6px 20px;
  background: white;
  border: 1px solid #d1d5db;
  color: var(--color-text-main);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.primary-btn:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.cancel-share-btn {
  padding: 6px 16px;
  background: transparent;
  color: var(--color-danger);
  border: 1px solid #fee2e2;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-share-btn:hover {
  background: #fef2f2;
  border-color: #fca5a5;
}

.cancel-share-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.confirm-share-btn {
  padding: 6px 20px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.confirm-share-btn:hover {
  background: #1e4bb5;
  transform: translateY(-1px);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
