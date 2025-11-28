/**
 * 更新预算项目 API
 * 
 * PUT /api/settings/projects/:id
 * 更新指定的预算项目
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../../middlewares/error-handler.middleware'
import { BudgetProject, BudgetProjectSchema, ErrorResponseSchema } from '../../types'
import { budgetProjectRepository } from '../../../../src/db/repositories'

// 请求体 Schema
const bodySchema = z.object({
  userId: z.string(),
  name: z.string().optional(),
  code: z.string().optional(),
  isDefault: z.boolean().optional(),
})

// 响应 Schema
const responseSchema = z.object({
  success: z.boolean(),
  budgetProject: BudgetProjectSchema,
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'UpdateProject',
  description: '更新预算项目',
  path: '/api/settings/projects/:id',
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

export const handler: Handlers['UpdateProject'] = async (req, { logger }) => {
  const projectId = req.pathParams.id
  const data = bodySchema.parse(req.body)
  const { userId, ...updateData } = data

  logger.info('更新预算项目', { projectId, userId })

  // 获取现有项目
  const existing = await budgetProjectRepository.getById(userId, projectId)
  
  if (!existing) {
    logger.warn('预算项目不存在', { projectId, userId })
    return {
      status: 404,
      body: { error: '预算项目不存在', message: '未找到指定的预算项目' },
    }
  }

  // 如果设为默认，取消其他项目的默认状态
  if (updateData.isDefault && !existing.isDefault) {
    const existingProjects = await budgetProjectRepository.list(userId)
    for (const proj of existingProjects) {
      if (proj.isDefault && proj.id !== projectId) {
        await budgetProjectRepository.update(userId, proj.id, {
          ...proj,
          isDefault: false,
        })
      }
    }
  }

  // 更新项目
  const updated = await budgetProjectRepository.update(userId, projectId, updateData)

  if (!updated) {
    return {
      status: 500,
      body: { error: '更新失败', message: '更新预算项目失败' },
    }
  }

  logger.info('预算项目更新成功', { projectId, userId })

  return {
    status: 200,
    body: {
      success: true,
      budgetProject: updated,
    },
  }
}
