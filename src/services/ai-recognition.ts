/**
 * AI 识别服务 - 多模型支持版
 * 
 * 支持的模型厂商：
 * - Google Gemini
 * - DeepSeek
 * - MiniMax
 * - 智谱 GLM
 * - OpenAI
 * - Anthropic Claude
 * - 阿里通义千问
 */

/**
 * AI 配置类型
 */
export interface AIConfig {
  provider: string
  apiKey: string
  apiUrl?: string
  model?: string
}

/**
 * Token 使用信息
 */
export interface TokenUsageInfo {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  provider: string
  model: string
}

/**
 * AI 识别结果类型
 */
export interface AIRecognitionResult {
  // Token 使用信息（可选）
  _tokenUsage?: TokenUsageInfo
  
  // 通用字段
  title?: string
  approvalNumber?: string
  loanAmount?: number
  
  // 发票详细信息
  invoiceCode?: string
  invoiceNumber?: string
  invoiceDate?: string
  sellerName?: string
  buyerName?: string
  projectName?: string
  totalAmount?: number
  taxAmount?: number
  amountWithoutTax?: number
  remarks?: string
  
  // 审批单详细信息
  approvalTitle?: string
  applicant?: string
  department?: string
  applyDate?: string
  eventSummary?: string
  eventDetail?: string
  expenseAmount?: number
  approvalStatus?: string
  approvers?: string[]
  budgetProject?: string
  budgetCode?: string
  
  // 费用明细项
  items?: Array<{
    name?: string
    specification?: string
    unit?: string
    quantity?: number
    unitPrice?: number
    amount: number
    // 兼容旧格式
    date?: string
    description?: string
  }>
  
  // 差旅信息
  tripReason?: string
  tripLegs?: Array<{
    dateRange: string
    route: string
    transportType?: string
    transportFee: number
    hotelName?: string
    hotelLocation: string
    hotelDays: number
    hotelFee: number
    cityTrafficFee: number
    mealFee: number
    otherFee: number
    subTotal: number
  }>
}

// 默认模型配置
const DEFAULT_CONFIGS: Record<string, { url: string; model: string }> = {
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-flash',
  },
  deepseek: {
    url: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  minimax: {
    url: 'https://api.minimax.chat/v1',
    model: 'abab6.5s-chat',
  },
  glm: {
    url: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4v-plus',
  },
  openai: {
    url: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  },
  claude: {
    url: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-sonnet-20241022',
  },
  qwen: {
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-vl-max',
  },
  moonshot: {
    url: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-128k',
  },
  // 火山引擎 - 豆包大模型
  doubao: {
    url: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-seed-1.6-vision',
  },
  volcengine: {
    url: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-seed-1.6-vision',
  },
}

/**
 * 使用指定配置进行文档识别
 */
export async function recognizeWithConfig(
  images: string[],
  type: 'invoice' | 'approval' | 'travel' | 'ticket' | 'hotel' | 'taxi',
  config: AIConfig | null
): Promise<AIRecognitionResult> {
  // 如果没有配置，返回模拟数据
  if (!config || !config.apiKey) {
    console.log('[AI] 未配置 AI，使用模拟数据')
    return getMockResult(type)
  }

  const { provider, apiKey } = config
  const apiUrl = config.apiUrl || DEFAULT_CONFIGS[provider]?.url
  const model = config.model || DEFAULT_CONFIGS[provider]?.model

  if (!apiUrl || !model) {
    console.log('[AI] 不支持的模型厂商:', provider)
    return getMockResult(type)
  }

  const prompt = getPromptForType(type)

  try {
    let result: AIRecognitionResult
    
    console.log('[AI] 开始调用 AI 服务', { provider, model, imageCount: images.length })
    
    switch (provider) {
      case 'gemini':
        result = await recognizeWithGemini(images, prompt, apiKey, apiUrl, model)
        console.log('[AI] Gemini 返回结果:', JSON.stringify(result).substring(0, 800))
        break
      case 'deepseek':
      case 'minimax':
      case 'openai':
      case 'qwen':
      case 'moonshot':
      case 'doubao':      // 火山引擎豆包 - 兼容 OpenAI SDK
      case 'volcengine':  // 火山引擎别名
        result = await recognizeWithOpenAICompatible(images, prompt, apiKey, apiUrl, model)
        console.log('[AI] OpenAI Compatible 返回结果:', JSON.stringify(result).substring(0, 800))
        break
      case 'glm':
        result = await recognizeWithGLM(images, prompt, apiKey, apiUrl, model)
        break
      case 'claude':
        result = await recognizeWithClaude(images, prompt, apiKey, apiUrl, model)
        break
      default:
        console.log('[AI] 不支持的模型厂商:', provider)
        return getMockResult(type)
    }
    
    // 填充 provider 信息
    if (result._tokenUsage) {
      result._tokenUsage.provider = provider
      result._tokenUsage.model = model
    }
    
    return result
  } catch (error) {
    console.error('[AI] 识别失败:', error)
    return getMockResult(type)
  }
}

