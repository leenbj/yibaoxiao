import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'

// 响应 schema 定义
const responseSchema = z.object({
  message: z.string(),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'Hello',
  description: '返回 Hello Motia 的简单 API 端点',
  method: 'GET',
  path: '/hello',
  emits: [],
  responseSchema: {
    200: responseSchema,
  },
}

export const handler: Handlers['Hello'] = async (req, { logger }) => {
  logger.info('Hello API 被访问')

  return {
    status: 200,
    body: {
      message: 'Hello Motia',
    },
  }
}


























