<template>
  <div class="home-container">
    <div class="bg-decoration">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
    </div>

    <canvas ref="particleCanvas" class="particle-canvas"></canvas>

    <section class="hero-section">
      <div class="hero-content">
        <div class="hero-text-area">
          <a
            href="https://www.aliyun.com/product/esa"
            target="_blank"
            rel="noopener noreferrer"
            class="hero-badge glow-badge"
            data-aos="fade-down"
            @click="handleBadgeClick"
          >
            <span class="badge-icon">⚡</span>
            <span>基于阿里云 ESA 边缘计算</span>
          </a>

          <h1 class="hero-title glow-text" data-aos="fade-up" data-aos-delay="100">
            思维导图
            <span class="title-divider">|</span>
            <span class="gradient-text gradient-animated">MINDMAP</span>
          </h1>

          <p class="hero-subtitle" data-aos="fade-up" data-aos-delay="200">
            边缘节点加速，AI 辅助创作
          </p>

          <div class="hero-actions" data-aos="fade-up" data-aos-delay="300">
            <button class="btn-primary" @click="handleButtonClick">
              <span>立即体验</span>
              <svg class="icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M5 12h14m-7-7l7 7-7 7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div class="hero-preview-area" data-aos="fade-left" data-aos-delay="400">
          <div class="preview-window">
            <div class="window-header">
              <div class="window-dots">
                <span></span><span></span><span></span>
              </div>
              <div class="window-title">Mindmap Demo</div>
            </div>
            <div class="window-content">
              <iframe :src="previewSrc" class="preview-iframe" title="Mindmap Demo"></iframe>
            </div>
          </div>
          <div class="preview-glow"></div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AOS from 'aos'
import 'aos/dist/aos.css'

const router = useRouter()
const previewSrc = `${import.meta.env.BASE_URL}preview.html`
const particleCanvas = ref<HTMLCanvasElement | null>(null)

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  baseVx: number
  baseVy: number
  radius: number
  opacity: number
  targetOpacity: number
  isClickParticle?: boolean
  life?: number
}

let particles: Particle[] = []
let mousePos = { x: -1000, y: -1000 }
let canvasWidth = window.innerWidth
let canvasHeight = window.innerHeight
const CONNECTION_DISTANCE = 150
const MOUSE_INTERACTION_DISTANCE = 100
const VELOCITY_DECAY = 0.99

const handleMouseMove = (e: MouseEvent) => {
  mousePos.x = e.clientX
  mousePos.y = e.clientY
}

const handleMouseLeave = () => {
  mousePos.x = -1000
  mousePos.y = -1000
}

const handleResize = () => {
  const canvas = particleCanvas.value
  if (!canvas) return

  const newWidth = window.innerWidth
  const newHeight = window.innerHeight
  const scaleX = newWidth / canvasWidth
  const scaleY = newHeight / canvasHeight

  particles.forEach((particle) => {
    particle.x *= scaleX
    particle.y *= scaleY
  })

  canvasWidth = newWidth
  canvasHeight = newHeight
  canvas.width = newWidth
  canvas.height = newHeight
}

function initParticles(canvas: HTMLCanvasElement) {
  particles = []
  for (let i = 0; i < 120; i++) {
    const vx = (Math.random() - 0.5) * 0.3
    const vy = (Math.random() - 0.5) * 0.3
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx,
      vy,
      baseVx: vx,
      baseVy: vy,
      radius: Math.random() * 3 + 2,
      opacity: Math.random() * 0.3 + 0.7,
      targetOpacity: Math.random() * 0.3 + 0.7,
    })
  }
}

