/**
 * 创建报销单 API
 * 
 * POST /api/reports
 * 创建新的报销单
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { 
  Report,
  ReportSchema, 
  ReportStatusSchema,
  ExpenseItemSchema,
  AttachmentSchema,
  BudgetProjectSchema,
  PaymentAccountSchema,
  AppUserSchema,
  TripLegSchema,
  TaxiDetailSchema,
  ErrorResponseSchema 
} from '../types'
import { reportRepository, expenseRepository } from '../../../src/db/repositories'

// 请求体 Schema
const bodySchema = z.object({
  userId: z.string(),
  title: z.string().min(1, '标题不能为空'),
  status: ReportStatusSchema.default('draft'),
  totalAmount: z.number(),
  prepaidAmount: z.number().default(0),
  payableAmount: z.number(),
  items: z.array(ExpenseItemSchema).default([]),
  approvalNumber: z.string().optional(),
  budgetProject: BudgetProjectSchema.optional(),
  paymentAccount: PaymentAccountSchema.optional(),
  attachments: z.array(AttachmentSchema).default([]),
  userSnapshot: AppUserSchema,
  invoiceCount: z.number().optional(),
  // 差旅相关
  isTravel: z.boolean().optional(),
  tripReason: z.string().optional(),
  tripLegs: z.array(TripLegSchema).optional(),
  taxiDetails: z.array(TaxiDetailSchema).optional(),
  // AI 识别数据
  aiRecognitionData: z.any().optional(),
})

// 响应 Schema
const responseSchema = z.object({
  success: z.boolean(),
  report: ReportSchema,
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'CreateReport',
  description: '创建报销单',
  path: '/api/reports',
  method: 'POST',
  flows: ['reimbursement-reports'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  bodySchema,
  responseSchema: {
    201: responseSchema,
    400: ErrorResponseSchema,
  },
}

export const handler: Handlers['CreateReport'] = async (req, { logger }) => {
  const data = bodySchema.parse(req.body)
  const { userId, ...reportData } = data
  
  logger.info('创建报销单', { userId, title: data.title, amount: data.totalAmount })

  // 生成唯一 ID
  const reportId = `rpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date().toISOString()

  // 创建报销单
  const report: Report = {
    id: reportId,
    userId,
    ...reportData,
    createdDate: now,
    createdAt: now,
    updatedAt: now,
  }

  // 存储到数据库
  await reportRepository.create(report)

  // 如果有关联的费用项，更新它们的状态
  if (report.items && report.items.length > 0) {
    const itemIds = report.items.map(item => item.id)
    const newStatus = report.status === 'draft' ? 'pending' : 'processing'
    await expenseRepository.updateStatus(userId, itemIds, newStatus)
  }

  logger.info('报销单创建成功', { reportId, userId })

  return {
    status: 201,
    body: {
      success: true,
      report,
    },
  }
}
