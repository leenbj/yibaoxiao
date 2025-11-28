/**
 * 用户登录 API
 * 
 * POST /api/auth/login
 * 验证用户凭据并返回用户信息
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { AppUser, AppUserSchema, STATE_GROUPS, ErrorResponseSchema } from '../types'

// 请求体 Schema
const bodySchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '密码不能为空'),
})

// 响应 Schema
const responseSchema = z.object({
  success: z.boolean(),
  user: AppUserSchema.omit({ password: true }),
  token: z.string(), // 简化版 token
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'AuthLogin',
  description: '用户登录',
  path: '/api/auth/login',
  method: 'POST',
  flows: ['reimbursement-auth'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  bodySchema,
  responseSchema: {
    200: responseSchema,
    400: ErrorResponseSchema,
    401: ErrorResponseSchema,
  },
}

export const handler: Handlers['AuthLogin'] = async (req, { state, logger }) => {
  logger.info('处理用户登录请求', { email: req.body.email })

  const { email, password } = bodySchema.parse(req.body)

  // 查找用户
  const users = await state.getGroup<AppUser>(STATE_GROUPS.USERS)
  const user = users.find(u => u.email === email)

  if (!user) {
    logger.warn('用户不存在', { email })
    return {
      status: 401,
      body: { error: '登录失败', message: '邮箱或密码错误' },
    }
  }

  // 验证密码（实际项目中应该比对加密后的密码）
  if (user.password !== password) {
    logger.warn('密码错误', { email })
    return {
      status: 401,
      body: { error: '登录失败', message: '邮箱或密码错误' },
    }
  }

  // 生成简单 token（实际项目中应使用 JWT）
  const token = `token_${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`

  logger.info('用户登录成功', { userId: user.id, email })

  // 返回时不包含密码
  const { password: _, ...userWithoutPassword } = user

  return {
    status: 200,
    body: {
      success: true,
      user: userWithoutPassword,
      token,
    },
  }
}










