/**
 * Supabase API 客户端
 * 
 * 完全替换原有的 Motia API，使用 Supabase 直接操作数据库
 * 优势：
 * 1. 无需后端服务器，直接连接数据库
 * 2. 自动处理认证和权限（RLS）
 * 3. 实时数据同步
 * 4. 内置文件存储
 */

import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

// 类型定义
type Tables = Database['public']['Tables']
type Profile = Tables['profiles']['Row']
type Expense = Tables['expenses']['Row']
type Report = Tables['reports']['Row']
type ReportItem = Tables['report_items']['Row']
type Loan = Tables['loans']['Row']
type PaymentAccount = Tables['payment_accounts']['Row']
type BudgetProject = Tables['budget_projects']['Row']
type AIConfig = Tables['ai_configs']['Row']
type Attachment = Tables['attachments']['Row']

// ==================== 用户认证 API (使用 Supabase Auth) ====================

/**
 * 用户注册
 */
export async function register(params: {
  name: string
  email: string
  password: string
  department: string
}) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: {
        name: params.name,
        department: params.department,
      },
    },
  })

  if (authError) {
    throw new Error(authError.message)
  }

  // 检查用户是否创建成功
  if (!authData.user) {
    throw new Error('注册失败：无法创建用户')
  }

  // 如果邮箱需要验证，返回提示信息
  if (authData.user.identities && authData.user.identities.length === 0) {
    return {
      success: true,
      user: authData.user,
      message: '注册成功，请检查邮箱完成验证',
      requiresEmailConfirmation: true,
    }
  }

  // 等待 profile 触发器创建完成（最多等待3秒）
  let profile = null
  let retries = 0
  const maxRetries = 6

  while (!profile && retries < maxRetries) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (data) {
      profile = data
    } else {
      retries++
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  if (!profile) {
    console.warn('Profile 创建超时，可能触发器执行延迟')
  }

  return {
    success: true,
    user: authData.user,
    profile,
    message: '注册成功',
    requiresEmailConfirmation: false,
  }
}

/**
 * 用户登录
 */
export async function login(params: { email: string; password: string }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: params.email,
    password: params.password,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!data.user) {
    throw new Error('登录失败：无法获取用户信息')
  }

  if (!data.session) {
    throw new Error('登录失败：无法创建会话')
  }

  // 获取完整的用户资料
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single()

  if (profileError) {
    console.error('获取用户资料失败:', profileError)
    // 登录成功但获取 profile 失败，返回基本用户信息
    return {
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || '',
        department: data.user.user_metadata?.department || '',
      },
      token: data.session.access_token,
      profileError: true,
    }
  }

  return {
    success: true,
    user: profile,
    token: data.session.access_token,
    profileError: false,
  }
}

/**
 * 用户登出
 */
export async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw new Error(error.message)
  }
  return { success: true }
}

// ==================== 用户信息 API ====================

/**
 * 获取当前用户信息
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}

/**
 * 获取用户配置（包含收款账户、预算项目）
 */
