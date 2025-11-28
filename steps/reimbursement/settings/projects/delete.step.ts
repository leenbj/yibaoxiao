/**
 * 删除预算项目 API
 * 
 * DELETE /api/settings/projects/:id
 * 删除指定的预算项目
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../../middlewares/error-handler.middleware'
import { ErrorResponseSchema, SuccessResponseSchema } from '../../types'
import { budgetProjectRepository } from '../../../../src/db/repositories'

// 查询参数
const queryParams = [
  { name: 'userId', description: '用户ID' },
]

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'DeleteProject',
  description: '删除预算项目',
  path: '/api/settings/projects/:id',
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

export const handler: Handlers['DeleteProject'] = async (req, { logger }) => {
  const projectId = req.pathParams.id
  const userId = req.queryParams.userId as string

  if (!userId) {
    return {
      status: 400,
      body: { error: '参数错误', message: '缺少 userId 参数' },
    }
  }

  logger.info('删除预算项目', { projectId, userId })

  // 检查是否存在
  const existing = await budgetProjectRepository.getById(userId, projectId)
  
  if (!existing) {
    logger.warn('预算项目不存在', { projectId, userId })
    return {
      status: 404,
      body: { error: '预算项目不存在', message: '未找到指定的预算项目' },
    }
  }

  // 删除项目
  await budgetProjectRepository.delete(userId, projectId)

  logger.info('预算项目删除成功', { projectId, userId })

  return {
    status: 200,
    body: {
      success: true,
      message: '预算项目已删除',
    },
  }
}
