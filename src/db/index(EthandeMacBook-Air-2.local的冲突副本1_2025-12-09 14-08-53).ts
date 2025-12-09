/**
 * 数据库连接模块
 * 管理 PostgreSQL 数据库连接池
 * 支持 Drizzle ORM 查询缓存
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

// 加载环境变量
import 'dotenv/config'

// 数据库配置
const getDatabaseConfig = () => {
  // 优先使用 DATABASE_URL
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
    }
  }

  // 否则使用分开的配置
  return {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    database: process.env.DATABASE_NAME || 'yibao_db',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'password',
  }
}

// 连接池配置 - 针对低配服务器优化（2核4G）
const poolConfig = {
  ...getDatabaseConfig(),
  // 减少最小连接数，降低空闲时资源占用
  min: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
  // 限制最大连接数，避免资源耗尽
  max: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
  // 空闲连接超时时间（毫秒）- 60秒后释放空闲连接
  idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '60000', 10),
  // 连接超时时间（毫秒）
  connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECT_TIMEOUT || '10000', 10),
  // 连接最大生命周期（秒）- 1小时后强制轮换连接，有助于负载均衡
  maxLifetimeSeconds: Math.floor(parseInt(process.env.DATABASE_MAX_LIFETIME || '3600000', 10) / 1000),
  // 允许空闲时关闭连接
  allowExitOnIdle: true,
}

// 复用连接池（兼容热重载/多次导入）
const globalForDb = globalThis as unknown as {
  __motiaPool?: Pool
  __motiaDb?: ReturnType<typeof drizzle<typeof schema>>
}

export const getPool = (): Pool => {
  if (!globalForDb.__motiaPool) {
    globalForDb.__motiaPool = new Pool(poolConfig)
    
    // 连接池错误处理
    globalForDb.__motiaPool.on('error', (err) => {
      console.error('数据库连接池错误:', err)
    })

    // 连接池连接事件
    globalForDb.__motiaPool.on('connect', () => {
      console.log('数据库连接已建立')
    })
  }
  return globalForDb.__motiaPool
}

// 创建 Drizzle 实例（禁用缓存，确保数据一致性）
export const getDb = () => {
  if (!globalForDb.__motiaDb) {
    console.log('[数据库] 创建 Drizzle 实例（无缓存模式）');
    globalForDb.__motiaDb = drizzle(getPool(), { schema });
  }
  return globalForDb.__motiaDb
}

// 导出数据库实例（延迟初始化）
export const database = {
  get instance() {
    return getDb()
  },
  get pool() {
    return getPool()
  },
}

// 关闭数据库连接
export const closeDatabase = async (): Promise<void> => {
  if (globalForDb.__motiaPool) {
    await globalForDb.__motiaPool.end()
    globalForDb.__motiaPool = undefined
    globalForDb.__motiaDb = undefined
    console.log('数据库连接已关闭')
  }
}

// 测试数据库连接
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await getPool().connect()
    await client.query('SELECT 1')
    client.release()
    console.log('数据库连接测试成功')
    return true
  } catch (error) {
    console.error('数据库连接测试失败:', error)
    return false
  }
}

// 导出 schema 以便其他模块使用
export { schema }

// 导出类型
export type Database = ReturnType<typeof getDb>
