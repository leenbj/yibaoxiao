/**
 * 获取收款人列表 API
 * 
 * GET /api/settings/payees
 * 获取用户的所有收款账户
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../../middlewares/error-handler.middleware'
import { PaymentAccountSchema, ErrorResponseSchema } from '../../types'
import { paymentAccountRepository } from '../../../../src/db/repositories'

// 查询参数
const queryParams = [
  { name: 'userId', description: '用户ID' },
]

// 响应 Schema
const responseSchema = z.object({
  paymentAccounts: z.array(PaymentAccountSchema),
  total: z.number(),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ListPayees',
  description: '获取收款人列表',
  path: '/api/settings/payees',
  method: 'GET',
  flows: ['reimbursement-settings'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  queryParams,
  responseSchema: {
    200: responseSchema,
    400: ErrorResponseSchema,
  },
}

export const handler: Handlers['ListPayees'] = async (req, { logger }) => {
  const userId = req.queryParams.userId as string

  if (!userId) {
    return {
      status: 400,
      body: { error: '参数错误', message: '缺少 userId 参数' },
    }
  }

  logger.info('获取收款人列表', { userId })

  const paymentAccounts = await paymentAccountRepository.list(userId)

  logger.info('收款人列表获取成功', { userId, count: paymentAccounts.length })

  return {
    status: 200,
    body: {
      paymentAccounts: paymentAccounts || [],
      total: paymentAccounts.length,
    },
  }
}
