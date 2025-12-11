/**
 * PDF 文本提取服务
 * 
 * 使用 unpdf 库提取 PDF 文档中的文本内容
 * 提取的文本会传给 AI 进行结构化处理
 */

/**
 * PDF 提取结果
 */
export interface PDFExtractionResult {
  success: boolean
  text: string
  pageCount?: number
  error?: string
}

/**
 * 从 Base64 数据中判断是否是 PDF
 */
export function isPDF(base64Data: string): boolean {
  // 检查 MIME 类型
  if (base64Data.startsWith('data:application/pdf')) {
    return true
  }
  
  // 检查 PDF 文件头 (JVBERi0 是 %PDF- 的 Base64 编码)
  const pureBase64 = base64Data.includes(',') 
    ? base64Data.split(',')[1] 
    : base64Data
  
  return pureBase64.startsWith('JVBERi0')
}

/**
 * 获取纯 Base64 数据（去掉 data URL 前缀）
 */
function getPureBase64(base64Data: string): string {
  if (base64Data.includes(',')) {
    return base64Data.split(',')[1]
  }
  return base64Data
}

/**
 * 使用 unpdf 提取 PDF 文本
 */
export async function extractPDFText(base64Data: string): Promise<PDFExtractionResult> {
  try {
    const { extractText, getDocumentProxy } = await import('unpdf')
    
    // 将 Base64 转换为 Uint8Array
    const pureBase64 = getPureBase64(base64Data)
    const binaryString = Buffer.from(pureBase64, 'base64')
    const uint8Array = new Uint8Array(binaryString)
    
    // 加载 PDF 并提取文本
    const pdf = await getDocumentProxy(uint8Array)
    const pageCount = pdf.numPages
    const { text } = await extractText(pdf, { mergePages: true })
    
    console.log('[PDF] 文本提取成功，页数:', pageCount, '文本长度:', (text as string).length)
    
    return {
      success: true,
      text: text as string,
      pageCount,
    }
  } catch (error: any) {
    console.error('[PDF] 提取失败:', error?.message)
    return {
      success: false,
      text: '',
      error: `PDF提取失败: ${error?.message}`,
    }
  }
}

/**
 * 批量提取多个 PDF 的文本
 */
export async function extractPDFTextBatch(pdfDataList: string[]): Promise<PDFExtractionResult[]> {
  const results: PDFExtractionResult[] = []
  
  for (let i = 0; i < pdfDataList.length; i++) {
    console.log(`[PDF] 处理第 ${i + 1}/${pdfDataList.length} 个 PDF`)
    const result = await extractPDFText(pdfDataList[i])
    results.push(result)
  }
  
  return results
}

/**
 * 合并多个 PDF 提取结果的文本
 */
export function mergePDFTexts(results: PDFExtractionResult[]): string {
  return results
    .filter(r => r.success && r.text)
    .map(r => r.text)
    .join('\n\n--- 下一个文档 ---\n\n')
}

export default {
  isPDF,
  extractPDFText,
  extractPDFTextBatch,
  mergePDFTexts,
}








