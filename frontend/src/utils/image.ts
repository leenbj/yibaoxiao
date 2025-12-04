/**
 * 易报销系统 - 图片处理工具函数
 * 包含图片压缩、PDF转图片等功能
 * 
 * 压缩策略说明：
 * - 优先使用 WebP 格式（比 JPEG 压缩效率高 30-50%）
 * - 两阶段压缩：先降质量保分辨率，再降分辨率
 * - 针对 2核4G 服务器优化，平衡质量与内存占用
 */

import imageCompression from 'browser-image-compression';
import { COMPRESS_CONFIG, checkWebPSupport } from '../constants';

// 缓存 WebP 支持检测结果
let webpSupportCache: boolean | null = null;

/**
 * 获取是否支持 WebP（带缓存）
 */
const isWebPSupported = (): boolean => {
  if (webpSupportCache === null) {
    webpSupportCache = checkWebPSupport();
  }
  return webpSupportCache;
};

/**
 * 获取实际使用的图片格式
 */
const getOutputFormat = (): string => {
  return isWebPSupported() ? COMPRESS_CONFIG.fileType : COMPRESS_CONFIG.fallbackFileType;
};

/**
 * 获取文件扩展名
 */
const getFileExtension = (format: string): string => {
  return format === 'image/webp' ? '.webp' : '.jpg';
};

/**
 * 将文件转换为Base64编码（带智能压缩）
 *
 * 服务器配置：2核4G Linux，Node.js 堆内存 1GB
 * 
 * 压缩策略：
 * 1. 小于限制的文件 → 直接转换（不压缩）
 * 2. 超过限制 → 使用 WebP 格式压缩（效率更高）
 * 3. 两阶段压缩：先降质量保分辨率，再降分辨率
 *
 * @param file 待处理的图片文件
 * @returns Base64编码的图片字符串
 * @throws 当图片无法压缩到服务器限制时抛出错误
 */
