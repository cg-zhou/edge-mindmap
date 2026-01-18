<template>
  <div class="home-container">
    <!-- Decorative background elements -->
    <div class="bg-decoration">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
    </div>
    
    <!-- Particle Background -->
    <canvas ref="particleCanvas" class="particle-canvas"></canvas>

    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-content">
        <div class="hero-text-area">
          <a href="https://www.aliyun.com/product/esa" target="_blank" rel="noopener noreferrer"
            class="hero-badge glow-badge" data-aos="fade-down" @click="handleBadgeClick">
            <span class="badge-icon">⚡</span>
            <span>基于阿里云 ESA 边缘计算</span>
          </a>

          <h1 class="hero-title glow-text" data-aos="fade-up" data-aos-delay="100">
            思维导图
            <span class="title-divider">|</span>
            <span class="gradient-text gradient-animated">MINDMAP</span>
          </h1>

          <p class="hero-subtitle" data-aos="fade-up" data-aos-delay="200">
            边缘节点加速，实时保存，随时随地激发创意
          </p>

          <div class="hero-actions" data-aos="fade-up" data-aos-delay="300">
            <button class="btn-primary" @click="handleButtonClick">
              <span>游客登录</span>
              <svg class="icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M5 12h14m-7-7l7 7-7 7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <button class="btn-secondary" @click="handleLoginWithMicrosoft">
              <span>Microsoft 登录</span>
            </button>
          </div>
        </div>

        <!-- Mini Mindmap Preview -->
        <div class="hero-preview-area" data-aos="fade-left" data-aos-delay="400">
          <div class="preview-window">
            <div class="window-header">
              <div class="window-dots">
                <span></span><span></span><span></span>
              </div>
              <div class="window-title">Mindmap Demo</div>
            </div>
            <div class="window-content">
              <iframe
                ref="previewIframe"
                src="/kityminder/index.html?mode=preview"
                class="preview-iframe"
                @load="onPreviewLoad"
              ></iframe>
            </div>
          </div>
          <!-- Decorative element behind window -->
          <div class="preview-glow"></div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { message } from '@/utils/message'
import AOS from 'aos'
import 'aos/dist/aos.css'

const router = useRouter()
const authStore = useAuthStore()
const particleCanvas = ref<HTMLCanvasElement | null>(null)
const previewIframe = ref<HTMLIFrameElement | null>(null)
const loading = ref(false)
const previewReady = ref(false)

// 模拟脑图数据演化
const simulationData = {
  template: 'right',
  theme: 'classic-compact',
  root: {
    data: { text: 'Demo', background: '#2A5FBD', color: '#fff' },
    children: []
  }
}

const extraNodes = [
  { parentText: 'Demo', text: '极速响应', priority: 1 },
  { parentText: '极速响应', text: '🚀 阿里云 ESA 加速' },
  { parentText: '极速响应', text: '⚡ 多级缓存' },

  { parentText: 'Demo', text: 'AI 创作', priority: 2 },
  { parentText: 'AI 创作', text: '✨ 通义千问大模型驱动' },
  { parentText: 'AI 创作', text: '💡 灵感自动扩充' },

  { parentText: 'Demo', text: '丰富功能', priority: 3 },
  { parentText: '丰富功能', text: '🎨 多样化布局', note: '思维导图\n组织结构图\n鱼骨图' },
  { parentText: '丰富功能', text: '导出/分享', progress: 9 }
]

function onPreviewLoad() {
  // 暂时不需要处理，靠 message 事件判断 ready
}

