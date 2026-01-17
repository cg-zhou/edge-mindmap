import authService from './auth'

const API_BASE = import.meta.env.VITE_API_BASE || ''

export interface AINode {
  text: string
  parent?: string
  priority?: number
  progress?: number
  note?: string
}

class AIService {
  /**
   * 将扁平化的节点列表转换为 KityMinder 格式
   */
  private buildTree(nodes: AINode[]): any {
    if (nodes.length === 0) return null

    const rootNode = nodes.find(n => !n.parent) || nodes[0]!
    const root = {
      data: {
        text: rootNode.text,
        priority: rootNode.priority,
        progress: rootNode.progress,
        note: rootNode.note
      },
      children: [] as any[]
    }

    const nodeMap = new Map<string, any>()
    nodeMap.set(rootNode.text, root)

    // 处理子节点
    nodes.forEach(node => {
      if (!node.parent || node === rootNode) return
      
      const parent = nodeMap.get(node.parent)
      if (parent) {
        const newNode = {
          data: {
            text: node.text,
            priority: node.priority,
            progress: node.progress,
            note: node.note
          },
          children: []
        }
        parent.children.push(newNode)
        nodeMap.set(node.text, newNode)
      }
    } )

    return { root }
  }

  /**
   * 从文本流中提取完整的 JSON 块
   */
  private extractCompleteNodes(text: string): AINode[] {
    const lines = text.split('\n')
    const nodes: AINode[] = []
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      
      try {
        // 只处理完整的、能用 JSON.parse 解析的行
        const node = JSON.parse(trimmed)
        if (node && node.text) {
          nodes.push(node)
        }
      } catch (e) {
        // 这一行可能还不完整，跳过
      }
    }
    return nodes
  }

  /**
   * 调用 AI 生成脑图 JSON (SSE 流式版本)
   */
  async generateMindmap(prompt: string, onContent?: (parsed: any, rawNodes: AINode[]) => void) {
    const token = authService.getToken()
    
    try {
      const response = await fetch(`${API_BASE}/api/ai/generate`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      })

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `AI 服务异常: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('流读取器初始化失败')

      const decoder = new TextDecoder()
      let fullText = ''
      let buffer = '' 

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine || !trimmedLine.startsWith('data:')) continue
          
          const dataStr = trimmedLine.replace('data:', '').trim()
          if (dataStr === '[DONE]') break
          
          try {
            const data = JSON.parse(dataStr)
            const content = data.choices?.[0]?.delta?.content || ''
            if (content) {
              fullText += content
              if (onContent) {
                const nodes = this.extractCompleteNodes(fullText)
                if (nodes.length > 0) {
                  const tree = this.buildTree(nodes)
                  onContent(tree, nodes)
                }
              }
            }
          } catch (e) {}
        }
      }
      
      const nodes = this.extractCompleteNodes(fullText)
      const finalResult = this.buildTree(nodes)
      
      if (!finalResult) {
        throw new Error('生成的格式不正确，请尝试更简单的描述')
      }
      return finalResult
    } catch (error: any) {
      console.error('AI Generation Error:', error)
      throw error
    }
  }
}

export default new AIService()
