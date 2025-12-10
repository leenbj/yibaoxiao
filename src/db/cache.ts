/**
 * Drizzle ORM 内存缓存实现
 * 特点：
 * - 简单高效，无需额外依赖
 * - 适合单实例部署
 * - 自动 TTL 过期
 * - 变更时自动失效
 */

import { Cache, type MutationOption } from 'drizzle-orm/cache/core';
import type { CacheConfig } from 'drizzle-orm/cache/core/types';

interface CacheEntry {
  data: any[];
  tables: string[];
  expiry: number;
  isTag: boolean;
}

/**
 * 内存缓存实现
 * 用于缓存 Drizzle ORM 查询结果
 */
export class MemoryCache extends Cache {
  private cache: Map<string, CacheEntry> = new Map();
  private tableToKeys: Map<string, Set<string>> = new Map();
  private defaultTTL: number; // 毫秒
  private isGlobal: boolean;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: { 
    defaultTTL?: number;  // 默认 TTL（秒）
    global?: boolean;     // 是否全局缓存
  } = {}) {
    super();
    this.defaultTTL = (options.defaultTTL || 60) * 1000; // 默认 60 秒
    this.isGlobal = options.global ?? false;
    
    // 启动定期清理过期条目
    this.startCleanup();
  }

  /**
   * 缓存策略
   * - 'explicit': 仅 .$withCache() 显式调用时缓存
   * - 'all': 全局缓存所有查询
   */
  override strategy(): 'explicit' | 'all' {
    return this.isGlobal ? 'all' : 'explicit';
  }

  /**
   * 获取缓存
   * @param key 缓存键
   * @param tables 涉及的表名
   * @param isTag 是否为标签查询
   * @param isAutoInvalidate 是否自动失效
   */
  override async get(
    key: string, 
    tables: string[], 
    isTag: boolean, 
    isAutoInvalidate?: boolean
  ): Promise<any[] | undefined> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // 检查是否过期
    if (Date.now() > entry.expiry) {
      this.deleteEntry(key);
      return undefined;
    }

    console.log(`[缓存] 命中: ${key.substring(0, 50)}...`);
    return entry.data;
  }

  /**
   * 存储缓存
   * @param hashedQuery 哈希后的查询
   * @param response 查询结果
   * @param tables 涉及的表名
   * @param isTag 是否为标签查询
   * @param config 缓存配置
   */
  override async put(
    hashedQuery: string, 
    response: any[], 
    tables: string[], 
    isTag: boolean,
    config?: CacheConfig
  ): Promise<void> {
    // 计算过期时间
    const ttl = config?.ex ? config.ex * 1000 : this.defaultTTL;
    const expiry = Date.now() + ttl;

    // 存储缓存条目
    this.cache.set(hashedQuery, {
      data: response,
      tables,
      expiry,
      isTag,
    });

    // 建立表到缓存键的映射（用于失效）
    for (const table of tables) {
      if (!this.tableToKeys.has(table)) {
        this.tableToKeys.set(table, new Set());
      }
      this.tableToKeys.get(table)!.add(hashedQuery);
    }

    console.log(`[缓存] 存储: ${hashedQuery.substring(0, 50)}... (表: ${tables.join(', ')}, TTL: ${ttl/1000}s)`);
  }

  /**
   * 变更时失效缓存
   * 当 INSERT/UPDATE/DELETE 操作发生时调用
   */
  override async onMutate(params: MutationOption): Promise<void> {
    const tagsArray = params.tags 
      ? (Array.isArray(params.tags) ? params.tags : [params.tags]) 
      : [];
    
    const tablesArray = params.tables 
      ? (Array.isArray(params.tables) ? params.tables : [params.tables]) 
      : [];

    const keysToDelete = new Set<string>();

    // 按表失效
    for (const table of tablesArray) {
      const tableName = typeof table === 'string' ? table : (table as any)?.name || String(table);
      const keys = this.tableToKeys.get(tableName);
      if (keys) {
        for (const key of keys) {
          keysToDelete.add(key);
        }
        this.tableToKeys.delete(tableName);
      }
    }

    // 按标签失效
    for (const tag of tagsArray) {
      if (this.cache.has(tag)) {
        keysToDelete.add(tag);
      }
    }

    // 执行删除
    if (keysToDelete.size > 0) {
      console.log(`[缓存] 失效: ${keysToDelete.size} 个条目 (表: ${tablesArray.map(t => typeof t === 'string' ? t : (t as any)?.name || String(t)).join(', ')})`);
      for (const key of keysToDelete) {
        this.deleteEntry(key);
      }
    }
  }

  /**
   * 删除单个缓存条目
   */
  private deleteEntry(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      // 清理表映射
      for (const table of entry.tables) {
        const keys = this.tableToKeys.get(table);
        if (keys) {
          keys.delete(key);
          if (keys.size === 0) {
            this.tableToKeys.delete(table);
          }
        }
      }
      this.cache.delete(key);
    }
  }

  /**
   * 定期清理过期条目
   */
  private startCleanup(): void {
    // 每分钟清理一次
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      for (const [key, entry] of this.cache) {
        if (now > entry.expiry) {
          this.deleteEntry(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`[缓存] 清理: ${cleaned} 个过期条目`);
      }
    }, 60000);

    // 允许进程退出
    this.cleanupInterval.unref();
  }

  /**
   * 获取缓存统计
   */
  getStats(): { size: number; tables: number } {
    return {
      size: this.cache.size,
      tables: this.tableToKeys.size,
    };
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.tableToKeys.clear();
    console.log('[缓存] 已清空');
  }

  /**
   * 停止缓存（清理资源）
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

/**
 * 创建内存缓存实例
 * @param options 配置选项
 * @returns MemoryCache 实例
 */
export function createMemoryCache(options?: {
  defaultTTL?: number;  // 默认 TTL（秒），默认 60
  global?: boolean;     // 是否全局缓存，默认 false（显式缓存）
}): MemoryCache {
  return new MemoryCache(options);
}
