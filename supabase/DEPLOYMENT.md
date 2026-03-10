# 易报销 Pro - Supabase 部署指南

## 项目概述

本项目已完成从 Motia 后端到 Supabase 的迁移。本文档提供完整的部署指南。

## 架构变更

### 原架构
```
前端 (React) → Motia API (steps/) → PostgreSQL
```

### 新架构
```
前端 (React) → Supabase Client → Supabase (PostgreSQL + Auth + Storage + Edge Functions)
```

## 前置条件

- Node.js 18+
- npm 或 pnpm
- Supabase 账户 (https://supabase.com)

## 快速部署

### 步骤 1: 创建 Supabase 项目

1. 访问 https://app.supabase.com
2. 点击 "New Project"
3. 填写项目信息:
   - Name: yibaoxiao-pro
   - Database Password: (保存好密码)
   - Region: 选择最近的地区
4. 等待项目创建完成（约 2 分钟）

### 步骤 2: 获取项目凭证

在项目 Dashboard 中获取:
- **Project URL**: `https://xxxxx.supabase.co`
- **anon/public key**: `eyJhbG...` (公钥，用于前端)
- **service_role key**: `eyJhbG...` (私钥，仅用于服务器)

### 步骤 3: 部署数据库

```bash
cd /Users/ethan/Desktop/开发项目/yibaoxiao/yibaoxiao

# 安装 Supabase CLI
npm install -g supabase

# 登录 Supabase
npx supabase login

# 初始化项目（如果还没有 supabase 目录）
npx supabase init

# 链接到你的项目
npx supabase link --project-ref YOUR_PROJECT_REF

# 推送数据库 Schema
npx supabase db push
```

### 步骤 4: 部署 Edge Functions

```bash
# 部署所有 Edge Functions
npx supabase functions deploy

# 或单独部署
npx supabase functions deploy user-profile
npx supabase functions deploy expenses
npx supabase functions deploy reports
npx supabase functions deploy loans
npx supabase functions deploy settings
npx supabase functions deploy statistics
npx supabase functions deploy ai-recognize
```

### 步骤 5: 配置前端环境变量

创建 `frontend/.env` 文件:

```bash
# frontend/.env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 步骤 6: 配置 Storage

在 Supabase Dashboard 中:
1. 进入 "Storage" 页面
2. 创建名为 `attachments` 的 bucket
3. 设置为 Private
4. 配置 RLS 策略（已在迁移脚本中自动创建）

### 步骤 7: 构建和部署前端

```bash
cd frontend

# 安装依赖
npm install

# 构建生产版本
npm run build

# 部署到托管平台（可选）
# Vercel
npm install -g vercel
vercel --prod

# 或 Netlify
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

## 数据迁移

### 从现有 PostgreSQL 迁移

```bash
# 1. 导出原数据库
pg_dump -h localhost -U postgres -d yibaoxiao > backup.sql

# 2. 获取 Supabase 连接信息
# 在 Dashboard > Database > Connection string

# 3. 导入到 Supabase
psql -h db.YOUR_PROJECT_REF.supabase.co \
  -U postgres \
  -d postgres \
  -f backup.sql

# 4. 运行数据转换脚本（如果需要）
# 将旧数据格式转换为新 Schema 格式
```

### 用户密码迁移

由于原系统使用明文密码，而 Supabase Auth 使用 bcrypt 哈希：

**选项 A: 用户重置密码（推荐）**
1. 仅迁移用户资料（profiles 表）
2. 首次登录时要求用户重置密码

**选项 B: 批量哈希密码**
```sql
-- 在 Supabase SQL Editor 中运行
UPDATE auth.users
SET encrypted_password = crypt(old_password_column, gen_salt('bf'))
FROM profiles
WHERE auth.users.id = profiles.id;
```

### 附件迁移

如果原数据使用 Base64 存储附件：

```typescript
// 迁移脚本示例
const { data: reports } = await supabase.from('reports').select('*')

for (const report of reports) {
  for (const att of report.attachments) {
    // Base64 转 Blob
    const blob = base64ToBlob(att.data)
    
    // 上传到 Storage
    const filePath = `${report.user_id}/${report.id}/${att.name}`
    await supabase.storage.from('attachments').upload(filePath, blob)
    
    // 更新附件记录
    await supabase.from('attachments').update({
      storage_path: filePath,
      data: null // 清空 Base64 数据
    }).eq('id', att.id)
  }
}
```

## 环境变量参考

### 前端 (.env)
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Edge Functions (在 Supabase Dashboard 配置)
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 验证部署

### 1. 测试认证
```bash
# 访问前端应用
open https://your-app.vercel.app

# 尝试注册新用户
# 检查 Supabase Dashboard > Authentication > Users
```

### 2. 测试数据库
```bash
# 在 Supabase Dashboard > SQL Editor 运行
SELECT * FROM profiles LIMIT 5;
SELECT * FROM expenses LIMIT 5;
SELECT * FROM reports LIMIT 5;
```

### 3. 测试 Edge Functions
```bash
# 测试用户 API
curl -X GET "https://YOUR_PROJECT_REF.supabase.co/functions/v1/user/profile" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 测试费用 API
curl -X GET "https://YOUR_PROJECT_REF.supabase.co/functions/v1/expenses?userId=USER_ID"
```

### 4. 测试 Storage
```bash
# 上传测试文件
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/attachments/test.txt" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "test content"
```

## 监控和日志

### Supabase Dashboard
- **Database**: 查询性能、连接数
- **Functions**: 调用次数、错误日志
- **Storage**: 使用量、带宽
- **Logs**: 完整审计日志

### 前端错误监控
建议在 `frontend/src/utils/performance.ts` 中集成:
- Sentry
- LogRocket
- 或其他 APM 服务

## 备份策略

### 自动备份（Supabase Pro Plan）
- 每天自动备份
- 保留 7 天
- 可在 Dashboard 恢复

### 手动备份
```bash
# 导出完整数据库
npx supabase db dump -f backup-$(date +%Y%m%d).sql

# 导出 Schema
npx supabase db dump -s -f schema.sql

# 导出 Storage（使用 CLI 工具）
npx supabase storage download attachments backup-attachments/
```

## 故障排查

### 常见问题

**1. Edge Function 500 错误**
```bash
# 查看日志
npx supabase functions logs --env=production

# 常见原因:
# - 环境变量未配置
# - 权限不足（检查 RLS）
# - 代码错误
```

**2. RLS 策略阻止访问**
```sql
-- 检查当前策略
SELECT * FROM pg_policies WHERE tablename = 'expenses';

-- 临时禁用 RLS 测试
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
-- 测试后记得启用
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
```

**3. Storage 上传失败**
- 检查 bucket 是否存在
- 检查 RLS 策略
- 验证文件大小（默认限制 50MB）

**4. 认证问题**
- 检查 redirect URLs 配置
- 验证 JWT token 是否过期
- 查看 auth.users 表

## 性能优化

### 数据库
- 添加索引（已在迁移脚本中创建）
- 使用连接池
- 优化慢查询

### Edge Functions
- 使用 Deno 缓存
- 减少冷启动（保持函数热运行）
- 批量操作减少调用次数

### 前端
- 使用 Supabase 实时订阅
- 实现乐观更新
- 缓存策略

## 成本估算

### Supabase Free Tier
- 数据库：500MB
- Auth: 50,000 MAU
- Storage: 1GB
- Functions: 500,000 次/月
- 适合：开发测试、小项目

### Pro Tier ($25/月)
- 数据库：8GB
- Auth: 无限
- Storage: 100GB
- Functions: 2,000,000 次/月
- 适合：生产环境

## 安全建议

1. **永远不要在前端暴露 service_role key**
2. **配置正确的 RLS 策略**（已在迁移脚本中提供）
3. **启用双重认证**（2FA）用于管理员账户
4. **定期轮换密钥**
5. **监控异常活动**

## 后续步骤

1. 配置自定义域名
2. 设置 CI/CD 流水线
3. 实现监控告警
4. 编写集成测试
5. 性能基准测试

## 支持资源

- Supabase 文档：https://supabase.com/docs
- Edge Functions：https://supabase.com/docs/guides/functions
- 社区论坛：https://github.com/supabase/supabase/discussions
- 本项目问题：https://github.com/leenbj/yibaoxiao/issues

## 回滚计划

如需回滚到 Motia 后端：

1. 保留原 PostgreSQL 数据库
2. 切换前端 API_BASE_URL 回原后端
3. 重新部署 Motia 应用
4. 同步迁移期间的数据

```bash
# 前端环境变量改回原配置
VITE_API_BASE_URL=https://old-backend.example.com
```

---

**最后更新**: 2026-03-06  
**版本**: 1.0.0