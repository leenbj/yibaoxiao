/**
 * 获取 Token 使用统计 API
 * 
 * GET /api/settings/token-stats
 * 获取用户的 token 使用统计数据
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../../middlewares/error-handler.middleware'
import { 
  STATE_GROUPS, 
  ErrorResponseSchema,
  TokenUsage,
} from '../../types'
import { MODEL_PRICING } from '../../../../src/config/model-pricing'

// 查询参数 Schema
const queryParamsSchema = z.object({
  userId: z.string(),
  startDate: z.string().optional(), // ISO 日期
  endDate: z.string().optional(),
  provider: z.string().optional(),
  period: z.enum(['day', 'week', 'month', 'year', 'all']).optional().default('month'),
})

// 响应 Schema
const responseSchema = z.object({
  // 总计
  summary: z.object({
    totalTokens: z.number(),
    totalCost: z.number(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    usageCount: z.number(),
  }),
  // 按厂商统计
  byProvider: z.array(z.object({
    provider: z.string(),
    providerName: z.string(),
    totalTokens: z.number(),
    totalCost: z.number(),
    usageCount: z.number(),
    isFree: z.boolean(),
  })),
  // 按日期统计
  byDate: z.array(z.object({
    date: z.string(),
    totalTokens: z.number(),
    totalCost: z.number(),
    usageCount: z.number(),
  })),
  // 最近使用记录
  recentUsages: z.array(z.object({
    id: z.string(),
    provider: z.string(),
    providerName: z.string(),
    model: z.string(),
    totalTokens: z.number(),
    totalCost: z.number(),
    operation: z.string().optional(),
    createdAt: z.string(),
  })),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'GetTokenStats',
  description: '获取 Token 使用统计',
  path: '/api/settings/token-stats',
  method: 'GET',
  flows: ['reimbursement-settings'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  queryParams: [
    { name: 'userId', description: '用户 ID' },
    { name: 'startDate', description: '开始日期 (可选)' },
    { name: 'endDate', description: '结束日期 (可选)' },
    { name: 'provider', description: '模型厂商 (可选)' },
    { name: 'period', description: '统计周期: day/week/month/year/all' },
  ],
  responseSchema: {
    200: responseSchema,
    400: ErrorResponseSchema,
  },
}

export const handler: Handlers['GetTokenStats'] = async (req, { state, logger }) => {
  const { userId, startDate, endDate, provider, period } = queryParamsSchema.parse(req.queryParams)
  
  logger.info('获取 Token 统计', { userId, period })

  // 获取所有使用记录
  const allUsages = await state.getGroup<TokenUsage>(STATE_GROUPS.TOKEN_USAGE)
  
  // 筛选当前用户的记录
  let usages = allUsages.filter(u => u.userId === userId)

  // 计算日期范围
  const now = new Date()
  let filterStartDate: Date | null = null
  let filterEndDate: Date | null = null

  if (startDate) {
    filterStartDate = new Date(startDate)
  } else {
    // 根据 period 计算起始日期
    switch (period) {
      case 'day':
        filterStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        filterStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        filterStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'year':
        filterStartDate = new Date(now.getFullYear(), 0, 1)
        break
      case 'all':
      default:
        filterStartDate = null
    }
  }

  if (endDate) {
    filterEndDate = new Date(endDate)
  }

  // 按日期筛选
  if (filterStartDate) {
    usages = usages.filter(u => new Date(u.createdAt) >= filterStartDate!)
  }
  if (filterEndDate) {
    usages = usages.filter(u => new Date(u.createdAt) <= filterEndDate!)
  }

  // 按厂商筛选
  if (provider) {
    usages = usages.filter(u => u.provider === provider)
  }

  // 计算总计
  const summary = {
    totalTokens: usages.reduce((sum, u) => sum + u.totalTokens, 0),
    totalCost: Number(usages.reduce((sum, u) => sum + u.totalCost, 0).toFixed(6)),
    inputTokens: usages.reduce((sum, u) => sum + u.inputTokens, 0),
    outputTokens: usages.reduce((sum, u) => sum + u.outputTokens, 0),
    usageCount: usages.length,
  }

  // 按厂商分组统计
  const providerMap = new Map<string, {
    provider: string
    providerName: string
    totalTokens: number
    totalCost: number
    usageCount: number
    isFree: boolean
  }>()

  for (const usage of usages) {
    const existing = providerMap.get(usage.provider)
    const pricing = MODEL_PRICING[usage.provider]
    
    if (existing) {
      existing.totalTokens += usage.totalTokens
      existing.totalCost += usage.totalCost
      existing.usageCount += 1
    } else {
      providerMap.set(usage.provider, {
        provider: usage.provider,
        providerName: pricing?.providerName || usage.provider,
        totalTokens: usage.totalTokens,
        totalCost: usage.totalCost,
        usageCount: 1,
        isFree: pricing?.isFree || false,
      })
    }
  }

  const byProvider = Array.from(providerMap.values())
    .sort((a, b) => b.totalCost - a.totalCost)

  // 按日期分组统计
  const dateMap = new Map<string, {
    date: string
    totalTokens: number
    totalCost: number
    usageCount: number
  }>()

  for (const usage of usages) {
    const date = usage.createdAt.split('T')[0] // 取日期部分
    const existing = dateMap.get(date)
    
    if (existing) {
      existing.totalTokens += usage.totalTokens
      existing.totalCost += usage.totalCost
      existing.usageCount += 1
    } else {
      dateMap.set(date, {
        date,
        totalTokens: usage.totalTokens,
        totalCost: usage.totalCost,
        usageCount: 1,
      })
    }
  }

  const byDate = Array.from(dateMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))

  // 最近使用记录 (最近20条)
  const recentUsages = usages
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20)
    .map(u => {
      const pricing = MODEL_PRICING[u.provider]
      return {
        id: u.id,
        provider: u.provider,
        providerName: pricing?.providerName || u.provider,
        model: u.model,
        totalTokens: u.totalTokens,
        totalCost: Number(u.totalCost.toFixed(6)),
        operation: u.operation,
        createdAt: u.createdAt,
      }
    })

  return {
    status: 200,
    body: {
      summary,
      byProvider,
      byDate,
      recentUsages,
    },
  }
}









