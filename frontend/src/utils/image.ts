/**
 * 易报销系统 - 图片处理工具函数
 * 包含图片压缩、PDF转图片等功能
 * 
 * 优化版本：支持 FormData 直接上传（节省 33% 带宽和内存）
 * 
 * 压缩策略说明：
 * - 优先使用 WebP 格式（比 JPEG 压缩效率高 30-50%）
 * - 两阶段压缩：先降质量保分辨率，再降分辨率
 * - 支持 FormData 直接上传（推荐）或 Base64 编码（兼容）
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
 * 压缩图片并返回 File 对象（推荐用于 FormData 上传）
 * 
 * @param file 待处理的图片文件
 * @returns 压缩后的 File 对象
 * @throws 当图片无法压缩到服务器限制时抛出错误
 */
export const compressImageToFile = async (file: File): Promise<File> => {
  const originalSizeKB = file.size / 1024;
  const serverLimitKB = COMPRESS_CONFIG.serverLimitKB;
  const outputFormat = getOutputFormat();
  const formatName = outputFormat === 'image/webp' ? 'WebP' : 'JPEG';

  // 小于限制的文件完全不压缩
  if (originalSizeKB <= serverLimitKB) {
    console.log(`[压缩] ${file.name}: ${originalSizeKB.toFixed(1)}KB (≤${serverLimitKB}KB，无需压缩)`);
    return file;
  }
  
  console.log(`[压缩] ${file.name}: ${originalSizeKB.toFixed(1)}KB → 使用 ${formatName} 压缩到 ${serverLimitKB}KB 以下`);

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
      
      // 阶段1：优先降质量（保持分辨率）
      if (currentQuality > minQuality) {
        const qualityStep = outputFormat === 'image/webp' ? 0.06 : 0.05;
        currentQuality = Math.max(minQuality, currentQuality - qualityStep);
        console.log(`[压缩] ${file.name}: 阶段1 - 降质量到 ${(currentQuality*100).toFixed(0)}%`);
      }
      // 阶段2：质量已最低，开始降分辨率
      else if (currentMaxDimension > minDimension) {
        currentMaxDimension = Math.max(minDimension, Math.round(currentMaxDimension * 0.88));
        console.log(`[压缩] ${file.name}: 阶段2 - 降分辨率到 ${currentMaxDimension}px`);
      }
      // 最终尝试
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
      
      const suggestion = originalSizeKB > 2000 
        ? '建议：将图片裁剪或分割后分别上传'
        : '建议：使用手机相机重新拍摄，或降低原图分辨率';
      
      alert(`图片 "${file.name}" 无法压缩到服务器限制(${serverLimitKB}KB)以下\n\n${suggestion}`);
      throw new Error(`图片过大无法处理: ${file.name}`);
    }

    const savedPercent = ((1 - compressedSizeKB / originalSizeKB) * 100).toFixed(0);
    console.log(`[压缩] ${file.name}: ${originalSizeKB.toFixed(1)}KB → ${compressedSizeKB.toFixed(1)}KB (节省 ${savedPercent}%, ${formatName})`);

    // 返回压缩后的 File 对象
    const newFileName = file.name.replace(/\.[^/.]+$/, getFileExtension(outputFormat));
    return new File([compressedFile], newFileName, { type: outputFormat });
    
  } catch (error: any) {
    if (error.message?.includes('图片过大')) {
      throw error;
    }
    console.warn('[压缩] 压缩失败，尝试使用原图', error);
    if (originalSizeKB <= serverLimitKB) {
      return file;
    }
    throw new Error(`图片 "${file.name}" 处理失败，请重试`);
  }
};

/**
 * 将文件转换为Base64编码（兼容旧接口）
 * 
 * 注意：推荐使用 compressImageToFile + FormData 上传
 * 此函数保留用于兼容旧代码
 */
export const fileToBase64 = async (file: File): Promise<string> => {
  // 先压缩
  const compressedFile = await compressImageToFile(file);
  
  // 转换为 Base64
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(compressedFile);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
};

/**
 * PDF转图片并返回 File 对象（推荐用于 FormData 上传）
 *
 * @param file PDF文件
 * @returns 压缩后的 File 对象
 */
export const pdfToImageFile = async (file: File): Promise<File> => {
  const serverLimitKB = COMPRESS_CONFIG.serverLimitKB;
  const outputFormat = getOutputFormat();
  const formatName = outputFormat === 'image/webp' ? 'WebP' : 'JPEG';

  try {
    const arrayBuffer = await file.arrayBuffer();
    // @ts-ignore - PDF.js通过CDN加载,全局可用
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    // 使用适中的缩放比例
    const originalViewport = page.getViewport({ scale: 1 });
    const maxDim = COMPRESS_CONFIG.maxWidthOrHeight;
    const scale = Math.min(
      maxDim / originalViewport.width,
      maxDim / originalViewport.height,
      1.5
    );

    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      await page.render({ canvasContext: context, viewport: viewport }).promise;

      // 转换为 Blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), outputFormat, COMPRESS_CONFIG.initialQuality);
      });

      const newFileName = file.name.replace('.pdf', getFileExtension(outputFormat));
      const tempFile = new File([blob], newFileName, { type: outputFormat });
      
      // 压缩并返回
      return await compressImageToFile(tempFile);
    }
    
    throw new Error('Canvas context not available');
  } catch (e: any) {
    if (e.message?.includes('PDF 过大')) {
      throw e;
    }
    console.error("PDF Render Error", e);
    throw new Error(`PDF "${file.name}" 处理失败`);
  }
};

/**
 * PDF转图片（兼容旧接口，返回 Base64）
 */
export const pdfToImage = async (file: File): Promise<string> => {
  const imageFile = await pdfToImageFile(file);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(imageFile);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
};

/**
 * 批量压缩图片（用于 FormData 上传）
 * 
 * @param files 文件数组
 * @returns 压缩后的 File 数组
 */
export const compressImages = async (files: File[]): Promise<File[]> => {
  const results: File[] = [];
  
  for (const file of files) {
    try {
      if (file.type === 'application/pdf') {
        results.push(await pdfToImageFile(file));
      } else if (file.type.startsWith('image/')) {
        results.push(await compressImageToFile(file));
      } else {
        console.warn(`[压缩] 跳过不支持的文件类型: ${file.type}`);
      }
    } catch (error) {
      console.error(`[压缩] 处理文件失败: ${file.name}`, error);
      throw error;
    }
  }
  
  return results;
};
