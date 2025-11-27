/**
 * 删除 AI 配置 API
 * 
 * DELETE /api/settings/ai-config/:id
 * 删除指定的 AI 模型配置
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../../middlewares/error-handler.middleware'
import { AIConfig, STATE_GROUPS, ErrorResponseSchema, SuccessResponseSchema } from '../../types'

// 查询参数
const queryParams = [
  { name: 'userId', description: '用户ID' },
]

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'DeleteAIConfig',
  description: '删除 AI 配置',
  path: '/api/settings/ai-config/:id',
  method: 'DELETE',
  flows: ['reimbursement-settings'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  queryParams,
  responseSchema: {
    200: SuccessResponseSchema,
    400: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
}

export const handler: Handlers['DeleteAIConfig'] = async (req, { state, logger }) => {
  const configId = req.pathParams.id
  const userId = req.queryParams.userId as string

  if (!userId) {
    return {
      status: 400,
      body: { error: '参数错误', message: '缺少 userId 参数' },
    }
  }

  logger.info('删除 AI 配置', { configId, userId })

  // 检查是否存在
  const existing = await state.get<AIConfig>(`${STATE_GROUPS.AI_CONFIGS}_${userId}`, configId)
  
  if (!existing) {
    logger.warn('AI 配置不存在', { configId, userId })
    return {
      status: 404,
      body: { error: '配置不存在', message: '未找到指定的 AI 配置' },
    }
  }

  // 删除配置
  await state.delete(`${STATE_GROUPS.AI_CONFIGS}_${userId}`, configId)

  logger.info('AI 配置删除成功', { configId, userId })

  return {
    status: 200,
    body: {
      success: true,
      message: 'AI 配置已删除',
    },
  }
}









