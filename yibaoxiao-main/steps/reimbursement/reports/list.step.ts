/**
 * 获取报销单列表 API
 * 
 * GET /api/reports
 * 获取用户的所有报销单
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { Report, ReportSchema, STATE_GROUPS, ErrorResponseSchema } from '../types'

// 查询参数
const queryParams = [
  { name: 'userId', description: '用户ID' },
  { name: 'status', description: '状态筛选：draft/submitted/paid' },
]

// 响应 Schema
const responseSchema = z.object({
  reports: z.array(ReportSchema),
  total: z.number(),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ListReports',
  description: '获取报销单列表',
  path: '/api/reports',
  method: 'GET',
  flows: ['reimbursement-reports'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  queryParams,
  responseSchema: {
    200: responseSchema,
    400: ErrorResponseSchema,
  },
}

export const handler: Handlers['ListReports'] = async (req, { state, logger }) => {
  const userId = req.queryParams.userId as string
  const statusFilter = req.queryParams.status as string | undefined

  if (!userId) {
    return {
      status: 400,
      body: { error: '参数错误', message: '缺少 userId 参数' },
    }
  }

  logger.info('获取报销单列表', { userId, statusFilter })

  // 获取用户的所有报销单
  const allReports = await state.getGroup<Report>(`${STATE_GROUPS.REPORTS}_${userId}`)

  // 按状态筛选
  let reports = allReports
  if (statusFilter && ['draft', 'submitted', 'paid'].includes(statusFilter)) {
    reports = allReports.filter(r => r.status === statusFilter)
  }

  // 按创建日期倒序排列
  reports.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())

  logger.info('报销单列表获取成功', { userId, count: reports.length })

  return {
    status: 200,
    body: {
      reports,
      total: reports.length,
    },
  }
}










