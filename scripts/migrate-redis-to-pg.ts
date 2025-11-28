/**
 * Redis 到 PostgreSQL 数据迁移脚本
 * 
 * 使用方法:
 * 1. 确保 Redis 服务正在运行
 * 2. 确保 PostgreSQL 服务正在运行并已创建数据库
 * 3. 运行: npx ts-node scripts/migrate-redis-to-pg.ts
 */

import 'dotenv/config'
import { createClient, RedisClientType } from 'redis'
import { getDb, closeDatabase, testConnection } from '../src/db/index'
import { 
  users, 
  expenses, 
  reports, 
  reportItems,
  loans, 
  paymentAccounts, 
  budgetProjects, 
  aiConfigs, 
  tokenUsage,
  attachments 
} from '../src/db/schema'
import { STATE_GROUPS } from '../steps/reimbursement/types'

// Redis 客户端
let redisClient: RedisClientType

// 连接 Redis
async function connectRedis(): Promise<void> {
  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  })
  
  redisClient.on('error', (err) => console.error('Redis 连接错误:', err))
  
  await redisClient.connect()
  console.log('Redis 连接成功')
}

// 关闭 Redis 连接
async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    console.log('Redis 连接已关闭')
  }
}

// 从 Redis 获取所有匹配的 keys
async function getKeys(pattern: string): Promise<string[]> {
  const keys: string[] = []
  let cursor: string = '0'
  
  do {
    const result = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 })
    cursor = String(result.cursor)
    keys.push(...result.keys)
  } while (cursor !== '0')
  
  return keys
}

// 从 Redis 获取 hash 数据
async function getHashData(key: string): Promise<Record<string, any>> {
  const data = await redisClient.hGetAll(key)
  const result: Record<string, any> = {}
  
  for (const [field, value] of Object.entries(data)) {
    try {
      result[field] = JSON.parse(value)
    } catch {
      result[field] = value
    }
  }
  
  return result
}

// 迁移用户数据
async function migrateUsers(): Promise<void> {
  console.log('\n--- 迁移用户数据 ---')
  const db = getDb()
  
  const keys = await getKeys(`${STATE_GROUPS.USERS}*`)
  let count = 0
  
  for (const key of keys) {
    const userData = await getHashData(key)
    
    for (const [userId, user] of Object.entries(userData)) {
      if (user && typeof user === 'object') {
        try {
          await db.insert(users).values({
            id: user.id || userId,
            name: user.name || '未知用户',
            department: user.department || '未知部门',
            email: user.email || `${userId}@example.com`,
            role: user.role || 'user',
            password: user.password,
            isCurrent: user.isCurrent || false,
          }).onConflictDoNothing()
          count++
        } catch (error) {
          console.error(`迁移用户 ${userId} 失败:`, error)
        }
      }
    }
  }
  
  console.log(`迁移了 ${count} 个用户`)
}

// 迁移费用记录
async function migrateExpenses(): Promise<void> {
  console.log('\n--- 迁移费用记录 ---')
  const db = getDb()
  
  const keys = await getKeys(`${STATE_GROUPS.EXPENSES}*`)
  let count = 0
  
  for (const key of keys) {
    const userId = key.replace(`${STATE_GROUPS.EXPENSES}_`, '')
    const expenseData = await getHashData(key)
    
    for (const [expenseId, expense] of Object.entries(expenseData)) {
      if (expense && typeof expense === 'object') {
        try {
          await db.insert(expenses).values({
            id: expense.id || expenseId,
            userId: expense.userId || userId,
            amount: (expense.amount || 0).toString(),
            description: expense.description || '',
            date: expense.date || new Date().toISOString(),
            category: expense.category || '其他',
            remarks: expense.remarks,
            status: expense.status || 'pending',
          }).onConflictDoNothing()
          count++
        } catch (error) {
          console.error(`迁移费用 ${expenseId} 失败:`, error)
        }
      }
    }
  }
  
  console.log(`迁移了 ${count} 条费用记录`)
}