/**
 * 使用 Gemini 识别
 * 支持自定义代理 URL
 */
async function recognizeWithGemini(
  images: string[],
  prompt: string,
  apiKey: string,
  apiUrl: string,
  model: string
): Promise<AIRecognitionResult> {
  const parts: any[] = []

  // 添加图片
  for (const image of images) {
    const base64Data = image.includes(',') ? image.split(',')[1] : image
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Data,
      },
    })
  }

  // 添加提示词
  parts.push({ text: prompt })

  // 构建请求 URL，支持代理
  // 默认: https://generativelanguage.googleapis.com/v1beta
  // 代理示例: https://lobegoogle.vercel.app/api/proxy/google
  const baseUrl = apiUrl || 'https://generativelanguage.googleapis.com/v1beta'
  const requestUrl = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`
  
  console.log('[AI] Gemini 请求 URL:', requestUrl.replace(apiKey, '***'))

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[AI] Gemini API 错误:', response.status, errorText)
    throw new Error(`Gemini API 错误: ${response.status}`)
  }

  const result = await response.json()
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text

  if (text) {
    console.log('[AI] Gemini 原始响应文本长度:', text.length)
    console.log('[AI] Gemini 原始响应文本前500字符:', text.substring(0, 500))
    try {
      // 尝试直接解析
      const parsed = JSON.parse(text)
      // 如果是数组（如打车明细），包装成对象
      if (Array.isArray(parsed)) {
        console.log('[AI] Gemini 解析成功（数组格式），记录数:', parsed.length)
        return { details: parsed }
      }
      console.log('[AI] Gemini 解析成功，关键字段:', {
        projectName: parsed.projectName,
        totalAmount: parsed.totalAmount,
        invoiceDate: parsed.invoiceDate,
        title: parsed.title,
        itemsCount: parsed.items?.length || 0
      })
      return parsed
    } catch (parseError) {
      console.log('[AI] 直接解析失败，尝试提取 JSON:', parseError)
      // 尝试提取 JSON 数组或对象
      const arrayMatch = text.match(/\[[\s\S]*\]/)
      const objectMatch = text.match(/\{[\s\S]*\}/)
      
      // 优先尝试数组格式（打车明细等）
      if (arrayMatch) {
        try {
          const parsed = JSON.parse(arrayMatch[0])
          console.log('[AI] Gemini JSON 数组提取成功，记录数:', parsed.length)
          return { details: parsed }
        } catch (e) {
          console.log('[AI] 数组解析失败，尝试对象格式')
        }
      }
      
      if (objectMatch) {
        try {
          const parsed = JSON.parse(objectMatch[0])
          console.log('[AI] Gemini JSON 对象提取成功，关键字段:', {
            projectName: parsed.projectName,
            totalAmount: parsed.totalAmount,
            invoiceDate: parsed.invoiceDate,
            title: parsed.title,
            itemsCount: parsed.items?.length || 0
          })
          return parsed
        } catch (e) {
          console.error('[AI] Gemini 响应解析失败:', text.substring(0, 500))
        }
      }
    }
  } else {
    console.error('[AI] Gemini 响应无文本内容，完整响应:', JSON.stringify(result).substring(0, 500))
  }

  console.log('[AI] 返回模拟数据')
  return getMockResult('invoice')
}

/**
 * 使用 OpenAI 兼容 API 识别（DeepSeek、MiniMax、OpenAI、通义千问）
 */
async function recognizeWithOpenAICompatible(
  images: string[],
  prompt: string,
  apiKey: string,
  apiUrl: string,
  model: string
): Promise<AIRecognitionResult> {
  // 构建消息内容
  const content: any[] = []

  // 添加图片
  for (const image of images) {
    // 确保 Base64 图片包含正确的 data URL 前缀
    let base64Data: string
    if (image.startsWith('data:')) {
      // 已经包含 data URL 前缀
      base64Data = image
    } else if (image.includes(',')) {
      // 可能是不完整的 data URL，尝试修复
      const parts = image.split(',')
      if (parts[0].startsWith('data:')) {
        base64Data = image
      } else {
        // 添加默认前缀
        base64Data = `data:image/jpeg;base64,${parts[parts.length - 1]}`
      }
    } else {
      // 纯 Base64 数据，添加前缀
      base64Data = `data:image/jpeg;base64,${image}`
    }
    
    console.log('[AI] 图片数据前缀:', base64Data.substring(0, 50) + '...')
    
    content.push({
      type: 'image_url',
      image_url: { url: base64Data },
    })
  }

  // 添加文本
  content.push({ type: 'text', text: prompt })

  // 构建请求体
  const requestBody: any = {
    model,
    messages: [{ role: 'user', content }],
  }
  
  // 只有部分模型支持 response_format 参数
  // Doubao/火山引擎可能不支持，所以只对 OpenAI 和 DeepSeek 添加
  // 通过检查 apiUrl 来判断是否是 Doubao
  const isDoubao = apiUrl.includes('volces.com') || apiUrl.includes('volcengine')
  if (!isDoubao) {
    requestBody.response_format = { type: 'json_object' }
  }
  
  console.log('[AI] OpenAI Compatible API 请求:', {
    url: `${apiUrl}/chat/completions`,
    model,
    isDoubao,
    imageCount: images.length,
  })

  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[AI] OpenAI Compatible API 错误详情:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText.substring(0, 500),
      url: `${apiUrl}/chat/completions`,
      model,
    })
    throw new Error(`API 错误: ${response.status} - ${errorText.substring(0, 200)}`)
  }

  const result = await response.json()
  console.log('[AI] OpenAI Compatible API 成功响应, choices 数量:', result.choices?.length || 0)
  const text = result.choices?.[0]?.message?.content
  console.log('[AI] OpenAI Compatible 提取的文本内容长度:', text?.length || 0, '前200字符:', text ? text.substring(0, 200) : '(无)')

  // 提取 token 使用信息
  const usage = result.usage
  const tokenUsage: TokenUsageInfo | undefined = usage ? {
    inputTokens: usage.prompt_tokens || usage.input_tokens || 0,
    outputTokens: usage.completion_tokens || usage.output_tokens || 0,
    totalTokens: usage.total_tokens || 0,
    provider: '', // 在调用处填充
    model,
  } : undefined
  
  console.log('[AI] Token 使用:', tokenUsage)

  if (text) {
    try {
      const parsed = JSON.parse(text)
      console.log('[AI] JSON 解析成功, 类型:', Array.isArray(parsed) ? '数组' : typeof parsed)
      // 如果是数组（如打车明细），包装成对象
      if (Array.isArray(parsed)) {
        console.log('[AI] OpenAI Compatible 解析成功（数组格式），记录数:', parsed.length)
        const result = { details: parsed } as any
        if (tokenUsage) {
          result._tokenUsage = tokenUsage
        }
        return result
      }
      if (tokenUsage) {
        parsed._tokenUsage = tokenUsage
      }
      return parsed
    } catch {
      // 尝试提取 JSON 数组或对象
      console.log('[AI] OpenAI Compatible 直接解析失败，尝试提取 JSON')
      const arrayMatch = text.match(/\[[\s\S]*\]/)
      const objectMatch = text.match(/\{[\s\S]*\}/)
      
      if (arrayMatch) {
        try {
          const parsed = JSON.parse(arrayMatch[0])
          console.log('[AI] OpenAI Compatible JSON 数组提取成功，记录数:', parsed.length)
          const result = { details: parsed } as any
          if (tokenUsage) {
            result._tokenUsage = tokenUsage
          }
          return result
        } catch (e) {
          console.log('[AI] 数组解析失败')
        }
      }
      
      if (objectMatch) {
        try {
          const parsed = JSON.parse(objectMatch[0])
          if (tokenUsage) {
            parsed._tokenUsage = tokenUsage
          }
          return parsed
        } catch (e) {
          console.error('[AI] OpenAI 兼容 API 响应解析失败:', text)
        }
      }
    }
  }

  return getMockResult('invoice')
}

/**
 * 使用智谱 GLM 识别
 */
async function recognizeWithGLM(
  images: string[],
  prompt: string,
  apiKey: string,
  apiUrl: string,
  model: string
): Promise<AIRecognitionResult> {
  // GLM 的图片格式
  const content: any[] = []

  for (const image of images) {
    const base64Data = image.includes(',') ? image.split(',')[1] : image
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${base64Data}` },
    })
  }

  content.push({ type: 'text', text: prompt })

  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!response.ok) {
    throw new Error(`GLM API 错误: ${response.status}`)
  }

  const result = await response.json()
  const text = result.choices?.[0]?.message?.content

  // 提取 token 使用信息
  const usage = result.usage
  const tokenUsage: TokenUsageInfo | undefined = usage ? {
    inputTokens: usage.prompt_tokens || usage.input_tokens || 0,
    outputTokens: usage.completion_tokens || usage.output_tokens || 0,
    totalTokens: usage.total_tokens || 0,
    provider: 'glm',
    model,
  } : undefined

  if (text) {
    try {
      // 先尝试直接解析
      const directParsed = JSON.parse(text)
      if (Array.isArray(directParsed)) {
        console.log('[AI] GLM 解析成功（数组格式），记录数:', directParsed.length)
        const result = { details: directParsed } as any
        if (tokenUsage) {
          result._tokenUsage = tokenUsage
        }
        return result
      }
      if (tokenUsage) {
        directParsed._tokenUsage = tokenUsage
      }
      return directParsed
    } catch {
      // GLM 可能在 JSON 外有其他文本，尝试提取
      const arrayMatch = text.match(/\[[\s\S]*\]/)
      const objectMatch = text.match(/\{[\s\S]*\}/)
      
      if (arrayMatch) {
        try {
          const parsed = JSON.parse(arrayMatch[0])
          console.log('[AI] GLM JSON 数组提取成功，记录数:', parsed.length)
          const result = { details: parsed } as any
          if (tokenUsage) {
            result._tokenUsage = tokenUsage
          }
          return result
        } catch (e) {
          console.log('[AI] GLM 数组解析失败')
        }
      }
      
      if (objectMatch) {
        try {
          const parsed = JSON.parse(objectMatch[0])
          if (tokenUsage) {
            parsed._tokenUsage = tokenUsage
          }
          return parsed
        } catch {
          console.error('[AI] GLM 响应解析失败:', text)
        }
      }
    }
  }

  return getMockResult('invoice')
}

