/**
 * 统计概览 API
 * 
 * GET /api/statistics/overview
 * 获取报销统计数据
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { errorHandlerMiddleware } from '../../../middlewares/error-handler.middleware'
import { 
  ExpenseItem, 
  Report, 
  LoanRecord, 
  StatisticsOverviewSchema, 
  STATE_GROUPS, 
  ErrorResponseSchema 
} from '../types'

// 查询参数
const queryParams = [
  { name: 'userId', description: '用户ID' },
  { name: 'period', description: '时间范围：3m/6m/1y' },
]

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'GetStatisticsOverview',
  description: '获取统计概览',
  path: '/api/statistics/overview',
  method: 'GET',
  flows: ['reimbursement-statistics'],
  emits: [],
  middleware: [errorHandlerMiddleware],
  queryParams,
  responseSchema: {
    200: StatisticsOverviewSchema,
    400: ErrorResponseSchema,
  },
}

export const handler: Handlers['GetStatisticsOverview'] = async (req, { state, logger }) => {
  const userId = req.queryParams.userId as string
  const period = (req.queryParams.period as string) || '6m'

  if (!userId) {
    return {
      status: 400,
      body: { error: '参数错误', message: '缺少 userId 参数' },
    }
  }

  logger.info('获取统计概览', { userId, period })

  // 获取所有数据
  const expenses = await state.getGroup<ExpenseItem>(`${STATE_GROUPS.EXPENSES}_${userId}`)
  const reports = await state.getGroup<Report>(`${STATE_GROUPS.REPORTS}_${userId}`)
  const loans = await state.getGroup<LoanRecord>(`${STATE_GROUPS.LOANS}_${userId}`)

  // 计算统计数据
  // 1. 已提交报销金额（状态为 submitted 的报销单）
  const submittedReportsAmount = reports
    .filter(r => r.status === 'submitted')
    .reduce((sum, r) => sum + r.payableAmount, 0)

  // 2. 待处理费用金额（状态为 pending 的费用）
  const pendingExpensesAmount = expenses
    .filter(e => e.status === 'pending')
    .reduce((sum, e) => sum + e.amount, 0)

  // 3. 待报销总额
  const totalPending = submittedReportsAmount + pendingExpensesAmount

  // 4. 借款金额（未还清的借款）
  const activeLoanAmount = loans
    .filter(l => l.status !== 'paid')
    .reduce((sum, l) => sum + l.amount, 0)

  // 5. 预计收款总额
  const totalReceivable = totalPending - activeLoanAmount

  // 6. 计算月度数据
  const monthlyData = calculateMonthlyData(reports, period)

  logger.info('统计概览获取成功', { userId })

  return {
    status: 200,
    body: {
      totalPending,
      activeLoanAmount,
      totalReceivable,
      submittedReportsAmount,
      pendingExpensesAmount,
      monthlyData,
    },
  }
}

/**
 * 计算月度报销数据
 */
function calculateMonthlyData(reports: Report[], period: string) {
  const now = new Date()
  let monthCount = 6

  switch (period) {
    case '3m':
      monthCount = 3
      break
    case '6m':
      monthCount = 6
      break
    case '1y':
      monthCount = 12
      break
  }

  const monthlyData: { month: string; amount: number }[] = []

  for (let i = monthCount - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = `${date.getMonth() + 1}月`
    const year = date.getFullYear()
    const monthStart = new Date(year, date.getMonth(), 1)
    const monthEnd = new Date(year, date.getMonth() + 1, 0, 23, 59, 59)

    // 计算该月已完成的报销金额
    const monthAmount = reports
      .filter(r => {
        const reportDate = new Date(r.createdDate)
        return r.status === 'paid' && reportDate >= monthStart && reportDate <= monthEnd
      })
      .reduce((sum, r) => sum + r.payableAmount, 0)

    monthlyData.push({ month, amount: monthAmount })
  }

  return monthlyData
}









