/**
 * API 客户端
 * 
 * 封装所有后端 API 调用
 * 通俗解释：这个文件就像一个"翻译官"，帮助前端和后端沟通
 */

// API 基础地址
// 开发模式：使用 Vite 代理 (空字符串)
// 生产模式：可配置为实际后端地址
const API_BASE_URL = ''

/**
 * 通用请求函数
 * 
 * @param path API 路径，如 '/api/auth/login'
 * @param options 请求选项
 * @returns 响应数据
 */
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || data.error || '请求失败')
  }

  return data
}

// ==================== 用户认证 API ====================

/**
 * 用户注册
 */
export async function register(params: {
  name: string
  email: string
  password: string
  department: string
}) {
  return request<{
    success: boolean
    user: any
    message?: string
  }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/**
 * 用户登录
 */
export async function login(params: {
  email: string
  password: string
}) {
  return request<{
    success: boolean
    user: any
    token: string
  }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ==================== 用户信息 API ====================

/**
 * 获取用户配置
 */
export async function getUserProfile(userId: string) {
  return request<{
    currentUser: any
    users: any[]
    paymentAccounts: any[]
    budgetProjects: any[]
  }>(`/api/user/profile?userId=${userId}`)
}

/**
 * 更新用户信息
 */
export async function updateUserProfile(params: {
  userId: string
  name?: string
  department?: string
  email?: string
  password?: string
}) {
  return request<{
    success: boolean
    user: any
  }>('/api/user/profile', {
    method: 'PUT',
    body: JSON.stringify(params),
  })
}

// ==================== 费用记账 API ====================

/**
 * 获取费用列表
 */
export async function getExpenses(userId: string, status?: string) {
  const url = `/api/expenses?userId=${userId}${status ? `&status=${status}` : ''}`
  return request<{
    expenses: any[]
    total: number
    summary: {
      totalAmount: number
      pendingAmount: number
      processingAmount: number
      doneAmount: number
    }
  }>(url)
}

/**
 * 创建费用记录
 */
export async function createExpense(params: {
  userId: string
  amount: number
  description: string
  date: string
  category: string
  remarks?: string
}) {
  return request<{
    success: boolean
    expense: any
  }>('/api/expenses', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/**
 * 更新费用记录
 */
export async function updateExpense(
  expenseId: string,
  params: {
    userId: string
    amount?: number
    description?: string
    date?: string
    category?: string
    remarks?: string
    status?: 'pending' | 'processing' | 'done'
  }
) {
  return request<{
    success: boolean
    expense: any
  }>(`/api/expenses/${expenseId}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  })
}

/**
 * 删除费用记录
 */
export async function deleteExpense(expenseId: string, userId: string) {
  return request<{
    success: boolean
    message?: string
  }>(`/api/expenses/${expenseId}?userId=${userId}`, {
    method: 'DELETE',
  })
}

// ==================== 报销单 API ====================

/**
 * 获取报销单列表
 */
export async function getReports(userId: string, status?: string) {
  const url = `/api/reports?userId=${userId}${status ? `&status=${status}` : ''}`
  return request<{
    reports: any[]
    total: number
  }>(url)
}

/**
 * 创建报销单
 */
export async function createReport(params: {
  userId: string
  title: string
  status?: 'draft' | 'submitted' | 'paid'
  totalAmount: number
  prepaidAmount?: number
  payableAmount: number
  items?: any[]
  approvalNumber?: string
  budgetProject?: any
  paymentAccount?: any
  attachments?: any[]
  userSnapshot: any
  invoiceCount?: number
  isTravel?: boolean
  tripReason?: string
  tripLegs?: any[]
  taxiDetails?: any[]
}) {
  return request<{
    success: boolean
    report: any
  }>('/api/reports', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/**
 * 获取报销单详情
 */
export async function getReportDetail(reportId: string, userId: string) {
  return request<any>(`/api/reports/${reportId}?userId=${userId}`)
}

/**
 * 更新报销单
 */
export async function updateReport(reportId: string, params: any) {
  return request<{
    success: boolean
    report: any
  }>(`/api/reports/${reportId}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  })
}

/**
 * 更新报销单状态
 */
export async function updateReportStatus(
  reportId: string,
  params: {
    userId: string
    status: 'draft' | 'submitted' | 'paid'
  }
) {
  return request<{
    success: boolean
    report: any
  }>(`/api/reports/${reportId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  })
}

// ==================== 借款 API ====================

/**
 * 获取借款列表
 */
export async function getLoans(userId: string, status?: string) {
  const url = `/api/loans?userId=${userId}${status ? `&status=${status}` : ''}`
  return request<{
    loans: any[]
    total: number
  }>(url)
}

/**
 * 创建借款申请
 */
export async function createLoan(params: {
  userId: string
  amount: number
  reason: string
  date: string
  status?: 'draft' | 'submitted' | 'paid'
  approvalNumber?: string
  budgetProject?: any
  attachments?: any[]
  payeeInfo: any
  userSnapshot: any
}) {
  return request<{
    success: boolean
    loan: any
  }>('/api/loans', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/**
 * 获取借款详情
 */
export async function getLoanDetail(loanId: string, userId: string) {
  return request<any>(`/api/loans/${loanId}?userId=${userId}`)
}

/**
 * 更新借款状态
 */
export async function updateLoanStatus(
  loanId: string,
  params: {
    userId: string
    status: 'draft' | 'submitted' | 'paid'
  }
) {
  return request<{
    success: boolean
    loan: any
  }>(`/api/loans/${loanId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  })
}

// ==================== 收款人设置 API ====================

/**
 * 获取收款人列表
 */
export async function getPayees(userId: string) {
  return request<{
    paymentAccounts: any[]
    total: number
  }>(`/api/settings/payees?userId=${userId}`)
}

/**
 * 创建收款人
 */
export async function createPayee(params: {
  userId: string
  bankName: string
  bankBranch?: string
  accountNumber: string
  accountName: string
  isDefault?: boolean
}) {
  return request<{
    success: boolean
    paymentAccount: any
  }>('/api/settings/payees', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/**
 * 更新收款人
 */
export async function updatePayee(payeeId: string, params: any) {
  return request<{
    success: boolean
    paymentAccount: any
  }>(`/api/settings/payees/${payeeId}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  })
}

/**
 * 删除收款人
 */
export async function deletePayee(payeeId: string, userId: string) {
  return request<{
    success: boolean
    message?: string
  }>(`/api/settings/payees/${payeeId}?userId=${userId}`, {
    method: 'DELETE',
  })
}

// ==================== 预算项目设置 API ====================

/**
 * 获取预算项目列表
 */
export async function getProjects(userId: string) {
  return request<{
    budgetProjects: any[]
    total: number
  }>(`/api/settings/projects?userId=${userId}`)
}

/**
 * 创建预算项目
 */
export async function createProject(params: {
  userId: string
  name: string
  code: string
  isDefault?: boolean
}) {
  return request<{
    success: boolean
    budgetProject: any
  }>('/api/settings/projects', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/**
 * 更新预算项目
 */
export async function updateProject(projectId: string, params: any) {
  return request<{
    success: boolean
    budgetProject: any
  }>(`/api/settings/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  })
}

/**
 * 删除预算项目
 */
export async function deleteProject(projectId: string, userId: string) {
  return request<{
    success: boolean
    message?: string
  }>(`/api/settings/projects/${projectId}?userId=${userId}`, {
    method: 'DELETE',
  })
}

// ==================== AI 识别 API ====================

/**
 * AI 识别发票/审批单
 */
export async function aiRecognize(params: {
  images: string[]
  type: 'invoice' | 'approval' | 'travel'
  userId: string
}) {
  return request<{
    success: boolean
    result: {
      title?: string
      approvalNumber?: string
      loanAmount?: number
      items?: Array<{
        date: string
        description: string
        amount: number
      }>
      tripReason?: string
      tripLegs?: any[]
    }
  }>('/api/ai/recognize', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ==================== 统计 API ====================

/**
 * 获取统计概览
 */
export async function getStatisticsOverview(userId: string, period: '3m' | '6m' | '1y' = '6m') {
  return request<{
    totalPending: number
    activeLoanAmount: number
    totalReceivable: number
    submittedReportsAmount: number
    pendingExpensesAmount: number
    monthlyData: Array<{
      month: string
      amount: number
    }>
  }>(`/api/statistics/overview?userId=${userId}&period=${period}`)
}

// ==================== AI 配置 API ====================

/**
 * AI 配置类型
 */
export interface AIConfigType {
  id: string
  provider: 'gemini' | 'deepseek' | 'minimax' | 'glm' | 'openai' | 'claude' | 'qwen'
  name: string
  apiKey: string
  apiUrl?: string
  model?: string
  isDefault?: boolean
  createdAt?: string
  updatedAt?: string
}

/**
 * 获取用户的 AI 配置列表
 */
export async function getAIConfigs(userId: string) {
  return request<{
    configs: AIConfigType[]
    total: number
  }>(`/api/settings/ai-config?userId=${userId}`)
}

/**
 * 保存 AI 配置（创建或更新）
 */
export async function saveAIConfig(params: {
  userId: string
  id?: string
  provider: string
  name: string
  apiKey: string
  apiUrl?: string
  model?: string
  isDefault?: boolean
}) {
  return request<{
    success: boolean
    config: AIConfigType
  }>('/api/settings/ai-config', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/**
 * 删除 AI 配置
 */
export async function deleteAIConfig(configId: string, userId: string) {
  return request<{
    success: boolean
    message?: string
  }>(`/api/settings/ai-config/${configId}?userId=${userId}`, {
    method: 'DELETE',
  })
}

/**
 * 测试 AI 配置
 */
export async function testAIConfig(params: {
  userId: string
  provider: string
  apiKey: string
  apiUrl?: string
  model?: string
}) {
  return request<{
    success: boolean
    message?: string
    testResult?: {
      responseTime: number
      modelInfo?: string
    }
  }>('/api/settings/ai-config/test', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ==================== 导出所有 API ====================

export const api = {
  // 认证
  register,
  login,
  // 用户
  getUserProfile,
  updateUserProfile,
  // 费用
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  // 报销单
  getReports,
  createReport,
  getReportDetail,
  updateReport,
  updateReportStatus,
  // 借款
  getLoans,
  createLoan,
  getLoanDetail,
  updateLoanStatus,
  // 收款人
  getPayees,
  createPayee,
  updatePayee,
  deletePayee,
  // 预算项目
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  // AI 识别
  aiRecognize,
  // AI 配置
  getAIConfigs,
  saveAIConfig,
  deleteAIConfig,
  testAIConfig,
  // 统计
  getStatisticsOverview,
}

export default api

