/**
 * 易报销系统 - API请求工具
 * 封装所有API请求的通用逻辑
 */

import type { AppUser } from '../types';
import { API_BASE_URL, DEFAULT_USER_ID } from '../constants';

/**
 * 获取用户ID（带兜底）
 * @param user 当前用户对象
 * @returns 用户ID，如果为空则返回默认ID
 */
export const getUserId = (user?: AppUser | null): string => {
  return user?.id || DEFAULT_USER_ID;
};

/**
 * API请求工具函数
 * 自动添加认证头和错误处理
 *
 * @param path API路径
 * @param options 请求选项
 * @param timeout 超时时间（毫秒），默认 5 分钟用于 AI 识别
 * @returns API响应数据
 * @throws 请求失败时抛出错误
 */
export const apiRequest = async <T = any>(
  path: string,
  options: RequestInit = {},
  timeout: number = 300000 // 默认 5 分钟超时
): Promise<T> => {
  const token = localStorage.getItem('reimb_token');

  // 创建 AbortController 用于超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    // 检查响应类型，避免解析 HTML 错误页面
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // 如果是 504/502 等网关错误，返回 HTML 页面
      if (response.status === 504) {
        throw new Error('AI 处理超时，请稍后重试或减少上传的图片数量');
      }
      if (response.status === 502) {
        throw new Error('服务暂时不可用，请稍后重试');
      }
      throw new Error(`服务器返回了非 JSON 响应 (${response.status})`);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || '请求失败');
    }

    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // 处理超时错误
    if (error.name === 'AbortError') {
      throw new Error('请求超时，AI 处理时间较长，请稍后重试');
    }
    
    // 处理网络错误
    if (error.message === 'Failed to fetch') {
      throw new Error('网络连接失败，请检查网络后重试');
    }
    
    throw error;
  }
};

/**
 * GET请求简化方法
 */
export const apiGet = <T = any>(path: string): Promise<T> => {
  return apiRequest<T>(path, { method: 'GET' });
};

/**
 * POST请求简化方法
 */
export const apiPost = <T = any>(path: string, body?: any): Promise<T> => {
  return apiRequest<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
};

/**
 * PUT请求简化方法
 */
export const apiPut = <T = any>(path: string, body?: any): Promise<T> => {
  return apiRequest<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
};

/**
 * DELETE请求简化方法
 */
export const apiDelete = <T = any>(path: string): Promise<T> => {
  return apiRequest<T>(path, { method: 'DELETE' });
};