export const fileToBase64 = async (file: File): Promise<string> => {
  const originalSizeKB = file.size / 1024;
  const serverLimitKB = COMPRESS_CONFIG.serverLimitKB;
  const outputFormat = getOutputFormat();

  // 小于限制的文件完全不压缩，直接转换
  if (originalSizeKB <= serverLimitKB) {
    console.log(`[上传] ${file.name}: ${originalSizeKB.toFixed(1)}KB (≤${serverLimitKB}KB，无需压缩)`);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  }
  
  const formatName = outputFormat === 'image/webp' ? 'WebP' : 'JPEG';
  console.log(`[上传] ${file.name}: ${originalSizeKB.toFixed(1)}KB → 使用 ${formatName} 压缩到 ${serverLimitKB}KB 以下`);

  /**
   * 执行压缩
   */
  const compressWithStrategy = async (
    inputFile: File, 
    maxSizeMB: number, 
    quality: number,
    maxDimension: number
  ): Promise<File> => {
    return imageCompression(inputFile, {
      maxSizeMB,
      maxWidthOrHeight: maxDimension,
      useWebWorker: COMPRESS_CONFIG.useWebWorker,
      initialQuality: quality,
      fileType: outputFormat,
      maxIteration: COMPRESS_CONFIG.maxIteration,
    });
  };

  try {
    let currentQuality = COMPRESS_CONFIG.initialQuality;
    let currentMaxDimension = COMPRESS_CONFIG.maxWidthOrHeight;
    const minDimension = COMPRESS_CONFIG.minWidthOrHeight;
    const minQuality = COMPRESS_CONFIG.minQuality;
    
    // 第一次压缩尝试
    let compressedFile = await compressWithStrategy(
      file, 
      COMPRESS_CONFIG.maxSizeMB, 
      currentQuality,
      currentMaxDimension
    );
    let compressedSizeKB = compressedFile.size / 1024;
    let retryCount = 0;

    // 两阶段压缩循环
    while (compressedSizeKB > serverLimitKB && retryCount < COMPRESS_CONFIG.maxRetries) {
      retryCount++;
      const targetSizeMB = (serverLimitKB * 0.9) / 1024;
      
      // 阶段1：优先降质量（保持分辨率，文字边缘更清晰）
      if (currentQuality > minQuality) {
        // WebP 格式下质量降幅可以稍大（因为压缩效率高）
        const qualityStep = outputFormat === 'image/webp' ? 0.06 : 0.05;
        currentQuality = Math.max(minQuality, currentQuality - qualityStep);
        console.log(`[压缩] ${file.name}: 阶段1 - 降质量到 ${(currentQuality*100).toFixed(0)}%`);
      }
      // 阶段2：质量已最低，开始降分辨率
      else if (currentMaxDimension > minDimension) {
        currentMaxDimension = Math.max(minDimension, Math.round(currentMaxDimension * 0.88));
        console.log(`[压缩] ${file.name}: 阶段2 - 降分辨率到 ${currentMaxDimension}px`);
      }
      // 两者都到最低，最后尝试
      else {
        currentQuality = Math.max(0.4, currentQuality - 0.05);
        currentMaxDimension = Math.max(1000, currentMaxDimension - 100);
        console.warn(`[压缩] ${file.name}: 最终尝试 - 质量${(currentQuality*100).toFixed(0)}%, 分辨率${currentMaxDimension}px`);
      }

      compressedFile = await compressWithStrategy(file, targetSizeMB, currentQuality, currentMaxDimension);
      compressedSizeKB = compressedFile.size / 1024;
      
      console.log(`[压缩] ${file.name}: 重试${retryCount} → ${compressedSizeKB.toFixed(1)}KB`);
    }

    // 最终检查
    if (compressedSizeKB > serverLimitKB) {
      console.error(`[压缩] ${file.name}: 无法压缩到 ${serverLimitKB}KB 以下 (当前 ${compressedSizeKB.toFixed(1)}KB)`);
      
      // 提供更友好的错误提示
      const suggestion = originalSizeKB > 2000 
        ? '建议：将图片裁剪或分割后分别上传'
        : '建议：使用手机相机重新拍摄，或降低原图分辨率';
      
      alert(`图片 "${file.name}" 无法压缩到服务器限制(${serverLimitKB}KB)以下\n\n${suggestion}`);
      throw new Error(`图片过大无法处理: ${file.name}`);
    }

    const savedPercent = ((1 - compressedSizeKB / originalSizeKB) * 100).toFixed(0);
    console.log(`[压缩] ${file.name}: ${originalSizeKB.toFixed(1)}KB → ${compressedSizeKB.toFixed(1)}KB (节省 ${savedPercent}%, ${formatName}${retryCount > 0 ? `, 重试${retryCount}次` : ''})`);

    // 转换为 Base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(compressedFile);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  } catch (error: any) {
    if (error.message?.includes('图片过大')) {
      throw error; // 重新抛出大小错误
    }
    console.warn('[压缩] 压缩失败，尝试使用原图', error);
    // 如果原图小于限制，使用原图
    if (originalSizeKB <= serverLimitKB) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
    }
    throw new Error(`图片 "${file.name}" 处理失败，请重试`);
  }
};

/**
 * PDF转图片（带压缩和强制大小保障）
 *
 * 服务器配置：2核4G Linux
 * 
 * 策略：
 * 1. 使用适中的缩放比例渲染PDF（平衡清晰度和大小）
 * 2. 优先使用 WebP 格式输出
 * 3. 两阶段压缩：先降质量，再降分辨率
 *
 * @param file PDF文件
 * @returns Base64编码的图片
 * @throws 当PDF无法压缩到服务器限制时抛出错误
 */
