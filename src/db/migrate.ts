/**
 * 数据库迁移脚本
 * 执行数据库表结构迁移
 */

import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { getDb, closeDatabase, testConnection } from './index'

async function runMigration() {
  console.log('开始数据库迁移...')
  
  // 测试连接
  const connected = await testConnection()
  if (!connected) {
    console.error('无法连接到数据库，迁移中止')
    process.exit(1)
  }

  try {
    const db = getDb()
    
    // 执行迁移
    await migrate(db, { migrationsFolder: './drizzle' })
    
    console.log('数据库迁移完成!')
  } catch (error) {
    console.error('数据库迁移失败:', error)
    process.exit(1)
  } finally {
    await closeDatabase()
  }
}

// 如果直接运行此文件，执行迁移
if (require.main === module) {
  runMigration()
}

export { runMigration }




