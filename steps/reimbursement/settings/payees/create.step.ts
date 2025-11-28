/**
 * 创建收款人 API
 * 
 * POST /api/settings/payees
 * 添加新的收款账户
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../../middlewares/error-handler.middleware'
import { PaymentAccount, PaymentAccountSchema, ErrorResponseSchema } from '../../types'
import { paymentAccountRepository } from '../../../../src/db/repositories'

// 请求体 Schema
const bodySchema = z.object({
  userId: z.string(),
  bankName: z.string().min(1, '银行名称不能为空'),
  bankBranch: z.string().optional(),
  accountNumber: z.string().min(1, '账号不能为空'),
  accountName: z.string().min(1, '户名不能为空'),
  isDefault: z.boolean().default(false),
})

// 响应 Schema
const responseSchema = z.object({
  success: z.boolean(),
  paymentAccount: PaymentAccountSchema,
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'CreatePayee',
  description: '创建收款人',
  path: '/api/settings/payees',
  method: 'POST',
  flows: ['reimbursement-settings'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  bodySchema,
  responseSchema: {
    201: responseSchema,
    400: ErrorResponseSchema,
  },
}

export const handler: Handlers['CreatePayee'] = async (req, { logger }) => {
  const data = bodySchema.parse(req.body)
  const { userId, ...accountData } = data
  
  logger.info('创建收款人', { userId, accountName: data.accountName })

  // 生成唯一 ID
  const accountId = `pa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // 如果是默认账户，取消其他账户的默认状态
  if (accountData.isDefault) {
    const existingAccounts = await paymentAccountRepository.list(userId)
    for (const acc of existingAccounts) {
      if (acc.isDefault) {
        await paymentAccountRepository.update(userId, acc.id, {
          ...acc,
          isDefault: false,
        })
      }
    }
  }

  // 创建收款账户
  const paymentAccount: PaymentAccount = {
    id: accountId,
    ...accountData,
  }

  await paymentAccountRepository.create(userId, paymentAccount)

  logger.info('收款人创建成功', { accountId, userId })

  return {
    status: 201,
    body: {
      success: true,
      paymentAccount,
    },
  }
}
