/**
 * 思维导图模板定义
 */

import type { MindmapContent } from '@/types/files'

export interface MindmapTemplate {
  id: string           // 模板ID
  name: string         // 显示名称
  description: string  // 简短描述（用于 hover）
  icon: string        // emoji 图标
  content: MindmapContent
}

// 4 个预置模板
export const TEMPLATES: Record<string, MindmapTemplate> = {
  blank: {
    id: 'blank',
    name: '空白',
    description: '从空白开始',
    icon: '✨',
    content: {
      nodeData: {
        id: 'root_blank',
        topic: '中心主题',
        children: []
      },
      arrows: [],
      summaries: [],
      direction: 1
    } as MindmapContent
  },

  planning: {
    id: 'planning',
    name: '项目计划',
    description: '设计→开发→测试→发布',
    icon: '📋',
    content: {
      nodeData: {
        id: 'root_planning',
        topic: '🚀 项目计划',
        children: [
          { 
            id: 'node_req', 
            topic: '📅 需求分析', 
            children: [
              { id: 'node_req_user', topic: '用户访谈', children: [] },
              { id: 'node_req_doc', topic: '需求文档', children: [] }
            ] 
          },
          { 
            id: 'node_design', 
            topic: '🎨 系统设计', 
            children: [
              { id: 'node_design_ui', topic: 'UI/UX 设计', children: [] },
              { id: 'node_design_arch', topic: '架构设计', children: [] }
            ] 
          },
          { 
            id: 'node_dev', 
            topic: '💻 开发实现', 
            children: [
              { id: 'node_dev_fe', topic: '前端开发', children: [] },
              { id: 'node_dev_be', topic: '后端开发', children: [] }
            ] 
          },
          { 
            id: 'node_test', 
            topic: '🧪 测试验证', 
            children: [
              { id: 'node_test_unit', topic: '单元测试', children: [] },
              { id: 'node_test_uat', topic: '验收测试', children: [] }
            ] 
          },
          { 
            id: 'node_release', 
            topic: '🚀 发布上线', 
            children: [
              { id: 'node_release_prod', topic: '正式上线', children: [] }
            ] 
          }
        ]
      },
      arrows: [
        { id: 'arrow_req_test', label: '验证依据', from: 'node_req_doc', to: 'node_test_uat', delta1: {x: 0, y: 0}, delta2: {x: 0, y: 0} }
      ],
      summaries: [
        { id: 'sum_dev', parent: 'node_dev', start: 0, end: 1, label: '核心开发' }
      ],
      direction: 1
    } as MindmapContent
  },

  meeting: {
    id: 'meeting',
    name: '会议记录',
    description: '议题→参与者→讨论→决议',
    icon: '📝',
    content: {
      nodeData: {
        id: 'root_meeting',
        topic: '📝 会议记录',
        children: [
          { 
            id: 'node_agenda', 
            topic: '🎯 议题', 
            children: [
              { id: 'node_agenda_1', topic: '产品进度回顾', children: [] },
              { id: 'node_agenda_2', topic: '下季度规划', children: [] }
            ] 
          },
          { 
            id: 'node_attendees', 
            topic: '👥 参与者', 
            children: [
              { id: 'node_attendee_1', topic: '主持人: Alex', children: [] },
              { id: 'node_attendee_2', topic: '记录人: Sam', children: [] }
            ] 
          },
          { 
            id: 'node_discuss', 
            topic: '💬 讨论内容', 
            children: [
              { id: 'node_discuss_tech', topic: '新技术栈选型', children: [] },
              { id: 'node_discuss_risk', topic: '风险评估', children: [] }
            ] 
          },
          { 
            id: 'node_decision', 
            topic: '✅ 主要决议', 
            children: [
              { id: 'node_decision_vue', topic: '确认采用 Vue 3', children: [] },
              { id: 'node_decision_share', topic: '每周技术分享', children: [] }
            ] 
          },
          { 
            id: 'node_todo', 
            topic: '📌 待办事项', 
            children: [
              { id: 'node_todo_1', topic: '@Alex 整理文档', children: [] }
            ] 
          }
        ]
      },
      arrows: [
        { id: 'arrow_discuss_decision', label: '产出', from: 'node_discuss_tech', to: 'node_decision_vue', delta1: {x: 0, y: 0}, delta2: {x: 0, y: 0} }
      ],
      summaries: [
        { id: 'sum_decision', parent: 'node_decision', start: 0, end: 1, label: '达成一致' }
      ],
      direction: 1
    } as MindmapContent
  },

  brainstorm: {
    id: 'brainstorm',
    name: '头脑风暴',
    description: '主题→自由发散想法',
    icon: '💡',
    content: {
      nodeData: {
        id: 'root_brainstorm',
        topic: '💡 头脑风暴',
        children: [
          { 
            id: 'node_goal', 
            topic: '🌟 核心目标', 
            children: [
              { id: 'node_goal_retention', topic: '提升用户留存', children: [] },
              { id: 'node_goal_active', topic: '增加日活', children: [] }
            ] 
          },
          { 
            id: 'node_idea', 
            topic: '💥 创意发散', 
            children: [
              { id: 'node_idea_game', topic: '游戏化任务', children: [] },
              { id: 'node_idea_daily', topic: '每日签到', children: [] },
              { id: 'node_idea_community', topic: '社区互动', children: [] }
            ] 
          },
          { 
            id: 'node_risk', 
            topic: '🚧 潜在风险', 
            children: [
              { id: 'node_risk_cost', topic: '开发成本高', children: [] }
            ] 
          }
        ]
      },
      arrows: [
        { id: 'arrow_goal_idea', label: '解决方案', from: 'node_goal_retention', to: 'node_idea_game', delta1: {x: 0, y: 0}, delta2: {x: 0, y: 0} }
      ],
      summaries: [
        { id: 'sum_idea', parent: 'node_idea', start: 0, end: 1, label: '激励机制' }
      ],
      direction: 1
    } as MindmapContent
  }
}

export const TEMPLATE_LIST = Object.values(TEMPLATES)
