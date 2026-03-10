# Supabase 迁移指南

## 项目概述

本文档描述了如何将易报销 Pro 从 Motia + PostgreSQL 架构迁移到 Supabase。

## 迁移架构

```
原架构:
前端 (React) → Motia API → PostgreSQL (Drizzle ORM)

新架构:
前端 (React) → Supabase (PostgREST + Edge Functions) → PostgreSQL
```

## 目录结构

```
supabase/
├── config.toml              # Supabase 项目配置
├── package.json             # Supabase CLI 依赖
├── migrations/
│   └── 001_initial_schema.sql  # 数据库迁移文件
└── functions/
    ├── _shared/
    │   ├── supabase.ts      # Supabase 客户端工具
    │   ├── cors.ts          # CORS 处理
    │   └── types.ts         # 类型定义
    ├── user/profile/        # 用户资料 API
    ├── expenses/            # 费用管理 API
    ├── reports/             # 报销单 API
    ├── loans/               # 借款 API
    ├── settings/            # 设置 API
    ├── statistics/          # 统计 API
    └── ai/recognize/        # AI 识别 API

frontend/src/
├── lib/
│   ├── supabase.ts          # 前端 Supabase 客户端
│   └── database.types.ts    # 数据库类型定义
└── hooks/
    ├── useAuth.ts           # 认证 Hook
    ├── useExpenses.ts       # 费用 Hook
    └── useReports.ts        # 报销单 Hook
```

## 环境变量配置

### 后端 (Supabase)
在 Supabase Dashboard 中配置:
- `SUPABASE_URL` - 项目 URL
- `SUPABASE_ANON_KEY` - 公开密钥
- `SUPABASE_SERVICE_ROLE_KEY` - 服务端密钥

### 前端
创建 `frontend/.env`:
```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 本地开发

```bash
# 安装 Supabase CLI
npm install -g supabase

# 启动本地 Supabase
cd supabase
supabase start

# 运行数据库迁移
supabase db reset

# 启动 Edge Functions
supabase functions serve

# 生成类型定义
supabase gen types typescript --local > ../frontend/src/lib/database.types.ts
```

## 部署

```bash
# 部署到 Supabase Cloud
supabase link --project-ref your-project-ref
supabase db push
supabase functions deploy
```

## 主要变更

### 认证系统
- **原**: 简单 Token（明文密码）
- **新**: Supabase Auth（JWT + 密码哈希）

### 数据库访问
- **原**: Drizzle ORM + node-postgres
- **新**: Supabase Client + RLS

### 文件存储
- **原**: Base64 存储在数据库
- **新**: Supabase Storage

### API 路由
| 原 Motia Steps | 新 Supabase Edge Functions |
|---------------|---------------------------|
| /api/auth/login | Supabase Auth 内置 |
| /api/auth/register | Supabase Auth 内置 |
| /api/user/profile | /functions/v1/user/profile |
| /api/expenses | /functions/v1/expenses |
| /api/reports | /functions/v1/reports |
| /api/loans | /functions/v1/loans |
| /api/settings/* | /functions/v1/settings |
| /api/statistics | /functions/v1/statistics |
| /api/ai/recognize | /functions/v1/ai/recognize |

## RLS 策略

所有表都启用了行级安全策略，确保用户只能访问自己的数据：

```sql
-- 用户只能访问自己的数据
CREATE POLICY "用户隔离" ON expenses
  FOR ALL USING (auth.uid() = user_id);

-- 管理员可以访问所有数据
CREATE POLICY "管理员访问" ON expenses
  FOR ALL USING (public.is_admin());
```

## 注意事项

1. **用户迁移**: 需要用户重新设置密码（原系统使用明文密码）
2. **数据迁移**: 使用 `pg_dump` 导出并导入到 Supabase
3. **附件迁移**: 需要运行脚本将 Base64 转移到 Supabase Storage
4. **前端更新**: 所有 API 调用需要更新为使用 Supabase Client