/**
 * 用户数据访问层
 */

import { eq } from 'drizzle-orm'
import { getDb } from '../index'
import { users } from '../schema'
import type { AppUser } from '../../../steps/reimbursement/types'

// 类型转换：数据库记录 -> 应用类型
const toAppUser = (record: typeof users.$inferSelect): AppUser => ({
  id: record.id,
  name: record.name,
  department: record.department,
  email: record.email,
  role: record.role,
  password: record.password || undefined,
  isCurrent: record.isCurrent || undefined,
})

// 类型转换：应用类型 -> 数据库记录
const toDbUser = (user: AppUser): typeof users.$inferInsert => ({
  id: user.id,
  name: user.name,
  department: user.department,
  email: user.email,
  role: user.role,
  password: user.password,
  isCurrent: user.isCurrent,
})

export const userRepository = {
  // 根据 ID 获取用户
  async getById(id: string): Promise<AppUser | null> {
    const db = getDb()
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1)
    return result.length > 0 ? toAppUser(result[0]) : null
  },

  // 根据邮箱获取用户
  async getByEmail(email: string): Promise<AppUser | null> {
    const db = getDb()
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1)
    return result.length > 0 ? toAppUser(result[0]) : null
  },

  // 获取所有用户
  async getAll(): Promise<AppUser[]> {
    const db = getDb()
    const result = await db.select().from(users)
    return result.map(toAppUser)
  },

  // 获取当前用户
  async getCurrent(): Promise<AppUser | null> {
    const db = getDb()
    const result = await db.select().from(users).where(eq(users.isCurrent, true)).limit(1)
    return result.length > 0 ? toAppUser(result[0]) : null
  },

  // 创建用户
  async create(user: AppUser): Promise<AppUser> {
    const db = getDb()
    const result = await db.insert(users).values(toDbUser(user)).returning()
    return toAppUser(result[0])
  },

  // 更新用户
  async update(id: string, data: Partial<AppUser>): Promise<AppUser | null> {
    const db = getDb()
    const updateData: Partial<typeof users.$inferInsert> = {
      ...data,
      updatedAt: new Date(),
    }
    const result = await db.update(users).set(updateData).where(eq(users.id, id)).returning()
    return result.length > 0 ? toAppUser(result[0]) : null
  },

  // 删除用户
  async delete(id: string): Promise<AppUser | null> {
    const db = getDb()
    const result = await db.delete(users).where(eq(users.id, id)).returning()
    return result.length > 0 ? toAppUser(result[0]) : null
  },

  // 设置当前用户
  async setCurrentUser(id: string): Promise<void> {
    const db = getDb()
    // 先清除所有用户的 isCurrent
    await db.update(users).set({ isCurrent: false })
    // 设置指定用户为当前用户
    await db.update(users).set({ isCurrent: true }).where(eq(users.id, id))
  },
}

