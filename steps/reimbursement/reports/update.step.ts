/**
 * 更新报销单 API
 * 
 * PUT /api/reports/:id
 * 更新指定的报销单
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
  TripLegSchema,
  TaxiDetailSchema,
  STATE_GROUPS, 
  ErrorResponseSchema 
} from '../types'

// 请求体 Schema
const bodySchema = z.object({
  userId: z.string(),
  title: z.string().optional(),
  status: ReportStatusSchema.optional(),
  totalAmount: z.number().optional(),
  prepaidAmount: z.number().optional(),
  payableAmount: z.number().optional(),
  items: z.array(ExpenseItemSchema).optional(),
  approvalNumber: z.string().optional(),
  budgetProject: BudgetProjectSchema.optional(),
  paymentAccount: PaymentAccountSchema.optional(),
  attachments: z.array(AttachmentSchema).optional(),
  invoiceCount: z.number().optional(),
  isTravel: z.boolean().optional(),
  tripReason: z.string().optional(),
  tripLegs: z.array(TripLegSchema).optional(),
  taxiDetails: z.array(TaxiDetailSchema).optional(),
})

// 响应 Schema
const responseSchema = z.object({
  success: z.boolean(),
  report: ReportSchema,
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'UpdateReport',
  description: '更新报销单',
  path: '/api/reports/:id',
  method: 'PUT',
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

export const handler: Handlers['UpdateReport'] = async (req, { state, logger }) => {
  const reportId = req.pathParams.id
  const data = bodySchema.parse(req.body)
  const { userId, ...updateData } = data

  logger.info('更新报销单', { reportId, userId })

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

  // 更新报销单
  const updated: Report = {
    ...existing,
    ...updateData,
    updatedAt: now,
  }

  await state.set(`${STATE_GROUPS.REPORTS}_${userId}`, reportId, updated)

  logger.info('报销单更新成功', { reportId, userId })

  return {
    status: 200,
    body: {
      success: true,
      report: updated,
    },
  }
}