export const pdfToImage = async (file: File): Promise<string> => {
  const serverLimitKB = COMPRESS_CONFIG.serverLimitKB;
  const outputFormat = getOutputFormat();
  const formatName = outputFormat === 'image/webp' ? 'WebP' : 'JPEG';

  try {
    const arrayBuffer = await file.arrayBuffer();
    // @ts-ignore - PDF.js通过CDN加载,全局可用
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    // 使用适中的缩放比例（平衡清晰度和文件大小）
    const originalViewport = page.getViewport({ scale: 1 });
    const maxDim = COMPRESS_CONFIG.maxWidthOrHeight;
    const scale = Math.min(
      maxDim / originalViewport.width,
      maxDim / originalViewport.height,
      1.5 // 最大缩放1.5倍
    );

    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      await page.render({ canvasContext: context, viewport: viewport }).promise;

      // 使用初始质量转换为 Blob
      const initialQuality = COMPRESS_CONFIG.initialQuality;
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), outputFormat, initialQuality);
      });

      const tempFile = new File(
        [blob], 
        file.name.replace('.pdf', getFileExtension(outputFormat)), 
        { type: outputFormat }
      );
      let currentSizeKB = tempFile.size / 1024;

      // 如果小于限制，直接返回
      if (currentSizeKB <= serverLimitKB) {
        const base64 = canvas.toDataURL(outputFormat, initialQuality);
        console.log(`[PDF] ${file.name}: 转换为 ${currentSizeKB.toFixed(1)}KB ${formatName} (≤${serverLimitKB}KB，无需压缩)`);
        return base64;
      }
      
      console.log(`[PDF] ${file.name}: 转换后 ${currentSizeKB.toFixed(1)}KB → 使用 ${formatName} 压缩到 ${serverLimitKB}KB 以下`);

      // 两阶段压缩
      let currentQuality = initialQuality;
      let currentMaxDimension = COMPRESS_CONFIG.maxWidthOrHeight;
      const minDimension = COMPRESS_CONFIG.minWidthOrHeight;
      const minQuality = COMPRESS_CONFIG.minQuality;
      
      let compressedFile = await imageCompression(tempFile, {
        maxSizeMB: COMPRESS_CONFIG.maxSizeMB,
        maxWidthOrHeight: currentMaxDimension,
        useWebWorker: COMPRESS_CONFIG.useWebWorker,
        initialQuality: currentQuality,
        fileType: outputFormat,
      });

      let compressedSizeKB = compressedFile.size / 1024;
      let retryCount = 0;

      while (compressedSizeKB > serverLimitKB && retryCount < COMPRESS_CONFIG.maxRetries) {
        retryCount++;
        const targetSizeMB = (serverLimitKB * 0.9) / 1024;
        
        // 阶段1：优先降质量
        if (currentQuality > minQuality) {
          const qualityStep = outputFormat === 'image/webp' ? 0.06 : 0.05;
          currentQuality = Math.max(minQuality, currentQuality - qualityStep);
          console.log(`[PDF] ${file.name}: 阶段1 - 降质量到 ${(currentQuality*100).toFixed(0)}%`);
        }
        // 阶段2：降分辨率
        else if (currentMaxDimension > minDimension) {
          currentMaxDimension = Math.max(minDimension, Math.round(currentMaxDimension * 0.88));
          console.log(`[PDF] ${file.name}: 阶段2 - 降分辨率到 ${currentMaxDimension}px`);
        }
        // 最终尝试
        else {
          currentQuality = Math.max(0.4, currentQuality - 0.05);
          currentMaxDimension = Math.max(1000, currentMaxDimension - 100);
          console.warn(`[PDF] ${file.name}: 最终尝试 - 质量${(currentQuality*100).toFixed(0)}%, 分辨率${currentMaxDimension}px`);
        }

        compressedFile = await imageCompression(tempFile, {
          maxSizeMB: targetSizeMB,
          maxWidthOrHeight: currentMaxDimension,
          useWebWorker: COMPRESS_CONFIG.useWebWorker,
          initialQuality: currentQuality,
          fileType: outputFormat,
        });
        compressedSizeKB = compressedFile.size / 1024;
        
        console.log(`[PDF] ${file.name}: 重试${retryCount} → ${compressedSizeKB.toFixed(1)}KB`);
      }

      // 最终检查
      if (compressedSizeKB > serverLimitKB) {
        console.error(`[PDF] ${file.name}: 无法压缩到 ${serverLimitKB}KB 以下`);
        alert(`PDF "${file.name}" 内容过于复杂，无法压缩到服务器限制以下\n\n建议：\n1. 截图后上传图片\n2. 使用更简单的 PDF`);
        throw new Error(`PDF 过大无法处理: ${file.name}`);
      }

      const savedPercent = ((1 - compressedSizeKB / currentSizeKB) * 100).toFixed(0);
      console.log(`[PDF] ${file.name}: ${currentSizeKB.toFixed(1)}KB → ${compressedSizeKB.toFixed(1)}KB (节省 ${savedPercent}%, ${formatName}${retryCount > 0 ? `, 重试${retryCount}次` : ''})`);

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(compressedFile);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
    }
    return "";
  } catch (e: any) {
    if (e.message?.includes('PDF 过大')) {
      throw e;
    }
    console.error("PDF Render Error", e);
    return "";
  }
};
