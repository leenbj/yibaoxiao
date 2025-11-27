/**
 * 创建预算项目 API
 * 
 * POST /api/settings/projects
 * 添加新的预算项目
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../../middlewares/error-handler.middleware'
import { BudgetProject, BudgetProjectSchema, STATE_GROUPS, ErrorResponseSchema } from '../../types'

// 请求体 Schema
const bodySchema = z.object({
  userId: z.string(),
  name: z.string().min(1, '项目名称不能为空'),
  code: z.string().min(1, '项目编号不能为空'),
  isDefault: z.boolean().default(false),
})

// 响应 Schema
const responseSchema = z.object({
  success: z.boolean(),
  budgetProject: BudgetProjectSchema,
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'CreateProject',
  description: '创建预算项目',
  path: '/api/settings/projects',
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

export const handler: Handlers['CreateProject'] = async (req, { state, logger }) => {
  const data = bodySchema.parse(req.body)
  const { userId, ...projectData } = data
  
  logger.info('创建预算项目', { userId, name: data.name })

  // 生成唯一 ID
  const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // 如果是默认项目，取消其他项目的默认状态
  if (projectData.isDefault) {
    const existingProjects = await state.getGroup<BudgetProject>(`${STATE_GROUPS.BUDGET_PROJECTS}_${userId}`)
    for (const proj of existingProjects) {
      if (proj.isDefault) {
        await state.set(`${STATE_GROUPS.BUDGET_PROJECTS}_${userId}`, proj.id, {
          ...proj,
          isDefault: false,
        })
      }
    }
  }

  // 创建预算项目
  const budgetProject: BudgetProject = {
    id: projectId,
    ...projectData,
  }

  await state.set(`${STATE_GROUPS.BUDGET_PROJECTS}_${userId}`, projectId, budgetProject)

  logger.info('预算项目创建成功', { projectId, userId })

  return {
    status: 201,
    body: {
      success: true,
      budgetProject,
    },
  }
}









