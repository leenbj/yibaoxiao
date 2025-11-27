/**
 * 用户注册 API
 * 
 * POST /api/auth/register
 * 创建新用户账号
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { AppUserSchema, STATE_GROUPS, ErrorResponseSchema } from '../types'

// 请求体 Schema
const bodySchema = z.object({
  name: z.string().min(1, '姓名不能为空'),
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少6位'),
  department: z.string().min(1, '部门不能为空'),
})

// 响应 Schema
const responseSchema = z.object({
  success: z.boolean(),
  user: AppUserSchema.omit({ password: true }),
  message: z.string().optional(),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'AuthRegister',
  description: '用户注册',
  path: '/api/auth/register',
  method: 'POST',
  flows: ['reimbursement-auth'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  bodySchema,
  responseSchema: {
    201: responseSchema,
    400: ErrorResponseSchema,
    409: ErrorResponseSchema,
  },
}

export const handler: Handlers['AuthRegister'] = async (req, { state, logger }) => {
  logger.info('处理用户注册请求', { email: req.body.email })

  const { name, email, password, department } = bodySchema.parse(req.body)

  // 检查邮箱是否已存在
  const existingUsers = await state.getGroup<{ id: string; email: string }>(STATE_GROUPS.USERS)
  const emailExists = existingUsers.some(u => u.email === email)

  if (emailExists) {
    logger.warn('邮箱已被注册', { email })
    return {
      status: 409,
      body: { error: '注册失败', message: '该邮箱已被注册' },
    }
  }

  // 创建新用户
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const newUser = {
    id: userId,
    name,
    email,
    password, // 实际项目中应该加密存储
    department,
    role: 'user' as const,
    isCurrent: false,
  }

  // 存储用户
  await state.set(STATE_GROUPS.USERS, userId, newUser)

  // 同时初始化用户的默认设置
  const defaultPaymentAccount = {
    id: `pa_${Date.now()}`,
    bankName: '',
    bankBranch: '',
    accountNumber: '',
    accountName: name,
    isDefault: true,
  }
  await state.set(`${STATE_GROUPS.PAYMENT_ACCOUNTS}_${userId}`, defaultPaymentAccount.id, defaultPaymentAccount)

  const defaultProject = {
    id: `proj_${Date.now()}`,
    name: '默认项目',
    code: 'DEFAULT',
    isDefault: true,
  }
  await state.set(`${STATE_GROUPS.BUDGET_PROJECTS}_${userId}`, defaultProject.id, defaultProject)

  logger.info('用户注册成功', { userId, email })

  // 返回时不包含密码
  const { password: _, ...userWithoutPassword } = newUser

  return {
    status: 201,
    body: {
      success: true,
      user: userWithoutPassword,
      message: '注册成功',
    },
  }
}









