/**
 * 报销单数据访问层
 */

import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '../index'
import { reports, reportItems, attachments } from '../schema'
import type { Report, ReportStatus, ExpenseItem, Attachment, BudgetProject, PaymentAccount, AppUser, TripLeg, TaxiDetail } from '../../../steps/reimbursement/types'

// 类型转换：数据库记录 -> 应用类型
const toReport = (
  record: typeof reports.$inferSelect,
  items: ExpenseItem[] = [],
  attachmentList: Attachment[] = []
): Report => ({
  id: record.id,
  userId: record.userId,
  title: record.title,
  createdDate: record.createdDate,
  status: record.status as ReportStatus,
  totalAmount: parseFloat(record.totalAmount),
  prepaidAmount: parseFloat(record.prepaidAmount || '0'),
  payableAmount: parseFloat(record.payableAmount),
  items,
  approvalNumber: record.approvalNumber || undefined,
  budgetProject: record.budgetProjectData as BudgetProject | undefined,
  paymentAccount: record.paymentAccountData as PaymentAccount | undefined,
  attachments: attachmentList,
  userSnapshot: record.userSnapshot as AppUser,
  invoiceCount: record.invoiceCount || undefined,
  isTravel: record.isTravel || undefined,
  tripReason: record.tripReason || undefined,
  tripLegs: record.tripLegs as TripLeg[] | undefined,
  taxiDetails: record.taxiDetails as TaxiDetail[] | undefined,
  createdAt: record.createdAt?.toISOString(),
  updatedAt: record.updatedAt?.toISOString(),
})

// 类型转换：应用类型 -> 数据库记录
const toDbReport = (report: Report): typeof reports.$inferInsert => ({
  id: report.id,
  userId: report.userId,
  title: report.title,
  createdDate: report.createdDate,
  status: report.status,
  totalAmount: report.totalAmount.toString(),
  prepaidAmount: report.prepaidAmount.toString(),
  payableAmount: report.payableAmount.toString(),
  approvalNumber: report.approvalNumber,
  budgetProjectData: report.budgetProject,
  paymentAccountData: report.paymentAccount,
  userSnapshot: report.userSnapshot,
  invoiceCount: report.invoiceCount,
  isTravel: report.isTravel,
  tripReason: report.tripReason,
  tripLegs: report.tripLegs,
  taxiDetails: report.taxiDetails,
})

