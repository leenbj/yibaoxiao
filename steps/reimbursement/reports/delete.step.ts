/**
 * 删除报销单 API
 * DELETE /api/reports/:id
 */

import { ApiRouteConfig, Handlers, StepResponse } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { STATE_GROUPS, ErrorResponseSchema } from '../types'

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

export const handler: Handlers['ReportsDelete'] = async (req, { state, logger }) => {
  const reportId = req.pathParams.id
  
  logger.info('ReportsDelete 开始处理', { id: reportId })

  // 获取用户ID（从请求头获取 token 或 query params）
  const authHeader = req.headers.authorization
  let userId = req.queryParams.userId as string || 'default_user'
  
  if (!userId && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    // 简单解析 token 获取用户ID
    const parts = token.split('_')
    if (parts.length >= 3) {
      userId = `${parts[0]}_${parts[1]}`
    }
  }

  // 获取当前报销单列表
  const reportsKey = `${STATE_GROUPS.REPORTS}_${userId}`
  const reports = await state.get<any[]>(reportsKey) || []
  
  // 查找要删除的报销单
  const reportIndex = reports.findIndex(r => r.id === reportId)
  
  if (reportIndex === -1) {
    return {
      status: 404,
      body: { success: false, message: '报销单不存在' },
    }
  }

  // 删除报销单
  reports.splice(reportIndex, 1)
  await state.set(reportsKey, reports)

  logger.info('ReportsDelete 删除成功', { id: reportId })

  return {
    status: 200,
    body: { success: true, message: '删除成功' },
  }
}
