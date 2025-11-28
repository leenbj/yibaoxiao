/**
 * 收款账户数据访问层
 */

import { eq, and } from 'drizzle-orm'
import { getDb } from '../index'
import { paymentAccounts } from '../schema'
import type { PaymentAccount } from '../../../steps/reimbursement/types'

// 类型转换：数据库记录 -> 应用类型
const toPaymentAccount = (record: typeof paymentAccounts.$inferSelect): PaymentAccount => ({
  id: record.id,
  bankName: record.bankName,
  bankBranch: record.bankBranch || undefined,
  accountNumber: record.accountNumber,
  accountName: record.accountName,
  isDefault: record.isDefault || false,
})

// 类型转换：应用类型 -> 数据库记录
const toDbPaymentAccount = (account: PaymentAccount, userId: string): typeof paymentAccounts.$inferInsert => ({
  id: account.id,
  userId,
  bankName: account.bankName,
  bankBranch: account.bankBranch,
  accountNumber: account.accountNumber,
  accountName: account.accountName,
  isDefault: account.isDefault,
})

export const paymentAccountRepository = {
  // 获取用户的所有收款账户（别名）
  async list(userId: string): Promise<PaymentAccount[]> {
    return this.getByUserId(userId)
  },

  // 根据 ID 获取收款账户
  async getById(userId: string, id: string): Promise<PaymentAccount | null> {
    const db = getDb()
    const result = await db.select().from(paymentAccounts)
      .where(and(eq(paymentAccounts.userId, userId), eq(paymentAccounts.id, id)))
      .limit(1)
    return result.length > 0 ? toPaymentAccount(result[0]) : null
  },

  // 获取用户的所有收款账户
  async getByUserId(userId: string): Promise<PaymentAccount[]> {
    const db = getDb()
    const result = await db.select().from(paymentAccounts)
      .where(eq(paymentAccounts.userId, userId))
    return result.map(toPaymentAccount)
  },

  // 获取默认收款账户
  async getDefault(userId: string): Promise<PaymentAccount | null> {
    const db = getDb()
    const result = await db.select().from(paymentAccounts)
      .where(and(eq(paymentAccounts.userId, userId), eq(paymentAccounts.isDefault, true)))
      .limit(1)
    return result.length > 0 ? toPaymentAccount(result[0]) : null
  },

  // 创建收款账户
  async create(userId: string, account: PaymentAccount): Promise<PaymentAccount> {
    const db = getDb()
    
    // 如果是默认账户，先清除其他默认
    if (account.isDefault) {
      await db.update(paymentAccounts)
        .set({ isDefault: false })
        .where(eq(paymentAccounts.userId, userId))
    }
    
    const result = await db.insert(paymentAccounts)
      .values(toDbPaymentAccount(account, userId))
      .returning()
    return toPaymentAccount(result[0])
  },

  // 更新收款账户
  async update(userId: string, id: string, data: Partial<PaymentAccount>): Promise<PaymentAccount | null> {
    const db = getDb()
    
    // 如果设置为默认，先清除其他默认
    if (data.isDefault) {
      await db.update(paymentAccounts)
        .set({ isDefault: false })
        .where(eq(paymentAccounts.userId, userId))
    }
    
    const updateData: Partial<typeof paymentAccounts.$inferInsert> = {
      ...data,
      updatedAt: new Date(),
    }
    
    const result = await db.update(paymentAccounts)
      .set(updateData)
      .where(and(eq(paymentAccounts.userId, userId), eq(paymentAccounts.id, id)))
      .returning()
    
    return result.length > 0 ? toPaymentAccount(result[0]) : null
  },

  // 删除收款账户
  async delete(userId: string, id: string): Promise<PaymentAccount | null> {
    const db = getDb()
    const result = await db.delete(paymentAccounts)
      .where(and(eq(paymentAccounts.userId, userId), eq(paymentAccounts.id, id)))
      .returning()
    return result.length > 0 ? toPaymentAccount(result[0]) : null
  },
}

