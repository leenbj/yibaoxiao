/**
 * 易报销 Pro - 前端应用入口（后端集成版）
 * 
 * 这个文件展示如何将前端与 Motia 后端集成
 * 
 * 使用方法：
 * 1. 确保后端已启动：npm run dev
 * 2. 将此文件中的逻辑集成到 index.tsx 中
 */

import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  useAuth,
  useSettings,
  useExpenses,
  useReports,
  useLoans,
  useStatistics,
  useAIRecognition,
  useAIConfig,
} from './src/api/hooks'
import AIConfigPage from './src/components/AIConfigPage'

// ==================== 上下文定义 ====================

interface AppContextType {
  auth: ReturnType<typeof useAuth>
  settings: ReturnType<typeof useSettings>
  expenses: ReturnType<typeof useExpenses>
  reports: ReturnType<typeof useReports>
  loans: ReturnType<typeof useLoans>
  statistics: ReturnType<typeof useStatistics>
  ai: ReturnType<typeof useAIRecognition>
  aiConfig: ReturnType<typeof useAIConfig>
}

const AppContext = createContext<AppContextType | null>(null)

// ==================== 提供者组件 ====================

/**
 * 应用数据提供者
 * 
 * 将所有数据 hooks 统一管理，方便在组件中使用
 */
function AppProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const userId = auth.user?.id || null

  // 只有登录后才加载这些数据
  const settings = useSettings(userId)
  const expenses = useExpenses(userId)
  const reports = useReports(userId)
  const loans = useLoans(userId)
  const statistics = useStatistics(userId)
  const ai = useAIRecognition(userId)
  const aiConfig = useAIConfig(userId)

  const value: AppContextType = {
    auth,
    settings,
    expenses,
    reports,
    loans,
    statistics,
    ai,
    aiConfig,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

/**
 * 使用应用上下文的 Hook
 */
function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}

// ==================== 登录页面 ====================

