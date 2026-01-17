/**
 * 阿里云边缘函数 - AI 脑图创作服务
 */

const CONFIG = {
  QWEN_API_KEY: '', // 请在 ESA 控制台环境变量中配置 QWEN_API_KEY
  QWEN_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  QWEN_MODEL: 'qwen3-coder-plus', 
};

const SYSTEM_PROMPT = `你是一个专业的思维导图构建专家。
请将用户输入的文本转换为逻辑结构严密、层次清晰、内容丰富的思维导图。

！！！重要：输出格式要求！！！
请输出一系列独立的 JSON 对象，每个对象占一行。严禁输出嵌套的 JSON。
格式规范如下：
1. 根节点：{"text": "核心主题"}
2. 子节点：{"parent": "父节点文本", "text": "子节点文本", "note": "必要的备注信息"}
3. 列表标识：如果某个节点的子节点需要按 1, 2, 3 顺序排列，请给该节点添加 "isList": true 字段。

约束条件：
- 第一行必须且只能是根节点（没有 parent 字段）。
- 后续每一行必须包含 parent 字段，其值必须是之前已经出现过的节点文本。
- 全局最多只能有一个节点带有 "isList": true 标识。
- 如果输入内容非常精简（约 50 字以内），请根据专业知识进行适度扩充。如果输入内容较多，请严格基于用户提供的信息进行提炼和组织，禁止额外扩充。
- 节点层级应丰富，建议最多可以达到 4 层深度（根节点为第 1 层）。
- "note" 字段仅在确实需要补充核心背景或详细说明时使用。
- 严禁包含 Markdown 标签或任何解释性文字。
- 总节点数严禁超过 60 个。

示例输出：
{"text": "人工智能", "isList": true}
{"parent": "人工智能", "text": "机器学习"}
{"parent": "机器学习", "text": "监督学习", "note": "需要标签数据"}
{"parent": "人工智能", "text": "深度学习"}`;

/**
 * 清理 AI 返回的文本，确保是合法的 JSON
 */
function cleanContent(content) {
  let clean = content.trim();
  // 移除可能存在的 Markdown 代码块标记
  clean = clean.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  clean = clean.replace(/^```\n?/, '').replace(/\n?```$/, '');
  
  // 尝试寻找第一个 { 和最后一个 }
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    clean = clean.substring(start, end + 1);
  }
  
  return JSON.parse(clean);
}

export default {
  async fetch(request, env) {
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const url = new URL(request.url);

    // 路由匹配
    if (url.pathname === '/api/ai/generate' && request.method === 'POST') {
      try {
        const { prompt } = await request.json();
        if (!prompt) throw new Error('Prompt is required');

        const apiKey = env.QWEN_API_KEY || CONFIG.QWEN_API_KEY;
        if (!apiKey) throw new Error('QWEN_API_KEY not configured');

        const aiResponse = await fetch(`${CONFIG.QWEN_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: CONFIG.QWEN_MODEL,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 1500,
            stream: true, // 开启流式输出
          }),
        });

        if (!aiResponse.ok) {
          const errorMsg = await aiResponse.text();
          throw new Error(`AI 服务异常: ${errorMsg}`);
        }

        // 直接透传流式响应，保持连接活跃，防止 30s 超时
        return new Response(aiResponse.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          },
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};
