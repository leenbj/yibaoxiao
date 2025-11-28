/**
 * 保存 AI 配置 API
 * 
 * POST /api/settings/ai-config
 * 保存或更新 AI 模型配置
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../../middlewares/error-handler.middleware'
import { 
  AIConfig,
  AIConfigSchema, 
  AIProviderSchema,
  AI_PROVIDERS_INFO,
  ErrorResponseSchema 
} from '../../types'
import { aiConfigRepository } from '../../../../src/db/repositories'

// 请求体 Schema
const bodySchema = z.object({
  userId: z.string(),
  provider: AIProviderSchema,
  apiKey: z.string().min(1, 'API Key 不能为空'),
  apiUrl: z.string().optional(),
  model: z.string().optional(),
  isActive: z.boolean().default(true),
})

// 响应 Schema
const responseSchema = z.object({
  success: z.boolean(),
  config: AIConfigSchema,
  message: z.string().optional(),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'SaveAIConfig',
  description: '保存 AI 配置',
  path: '/api/settings/ai-config',
  method: 'POST',
  flows: ['reimbursement-settings'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  bodySchema,
  responseSchema: {
    200: responseSchema,
    201: responseSchema,
    400: ErrorResponseSchema,
  },
}

export const handler: Handlers['SaveAIConfig'] = async (req, { logger }) => {
  const data = bodySchema.parse(req.body)
  const { userId, provider, apiKey, apiUrl, model, isActive } = data
  
  logger.info('保存 AI 配置', { userId, provider })

  // 获取厂商默认配置
  const providerInfo = AI_PROVIDERS_INFO[provider]

  // 检查是否已存在该厂商的配置
  const existingConfigs = await aiConfigRepository.list(userId)
  const existingConfig = existingConfigs.find(c => c.provider === provider)

  const now = new Date().toISOString()
  let aiConfig: AIConfig
  let isNew = false

  if (existingConfig) {
    // 更新现有配置
    aiConfig = {
      ...existingConfig,
      apiKey,
      apiUrl: apiUrl || providerInfo.defaultUrl,
      model: model || providerInfo.defaultModel,
      isActive,
      updatedAt: now,
    }
    await aiConfigRepository.update(userId, aiConfig.id, aiConfig)
  } else {
    // 创建新配置
    isNew = true
    const configId = `aiconf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    aiConfig = {
      id: configId,
      userId,
      provider,
      apiKey,
      apiUrl: apiUrl || providerInfo.defaultUrl,
      model: model || providerInfo.defaultModel,
      isActive,
      createdAt: now,
      updatedAt: now,
    }
    await aiConfigRepository.create(aiConfig)
  }

  // 如果设为激活，取消其他配置的激活状态
  if (isActive) {
    for (const conf of existingConfigs) {
      if (conf.provider !== provider && conf.isActive) {
        await aiConfigRepository.update(userId, conf.id, {
          ...conf,
          isActive: false,
          updatedAt: now,
        })
      }
    }
  }

  logger.info('AI 配置保存成功', { userId, provider, configId: aiConfig.id })

  return {
    status: isNew ? 201 : 200,
    body: {
      success: true,
      config: aiConfig,
      message: isNew ? '配置已创建' : '配置已更新',
    },
  }
}
