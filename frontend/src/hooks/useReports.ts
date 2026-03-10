import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface Report {
  id: string
  user_id: string
  title: string
  created_date: string
  status: 'draft' | 'submitted' | 'paid'
  total_amount: string
  prepaid_amount: string
  payable_amount: string
  approval_number: string | null
  budget_project_id: string | null
  budget_project_data: Record<string, unknown> | null
  payment_account_id: string | null
  payment_account_data: Record<string, unknown> | null
  user_snapshot: Record<string, unknown>
  invoice_count: number | null
  is_travel: boolean
  trip_reason: string | null
  trip_legs: Record<string, unknown>[] | null
  taxi_details: Record<string, unknown>[] | null
  ai_recognition_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

interface ReportItem {
  id: string
  report_id: string
  expense_id: string | null
  amount: string
  description: string
  date: string
  category: string | null
  budget_project_data: Record<string, unknown> | null
  created_at: string
}

interface Attachment {
  id: string
  report_id: string | null
  loan_id: string | null
  type: string
  storage_path: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  created_at: string
}

interface UseReportsOptions {
  userId?: string
}

export function useReports(options: UseReportsOptions = {}) {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReports = useCallback(async () => {
    if (!options.userId) return

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', options.userId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    setReports((data || []) as Report[])
    setLoading(false)
  }, [options.userId])

  const fetchReportDetail = useCallback(async (id: string) => {
    setLoading(true)

    const [reportResult, itemsResult, attachmentsResult] = await Promise.all([
      supabase.from('reports').select('*').eq('id', id).single(),
      supabase.from('report_items').select('*').eq('report_id', id),
      supabase.from('attachments').select('*').eq('report_id', id)
    ])

    setLoading(false)

    if (reportResult.error) {
      setError(reportResult.error.message)
      return null
    }

    return {
      report: reportResult.data as Report,
      items: (itemsResult.data || []) as ReportItem[],
      attachments: (attachmentsResult.data || []) as Attachment[]
    }
  }, [])

  const createReport = useCallback(async (
    report: Omit<Report, 'id' | 'user_id'>,
    items: Omit<ReportItem, 'id' | 'report_id'>[] = []
  ) => {
    if (!options.userId) return { success: false, error: 'User not authenticated' }

    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const { data, error: createError } = await supabase
      .from('reports')
      .insert({
        id: reportId,
        user_id: options.userId,
        ...report,
      })
      .select()
      .single()

    if (createError) {
      return { success: false, error: createError.message }
    }

    if (items.length > 0) {
      const itemsToInsert = items.map(item => ({
        ...item,
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        report_id: reportId
      }))

      await supabase.from('report_items').insert(itemsToInsert)
    }

    setReports(prev => [data as Report, ...prev])
    return { success: true, data }
  }, [options.userId])

  const updateReport = useCallback(async (id: string, updates: Partial<Report>) => {
    const { data, error: updateError } = await supabase
      .from('reports')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    setReports(prev => prev.map(r => r.id === id ? (data as Report) : r))
    return { success: true, data }
  }, [])

  const updateReportStatus = useCallback(async (id: string, status: Report['status']) => {
    return updateReport(id, { status })
  }, [updateReport])

  const deleteReport = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase
      .from('reports')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return { success: false, error: deleteError.message }
    }

    setReports(prev => prev.filter(r => r.id !== id))
    return { success: true }
  }, [])

  const uploadAttachment = useCallback(async (
    reportId: string,
    file: File,
    type: string
  ) => {
    if (!options.userId) return { success: false, error: 'User not authenticated' }

    const filePath = `${options.userId}/${reportId}/${Date.now()}_${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(filePath, file)

    if (uploadError) {
      return { success: false, error: uploadError.message }
    }

    const attachmentId = `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const { data, error: insertError } = await supabase
      .from('attachments')
      .insert({
        id: attachmentId,
        report_id: reportId,
        type,
        storage_path: filePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type
      })
      .select()
      .single()

    if (insertError) {
      return { success: false, error: insertError.message }
    }

    return { success: true, data }
  }, [options.userId])

  const getAttachmentUrl = useCallback(async (storagePath: string) => {
    const { data } = await supabase.storage
      .from('attachments')
      .getPublicUrl(storagePath)

    return data.publicUrl
  }, [])

  return {
    reports,
    loading,
    error,
    fetchReports,
    fetchReportDetail,
    createReport,
    updateReport,
    updateReportStatus,
    deleteReport,
    uploadAttachment,
    getAttachmentUrl
  }
}
