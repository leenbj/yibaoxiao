/**
 * AI 识别异步处理 Event Step
 * 
 * 处理 AI 识别任务，从用户配置中读取 AI 设置并调用相应服务
 */

import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { recognizeWithConfig, AIConfig } from '../../../src/services/ai-recognition'
import { aiConfigRepository } from '../../../src/db/repositories'

// 输入 Schema
const inputSchema = z.object({
  taskId: z.string(),
  userId: z.string(),
  images: z.array(z.string()),
  type: z.enum(['invoice', 'approval', 'travel']),
})

export const config: EventConfig = {
  type: 'event',
  name: 'AIRecognitionProcess',
  description: 'AI 识别异步处理',
  subscribes: ['ai-recognition-process'],
  emits: ['ai-recognition-complete'],
  flows: ['reimbursement-ai'],
  input: inputSchema,
}

export const handler: Handlers['AIRecognitionProcess'] = async (input, { emit, logger, state }) => {
  const { taskId, userId, images, type } = input

  logger.info('开始异步 AI 识别处理', { taskId, userId, type })

  try {
    // 从用户配置中获取 AI 设置
    let aiConfig: AIConfig | null = null
    
    const userConfigs = await aiConfigRepository.list(userId)
    
    if (userConfigs && userConfigs.length > 0) {
      // 查找默认配置或第一个可用配置
      const defaultConfig = userConfigs.find((c: any) => c.isActive)
      const activeConfig = defaultConfig || userConfigs[0]
      
      if (activeConfig) {
        aiConfig = {
          provider: activeConfig.provider,
          apiKey: activeConfig.apiKey,
          apiUrl: activeConfig.apiUrl,
          model: activeConfig.model,
        }
        logger.info('使用用户 AI 配置', { provider: aiConfig.provider })
      }
    }

    // 调用 AI 识别服务
    const recognitionResult = await recognizeWithConfig(images, type, aiConfig)

    // 组装结果
    const result = {
      taskId,
      userId,
      type,
      status: 'completed',
      result: recognitionResult,
      completedAt: new Date().toISOString(),
    }

    // 存储结果 (使用 state 作为临时任务存储，因为任务结果是临时的)
    await state.set('ai_tasks', taskId, result)

    // 发送完成通知
    await emit({
      topic: 'ai-recognition-complete',
      data: {
        taskId,
        userId,
        success: true,
        result: recognitionResult,
      },
    })

    logger.info('AI 识别处理完成', { taskId, userId })
  } catch (error: any) {
    logger.error('AI 识别处理失败', { taskId, error: error.message })

    // 存储错误状态
    await state.set('ai_tasks', taskId, {
      taskId,
      userId,
      type,
      status: 'failed',
      error: error.message,
      failedAt: new Date().toISOString(),
    })

    // 发送失败通知
    await emit({
      topic: 'ai-recognition-complete',
      data: {
        taskId,
        userId,
        success: false,
        error: error.message,
      },
    })
  }
}
