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

    if (req.method === 'GET') {
      const { data: currentProfile, error: currentError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (currentError || !currentProfile) {
        return jsonResponse({ error: '用户不存在' }, 404)
      }

      const { data: paymentAccounts } = await supabase
        .from('payment_accounts')
        .select('*')
        .eq('user_id', userId)

      const { data: budgetProjects } = await supabase
        .from('budget_projects')
        .select('*')
        .eq('user_id', userId)

      let users = [
        {
          ...currentProfile,
          isCurrent: true,
        },
      ]

      if (currentProfile.role === 'admin') {
        const { data: allProfiles } = await supabase.from('profiles').select('*')
        users = (allProfiles || []).map((item) => ({
          ...item,
          isCurrent: item.id === userId,
        }))
      }

      return jsonResponse({
        currentUser: { ...currentProfile, isCurrent: true },
        users,
        paymentAccounts: paymentAccounts || [],
        budgetProjects: budgetProjects || [],
      })
    }

    if (req.method === 'PUT') {
      const body = await req.json()
      const { name, department, email } = body as {
        name?: string
        department?: string
        email?: string
      }

      const updateData: Record<string, string> = {}
      if (name !== undefined) updateData.name = name
      if (department !== undefined) updateData.department = department
      if (email !== undefined) updateData.email = email
      updateData.updated_at = new Date().toISOString()

      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single()

      if (updateError || !updatedProfile) {
        return jsonResponse({ error: '更新失败' }, 500)
      }

      return jsonResponse({
        success: true,
        user: updatedProfile,
      })
    }

    return jsonResponse({ error: `不支持 ${req.method} 方法` }, 405)
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误'
    const status = message === 'Unauthorized' ? 401 : 500
    return jsonResponse({ error: message }, status)
  }
})
