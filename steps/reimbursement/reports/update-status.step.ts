/**
 * 更新报销单状态 API
 * 
 * PATCH /api/reports/:id/status
 * 更新报销单的状态（草稿 -> 已提交 -> 已打款）
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { Report, ReportSchema, ReportStatusSchema, STATE_GROUPS, ErrorResponseSchema } from '../types'

// 请求体 Schema
const bodySchema = z.object({
  userId: z.string(),
  status: ReportStatusSchema,
})

// 响应 Schema
const responseSchema = z.object({
  success: z.boolean(),
  report: ReportSchema,
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'UpdateReportStatus',
  description: '更新报销单状态',
  path: '/api/reports/:id/status',
  method: 'PATCH',
  flows: ['reimbursement-reports'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  bodySchema,
  responseSchema: {
    200: responseSchema,
    400: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
}

export const handler: Handlers['UpdateReportStatus'] = async (req, { state, logger }) => {
  const reportId = req.pathParams.id
  const { userId, status } = bodySchema.parse(req.body)

  logger.info('更新报销单状态', { reportId, userId, newStatus: status })

  // 获取现有报销单
  const existing = await state.get<Report>(`${STATE_GROUPS.REPORTS}_${userId}`, reportId)
  
  if (!existing) {
    logger.warn('报销单不存在', { reportId, userId })
    return {
      status: 404,
      body: { error: '报销单不存在', message: '未找到指定的报销单' },
    }
  }

  const now = new Date().toISOString()
  const oldStatus = existing.status

  // 更新报销单状态
  const updated: Report = {
    ...existing,
    status,
    updatedAt: now,
  }

  await state.set(`${STATE_GROUPS.REPORTS}_${userId}`, reportId, updated)

  // 如果状态变为 paid，更新关联费用项的状态
  if (status === 'paid' && existing.items && existing.items.length > 0) {
    for (const item of existing.items) {
      const expense = await state.get<any>(`${STATE_GROUPS.EXPENSES}_${userId}`, item.id)
      if (expense) {
        await state.set(`${STATE_GROUPS.EXPENSES}_${userId}`, item.id, {
          ...expense,
          status: 'done',
          updatedAt: now,
        })
      }
    }
  }

  logger.info('报销单状态更新成功', { reportId, userId, oldStatus, newStatus: status })

  return {
    status: 200,
    body: {
      success: true,
      report: updated,
    },
  }
}










