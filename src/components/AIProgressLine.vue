<template>
    <div class="ai-progress-steps">
        <div class="step-nodes">
            <!-- 等待开始 -->
            <div :class="['step-item', currentStep >= 0 ? 'active' : '']">
                <div class="step-dot"></div>
                <span class="step-label">等待开始</span>
            </div>

            <div class="step-line" :class="{ filled: currentStep >= 1 }"></div>

            <!-- 连接边缘函数 -->
            <div :class="['step-item', currentStep >= 1 ? 'active' : '']">
                <div class="step-dot"></div>
                <span class="step-label">连接边缘函数</span>
            </div>

            <div class="step-line" :class="{ filled: currentStep >= 2 }"></div>

            <!-- 正在生成 -->
            <div :class="['step-item', currentStep >= 2 ? 'active' : '', currentStep === 2 ? 'is-spinning' : '']">
                <div class="step-dot"></div>
                <span class="step-label">
                    {{ currentStep === 2 ? `生成 ${generatedCount} 个节点` : '正在生成' }}
                </span>
            </div>

            <div class="step-line" :class="{ filled: currentStep >= 3 }"></div>

            <!-- 生成完成 -->
            <div :class="['step-item', currentStep >= 3 ? 'active' : '']">
                <div class="step-dot"></div>
                <span class="step-label">生成完成</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
defineProps<{
    currentStep: number;
    generatedCount: number;
}>();
</script>

<style scoped>
.ai-progress-steps {
    display: flex;
    align-items: center;
    height: 100%;
}

.step-nodes {
    display: flex;
    align-items: center;
    gap: 0;
}

.step-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px;
}

.step-dot {
    width: 8px;
    height: 8px;
    background: #e2e8f0;
    border-radius: 50%;
    flex-shrink: 0;
    transition: all 0.3s ease;
}

.step-label {
    font-size: 12px;
    color: #94a3b8;
    white-space: nowrap;
    transition: all 0.3s ease;
}

.step-line {
    width: 30px;
    height: 1px;
    background: #e2e8f0;
    margin: 0 8px;
    transition: all 0.3s ease;
}

/* 蓝色主题 */
.step-line.filled {
    background: var(--color-primary);
    height: 1.5px;
}

.step-item.active .step-dot {
    background: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(42, 95, 189, 0.1);
}

.step-item.active .step-label {
    color: var(--color-primary);
    font-weight: 500;
}

/* 正在构建时的虚线转圈效果 */
.is-spinning .step-dot {
    background: transparent !important;
    border: 1.5px dashed var(--color-primary);
    width: 10px;
    height: 10px;
    animation: rotate 2s linear infinite;
    box-shadow: none !important;
}

@keyframes rotate {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}
</style>
