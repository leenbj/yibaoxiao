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
 * @returns API响应数据
 * @throws 请求失败时抛出错误
 */
export const apiRequest = async <T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = localStorage.getItem('reimb_token');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || '请求失败');
  }

  return data;
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
