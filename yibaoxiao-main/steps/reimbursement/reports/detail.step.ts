/**
 * 获取报销单详情 API
 * 
 * GET /api/reports/:id
 * 获取指定报销单的详细信息
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { Report, ReportSchema, STATE_GROUPS, ErrorResponseSchema } from '../types'

// 查询参数
const queryParams = [
  { name: 'userId', description: '用户ID' },
]

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'GetReportDetail',
  description: '获取报销单详情',
  path: '/api/reports/:id',
  method: 'GET',
  flows: ['reimbursement-reports'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  queryParams,
  responseSchema: {
    200: ReportSchema,
    400: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
}

export const handler: Handlers['GetReportDetail'] = async (req, { state, logger }) => {
  const reportId = req.pathParams.id
  const userId = req.queryParams.userId as string

  if (!userId) {
    return {
      status: 400,
      body: { error: '参数错误', message: '缺少 userId 参数' },
    }
  }

  logger.info('获取报销单详情', { reportId, userId })

  // 获取报销单
  const report = await state.get<Report>(`${STATE_GROUPS.REPORTS}_${userId}`, reportId)
  
  if (!report) {
    logger.warn('报销单不存在', { reportId, userId })
    return {
      status: 404,
      body: { error: '报销单不存在', message: '未找到指定的报销单' },
    }
  }

  logger.info('报销单详情获取成功', { reportId, userId })

  return {
    status: 200,
    body: report,
  }
}










