/**
 * 前端 Hooks - 用于连接后端 API
 * 
 * 这些 hooks 替代原来的 localStorage 存储方式
 * 通俗解释：这些函数帮助前端从服务器获取和保存数据
 */

import { useState, useEffect, useCallback } from 'react'
import * as api from './client'

// API 基础地址
const API_BASE = 'http://localhost:3000'

// ==================== 用户状态管理 ====================

export interface AuthState {
  isLoggedIn: boolean
  user: any | null
  token: string | null
  loading: boolean
  error: string | null
}

/**
 * 用户认证 Hook
 * 
 * 管理用户登录状态，自动从 localStorage 恢复登录
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>(() => {
    // 从 localStorage 恢复登录状态
    const saved = localStorage.getItem('reimb_auth')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return {
          isLoggedIn: true,
          user: parsed.user,
          token: parsed.token,
          loading: false,
          error: null,
        }
      } catch {
        return { isLoggedIn: false, user: null, token: null, loading: false, error: null }
      }
    }
    return { isLoggedIn: false, user: null, token: null, loading: false, error: null }
  })

  // 登录
  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const result = await api.login({ email, password })
      const authData = { user: result.user, token: result.token }
      localStorage.setItem('reimb_auth', JSON.stringify(authData))
      setState({
        isLoggedIn: true,
        user: result.user,
        token: result.token,
        loading: false,
        error: null,
      })
      return result
    } catch (error: any) {
      setState(prev => ({ ...prev, loading: false, error: error.message }))
      throw error
    }
  }, [])

  // 注册
  const register = useCallback(async (params: {
    name: string
    email: string
    password: string
    department: string
  }) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const result = await api.register(params)
      // 注册成功后自动登录
      const loginResult = await api.login({ email: params.email, password: params.password })
      const authData = { user: loginResult.user, token: loginResult.token }
      localStorage.setItem('reimb_auth', JSON.stringify(authData))
      setState({
        isLoggedIn: true,
        user: loginResult.user,
        token: loginResult.token,
        loading: false,
        error: null,
      })
      return result
    } catch (error: any) {
      setState(prev => ({ ...prev, loading: false, error: error.message }))
      throw error
    }
  }, [])

  // 登出
  const logout = useCallback(() => {
    localStorage.removeItem('reimb_auth')
    setState({ isLoggedIn: false, user: null, token: null, loading: false, error: null })
  }, [])

  // 更新用户信息
  const updateUser = useCallback(async (updates: any) => {
    if (!state.user) return
    try {
      const result = await api.updateUserProfile({ userId: state.user.id, ...updates })
      const newUser = result.user
      const authData = { user: newUser, token: state.token }
      localStorage.setItem('reimb_auth', JSON.stringify(authData))
      setState(prev => ({ ...prev, user: newUser }))
      return result
    } catch (error: any) {
      throw error
    }
  }, [state.user, state.token])

  return { ...state, login, register, logout, updateUser }
}

// ==================== 用户设置 Hook ====================

/**
 * 用户设置 Hook
 * 
 * 获取和管理用户的收款账户、预算项目等设置
 */
export function useSettings(userId: string | null) {
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载设置
  const loadSettings = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.getUserProfile(userId)
      setSettings(result)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // 初始加载
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // 收款人操作
  const addPayee = useCallback(async (payee: any) => {
    if (!userId) return
    const result = await api.createPayee({ userId, ...payee })
    await loadSettings()
    return result
  }, [userId, loadSettings])

  const updatePayee = useCallback(async (payeeId: string, updates: any) => {
    if (!userId) return
    const result = await api.updatePayee(payeeId, { userId, ...updates })
    await loadSettings()
    return result
  }, [userId, loadSettings])

  const deletePayee = useCallback(async (payeeId: string) => {
    if (!userId) return
    const result = await api.deletePayee(payeeId, userId)
    await loadSettings()
    return result
  }, [userId, loadSettings])

  // 预算项目操作
  const addProject = useCallback(async (project: any) => {
    if (!userId) return
    const result = await api.createProject({ userId, ...project })
    await loadSettings()
    return result
  }, [userId, loadSettings])

  const updateProject = useCallback(async (projectId: string, updates: any) => {
    if (!userId) return
    const result = await api.updateProject(projectId, { userId, ...updates })
    await loadSettings()
    return result
  }, [userId, loadSettings])

  const deleteProject = useCallback(async (projectId: string) => {
    if (!userId) return
    const result = await api.deleteProject(projectId, userId)
    await loadSettings()
    return result
  }, [userId, loadSettings])

  return {
    settings,
    loading,
    error,
    refresh: loadSettings,
    payees: {
      add: addPayee,
      update: updatePayee,
      delete: deletePayee,
    },
    projects: {
      add: addProject,
      update: updateProject,
      delete: deleteProject,
    },
  }
}

