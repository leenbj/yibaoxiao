/**
 * 创建借款记录 API
 * 
 * POST /api/loans
 * 创建新的借款申请
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { 
  LoanRecord,
  LoanRecordSchema, 
  ReportStatusSchema,
  AttachmentSchema,
  BudgetProjectSchema,
  PaymentAccountSchema,
  AppUserSchema,
  ErrorResponseSchema 
} from '../types'
import { loanRepository } from '../../../src/db/repositories'

// 请求体 Schema
const bodySchema = z.object({
  userId: z.string(),
  amount: z.number().positive('金额必须大于0'),
  reason: z.string().max(20, '事由最多20字'),
  date: z.string(),
  status: ReportStatusSchema.default('draft'),
  approvalNumber: z.string().optional(),
  budgetProject: BudgetProjectSchema.optional(),
  attachments: z.array(AttachmentSchema).default([]),
  payeeInfo: PaymentAccountSchema,
  userSnapshot: AppUserSchema,
})

// 响应 Schema
const responseSchema = z.object({
  success: z.boolean(),
  loan: LoanRecordSchema,
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'CreateLoan',
  description: '创建借款申请',
  path: '/api/loans',
  method: 'POST',
  flows: ['reimbursement-loans'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  bodySchema,
  responseSchema: {
    201: responseSchema,
    400: ErrorResponseSchema,
  },
}

export const handler: Handlers['CreateLoan'] = async (req, { logger }) => {
  const data = bodySchema.parse(req.body)
  const { userId, ...loanData } = data
  
  logger.info('创建借款申请', { userId, amount: data.amount })

  // 生成唯一 ID
  const loanId = `loan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date().toISOString()

  // 创建借款记录
  const loan: LoanRecord = {
    id: loanId,
    userId,
    ...loanData,
    paymentMethod: 'transfer',
    createdAt: now,
    updatedAt: now,
  }

  // 存储到数据库
  await loanRepository.create(loan)

  logger.info('借款申请创建成功', { loanId, userId })

  return {
    status: 201,
    body: {
      success: true,
      loan,
    },
  }
}
