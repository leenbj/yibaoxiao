/**
 * Token 使用记录数据访问层
 */

import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import { getDb } from '../index'
import { tokenUsage } from '../schema'
import type { TokenUsage, TokenStats } from '../../../steps/reimbursement/types'

// 类型转换：数据库记录 -> 应用类型
const toTokenUsage = (record: typeof tokenUsage.$inferSelect): TokenUsage => ({
  id: record.id,
  userId: record.userId,
  provider: record.provider,
  model: record.model,
  inputTokens: record.inputTokens,
  outputTokens: record.outputTokens,
  totalTokens: record.totalTokens,
  inputCost: parseFloat(record.inputCost),
  outputCost: parseFloat(record.outputCost),
  totalCost: parseFloat(record.totalCost),
  cached: record.cached || undefined,
  operation: record.operation || undefined,
  createdAt: record.createdAt?.toISOString() || new Date().toISOString(),
})

// 类型转换：应用类型 -> 数据库记录
const toDbTokenUsage = (usage: TokenUsage): typeof tokenUsage.$inferInsert => ({
  id: usage.id,
  userId: usage.userId,
  provider: usage.provider,
  model: usage.model,
  inputTokens: usage.inputTokens,
  outputTokens: usage.outputTokens,
  totalTokens: usage.totalTokens,
  inputCost: usage.inputCost.toString(),
  outputCost: usage.outputCost.toString(),
  totalCost: usage.totalCost.toString(),
  cached: usage.cached,
  operation: usage.operation,
})

export const tokenUsageRepository = {
  // 获取所有 Token 使用记录
  async list(): Promise<TokenUsage[]> {
    const db = getDb()
    const result = await db.select().from(tokenUsage).orderBy(desc(tokenUsage.createdAt))
    return result.map(toTokenUsage)
  },

  // 根据 ID 获取 Token 使用记录
  async getById(userId: string, id: string): Promise<TokenUsage | null> {
    const db = getDb()
    const result = await db.select().from(tokenUsage)
      .where(and(eq(tokenUsage.userId, userId), eq(tokenUsage.id, id)))
      .limit(1)
    return result.length > 0 ? toTokenUsage(result[0]) : null
  },

  // 获取用户的所有 Token 使用记录
  async getByUserId(userId: string): Promise<TokenUsage[]> {
    const db = getDb()
    const result = await db.select().from(tokenUsage)
      .where(eq(tokenUsage.userId, userId))
      .orderBy(desc(tokenUsage.createdAt))
    return result.map(toTokenUsage)
  },

  // 按时间范围获取 Token 使用记录
  async getByDateRange(userId: string, startDate: Date, endDate: Date): Promise<TokenUsage[]> {
    const db = getDb()
    const result = await db.select().from(tokenUsage)
      .where(and(
        eq(tokenUsage.userId, userId),
        gte(tokenUsage.createdAt, startDate),
        lte(tokenUsage.createdAt, endDate)
      ))
      .orderBy(desc(tokenUsage.createdAt))
    return result.map(toTokenUsage)
  },

  // 创建 Token 使用记录
  async create(usage: TokenUsage): Promise<TokenUsage> {
    const db = getDb()
    const result = await db.insert(tokenUsage).values(toDbTokenUsage(usage)).returning()
    return toTokenUsage(result[0])
  },

  // 获取统计数据
  async getStats(userId: string, startDate?: Date, endDate?: Date): Promise<TokenStats> {
    const db = getDb()
    
    // 构建查询条件
    let whereConditions = eq(tokenUsage.userId, userId)
    if (startDate && endDate) {
      whereConditions = and(
        whereConditions,
        gte(tokenUsage.createdAt, startDate),
        lte(tokenUsage.createdAt, endDate)
      )!
    }
    
    // 获取所有记录
    const records = await db.select().from(tokenUsage).where(whereConditions)
    
    // 计算统计数据
    let totalTokens = 0
    let totalCost = 0
    let inputTokens = 0
    let outputTokens = 0
    let inputCost = 0
    let outputCost = 0
    const byProvider: TokenStats['byProvider'] = {}
    
    for (const record of records) {
      totalTokens += record.totalTokens
      totalCost += parseFloat(record.totalCost)
      inputTokens += record.inputTokens
      outputTokens += record.outputTokens
      inputCost += parseFloat(record.inputCost)
      outputCost += parseFloat(record.outputCost)
      
      // 按厂商统计
      const providerKey = record.provider
      if (!byProvider[providerKey]) {
        byProvider[providerKey] = {
          provider: providerKey,
          providerName: providerKey,
          totalTokens: 0,
          totalCost: 0,
          usageCount: 0,
        }
      }
      const providerStats = byProvider[providerKey] as { provider: string; providerName: string; totalTokens: number; totalCost: number; usageCount: number }
      providerStats.totalTokens += record.totalTokens
      providerStats.totalCost += parseFloat(record.totalCost)
      providerStats.usageCount += 1
    }
    
    return {
      totalTokens,
      totalCost,
      inputTokens,
      outputTokens,
      inputCost,
      outputCost,
      usageCount: records.length,
      byProvider,
    }
  },

  // 删除 Token 使用记录
  async delete(userId: string, id: string): Promise<TokenUsage | null> {
    const db = getDb()
    const result = await db.delete(tokenUsage)
      .where(and(eq(tokenUsage.userId, userId), eq(tokenUsage.id, id)))
      .returning()
    return result.length > 0 ? toTokenUsage(result[0]) : null
  },
}

