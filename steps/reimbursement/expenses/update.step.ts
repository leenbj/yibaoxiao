/**
 * 更新费用记录 API
 * 
 * PUT /api/expenses/:id
 * 更新指定的费用记录
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { ExpenseItemSchema, ExpenseStatusSchema, ErrorResponseSchema } from '../types'
import { expenseRepository } from '../../../src/db/repositories'

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
    500: ErrorResponseSchema,
  },
}

export const handler: Handlers['UpdateExpense'] = async (req, { logger }) => {
  const expenseId = req.pathParams.id
  const data = bodySchema.parse(req.body)
  const { userId, ...updateData } = data

  logger.info('更新费用记录', { expenseId, userId })

  // 获取现有记录
  const existing = await expenseRepository.getById(userId, expenseId)
  
  if (!existing) {
    logger.warn('费用记录不存在', { expenseId, userId })
    return {
      status: 404,
      body: { error: '记录不存在', message: '未找到指定的费用记录' },
    }
  }

  // 更新记录
  const updated = await expenseRepository.update(userId, expenseId, updateData)

  if (!updated) {
    return {
      status: 500,
      body: { error: '更新失败', message: '更新费用记录失败' },
    }
  }

  logger.info('费用记录更新成功', { expenseId, userId })

  return {
    status: 200,
    body: {
      success: true,
      expense: updated,
    },
  }
}
