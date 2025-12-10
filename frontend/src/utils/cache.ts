/**
 * 缓存管理工具 - localStorage包装器,支持TTL、版本管理、容量限制
 */

export interface CacheOptions {
  ttl?: number;        // 缓存过期时间(ms),默认5分钟
  version?: string;    // 缓存版本号,版本变更时自动失效
  compress?: boolean;  // 是否压缩(暂未实现)
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  version?: string;
  ttl?: number;
}

/**
 * 缓存管理器类
 */
export class CacheManager {
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5分钟
  private static readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB限制

  /**
   * 设置缓存
   * @param key 缓存键名
   * @param data 缓存数据
   * @param options 缓存选项
   */
  static set<T>(key: string, data: T, options: CacheOptions = {}): boolean {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        version: options.version,
        ttl: options.ttl || this.DEFAULT_TTL,
      };

      const serialized = JSON.stringify(entry);

      // 检查存储容量
      if (this.getStorageSize() + serialized.length > this.MAX_STORAGE_SIZE) {
        console.warn('[缓存管理] 存储空间不足,清理过期缓存');
        this.clearExpired();

        // 再次检查
        if (this.getStorageSize() + serialized.length > this.MAX_STORAGE_SIZE) {
          console.error('[缓存管理] 存储空间仍然不足,无法缓存');
          return false;
        }
      }

      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error(`[缓存管理] 设置缓存失败 ${key}:`, error);
      return false;
    }
  }

  /**
   * 获取缓存
   * @param key 缓存键名
   * @param options 缓存选项(用于版本校验)
   * @returns 缓存数据,过期或不存在返回null
   */
  static get<T>(key: string, options: CacheOptions = {}): T | null {
    try {
      const serialized = localStorage.getItem(key);
      if (!serialized) return null;

      const entry: CacheEntry<T> = JSON.parse(serialized);

      // 版本校验
      if (options.version && entry.version !== options.version) {
        console.log(`[缓存管理] 缓存版本不匹配 ${key}: ${entry.version} !== ${options.version}`);
        this.remove(key);
        return null;
      }

      // TTL校验
      const age = Date.now() - entry.timestamp;
      const ttl = entry.ttl || this.DEFAULT_TTL;

      if (age > ttl) {
        console.log(`[缓存管理] 缓存已过期 ${key}: ${age}ms > ${ttl}ms`);
        this.remove(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error(`[缓存管理] 获取缓存失败 ${key}:`, error);
      return null;
    }
  }

  /**
   * 移除缓存
   * @param key 缓存键名
   */
  static remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`[缓存管理] 移除缓存失败 ${key}:`, error);
    }
  }

  /**
   * 清空所有缓存
   */
  static clear(): void {
    try {
      localStorage.clear();
      console.log('[缓存管理] 已清空所有缓存');
    } catch (error) {
      console.error('[缓存管理] 清空缓存失败:', error);
    }
  }

  /**
   * 清理过期缓存
   */
  static clearExpired(): void {
    try {
      const keys = Object.keys(localStorage);
      let clearedCount = 0;

      for (const key of keys) {
        const serialized = localStorage.getItem(key);
        if (!serialized) continue;

        try {
          const entry: CacheEntry = JSON.parse(serialized);

          // 检查是否有timestamp和ttl字段(判断是否为缓存条目)
          if (entry.timestamp && entry.ttl) {
            const age = Date.now() - entry.timestamp;
            if (age > entry.ttl) {
              localStorage.removeItem(key);
              clearedCount++;
            }
          }
        } catch {
          // 非JSON格式,跳过
          continue;
        }
      }

      console.log(`[缓存管理] 清理了 ${clearedCount} 个过期缓存`);
    } catch (error) {
      console.error('[缓存管理] 清理过期缓存失败:', error);
    }
  }

  /**
   * 获取当前存储大小(估算)
   * @returns 存储大小(bytes)
   */
  static getStorageSize(): number {
    try {
      let totalSize = 0;
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          const value = localStorage.getItem(key);
          if (value) {
            totalSize += key.length + value.length;
          }
        }
      }
      return totalSize * 2; // UTF-16编码,每个字符2字节
    } catch (error) {
      console.error('[缓存管理] 计算存储大小失败:', error);
      return 0;
    }
  }

  /**
   * 检查缓存是否存在且未过期
   * @param key 缓存键名
   * @param options 缓存选项
   */
  static has(key: string, options: CacheOptions = {}): boolean {
    return this.get(key, options) !== null;
  }

  /**
   * 获取缓存剩余有效时间
   * @param key 缓存键名
   * @returns 剩余有效时间(ms),缓存不存在或已过期返回0
   */
  static getTTL(key: string): number {
    try {
      const serialized = localStorage.getItem(key);
      if (!serialized) return 0;

      const entry: CacheEntry = JSON.parse(serialized);
      const age = Date.now() - entry.timestamp;
      const ttl = entry.ttl || this.DEFAULT_TTL;
      const remaining = ttl - age;

      return remaining > 0 ? remaining : 0;
    } catch (error) {
      console.error(`[缓存管理] 获取TTL失败 ${key}:`, error);
      return 0;
    }
  }

  /**
   * 刷新缓存的过期时间(不改变数据)
   * @param key 缓存键名
   */
  static touch(key: string): boolean {
    try {
      const serialized = localStorage.getItem(key);
      if (!serialized) return false;

      const entry: CacheEntry = JSON.parse(serialized);
      entry.timestamp = Date.now();

      localStorage.setItem(key, JSON.stringify(entry));
      return true;
    } catch (error) {
      console.error(`[缓存管理] 刷新缓存失败 ${key}:`, error);
      return false;
    }
  }
}

/**
 * 便捷导出函数
 */
export const cache = {
  set: CacheManager.set.bind(CacheManager),
  get: CacheManager.get.bind(CacheManager),
  remove: CacheManager.remove.bind(CacheManager),
  clear: CacheManager.clear.bind(CacheManager),
  clearExpired: CacheManager.clearExpired.bind(CacheManager),
  has: CacheManager.has.bind(CacheManager),
  getTTL: CacheManager.getTTL.bind(CacheManager),
  touch: CacheManager.touch.bind(CacheManager),
  getStorageSize: CacheManager.getStorageSize.bind(CacheManager),
};

export default cache;