function animateParticles() {
  const canvas = particleCanvas.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  particles.forEach((particle) => {
    const currentVelocity = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy)
    const baseVelocity = Math.sqrt(particle.baseVx * particle.baseVx + particle.baseVy * particle.baseVy)

    if (currentVelocity > baseVelocity * 1.2) {
      particle.vx *= VELOCITY_DECAY
      particle.vy *= VELOCITY_DECAY
    }

    particle.x += particle.vx
    particle.y += particle.vy

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

    const dx = particle.x - mousePos.x
    const dy = particle.y - mousePos.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance < MOUSE_INTERACTION_DISTANCE) {
      particle.targetOpacity = 0.9
      const angle = Math.atan2(dy, dx)
      particle.vx += Math.cos(angle) * 0.2
      particle.vy += Math.sin(angle) * 0.2

      const velocity = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy)
      if (velocity > 4.5) {
        const scale = 4.5 / velocity
        particle.vx *= scale
        particle.vy *= scale
      }
    } else {
      particle.targetOpacity = Math.random() * 0.3 + 0.7
    }

    if (particle.isClickParticle) {
      particle.life! -= 1
      particle.opacity = (particle.life! / 60) * 0.8
      if (particle.life! <= 0) return
      particle.vx *= 0.98
      particle.vy *= 0.98
    } else {
      particle.opacity += (particle.targetOpacity - particle.opacity) * 0.05
    }
  })

  particles = particles.filter((p) => !p.isClickParticle || p.life! > 0)

  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i]!.x - particles[j]!.x
      const dy = particles[i]!.y - particles[j]!.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < CONNECTION_DISTANCE) {
        const opacity = (1 - distance / CONNECTION_DISTANCE) * 0.5
        const distToMouseI = Math.sqrt((particles[i]!.x - mousePos.x) ** 2 + (particles[i]!.y - mousePos.y) ** 2)
        const distToMouseJ = Math.sqrt((particles[j]!.x - mousePos.x) ** 2 + (particles[j]!.y - mousePos.y) ** 2)
        const isInteractive = distToMouseI < MOUSE_INTERACTION_DISTANCE || distToMouseJ < MOUSE_INTERACTION_DISTANCE

        ctx.strokeStyle = isInteractive
          ? `rgba(42, 95, 189, ${opacity * 0.8})`
          : `rgba(148, 163, 184, ${opacity * 0.6})`
        ctx.lineWidth = isInteractive ? 0.8 : 0.5

        ctx.beginPath()
        ctx.moveTo(particles[i]!.x, particles[i]!.y)
        ctx.lineTo(particles[j]!.x, particles[j]!.y)
        ctx.stroke()
      }
    }
  }

  particles.forEach((particle) => {
    const distToMouse = Math.sqrt((particle.x - mousePos.x) ** 2 + (particle.y - mousePos.y) ** 2)
    const isClose = distToMouse < MOUSE_INTERACTION_DISTANCE || particle.isClickParticle

    ctx.fillStyle = isClose
      ? `rgba(42, 95, 189, ${particle.opacity * 0.7})`
      : `rgba(148, 163, 184, ${particle.opacity * 0.4})`

    ctx.beginPath()
    ctx.arc(particle.x, particle.y, isClose ? particle.radius : particle.radius * 0.7, 0, Math.PI * 2)
    ctx.fill()

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

function createBurstEffect(e: Event) {
  const element = e.currentTarget as HTMLElement
  const rect = element.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
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
      radius,
      opacity: 0.6 + Math.random() * 0.4,
      targetOpacity: 0.6 + Math.random() * 0.4,
      isClickParticle: true,
      life,
    })
  }
}

const handleBadgeClick = (e: Event) => {
  e.preventDefault()
  createBurstEffect(e)
  setTimeout(() => {
    window.open('https://www.aliyun.com/product/esa', '_blank')
  }, 700)
}

const handleButtonClick = (e: Event) => {
  const button = e.currentTarget as HTMLButtonElement
  button.classList.add('clicked')
  createBurstEffect(e)
  setTimeout(() => {
    router.push('/dashboard')
  }, 350)
  setTimeout(() => button.classList.remove('clicked'), 600)
}

onMounted(() => {
  AOS.init({
    duration: 800,
    easing: 'ease-out-cubic',
    once: true,
    offset: 50,
  })

  const canvas = particleCanvas.value
  if (!canvas) return

  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  canvasWidth = window.innerWidth
  canvasHeight = window.innerHeight
  initParticles(canvas)
  animateParticles()

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseleave', handleMouseLeave)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseleave', handleMouseLeave)
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  overflow-x: hidden;
  background: #0c1621;
  color: #f8fafc;
  position: relative;
}

.bg-decoration {
  position: fixed;
  inset: 0;
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

.particle-canvas {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.hero-section {
  min-height: 100vh;
  display: flex;
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
  min-width: 520px;
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
  background: #ffffff;
  position: relative;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
  background: #fff;
  position: relative;
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
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
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

.btn-primary.clicked,
.btn-secondary.clicked {
  animation: button-click 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes button-click {
  0% { transform: scale(1); }
  30% { transform: scale(0.95); }
  50% { box-shadow: 0 0 20px rgba(42, 95, 189, 0.2); }
  100% { transform: scale(1); }
}

.icon-arrow {
  width: 20px;
  height: 20px;
  transition: transform 0.3s ease;
}

.btn-primary:hover .icon-arrow {
  transform: translateX(4px);
}

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
}

@media (max-width: 768px) {
  .hero-section {
    padding: 60px 20px;
  }

  .shape {
    display: none;
  }
}
</style>
