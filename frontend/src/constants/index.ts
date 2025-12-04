/**
 * 易报销系统 - 常量定义
 * 包含所有应用级别的常量配置
 */

import type { AppUser, UserSettings } from '../types';

// ==================== 认证相关 ====================

/**
 * 超级管理员邮箱
 */
export const SUPER_ADMIN_EMAIL = 'wangbo@knet.cn';

/**
 * 默认密码（仅用于演示）
 */
export const DEFAULT_PASSWORD = '123456';

/**
 * 默认用户ID（用于API请求兜底）
 */
export const DEFAULT_USER_ID = 'user_wangbo';

// ==================== API配置 ====================

/**
 * API基础URL
 * - 生产环境和开发环境都使用相对路径
 * - 开发环境通过 Vite 代理转发到 localhost:3000
 */
export const API_BASE_URL = '';

// ==================== 图片压缩配置 ====================

/**
 * 检测浏览器是否支持 WebP 格式
 */
export const checkWebPSupport = (): boolean => {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
};

/**
 * 图片压缩配置
 *
 * 服务器配置：2核4G Linux
 * - Node.js 堆内存限制：1.5GB (docker-compose 中配置)
 * - 使用 FormData 直接传输（不用 Base64，节省 33% 带宽和内存）
 * 
 * 压缩策略（使用 WebP 格式 + FormData 上传）：
 * 1. WebP 比 JPEG 压缩效率高 30-50%，同等大小下质量更高
 * 2. FormData 直接传输文件，不经过 Base64 编码
 * 3. 两阶段压缩：先降质量保分辨率，再降分辨率
 * 
 * 分辨率下限：1400px（保证发票文字可读）
 * 质量下限：0.55（保证文字边缘清晰）
 */
export const COMPRESS_CONFIG: {
  maxSizeMB: number;
  maxWidthOrHeight: number;
  minWidthOrHeight: number;
  useWebWorker: boolean;
  initialQuality: number;
  fileType: string;
  fallbackFileType: string;
  serverLimitKB: number;
  minQuality: number;
  maxRetries: number;
  maxIteration: number;
  useFormData: boolean;  // 新增：是否使用 FormData 上传
} = {
  maxSizeMB: 0.28,             // 目标280KB（FormData不用Base64，可提高限制）
  maxWidthOrHeight: 1800,      // 初始最大尺寸（可更大）
  minWidthOrHeight: 1400,      // 最小尺寸（保证文字可读）
  useWebWorker: true,          // 使用Web Worker多线程
  initialQuality: 0.85,        // 初始质量（更高质量）
  fileType: 'image/webp',      // 优先使用 WebP 格式
  fallbackFileType: 'image/jpeg', // WebP 不支持时降级为 JPEG
  serverLimitKB: 300,          // 服务器限制提高到300KB（FormData节省33%）
  minQuality: 0.55,            // 最低质量（保证文字可读）
  maxRetries: 8,               // 最大重试次数
  maxIteration: 12,            // 压缩库内部最大迭代次数
  useFormData: true,           // 启用 FormData 上传（不用 Base64）
};

// ==================== 初始数据 ====================

/**
 * 初始用户列表
 */
export const initialUsers: AppUser[] = [
  {
    id: "u1",
    name: "王波",
    department: "管理部",
    email: SUPER_ADMIN_EMAIL,
    role: 'admin',
    isCurrent: true
  }
];

/**
 * 初始系统设置
 */
export const initialSettings: UserSettings = {
  currentUser: initialUsers[0],
  users: initialUsers,
  budgetProjects: [
    { id: "1", name: "嘉年华--人力部", code: "2024321", isDefault: true },
    { id: "2", name: "年度市场推广费", code: "MK-2024-001" },
    { id: "3", name: "海外业务拓展", code: "BD-UK-2025" }
  ],
  paymentAccounts: [
    {
      id: "1",
      bankName: "招商银行",
      bankBranch: "北京中关村支行",
      accountNumber: "6225 8888 8888 6666",
      accountName: "王波",
      isDefault: true
    }
  ]
};

/**
 * 导出为INITIAL_SETTINGS以保持向后兼容性
 */
export const INITIAL_SETTINGS = initialSettings;

// ==================== 功能配置 ====================

/**
 * PDF生成配置
 */
export const PDF_CONFIG = {
  format: 'a4' as const,
  orientation: 'portrait' as const,
  unit: 'mm' as const,
  compress: true,
};

/**
 * 日期格式
 */
export const DATE_FORMAT = {
  standard: 'YYYY-MM-DD',
  display: 'YYYY年MM月DD日',
  dateTime: 'YYYY-MM-DD HH:mm:ss',
} as const;
