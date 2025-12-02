/**
 * 图片压缩工具
 * 
 * 解决 E2BIG 错误：当图片 Base64 数据太大时，
 * Node.js spawn 子进程会因为参数列表过长而失败
 */

import sharp from 'sharp'

/**
 * 压缩配置
 */
interface CompressOptions {
  maxWidth?: number      // 最大宽度，默认 1600px
  maxHeight?: number     // 最大高度，默认 1600px
  quality?: number       // JPEG 质量，默认 80
  maxSizeKB?: number     // 最大文件大小（KB），默认 500KB
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 80,
  maxSizeKB: 500,
}

/**
 * 压缩单张图片
 * @param base64Image Base64 图片数据（可带或不带 data URL 前缀）
 * @param options 压缩选项
 * @returns 压缩后的 Base64 数据（带 data URL 前缀）
 */
export async function compressImage(
  base64Image: string,
  options: CompressOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  // 提取纯 Base64 数据
  let base64Data = base64Image
  let mimeType = 'image/jpeg'
  
  if (base64Image.includes(',')) {
    const parts = base64Image.split(',')
    const header = parts[0]
    base64Data = parts[1]
    
    // 提取 MIME 类型
    const mimeMatch = header.match(/data:([^;]+);/)
    if (mimeMatch) {
      mimeType = mimeMatch[1]
    }
  }

  // 转换为 Buffer
  const inputBuffer = Buffer.from(base64Data, 'base64')
  const originalSize = inputBuffer.length / 1024 // KB
  
  console.log(`[图片压缩] 原始大小: ${originalSize.toFixed(2)} KB`)
  
  // 如果图片已经很小，直接返回
  if (originalSize <= (opts.maxSizeKB || 500)) {
    console.log(`[图片压缩] 图片已经足够小，跳过压缩`)
    return base64Image.includes(',') ? base64Image : `data:${mimeType};base64,${base64Image}`
  }

  try {
    // 使用 sharp 压缩
    let image = sharp(inputBuffer)
    
    // 获取图片元数据
    const metadata = await image.metadata()
    console.log(`[图片压缩] 原始尺寸: ${metadata.width}x${metadata.height}`)
    
    // 调整尺寸
    if (metadata.width && metadata.height) {
      if (metadata.width > (opts.maxWidth || 1600) || metadata.height > (opts.maxHeight || 1600)) {
        image = image.resize(opts.maxWidth, opts.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        console.log(`[图片压缩] 调整尺寸至最大 ${opts.maxWidth}x${opts.maxHeight}`)
      }
    }
    
    // 转换为 JPEG 并压缩
    const outputBuffer = await image
      .jpeg({ quality: opts.quality || 80 })
      .toBuffer()
    
    const compressedSize = outputBuffer.length / 1024 // KB
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1)
    
    console.log(`[图片压缩] 压缩后大小: ${compressedSize.toFixed(2)} KB (节省 ${compressionRatio}%)`)
    
    // 转换回 Base64
    const compressedBase64 = outputBuffer.toString('base64')
    return `data:image/jpeg;base64,${compressedBase64}`
    
  } catch (error) {
    console.error('[图片压缩] 压缩失败，返回原图:', error)
    return base64Image.includes(',') ? base64Image : `data:${mimeType};base64,${base64Image}`
  }
}

/**
 * 批量压缩图片
 * @param images Base64 图片数组
 * @param options 压缩选项
 * @returns 压缩后的图片数组
 */
export async function compressImages(
  images: string[],
  options: CompressOptions = {}
): Promise<string[]> {
  console.log(`[图片压缩] 开始压缩 ${images.length} 张图片`)
  
  const results = await Promise.all(
    images.map((img, index) => {
      console.log(`[图片压缩] 处理第 ${index + 1}/${images.length} 张图片`)
      return compressImage(img, options)
    })
  )
  
  console.log(`[图片压缩] 全部压缩完成`)
  return results
}

/**
 * 检查图片是否需要压缩
 * @param base64Image Base64 图片数据
 * @param maxSizeKB 最大允许大小（KB）
 * @returns 是否需要压缩
 */
export function needsCompression(base64Image: string, maxSizeKB: number = 500): boolean {
  let base64Data = base64Image
  if (base64Image.includes(',')) {
    base64Data = base64Image.split(',')[1]
  }
  
  const sizeKB = Buffer.from(base64Data, 'base64').length / 1024
  return sizeKB > maxSizeKB
}

