import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface Expense {
  id: string
  user_id: string
  amount: string
  description: string
  date: string
  category: string
  remarks: string | null
  status: 'pending' | 'processing' | 'done'
  created_at: string
  updated_at: string
}

interface UseExpensesOptions {
  userId?: string
}

export function useExpenses(options: UseExpensesOptions = {}) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchExpenses = useCallback(async () => {
    if (!options.userId) return

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', options.userId)
      .order('date', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    setExpenses((data || []) as Expense[])
    setLoading(false)
  }, [options.userId])

  const createExpense = useCallback(async (expense: Omit<Expense, 'id' | 'user_id' | 'status' | 'created_at' | 'updated_at'>) => {
    if (!options.userId) return { success: false, error: 'User not authenticated' }

    const id = `expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const { data, error: createError } = await supabase
      .from('expenses')
      .insert({
        id,
        user_id: options.userId,
        status: 'pending',
        ...expense,
      })
      .select()
      .single()

    if (createError) {
      return { success: false, error: createError.message }
    }

    setExpenses(prev => [data as Expense, ...prev])
    return { success: true, data }
  }, [options.userId])

  const updateExpense = useCallback(async (id: string, updates: Partial<Expense>) => {
    const { data, error: updateError } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    setExpenses(prev => prev.map(e => e.id === id ? (data as Expense) : e))
    return { success: true, data }
  }, [])

  const deleteExpense = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return { success: false, error: deleteError.message }
    }

    setExpenses(prev => prev.filter(e => e.id !== id))
    return { success: true }
  }, [])

  return {
    expenses,
    loading,
    error,
    fetchExpenses,
    createExpense,
    updateExpense,
    deleteExpense
  }
}
