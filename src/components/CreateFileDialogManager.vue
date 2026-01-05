<template>
  <CreateFileDialog ref="dialogRef" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CreateFileDialog from '@/components/CreateFileDialog.vue'

const dialogRef = ref<any>(null)

// 暴露给外部的接口
const showDialog = (): Promise<{ fileName: string; templateId: string } | null> => {
  console.log('[CreateFileDialogManager.showDialog] called, dialogRef:', !!dialogRef.value)
  if (dialogRef.value) {
    console.log('[CreateFileDialogManager.showDialog] calling child showDialog')
    return dialogRef.value.showDialog()
  }
  console.warn('[CreateFileDialogManager.showDialog] No dialog ref!')
  return Promise.resolve(null)
}

const reset = () => {
  if (dialogRef.value) {
    dialogRef.value.reset()
  }
}

defineExpose({
  showDialog,
  reset
})
</script>
