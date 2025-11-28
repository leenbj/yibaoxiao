/**
 * 记录 Token 使用 API
 * 
 * POST /api/settings/token-stats/record
 * 记录一次 AI 调用的 token 使用情况
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../../middlewares/error-handler.middleware'
import { 
  STATE_GROUPS, 
  ErrorResponseSchema,
  TokenUsage,
} from '../../types'
import { MODEL_PRICING, calculateTokenCost } from '../../../../src/config/model-pricing'

// 请求体 Schema
const bodySchema = z.object({
  userId: z.string(),
  provider: z.string(),
  model: z.string().optional(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  cached: z.boolean().optional().default(false),
  operation: z.string().optional(), // 操作类型
})

// 响应 Schema
const responseSchema = z.object({
  success: z.boolean(),
  usage: z.object({
    id: z.string(),
    totalTokens: z.number(),
    totalCost: z.number(),
    providerName: z.string(),
  }),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'RecordTokenUsage',
  description: '记录 Token 使用',
  path: '/api/settings/token-stats/record',
  method: 'POST',
  flows: ['reimbursement-settings'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  bodySchema,
  responseSchema: {
    201: responseSchema,
    400: ErrorResponseSchema,
  },
}

export const handler: Handlers['RecordTokenUsage'] = async (req, { state, logger }) => {
  const { userId, provider, model, inputTokens, outputTokens, cached, operation } = bodySchema.parse(req.body)
  
  logger.info('记录 Token 使用', { userId, provider, inputTokens, outputTokens })

  const pricing = MODEL_PRICING[provider]
  const totalTokens = inputTokens + outputTokens
  
  // 计算费用
  const inputPrice = cached && pricing?.cachedInputPrice 
    ? pricing.cachedInputPrice 
    : (pricing?.inputPrice || 0)
  const outputPrice = pricing?.outputPrice || 0

  const inputCost = (inputTokens / 1_000_000) * inputPrice
  const outputCost = (outputTokens / 1_000_000) * outputPrice
  const totalCost = inputCost + outputCost

  // 创建使用记录
  const usageId = `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const usage: TokenUsage = {
    id: usageId,
    userId,
    provider,
    model: model || pricing?.model || provider,
    inputTokens,
    outputTokens,
    totalTokens,
    inputCost: Number(inputCost.toFixed(6)),
    outputCost: Number(outputCost.toFixed(6)),
    totalCost: Number(totalCost.toFixed(6)),
    cached,
    operation,
    createdAt: new Date().toISOString(),
  }

  // 保存到 state
  await state.set(STATE_GROUPS.TOKEN_USAGE, usageId, usage)

  logger.info('Token 使用记录已保存', { 
    usageId, 
    totalTokens, 
    totalCost: usage.totalCost,
    isFree: pricing?.isFree || false,
  })

  return {
    status: 201,
    body: {
      success: true,
      usage: {
        id: usageId,
        totalTokens,
        totalCost: usage.totalCost,
        providerName: pricing?.providerName || provider,
      },
    },
  }
}









