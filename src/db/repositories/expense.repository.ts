/**
 * 费用记录（记账本）数据访问层
 */

import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '../index'
import { expenses } from '../schema'
import type { ExpenseItem, ExpenseStatus } from '../../../steps/reimbursement/types'

// 类型转换：数据库记录 -> 应用类型
const toExpenseItem = (record: typeof expenses.$inferSelect): ExpenseItem => ({
  id: record.id,
  userId: record.userId,
  amount: parseFloat(record.amount),
  description: record.description,
  date: record.date,
  category: record.category,
  remarks: record.remarks || undefined,
  status: record.status as ExpenseStatus,
  createdAt: record.createdAt?.toISOString(),
  updatedAt: record.updatedAt?.toISOString(),
})

// 类型转换：应用类型 -> 数据库记录
const toDbExpense = (expense: ExpenseItem): typeof expenses.$inferInsert => ({
  id: expense.id,
  userId: expense.userId,
  amount: expense.amount.toString(),
  description: expense.description,
  date: expense.date,
  category: expense.category,
  remarks: expense.remarks,
  status: expense.status,
})

export const expenseRepository = {
  // 获取用户的所有费用记录（别名）
  async list(userId: string): Promise<ExpenseItem[]> {
    return this.getByUserId(userId)
  },

  // 根据 ID 获取费用记录
  async getById(userId: string, id: string): Promise<ExpenseItem | null> {
    const db = getDb()
    const result = await db.select().from(expenses)
      .where(and(eq(expenses.userId, userId), eq(expenses.id, id)))
      .limit(1)
    return result.length > 0 ? toExpenseItem(result[0]) : null
  },

  // 获取用户的所有费用记录
  async getByUserId(userId: string): Promise<ExpenseItem[]> {
    const db = getDb()
    const result = await db.select().from(expenses)
      .where(eq(expenses.userId, userId))
      .orderBy(desc(expenses.createdAt))
    return result.map(toExpenseItem)
  },

  // 按状态筛选费用记录
  async getByStatus(userId: string, status: ExpenseStatus): Promise<ExpenseItem[]> {
    const db = getDb()
    const result = await db.select().from(expenses)
      .where(and(eq(expenses.userId, userId), eq(expenses.status, status)))
      .orderBy(desc(expenses.createdAt))
    return result.map(toExpenseItem)
  },

  // 创建费用记录
  async create(expense: ExpenseItem): Promise<ExpenseItem> {
    const db = getDb()
    const result = await db.insert(expenses).values(toDbExpense(expense)).returning()
    return toExpenseItem(result[0])
  },

  // 更新费用记录
  async update(userId: string, id: string, data: Partial<ExpenseItem>): Promise<ExpenseItem | null> {
    const db = getDb()
    // 移除 createdAt/updatedAt 字符串，使用 Date 对象
    const { createdAt, updatedAt, ...restData } = data
    const updateData: Partial<typeof expenses.$inferInsert> = {
      ...restData,
      amount: data.amount?.toString(),
      updatedAt: new Date(),
    }
    // 移除 undefined 值
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData]
      }
    })
    
    const result = await db.update(expenses)
      .set(updateData)
      .where(and(eq(expenses.userId, userId), eq(expenses.id, id)))
      .returning()
    return result.length > 0 ? toExpenseItem(result[0]) : null
  },

  // 删除费用记录
  async delete(userId: string, id: string): Promise<ExpenseItem | null> {
    const db = getDb()
    const result = await db.delete(expenses)
      .where(and(eq(expenses.userId, userId), eq(expenses.id, id)))
      .returning()
    return result.length > 0 ? toExpenseItem(result[0]) : null
  },

  // 批量更新状态
  async updateStatus(userId: string, ids: string[], status: ExpenseStatus): Promise<number> {
    const db = getDb()
    let count = 0
    for (const id of ids) {
      const result = await db.update(expenses)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(expenses.userId, userId), eq(expenses.id, id)))
        .returning()
      if (result.length > 0) count++
    }
    return count
  },
}