// 迁移报销单
async function migrateReports(): Promise<void> {
  console.log('\n--- 迁移报销单 ---')
  const db = getDb()
  
  const keys = await getKeys(`${STATE_GROUPS.REPORTS}*`)
  let reportCount = 0
  let itemCount = 0
  let attachmentCount = 0
  
  for (const key of keys) {
    const userId = key.replace(`${STATE_GROUPS.REPORTS}_`, '')
    const reportData = await getHashData(key)
    
    for (const [reportId, report] of Object.entries(reportData)) {
      if (report && typeof report === 'object') {
        try {
          // 插入报销单主记录
          await db.insert(reports).values({
            id: report.id || reportId,
            userId: report.userId || userId,
            title: report.title || '未命名报销单',
            createdDate: report.createdDate || new Date().toISOString(),
            status: report.status || 'draft',
            totalAmount: (report.totalAmount || 0).toString(),
            prepaidAmount: (report.prepaidAmount || 0).toString(),
            payableAmount: (report.payableAmount || 0).toString(),
            approvalNumber: report.approvalNumber,
            budgetProjectData: report.budgetProject,
            paymentAccountData: report.paymentAccount,
            userSnapshot: report.userSnapshot || {},
            invoiceCount: report.invoiceCount,
            isTravel: report.isTravel,
            tripReason: report.tripReason,
            tripLegs: report.tripLegs,
            taxiDetails: report.taxiDetails,
            aiRecognitionData: report.aiRecognitionData,
          }).onConflictDoNothing()
          reportCount++
          
          // 插入关联的费用项
          if (report.items && Array.isArray(report.items)) {
            for (let i = 0; i < report.items.length; i++) {
              const item = report.items[i]
              try {
                await db.insert(reportItems).values({
                  id: `${reportId}_item_${i}`,
                  reportId: report.id || reportId,
                  expenseId: item.id,
                  amount: (item.amount || 0).toString(),
                  description: item.description || '',
                  date: item.date || new Date().toISOString(),
                  category: item.category,
                  budgetProjectData: item.budgetProject,
                }).onConflictDoNothing()
                itemCount++
              } catch (error) {
                console.error(`迁移报销项 ${i} 失败:`, error)
              }
            }
          }
          
          // 插入附件
          if (report.attachments && Array.isArray(report.attachments)) {
            for (let i = 0; i < report.attachments.length; i++) {
              const att = report.attachments[i]
              try {
                await db.insert(attachments).values({
                  id: `${reportId}_att_${i}`,
                  reportId: report.id || reportId,
                  type: att.type || 'other',
                  data: att.data || '',
                  name: att.name,
                }).onConflictDoNothing()
                attachmentCount++
              } catch (error) {
                console.error(`迁移附件 ${i} 失败:`, error)
              }
            }
          }
        } catch (error) {
          console.error(`迁移报销单 ${reportId} 失败:`, error)
        }
      }
    }
  }
  
  console.log(`迁移了 ${reportCount} 个报销单, ${itemCount} 个费用项, ${attachmentCount} 个附件`)
}

// 迁移借款单
async function migrateLoans(): Promise<void> {
  console.log('\n--- 迁移借款单 ---')
  const db = getDb()
  
  const keys = await getKeys(`${STATE_GROUPS.LOANS}*`)
  let loanCount = 0
  let attachmentCount = 0
  
  for (const key of keys) {
    const userId = key.replace(`${STATE_GROUPS.LOANS}_`, '')
    const loanData = await getHashData(key)
    
    for (const [loanId, loan] of Object.entries(loanData)) {
      if (loan && typeof loan === 'object') {
        try {
          await db.insert(loans).values({
            id: loan.id || loanId,
            userId: loan.userId || userId,
            amount: (loan.amount || 0).toString(),
            reason: loan.reason || '未填写',
            date: loan.date || new Date().toISOString(),
            approvalNumber: loan.approvalNumber,
            status: loan.status || 'draft',
            budgetProjectData: loan.budgetProject,
            paymentMethod: loan.paymentMethod || 'transfer',
            payeeInfo: loan.payeeInfo || {},
            userSnapshot: loan.userSnapshot || {},
          }).onConflictDoNothing()
          loanCount++
          
          // 插入附件
          if (loan.attachments && Array.isArray(loan.attachments)) {
            for (let i = 0; i < loan.attachments.length; i++) {
              const att = loan.attachments[i]
              try {
                await db.insert(attachments).values({
                  id: `${loanId}_att_${i}`,
                  loanId: loan.id || loanId,
                  type: att.type || 'other',
                  data: att.data || '',
                  name: att.name,
                }).onConflictDoNothing()
                attachmentCount++
              } catch (error) {
                console.error(`迁移借款附件 ${i} 失败:`, error)
              }
            }
          }
        } catch (error) {
          console.error(`迁移借款单 ${loanId} 失败:`, error)
        }
      }
    }
  }
  
  console.log(`迁移了 ${loanCount} 个借款单, ${attachmentCount} 个附件`)
}

// 迁移收款账户
async function migratePaymentAccounts(): Promise<void> {
  console.log('\n--- 迁移收款账户 ---')
  const db = getDb()
  
  const keys = await getKeys(`${STATE_GROUPS.PAYMENT_ACCOUNTS}*`)
  let count = 0
  
  for (const key of keys) {
    const userId = key.replace(`${STATE_GROUPS.PAYMENT_ACCOUNTS}_`, '')
    const accountData = await getHashData(key)
    
    for (const [accountId, account] of Object.entries(accountData)) {
      if (account && typeof account === 'object') {
        try {
          await db.insert(paymentAccounts).values({
            id: account.id || accountId,
            userId: userId,
            bankName: account.bankName || '未知银行',
            bankBranch: account.bankBranch,
            accountNumber: account.accountNumber || '',
            accountName: account.accountName || '',
            isDefault: account.isDefault || false,
          }).onConflictDoNothing()
          count++
        } catch (error) {
          console.error(`迁移收款账户 ${accountId} 失败:`, error)
        }
      }
    }
  }
  
  console.log(`迁移了 ${count} 个收款账户`)
}

