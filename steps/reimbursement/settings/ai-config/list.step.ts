/**
 * 获取 AI 配置列表 API
 * 
 * GET /api/settings/ai-config
 * 获取用户的所有 AI 模型配置
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../../middlewares/error-handler.middleware'
import { 
  AIConfig, 
  AIConfigSchema, 
  AI_PROVIDERS_INFO,
  STATE_GROUPS, 
  ErrorResponseSchema 
} from '../../types'

// 查询参数
const queryParams = [
  { name: 'userId', description: '用户ID' },
]

// 简化的响应 Schema - 避免复杂的 z.record
const responseSchema = z.object({
  configs: z.array(AIConfigSchema),
  total: z.number(),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ListAIConfigs',
  description: '获取 AI 配置列表',
  path: '/api/settings/ai-config',
  method: 'GET',
  flows: ['reimbursement-settings'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  queryParams,
  responseSchema: {
    200: responseSchema,
    400: ErrorResponseSchema,
  },
}

export const handler: Handlers['ListAIConfigs'] = async (req, { state, logger }) => {
  const userId = req.queryParams.userId as string

  if (!userId) {
    return {
      status: 400,
      body: { error: '参数错误', message: '缺少 userId 参数' },
    }
  }

  logger.info('获取 AI 配置列表', { userId })

  // 获取用户的 AI 配置
  const configs = await state.getGroup<AIConfig>(`${STATE_GROUPS.AI_CONFIGS}_${userId}`)

  logger.info('AI 配置列表获取成功', { userId, count: configs.length })

  return {
    status: 200,
    body: {
      configs: configs || [],
      total: configs.length,
    },
  }
}