// ==================== 费用记录 Hook ====================

/**
 * 费用记录 Hook
 * 
 * 管理记账本中的费用记录
 */
export function useExpenses(userId: string | null) {
  const [expenses, setExpenses] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载费用列表
  const loadExpenses = useCallback(async (status?: string) => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.getExpenses(userId, status)
      setExpenses(result.expenses)
      setSummary(result.summary)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // 初始加载
  useEffect(() => {
    loadExpenses()
  }, [loadExpenses])

  // 添加费用
  const addExpense = useCallback(async (expense: any) => {
    if (!userId) return
    const result = await api.createExpense({ userId, ...expense })
    await loadExpenses()
    return result
  }, [userId, loadExpenses])

  // 更新费用
  const updateExpense = useCallback(async (expenseId: string, updates: any) => {
    if (!userId) return
    const result = await api.updateExpense(expenseId, { userId, ...updates })
    await loadExpenses()
    return result
  }, [userId, loadExpenses])

  // 删除费用
  const deleteExpense = useCallback(async (expenseId: string) => {
    if (!userId) return
    const result = await api.deleteExpense(expenseId, userId)
    await loadExpenses()
    return result
  }, [userId, loadExpenses])

  // 批量删除
  const deleteExpenses = useCallback(async (expenseIds: string[]) => {
    if (!userId) return
    for (const id of expenseIds) {
      await api.deleteExpense(id, userId)
    }
    await loadExpenses()
  }, [userId, loadExpenses])

  return {
    expenses,
    summary,
    loading,
    error,
    refresh: loadExpenses,
    add: addExpense,
    update: updateExpense,
    delete: deleteExpense,
    deleteMany: deleteExpenses,
  }
}

// ==================== 报销单 Hook ====================

/**
 * 报销单 Hook
 * 
 * 管理报销单的创建、查询和状态更新
 */
export function useReports(userId: string | null) {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载报销单列表
  const loadReports = useCallback(async (status?: string) => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.getReports(userId, status)
      setReports(result.reports)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // 初始加载
  useEffect(() => {
    loadReports()
  }, [loadReports])

  // 创建报销单
  const createReport = useCallback(async (report: any) => {
    if (!userId) return
    const result = await api.createReport({ userId, ...report })
    await loadReports()
    return result
  }, [userId, loadReports])

  // 获取详情
  const getReport = useCallback(async (reportId: string) => {
    if (!userId) return null
    return await api.getReportDetail(reportId, userId)
  }, [userId])

  // 更新报销单
  const updateReport = useCallback(async (reportId: string, updates: any) => {
    if (!userId) return
    const result = await api.updateReport(reportId, { userId, ...updates })
    await loadReports()
    return result
  }, [userId, loadReports])

  // 更新状态
  const updateStatus = useCallback(async (reportId: string, status: 'draft' | 'submitted' | 'paid') => {
    if (!userId) return
    const result = await api.updateReportStatus(reportId, { userId, status })
    await loadReports()
    return result
  }, [userId, loadReports])

  return {
    reports,
    loading,
    error,
    refresh: loadReports,
    create: createReport,
    get: getReport,
    update: updateReport,
    updateStatus,
  }
}

// ==================== 借款 Hook ====================

/**
 * 借款 Hook
 * 
 * 管理借款申请
 */
export function useLoans(userId: string | null) {
  const [loans, setLoans] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载借款列表
  const loadLoans = useCallback(async (status?: string) => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.getLoans(userId, status)
      setLoans(result.loans)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // 初始加载
  useEffect(() => {
    loadLoans()
  }, [loadLoans])

  // 创建借款
  const createLoan = useCallback(async (loan: any) => {
    if (!userId) return
    const result = await api.createLoan({ userId, ...loan })
    await loadLoans()
    return result
  }, [userId, loadLoans])

  // 获取详情
  const getLoan = useCallback(async (loanId: string) => {
    if (!userId) return null
    return await api.getLoanDetail(loanId, userId)
  }, [userId])

  // 更新状态
  const updateStatus = useCallback(async (loanId: string, status: 'draft' | 'submitted' | 'paid') => {
    if (!userId) return
    const result = await api.updateLoanStatus(loanId, { userId, status })
    await loadLoans()
    return result
  }, [userId, loadLoans])

  return {
    loans,
    loading,
    error,
    refresh: loadLoans,
    create: createLoan,
    get: getLoan,
    updateStatus,
  }
}

// ==================== 统计 Hook ====================

/**
 * 统计数据 Hook
 */
export function useStatistics(userId: string | null) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStatistics = useCallback(async (period: '3m' | '6m' | '1y' = '6m') => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.getStatisticsOverview(userId, period)
      setData(result)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // 初始加载
  useEffect(() => {
    loadStatistics()
  }, [loadStatistics])

  return {
    data,
    loading,
    error,
    refresh: loadStatistics,
  }
}

// ==================== AI 识别 Hook ====================

/**
 * AI 识别 Hook
 */
export function useAIRecognition(userId: string | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recognize = useCallback(async (
    images: string[],
    type: 'invoice' | 'approval' | 'travel'
  ) => {
    if (!userId) return null
    setLoading(true)
    setError(null)
    try {
      const result = await api.aiRecognize({ images, type, userId })
      return result.result
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [userId])

  return {
    loading,
    error,
    recognize,
  }
}

// ==================== AI 配置 Hook ====================

/**
 * AI 配置类型定义
 */
export interface AIConfig {
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
 * AI 模型提供商信息
 */
export const AI_PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    description: 'Google 的多模态 AI 模型',
    defaultUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-1.5-flash',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro-vision'],
  },
  deepseek: {
    name: 'DeepSeek',
    description: '深度求索 AI 模型',
    defaultUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-coder'],
  },
  minimax: {
    name: 'MiniMax',
    description: 'MiniMax AI 模型',
    defaultUrl: 'https://api.minimax.chat/v1',
    defaultModel: 'abab6.5-chat',
    models: ['abab6.5-chat', 'abab6-chat', 'abab5.5-chat'],
  },
  glm: {
    name: '智谱 GLM',
    description: '智谱清言 GLM 多模态模型',
    defaultUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4v',
    models: ['glm-4v', 'glm-4', 'glm-4-plus'],
  },
  openai: {
    name: 'OpenAI',
    description: 'OpenAI GPT 系列模型',
    defaultUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4-vision-preview',
    models: ['gpt-4-vision-preview', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini'],
  },
  claude: {
    name: 'Anthropic Claude',
    description: 'Anthropic Claude 系列模型',
    defaultUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-opus-20240229',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-5-sonnet-20241022'],
  },
  qwen: {
    name: '通义千问',
    description: '阿里云通义千问多模态模型',
    defaultUrl: 'https://dashscope.aliyuncs.com/api/v1',
    defaultModel: 'qwen-vl-plus',
    models: ['qwen-vl-plus', 'qwen-vl-max'],
  },
} as const

export type AIProviderType = keyof typeof AI_PROVIDERS

/**
 * AI 配置管理 Hook
 * 
 * 管理用户的 AI 模型配置
 */
export function useAIConfig(userId: string | null) {
  const [configs, setConfigs] = useState<AIConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message?: string
    responseTime?: number
  } | null>(null)

  // 加载配置列表
  const loadConfigs = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.getAIConfigs(userId)
      setConfigs(result.configs || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // 初始加载
  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])

  // 保存配置
  const saveConfig = useCallback(async (config: Omit<AIConfig, 'createdAt' | 'updatedAt'>) => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.saveAIConfig({
        userId,
        ...config,
      })
      await loadConfigs()
      return result
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [userId, loadConfigs])

  // 删除配置
  const deleteConfig = useCallback(async (configId: string) => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.deleteAIConfig(configId, userId)
      await loadConfigs()
      return result
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [userId, loadConfigs])

  // 测试配置
  const testConfig = useCallback(async (config: {
    provider: string
    apiKey: string
    apiUrl?: string
    model?: string
  }) => {
    if (!userId) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await api.testAIConfig({
        userId,
        ...config,
      })
      setTestResult({
        success: result.success,
        message: result.message,
        responseTime: result.testResult?.responseTime,
      })
      return result
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message,
      })
      throw err
    } finally {
      setTesting(false)
    }
  }, [userId])

  // 设置默认配置
  const setDefaultConfig = useCallback(async (configId: string) => {
    if (!userId) return
    // 将当前配置设为默认，取消其他配置的默认状态
    const targetConfig = configs.find(c => c.id === configId)
    if (!targetConfig) return

    setLoading(true)
    try {
      // 更新目标配置为默认
      await api.saveAIConfig({
        userId,
        ...targetConfig,
        isDefault: true,
      })
      await loadConfigs()
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [userId, configs, loadConfigs])

  // 获取默认配置
  const defaultConfig = configs.find(c => c.isDefault) || configs[0] || null

  return {
    configs,
    defaultConfig,
    loading,
    error,
    testing,
    testResult,
    refresh: loadConfigs,
    save: saveConfig,
    delete: deleteConfig,
    test: testConfig,
    setDefault: setDefaultConfig,
    providers: AI_PROVIDERS,
  }
}

export default {
  useAuth,
  useSettings,
  useExpenses,
  useReports,
  useLoans,
  useStatistics,
  useAIRecognition,
  useAIConfig,
}