function startSimulation() {
  if (!previewIframe.value?.contentWindow) return

  let step = 0

  const update = () => {
    if (step < extraNodes.length) {
      const newNode = extraNodes[step]!
      
      // 改为发送增量指令，而不是全量数据
      previewIframe.value?.contentWindow?.postMessage({
        type: 'appendNode',
        parentText: newNode.parentText,
        node: {
          text: newNode.text,
          priority: newNode.priority,
          progress: newNode.progress,
          note: (newNode as any).note,
          hyperlink: (newNode as any).hyperlink
        }
      }, '*')
      
      step++
      setTimeout(update, 600) // 缩短间隔
    } else {
      setTimeout(() => {
        // 重启模拟：只有这时才用 importJson 还原初始状态
        previewIframe.value?.contentWindow?.postMessage({
          type: 'importJson',
          data: simulationData
        }, '*')
        step = 0
        setTimeout(update, 1200)
      }, 5000)
    }
  }

  // 初始倒入
  previewIframe.value.contentWindow.postMessage({
    type: 'importJson',
    data: simulationData
  }, '*')
  
  setTimeout(update, 1200)
}

// OAuth配置
const MICROSOFT_CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID || ''
const MICROSOFT_REDIRECT_URI = import.meta.env.VITE_MICROSOFT_REDIRECT_URI || 'http://localhost:5173/auth/callback'

// 处理来自 iframe 的消息
const handleMessage = (event: MessageEvent) => {
  if (event.data && event.data.type === 'ready') {
    // 判断是否是预览窗口的 ready
    if (event.source === previewIframe.value?.contentWindow) {
      previewReady.value = true
      startSimulation()
    }
  }
}

/**
 * 生成随机state用于防CSRF
 */
function generateRandomState(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let state = ''
  for (let i = 0; i < 32; i++) {
    state += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return state
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  baseVx: number // 初始速度（用于恢复）
  baseVy: number // 初始速度（用于恢复）
  radius: number
  opacity: number
  targetOpacity: number
  isClickParticle?: boolean // 是否是点击产生的临时粒子
  life?: number // 粒子生命值
}

let particles: Particle[] = []
let mousePos = { x: 0, y: 0 }
let canvasWidth = window.innerWidth
let canvasHeight = window.innerHeight
const CONNECTION_DISTANCE = 150
const MOUSE_INTERACTION_DISTANCE = 100
const VELOCITY_DECAY = 0.99 // 速度衰减系数（逐渐恢复原始速度）

function initParticles(canvas: HTMLCanvasElement) {
  const count = 120
  particles = []
  for (let i = 0; i < count; i++) {
    const vx = (Math.random() - 0.5) * 0.3
    const vy = (Math.random() - 0.5) * 0.3
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: vx,
      vy: vy,
      baseVx: vx, // 保存初始速度
      baseVy: vy, // 保存初始速度
      radius: Math.random() * 3 + 2,
      opacity: Math.random() * 0.3 + 0.7,
      targetOpacity: Math.random() * 0.3 + 0.7
    })
  }
}

