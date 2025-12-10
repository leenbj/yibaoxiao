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
    413: ErrorResponseSchema, // 请求体过大
  },
}

export const handler: Handlers['CreateReport'] = async (req, { logger }) => {
  // 先对请求体做规范化处理，避免缺少 userId/状态导致校验失败
  const rawBody: any = req.body || {}
  const fallbackUserId = rawBody.userId || process.env.ADMIN_USER_ID || 'default_user'

  // 限制请求体体积，避免超大 base64 附件拖垮进程
  const estimatedSize = Buffer.byteLength(JSON.stringify(rawBody || {}))
  if (estimatedSize > 8 * 1024 * 1024) {
    logger.warn('创建报销单请求过大，已拒绝', { estimatedSize })
    return {
      status: 413,
      body: { error: 'payload_too_large', message: '附件过大，请压缩后再试' },
    }
  }

  const normalizedItems = Array.isArray(rawBody.items)
    ? rawBody.items.map((item: any, idx: number) => ({
        ...item,
        id: item?.id || `expense_${Date.now()}_${idx}`,
        userId: item?.userId || fallbackUserId,
        status: item?.status || 'pending',
        category: item?.category || '其他',
        date: item?.date || new Date().toISOString().split('T')[0],
      }))
    : []

  const normalizedAttachments = Array.isArray(rawBody.attachments)
    ? rawBody.attachments.map((att: any, idx: number) => ({
        ...att,
        name: att?.name || `附件${idx + 1}`,
        data: typeof att?.data === 'string' ? att.data : '',
      }))
    : []

  const normalizedBody = {
    ...rawBody,
    userId: fallbackUserId,
    items: normalizedItems,
    attachments: normalizedAttachments,
    invoiceCount: rawBody.invoiceCount ?? normalizedAttachments.filter((a: any) => a?.type === 'invoice').length,
  }

  const data = bodySchema.parse(normalizedBody)
  const { userId, ...reportData } = data

  logger.info('创建报销单', { 
    userId, 
    title: data.title, 
    amount: data.totalAmount,
    itemCount: data.items.length,
    attachmentCount: data.attachments.length,
  })

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

  try {
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
  } catch (error: any) {
    logger.error('创建报销单失败', { error: error?.message, stack: error?.stack })
    return {
      status: 500,
      body: { error: 'internal_error', message: '保存报销单失败，请稍后重试' },
    }
  }
}
