/**
 * 生产环境启动脚本
 * 
 * 1. 初始化数据库连接
 * 2. 运行数据库迁移
 * 3. 创建超级管理员
 * 4. 启动 Motia 服务
 */

import 'dotenv/config'
import { exec } from 'child_process'
import { promisify } from 'util'
import { testConnection } from '../src/db'
import { initializeAdmin } from '../src/db/init-admin'

const execAsync = promisify(exec)

async function start() {
  console.log('========================================')
  console.log('易报销 Pro - 生产环境启动')
  console.log('========================================')
  
  // 1. 测试数据库连接
  console.log('\n[1/4] 测试数据库连接...')
  const dbConnected = await testConnection()
  if (!dbConnected) {
    console.error('数据库连接失败，请检查 DATABASE_URL 配置')
    process.exit(1)
  }
  
  // 2. 运行数据库迁移
  console.log('\n[2/4] 运行数据库迁移...')
  try {
    const { stdout, stderr } = await execAsync('npm run db:push')
    if (stdout) console.log(stdout)
    if (stderr) console.error(stderr)
    console.log('数据库迁移完成')
  } catch (error: any) {
    console.error('数据库迁移失败:', error.message)
    // 继续执行，可能表结构已存在
  }
  
  // 3. 初始化超级管理员
  console.log('\n[3/4] 初始化超级管理员...')
  const adminId = await initializeAdmin()
  if (adminId) {
    console.log('超级管理员 ID:', adminId)
  }
  
  // 4. 构建 Motia 服务
  console.log('\n[4/5] 构建 Motia 服务...')
  try {
    const { stdout: buildOut, stderr: buildErr } = await execAsync('npx motia build')
    if (buildOut) console.log(buildOut)
    if (buildErr) console.error(buildErr)
    console.log('Motia 构建完成')
  } catch (error: any) {
    console.log('构建跳过或已存在:', error.message)
  }
  
  // 5. 启动 Motia 服务（生产模式）
  console.log('\n[5/5] 启动 Motia 服务（生产模式）...')
  console.log('========================================\n')
  
  // 使用 spawn 启动 motia start（生产模式），而不是 motia dev
  const { spawn } = require('child_process')
  const motia = spawn('npx', ['motia', 'start'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ADMIN_USER_ID: adminId || process.env.ADMIN_USER_ID,
      // 设置 Node.js 内存限制（针对 4G 内存服务器）
      NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=1024',
    },
  })
  
  motia.on('error', (error: Error) => {
    console.error('Motia 启动失败:', error)
    process.exit(1)
  })
  
  motia.on('exit', (code: number) => {
    process.exit(code)
  })
}

start().catch((error) => {
  console.error('启动失败:', error)
  process.exit(1)
})


