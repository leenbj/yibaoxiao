/**
 * 更新报销单状态 API
 * 
 * PATCH /api/reports/:id/status
 * 更新报销单的状态（草稿 -> 已提交 -> 已打款）
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { ReportSchema, ReportStatusSchema, ErrorResponseSchema } from '../types'
import { reportRepository, expenseRepository } from '../../../src/db/repositories'

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
    500: ErrorResponseSchema,
  },
}

export const handler: Handlers['UpdateReportStatus'] = async (req, { logger }) => {
  const reportId = req.pathParams.id
  const { userId, status } = bodySchema.parse(req.body)

  logger.info('更新报销单状态', { reportId, userId, newStatus: status })

  // 获取现有报销单
  const existing = await reportRepository.getById(userId, reportId)
  
  if (!existing) {
    logger.warn('报销单不存在', { reportId, userId })
    return {
      status: 404,
      body: { error: '报销单不存在', message: '未找到指定的报销单' },
    }
  }

  const oldStatus = existing.status

  // 更新报销单状态
  const updated = await reportRepository.updateStatus(userId, reportId, status)

  if (!updated) {
    return {
      status: 500,
      body: { error: '更新失败', message: '更新报销单状态失败' },
    }
  }

  // 如果状态变为 paid，更新关联费用项的状态
  if (status === 'paid' && existing.items && existing.items.length > 0) {
    const itemIds = existing.items.map(item => item.id)
    await expenseRepository.updateStatus(userId, itemIds, 'done')
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