// 迁移预算项目
async function migrateBudgetProjects(): Promise<void> {
  console.log('\n--- 迁移预算项目 ---')
  const db = getDb()
  
  const keys = await getKeys(`${STATE_GROUPS.BUDGET_PROJECTS}*`)
  let count = 0
  
  for (const key of keys) {
    const userId = key.replace(`${STATE_GROUPS.BUDGET_PROJECTS}_`, '')
    const projectData = await getHashData(key)
    
    for (const [projectId, project] of Object.entries(projectData)) {
      if (project && typeof project === 'object') {
        try {
          await db.insert(budgetProjects).values({
            id: project.id || projectId,
            userId: userId,
            name: project.name || '未命名项目',
            code: project.code || '',
            isDefault: project.isDefault || false,
          }).onConflictDoNothing()
          count++
        } catch (error) {
          console.error(`迁移预算项目 ${projectId} 失败:`, error)
        }
      }
    }
  }
  
  console.log(`迁移了 ${count} 个预算项目`)
}

// 迁移 AI 配置
async function migrateAIConfigs(): Promise<void> {
  console.log('\n--- 迁移 AI 配置 ---')
  const db = getDb()
  
  const keys = await getKeys(`${STATE_GROUPS.AI_CONFIGS}*`)
  let count = 0
  
  for (const key of keys) {
    const userId = key.replace(`${STATE_GROUPS.AI_CONFIGS}_`, '')
    const configData = await getHashData(key)
    
    for (const [configId, config] of Object.entries(configData)) {
      if (config && typeof config === 'object') {
        try {
          await db.insert(aiConfigs).values({
            id: config.id || configId,
            userId: config.userId || userId,
            provider: config.provider || 'gemini',
            apiKey: config.apiKey || '',
            apiUrl: config.apiUrl,
            model: config.model,
            isActive: config.isActive || false,
          }).onConflictDoNothing()
          count++
        } catch (error) {
          console.error(`迁移 AI 配置 ${configId} 失败:`, error)
        }
      }
    }
  }
  
  console.log(`迁移了 ${count} 个 AI 配置`)
}

// 迁移 Token 使用记录
async function migrateTokenUsage(): Promise<void> {
  console.log('\n--- 迁移 Token 使用记录 ---')
  const db = getDb()
  
  const keys = await getKeys(`${STATE_GROUPS.TOKEN_USAGE}*`)
  let count = 0
  
  for (const key of keys) {
    const usageData = await getHashData(key)
    
    for (const [usageId, usage] of Object.entries(usageData)) {
      if (usage && typeof usage === 'object') {
        try {
          await db.insert(tokenUsage).values({
            id: usage.id || usageId,
            userId: usage.userId || 'unknown',
            provider: usage.provider || 'unknown',
            model: usage.model || 'unknown',
            inputTokens: usage.inputTokens || 0,
            outputTokens: usage.outputTokens || 0,
            totalTokens: usage.totalTokens || 0,
            inputCost: (usage.inputCost || 0).toString(),
            outputCost: (usage.outputCost || 0).toString(),
            totalCost: (usage.totalCost || 0).toString(),
            cached: usage.cached,
            operation: usage.operation,
          }).onConflictDoNothing()
          count++
        } catch (error) {
          console.error(`迁移 Token 使用记录 ${usageId} 失败:`, error)
        }
      }
    }
  }
  
  console.log(`迁移了 ${count} 条 Token 使用记录`)
}

// 主迁移函数
async function migrate(): Promise<void> {
  console.log('========================================')
  console.log('开始 Redis 到 PostgreSQL 数据迁移')
  console.log('========================================')
  
  try {
    // 连接数据库
    await connectRedis()
    const pgConnected = await testConnection()
    
    if (!pgConnected) {
      throw new Error('无法连接到 PostgreSQL 数据库')
    }
    
    // 执行迁移
    await migrateUsers()
    await migrateExpenses()
    await migrateReports()
    await migrateLoans()
    await migratePaymentAccounts()
    await migrateBudgetProjects()
    await migrateAIConfigs()
    await migrateTokenUsage()
    
    console.log('\n========================================')
    console.log('数据迁移完成!')
    console.log('========================================')
    
  } catch (error) {
    console.error('迁移失败:', error)
    process.exit(1)
  } finally {
    await closeRedis()
    await closeDatabase()
  }
}

// 运行迁移
migrate()

