/**
 * 报销系统 - 共享类型定义
 * 
 * 这个文件定义了报销系统中所有数据的结构
 */

import { z } from 'zod'

// ==================== 状态类型 ====================

/** 费用状态：待报销 | 报销中 | 已报销 */
export const ExpenseStatusSchema = z.enum(['pending', 'processing', 'done'])
export type ExpenseStatus = z.infer<typeof ExpenseStatusSchema>

/** 报销单/借款状态：草稿 | 已提交 | 已打款 */
export const ReportStatusSchema = z.enum(['draft', 'submitted', 'paid'])
export type ReportStatus = z.infer<typeof ReportStatusSchema>

/** 用户角色 */
export const UserRoleSchema = z.enum(['admin', 'user'])
export type UserRole = z.infer<typeof UserRoleSchema>

// ==================== 用户相关 ====================

/** 用户 */
export const AppUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  department: z.string(),
  email: z.string(), // 允许任意字符串，不强制邮箱格式
  role: UserRoleSchema,
  password: z.string().optional(), // 存储时加密
  isCurrent: z.boolean().optional(),
})
export type AppUser = z.infer<typeof AppUserSchema>

/** 收款账户 */
export const PaymentAccountSchema = z.object({
  id: z.string(),
  bankName: z.string(),
  bankBranch: z.string().optional(),
  accountNumber: z.string(),
  accountName: z.string(),
  isDefault: z.boolean(),
})
export type PaymentAccount = z.infer<typeof PaymentAccountSchema>

/** 预算项目 */
export const BudgetProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  isDefault: z.boolean().optional(),
})
export type BudgetProject = z.infer<typeof BudgetProjectSchema>

/** 用户设置 */
export const UserSettingsSchema = z.object({
  currentUser: AppUserSchema,
  users: z.array(AppUserSchema),
  budgetProjects: z.array(BudgetProjectSchema),
  paymentAccounts: z.array(PaymentAccountSchema),
})
export type UserSettings = z.infer<typeof UserSettingsSchema>

// ==================== 费用记录 ====================

