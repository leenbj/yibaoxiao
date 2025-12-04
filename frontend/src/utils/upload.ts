/**
 * 易报销系统 - 文件上传工具函数
 * 
 * 使用 FormData 直接上传文件（不用 Base64）
 * 优势：节省 33% 带宽和内存
 */

import { compressImages } from './image';
import { API_BASE_URL } from '../constants';

/**
 * AI 识别请求类型
 */
export type RecognizeType = 'invoice' | 'approval' | 'travel' | 'ticket' | 'hotel' | 'taxi';

/**
 * AI 识别响应
 */
export interface AIRecognizeResponse {
  success: boolean;
  result?: any;
  error?: string;
  usage?: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  };
}

/**
 * 使用 FormData 上传图片进行 AI 识别
 * 
 * @param files 文件数组（图片或 PDF）
 * @param type 识别类型
 * @param userId 用户 ID
 * @returns AI 识别结果
 */
export const uploadForAIRecognition = async (
  files: File[],
  type: RecognizeType,
  userId?: string
): Promise<AIRecognizeResponse> => {
  try {
    // 1. 压缩图片
    console.log(`[上传] 开始处理 ${files.length} 个文件...`);
    const compressedFiles = await compressImages(files);
    
    // 2. 构建 FormData
    const formData = new FormData();
    compressedFiles.forEach((file, index) => {
      formData.append('images', file, file.name);
    });
    formData.append('type', type);
    if (userId) {
      formData.append('userId', userId);
    }
    
    // 记录上传大小
    const totalSize = compressedFiles.reduce((sum, f) => sum + f.size, 0);
    console.log(`[上传] FormData 总大小: ${(totalSize / 1024).toFixed(1)}KB (${compressedFiles.length} 个文件)`);
    
    // 3. 发送请求
    const response = await fetch(`${API_BASE_URL}/api/ai/recognize`, {
      method: 'POST',
      body: formData,
      // 不设置 Content-Type，让浏览器自动设置 multipart/form-data 边界
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(errorData.error || `请求失败: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[上传] AI 识别成功:`, data);
    
    return data;
  } catch (error: any) {
    console.error('[上传] AI 识别失败:', error);
    return {
      success: false,
      error: error.message || '上传失败，请重试',
    };
  }
};

/**
 * 使用 FormData 上传单个图片（简化版）
 */
export const uploadSingleImage = async (
  file: File,
  type: RecognizeType,
  userId?: string
): Promise<AIRecognizeResponse> => {
  return uploadForAIRecognition([file], type, userId);
};

/**
 * 检查文件是否为支持的类型
 */
export const isSupportedFile = (file: File): boolean => {
  const supportedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
  ];
  return supportedTypes.includes(file.type);
};

/**
 * 获取文件的显示名称
 */
export const getFileDisplayName = (file: File): string => {
  const name = file.name;
  if (name.length <= 20) return name;
  const ext = name.split('.').pop() || '';
  const baseName = name.slice(0, 15);
  return `${baseName}...${ext}`;
};

