/**
 * 删除报销单 API
 * DELETE /api/reports/:id
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { ErrorResponseSchema } from '../types'
import { reportRepository } from '../../../src/db/repositories'

// 查询参数
const queryParams = [
  { name: 'userId', description: '用户ID' },
]

// 响应 schema
const DeleteResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ReportsDelete',
  description: '删除报销单',
  path: '/api/reports/:id',
  method: 'DELETE',
  flows: ['reimbursement-reports'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  queryParams,
  responseSchema: {
    200: DeleteResponseSchema,
    400: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
}

export const handler: Handlers['ReportsDelete'] = async (req, { logger }) => {
  const reportId = req.pathParams.id
  
  logger.info('ReportsDelete 开始处理', { id: reportId })

  // 获取用户ID
  const userId = req.queryParams.userId as string || 'default_user'

  if (!userId) {
    return {
      status: 400,
      body: { error: '参数错误', message: '缺少 userId 参数' },
    }
  }

  // 检查报销单是否存在
  const existing = await reportRepository.getById(userId, reportId)
  
  if (!existing) {
    return {
      status: 404,
      body: { error: '不存在', message: '报销单不存在' },
    }
  }

  // 删除报销单
  await reportRepository.delete(userId, reportId)

  logger.info('ReportsDelete 删除成功', { id: reportId })

  return {
    status: 200,
    body: { success: true, message: '删除成功' },
  }
}
