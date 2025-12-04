/**
 * 数据库连接模块
 * 管理 PostgreSQL 数据库连接池
 * 支持 Drizzle ORM 查询缓存
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import { createMemoryCache, MemoryCache } from './cache'

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

// 创建连接池
let pool: Pool | null = null

export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool(poolConfig)
    
    // 连接池错误处理
    pool.on('error', (err) => {
      console.error('数据库连接池错误:', err)
    })

    // 连接池连接事件
    pool.on('connect', () => {
      console.log('数据库连接已建立')
    })
  }
  return pool
}

// 创建 Drizzle 实例（带缓存支持）
let db: ReturnType<typeof drizzle<typeof schema>> | null = null
let queryCache: MemoryCache | null = null

// 缓存配置（可通过环境变量控制）
const cacheEnabled = process.env.DATABASE_CACHE_ENABLED !== 'false'; // 默认启用
const cacheGlobal = process.env.DATABASE_CACHE_GLOBAL === 'true';    // 默认显式缓存
const cacheTTL = parseInt(process.env.DATABASE_CACHE_TTL || '60', 10); // 默认 60 秒

export const getDb = () => {
  if (!db) {
    // 创建缓存实例（如果启用）
    if (cacheEnabled) {
      queryCache = createMemoryCache({
        defaultTTL: cacheTTL,
        global: cacheGlobal,
      });
      console.log(`[数据库] 查询缓存已启用 (TTL: ${cacheTTL}s, 全局: ${cacheGlobal})`);
      
      // 尝试使用缓存创建 Drizzle 实例
      try {
        db = drizzle(getPool(), { schema, cache: queryCache });
      } catch (e) {
        // 如果缓存不支持，回退到无缓存模式
        console.warn('[数据库] 缓存功能不支持，使用无缓存模式');
        db = drizzle(getPool(), { schema });
      }
    } else {
      db = drizzle(getPool(), { schema });
    }
  }
  return db
}

// 导出数据库实例（延迟初始化）
export const database = {
  get instance() {
    return getDb()
  },
  get pool() {
    return getPool()
  },
  get cache() {
    return queryCache
  },
}

// 关闭数据库连接
export const closeDatabase = async (): Promise<void> => {
  // 停止缓存
  if (queryCache) {
    queryCache.stop();
    queryCache = null;
  }
  
  if (pool) {
    await pool.end()
    pool = null
    db = null
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