/** 费用项（记账本中的一条记录）*/
export const ExpenseItemSchema = z.object({
  id: z.string(),
  userId: z.string(), // 所属用户
  amount: z.number(),
  description: z.string(),
  date: z.string(), // ISO String
  category: z.string(),
  remarks: z.string().optional(),
  status: ExpenseStatusSchema,
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export type ExpenseItem = z.infer<typeof ExpenseItemSchema>

// ==================== 附件 ====================

/** 附件类型 */
export const AttachmentTypeSchema = z.enum([
  'invoice',      // 发票
  'approval',     // 审批单
  'voucher',      // 凭证
  'other',        // 其他
  'ticket',       // 火车票/机票
  'hotel',        // 住宿发票
  'taxi-invoice', // 打车发票
  'taxi-trip',    // 打车行程单
])

/** 附件 */
export const AttachmentSchema = z.object({
  type: AttachmentTypeSchema,
  data: z.string(), // base64 image
  name: z.string().optional(),
})
export type Attachment = z.infer<typeof AttachmentSchema>

// ==================== 差旅相关 ====================

/** 打车明细 */
export const TaxiDetailSchema = z.object({
  date: z.string(),
  reason: z.string(),
  route: z.string(),         // 行程路线，如 "酒店-机场"
  startPoint: z.string(),    // 起点
  endPoint: z.string(),      // 终点
  amount: z.number(),
  employeeName: z.string(),
})
export type TaxiDetail = z.infer<typeof TaxiDetailSchema>

/** 行程段 */
export const TripLegSchema = z.object({
  dateRange: z.string(), // 如 2023.7.29-8.1
  route: z.string(), // 如 北京-成都
  transportFee: z.number(),
  hotelLocation: z.string(),
  hotelDays: z.number(),
  hotelFee: z.number(),
  cityTrafficFee: z.number(),
  mealFee: z.number(),
  otherFee: z.number(),
  subTotal: z.number(),
})
export type TripLeg = z.infer<typeof TripLegSchema>

// ==================== 报销单 ====================

/** 报销单 */
export const ReportSchema = z.object({
  id: z.string(),
  userId: z.string(), // 所属用户
  title: z.string(), // "发票内容(事项)"
  createdDate: z.string(),
  status: ReportStatusSchema,
  totalAmount: z.number(),
  prepaidAmount: z.number(), // 预支借款抵扣
  payableAmount: z.number(),
  items: z.array(ExpenseItemSchema), // 关联的费用项
  approvalNumber: z.string().optional(),
  budgetProject: BudgetProjectSchema.optional(),
  paymentAccount: PaymentAccountSchema.optional(),
  attachments: z.array(AttachmentSchema),
  userSnapshot: AppUserSchema,
  invoiceCount: z.number().optional(),
  // 差旅相关
  isTravel: z.boolean().optional(),
  tripReason: z.string().optional(),
  tripLegs: z.array(TripLegSchema).optional(),
  taxiDetails: z.array(TaxiDetailSchema).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export type Report = z.infer<typeof ReportSchema>

// ==================== 借款单 ====================

/** 借款记录 */
export const LoanRecordSchema = z.object({
  id: z.string(),
  userId: z.string(), // 所属用户
  amount: z.number(),
  reason: z.string(), // 最多20字
  date: z.string(), // 申请日期
  approvalNumber: z.string().optional(),
  status: ReportStatusSchema,
  budgetProject: BudgetProjectSchema.optional(),
  attachments: z.array(AttachmentSchema),
  paymentMethod: z.literal('transfer'),
  payeeInfo: PaymentAccountSchema,
  userSnapshot: AppUserSchema,
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export type LoanRecord = z.infer<typeof LoanRecordSchema>

// ==================== AI 识别相关 ====================

/** AI 识别请求 */
export const AIRecognizeRequestSchema = z.object({
  images: z.array(z.string()), // base64 图片数组
  type: z.enum(['invoice', 'approval', 'travel']),
})
export type AIRecognizeRequest = z.infer<typeof AIRecognizeRequestSchema>

/** AI 识别结果 */
export const AIRecognizeResultSchema = z.object({
  title: z.string().optional(),
  approvalNumber: z.string().optional(),
  loanAmount: z.number().optional(),
  items: z.array(z.object({
    date: z.string(),
    description: z.string(),
    amount: z.number(),
  })).optional(),
  // 差旅相关
  tripReason: z.string().optional(),
  tripLegs: z.array(TripLegSchema).optional(),
})
export type AIRecognizeResult = z.infer<typeof AIRecognizeResultSchema>

// ==================== 统计相关 ====================

/** 统计概览 */
export const StatisticsOverviewSchema = z.object({
  totalPending: z.number(), // 待报销总额
  activeLoanAmount: z.number(), // 借款金额
  totalReceivable: z.number(), // 预计收款总额
  submittedReportsAmount: z.number(), // 已提交报销金额
  pendingExpensesAmount: z.number(), // 待处理费用金额
  monthlyData: z.array(z.object({
    month: z.string(),
    amount: z.number(),
  })),
})
export type StatisticsOverview = z.infer<typeof StatisticsOverviewSchema>

// ==================== 通用响应 ====================

/** 错误响应 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>

/** 成功响应 */
export const SuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
})
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>

// ==================== AI 模型配置 ====================

/** 支持的 AI 模型厂商 */
export const AIProviderSchema = z.enum([
  'gemini',    // Google Gemini
  'deepseek',  // DeepSeek
  'minimax',   // MiniMax
  'glm',       // 智谱 GLM
  'openai',    // OpenAI
  'claude',    // Anthropic Claude
  'qwen',      // 阿里通义千问
  'moonshot',  // Moonshot / Kimi
  'doubao',    // 火山引擎豆包
  'volcengine', // 火山引擎（别名）
])
export type AIProvider = z.infer<typeof AIProviderSchema>

/** AI 配置 */
export const AIConfigSchema = z.object({
  id: z.string(),
  userId: z.string(),
  provider: AIProviderSchema,
  apiKey: z.string(),
  apiUrl: z.string().optional(), // 自定义 API 地址
  model: z.string().optional(), // 模型名称
  isActive: z.boolean().default(false), // 是否启用
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export type AIConfig = z.infer<typeof AIConfigSchema>

/** AI 厂商信息 */
export const AI_PROVIDERS_INFO = {
  gemini: {
    name: 'Google Gemini',
    defaultUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    keyUrl: 'https://makersuite.google.com/app/apikey',
    description: 'Google 的多模态 AI 模型，支持图像识别',
  },
  deepseek: {
    name: 'DeepSeek',
    defaultUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    description: '高性价比的国产大模型，支持多种任务',
  },
  minimax: {
    name: 'MiniMax',
    defaultUrl: 'https://api.minimax.chat/v1',
    defaultModel: 'abab6.5-chat',
    keyUrl: 'https://api.minimax.chat/',
    description: 'MiniMax 大模型，支持多模态',
  },
  glm: {
    name: '智谱 GLM',
    defaultUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4v',
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    description: '智谱清言 GLM 模型，支持图像理解',
  },
  openai: {
    name: 'OpenAI',
    defaultUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4-vision-preview',
    keyUrl: 'https://platform.openai.com/api-keys',
    description: 'OpenAI GPT 系列模型，支持视觉理解',
  },
  claude: {
    name: 'Anthropic Claude',
    defaultUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-opus-20240229',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    description: 'Anthropic Claude 模型，支持多模态',
  },
  qwen: {
    name: '通义千问',
    defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-vl-max',
    keyUrl: 'https://dashscope.console.aliyun.com/apiKey',
    description: '阿里通义千问，支持视觉理解',
  },
  moonshot: {
    name: 'Moonshot / Kimi',
    defaultUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-128k',
    keyUrl: 'https://platform.moonshot.cn/console/api-keys',
    description: '月之暗面 Kimi，支持超长上下文',
  },
  doubao: {
    name: '火山引擎 (豆包)',
    defaultUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-seed-1.6-vision',
    keyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    description: '字节跳动豆包大模型，支持图像识别，需配合 Endpoint ID 使用',
  },
  volcengine: {
    name: '火山引擎',
    defaultUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-seed-1.6-vision',
    keyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    description: '字节跳动火山引擎，支持图像识别，需配合 Endpoint ID 使用',
  },
} as const

// ==================== Token 使用记录 ====================

/** Token 使用记录 Schema */
export const TokenUsageSchema = z.object({
  id: z.string(),
  userId: z.string(),
  provider: z.string(), // 模型厂商
  model: z.string(),    // 模型名称
  inputTokens: z.number(), // 输入 tokens
  outputTokens: z.number(), // 输出 tokens
  totalTokens: z.number(),  // 总 tokens
  inputCost: z.number(),    // 输入费用（元）
  outputCost: z.number(),   // 输出费用（元）
  totalCost: z.number(),    // 总费用（元）
  cached: z.boolean().optional(), // 是否缓存命中
  operation: z.string().optional(), // 操作类型（如：发票识别、审批单识别）
  createdAt: z.string(),
})
export type TokenUsage = z.infer<typeof TokenUsageSchema>

/** Token 使用统计 Schema */
export const TokenStatsSchema = z.object({
  totalTokens: z.number(),
  totalCost: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  inputCost: z.number(),
  outputCost: z.number(),
  usageCount: z.number(), // 调用次数
  byProvider: z.record(z.string(), z.object({
    provider: z.string(),
    providerName: z.string(),
    totalTokens: z.number(),
    totalCost: z.number(),
    usageCount: z.number(),
  })),
})
export type TokenStats = z.infer<typeof TokenStatsSchema>

// ==================== State 存储的 key 常量 ====================

/** State 存储分组 */
export const STATE_GROUPS = {
  USERS: 'users',
  EXPENSES: 'expenses',
  REPORTS: 'reports',
  LOANS: 'loans',
  PAYMENT_ACCOUNTS: 'payment_accounts',
  BUDGET_PROJECTS: 'budget_projects',
  SETTINGS: 'settings',
  AI_CONFIGS: 'ai_configs',
  TOKEN_USAGE: 'token_usage', // token 使用记录
} as const

