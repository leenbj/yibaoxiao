/**
 * 更新收款人 API
 * 
 * PUT /api/settings/payees/:id
 * 更新指定的收款账户
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../../middlewares/error-handler.middleware'
import { PaymentAccount, PaymentAccountSchema, ErrorResponseSchema } from '../../types'
import { paymentAccountRepository } from '../../../../src/db/repositories'

// 请求体 Schema
const bodySchema = z.object({
  userId: z.string(),
  bankName: z.string().optional(),
  bankBranch: z.string().optional(),
  accountNumber: z.string().optional(),
  accountName: z.string().optional(),
  isDefault: z.boolean().optional(),
})

// 响应 Schema
const responseSchema = z.object({
  success: z.boolean(),
  paymentAccount: PaymentAccountSchema,
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'UpdatePayee',
  description: '更新收款人',
  path: '/api/settings/payees/:id',
  method: 'PUT',
  flows: ['reimbursement-settings'],
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

export const handler: Handlers['UpdatePayee'] = async (req, { logger }) => {
  const accountId = req.pathParams.id
  const data = bodySchema.parse(req.body)
  const { userId, ...updateData } = data

  logger.info('更新收款人', { accountId, userId })

  // 获取现有账户
  const existing = await paymentAccountRepository.getById(userId, accountId)
  
  if (!existing) {
    logger.warn('收款人不存在', { accountId, userId })
    return {
      status: 404,
      body: { error: '收款人不存在', message: '未找到指定的收款账户' },
    }
  }

  // 如果设为默认，取消其他账户的默认状态
  if (updateData.isDefault && !existing.isDefault) {
    const existingAccounts = await paymentAccountRepository.list(userId)
    for (const acc of existingAccounts) {
      if (acc.isDefault && acc.id !== accountId) {
        await paymentAccountRepository.update(userId, acc.id, {
          ...acc,
          isDefault: false,
        })
      }
    }
  }

  // 更新账户
  const updated = await paymentAccountRepository.update(userId, accountId, updateData)

  if (!updated) {
    return {
      status: 500,
      body: { error: '更新失败', message: '更新收款人失败' },
    }
  }

  logger.info('收款人更新成功', { accountId, userId })

  return {
    status: 200,
    body: {
      success: true,
      paymentAccount: updated,
    },
  }
}
