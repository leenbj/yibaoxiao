/**
 * 初始化超级管理员
 * 
 * 在系统启动时检查并创建超级管理员账户
 * 管理员的 AI 配置可以被所有用户共享使用
 */

import { getDb } from './index'
import { users } from './schema'
import { eq } from 'drizzle-orm'

export async function initializeAdmin(): Promise<string | null> {
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  const adminName = process.env.ADMIN_NAME || '系统管理员'
  const adminDepartment = process.env.ADMIN_DEPARTMENT || '管理部'

  // 如果没有配置管理员信息，跳过初始化
  if (!adminEmail || !adminPassword) {
    console.log('[Admin] 未配置超级管理员，跳过初始化')
    return null
  }

  try {
    const db = getDb()
    
    // 检查管理员是否已存在
    const existingAdmin = await db.select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1)

    if (existingAdmin.length > 0) {
      const adminId = existingAdmin[0].id
      console.log('[Admin] 超级管理员已存在:', adminEmail, 'ID:', adminId)
      
      // 更新环境变量中的 ADMIN_USER_ID（运行时）
      process.env.ADMIN_USER_ID = adminId
      
      return adminId
    }

    // 创建新的管理员账户
    const adminId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    await db.insert(users).values({
      id: adminId,
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      department: adminDepartment,
      role: 'admin',
      isCurrent: false,
    })

    console.log('[Admin] 超级管理员创建成功:', adminEmail, 'ID:', adminId)
    
    // 更新环境变量中的 ADMIN_USER_ID（运行时）
    process.env.ADMIN_USER_ID = adminId
    
    return adminId
  } catch (error) {
    console.error('[Admin] 初始化超级管理员失败:', error)
    return null
  }
}

export default initializeAdmin






