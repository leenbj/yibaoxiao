/**
 * 健康检查 API
 * 
 * GET /api/health
 * 用于 Docker 健康检查和负载均衡器探测
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'

const responseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  uptime: z.number(),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'HealthCheck',
  description: '系统健康检查',
  path: '/api/health',
  method: 'GET',
  flows: ['health'],
  emits: [],
  responseSchema: {
    200: responseSchema,
  },
}

export const handler: Handlers['HealthCheck'] = async () => {
  return {
    status: 200,
    body: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  }
}







