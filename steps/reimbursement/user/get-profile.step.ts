/**
 * 获取用户信息 API
 * 
 * GET /api/user/profile
 * 获取当前用户的完整配置（用户信息、收款账户、预算项目）
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { 
  AppUser, 
  PaymentAccount, 
  BudgetProject,
  UserSettingsSchema,
  STATE_GROUPS, 
  ErrorResponseSchema 
} from '../types'

// 查询参数
const queryParams = [
  { name: 'userId', description: '用户ID' }
]

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'GetUserProfile',
  description: '获取用户配置信息',
  path: '/api/user/profile',
  method: 'GET',
  flows: ['reimbursement-user'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  queryParams,
  responseSchema: {
    200: UserSettingsSchema,
    400: ErrorResponseSchema,
    404: ErrorResponseSchema,
  },
}

export const handler: Handlers['GetUserProfile'] = async (req, { state, logger }) => {
  const userId = req.queryParams.userId as string

  if (!userId) {
    return {
      status: 400,
      body: { error: '参数错误', message: '缺少 userId 参数' },
    }
  }

  logger.info('获取用户配置', { userId })

  // 获取用户信息
  const user = await state.get<AppUser>(STATE_GROUPS.USERS, userId)
  
  if (!user) {
    logger.warn('用户不存在', { userId })
    return {
      status: 404,
      body: { error: '用户不存在', message: '未找到指定用户' },
    }
  }

  // 获取用户的收款账户
  const paymentAccounts = await state.getGroup<PaymentAccount>(`${STATE_GROUPS.PAYMENT_ACCOUNTS}_${userId}`)

  // 获取用户的预算项目
  const budgetProjects = await state.getGroup<BudgetProject>(`${STATE_GROUPS.BUDGET_PROJECTS}_${userId}`)

  // 获取所有用户（用于管理员查看）
  const allUsers = await state.getGroup<AppUser>(STATE_GROUPS.USERS)

  // 返回时不包含密码
  const { password: _, ...currentUserWithoutPassword } = user
  const usersWithoutPasswords = allUsers.map(u => {
    const { password: __, ...userWithoutPassword } = u
    return { ...userWithoutPassword, isCurrent: u.id === userId }
  })

  logger.info('用户配置获取成功', { userId })

  return {
    status: 200,
    body: {
      currentUser: { ...currentUserWithoutPassword, isCurrent: true },
      users: usersWithoutPasswords,
      paymentAccounts: paymentAccounts || [],
      budgetProjects: budgetProjects || [],
    },
  }
}









