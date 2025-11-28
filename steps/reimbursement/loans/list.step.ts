/**
 * 获取借款列表 API
 * 
 * GET /api/loans
 * 获取用户的所有借款记录
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { LoanRecordSchema, ErrorResponseSchema } from '../types'
import { loanRepository } from '../../../src/db/repositories'

// 查询参数
const queryParams = [
  { name: 'userId', description: '用户ID' },
  { name: 'status', description: '状态筛选：draft/submitted/paid' },
]

// 响应 Schema
const responseSchema = z.object({
  loans: z.array(LoanRecordSchema),
  total: z.number(),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ListLoans',
  description: '获取借款列表',
  path: '/api/loans',
  method: 'GET',
  flows: ['reimbursement-loans'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  queryParams,
  responseSchema: {
    200: responseSchema,
    400: ErrorResponseSchema,
  },
}

export const handler: Handlers['ListLoans'] = async (req, { logger }) => {
  const userId = req.queryParams.userId as string
  const statusFilter = req.queryParams.status as string | undefined

  if (!userId) {
    return {
      status: 400,
      body: { error: '参数错误', message: '缺少 userId 参数' },
    }
  }

  logger.info('获取借款列表', { userId, statusFilter })

  // 获取用户的所有借款记录
  let loans = await loanRepository.list(userId)

  // 按状态筛选
  if (statusFilter && ['draft', 'submitted', 'paid'].includes(statusFilter)) {
    loans = loans.filter(l => l.status === statusFilter)
  }

  // 按日期倒序排列
  loans.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  logger.info('借款列表获取成功', { userId, count: loans.length })

  return {
    status: 200,
    body: {
      loans,
      total: loans.length,
    },
  }
}
