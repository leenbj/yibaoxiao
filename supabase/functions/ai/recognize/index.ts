import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  createSupabaseClient,
  createServiceRoleClient,
  handleOptions,
  jsonResponse,
  requireAuth,
} from '../../_shared/supabase.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions()
  }

  try {
    const supabase = createSupabaseClient(req)
    const userId = await requireAuth(supabase)

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    const body = await req.json()
    const { image, type } = body

    const { data: activeConfig } = await supabase
      .from('ai_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (!activeConfig) {
      const mockResult = {
        success: true,
        recognition: {
          type: type || 'invoice',
          amount: '100.00',
          date: new Date().toISOString().split('T')[0],
          description: '模拟识别结果 - 请配置 AI API Key',
          items: [
            { name: '项目1', amount: '50.00' },
            { name: '项目2', amount: '50.00' },
          ],
        },
      }
      return jsonResponse(mockResult)
    }

    const response = await fetch(activeConfig.api_url || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeConfig.api_key}`,
      },
      body: JSON.stringify({
        model: activeConfig.model || 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '请识别这张发票或审批单图片，提取以下信息并以 JSON 格式返回：金额(amount)、日期(date)、描述(description)、项目列表(items)。JSON 格式：{"amount": "100.00", "date": "2024-01-01", "description": "描述", "items": [{"name": "项目名", "amount": "金额"}]}',
              },
              {
                type: 'image_url',
                image_url: { url: image },
              },
            ],
          },
        ],
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      return jsonResponse({ error: 'AI recognition failed' }, 400)
    }

    const aiResult = await response.json()
    const content = aiResult.choices?.[0]?.message?.content || ''

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    let recognition = {}
    
    if (jsonMatch) {
      try {
        recognition = JSON.parse(jsonMatch[0])
      } catch {
        recognition = { rawContent: content }
      }
    }

    const adminClient = createServiceRoleClient()
    await adminClient.from('token_usage').insert({
      id: `tu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      provider: activeConfig.provider,
      model: activeConfig.model || 'unknown',
      input_tokens: aiResult.usage?.prompt_tokens || 0,
      output_tokens: aiResult.usage?.completion_tokens || 0,
      total_tokens: aiResult.usage?.total_tokens || 0,
      input_cost: '0',
      output_cost: '0',
      total_cost: '0',
      operation: 'recognize',
    })

    return jsonResponse({
      success: true,
      recognition,
      type: type || 'invoice',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : 400
    return jsonResponse({ error: message }, status)
  }
})