function LoginPage() {
  const { auth } = useApp()
  const [isRegister, setIsRegister] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (isRegister) {
        await auth.register(form)
        alert('注册成功！')
      } else {
        await auth.login(form.email, form.password)
      }
    } catch (error: any) {
      alert(error.message)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">易报销 Pro</h1>
          <p className="text-gray-500 mt-2">
            {isRegister ? '创建新账户' : '登录您的账户'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <input
                type="text"
                placeholder="姓名"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
              <input
                type="text"
                placeholder="部门"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </>
          )}
          <input
            type="email"
            placeholder="邮箱"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            required
          />
          <input
            type="password"
            placeholder="密码"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            required
          />
          <button
            type="submit"
            disabled={auth.loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {auth.loading ? '处理中...' : isRegister ? '注册' : '登录'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-indigo-600 hover:underline"
          >
            {isRegister ? '已有账户？登录' : '没有账户？注册'}
          </button>
        </div>

        {auth.error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-center">
            {auth.error}
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== 主应用页面 ====================

function MainApp() {
  const { auth, expenses, reports, loans, statistics, ai, aiConfig } = useApp()
  const [view, setView] = useState<'dashboard' | 'expenses' | 'test-ai' | 'settings'>('dashboard')

  // 如果在设置页面，显示 AI 配置页面
  if (view === 'settings') {
    return (
      <AIConfigPage 
        userId={auth.user?.id} 
        onBack={() => setView('dashboard')} 
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-indigo-600">易报销 Pro</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">
              欢迎, {auth.user?.name}
            </span>
            <button
              onClick={() => setView('settings')}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1"
            >
              <span>⚙️</span>
              <span>设置</span>
            </button>
            <button
              onClick={auth.logout}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
            >
              退出
            </button>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 导航标签 */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setView('dashboard')}
            className={`px-4 py-2 rounded-lg ${
              view === 'dashboard'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            概览
          </button>
          <button
            onClick={() => setView('expenses')}
            className={`px-4 py-2 rounded-lg ${
              view === 'expenses'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            费用记录
          </button>
          <button
            onClick={() => setView('test-ai')}
            className={`px-4 py-2 rounded-lg ${
              view === 'test-ai'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            测试 AI
          </button>
        </div>

        {/* 页面内容 */}
        {view === 'dashboard' && <DashboardView />}
        {view === 'expenses' && <ExpensesView />}
        {view === 'test-ai' && <TestAIView />}
      </main>
    </div>
  )
}

// ==================== 概览页面 ====================

function DashboardView() {
  const { statistics, expenses, reports, loans } = useApp()

  if (statistics.loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  const data = statistics.data

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <p className="text-gray-500 text-sm">待报销金额</p>
          <p className="text-3xl font-bold text-indigo-600">
            ¥{data?.totalPending?.toLocaleString() || 0}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <p className="text-gray-500 text-sm">借款金额</p>
          <p className="text-3xl font-bold text-amber-500">
            ¥{data?.activeLoanAmount?.toLocaleString() || 0}
          </p>
        </div>
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 rounded-xl text-white">
          <p className="text-emerald-100 text-sm">预计收款总额</p>
          <p className="text-3xl font-bold">
            ¥{data?.totalReceivable?.toLocaleString() || 0}
          </p>
        </div>
      </div>

      {/* 数据列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">
            最近费用 ({expenses.expenses?.length || 0})
          </h3>
          <div className="space-y-3">
            {expenses.expenses?.slice(0, 5).map((e: any) => (
              <div
                key={e.id}
                className="flex justify-between items-center py-2 border-b"
              >
                <span className="text-gray-600">{e.description}</span>
                <span className="font-semibold">¥{e.amount}</span>
              </div>
            ))}
            {(!expenses.expenses || expenses.expenses.length === 0) && (
              <p className="text-gray-400 text-center py-4">暂无费用记录</p>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">
            最近报销单 ({reports.reports?.length || 0})
          </h3>
          <div className="space-y-3">
            {reports.reports?.slice(0, 5).map((r: any) => (
              <div
                key={r.id}
                className="flex justify-between items-center py-2 border-b"
              >
                <span className="text-gray-600">{r.title}</span>
                <span className="font-semibold">¥{r.payableAmount}</span>
              </div>
            ))}
            {(!reports.reports || reports.reports.length === 0) && (
              <p className="text-gray-400 text-center py-4">暂无报销单</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== 费用记录页面 ====================

function ExpensesView() {
  const { expenses } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    amount: '',
    description: '',
    category: '餐饮',
    remarks: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await expenses.add({
        amount: parseFloat(form.amount),
        description: form.description,
        date: new Date().toISOString(),
        category: form.category,
        remarks: form.remarks,
      })
      setForm({ amount: '', description: '', category: '餐饮', remarks: '' })
      setShowForm(false)
      alert('费用记录已添加！')
    } catch (error: any) {
      alert(error.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* 操作栏 */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">费用记录</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          {showForm ? '取消' : '添加费用'}
        </button>
      </div>

      {/* 添加表单 */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-xl shadow-sm space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              placeholder="金额"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="px-4 py-3 border rounded-lg"
              required
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="px-4 py-3 border rounded-lg"
            >
              <option>餐饮</option>
              <option>交通</option>
              <option>住宿</option>
              <option>办公</option>
              <option>招待</option>
              <option>其他</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="描述"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-4 py-3 border rounded-lg"
            required
          />
          <input
            type="text"
            placeholder="备注（可选）"
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            className="w-full px-4 py-3 border rounded-lg"
          />
          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            保存
          </button>
        </form>
      )}

      {/* 费用列表 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm text-gray-500">日期</th>
              <th className="px-6 py-3 text-left text-sm text-gray-500">描述</th>
              <th className="px-6 py-3 text-left text-sm text-gray-500">分类</th>
              <th className="px-6 py-3 text-right text-sm text-gray-500">金额</th>
              <th className="px-6 py-3 text-center text-sm text-gray-500">状态</th>
              <th className="px-6 py-3 text-center text-sm text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {expenses.expenses?.map((e: any) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(e.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">{e.description}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm">
                    {e.category}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-semibold">
                  ¥{e.amount.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-center">
                  <span
                    className={`px-2 py-1 rounded text-sm ${
                      e.status === 'done'
                        ? 'bg-green-100 text-green-600'
                        : e.status === 'processing'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {e.status === 'done'
                      ? '已报销'
                      : e.status === 'processing'
                      ? '报销中'
                      : '未报销'}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => {
                      if (confirm('确定删除？')) {
                        expenses.delete(e.id)
                      }
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {(!expenses.expenses || expenses.expenses.length === 0) && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                  暂无费用记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 汇总信息 */}
      {expenses.summary && (
        <div className="bg-white p-4 rounded-xl shadow-sm flex justify-between text-sm">
          <span>总金额: ¥{expenses.summary.totalAmount.toFixed(2)}</span>
          <span>待报销: ¥{expenses.summary.pendingAmount.toFixed(2)}</span>
          <span>报销中: ¥{expenses.summary.processingAmount.toFixed(2)}</span>
          <span>已报销: ¥{expenses.summary.doneAmount.toFixed(2)}</span>
        </div>
      )}
    </div>
  )
}

// ==================== AI 测试页面 ====================

function TestAIView() {
  const { ai, aiConfig } = useApp()
  const [result, setResult] = useState<any>(null)

  const testInvoice = async () => {
    try {
      // 使用测试图片（这里用一个示例 base64，实际使用时应上传真实图片）
      const testImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
      const res = await ai.recognize([testImage], 'invoice')
      setResult(res)
    } catch (error: any) {
      alert(error.message)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">AI 识别测试</h2>

      {/* AI 配置状态 */}
      <div className={`p-4 rounded-xl ${
        aiConfig.defaultConfig 
          ? 'bg-green-50 border border-green-200' 
          : 'bg-yellow-50 border border-yellow-200'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`font-semibold ${
              aiConfig.defaultConfig ? 'text-green-800' : 'text-yellow-800'
            }`}>
              {aiConfig.defaultConfig ? '✅ AI 已配置' : '⚠️ AI 未配置'}
            </h3>
            <p className={`text-sm mt-1 ${
              aiConfig.defaultConfig ? 'text-green-700' : 'text-yellow-700'
            }`}>
              {aiConfig.defaultConfig 
                ? `当前使用: ${aiConfig.defaultConfig.name} (${aiConfig.defaultConfig.provider})`
                : '请先在设置中配置 AI 模型，否则将使用模拟数据'
              }
            </p>
          </div>
          {!aiConfig.defaultConfig && (
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                // 触发设置页面
                const settingsBtn = document.querySelector('[data-settings-btn]') as HTMLButtonElement
                settingsBtn?.click()
              }}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
            >
              去配置
            </a>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm">
        <p className="text-gray-600 mb-4">
          点击下面的按钮测试 AI 识别功能。
          {!aiConfig.defaultConfig && ' 由于未配置 AI，将返回模拟数据。'}
        </p>
        <button
          onClick={testInvoice}
          disabled={ai.loading}
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {ai.loading ? '识别中...' : '测试发票识别'}
        </button>

        {result && (
          <div className="mt-6">
            <h3 className="font-semibold mb-2">识别结果：</h3>
            <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* 支持的 AI 模型列表 */}
      <div className="bg-white p-6 rounded-xl shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4">支持的 AI 模型</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(aiConfig.providers || {}).map(([key, provider]) => (
            <div key={key} className="p-3 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-800">{provider.name}</div>
              <div className="text-xs text-gray-500 mt-1">{provider.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ==================== 应用入口 ====================

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}

function AppContent() {
  const { auth } = useApp()

  if (!auth.isLoggedIn) {
    return <LoginPage />
  }

  return <MainApp />
}

// 渲染应用
const root = createRoot(document.getElementById('root')!)
root.render(<App />)

export default App