export async function getUserProfile(userId: string) {
  const [profileRes, accountsRes, projectsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('payment_accounts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('budget_projects').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ])

  if (profileRes.error) {
    throw new Error(profileRes.error.message)
  }

  return {
    currentUser: profileRes.data,
    users: [], // 如果需要所有用户，需要管理员权限
    paymentAccounts: accountsRes.data || [],
    budgetProjects: projectsRes.data || [],
  }
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
  const updates: Partial<Profile> = {}
  if (params.name !== undefined) updates.name = params.name
  if (params.department !== undefined) updates.department = params.department

  // 更新资料
  if (Object.keys(updates).length > 0) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', params.userId)
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return { success: true, user: data }
  }

  return { success: true }
}

// ==================== 费用记账 API ====================

/**
 * 获取费用列表
 */
export async function getExpenses(userId: string, status?: string) {
  let query = supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)

  if (status && ['pending', 'processing', 'done'].includes(status)) {
    query = query.eq('status', status)
  }

  const { data, error } = await query.order('date', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const expenses = data || []
  const summary = {
    totalAmount: expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0),
    pendingAmount: expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + parseFloat(e.amount), 0),
    processingAmount: expenses.filter(e => e.status === 'processing').reduce((sum, e) => sum + parseFloat(e.amount), 0),
    doneAmount: expenses.filter(e => e.status === 'done').reduce((sum, e) => sum + parseFloat(e.amount), 0),
  }

  return {
    expenses,
    total: expenses.length,
    summary,
  }
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
  const id = `expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      id,
      user_id: params.userId,
      amount: params.amount.toString(),
      description: params.description,
      date: params.date,
      category: params.category,
      remarks: params.remarks || null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return { success: true, expense: data }
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
  const updates: Partial<Expense> = {}
  if (params.amount !== undefined) updates.amount = params.amount.toString()
  if (params.description !== undefined) updates.description = params.description
  if (params.date !== undefined) updates.date = params.date
  if (params.category !== undefined) updates.category = params.category
  if (params.remarks !== undefined) updates.remarks = params.remarks
  if (params.status !== undefined) updates.status = params.status

  const { data, error } = await supabase
    .from('expenses')
    .update(updates)
    .eq('id', expenseId)
    .eq('user_id', params.userId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return { success: true, expense: data }
}

/**
 * 删除费用记录
 */
export async function deleteExpense(expenseId: string, userId: string) {
  const { data, error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)
    .eq('user_id', userId)
    .select('id')

  if (error) {
    throw new Error(error.message)
  }

  if (!data || data.length === 0) {
    throw new Error('记录不存在或无权删除')
  }

  return { success: true, deletedId: data[0].id }
}

// ==================== 报销单 API ====================

/**
 * 获取报销单列表
 */
export async function getReports(userId: string, status?: string) {
  let query = supabase
    .from('reports')
    .select('*')
    .eq('user_id', userId)

  if (status && ['draft', 'submitted', 'paid'].includes(status)) {
    query = query.eq('status', status)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return {
    reports: data || [],
    total: data?.length || 0,
  }
}

/**
 * 获取报销单详情（包含费用项和附件）
 */
export async function getReportDetail(reportId: string, userId: string) {
  const [reportRes, itemsRes, attachmentsRes] = await Promise.all([
    supabase.from('reports').select('*').eq('id', reportId).eq('user_id', userId).single(),
    supabase.from('report_items').select('*').eq('report_id', reportId),
    supabase.from('attachments').select('*').eq('report_id', reportId),
  ])

  if (reportRes.error) {
    throw new Error(reportRes.error.message)
  }

  // 获取附件的公开URL
  const attachmentsWithUrls = await Promise.all(
    (attachmentsRes.data || []).map(async (att) => {
      if (att.storage_path) {
        const { data } = supabase.storage.from('attachments').getPublicUrl(att.storage_path)
        return { ...att, url: data.publicUrl }
      }
      return att
    })
  )

  return {
    ...reportRes.data,
    items: itemsRes.data || [],
    attachments: attachmentsWithUrls,
  }
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
  aiRecognitionData?: any
}) {
  const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // 创建报销单
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .insert({
      id: reportId,
      user_id: params.userId,
      title: params.title,
      created_date: new Date().toISOString().split('T')[0],
      status: params.status || 'draft',
      total_amount: params.totalAmount.toString(),
      prepaid_amount: (params.prepaidAmount || 0).toString(),
      payable_amount: params.payableAmount.toString(),
      approval_number: params.approvalNumber || null,
      budget_project_data: params.budgetProject || null,
      payment_account_data: params.paymentAccount || null,
      user_snapshot: params.userSnapshot,
      invoice_count: params.invoiceCount || null,
      is_travel: params.isTravel || false,
      trip_reason: params.tripReason || null,
      trip_legs: params.tripLegs || null,
      taxi_details: params.taxiDetails || null,
      ai_recognition_data: params.aiRecognitionData || null,
    })
    .select()
    .single()

  if (reportError) {
    throw new Error(reportError.message)
  }

  // 创建费用项
  if (params.items && params.items.length > 0) {
    const items = params.items.map(item => ({
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      report_id: reportId,
      expense_id: item.id || null,
      amount: item.amount.toString(),
      description: item.description,
      date: item.date,
      category: item.category || null,
      budget_project_data: item.budgetProject || null,
    }))

    await supabase.from('report_items').insert(items)
  }

  // 处理附件上传
  if (params.attachments && params.attachments.length > 0) {
    for (const att of params.attachments) {
      if (att.data) {
        // Base64 附件上传到 Storage
        const filePath = `${params.userId}/${reportId}/${att.name}`
        const fileData = Uint8Array.from(atob(att.data), c => c.charCodeAt(0))
        
        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, fileData, {
            contentType: att.mimeType || 'image/jpeg',
          })

        if (!uploadError) {
          await supabase.from('attachments').insert({
            id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            report_id: reportId,
            type: att.type || 'invoice',
            storage_path: filePath,
            file_name: att.name,
            file_size: att.data.length,
            mime_type: att.mimeType || 'image/jpeg',
          })
        }
      }
    }
  }

  return { success: true, report }
}

/**
 * 更新报销单
 */
export async function updateReport(reportId: string, params: any) {
  const updates: Partial<Report> = {}
  
  if (params.title !== undefined) updates.title = params.title
  if (params.status !== undefined) updates.status = params.status
  if (params.totalAmount !== undefined) updates.total_amount = params.totalAmount.toString()
  if (params.prepaidAmount !== undefined) updates.prepaid_amount = params.prepaidAmount.toString()
  if (params.payableAmount !== undefined) updates.payable_amount = params.payableAmount.toString()
  if (params.approvalNumber !== undefined) updates.approval_number = params.approvalNumber
  if (params.budgetProject !== undefined) updates.budget_project_data = params.budgetProject
  if (params.paymentAccount !== undefined) updates.payment_account_data = params.paymentAccount

  const { data, error } = await supabase
    .from('reports')
    .update(updates)
    .eq('id', reportId)
    .eq('user_id', params.userId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return { success: true, report: data }
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
  const { data, error } = await supabase
    .from('reports')
    .update({ status: params.status })
    .eq('id', reportId)
    .eq('user_id', params.userId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return { success: true, report: data }
}

/**
 * 删除报销单
 */
export async function deleteReport(reportId: string, userId: string) {
  // 先删除关联的附件和费用项（RLS会自动处理，但这里显式清理Storage）
  const { data: attachments } = await supabase
    .from('attachments')
    .select('storage_path')
    .eq('report_id', reportId)

  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      if (att.storage_path) {
        await supabase.storage.from('attachments').remove([att.storage_path])
      }
    }
  }

  const { error } = await supabase
    .from('reports')
    .delete()
    .eq('id', reportId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

// ==================== 借款 API ====================

/**
 * 获取借款列表
 */
export async function getLoans(userId: string, status?: string) {
  let query = supabase
    .from('loans')
    .select('*')
    .eq('user_id', userId)

  if (status && ['draft', 'submitted', 'paid'].includes(status)) {
    query = query.eq('status', status)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return {
    loans: data || [],
    total: data?.length || 0,
  }
}

/**
 * 获取借款详情
 */
export async function getLoanDetail(loanId: string, userId: string) {
  const { data, error } = await supabase
    .from('loans')
    .select('*')
    .eq('id', loanId)
    .eq('user_id', userId)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
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
  payeeInfo: any
  userSnapshot: any
}) {
  const id = `loan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const { data, error } = await supabase
    .from('loans')
    .insert({
      id,
      user_id: params.userId,
      amount: params.amount.toString(),
      reason: params.reason,
      date: params.date,
      status: params.status || 'draft',
      approval_number: params.approvalNumber || null,
      budget_project_data: params.budgetProject || null,
      payee_info: params.payeeInfo,
      user_snapshot: params.userSnapshot,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return { success: true, loan: data }
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
  const { data, error } = await supabase
    .from('loans')
    .update({ status: params.status })
    .eq('id', loanId)
    .eq('user_id', params.userId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return { success: true, loan: data }
}

/**
 * 删除借款
 */
export async function deleteLoan(loanId: string, userId: string) {
  const { error } = await supabase
    .from('loans')
    .delete()
    .eq('id', loanId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

// ==================== 收款人设置 API ====================

/**
 * 获取收款人列表
 */
export async function getPayees(userId: string) {
  const { data, error } = await supabase
    .from('payment_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return {
    paymentAccounts: data || [],
    total: data?.length || 0,
  }
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
  const id = `pa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const { data, error } = await supabase
    .from('payment_accounts')
    .insert({
      id,
      user_id: params.userId,
      bank_name: params.bankName,
      bank_branch: params.bankBranch || null,
      account_number: params.accountNumber,
      account_name: params.accountName,
      is_default: params.isDefault || false,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return { success: true, paymentAccount: data }
}

/**
 * 更新收款人
 */
export async function updatePayee(payeeId: string, userId: string, params: any) {
  const updates: Partial<PaymentAccount> = {}

  if (params.bankName !== undefined) updates.bank_name = params.bankName
  if (params.bankBranch !== undefined) updates.bank_branch = params.bankBranch
  if (params.accountNumber !== undefined) updates.account_number = params.accountNumber
  if (params.accountName !== undefined) updates.account_name = params.accountName
  if (params.isDefault !== undefined) updates.is_default = params.isDefault

  const { data, error } = await supabase
    .from('payment_accounts')
    .update(updates)
    .eq('id', payeeId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return { success: true, paymentAccount: data }
}

/**
 * 删除收款人
 */
export async function deletePayee(payeeId: string, userId: string) {
  const { error } = await supabase
    .from('payment_accounts')
    .delete()
    .eq('id', payeeId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

// ==================== 预算项目设置 API ====================

/**
 * 获取预算项目列表
 */
export async function getProjects(userId: string) {
  const { data, error } = await supabase
    .from('budget_projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return {
    budgetProjects: data || [],
    total: data?.length || 0,
  }
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
  const id = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const { data, error } = await supabase
    .from('budget_projects')
    .insert({
      id,
      user_id: params.userId,
      name: params.name,
      code: params.code,
      is_default: params.isDefault || false,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return { success: true, budgetProject: data }
}

/**
 * 更新预算项目
 */
export async function updateProject(projectId: string, userId: string, params: any) {
  const updates: Partial<BudgetProject> = {}

  if (params.name !== undefined) updates.name = params.name
  if (params.code !== undefined) updates.code = params.code
  if (params.isDefault !== undefined) updates.is_default = params.isDefault

  const { data, error } = await supabase
    .from('budget_projects')
    .update(updates)
    .eq('id', projectId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return { success: true, budgetProject: data }
}

/**
 * 删除预算项目
 */
export async function deleteProject(projectId: string, userId: string) {
  const { error } = await supabase
    .from('budget_projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

// ==================== AI 配置 API ====================

/**
 * AI 配置类型
 */
export interface AIConfigType {
  id: string
  provider: 'gemini' | 'deepseek' | 'minimax' | 'glm' | 'openai' | 'claude' | 'qwen' | 'moonshot' | 'doubao' | 'volcengine'
  name: string
  apiKey: string
  apiUrl?: string
  model?: string
  isDefault?: boolean
  createdAt?: string
  updatedAt?: string
}

/**
 * 获取 AI 配置列表
 */
export async function getAIConfigs(userId: string) {
  const { data, error } = await supabase
    .from('ai_configs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  // 隐藏 API Key
  const configs = (data || []).map(config => ({
    ...config,
    api_key: '***',
  }))

  return {
    configs,
    total: configs.length,
  }
}

/**
 * 保存 AI 配置
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
  const configData = {
    user_id: params.userId,
    provider: params.provider as any,
    api_key: params.apiKey,
    api_url: params.apiUrl || null,
    model: params.model || null,
    is_active: params.isDefault || false,
  }

  if (params.id) {
    // 更新
    const { data, error } = await supabase
      .from('ai_configs')
      .update(configData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return { success: true, config: { ...data, api_key: '***' } }
  } else {
    // 创建
    const id = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const { data, error } = await supabase
      .from('ai_configs')
      .insert({ id, ...configData })
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return { success: true, config: { ...data, api_key: '***' } }
  }
}

/**
 * 删除 AI 配置
 */
export async function deleteAIConfig(configId: string, userId: string) {
  const { error } = await supabase
    .from('ai_configs')
    .delete()
    .eq('id', configId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
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
  const startTime = Date.now()

  try {
    // 根据提供商构建测试请求
    let testUrl = params.apiUrl || ''
    let testBody: any = {}
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${params.apiKey}`,
    }

    switch (params.provider) {
      case 'openai':
        testUrl = `${params.apiUrl || 'https://api.openai.com/v1'}/chat/completions`
        testBody = {
          model: params.model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        }
        break
      case 'doubao':
      case 'volcengine':
        // 火山引擎方舟 API (OpenAI 兼容格式)
        // model 参数使用 Endpoint ID
        testUrl = `${params.apiUrl || 'https://ark.cn-beijing.volces.com/api/v3'}/chat/completions`
        testBody = {
          model: params.model, // Endpoint ID，如 ep-20260313144701-fpdq6
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        }
        break
      case 'gemini':
        testUrl = `${params.apiUrl || 'https://generativelanguage.googleapis.com/v1beta'}/models/${params.model || 'gemini-pro'}:generateContent`
        testBody = {
          contents: [{ parts: [{ text: 'Hello' }] }],
        }
        headers = { 'Content-Type': 'application/json' }
        break
      case 'deepseek':
        testUrl = `${params.apiUrl || 'https://api.deepseek.com/v1'}/chat/completions`
        testBody = {
          model: params.model || 'deepseek-chat',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        }
        break
      case 'qwen':
        testUrl = `${params.apiUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1'}/chat/completions`
        testBody = {
          model: params.model || 'qwen-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        }
        break
      case 'glm':
        testUrl = `${params.apiUrl || 'https://open.bigmodel.cn/api/paas/v4'}/chat/completions`
        testBody = {
          model: params.model || 'glm-4-flash',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        }
        break
      case 'moonshot':
        testUrl = `${params.apiUrl || 'https://api.moonshot.cn/v1'}/chat/completions`
        testBody = {
          model: params.model || 'moonshot-v1-8k',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        }
        break
      case 'minimax':
        testUrl = `${params.apiUrl || 'https://api.minimax.chat/v1'}/chat/completions`
        testBody = {
          model: params.model || 'abab6.5-chat',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        }
        break
      default:
        // 通用 OpenAI 兼容格式测试
        testUrl = `${params.apiUrl}/chat/completions`
        testBody = {
          model: params.model,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        }
    }

    const response = await fetch(testUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(testBody),
    })

    const responseTime = Date.now() - startTime

    if (response.ok) {
      return {
        success: true,
        message: '连接成功',
        testResult: {
          responseTime,
          modelInfo: params.model,
        },
      }
    } else {
      const errorText = await response.text()
      let errorMessage = `API 返回错误: ${response.status}`
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage
      } catch {
        // 非 JSON 错误，使用默认消息
      }
      throw new Error(errorMessage)
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
      testResult: {
        responseTime: Date.now() - startTime,
      },
    }
  }
}

// ==================== AI 识别 API ====================

/**
 * 获取用户活跃的 AI 配置（包含 API Key，用于 AI 识别）
 */
export async function getActiveAIConfig(userId: string): Promise<AIConfigType | null> {
  const { data, error } = await supabase
    .from('ai_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    return null
  }

  return {
    id: data.id,
    provider: data.provider as any,
    name: data.provider,
    apiKey: data.api_key,
    apiUrl: data.api_url || undefined,
    model: data.model || undefined,
  }
}

/**
 * AI 识别发票/审批单
 * 直接从前端调用 AI API（不需要 Edge Function）
 */
export async function aiRecognize(params: {
  images: string[]
  type: 'invoice' | 'approval' | 'travel'
  userId: string
}) {
  // 获取用户配置的 AI
  const config = await getActiveAIConfig(params.userId)

  if (!config) {
    throw new Error('请先在系统设置中配置 AI 模型')
  }

  // 构建识别提示词
  const prompts: Record<string, string> = {
    invoice: `请识别这张发票图片，提取以下信息并以 JSON 格式返回：
{
  "projectName": "项目名称或费用事由",
  "totalAmount": 金额数字,
  "invoiceDate": "开票日期 YYYY-MM-DD",
  "invoiceNumber": "发票号码",
  "seller": "销售方名称",
  "items": [{"name": "项目名称", "amount": 金额}]
}

如果是多张发票，返回数组格式：[{...}, {...}]
请只返回 JSON，不要有其他说明文字。`,
    approval: `请识别这张审批单/申请单图片，提取以下信息并以 JSON 格式返回：
{
  "approvalNumber": "审批单号",
  "eventSummary": "事由摘要",
  "applicant": "申请人",
  "approvalAmount": 批准金额数字,
  "budgetProject": "预算项目名称",
  "budgetCode": "预算项目编码"
}
请只返回 JSON，不要有其他说明文字。`,
    travel: `请识别这张差旅相关票据图片，提取以下信息并以 JSON 格式返回：
{
  "type": "交通/住宿/餐饮",
  "from": "出发地",
  "to": "目的地",
  "date": "日期 YYYY-MM-DD",
  "amount": 金额数字,
  "description": "描述"
}
请只返回 JSON，不要有其他说明文字。`
  }

  const systemPrompt = prompts[params.type] || prompts.invoice
  const userMessage = params.type === 'travel'
    ? '请识别这张差旅票据'
    : params.type === 'approval'
      ? '请识别这张审批单'
      : '请识别这张发票'

  // 构建 API 请求
  let apiUrl: string
  let requestBody: any
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  switch (config.provider) {
    case 'doubao':
    case 'volcengine':
      // 火山引擎：model 参数使用 Endpoint ID
      apiUrl = `${config.apiUrl || 'https://ark.cn-beijing.volces.com/api/v3'}/chat/completions`
      headers['Authorization'] = `Bearer ${config.apiKey}`
      requestBody = {
        model: config.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: userMessage },
              ...params.images.map(img => ({
                type: 'image_url',
                image_url: { url: img }
              }))
            ]
          }
        ],
        max_tokens: 2000,
      }
      break

    case 'openai':
      apiUrl = `${config.apiUrl || 'https://api.openai.com/v1'}/chat/completions`
      headers['Authorization'] = `Bearer ${config.apiKey}`
      requestBody = {
        model: config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userMessage },
              ...params.images.map(img => ({
                type: 'image_url',
                image_url: { url: img }
              }))
            ]
          }
        ],
        max_tokens: 2000,
      }
      break

    case 'deepseek':
      apiUrl = `${config.apiUrl || 'https://api.deepseek.com/v1'}/chat/completions`
      headers['Authorization'] = `Bearer ${config.apiKey}`
      requestBody = {
        model: config.model || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userMessage },
              ...params.images.map(img => ({
                type: 'image_url',
                image_url: { url: img }
              }))
            ]
          }
        ],
        max_tokens: 2000,
      }
      break

    case 'qwen':
      apiUrl = `${config.apiUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1'}/chat/completions`
      headers['Authorization'] = `Bearer ${config.apiKey}`
      requestBody = {
        model: config.model || 'qwen-vl-plus',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userMessage },
              ...params.images.map(img => ({
                type: 'image_url',
                image_url: { url: img }
              }))
            ]
          }
        ],
        max_tokens: 2000,
      }
      break

    case 'glm':
      apiUrl = `${config.apiUrl || 'https://open.bigmodel.cn/api/paas/v4'}/chat/completions`
      headers['Authorization'] = `Bearer ${config.apiKey}`
      requestBody = {
        model: config.model || 'glm-4v-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userMessage },
              ...params.images.map(img => ({
                type: 'image_url',
                image_url: { url: img }
              }))
            ]
          }
        ],
        max_tokens: 2000,
      }
      break

    case 'gemini':
      // Gemini 使用不同的 API 格式
      apiUrl = `${config.apiUrl || 'https://generativelanguage.googleapis.com/v1beta'}/models/${config.model || 'gemini-2.0-flash'}:generateContent?key=${config.apiKey}`
      requestBody = {
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { text: userMessage },
              ...params.images.map(img => {
                // 从 data URL 提取 base64 数据
                const match = img.match(/^data:([^;]+);base64,(.+)$/)
                if (match) {
                  return {
                    inlineData: {
                      mimeType: match[1],
                      data: match[2]
                    }
                  }
                }
                return { text: img }
              })
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 2000,
        }
      }
      break

    default:
      // 通用 OpenAI 兼容格式
      apiUrl = `${config.apiUrl}/chat/completions`
      headers['Authorization'] = `Bearer ${config.apiKey}`
      requestBody = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userMessage },
              ...params.images.map(img => ({
                type: 'image_url',
                image_url: { url: img }
              }))
            ]
          }
        ],
        max_tokens: 2000,
      }
  }

  console.log(`[AI] 调用 ${config.provider} API:`, apiUrl)

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[AI] API 错误:', response.status, errorText)
    throw new Error(`AI API 错误: ${response.status} - ${errorText.substring(0, 200)}`)
  }

  const data = await response.json()

  // 解析响应
  let result: any = {}

  if (config.provider === 'gemini') {
    // Gemini 响应格式
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    result = parseAIResponse(text)
  } else {
    // OpenAI 兼容格式
    const text = data.choices?.[0]?.message?.content || ''
    result = parseAIResponse(text)
  }

  console.log('[AI] 识别结果:', JSON.stringify(result).substring(0, 500))

  return { result }
}

