/**
 * 错误处理中间件
 * 
 * 统一处理 API Step 中的错误，包括 Zod 验证错误和其他异常
 */

import { ApiMiddleware } from 'motia'
import { ZodError } from 'zod'

export const errorHandlerMiddleware: ApiMiddleware = async (req, ctx, next) => {
  const { logger } = ctx

  try {
    // 调用下一个中间件或处理函数
    return await next()
  } catch (error: any) {
    // 处理 Zod 验证错误
    if (error instanceof ZodError) {
      logger.error('验证错误', {
        errors: error.errors,
        path: req.pathParams,
      })

      return {
        status: 400,
        body: {
          error: '请求数据验证失败',
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
        },
      }
    }

    // 处理其他错误
    logger.error('请求处理错误', {
      error: error.message,
      stack: error.stack,
    })

    return {
      status: 500,
      body: {
        error: '服务器内部错误',
        message: process.env.NODE_ENV === 'development' ? error.message : '请稍后重试',
      },
    }
  }
}










