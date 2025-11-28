/**
 * 删除借款记录 API
 * DELETE /api/loans/:id
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { ErrorResponseSchema } from '../types'
import { loanRepository } from '../../../src/db/repositories'

// 查询参数
const queryParams = [
  { name: 'userId', description: '用户ID' },
]

// 响应 schema
const DeleteResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'LoansDelete',
  description: '删除借款记录',
  path: '/api/loans/:id',
  method: 'DELETE',
  flows: ['reimbursement-loans'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  queryParams,
  responseSchema: {
    200: DeleteResponseSchema,
    400: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
}

export const handler: Handlers['LoansDelete'] = async (req, { logger }) => {
  const loanId = req.pathParams.id
  const userId = req.queryParams.userId as string || 'default_user'

  logger.info('LoansDelete 开始处理', { id: loanId, userId })

  if (!userId) {
    return {
      status: 400,
      body: { error: '参数错误', message: '缺少 userId 参数' },
    }
  }

  // 检查借款记录是否存在
  const existing = await loanRepository.getById(userId, loanId)
  
  if (!existing) {
    return {
      status: 404,
      body: { error: '不存在', message: '借款记录不存在' },
    }
  }

  // 删除借款记录
  await loanRepository.delete(userId, loanId)

  logger.info('LoansDelete 删除成功', { id: loanId })

  return {
    status: 200,
    body: { success: true, message: '删除成功' },
  }
}