/**
 * 解析 AI 响应文本为 JSON
 */
function parseAIResponse(text: string): any {
  // 尝试直接解析
  try {
    return JSON.parse(text)
  } catch {
    // 尝试提取 JSON 代码块
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim())
      } catch {
        // 继续
      }
    }

    // 尝试提取 {} 或 [] 包裹的内容
    const objectMatch = text.match(/\{[\s\S]*\}/)
    const arrayMatch = text.match(/\[[\s\S]*\]/)

    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0])
      } catch {
        // 继续
      }
    }

    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0])
      } catch {
        // 继续
      }
    }

    // 返回空对象
    return {}
  }
}

// ==================== 统计 API ====================

/**
 * 获取统计概览
 */
export async function getStatisticsOverview(
  userId: string,
  period: '3m' | '6m' | '1y' = '6m'
) {
  // 计算时间范围
  const now = new Date()
  const months = period === '3m' ? 3 : period === '6m' ? 6 : 12
  const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1)
  const startDateStr = startDate.toISOString().split('T')[0]

  // 并行获取所有数据
  const [expensesRes, reportsRes, loansRes] = await Promise.all([
    supabase
      .from('expenses')
      .select('amount, status')
      .eq('user_id', userId)
      .gte('date', startDateStr),
    supabase
      .from('reports')
      .select('total_amount, status, created_date')
      .eq('user_id', userId)
      .gte('created_date', startDateStr),
    supabase
      .from('loans')
      .select('amount, status')
      .eq('user_id', userId)
      .gte('date', startDateStr),
  ])

  const expenses = expensesRes.data || []
  const reports = reportsRes.data || []
  const loans = loansRes.data || []

  // 计算统计数据
  const pendingExpenses = expenses.filter(e => e.status === 'pending')
  const submittedReports = reports.filter(r => r.status === 'submitted')
  const activeLoans = loans.filter(l => l.status !== 'paid')

  // 月度数据聚合
  const monthlyDataMap = new Map<string, { month: string; amount: number; count: number }>()
  
  reports.forEach(report => {
    const month = report.created_date.substring(0, 7) // YYYY-MM
    const existing = monthlyDataMap.get(month)
    if (existing) {
      existing.amount += parseFloat(report.total_amount)
      existing.count += 1
    } else {
      monthlyDataMap.set(month, {
        month,
        amount: parseFloat(report.total_amount),
        count: 1,
      })
    }
  })

  const monthlyData = Array.from(monthlyDataMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))

  return {
    totalPending: pendingExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0),
    activeLoanAmount: activeLoans.reduce((sum, l) => sum + parseFloat(l.amount), 0),
    totalReceivable: submittedReports.reduce((sum, r) => sum + parseFloat(r.total_amount), 0),
    submittedReportsAmount: submittedReports.reduce((sum, r) => sum + parseFloat(r.total_amount), 0),
    pendingExpensesAmount: pendingExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0),
    monthlyData,
  }
}

// ==================== 导出所有 API ====================

export const api = {
  // 认证
  register,
  login,
  logout,
  getCurrentUser,
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
  getReportDetail,
  createReport,
  updateReport,
  updateReportStatus,
  deleteReport,
  // 借款
  getLoans,
  getLoanDetail,
  createLoan,
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
  getActiveAIConfig,
  // AI 配置
  getAIConfigs,
  saveAIConfig,
  deleteAIConfig,
  testAIConfig,
  // 统计
  getStatisticsOverview,
}

export default api