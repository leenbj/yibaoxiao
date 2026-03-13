# 易报销系统 Bug 修复计划

## 当前任务：Bug 修复 Sprint 2 (2026-03-13) ✅ 已完成

### 修复的 Bug 列表

#### Bug 1: 记账本删除数据失败 ✅ 已修复
- **现象**: 记账本添加的记账信息，删除后刷新页面数据恢复
- **根因**: `LedgerView.tsx` 的 `handleDelete` 只更新本地状态，未调用 API
- **修复内容**:
  - `frontend/src/types/index.ts`: 添加 `userId` 到 `LedgerViewProps`
  - `frontend/src/components/ledger/LedgerView.tsx`: 添加 `deleteExpense` API 调用
  - `frontend/src/index.tsx`: 传递 `userId` 给 `LedgerView`
  - 改进: 使用 `Promise.allSettled` 处理批量删除部分成功的情况
  - 改进: 添加删除中的 loading 状态和禁用勾选框

#### Bug 2: 系统设置缺失管理入口 ✅ 已修复
- **现象**: 系统设置中找不到 AI 大模型配置和用户管理入口
- **根因**: 功能已存在，但需要管理员账户才能看到入口
- **修复内容**:
  - 创建 `supabase/migrations/006_seed_default_super_admin.sql`
  - 默认超级管理员账户: `wangbo@knet.cn` / `68719929`
  - 该账户具有 `admin` 角色，可访问用户管理和 AI 配置

---

## 历史任务：Bug 修复 Sprint 1 (2026-03-11) ✅ 已完成

### 核心问题
用户注册时报错：`Database error saving new user`

## 问题根因分析 ✅ 已确认

### 根本原因
**触发器函数 `handle_new_user()` 声明了 `SECURITY DEFINER`，但缺少 `BYPASSRLS` 属性**

### 技术原理
| 属性 | 作用 | 是否解决 RLS 问题 |
|------|------|------------------|
| `SECURITY DEFINER` | 函数以定义者权限执行 | No |
| `BYPASSRLS` | 函数绕过行级安全策略 | Yes |
| `SECURITY DEFINER BYPASSRLS` | 两者结合 | Yes |

### 问题流程
1. 用户执行 `supabase.auth.signUp()`
2. `auth.users` 表成功插入新用户记录
3. 触发器 `on_auth_user_created` 执行
4. 触发器尝试 INSERT 到 `profiles` 表
5. RLS 策略 `WITH CHECK (auth.uid() = id)` 生效
6. 由于缺少 `BYPASSRLS`，INSERT 被拒绝
7. Supabase 返回 "Database error saving new user"

## 修复状态 ✅ 已完成

### 修复 1: 数据库迁移
文件: `supabase/migrations/004_fix_trigger_bypassrls.sql`

- 添加 `BYPASSRLS` 属性到 `handle_new_user()` 函数
- 添加 `BYPASSRLS` 属性到 `is_admin()` 函数
- 添加 EXCEPTION 处理避免触发器失败影响用户创建
- 添加权限授予

### 修复 2: 前端错误处理优化
修改文件:
- `frontend/src/api/supabase-client.ts`
- `frontend/src/components/auth/LoginView.tsx`
- `frontend/src/hooks/useAuth.ts`

改进内容:
- 注册时轮询等待 profile 创建（最多 3 秒）
- 登录时优雅处理 profile 获取失败
- 用户友好的中文错误信息映射

## 部署步骤

### 方法 1: Supabase Dashboard (推荐)
1. 登录 Supabase Dashboard
2. 进入 SQL Editor
3. 执行 `supabase/migrations/004_fix_trigger_bypassrls.sql` 内容
4. 部署前端代码

### 方法 2: Supabase CLI
```bash
cd /Users/ethan/Desktop/开发项目/yibaoxiao/yibaoxiao
supabase db push
```

## 验证结果

- [x] TypeScript 类型检查通过
- [x] 数据库迁移文件语法正确
- [x] 前端错误处理完善
- [ ] 需要部署到 Supabase 进行实际验证

## 修改文件清单

```
modified:   frontend/src/api/supabase-client.ts
modified:   frontend/src/components/auth/LoginView.tsx
modified:   frontend/src/hooks/useAuth.ts
new file:   supabase/migrations/004_fix_trigger_bypassrls.sql
new file:   plans/task_plan.md
new file:   plans/progress.md
```