/**
 * 使用 Claude 识别
 */
async function recognizeWithClaude(
  images: string[],
  prompt: string,
  apiKey: string,
  apiUrl: string,
  model: string
): Promise<AIRecognitionResult> {
  const content: any[] = []

  // 添加图片
  for (const image of images) {
    const base64Data = image.includes(',') ? image.split(',')[1] : image
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: base64Data,
      },
    })
  }

  // 添加文本
  content.push({ type: 'text', text: prompt })

  const response = await fetch(`${apiUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API 错误: ${response.status}`)
  }

  const result = await response.json()
  const text = result.content?.[0]?.text

  if (text) {
    try {
      // 先尝试直接解析
      const directParsed = JSON.parse(text)
      if (Array.isArray(directParsed)) {
        console.log('[AI] Claude 解析成功（数组格式），记录数:', directParsed.length)
        return { details: directParsed }
      }
      return directParsed
    } catch {
      // 尝试提取 JSON 数组或对象
      const arrayMatch = text.match(/\[[\s\S]*\]/)
      const objectMatch = text.match(/\{[\s\S]*\}/)
      
      if (arrayMatch) {
        try {
          const parsed = JSON.parse(arrayMatch[0])
          console.log('[AI] Claude JSON 数组提取成功，记录数:', parsed.length)
          return { details: parsed }
        } catch (e) {
          console.log('[AI] Claude 数组解析失败')
        }
      }
      
      if (objectMatch) {
        try {
          return JSON.parse(objectMatch[0])
        } catch {
          console.error('[AI] Claude 响应解析失败:', text)
        }
      }
    }
  }

  return getMockResult('invoice')
}

