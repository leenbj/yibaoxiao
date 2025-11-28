/**
 * AI 配置数据访问层
 */

import { eq, and } from 'drizzle-orm'
import { getDb } from '../index'
import { aiConfigs } from '../schema'
import type { AIConfig, AIProvider } from '../../../steps/reimbursement/types'

// 类型转换：数据库记录 -> 应用类型
const toAIConfig = (record: typeof aiConfigs.$inferSelect): AIConfig => ({
  id: record.id,
  userId: record.userId,
  provider: record.provider as AIProvider,
  apiKey: record.apiKey,
  apiUrl: record.apiUrl || undefined,
  model: record.model || undefined,
  isActive: record.isActive || false,
  createdAt: record.createdAt?.toISOString(),
  updatedAt: record.updatedAt?.toISOString(),
})

// 类型转换：应用类型 -> 数据库记录
const toDbAIConfig = (config: AIConfig): typeof aiConfigs.$inferInsert => ({
  id: config.id,
  userId: config.userId,
  provider: config.provider,
  apiKey: config.apiKey,
  apiUrl: config.apiUrl,
  model: config.model,
  isActive: config.isActive,
})

export const aiConfigRepository = {
  // 获取用户的所有 AI 配置（别名）
  async list(userId: string): Promise<AIConfig[]> {
    return this.getByUserId(userId)
  },

  // 根据 ID 获取 AI 配置
  async getById(userId: string, id: string): Promise<AIConfig | null> {
    const db = getDb()
    const result = await db.select().from(aiConfigs)
      .where(and(eq(aiConfigs.userId, userId), eq(aiConfigs.id, id)))
      .limit(1)
    return result.length > 0 ? toAIConfig(result[0]) : null
  },

  // 获取用户的所有 AI 配置
  async getByUserId(userId: string): Promise<AIConfig[]> {
    const db = getDb()
    const result = await db.select().from(aiConfigs)
      .where(eq(aiConfigs.userId, userId))
    return result.map(toAIConfig)
  },

  // 获取激活的 AI 配置
  async getActive(userId: string): Promise<AIConfig | null> {
    const db = getDb()
    const result = await db.select().from(aiConfigs)
      .where(and(eq(aiConfigs.userId, userId), eq(aiConfigs.isActive, true)))
      .limit(1)
    return result.length > 0 ? toAIConfig(result[0]) : null
  },

  // 创建 AI 配置
  async create(config: AIConfig): Promise<AIConfig> {
    const db = getDb()
    
    // 如果是激活配置，先禁用其他配置
    if (config.isActive) {
      await db.update(aiConfigs)
        .set({ isActive: false })
        .where(eq(aiConfigs.userId, config.userId))
    }
    
    const result = await db.insert(aiConfigs).values(toDbAIConfig(config)).returning()
    return toAIConfig(result[0])
  },

  // 更新 AI 配置
  async update(userId: string, id: string, data: Partial<AIConfig>): Promise<AIConfig | null> {
    const db = getDb()
    
    // 如果设置为激活，先禁用其他配置
    if (data.isActive) {
      await db.update(aiConfigs)
        .set({ isActive: false })
        .where(eq(aiConfigs.userId, userId))
    }
    
    // 移除 createdAt/updatedAt 字符串，使用 Date 对象
    const { createdAt, updatedAt, ...restData } = data
    const updateData: Partial<typeof aiConfigs.$inferInsert> = {
      ...restData,
      updatedAt: new Date(),
    }
    
    const result = await db.update(aiConfigs)
      .set(updateData)
      .where(and(eq(aiConfigs.userId, userId), eq(aiConfigs.id, id)))
      .returning()
    
    return result.length > 0 ? toAIConfig(result[0]) : null
  },

  // 删除 AI 配置
  async delete(userId: string, id: string): Promise<AIConfig | null> {
    const db = getDb()
    const result = await db.delete(aiConfigs)
      .where(and(eq(aiConfigs.userId, userId), eq(aiConfigs.id, id)))
      .returning()
    return result.length > 0 ? toAIConfig(result[0]) : null
  },

  // 保存或更新 AI 配置（upsert）
  async save(config: AIConfig): Promise<AIConfig> {
    const existing = await this.getById(config.userId, config.id)
    if (existing) {
      const updated = await this.update(config.userId, config.id, config)
      return updated!
    }
    return this.create(config)
  },
}

