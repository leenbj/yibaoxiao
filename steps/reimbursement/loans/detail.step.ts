/**
 * 获取借款详情 API
 * 
 * GET /api/loans/:id
 * 获取指定借款记录的详细信息
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { LoanRecordSchema, ErrorResponseSchema } from '../types'
import { loanRepository } from '../../../src/db/repositories'

// 查询参数
const queryParams = [
  { name: 'userId', description: '用户ID' },
]

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'GetLoanDetail',
  description: '获取借款详情',
  path: '/api/loans/:id',
  method: 'GET',
  flows: ['reimbursement-loans'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  queryParams,
  responseSchema: {
    200: LoanRecordSchema,
    400: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
}

export const handler: Handlers['GetLoanDetail'] = async (req, { logger }) => {
  const loanId = req.pathParams.id
  const userId = req.queryParams.userId as string

  if (!userId) {
    return {
      status: 400,
      body: { error: '参数错误', message: '缺少 userId 参数' },
    }
  }

  logger.info('获取借款详情', { loanId, userId })

  // 获取借款记录
  const loan = await loanRepository.getById(userId, loanId)
  
  if (!loan) {
    logger.warn('借款记录不存在', { loanId, userId })
    return {
      status: 404,
      body: { error: '借款记录不存在', message: '未找到指定的借款记录' },
    }
  }

  logger.info('借款详情获取成功', { loanId, userId })

  return {
    status: 200,
    body: loan,
  }
}
