/**
 * 借款单数据访问层
 */

import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '../index'
import { loans, attachments } from '../schema'
import type { LoanRecord, ReportStatus, Attachment, BudgetProject, PaymentAccount, AppUser } from '../../../steps/reimbursement/types'

// 类型转换：数据库记录 -> 应用类型
const toLoanRecord = (
  record: typeof loans.$inferSelect,
  attachmentList: Attachment[] = []
): LoanRecord => ({
  id: record.id,
  userId: record.userId,
  amount: parseFloat(record.amount),
  reason: record.reason,
  date: record.date,
  approvalNumber: record.approvalNumber || undefined,
  status: record.status as ReportStatus,
  budgetProject: record.budgetProjectData as BudgetProject | undefined,
  attachments: attachmentList,
  paymentMethod: 'transfer',
  payeeInfo: record.payeeInfo as PaymentAccount,
  userSnapshot: record.userSnapshot as AppUser,
  createdAt: record.createdAt?.toISOString(),
  updatedAt: record.updatedAt?.toISOString(),
})

// 类型转换：应用类型 -> 数据库记录
const toDbLoan = (loan: LoanRecord): typeof loans.$inferInsert => ({
  id: loan.id,
  userId: loan.userId,
  amount: loan.amount.toString(),
  reason: loan.reason,
  date: loan.date,
  approvalNumber: loan.approvalNumber,
  status: loan.status,
  budgetProjectData: loan.budgetProject,
  paymentMethod: loan.paymentMethod,
  payeeInfo: loan.payeeInfo,
  userSnapshot: loan.userSnapshot,
})

export const loanRepository = {
  // 获取用户的所有借款单（别名）
  async list(userId: string): Promise<LoanRecord[]> {
    return this.getByUserId(userId)
  },

  // 根据 ID 获取借款单
  async getById(userId: string, id: string): Promise<LoanRecord | null> {
    const db = getDb()
    const result = await db.select().from(loans)
      .where(and(eq(loans.userId, userId), eq(loans.id, id)))
      .limit(1)
    
    if (result.length === 0) return null

    // 获取附件
    const attachmentResult = await db.select().from(attachments)
      .where(eq(attachments.loanId, id))
    
    const attachmentList: Attachment[] = attachmentResult.map(att => ({
      type: att.type as Attachment['type'],
      data: att.data,
      name: att.name || undefined,
    }))

    return toLoanRecord(result[0], attachmentList)
  },

  // 获取用户的所有借款单
  async getByUserId(userId: string): Promise<LoanRecord[]> {
    const db = getDb()
    const result = await db.select().from(loans)
      .where(eq(loans.userId, userId))
      .orderBy(desc(loans.createdAt))
    
    const loanList: LoanRecord[] = []
    for (const record of result) {
      const attachmentResult = await db.select().from(attachments)
        .where(eq(attachments.loanId, record.id))
      
      const attachmentList: Attachment[] = attachmentResult.map(att => ({
        type: att.type as Attachment['type'],
        data: att.data,
        name: att.name || undefined,
      }))

      loanList.push(toLoanRecord(record, attachmentList))
    }
    
    return loanList
  },

  // 按状态筛选借款单
  async getByStatus(userId: string, status: ReportStatus): Promise<LoanRecord[]> {
    const db = getDb()
    const result = await db.select().from(loans)
      .where(and(eq(loans.userId, userId), eq(loans.status, status)))
      .orderBy(desc(loans.createdAt))
    
    return result.map(record => toLoanRecord(record, []))
  },

  // 创建借款单
  async create(loan: LoanRecord): Promise<LoanRecord> {
    const db = getDb()
    
    // 插入借款单主记录
    const result = await db.insert(loans).values(toDbLoan(loan)).returning()

    // 插入附件
    if (loan.attachments && loan.attachments.length > 0) {
      const attachmentsToInsert = loan.attachments.map((att, index) => ({
        id: `${loan.id}_att_${index}`,
        loanId: loan.id,
        type: att.type,
        data: att.data,
        name: att.name,
      }))
      await db.insert(attachments).values(attachmentsToInsert)
    }

    return toLoanRecord(result[0], loan.attachments)
  },

  // 更新借款单
  async update(userId: string, id: string, data: Partial<LoanRecord>): Promise<LoanRecord | null> {
    const db = getDb()
    
    const updateData: Partial<typeof loans.$inferInsert> = {
      amount: data.amount?.toString(),
      reason: data.reason,
      date: data.date,
      approvalNumber: data.approvalNumber,
      status: data.status,
      budgetProjectData: data.budgetProject,
      payeeInfo: data.payeeInfo,
      updatedAt: new Date(),
    }
    
    // 移除 undefined 值
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData]
      }
    })

    const result = await db.update(loans)
      .set(updateData)
      .where(and(eq(loans.userId, userId), eq(loans.id, id)))
      .returning()
    
    if (result.length === 0) return null
    
    return this.getById(userId, id)
  },

  // 更新借款单状态
  async updateStatus(userId: string, id: string, status: ReportStatus): Promise<LoanRecord | null> {
    const db = getDb()
    const result = await db.update(loans)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(loans.userId, userId), eq(loans.id, id)))
      .returning()
    
    if (result.length === 0) return null
    return this.getById(userId, id)
  },

  // 删除借款单
  async delete(userId: string, id: string): Promise<LoanRecord | null> {
    const db = getDb()
    
    // 先获取要删除的借款单
    const loan = await this.getById(userId, id)
    if (!loan) return null

    // 删除附件
    await db.delete(attachments).where(eq(attachments.loanId, id))
    
    // 删除借款单
    await db.delete(loans)
      .where(and(eq(loans.userId, userId), eq(loans.id, id)))
    
    return loan
  },
}

