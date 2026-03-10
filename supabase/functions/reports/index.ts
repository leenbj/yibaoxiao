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

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const status = url.searchParams.get('status')

      let query = supabase
        .from('reports')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (status) {
        query = query.eq('status', status)
      }

      const { data: reports, error } = await query

      if (error) {
        return jsonResponse({ error: 'Failed to fetch reports' }, 400)
      }

      return jsonResponse({ success: true, reports })
    }

    if (req.method === 'POST') {
      const body = await req.json()

      const id = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      const { data: report, error } = await supabase
        .from('reports')
        .insert({
          id,
          user_id: userId,
          title: body.title,
          created_date: new Date().toISOString().split('T')[0],
          status: 'draft',
          total_amount: body.total_amount,
          prepaid_amount: body.prepaid_amount || '0',
          payable_amount: body.payable_amount,
          approval_number: body.approval_number,
          budget_project_id: body.budget_project_id,
          budget_project_data: body.budget_project_data,
          payment_account_id: body.payment_account_id,
          payment_account_data: body.payment_account_data,
          user_snapshot: profile,
          invoice_count: body.invoice_count,
          is_travel: body.is_travel || false,
          trip_reason: body.trip_reason,
          trip_legs: body.trip_legs,
          taxi_details: body.taxi_details,
          ai_recognition_data: body.ai_recognition_data,
        })
        .select()
        .single()

      if (error) {
        return jsonResponse({ error: 'Failed to create report' }, 400)
      }

      if (body.items && body.items.length > 0) {
        const items = body.items.map((item: Record<string, unknown>) => ({
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          report_id: id,
          expense_id: item.expense_id,
          amount: item.amount,
          description: item.description,
          date: item.date,
          category: item.category,
          budget_project_data: item.budget_project_data,
        }))

        await supabase.from('report_items').insert(items)
      }

      return jsonResponse({ success: true, report }, 201)
    }

    return jsonResponse({ error: 'Method not allowed' }, 405)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : 400
    return jsonResponse({ error: message }, status)
  }
})