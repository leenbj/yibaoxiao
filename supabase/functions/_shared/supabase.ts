/**
 * Supabase Edge Functions - 共享模块
 * 
 * 提供 Supabase 客户端创建和 CORS 处理
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// CORS 响应头
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

/**
 * 处理 OPTIONS 请求（预检请求）
 */
export function handleOptions(): Response {
  return new Response('ok', { headers: corsHeaders })
}

/**
 * 创建 Supabase 客户端
 * 
 * @param req - HTTP 请求对象
 * @returns Supabase 客户端实例
 */
export function createSupabaseClient(req: Request) {
  const authHeader = req.headers.get('Authorization')
  
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: authHeader ? { Authorization: authHeader } : undefined,
      },
      auth: {
        persistSession: false,
      },
    }
  )
}

/**
 * 创建带有 Service Role Key 的 Supabase 客户端（用于需要绕过 RLS 的操作）
 * 
 * @returns Supabase 客户端实例
 */
export function createServiceRoleClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        persistSession: false,
      },
    }
  )
}

/**
 * 获取当前用户信息
 * 
 * @param supabase - Supabase 客户端
 * @returns 用户信息或 null
 */
export async function getCurrentUser(supabase: ReturnType<typeof createClient>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }
  
  return user
}

/**
 * 验证用户是否已登录
 * 
 * @param supabase - Supabase 客户端
 * @returns 用户 ID 或抛出错误
 */
export async function requireAuth(supabase: ReturnType<typeof createClient>): Promise<string> {
  const user = await getCurrentUser(supabase)
  
  if (!user) {
    throw new Error('Unauthorized')
  }
  
  return user.id
}

/**
 * 创建 JSON 响应
 * 
 * @param data - 响应数据
 * @param status - HTTP 状态码
 * @returns Response 对象
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * 创建错误响应
 * 
 * @param message - 错误消息
 * @param status - HTTP 状态码
 * @returns Response 对象
 */
export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status)
}