/**
 * 兼容旧接口：使用环境变量配置
 */
export async function recognizeDocuments(
  images: string[],
  type: 'invoice' | 'approval' | 'travel'
): Promise<AIRecognitionResult> {
  // 检查环境变量中的配置
  const geminiKey = process.env.GEMINI_API_KEY
  
  if (geminiKey) {
    return recognizeWithConfig(images, type, {
      provider: 'gemini',
      apiKey: geminiKey,
    })
  }

  return getMockResult(type)
}

/**
 * 根据类型获取识别提示词
 */
function getPromptForType(type: 'invoice' | 'approval' | 'travel' | 'ticket' | 'hotel' | 'taxi'): string {
  if (type === 'invoice') {
    return `
请仔细分析这些电子发票/收据图片，完整提取以下信息并返回JSON格式：
{
  "invoiceCode": "发票代码",
  "invoiceNumber": "发票号码",
  "invoiceDate": "开票日期，格式YYYY-MM-DD",
  "sellerName": "销售方/开票单位名称",
  "buyerName": "购买方名称",
  "projectName": "发票上的货物或应税劳务名称（如：餐饮服务、住宿服务、办公用品等）",
  "totalAmount": 价税合计金额（数字）,
  "taxAmount": 税额（数字）,
  "amountWithoutTax": 不含税金额（数字）,
  "items": [
    {
      "name": "商品或服务名称",
      "specification": "规格型号",
      "unit": "单位",
      "quantity": 数量,
      "unitPrice": 单价,
      "amount": 金额
    }
  ],
  "remarks": "备注信息"
}

注意：
- 日期格式必须是 YYYY-MM-DD
- 所有金额必须是数字，不要包含货币符号和千分位
- 如果有多个商品明细，请全部列出
- projectName 要提取发票上最主要的货物或服务名称，如"餐饮服务"、"住宿费"等
- 如果无法识别某字段，返回空字符串或0
`
  }

  if (type === 'approval') {
    return `
请仔细分析这些钉钉/飞书审批单图片，完整提取以下信息并返回JSON格式：
{
  "approvalNumber": "审批单号/流程编号（如：DD-2024-XXXXXX）",
  "approvalTitle": "审批标题",
  "applicant": "申请人姓名",
  "department": "申请人部门",
  "applyDate": "申请日期，格式YYYY-MM-DD",
  "eventSummary": "活动/事项简要描述（最多15字，如：中文域名应用论坛活动）",
  "eventDetail": "活动/事项详细说明",
  "loanAmount": 借款/预支金额（数字，如无则为0）,
  "expenseAmount": 费用/报销金额（数字，如无则为0）,
  "approvalStatus": "审批状态（已通过/审批中/已拒绝）",
  "approvers": ["审批人1", "审批人2"],
  "budgetProject": "预算项目名称（如有）",
  "budgetCode": "预算编码（如有）"
}

注意：
- 金额必须是数字，不要包含货币符号
- eventSummary 要简洁概括活动事项，不超过15个字
- 仔细查找审批单号，通常在页面顶部或底部
- 如果无法识别某字段，返回空字符串或0
`
  }

  if (type === 'travel') {
    return `
请仔细分析这些差旅报销相关图片（机票、火车票、酒店发票、出租车票等），完整提取以下信息并返回JSON格式：
{
  "tripReason": "出差事由",
  "approvalNumber": "关联审批单号（如有）",
  "tripLegs": [
    {
      "dateRange": "YYYY.MM.DD-YYYY.MM.DD",
      "route": "出发地-目的地",
      "transportType": "交通方式（飞机/火车/汽车）",
      "transportFee": 交通费数字,
      "hotelName": "酒店名称",
      "hotelLocation": "住宿城市",
      "hotelDays": 住宿天数,
      "hotelFee": 住宿费数字,
      "cityTrafficFee": 市内交通费数字,
      "mealFee": 餐费数字,
      "otherFee": 其他费用数字,
      "subTotal": 小计数字
    }
  ],
  "totalAmount": 总金额
}

注意：
- 所有金额必须是数字，不要包含货币符号
- 如果有多个行程段，请全部列出
- 仔细识别每张票据上的金额和日期
- 如果无法识别某字段，返回空字符串或0
`
  }

  // 火车票/机票识别
  if (type === 'ticket') {
    return `
请仔细分析这些火车票/机票图片，提取以下信息并返回JSON格式。如果有多张票，返回数组格式：
[
  {
    "ticketType": "火车票/飞机票",
    "ticketNumber": "票号/订单号",
    "departure": "出发地（精简为城市名）",
    "destination": "目的地（精简为城市名）",
    "departureDate": "出发日期，格式YYYY-MM-DD",
    "departureTime": "出发时间，格式HH:MM",
    "arrivalDate": "到达日期，格式YYYY-MM-DD",
    "arrivalTime": "到达时间，格式HH:MM",
    "dateRange": "日期范围，格式YYYY.MM.DD-YYYY.MM.DD",
    "passengerName": "乘客姓名",
    "seatClass": "座位等级（如：二等座、经济舱）",
    "seatNumber": "座位号",
    "trainNumber": "车次/航班号",
    "amount": 票价金额（数字）,
    "price": 票价金额（数字，与amount相同）
  }
]

注意：
- 如果只有一张票，也要返回数组格式
- 所有金额必须是数字，不要包含货币符号
- departure和destination要精简为城市名，如"北京"、"上海"
- dateRange格式为出发日期-到达日期
- 如果无法识别某字段，返回空字符串或0
`
  }

  // 住宿发票识别
  if (type === 'hotel') {
    return `
请仔细分析这些住宿/酒店发票图片，提取以下信息并返回JSON格式。如果有多张发票，返回数组格式：
[
  {
    "hotelName": "酒店名称",
    "city": "所在城市",
    "location": "详细地址",
    "checkInDate": "入住日期，格式YYYY-MM-DD",
    "checkOutDate": "离店日期，格式YYYY-MM-DD",
    "days": 住宿天数（数字）,
    "nights": 住宿晚数（数字）,
    "roomType": "房型",
    "guestName": "住客姓名",
    "invoiceNumber": "发票号码",
    "invoiceDate": "开票日期，格式YYYY-MM-DD",
    "amount": 总金额（数字）,
    "totalAmount": 总金额（数字，与amount相同）,
    "dailyRate": 每日房价（数字）
  }
]

注意：
- 如果只有一张发票，也要返回数组格式
- 所有金额必须是数字，不要包含货币符号
- days/nights计算方式：离店日期-入住日期
- 如果无法识别某字段，返回空字符串或0
`
  }

  // 打车发票/行程单识别
  if (type === 'taxi') {
    return `
请仔细分析这些打车发票/行程单图片，提取以下信息并返回JSON格式。如果有多条记录，返回数组格式：
[
  {
    "date": "乘车日期，格式YYYYMMDD或YYYY-MM-DD",
    "invoiceDate": "发票日期，格式YYYY-MM-DD",
    "startPoint": "上车地点（精简，如：酒店、机场、火车站）",
    "endPoint": "下车地点（精简，如：公司、会展中心）",
    "route": "起终点（格式：起点-终点，如：酒店-机场）",
    "amount": 金额（数字）,
    "distance": "行程距离（如有）",
    "waitTime": "等待时间（如有）",
    "invoiceNumber": "发票号码（如有）",
    "carNumber": "车牌号（如有）",
    "platform": "平台名称（如：滴滴、高德、出租车）"
  }
]

注意：
- 如果只有一条记录，也要返回数组格式
- 所有金额必须是数字，不要包含货币符号
- startPoint和endPoint要精简，去掉详细地址，只保留关键地点名称
- route格式为"起点-终点"
- 如果无法识别某字段，返回空字符串或0
- 日期格式可以是YYYYMMDD或YYYY-MM-DD
`
  }

  return '请识别图片内容并返回JSON格式。'
}

