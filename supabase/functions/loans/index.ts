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
      const { data: loans, error } = await supabase
        .from('loans')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        return jsonResponse({ error: 'Failed to fetch loans' }, 400)
      }

      return jsonResponse({ success: true, loans })
    }

    if (req.method === 'POST') {
      const body = await req.json()

      const id = `loan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      const { data: loan, error } = await supabase
        .from('loans')
        .insert({
          id,
          user_id: userId,
          amount: body.amount,
          reason: body.reason,
          date: body.date,
          approval_number: body.approval_number,
          status: 'draft',
          budget_project_id: body.budget_project_id,
          budget_project_data: body.budget_project_data,
          payment_method: body.payment_method || 'transfer',
          payee_info: body.payee_info,
          user_snapshot: profile,
        })
        .select()
        .single()

      if (error) {
        return jsonResponse({ error: 'Failed to create loan' }, 400)
      }

      return jsonResponse({ success: true, loan }, 201)
    }

    return jsonResponse({ error: 'Method not allowed' }, 405)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : 400
    return jsonResponse({ error: message }, status)
  }
})