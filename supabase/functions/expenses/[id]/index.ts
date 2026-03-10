import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  createSupabaseClient,
  handleOptions,
  jsonResponse,
  requireAuth,
} from '../../_shared/supabase.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions()
  }

  try {
    const supabase = createSupabaseClient(req)
    const userId = await requireAuth(supabase)
    const url = new URL(req.url)
    const id = url.pathname.split('/').pop()

    if (req.method === 'PUT' && id && id !== 'expenses') {
      const body = await req.json()
      const { amount, description, date, category, remarks, status } = body

      const updateData: Record<string, unknown> = {}
      if (amount !== undefined) updateData.amount = amount
      if (description !== undefined) updateData.description = description
      if (date !== undefined) updateData.date = date
      if (category !== undefined) updateData.category = category
      if (remarks !== undefined) updateData.remarks = remarks
      if (status !== undefined) updateData.status = status

      const { data: expense, error } = await supabase
        .from('expenses')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        return jsonResponse({ error: 'Failed to update expense' }, 400)
      }

      return jsonResponse({ success: true, expense })
    }

    if (req.method === 'DELETE' && id && id !== 'expenses') {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) {
        return jsonResponse({ error: 'Failed to delete expense' }, 400)
      }

      return jsonResponse({ success: true })
    }

    return jsonResponse({ error: 'Method not allowed' }, 405)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : 400
    return jsonResponse({ error: message }, status)
  }
})