function animateParticles() {
  const canvas = particleCanvas.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 更新粒子位置
  particles.forEach(particle => {
    // 计算当前速度大小
    const currentVelocity = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy)
    const baseVelocity = Math.sqrt(particle.baseVx * particle.baseVx + particle.baseVy * particle.baseVy)

    // 只对被加速过的粒子（速度超过初始速度）应用衰减
    if (currentVelocity > baseVelocity * 1.2) {
      particle.vx *= VELOCITY_DECAY
      particle.vy *= VELOCITY_DECAY
    }

    particle.x += particle.vx
    particle.y += particle.vy

    // 边界碰撞：反向并衰减速度，同时确保小球回到边界内
    if (particle.x < 0) {
      particle.x = 0
      particle.vx *= -0.8
    } else if (particle.x > canvas.width) {
      particle.x = canvas.width
      particle.vx *= -0.8
    }

    if (particle.y < 0) {
      particle.y = 0
      particle.vy *= -0.8
    } else if (particle.y > canvas.height) {
      particle.y = canvas.height
      particle.vy *= -0.8
    }

    // 鼠标互动：靠近鼠标时高亮
    const dx = particle.x - mousePos.x
    const dy = particle.y - mousePos.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance < MOUSE_INTERACTION_DISTANCE) {
      particle.targetOpacity = 0.9
      // 粒子被鼠标排斥（增加推开速度）
      const angle = Math.atan2(dy, dx)
      particle.vx += Math.cos(angle) * 0.2
      particle.vy += Math.sin(angle) * 0.2

      // 限制最大速度
      const velocity = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy)
      if (velocity > 4.5) {
        const scale = 4.5 / velocity
        particle.vx *= scale
        particle.vy *= scale
      }
    } else {
      particle.targetOpacity = Math.random() * 0.3 + 0.7
    }

    // 处理点击产生的临时粒子
    if (particle.isClickParticle) {
      particle.life! -= 1
      particle.opacity = particle.life! / 60 * 0.8 // 逐渐淡出

      if (particle.life! <= 0) {
        // 粒子生命结束，从数组中移除
        return // 使用 return 会在 forEach 中跳过，但不会删除，稍后会统一处理
      }

      // 点击粒子应用速度衰减
      particle.vx *= 0.98
      particle.vy *= 0.98
    } else {
      // 平滑过渡透明度
      particle.opacity += (particle.targetOpacity - particle.opacity) * 0.05
    }
  })

  // 清理已过期的点击粒子
  particles = particles.filter(p => !p.isClickParticle || p.life! > 0)

  // 绘制连接线
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i]!.x - particles[j]!.x
      const dy = particles[i]!.y - particles[j]!.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < CONNECTION_DISTANCE) {
        const opacity = (1 - distance / CONNECTION_DISTANCE) * 0.5
        
        // 判断是否为交互区域（其中一个点靠近鼠标）
        const distToMouseI = Math.sqrt(Math.pow(particles[i]!.x - mousePos.x, 2) + Math.pow(particles[i]!.y - mousePos.y, 2))
        const distToMouseJ = Math.sqrt(Math.pow(particles[j]!.x - mousePos.x, 2) + Math.pow(particles[j]!.y - mousePos.y, 2))
        const isInteractive = distToMouseI < MOUSE_INTERACTION_DISTANCE || distToMouseJ < MOUSE_INTERACTION_DISTANCE
        
        if (isInteractive) {
          ctx.strokeStyle = `rgba(42, 95, 189, ${opacity * 0.8})`
          ctx.lineWidth = 0.8
        } else {
          // 加深非交互状态下的灰色线条（从 Slate-200 提升到了 Slate-400 级别）
          ctx.strokeStyle = `rgba(148, 163, 184, ${opacity * 0.6})`
          ctx.lineWidth = 0.5
        }

        ctx.beginPath()
        ctx.moveTo(particles[i]!.x, particles[i]!.y)
        ctx.lineTo(particles[j]!.x, particles[j]!.y)
        ctx.stroke()
      }
    }
  }

  // 绘制粒子（节点）
  particles.forEach(particle => {
    const distToMouse = Math.sqrt(Math.pow(particle.x - mousePos.x, 2) + Math.pow(particle.y - mousePos.y, 2))
    const isClose = distToMouse < MOUSE_INTERACTION_DISTANCE || particle.isClickParticle

    // 基础颜色改为中性灰蓝，交互时变为品牌蓝
    if (isClose) {
      ctx.fillStyle = `rgba(42, 95, 189, ${particle.opacity * 0.7})`
    } else {
      // 稍微调淡非交互状态下的粒子颜色（避免圆点过于突兀）
      ctx.fillStyle = `rgba(148, 163, 184, ${particle.opacity * 0.4})`
    }
    
    ctx.beginPath()
    ctx.arc(particle.x, particle.y, isClose ? particle.radius : particle.radius * 0.7, 0, Math.PI * 2)
    ctx.fill()

    // 高亮效果
    if (isClose) {
      ctx.strokeStyle = `rgba(42, 95, 189, ${particle.opacity * 0.3})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.radius + 3, 0, Math.PI * 2)
      ctx.stroke()
    }
  })

  requestAnimationFrame(animateParticles)
}


onMounted(() => {
  window.addEventListener('message', handleMessage)
  AOS.init({
    duration: 800,
    easing: 'ease-out-cubic',
    once: true,
    offset: 50
  })

  if (particleCanvas.value) {
    const canvas = particleCanvas.value
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    canvasWidth = window.innerWidth
    canvasHeight = window.innerHeight
    initParticles(canvas)
    animateParticles()

    // 鼠标追踪
    document.addEventListener('mousemove', (e) => {
      mousePos.x = e.clientX
      mousePos.y = e.clientY
    })

    // 鼠标离开时重置
    document.addEventListener('mouseleave', () => {
      mousePos.x = -1000
      mousePos.y = -1000
    })

    window.addEventListener('resize', () => {
      const newWidth = window.innerWidth
      const newHeight = window.innerHeight
      
      // 计算缩放比例
      const scaleX = newWidth / canvasWidth
      const scaleY = newHeight / canvasHeight
      
      // 按比例缩放粒子坐标
      particles.forEach(particle => {
        particle.x *= scaleX
        particle.y *= scaleY
      })
      
      // 更新记录的画布大小
      canvasWidth = newWidth
      canvasHeight = newHeight
      canvas.width = newWidth
      canvas.height = newHeight
    })
  }

})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage)
})

// 创建爆裂粒子效果的通用函数
const createBurstEffect = (e: Event) => {
  const element = e.currentTarget as HTMLElement
  const rect = element.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  // 创建随机数量的爆裂粒子（12-20个）
  const particleCount = 12 + Math.floor(Math.random() * 9)

  for (let i = 0; i < particleCount; i++) {
    const baseAngle = (i / particleCount) * Math.PI * 2
    const angleOffset = (Math.random() - 0.5) * 0.5
    const angle = baseAngle + angleOffset

    const speed = 2.5 + Math.random() * 3
    const radius = Math.random() * 3 + 0.5
    const life = 50 + Math.floor(Math.random() * 30)

    particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      baseVx: 0,
      baseVy: 0,
      radius: radius,
      opacity: 0.6 + Math.random() * 0.4,
      targetOpacity: 0.6 + Math.random() * 0.4,
      isClickParticle: true,
      life: life
    })
  }
}

const handleBadgeClick = (e: Event) => {
  e.preventDefault()
  createBurstEffect(e)
  // 延迟700ms后打开链接，让用户看到完整动画
  setTimeout(() => {
    window.open('https://www.aliyun.com/product/esa', '_blank')
  }, 700)
}

const handleButtonClick = async (e: Event) => {
  const button = e.currentTarget as HTMLButtonElement
  button.classList.add('clicked')

  createBurstEffect(e)

  try {
    loading.value = true
    await authStore.guestLogin()
    message.success('登录成功')
    router.push('/dashboard')
  } catch (err) {
    message.error(err instanceof Error ? err.message : '登录失败')
    loading.value = false
  } finally {
    setTimeout(() => {
      button.classList.remove('clicked')
    }, 600)
  }
}

const loginWithMicrosoft = () => {
  const state = generateRandomState()
  sessionStorage.setItem('oauth_state', state)
  sessionStorage.setItem('oauth_provider', 'microsoft')

  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    redirect_uri: MICROSOFT_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email',
    state: state,
    response_mode: 'query'
  })

  loading.value = true
  window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
}

const handleLoginWithMicrosoft = (e: Event) => {
  e.preventDefault()
  createBurstEffect(e)
  // 延迟700ms后再跳转，让用户看到完整动画
  setTimeout(() => {
    loginWithMicrosoft()
  }, 700)
}
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  overflow-x: hidden;
  background: #0c1621;
  color: #f8fafc;
  position: relative;
}

/* Decorative Background */
.bg-decoration {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.shape {
  position: absolute;
  filter: blur(100px);
  opacity: 0.1;
  border-radius: 50%;
  z-index: 0;
}

.shape-1 {
  width: 40vw;
  height: 40vw;
  background: #3b82f6;
  top: -10vw;
  left: -10vw;
}

.shape-2 {
  width: 35vw;
  height: 35vw;
  background: #8b5cf6;
  bottom: -5vw;
  right: -5vw;
}

.shape-3 {
  width: 25vw;
  height: 25vw;
  background: #10b981;
  top: 40%;
  left: 60%;
}

/* Particle Canvas */
.particle-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
  opacity: 1;
}

/* Hero Section */
.hero-section {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  position: relative;
  overflow: hidden;
  z-index: 2;
}

.hero-content {
  max-width: 1200px;
  width: 100%;
  text-align: left;
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 60px;
  user-select: none;
}

.hero-text-area {
  flex: 1;
  max-width: 600px;
}

.hero-preview-area {
  flex: 1;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.preview-window {
  width: 100%;
  max-width: 600px;
  aspect-ratio: 4 / 3;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 2;
}

.window-header {
  height: 36px;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
}

.window-dots {
  display: flex;
  gap: 6px;
}

.window-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #cbd5e1;
}

.window-dots span:nth-child(1) { background: #ff5f56; }
.window-dots span:nth-child(2) { background: #ffbd2e; }
.window-dots span:nth-child(3) { background: #27c93f; }

.window-title {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}

.window-content {
  flex: 1;
  background: white; /* 模拟编辑器背景 */
  position: relative;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  transform: scale(1); /* 恢复 100% 缩放 */
  transform-origin: 0 0;
  border: none;
}

.preview-glow {
  position: absolute;
  width: 120%;
  height: 120%;
  background: radial-gradient(circle, rgba(42, 95, 189, 0.1) 0%, transparent 70%);
  z-index: 1;
  pointer-events: none;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 24px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 100px;
  color: #60a5fa;
  font-size: 14px;
  margin-bottom: 32px;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(4px);
}

.hero-badge::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  transition: none;
  animation: shine 3s infinite;
}

@keyframes shine {
  0% { left: -100%; }
  20% { left: 100%; }
  100% { left: 100%; }
}

.hero-badge:hover {
  background: rgba(59, 130, 246, 0.15);
  transform: translateY(-2px) scale(1.02);
  border-color: rgba(59, 130, 246, 0.4);
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.2);
}

.badge-icon {
  font-size: 16px;
  animation: iconPulse 2s infinite;
  display: inline-block;
}

@keyframes iconPulse {
  0%, 100% { transform: scale(1) rotate(0); filter: drop-shadow(0 0 0 rgba(59, 130, 246, 0)); }
  50% { transform: scale(1.2) rotate(15deg); filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.5)); }
}

.hero-title {
  font-size: clamp(40px, 8vw, 72px);
  font-weight: 800;
  color: #ffffff;
  margin: 0;
  line-height: 1.1;
  display: flex;
  flex-direction: column;
}

.gradient-text {
  background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  display: inline-block;
}

.title-divider {
  display: none;
  margin: 0 16px;
  color: #475569;
  font-weight: 300;
  animation: dividerPulse 2s ease-in-out infinite;
}

.hero-subtitle {
  font-size: clamp(16px, 2vw, 20px);
  color: #94a3b8;
  margin: 24px 0 40px;
  max-width: 600px;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  gap: 16px;
  justify-content: flex-start;
  flex-wrap: wrap;
}

.btn-primary {
  background: #3b82f6;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-primary:hover {
  background: #2563eb;
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.3);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(4px);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-2px);
}


.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 28px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: visible;
}

.btn-primary.clicked,
.btn-secondary.clicked {
  animation: button-click 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes button-click {
  0% {
    transform: scale(1);
  }

  30% {
    transform: scale(0.95);
  }

  50% {
    box-shadow: 0 0 20px rgba(42, 95, 189, 0.2);
  }

  100% {
    transform: scale(1);
  }
}

.icon-arrow {
  width: 20px;
  height: 20px;
  transition: transform 0.3s ease;
}

.btn-primary:hover .icon-arrow,
.btn-cta:hover .icon-arrow {
  transform: translateX(4px);
}

/* Features Section */
.features-section {
  background: #0f1a2a;
  padding: 100px 20px;
  position: relative;
  z-index: 2;
}

.section-header {
  text-align: center;
  margin-bottom: 60px;
}

.section-title {
  font-size: clamp(32px, 5vw, 48px);
  font-weight: 800;
  color: #ffffff;
  margin: 0 0 16px;
}

.section-subtitle {
  font-size: 18px;
  color: #94a3b8;
  margin: 0;
}

.features-grid {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 30px;
}

.feature-card {
  padding: 40px 30px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.05);
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.card-flip:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3), 0 0 20px rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.3);
}

.feature-icon {
  width: 60px;
  height: 60px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  transition: all 0.3s ease;
  background: rgba(59, 130, 246, 0.1);
}

.icon-glow {
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
}

.feature-card:hover .feature-icon {
  transform: scale(1.1) rotate(5deg);
  box-shadow: 0 0 30px rgba(59, 130, 246, 0.5);
}

.feature-icon svg {
  width: 30px;
  height: 30px;
  color: #60a5fa;
}

.feature-title {
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 12px;
}

.feature-desc {
  font-size: 15px;
  color: #94a3b8;
  line-height: 1.6;
  margin: 0;
}

/* Tech Section */
.tech-section {
  background: #0c1621;
  padding: 80px 20px;
  position: relative;
  z-index: 2;
}

.tech-content {
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
}

.tech-title {
  font-size: clamp(24px, 4vw, 36px);
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 30px;
}

.tech-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
}

.tech-badge {
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 50px;
  font-size: 16px;
  font-weight: 600;
  color: #60a5fa;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.badge-glow {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 15px rgba(59, 130, 246, 0.2);
}

.tech-badge:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3), 0 0 25px rgba(59, 130, 246, 0.4);
  border-color: #3b82f6;
  background: rgba(255, 255, 255, 0.08);
}

/* CTA Section */
.cta-section {
  background: linear-gradient(135deg, #1e3a8a 0%, #312e81 100%);
  padding: 100px 20px;
  position: relative;
  z-index: 2;
}

.cta-content {
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
}

.cta-title {
  font-size: clamp(32px, 5vw, 48px);
  font-weight: 800;
  color: white;
  margin: 0 0 16px;
}

.cta-subtitle {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.9);
  margin: 0 0 40px;
}

.btn-cta {
  background: #ffffff;
  color: #1e40af;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.btn-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 30px rgba(0, 0, 0, 0.4);
}

/* Footer */
.footer {
  background: #080f18;
  padding: 30px 20px;
  text-align: center;
  position: relative;
  z-index: 2;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.footer p {
  color: #64748b;
  margin: 0;
  font-size: 14px;
}

/* Responsive */
@media (max-width: 1024px) {
  .hero-content {
    flex-direction: column;
    text-align: center;
    gap: 40px;
    padding-top: 40px;
  }

  .hero-title {
    flex-direction: row;
    align-items: center;
    justify-content: center;
  }

  .title-divider {
    display: inline-block;
  }

  .hero-text-area {
    max-width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .hero-subtitle {
    margin-left: auto;
    margin-right: auto;
  }

  .hero-actions {
    justify-content: center;
  }

  .hero-preview-area {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .hero-section {
    padding: 60px 20px;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .tech-stack {
    gap: 12px;
  }

  .tech-badge {
    padding: 10px 20px;
    font-size: 14px;
  }

  .shape {
    display: none;
  }
}
</style>
