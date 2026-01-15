/**
 * 思维导图模板定义 (KityMinder 格式)
 */

import type { MindmapContent, KMNode } from '@/types/files'

export interface MindmapTemplate {
  id: string           // 模板ID
  name: string         // 显示名称
  description: string  // 简短描述（用于 hover）
  icon: string        // emoji 图标
  content: MindmapContent
}

// 辅助函数，快速创建节点内容
const createNode = (text: string, children: KMNode[] = []): KMNode => ({
  data: { text },
  children
})

// 4 个预置模板
export const TEMPLATES: Record<string, MindmapTemplate> = {
  blank: {
    id: 'blank',
    name: '空白',
    description: '从空白开始',
    icon: '✨',
    content: {
      root: {
        data: { text: '中心主题' },
        children: []
      },
      template: 'default',
      theme: 'fresh-blue',
      version: '1.4.43'
    }
  },

  planning: {
    id: 'planning',
    name: '项目计划',
    description: '设计→开发→测试→发布',
    icon: '📋',
    content: {
      root: createNode('🚀 项目计划', [
        createNode('📅 需求分析', [
          createNode('用户访谈'),
          createNode('需求文档')
        ]),
        createNode('🎨 系统设计', [
          createNode('UI/UX 设计'),
          createNode('架构设计')
        ]),
        createNode('💻 开发实现', [
          createNode('前端开发'),
          createNode('后端开发')
        ]),
        createNode('🧪 测试验证', [
          createNode('单元测试'),
          createNode('验收测试')
        ]),
        createNode('🚀 发布上线', [
          createNode('正式上线')
        ])
      ]),
      template: 'default',
      theme: 'fresh-blue',
      version: '1.4.43'
    }
  },

  meeting: {
    id: 'meeting',
    name: '会议记录',
    description: '议题→参与者→讨论→决议',
    icon: '📝',
    content: {
      root: createNode('📝 会议记录', [
        createNode('🎯 议题', [
          createNode('产品进度回顾'),
          createNode('下季度规划')
        ]),
        createNode('👥 参与者', [
          createNode('主持人: Alex'),
          createNode('记录人: Sam')
        ]),
        createNode('💬 讨论内容', [
          createNode('新技术栈选型'),
          createNode('风险评估')
        ]),
        createNode('✅ 主要决议', [
          createNode('确认采用 Vue 3'),
          createNode('每周技术分享')
        ]),
        createNode('📌 待办事项', [
          createNode('@Alex 整理文档')
        ])
      ]),
      template: 'default',
      theme: 'fresh-blue',
      version: '1.4.43'
    }
  },

  brainstorm: {
    id: 'brainstorm',
    name: '头脑风暴',
    description: '主题→自由发散想法',
    icon: '💡',
    content: {
      root: createNode('💡 头脑风暴', [
        createNode('🌟 核心目标', [
          createNode('提升用户留存'),
          createNode('增加日活')
        ]),
        createNode('💥 创意发散', [
          createNode('游戏化任务'),
          createNode('每日签到'),
          createNode('社区互动')
        ]),
        createNode('🚧 潜在风险', [
          createNode('开发成本高')
        ])
      ]),
      template: 'default',
      theme: 'fresh-blue',
      version: '1.4.43'
    }
  }
}

export const TEMPLATE_LIST = Object.values(TEMPLATES)
