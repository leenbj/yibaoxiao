/**
 * 获取费用列表 API
 * 
 * GET /api/expenses
 * 获取用户的所有费用记录（记账本）
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { ExpenseItem, ExpenseItemSchema, STATE_GROUPS, ErrorResponseSchema } from '../types'

// 查询参数
const queryParams = [
  { name: 'userId', description: '用户ID' },
  { name: 'status', description: '状态筛选：pending/processing/done' },
]

// 响应 Schema
const responseSchema = z.object({
  expenses: z.array(ExpenseItemSchema),
  total: z.number(),
  summary: z.object({
    totalAmount: z.number(),
    pendingAmount: z.number(),
    processingAmount: z.number(),
    doneAmount: z.number(),
  }),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ListExpenses',
  description: '获取费用列表',
  path: '/api/expenses',
  method: 'GET',
  flows: ['reimbursement-expenses'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  queryParams,
  responseSchema: {
    200: responseSchema,
    400: ErrorResponseSchema,
  },
}

export const handler: Handlers['ListExpenses'] = async (req, { state, logger }) => {
  const userId = req.queryParams.userId as string
  const statusFilter = req.queryParams.status as string | undefined

  if (!userId) {
    return {
      status: 400,
      body: { error: '参数错误', message: '缺少 userId 参数' },
    }
  }

  logger.info('获取费用列表', { userId, statusFilter })

  // 获取用户的所有费用记录
  const allExpenses = await state.getGroup<ExpenseItem>(`${STATE_GROUPS.EXPENSES}_${userId}`)

  // 按状态筛选
  let expenses = allExpenses
  if (statusFilter && ['pending', 'processing', 'done'].includes(statusFilter)) {
    expenses = allExpenses.filter(e => e.status === statusFilter)
  }

  // 按日期倒序排列
  expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // 计算汇总
  const summary = {
    totalAmount: allExpenses.reduce((sum, e) => sum + e.amount, 0),
    pendingAmount: allExpenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0),
    processingAmount: allExpenses.filter(e => e.status === 'processing').reduce((sum, e) => sum + e.amount, 0),
    doneAmount: allExpenses.filter(e => e.status === 'done').reduce((sum, e) => sum + e.amount, 0),
  }

  logger.info('费用列表获取成功', { userId, count: expenses.length })

  return {
    status: 200,
    body: {
      expenses,
      total: expenses.length,
      summary,
    },
  }
}










