/**
 * 数据库表结构定义
 * 使用 Drizzle ORM 定义 PostgreSQL 表结构
 */

import { pgTable, text, timestamp, boolean, numeric, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ==================== 枚举类型 ====================

// 费用状态枚举
export const expenseStatusEnum = pgEnum('expense_status', ['pending', 'processing', 'done'])

// 报销单/借款状态枚举
export const reportStatusEnum = pgEnum('report_status', ['draft', 'submitted', 'paid'])

// 用户角色枚举
export const userRoleEnum = pgEnum('user_role', ['admin', 'user'])

// 附件类型枚举
export const attachmentTypeEnum = pgEnum('attachment_type', ['invoice', 'approval', 'voucher', 'other'])

// AI 厂商枚举
export const aiProviderEnum = pgEnum('ai_provider', [
  'gemini', 'deepseek', 'minimax', 'glm', 'openai', 
  'claude', 'qwen', 'moonshot', 'doubao', 'volcengine'
])

// ==================== 用户表 ====================

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  department: text('department').notNull(),
  email: text('email').notNull().unique(),
  role: userRoleEnum('role').notNull().default('user'),
  password: text('password'),
  isCurrent: boolean('is_current').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ==================== 收款账户表 ====================

export const paymentAccounts = pgTable('payment_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bankName: text('bank_name').notNull(),
  bankBranch: text('bank_branch'),
  accountNumber: text('account_number').notNull(),
  accountName: text('account_name').notNull(),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ==================== 预算项目表 ====================

export const budgetProjects = pgTable('budget_projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: text('code').notNull(),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ==================== 费用记录表（记账本）====================

export const expenses = pgTable('expenses', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description').notNull(),
  date: text('date').notNull(), // ISO String
  category: text('category').notNull(),
  remarks: text('remarks'),
  status: expenseStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ==================== 报销单表 ====================

export const reports = pgTable('reports', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  createdDate: text('created_date').notNull(),
  status: reportStatusEnum('status').notNull().default('draft'),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  prepaidAmount: numeric('prepaid_amount', { precision: 12, scale: 2 }).default('0'),
  payableAmount: numeric('payable_amount', { precision: 12, scale: 2 }).notNull(),
  approvalNumber: text('approval_number'),
  budgetProjectId: text('budget_project_id'),
  budgetProjectData: jsonb('budget_project_data'), // 存储 BudgetProject 快照
  paymentAccountId: text('payment_account_id'),
  paymentAccountData: jsonb('payment_account_data'), // 存储 PaymentAccount 快照
  userSnapshot: jsonb('user_snapshot').notNull(), // 存储 AppUser 快照
  invoiceCount: integer('invoice_count'),
  // 差旅相关
  isTravel: boolean('is_travel').default(false),
  tripReason: text('trip_reason'),
  tripLegs: jsonb('trip_legs'), // 存储 TripLeg[] 数组
  taxiDetails: jsonb('taxi_details'), // 存储 TaxiDetail[] 数组
  // AI 识别数据
  aiRecognitionData: jsonb('ai_recognition_data'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ==================== 报销单关联费用项表 ====================

export const reportItems = pgTable('report_items', {
  id: text('id').primaryKey(),
  reportId: text('report_id').notNull().references(() => reports.id, { onDelete: 'cascade' }),
  expenseId: text('expense_id'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description').notNull(),
  date: text('date').notNull(),
  category: text('category'),
  budgetProjectData: jsonb('budget_project_data'), // 每个项目可能有不同的预算项目
  createdAt: timestamp('created_at').defaultNow(),
})

// ==================== 附件表 ====================

export const attachments = pgTable('attachments', {
  id: text('id').primaryKey(),
  reportId: text('report_id').references(() => reports.id, { onDelete: 'cascade' }),
  loanId: text('loan_id').references(() => loans.id, { onDelete: 'cascade' }),
  type: attachmentTypeEnum('type').notNull(),
  data: text('data').notNull(), // base64 image
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow(),
})

// ==================== 借款单表 ====================

export const loans = pgTable('loans', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  date: text('date').notNull(),
  approvalNumber: text('approval_number'),
  status: reportStatusEnum('status').notNull().default('draft'),
  budgetProjectId: text('budget_project_id'),
  budgetProjectData: jsonb('budget_project_data'),
  paymentMethod: text('payment_method').default('transfer'),
  payeeInfo: jsonb('payee_info').notNull(), // PaymentAccount 快照
  userSnapshot: jsonb('user_snapshot').notNull(), // AppUser 快照
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ==================== AI 配置表 ====================

export const aiConfigs = pgTable('ai_configs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: aiProviderEnum('provider').notNull(),
  apiKey: text('api_key').notNull(),
  apiUrl: text('api_url'),
  model: text('model'),
  isActive: boolean('is_active').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ==================== Token 使用记录表 ====================

export const tokenUsage = pgTable('token_usage', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  totalTokens: integer('total_tokens').notNull(),
  inputCost: numeric('input_cost', { precision: 12, scale: 6 }).notNull(),
  outputCost: numeric('output_cost', { precision: 12, scale: 6 }).notNull(),
  totalCost: numeric('total_cost', { precision: 12, scale: 6 }).notNull(),
  cached: boolean('cached').default(false),
  operation: text('operation'),
  createdAt: timestamp('created_at').defaultNow(),
})

// ==================== 表关系定义 ====================

export const usersRelations = relations(users, ({ many }) => ({
  paymentAccounts: many(paymentAccounts),
  budgetProjects: many(budgetProjects),
  expenses: many(expenses),
  reports: many(reports),
  loans: many(loans),
  aiConfigs: many(aiConfigs),
  tokenUsage: many(tokenUsage),
}))

export const paymentAccountsRelations = relations(paymentAccounts, ({ one }) => ({
  user: one(users, {
    fields: [paymentAccounts.userId],
    references: [users.id],
  }),
}))

export const budgetProjectsRelations = relations(budgetProjects, ({ one }) => ({
  user: one(users, {
    fields: [budgetProjects.userId],
    references: [users.id],
  }),
}))

export const expensesRelations = relations(expenses, ({ one }) => ({
  user: one(users, {
    fields: [expenses.userId],
    references: [users.id],
  }),
}))

export const reportsRelations = relations(reports, ({ one, many }) => ({
  user: one(users, {
    fields: [reports.userId],
    references: [users.id],
  }),
  items: many(reportItems),
  attachments: many(attachments),
}))

export const reportItemsRelations = relations(reportItems, ({ one }) => ({
  report: one(reports, {
    fields: [reportItems.reportId],
    references: [reports.id],
  }),
}))

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  report: one(reports, {
    fields: [attachments.reportId],
    references: [reports.id],
  }),
  loan: one(loans, {
    fields: [attachments.loanId],
    references: [loans.id],
  }),
}))

export const loansRelations = relations(loans, ({ one, many }) => ({
  user: one(users, {
    fields: [loans.userId],
    references: [users.id],
  }),
  attachments: many(attachments),
}))

export const aiConfigsRelations = relations(aiConfigs, ({ one }) => ({
  user: one(users, {
    fields: [aiConfigs.userId],
    references: [users.id],
  }),
}))

export const tokenUsageRelations = relations(tokenUsage, ({ one }) => ({
  user: one(users, {
    fields: [tokenUsage.userId],
    references: [users.id],
  }),
}))







