// Supabase Edge Function - AI Recognize
// 代理 AI API 调用，解决前端 CORS 问题

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AIConfig {
  provider: string
  api_key: string
  api_url?: string
  model?: string
}

interface RecognizeRequest {
  images: string[]
  type: 'invoice' | 'approval' | 'travel'
  userId: string
}

// 获取用户活跃的 AI 配置
async function getActiveAIConfig(supabase: any, userId: string): Promise<AIConfig | null> {
  const { data, error } = await supabase
    .from('ai_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('[AI] 获取配置失败:', error)
    return null
  }

  if (!data) {
    return null
  }

  return {
    provider: data.provider,
    api_key: data.api_key,
    api_url: data.api_url,
    model: data.model,
  }
}

// 构建 AI 请求
function buildAIRequest(config: AIConfig, images: string[], type: string) {
  const prompts: Record<string, string> = {
    invoice: `请识别这张发票图片，提取以下信息并以 JSON 格式返回：
{
  "projectName": "项目名称或费用事由",
  "totalAmount": 金额数字,
  "invoiceDate": "开票日期 YYYY-MM-DD",
  "invoiceNumber": "发票号码",
  "seller": "销售方名称",
  "items": [{"name": "项目名称", "amount": 金额}]
}

如果是多张发票，返回数组格式：[{...}, {...}]
请只返回 JSON，不要有其他说明文字。`,
    approval: `请识别这张审批单/申请单图片，提取以下信息并以 JSON 格式返回：
{
  "approvalNumber": "审批单号",
  "eventSummary": "事由摘要",
  "applicant": "申请人",
  "approvalAmount": 批准金额数字,
  "budgetProject": "预算项目名称",
  "budgetCode": "预算项目编码"
}
请只返回 JSON，不要有其他说明文字。`,
    travel: `请识别这张差旅相关票据图片，提取以下信息并以 JSON 格式返回：
{
  "type": "交通/住宿/餐饮",
  "from": "出发地",
  "to": "目的地",
  "date": "日期 YYYY-MM-DD",
  "amount": 金额数字,
  "description": "描述"
}
请只返回 JSON，不要有其他说明文字。`
  }

  const systemPrompt = prompts[type] || prompts.invoice
  const userMessage = type === 'travel'
    ? '请识别这张差旅票据'
    : type === 'approval'
      ? '请识别这张审批单'
      : '请识别这张发票'

  let apiUrl: string
  let requestBody: any
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  switch (config.provider) {
    case 'doubao':
    case 'volcengine':
      apiUrl = `${config.api_url || 'https://ark.cn-beijing.volces.com/api/v3'}/chat/completions`
      headers['Authorization'] = `Bearer ${config.api_key}`
      requestBody = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userMessage },
              ...images.map(img => ({
                type: 'image_url',
                image_url: { url: img }
              }))
            ]
          }
        ],
        max_tokens: 2000,
      }
      break

    case 'openai':
      apiUrl = `${config.api_url || 'https://api.openai.com/v1'}/chat/completions`
      headers['Authorization'] = `Bearer ${config.api_key}`
      requestBody = {
        model: config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userMessage },
              ...images.map(img => ({
                type: 'image_url',
                image_url: { url: img }
              }))
            ]
          }
        ],
        max_tokens: 2000,
      }
      break

    case 'deepseek':
      apiUrl = `${config.api_url || 'https://api.deepseek.com/v1'}/chat/completions`
      headers['Authorization'] = `Bearer ${config.api_key}`
      requestBody = {
        model: config.model || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userMessage },
              ...images.map(img => ({
                type: 'image_url',
                image_url: { url: img }
              }))
            ]
          }
        ],
        max_tokens: 2000,
      }
      break

    case 'qwen':
      apiUrl = `${config.api_url || 'https://dashscope.aliyuncs.com/compatible-mode/v1'}/chat/completions`
      headers['Authorization'] = `Bearer ${config.api_key}`
      requestBody = {
        model: config.model || 'qwen-vl-plus',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userMessage },
              ...images.map(img => ({
                type: 'image_url',
                image_url: { url: img }
              }))
            ]
          }
        ],
        max_tokens: 2000,
      }
      break

    case 'glm':
      apiUrl = `${config.api_url || 'https://open.bigmodel.cn/api/paas/v4'}/chat/completions`
      headers['Authorization'] = `Bearer ${config.api_key}`
      requestBody = {
        model: config.model || 'glm-4v-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userMessage },
              ...images.map(img => ({
                type: 'image_url',
                image_url: { url: img }
              }))
            ]
          }
        ],
        max_tokens: 2000,
      }
      break

    case 'gemini':
      apiUrl = `${config.api_url || 'https://generativelanguage.googleapis.com/v1beta'}/models/${config.model || 'gemini-2.0-flash'}:generateContent?key=${config.api_key}`
      requestBody = {
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { text: userMessage },
              ...images.map(img => {
                const match = img.match(/^data:([^;]+);base64,(.+)$/)
                if (match) {
                  return {
                    inlineData: {
                      mimeType: match[1],
                      data: match[2]
                    }
                  }
                }
                return { text: img }
              })
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 2000,
        }
      }
      break

    default:
      if (!config.api_url) {
        throw new Error('未知提供商且未配置 API URL')
      }
      apiUrl = `${config.api_url}/chat/completions`
      headers['Authorization'] = `Bearer ${config.api_key}`
      requestBody = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userMessage },
              ...images.map(img => ({
                type: 'image_url',
                image_url: { url: img }
              }))
            ]
          }
        ],
        max_tokens: 2000,
      }
  }

  return { apiUrl, requestBody, headers }
}

// 解析 AI 响应
function parseAIResponse(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim())
      } catch {}
    }

    const objectMatch = text.match(/\{[\s\S]*\}/)
    const arrayMatch = text.match(/\[[\s\S]*\]/)

    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0])
      } catch {}
    }

    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0])
      } catch {}
    }

    return {}
  }
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 初始化 Supabase 客户端
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 使用 service role key 以绕过 RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)

    // 解析请求
    const body = await req.json()
    const { images, type, userId }: RecognizeRequest = body

    console.log('[AI] 收到请求:', { type, userId, imageCount: images?.length })

    if (!images || images.length === 0) {
      return new Response(
        JSON.stringify({ error: '请上传图片' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: '缺少用户ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 获取用户 AI 配置
    const config = await getActiveAIConfig(supabase, userId)
    if (!config) {
      return new Response(
        JSON.stringify({ error: '请先在系统设置中配置 AI 模型' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[AI] 使用 ${config.provider} 提供商进行识别`)

    // 构建 AI 请求
    const { apiUrl, requestBody, headers } = buildAIRequest(config, images, type)

    console.log(`[AI] 调用 API: ${apiUrl}`)

    // 调用 AI API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[AI] API 错误:', response.status, errorText)
      return new Response(
        JSON.stringify({ error: `AI API 错误: ${response.status} - ${errorText.substring(0, 200)}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()

    // 解析响应
    let result: any = {}
    if (config.provider === 'gemini') {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      result = parseAIResponse(text)
    } else {
      const text = data.choices?.[0]?.message?.content || ''
      result = parseAIResponse(text)
    }

    console.log('[AI] 识别结果:', JSON.stringify(result).substring(0, 500))

    return new Response(
      JSON.stringify({ result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('[AI] 识别失败:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'AI 识别失败' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
