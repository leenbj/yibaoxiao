/**
 * 更新用户信息 API
 * 
 * PUT /api/user/profile
 * 更新当前用户的基本信息
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { AppUserSchema, ErrorResponseSchema } from '../types'
import { userRepository } from '../../../src/db/repositories'

// 请求体 Schema
const bodySchema = z.object({
  userId: z.string(),
  name: z.string().min(1, '姓名不能为空').optional(),
  department: z.string().optional(),
  email: z.string().email('邮箱格式不正确').optional(),
  password: z.string().min(6, '密码至少6位').optional(),
})

// 响应 Schema
const responseSchema = z.object({
  success: z.boolean(),
  user: AppUserSchema.omit({ password: true }),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'UpdateUserProfile',
  description: '更新用户信息',
  path: '/api/user/profile',
  method: 'PUT',
  flows: ['reimbursement-user'],
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

export const handler: Handlers['UpdateUserProfile'] = async (req, { logger }) => {
  const data = bodySchema.parse(req.body)
  const { userId, ...updateData } = data

  logger.info('更新用户信息', { userId })

  // 获取现有用户
  const existingUser = await userRepository.getById(userId)
  
  if (!existingUser) {
    logger.warn('用户不存在', { userId })
    return {
      status: 404,
      body: { error: '用户不存在', message: '未找到指定用户' },
    }
  }

  // 更新用户信息
  const updatedUser = await userRepository.update(userId, updateData)

  if (!updatedUser) {
    return {
      status: 500,
      body: { error: '更新失败', message: '更新用户信息失败' },
    }
  }

  logger.info('用户信息更新成功', { userId })

  // 返回时不包含密码
  const { password: _, ...userWithoutPassword } = updatedUser

  return {
    status: 200,
    body: {
      success: true,
      user: userWithoutPassword,
    },
  }
}
