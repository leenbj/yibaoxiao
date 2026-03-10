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
    const pathParts = url.pathname.split('/').filter(Boolean)
    const resource = pathParts[pathParts.length - 1]

    if (resource === 'payees') {
      if (req.method === 'GET') {
        const { data: payees, error } = await supabase
          .from('payment_accounts')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (error) {
          return jsonResponse({ error: 'Failed to fetch payees' }, 400)
        }

        return jsonResponse({ success: true, payees })
      }

      if (req.method === 'POST') {
        const body = await req.json()
        const id = `pa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        const { data: payee, error } = await supabase
          .from('payment_accounts')
          .insert({
            id,
            user_id: userId,
            bank_name: body.bank_name,
            bank_branch: body.bank_branch,
            account_number: body.account_number,
            account_name: body.account_name,
            is_default: body.is_default || false,
          })
          .select()
          .single()

        if (error) {
          return jsonResponse({ error: 'Failed to create payee' }, 400)
        }

        return jsonResponse({ success: true, payee }, 201)
      }
    }

    if (resource === 'projects') {
      if (req.method === 'GET') {
        const { data: projects, error } = await supabase
          .from('budget_projects')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (error) {
          return jsonResponse({ error: 'Failed to fetch projects' }, 400)
        }

        return jsonResponse({ success: true, projects })
      }

      if (req.method === 'POST') {
        const body = await req.json()
        const id = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        const { data: project, error } = await supabase
          .from('budget_projects')
          .insert({
            id,
            user_id: userId,
            name: body.name,
            code: body.code,
            is_default: body.is_default || false,
          })
          .select()
          .single()

        if (error) {
          return jsonResponse({ error: 'Failed to create project' }, 400)
        }

        return jsonResponse({ success: true, project }, 201)
      }
    }

    if (resource === 'ai-config') {
      if (req.method === 'GET') {
        const { data: configs, error } = await supabase
          .from('ai_configs')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (error) {
          return jsonResponse({ error: 'Failed to fetch AI configs' }, 400)
        }

        const sanitizedConfigs = configs.map(({ api_key, ...rest }) => ({
          ...rest,
          api_key: '***',
        }))

        return jsonResponse({ success: true, configs: sanitizedConfigs })
      }

      if (req.method === 'POST') {
        const body = await req.json()
        const id = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        const { data: config, error } = await supabase
          .from('ai_configs')
          .insert({
            id,
            user_id: userId,
            provider: body.provider,
            api_key: body.api_key,
            api_url: body.api_url,
            model: body.model,
            is_active: body.is_active || false,
          })
          .select()
          .single()

        if (error) {
          return jsonResponse({ error: 'Failed to create AI config' }, 400)
        }

        const { api_key, ...sanitizedConfig } = config
        return jsonResponse({ success: true, config: { ...sanitizedConfig, api_key: '***' } }, 201)
      }
    }

    return jsonResponse({ error: 'Method not allowed' }, 405)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : 400
    return jsonResponse({ error: message }, status)
  }
})