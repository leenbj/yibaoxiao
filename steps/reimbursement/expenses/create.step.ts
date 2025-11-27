/**
 * 创建费用记录 API
 * 
 * POST /api/expenses
 * 添加新的费用记录到记账本
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { ExpenseItemSchema, STATE_GROUPS, ErrorResponseSchema } from '../types'

// 请求体 Schema
const bodySchema = z.object({
  userId: z.string(),
  amount: z.number().positive('金额必须大于0'),
  description: z.string().min(1, '描述不能为空'),
  date: z.string(), // ISO String
  category: z.string().min(1, '分类不能为空'),
  remarks: z.string().optional(),
})

// 响应 Schema
const responseSchema = z.object({
  success: z.boolean(),
  expense: ExpenseItemSchema,
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'CreateExpense',
  description: '创建费用记录',
  path: '/api/expenses',
  method: 'POST',
  flows: ['reimbursement-expenses'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  bodySchema,
  responseSchema: {
    201: responseSchema,
    400: ErrorResponseSchema,
  },
}

export const handler: Handlers['CreateExpense'] = async (req, { state, logger }) => {
  const data = bodySchema.parse(req.body)
  
  logger.info('创建费用记录', { userId: data.userId, amount: data.amount })

  // 生成唯一 ID
  const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date().toISOString()

  // 创建费用记录
  const expense = {
    id: expenseId,
    userId: data.userId,
    amount: data.amount,
    description: data.description,
    date: data.date,
    category: data.category,
    remarks: data.remarks || '',
    status: 'pending' as const,
    createdAt: now,
    updatedAt: now,
  }

  // 存储到 State
  await state.set(`${STATE_GROUPS.EXPENSES}_${data.userId}`, expenseId, expense)

  logger.info('费用记录创建成功', { expenseId, userId: data.userId })

  return {
    status: 201,
    body: {
      success: true,
      expense,
    },
  }
}