/**
 * 获取模拟识别结果
 */
function getMockResult(type: 'invoice' | 'approval' | 'travel' | 'ticket' | 'hotel' | 'taxi'): AIRecognitionResult {
  const now = new Date().toISOString().split('T')[0]

  if (type === 'invoice') {
    return {
      // 发票基础信息
      invoiceCode: '011001900111',
      invoiceNumber: '12345678',
      invoiceDate: now,
      sellerName: '北京某餐饮有限公司',
      buyerName: '北龙中网(北京)科技有限责任公司',
      projectName: '餐饮服务',
      totalAmount: 1500.00,
      taxAmount: 84.91,
      amountWithoutTax: 1415.09,
      // 兼容旧格式
      title: '餐饮服务',
      approvalNumber: '',
      loanAmount: 0,
      items: [
        { 
          name: '餐饮服务', 
          specification: '', 
          unit: '次', 
          quantity: 1, 
          unitPrice: 1415.09, 
          amount: 1415.09,
          // 兼容旧格式
          date: now,
          description: '餐饮服务',
        },
      ],
      remarks: '',
    }
  }

  if (type === 'approval') {
    const randomId = Math.random().toString().substr(2, 6)
    return {
      // 审批单详细信息
      approvalNumber: `DD-2024-${randomId}`,
      approvalTitle: '费用报销申请',
      applicant: '王波',
      department: '市场部',
      applyDate: now,
      eventSummary: '中文域名应用论坛活动',
      eventDetail: '2024年中文域名应用论坛活动场地及用餐费用',
      loanAmount: 1500,
      expenseAmount: 1500,
      approvalStatus: '已通过',
      approvers: ['张经理', '李总监'],
      budgetProject: '嘉年华--人力部',
      budgetCode: '2024321',
      // 兼容旧格式
      title: '费用报销申请',
      items: [],
    }
  }

  if (type === 'travel') {
    return {
      title: '差旅费报销',
      tripReason: '北京出差-客户拜访',
      approvalNumber: '',
      tripLegs: [
        {
          dateRange: '2024.12.20-2024.12.22',
          route: '上海-北京',
          transportType: '飞机',
          transportFee: 1200,
          hotelName: '北京国际酒店',
          hotelLocation: '北京市朝阳区',
          hotelDays: 2,
          hotelFee: 800,
          cityTrafficFee: 150,
          mealFee: 200,
          otherFee: 0,
          subTotal: 2350,
        },
      ],
      totalAmount: 2350,
    }
  }

  // 火车票/机票模拟数据
  if (type === 'ticket') {
    return {
      tickets: [
        {
          ticketType: '火车票',
          ticketNumber: 'G1234',
          departure: '北京',
          destination: '上海',
          departureDate: now,
          departureTime: '08:00',
          arrivalDate: now,
          arrivalTime: '12:30',
          dateRange: `${now.replace(/-/g, '.')}-${now.replace(/-/g, '.')}`,
          passengerName: '王波',
          seatClass: '二等座',
          trainNumber: 'G1234',
          amount: 553,
          price: 553,
        }
      ],
    } as any
  }

  // 住宿发票模拟数据
  if (type === 'hotel') {
    return {
      hotels: [
        {
          hotelName: '北京国际酒店',
          city: '北京',
          location: '北京市朝阳区建国路88号',
          checkInDate: now,
          checkOutDate: now,
          days: 2,
          nights: 2,
          roomType: '标准间',
          guestName: '王波',
          invoiceNumber: 'HT12345678',
          invoiceDate: now,
          amount: 800,
          totalAmount: 800,
          dailyRate: 400,
        }
      ],
    } as any
  }

  // 打车发票模拟数据
  if (type === 'taxi') {
    return {
      details: [
        {
          date: now.replace(/-/g, ''),
          invoiceDate: now,
          startPoint: '酒店',
          endPoint: '机场',
          route: '酒店-机场',
          amount: 148.42,
          platform: '滴滴',
        },
        {
          date: now.replace(/-/g, ''),
          invoiceDate: now,
          startPoint: '机场',
          endPoint: '会展中心',
          route: '机场-会展中心',
          amount: 56.00,
          platform: '出租车',
        }
      ],
    } as any
  }

  return {
    title: '未识别内容',
    items: [],
  }
}

export default {
  recognizeDocuments,
  recognizeWithConfig,
}
