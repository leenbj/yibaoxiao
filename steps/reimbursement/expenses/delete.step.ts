/**
 * 删除费用记录 API
 * 
 * DELETE /api/expenses/:id
 * 删除指定的费用记录
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { ExpenseItem, STATE_GROUPS, ErrorResponseSchema, SuccessResponseSchema } from '../types'

// 查询参数
const queryParams = [
  { name: 'userId', description: '用户ID' },
]

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'DeleteExpense',
  description: '删除费用记录',
  path: '/api/expenses/:id',
  method: 'DELETE',
  flows: ['reimbursement-expenses'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  queryParams,
  responseSchema: {
    200: SuccessResponseSchema,
    400: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
}

export const handler: Handlers['DeleteExpense'] = async (req, { state, logger }) => {
  const expenseId = req.pathParams.id
  const userId = req.queryParams.userId as string

  if (!userId) {
    return {
      status: 400,
      body: { error: '参数错误', message: '缺少 userId 参数' },
    }
  }

  logger.info('删除费用记录', { expenseId, userId })

  // 检查记录是否存在
  const existing = await state.get<ExpenseItem>(`${STATE_GROUPS.EXPENSES}_${userId}`, expenseId)
  
  if (!existing) {
    logger.warn('费用记录不存在', { expenseId, userId })
    return {
      status: 404,
      body: { error: '记录不存在', message: '未找到指定的费用记录' },
    }
  }

  // 删除记录
  await state.delete(`${STATE_GROUPS.EXPENSES}_${userId}`, expenseId)

  logger.info('费用记录删除成功', { expenseId, userId })

  return {
    status: 200,
    body: {
      success: true,
      message: '费用记录已删除',
    },
  }
}










