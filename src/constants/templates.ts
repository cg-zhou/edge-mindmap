/**
 * 思维导图模板定义 (KityMinder 格式)
 */

import type { MindmapContent } from '@/types/files'

export interface MindmapTemplate {
  id: string           // 模板ID
  name: string         // 显示名称
  description: string  // 简短描述（用于 hover）
  icon: string        // emoji 图标
  content: MindmapContent
}

// 3 个预置模板
export const TEMPLATES: Record<string, MindmapTemplate> = {
  blank: {
    id: 'blank',
    name: '默认',
    description: '紧凑经典样式',
    icon: '✨',
    content: {
      root: {
        data: { 
          text: '欢迎使用',
          note: '这是一段操作说明，帮助您快速上手。',
          hyperlink: 'https://edge-mindmap.79f54793.er.aliyun-esa.net',
          priority: 1
        },
        children: [
          { data: { text: '键盘快捷键 (高效率)', priority: 2 }, children: [
            { data: { text: 'Tab: 插入下级节点' }, children: [] },
            { data: { text: 'Enter: 插入同级节点' }, children: [] },
            { data: { text: 'F2: 编辑节点文本' }, children: [] },
            { data: { text: 'Delete: 删除选中节点' }, children: [] }
          ]},
          { data: { text: '富文本功能展示', progress: 5 }, children: [
            { data: { text: '优先级图标 (Priority)', priority: 1 }, children: [] },
            { data: { text: '任务进度环 (Progress)', progress: 8 }, children: [] },
            { data: { text: '备注功能 (Note)', note: '点击右下角查看详情' }, children: [] }
          ]},
          { data: { text: '视图操作' }, children: [
            { data: { text: '鼠标滚轮: 上下滚动' }, children: [] },
            { data: { text: 'Ctrl+滚轮: 缩放画布' }, children: [] },
            { data: { text: '右键拖拽: 移动画布' }, children: [] }
          ]},
          { data: { text: '官方网站', hyperlink: 'https://edge-mindmap.79f54793.er.aliyun-esa.net' }, children: [] }
        ]
      },
      template: 'right',
      theme: 'fresh-purple-compat',
      version: '1.4.43'
    }
  },

  dir: {
    id: 'dir',
    name: '目录组织',
    description: '展示进度与标签',
    icon: '📁',
    content: {
      root: {
        data: { text: '项目资产管理' },
        children: [
          { 
            data: { text: '核心文档', progress: 3 }, 
            children: [
              { data: { text: '产品需求文档 (PRD)', hyperlink: 'https://edge-mindmap.79f54793.er.aliyun-esa.net' }, children: [] },
              { data: { text: '交互设计稿', priority: 1 }, children: [] },
              { data: { text: '视觉规范', note: '包含字体和配色方案' }, children: [] }
            ] 
          },
          { 
            data: { text: '工程代码', progress: 6 }, 
            children: [
              { data: { text: '前端仓库 (Edge Mindmap)', priority: 1, hyperlink: 'https://edge-mindmap.79f54793.er.aliyun-esa.net' }, children: [] },
              { data: { text: '后端 API 全集' }, children: [] },
              { data: { text: '数据库迁移脚本' }, children: [] }
            ] 
          },
          { 
            data: { text: '基础设施' }, 
            children: [
              { data: { text: 'ESA 边缘服务部署', progress: 10 }, children: [] },
              { data: { text: '域名解析设置' }, children: [] }
            ] 
          }
        ]
      },
      template: 'filetree',
      theme: 'fresh-green-compat',
      version: '1.4.43'
    }
  },

  fish: {
    id: 'fish',
    name: '鱼骨图',
    description: '线框冷光风格',
    icon: '🐟',
    content: {
      root: {
        data: { 
          text: '性能回归原因分析',
          note: '针对 1.5.0 版本的启动耗时分析'
        },
        children: [
          { 
            data: { text: '代码层面', priority: 1 }, 
            children: [
              { data: { text: '未使用的依赖包过多', progress: 4, note: '需要清理 package.json' }, children: [] },
              { data: { text: '巨大的静态资源引入', priority: 2 }, children: [] },
              { data: { text: '递归逻辑优化空间' }, children: [] }
            ] 
          },
          { 
            data: { text: '网络/环境', priority: 2 }, 
            children: [
              { data: { text: 'CDN 节点缓存未命中' }, children: [] },
              { data: { text: 'API 首字节延迟 (TTFB)', note: '需检查边缘函数耗时', hyperlink: 'https://edge-mindmap.79f54793.er.aliyun-esa.net' }, children: [] }
            ] 
          },
          { 
            data: { text: '第三方插件' }, 
            children: [
              { data: { text: '统计脚本阻塞渲染', progress: 1 }, children: [] },
              { data: { text: '广告脚本检测' }, children: [] }
            ] 
          }
        ]
      },
      template: 'fish-bone',
      theme: 'classic-compact',
      version: '1.4.43'
    }
  }
}

export const TEMPLATE_LIST = Object.values(TEMPLATES)
