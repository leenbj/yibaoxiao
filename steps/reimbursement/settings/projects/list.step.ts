/**
 * 获取预算项目列表 API
 * 
 * GET /api/settings/projects
 * 获取用户的所有预算项目
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../../middlewares/error-handler.middleware'
import { BudgetProject, BudgetProjectSchema, STATE_GROUPS, ErrorResponseSchema } from '../../types'

// 查询参数
const queryParams = [
  { name: 'userId', description: '用户ID' },
]

// 响应 Schema
const responseSchema = z.object({
  budgetProjects: z.array(BudgetProjectSchema),
  total: z.number(),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ListProjects',
  description: '获取预算项目列表',
  path: '/api/settings/projects',
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

export const handler: Handlers['ListProjects'] = async (req, { state, logger }) => {
  const userId = req.queryParams.userId as string

  if (!userId) {
    return {
      status: 400,
      body: { error: '参数错误', message: '缺少 userId 参数' },
    }
  }

  logger.info('获取预算项目列表', { userId })

  const budgetProjects = await state.getGroup<BudgetProject>(`${STATE_GROUPS.BUDGET_PROJECTS}_${userId}`)

  logger.info('预算项目列表获取成功', { userId, count: budgetProjects.length })

  return {
    status: 200,
    body: {
      budgetProjects: budgetProjects || [],
      total: budgetProjects.length,
    },
  }
}









