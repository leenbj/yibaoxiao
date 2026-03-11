// 附件自动清理 Edge Function
// 定时清理过期的图片和文件附件，保留报销单记录

import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// 清理配置
const CONFIG = {
  batchSize: 100,        // 每次处理的批次大小
  logRetentionDays: 30,  // 清理日志保留天数
}

interface Attachment {
  id: string
  storage_path: string | null
  file_name: string | null
  file_size: bigint | null
  report_id: string | null
  loan_id: string | null
  data: string | null
}

// 获取待清理的附件
async function getExpiredAttachments(): Promise<Attachment[]> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('attachments')
    .select('id, storage_path, file_name, file_size, report_id, loan_id, data')
    .eq('is_cleaned', false)
    .lt('cleanup_after', now)
    .limit(CONFIG.batchSize)

  if (error) {
    console.error('获取过期附件失败:', error)
    return []
  }

  return data || []
}

// 从 Storage 删除文件
async function deleteFromStorage(paths: string[]): Promise<number> {
  if (paths.length === 0) return 0

  const { data, error } = await supabase.storage
    .from('attachments')
    .remove(paths)

  if (error) {
    console.error('Storage 删除失败:', error)
    return 0
  }

  return data?.length || 0
}

// 记录清理日志
async function logCleanup(
  attachment: Attachment,
  reason: string
): Promise<void> {
  await supabase
    .from('attachment_cleanup_logs')
    .insert({
      attachment_id: attachment.id,
      storage_path: attachment.storage_path,
      file_name: attachment.file_name,
      file_size: attachment.file_size,
      reason
    })
}

// 标记附件为已清理
async function markAsCleaned(attachmentIds: string[]): Promise<void> {
  if (attachmentIds.length === 0) return

  await supabase
    .from('attachments')
    .update({
      is_cleaned: true,
      storage_path: null,
      data: null,
      file_size: 0
    })
    .in('id', attachmentIds)
}

// 清理旧日志
async function cleanupOldLogs(): Promise<void> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - CONFIG.logRetentionDays)

  await supabase
    .from('attachment_cleanup_logs')
    .delete()
    .lt('created_at', cutoff.toISOString())
}

Deno.serve(async (req) => {
  const startTime = Date.now()

  try {
    console.log('开始附件清理任务...')

    // 获取过期附件
    const attachments = await getExpiredAttachments()

    if (attachments.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: '没有需要清理的附件',
        cleanedCount: 0,
        duration: Date.now() - startTime
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`发现 ${attachments.length} 个待清理附件`)

    // 提取 Storage 路径
    const storagePaths = attachments
      .filter(a => a.storage_path)
      .map(a => a.storage_path as string)

    // 从 Storage 删除文件
    const storageDeleted = await deleteFromStorage(storagePaths)

    // 统计 base64 数据清理
    const base64Cleaned = attachments.filter(a => a.data).length

    // 记录日志
    for (const att of attachments) {
      await logCleanup(att, '过期自动清理')
    }

    // 标记为已清理
    await markAsCleaned(attachments.map(a => a.id))

    // 清理旧日志
    await cleanupOldLogs()

    // 计算释放的空间
    const freedBytes = attachments.reduce((sum, a) => sum + Number(a.file_size || 0), 0)

    const result = {
      success: true,
      cleanedCount: attachments.length,
      storageDeleted,
      base64Cleaned,
      freedBytes,
      freedMB: Math.round(freedBytes / 1024 / 1024 * 100) / 100,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }

    console.log('清理结果:', result)

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('清理任务失败:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
