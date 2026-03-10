import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createSupabaseClient, corsHeaders, handleOptions } from '../_shared/supabase.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions()

  const supabase = createSupabaseClient(req)
  const url = new URL(req.url)
  const method = req.method

  try {
    // 解析路径参数 - /expenses/:id
    const pathParts = url.pathname.split('/').filter(Boolean)
    const expenseId = pathParts.length > 1 ? pathParts[1] : null

    // GET /expenses - 获取费用列表
    if (method === 'GET' && !expenseId) {
      const userId = url.searchParams.get('userId')
      const statusFilter = url.searchParams.get('status')

      if (!userId) {
        return new Response(JSON.stringify({ error: '缺少 userId 参数' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // 获取用户的所有费用记录
      let query = supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)

      // 按状态筛选
      if (statusFilter && ['pending', 'processing', 'done'].includes(statusFilter)) {
        query = query.eq('status', statusFilter)
      }

      // 按日期倒序排列
      query = query.order('date', { ascending: false })

      const { data: expenses, error } = await query

      if (error) throw error

      // 计算汇总
      const allExpenses = (expenses || []) as Array<{ amount: number | string | null; status: string }>
      const toAmount = (value: number | string | null) =>
        typeof value === 'number' ? value : Number(value || 0)
      const summary = {
        totalAmount: allExpenses.reduce((sum, e) => sum + toAmount(e.amount), 0),
        pendingAmount: allExpenses.filter((e) => e.status === 'pending').reduce((sum, e) => sum + toAmount(e.amount), 0),
        processingAmount: allExpenses.filter((e) => e.status === 'processing').reduce((sum, e) => sum + toAmount(e.amount), 0),
        doneAmount: allExpenses.filter((e) => e.status === 'done').reduce((sum, e) => sum + toAmount(e.amount), 0),
      }

      return new Response(
        JSON.stringify({
          expenses,
          total: expenses?.length || 0,
          summary,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // POST /expenses - 创建费用
    if (method === 'POST' && !expenseId) {
      const body = await req.json()
      const { userId, amount, description, date, category, remarks } = body

      // 验证必填字段
      if (!userId || !amount || !description || !date || !category) {
        return new Response(
          JSON.stringify({ error: '缺少必填字段：userId, amount, description, date, category' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // 验证金额
      if (typeof amount !== 'number' || amount <= 0) {
        return new Response(
          JSON.stringify({ error: '金额必须大于0' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // 生成唯一 ID
      const id = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const now = new Date().toISOString()

      const expense = {
        id,
        user_id: userId,
        amount,
        description,
        date,
        category,
        remarks: remarks || '',
        status: 'pending',
        created_at: now,
        updated_at: now,
      }

      const { data, error } = await supabase
        .from('expenses')
        .insert(expense)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true, expense: data }),
        {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // PUT /expenses/:id - 更新费用
    if (method === 'PUT' && expenseId) {
      const body = await req.json()
      const { userId, ...updateData } = body

      if (!userId) {
        return new Response(
          JSON.stringify({ error: '缺少 userId 参数' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // 验证状态值
      if (updateData.status && !['pending', 'processing', 'done'].includes(updateData.status)) {
        return new Response(
          JSON.stringify({ error: '无效的状态值' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // 验证金额
      if (updateData.amount !== undefined && (typeof updateData.amount !== 'number' || updateData.amount <= 0)) {
        return new Response(
          JSON.stringify({ error: '金额必须大于0' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // 检查记录是否存在
      const { data: existing, error: findError } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', expenseId)
        .eq('user_id', userId)
        .single()

      if (findError || !existing) {
        return new Response(
          JSON.stringify({ error: '记录不存在', message: '未找到指定的费用记录' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // 更新记录
      const updatePayload = {
        ...updateData,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('expenses')
        .update(updatePayload)
        .eq('id', expenseId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true, expense: data }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // DELETE /expenses/:id - 删除费用
    if (method === 'DELETE' && expenseId) {
      const userId = url.searchParams.get('userId')

      if (!userId) {
        return new Response(
          JSON.stringify({ error: '缺少 userId 参数' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // 检查记录是否存在
      const { data: existing, error: findError } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', expenseId)
        .eq('user_id', userId)
        .single()

      if (findError || !existing) {
        return new Response(
          JSON.stringify({ error: '记录不存在', message: '未找到指定的费用记录' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // 删除记录
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId)
        .eq('user_id', userId)

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true, message: '费用记录已删除' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // 不支持的请求
    return new Response(
      JSON.stringify({ error: '不支持的请求方法或路径' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Expenses API Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || '服务器内部错误' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