export const reportRepository = {
  // 获取用户的所有报销单（别名）
  async list(userId: string): Promise<Report[]> {
    return this.getByUserId(userId)
  },

  // 根据 ID 获取报销单（含关联数据）
  async getById(userId: string, id: string): Promise<Report | null> {
    const db = getDb()
    const reportResult = await db.select().from(reports)
      .where(and(eq(reports.userId, userId), eq(reports.id, id)))
      .limit(1)
    
    if (reportResult.length === 0) return null

    // 获取关联的费用项
    const itemsResult = await db.select().from(reportItems)
      .where(eq(reportItems.reportId, id))
    
    const items: ExpenseItem[] = itemsResult.map(item => ({
      id: item.id,
      userId: userId,
      amount: parseFloat(item.amount),
      description: item.description,
      date: item.date,
      category: item.category || '',
      status: 'processing' as const,
      budgetProject: item.budgetProjectData as BudgetProject | undefined,
    }))

    // 获取附件
    const attachmentResult = await db.select().from(attachments)
      .where(eq(attachments.reportId, id))
    
    const attachmentList: Attachment[] = attachmentResult.map(att => ({
      type: att.type as Attachment['type'],
      data: att.data,
      name: att.name || undefined,
    }))

    return toReport(reportResult[0], items, attachmentList)
  },

  // 获取用户的所有报销单
  async getByUserId(userId: string): Promise<Report[]> {
    const db = getDb()
    const result = await db.select().from(reports)
      .where(eq(reports.userId, userId))
      .orderBy(desc(reports.createdAt))
    
    // 批量获取所有报销单的关联数据
    const reportList: Report[] = []
    for (const record of result) {
      const itemsResult = await db.select().from(reportItems)
        .where(eq(reportItems.reportId, record.id))
      
      const items: ExpenseItem[] = itemsResult.map(item => ({
        id: item.id,
        userId: userId,
        amount: parseFloat(item.amount),
        description: item.description,
        date: item.date,
        category: item.category || '',
        status: 'processing' as const,
        budgetProject: item.budgetProjectData as BudgetProject | undefined,
      }))

      const attachmentResult = await db.select().from(attachments)
        .where(eq(attachments.reportId, record.id))
      
      const attachmentList: Attachment[] = attachmentResult.map(att => ({
        type: att.type as Attachment['type'],
        data: att.data,
        name: att.name || undefined,
      }))

      reportList.push(toReport(record, items, attachmentList))
    }
    
    return reportList
  },

  // 按状态筛选报销单
  async getByStatus(userId: string, status: ReportStatus): Promise<Report[]> {
    const db = getDb()
    const result = await db.select().from(reports)
      .where(and(eq(reports.userId, userId), eq(reports.status, status)))
      .orderBy(desc(reports.createdAt))
    
    return result.map(record => toReport(record, [], []))
  },

  // 创建报销单
  async create(report: Report): Promise<Report> {
    const db = getDb()
    
    // 插入报销单主记录
    const reportResult = await db.insert(reports).values(toDbReport(report)).returning()
    
    // 插入关联的费用项
    if (report.items && report.items.length > 0) {
      const itemsToInsert = report.items.map((item, index) => ({
        id: `${report.id}_item_${index}`,
        reportId: report.id,
        expenseId: item.id,
        amount: item.amount.toString(),
        description: item.description,
        date: item.date,
        category: item.category,
        budgetProjectData: (item as any).budgetProject,
      }))
      await db.insert(reportItems).values(itemsToInsert)
    }

    // 插入附件
    if (report.attachments && report.attachments.length > 0) {
      const attachmentsToInsert = report.attachments.map((att, index) => ({
        id: `${report.id}_att_${index}`,
        reportId: report.id,
        type: att.type,
        data: att.data,
        name: att.name,
      }))
      await db.insert(attachments).values(attachmentsToInsert)
    }

    return toReport(reportResult[0], report.items, report.attachments)
  },

  // 更新报销单
  async update(userId: string, id: string, data: Partial<Report>): Promise<Report | null> {
    const db = getDb()
    
    const updateData: Partial<typeof reports.$inferInsert> = {
      title: data.title,
      status: data.status,
      totalAmount: data.totalAmount?.toString(),
      prepaidAmount: data.prepaidAmount?.toString(),
      payableAmount: data.payableAmount?.toString(),
      approvalNumber: data.approvalNumber,
      budgetProjectData: data.budgetProject,
      paymentAccountData: data.paymentAccount,
      invoiceCount: data.invoiceCount,
      isTravel: data.isTravel,
      tripReason: data.tripReason,
      tripLegs: data.tripLegs,
      taxiDetails: data.taxiDetails,
      updatedAt: new Date(),
    }
    
    // 移除 undefined 值
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData]
      }
    })

    const result = await db.update(reports)
      .set(updateData)
      .where(and(eq(reports.userId, userId), eq(reports.id, id)))
      .returning()
    
    if (result.length === 0) return null
    
    return this.getById(userId, id)
  },

  // 更新报销单状态
  async updateStatus(userId: string, id: string, status: ReportStatus): Promise<Report | null> {
    const db = getDb()
    const result = await db.update(reports)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(reports.userId, userId), eq(reports.id, id)))
      .returning()
    
    if (result.length === 0) return null
    return this.getById(userId, id)
  },

  // 删除报销单
  async delete(userId: string, id: string): Promise<Report | null> {
    const db = getDb()
    
    // 先获取要删除的报销单
    const report = await this.getById(userId, id)
    if (!report) return null

    // 删除关联的费用项
    await db.delete(reportItems).where(eq(reportItems.reportId, id))
    
    // 删除附件
    await db.delete(attachments).where(eq(attachments.reportId, id))
    
    // 删除报销单
    await db.delete(reports)
      .where(and(eq(reports.userId, userId), eq(reports.id, id)))
    
    return report
  },
}

