/**
 * 预算项目数据访问层
 */

import { eq, and } from 'drizzle-orm'
import { getDb } from '../index'
import { budgetProjects } from '../schema'
import type { BudgetProject } from '../../../steps/reimbursement/types'

// 类型转换：数据库记录 -> 应用类型
const toBudgetProject = (record: typeof budgetProjects.$inferSelect): BudgetProject => ({
  id: record.id,
  name: record.name,
  code: record.code,
  isDefault: record.isDefault || undefined,
})

// 类型转换：应用类型 -> 数据库记录
const toDbBudgetProject = (project: BudgetProject, userId: string): typeof budgetProjects.$inferInsert => ({
  id: project.id,
  userId,
  name: project.name,
  code: project.code,
  isDefault: project.isDefault,
})

export const budgetProjectRepository = {
  // 获取用户的所有预算项目（别名）
  async list(userId: string): Promise<BudgetProject[]> {
    return this.getByUserId(userId)
  },

  // 根据 ID 获取预算项目
  async getById(userId: string, id: string): Promise<BudgetProject | null> {
    const db = getDb()
    const result = await db.select().from(budgetProjects)
      .where(and(eq(budgetProjects.userId, userId), eq(budgetProjects.id, id)))
      .limit(1)
    return result.length > 0 ? toBudgetProject(result[0]) : null
  },

  // 获取用户的所有预算项目
  async getByUserId(userId: string): Promise<BudgetProject[]> {
    const db = getDb()
    const result = await db.select().from(budgetProjects)
      .where(eq(budgetProjects.userId, userId))
    return result.map(toBudgetProject)
  },

  // 获取默认预算项目
  async getDefault(userId: string): Promise<BudgetProject | null> {
    const db = getDb()
    const result = await db.select().from(budgetProjects)
      .where(and(eq(budgetProjects.userId, userId), eq(budgetProjects.isDefault, true)))
      .limit(1)
    return result.length > 0 ? toBudgetProject(result[0]) : null
  },

  // 创建预算项目
  async create(userId: string, project: BudgetProject): Promise<BudgetProject> {
    const db = getDb()
    
    // 如果是默认项目，先清除其他默认
    if (project.isDefault) {
      await db.update(budgetProjects)
        .set({ isDefault: false })
        .where(eq(budgetProjects.userId, userId))
    }
    
    const result = await db.insert(budgetProjects)
      .values(toDbBudgetProject(project, userId))
      .returning()
    return toBudgetProject(result[0])
  },

  // 更新预算项目
  async update(userId: string, id: string, data: Partial<BudgetProject>): Promise<BudgetProject | null> {
    const db = getDb()
    
    // 如果设置为默认，先清除其他默认
    if (data.isDefault) {
      await db.update(budgetProjects)
        .set({ isDefault: false })
        .where(eq(budgetProjects.userId, userId))
    }
    
    const updateData: Partial<typeof budgetProjects.$inferInsert> = {
      ...data,
      updatedAt: new Date(),
    }
    
    const result = await db.update(budgetProjects)
      .set(updateData)
      .where(and(eq(budgetProjects.userId, userId), eq(budgetProjects.id, id)))
      .returning()
    
    return result.length > 0 ? toBudgetProject(result[0]) : null
  },

  // 删除预算项目
  async delete(userId: string, id: string): Promise<BudgetProject | null> {
    const db = getDb()
    const result = await db.delete(budgetProjects)
      .where(and(eq(budgetProjects.userId, userId), eq(budgetProjects.id, id)))
      .returning()
    return result.length > 0 ? toBudgetProject(result[0]) : null
  },
}

