/**
 * 更新借款状态 API
 * 
 * PATCH /api/loans/:id/status
 * 更新借款记录的状态
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { LoanRecordSchema, ReportStatusSchema, ErrorResponseSchema } from '../types'
import { loanRepository } from '../../../src/db/repositories'

// 请求体 Schema
const bodySchema = z.object({
  userId: z.string(),
  status: ReportStatusSchema,
})

// 响应 Schema
const responseSchema = z.object({
  success: z.boolean(),
  loan: LoanRecordSchema,
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'UpdateLoanStatus',
  description: '更新借款状态',
  path: '/api/loans/:id/status',
  method: 'PATCH',
  flows: ['reimbursement-loans'],
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

export const handler: Handlers['UpdateLoanStatus'] = async (req, { logger }) => {
  const loanId = req.pathParams.id
  const { userId, status } = bodySchema.parse(req.body)

  logger.info('更新借款状态', { loanId, userId, newStatus: status })

  // 获取现有借款记录
  const existing = await loanRepository.getById(userId, loanId)
  
  if (!existing) {
    logger.warn('借款记录不存在', { loanId, userId })
    return {
      status: 404,
      body: { error: '借款记录不存在', message: '未找到指定的借款记录' },
    }
  }

  const oldStatus = existing.status

  // 更新借款状态
  const updated = await loanRepository.updateStatus(userId, loanId, status)

  if (!updated) {
    return {
      status: 500,
      body: { error: '更新失败', message: '更新借款状态失败' },
    }
  }

  logger.info('借款状态更新成功', { loanId, userId, oldStatus, newStatus: status })

  return {
    status: 200,
    body: {
      success: true,
      loan: updated,
    },
  }
}
