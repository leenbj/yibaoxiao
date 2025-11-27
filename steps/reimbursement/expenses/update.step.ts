/**
 * 更新费用记录 API
 * 
 * PUT /api/expenses/:id
 * 更新指定的费用记录
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { ExpenseItem, ExpenseItemSchema, ExpenseStatusSchema, STATE_GROUPS, ErrorResponseSchema } from '../types'

// 请求体 Schema
const bodySchema = z.object({
  userId: z.string(),
  amount: z.number().positive('金额必须大于0').optional(),
  description: z.string().optional(),
  date: z.string().optional(),
  category: z.string().optional(),
  remarks: z.string().optional(),
  status: ExpenseStatusSchema.optional(),
})

// 响应 Schema
const responseSchema = z.object({
  success: z.boolean(),
  expense: ExpenseItemSchema,
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'UpdateExpense',
  description: '更新费用记录',
  path: '/api/expenses/:id',
  method: 'PUT',
  flows: ['reimbursement-expenses'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  bodySchema,
  responseSchema: {
    200: responseSchema,
    400: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
}

export const handler: Handlers['UpdateExpense'] = async (req, { state, logger }) => {
  const expenseId = req.pathParams.id
  const data = bodySchema.parse(req.body)
  const { userId, ...updateData } = data

  logger.info('更新费用记录', { expenseId, userId })

  // 获取现有记录
  const existing = await state.get<ExpenseItem>(`${STATE_GROUPS.EXPENSES}_${userId}`, expenseId)
  
  if (!existing) {
    logger.warn('费用记录不存在', { expenseId, userId })
    return {
      status: 404,
      body: { error: '记录不存在', message: '未找到指定的费用记录' },
    }
  }

  // 更新记录
  const updated: ExpenseItem = {
    ...existing,
    ...updateData,
    updatedAt: new Date().toISOString(),
  }

  await state.set(`${STATE_GROUPS.EXPENSES}_${userId}`, expenseId, updated)

  logger.info('费用记录更新成功', { expenseId, userId })

  return {
    status: 200,
    body: {
      success: true,
      expense: updated,
    },
  }
}









