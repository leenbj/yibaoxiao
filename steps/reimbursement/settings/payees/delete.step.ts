/**
 * 删除收款人 API
 * 
 * DELETE /api/settings/payees/:id
 * 删除指定的收款账户
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../../middlewares/error-handler.middleware'
import { PaymentAccount, STATE_GROUPS, ErrorResponseSchema, SuccessResponseSchema } from '../../types'

// 查询参数
const queryParams = [
  { name: 'userId', description: '用户ID' },
]

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'DeletePayee',
  description: '删除收款人',
  path: '/api/settings/payees/:id',
  method: 'DELETE',
  flows: ['reimbursement-settings'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  queryParams,
  responseSchema: {
    200: SuccessResponseSchema,
    400: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
}

export const handler: Handlers['DeletePayee'] = async (req, { state, logger }) => {
  const accountId = req.pathParams.id
  const userId = req.queryParams.userId as string

  if (!userId) {
    return {
      status: 400,
      body: { error: '参数错误', message: '缺少 userId 参数' },
    }
  }

  logger.info('删除收款人', { accountId, userId })

  // 检查是否存在
  const existing = await state.get<PaymentAccount>(`${STATE_GROUPS.PAYMENT_ACCOUNTS}_${userId}`, accountId)
  
  if (!existing) {
    logger.warn('收款人不存在', { accountId, userId })
    return {
      status: 404,
      body: { error: '收款人不存在', message: '未找到指定的收款账户' },
    }
  }

  // 删除账户
  await state.delete(`${STATE_GROUPS.PAYMENT_ACCOUNTS}_${userId}`, accountId)

  logger.info('收款人删除成功', { accountId, userId })

  return {
    status: 200,
    body: {
      success: true,
      message: '收款人已删除',
    },
  }
}










