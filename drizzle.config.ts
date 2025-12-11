/**
 * Drizzle ORM 配置文件
 * 用于数据库迁移
 */

import type { Config } from 'drizzle-kit'
import 'dotenv/config'

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/yibao_db',
  },
} satisfies Config














