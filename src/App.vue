<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from './stores/auth'
import Toast from '@/components/Toast.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import InputDialog from '@/components/InputDialog.vue'
import CreateFileDialogManager from '@/components/CreateFileDialogManager.vue'
import { setToastInstance, setDialogInstance, setInputDialogInstance, setCreateFileDialogInstance } from '@/utils/message'

const authStore = useAuthStore()
const toastRef = ref<any>(null)
const dialogRef = ref<any>(null)
const inputDialogRef = ref<any>(null)
const createFileDialogRef = ref<any>(null)

onMounted(async () => {
  if (!authStore.user) {
    await authStore.initAuth()
  }
  
  // 注册 Toast、Dialog、InputDialog、CreateFileDialog 实例到全局服务
  if (toastRef.value) {
    setToastInstance(toastRef.value)
  }
  if (dialogRef.value) {
    setDialogInstance(dialogRef.value)
  }
  if (inputDialogRef.value) {
    setInputDialogInstance(inputDialogRef.value)
  }
  if (createFileDialogRef.value) {
    console.log('[App.vue] Setting CreateFileDialogManager instance')
    setCreateFileDialogInstance(createFileDialogRef.value)
  }
})
</script>

<template>
  <div id="app">
    <Toast ref="toastRef" />
    <ConfirmDialog ref="dialogRef" />
    <InputDialog ref="inputDialogRef" />
    <CreateFileDialogManager ref="createFileDialogRef" />
    <router-view />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  width: 100%;
  min-height: 100vh;
}
</style>
