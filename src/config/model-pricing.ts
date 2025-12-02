/**
 * AI 模型定价配置
 * 
 * 价格单位：人民币元/百万tokens
 * 数据来源：各厂商官网 (2025年11月最新)
 * 
 * 注：Gemini 为免费模型，价格设为 0
 */

export interface ModelPricing {
  /** 模型厂商 */
  provider: string
  /** 厂商名称 */
  providerName: string
  /** 模型名称 */
  model: string
  /** 输入价格 (元/百万tokens) */
  inputPrice: number
  /** 输出价格 (元/百万tokens) */
  outputPrice: number
  /** 缓存命中输入价格 (元/百万tokens)，如无则为 null */
  cachedInputPrice?: number
  /** 是否免费 */
  isFree: boolean
  /** 备注 */
  note?: string
}

/**
 * 各模型定价表 (2025年11月最新)
 * 
 * 数据来源：
 * - 火山引擎: https://www.volcengine.com/docs/82379/1544106
 * - DeepSeek: https://api-docs.deepseek.com/zh-cn/quick_start/pricing
 * - OpenAI: https://platform.openai.com/docs/pricing
 * - 智谱GLM: https://open.bigmodel.cn/pricing
 * - 通义千问: https://help.aliyun.com/zh/model-studio/model-pricing
 * - Anthropic: https://www.anthropic.com/pricing
 * - Moonshot: https://platform.moonshot.cn/docs/price
 * - MiniMax: https://www.minimaxi.com/pricing
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // ==================== Google Gemini (免费) ====================
  'gemini': {
    provider: 'gemini',
    providerName: 'Google Gemini',
    model: 'gemini-2.5-flash',
    inputPrice: 0,
    outputPrice: 0,
    isFree: true,
    note: '免费模型，无需付费',
  },

  // ==================== 火山引擎 豆包 ====================
  'doubao': {
    provider: 'doubao',
    providerName: '火山引擎 (豆包)',
    model: 'doubao-seed-1.6-vision',
    inputPrice: 0.8, // 0.8元/百万tokens (32K以内特惠)
    outputPrice: 2,  // 2元/百万tokens
    cachedInputPrice: 0.4,
    isFree: false,
    note: '32K以内输入特惠价',
  },
  'volcengine': {
    provider: 'volcengine',
    providerName: '火山引擎',
    model: 'doubao-seed-1.6-vision',
    inputPrice: 0.8,
    outputPrice: 2,
    cachedInputPrice: 0.4,
    isFree: false,
    note: '同豆包定价',
  },

  // ==================== DeepSeek ====================
  'deepseek': {
    provider: 'deepseek',
    providerName: 'DeepSeek',
    model: 'deepseek-chat',
    inputPrice: 2,    // 2元/百万tokens (缓存未命中)
    outputPrice: 3,   // 3元/百万tokens
    cachedInputPrice: 0.2, // 0.2元/百万tokens (缓存命中)
    isFree: false,
    note: 'V3.2版本，缓存命中0.2元/百万tokens',
  },

  // ==================== OpenAI ====================
  'openai': {
    provider: 'openai',
    providerName: 'OpenAI',
    model: 'gpt-4o',
    inputPrice: 36,   // $5/百万tokens ≈ 36元 (汇率7.2)
    outputPrice: 108, // $15/百万tokens ≈ 108元
    cachedInputPrice: 18, // $2.5/百万tokens ≈ 18元
    isFree: false,
    note: 'USD价格按汇率7.2换算',
  },

  // ==================== Anthropic Claude ====================
  'claude': {
    provider: 'claude',
    providerName: 'Anthropic Claude',
    model: 'claude-3-5-sonnet',
    inputPrice: 21.6,  // $3/百万tokens ≈ 21.6元
    outputPrice: 108,  // $15/百万tokens ≈ 108元
    isFree: false,
    note: 'USD价格按汇率7.2换算',
  },

  // ==================== 智谱 GLM ====================
  'glm': {
    provider: 'glm',
    providerName: '智谱 GLM',
    model: 'glm-4v-plus',
    inputPrice: 10,   // 10元/百万tokens
    outputPrice: 10,  // 输入输出同价
    isFree: false,
    note: 'GLM-4V-Plus视觉模型',
  },

  // ==================== 通义千问 ====================
  'qwen': {
    provider: 'qwen',
    providerName: '通义千问',
    model: 'qwen-vl-max',
    inputPrice: 3,    // 0.003元/千tokens = 3元/百万tokens
    outputPrice: 9,   // 0.009元/千tokens = 9元/百万tokens
    isFree: false,
    note: '视觉理解模型',
  },

  // ==================== MiniMax ====================
  'minimax': {
    provider: 'minimax',
    providerName: 'MiniMax',
    model: 'abab6.5s-chat',
    inputPrice: 1,    // 1元/百万tokens
    outputPrice: 1,   // 1元/百万tokens
    isFree: false,
    note: 'ABAB系列模型',
  },

  // ==================== Moonshot (月之暗面) ====================
  'moonshot': {
    provider: 'moonshot',
    providerName: 'Moonshot (月之暗面)',
    model: 'moonshot-v1-128k',
    inputPrice: 60,   // 60元/百万tokens
    outputPrice: 60,  // 60元/百万tokens
    isFree: false,
    note: '128K长上下文模型',
  },
}

/**
 * 获取模型定价
 */
export function getModelPricing(provider: string): ModelPricing | null {
  return MODEL_PRICING[provider] || null
}

/**
 * 计算 token 费用
 * @param provider 模型厂商
 * @param inputTokens 输入 tokens 数
 * @param outputTokens 输出 tokens 数
 * @param cached 是否缓存命中
 * @returns 费用（元）
 */
export function calculateTokenCost(
  provider: string,
  inputTokens: number,
  outputTokens: number,
  cached: boolean = false
): number {
  const pricing = getModelPricing(provider)
  if (!pricing || pricing.isFree) return 0

  const inputPrice = cached && pricing.cachedInputPrice 
    ? pricing.cachedInputPrice 
    : pricing.inputPrice
  
  // 价格单位：元/百万tokens，转换为实际费用
  const inputCost = (inputTokens / 1_000_000) * inputPrice
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPrice

  return Number((inputCost + outputCost).toFixed(6))
}

/**
 * 格式化金额显示
 */
export function formatCurrency(amount: number): string {
  if (amount === 0) return '¥0.00 (免费)'
  if (amount < 0.01) return `¥${amount.toFixed(6)}`
  if (amount < 1) return `¥${amount.toFixed(4)}`
  return `¥${amount.toFixed(2)}`
}

/**
 * 格式化 tokens 数量
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`
  }
  return tokens.toString()
}















