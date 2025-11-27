/**
 * 删除借款记录 API
 * DELETE /api/loans/:id
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { STATE_GROUPS, ErrorResponseSchema } from '../types'

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

export const handler: Handlers['LoansDelete'] = async (req, { state, logger }) => {
  const loanId = req.pathParams.id

  logger.info('LoansDelete 开始处理', { id: loanId })

  // 获取用户ID（从请求头获取 token 或 query params）
  const authHeader = req.headers.authorization
  let userId = req.queryParams.userId as string || 'default_user'
  
  if (!userId && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    // 简单解析 token 获取用户ID
    const parts = token.split('_')
    if (parts.length >= 3) {
      userId = `${parts[0]}_${parts[1]}`
    }
  }

  // 获取当前借款列表
  const loansKey = `${STATE_GROUPS.LOANS}_${userId}`
  const loans = await state.get<any[]>(loansKey) || []
  
  // 查找要删除的借款
  const loanIndex = loans.findIndex(l => l.id === loanId)
  
  if (loanIndex === -1) {
    return {
      status: 404,
      body: { success: false, message: '借款记录不存在' },
    }
  }

  // 删除借款
  loans.splice(loanIndex, 1)
  await state.set(loansKey, loans)

  logger.info('LoansDelete 删除成功', { id: loanId })

  return {
    status: 200,
    body: { success: true, message: '删除成功' },
  }
}
