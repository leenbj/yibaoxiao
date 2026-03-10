import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  createSupabaseClient,
  handleOptions,
  jsonResponse,
  requireAuth,
} from '../_shared/supabase.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions()
  }

  try {
    const supabase = createSupabaseClient(req)
    const userId = await requireAuth(supabase)
    const url = new URL(req.url)
    const period = url.searchParams.get('period') || '6m'

    const periodMonths: Record<string, number> = {
      '1m': 1,
      '3m': 3,
      '6m': 6,
      '1y': 12,
    }

    const months = periodMonths[period] || 6
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)

    const startDateStr = startDate.toISOString().split('T')[0]

    const [expensesResult, reportsResult, loansResult] = await Promise.all([
      supabase
        .from('expenses')
        .select('amount, status, category')
        .eq('user_id', userId)
        .gte('date', startDateStr),
      supabase
        .from('reports')
        .select('total_amount, status')
        .eq('user_id', userId)
        .gte('created_date', startDateStr),
      supabase
        .from('loans')
        .select('amount, status')
        .eq('user_id', userId)
        .gte('date', startDateStr),
    ])

    const expenses = expensesResult.data || []
    const reports = reportsResult.data || []
    const loans = loansResult.data || []

    const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0)
    const pendingExpenses = expenses
      .filter(e => e.status === 'pending')
      .reduce((sum, e) => sum + parseFloat(e.amount), 0)

    const totalReports = reports.reduce((sum, r) => sum + parseFloat(r.total_amount), 0)
    const submittedReports = reports.filter(r => r.status === 'submitted').length
    const paidReports = reports.filter(r => r.status === 'paid').length

    const totalLoans = loans.reduce((sum, l) => sum + parseFloat(l.amount), 0)
    const pendingLoans = loans.filter(l => l.status !== 'paid').length

    const categoryBreakdown = expenses.reduce((acc, e) => {
      const category = e.category || '其他'
      acc[category] = (acc[category] || 0) + parseFloat(e.amount)
      return acc
    }, {} as Record<string, number>)

    const overview = {
      period,
      startDate: startDateStr,
      endDate: new Date().toISOString().split('T')[0],
      expenses: {
        total: totalExpenses,
        pending: pendingExpenses,
        count: expenses.length,
      },
      reports: {
        total: totalReports,
        submitted: submittedReports,
        paid: paidReports,
        count: reports.length,
      },
      loans: {
        total: totalLoans,
        pending: pendingLoans,
        count: loans.length,
      },
      categoryBreakdown,
    }

    return jsonResponse({ success: true, overview })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : 400
    return jsonResponse({ error: message }, status)
  }
})