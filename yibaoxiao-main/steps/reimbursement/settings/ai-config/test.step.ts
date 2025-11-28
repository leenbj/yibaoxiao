/**
 * 测试 AI 配置 API
 * 
 * POST /api/settings/ai-config/test
 * 测试 AI 模型配置是否可用
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../../middlewares/error-handler.middleware'
import { 
  AIConfig,
  AIProviderSchema,
  AI_PROVIDERS_INFO,
  STATE_GROUPS, 
  ErrorResponseSchema 
} from '../../types'

// 请求体 Schema
const bodySchema = z.object({
  userId: z.string(),
  provider: AIProviderSchema,
  apiKey: z.string(),
  apiUrl: z.string().optional(),
  model: z.string().optional(),
})

// 响应 Schema
const responseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  response: z.string().optional(),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'TestAIConfig',
  description: '测试 AI 配置',
  path: '/api/settings/ai-config/test',
  method: 'POST',
  flows: ['reimbursement-settings'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  bodySchema,
  responseSchema: {
    200: responseSchema,
    400: ErrorResponseSchema,
  },
}

export const handler: Handlers['TestAIConfig'] = async (req, { logger }) => {
  const { provider, apiKey, apiUrl, model } = bodySchema.parse(req.body)
  
  logger.info('测试 AI 配置', { provider })

  const providerInfo = AI_PROVIDERS_INFO[provider]
  const finalUrl = apiUrl || providerInfo.defaultUrl
  const finalModel = model || providerInfo.defaultModel

  try {
    // 根据不同厂商调用测试 API
    const result = await testProviderAPI(provider, apiKey, finalUrl, finalModel)

    logger.info('AI 配置测试成功', { provider })

    return {
      status: 200,
      body: {
        success: true,
        message: `${providerInfo.name} 连接成功！`,
        response: result,
      },
    }
  } catch (error: any) {
    logger.error('AI 配置测试失败', { provider, error: error.message })
    
    return {
      status: 200, // 返回 200，但 success 为 false
      body: {
        success: false,
        message: `连接失败: ${error.message}`,
      },
    }
  }
}

/**
 * 测试不同厂商的 API
 */
async function testProviderAPI(
  provider: string,
  apiKey: string,
  apiUrl: string,
  model: string
): Promise<string> {
  const testPrompt = '请回复"连接成功"四个字。'

  switch (provider) {
    case 'gemini':
      return await testGemini(apiKey, apiUrl, model, testPrompt)
    case 'deepseek':
    case 'minimax':
    case 'openai':
    case 'qwen':
    case 'doubao':      // 火山引擎豆包 - 兼容 OpenAI SDK
    case 'volcengine':  // 火山引擎别名
    case 'moonshot':
      return await testOpenAICompatible(apiKey, apiUrl, model, testPrompt)
    case 'glm':
      return await testGLM(apiKey, apiUrl, model, testPrompt)
    case 'claude':
      return await testClaude(apiKey, apiUrl, model, testPrompt)
    default:
      throw new Error('不支持的模型厂商')
  }
}

/**
 * 测试 Gemini API
 */
async function testGemini(apiKey: string, apiUrl: string, model: string, prompt: string): Promise<string> {
  const url = `${apiUrl}/models/${model}:generateContent?key=${apiKey}`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    
    // 针对不同错误码给出提示
    if (response.status === 429) {
      throw new Error('请求次数超限，请稍后重试或更换代理地址')
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('API Key 无效或权限不足')
    }
    if (response.status === 404) {
      throw new Error('API 地址错误或模型不存在')
    }
    
    throw new Error(`API 错误: ${response.status}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '响应解析失败'
}

/**
 * 测试 OpenAI 兼容 API（DeepSeek、MiniMax、通义千问等）
 */
async function testOpenAICompatible(apiKey: string, apiUrl: string, model: string, prompt: string): Promise<string> {
  const url = `${apiUrl}/chat/completions`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API 错误: ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || '响应解析失败'
}

/**
 * 测试智谱 GLM API
 */
async function testGLM(apiKey: string, apiUrl: string, model: string, prompt: string): Promise<string> {
  const url = `${apiUrl}/chat/completions`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
    })
  })

  if (!response.ok) {
    throw new Error(`API 错误: ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || '响应解析失败'
}

/**
 * 测试 Claude API
 */
async function testClaude(apiKey: string, apiUrl: string, model: string, prompt: string): Promise<string> {
  const url = `${apiUrl}/messages`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    })
  })

  if (!response.ok) {
    throw new Error(`API 错误: ${response.status}`)
  }

  const data = await response.json()
  return data.content?.[0]?.text || '响应解析失败'
}


