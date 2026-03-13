# 易报销系统 Bug 修复进度日志

## 2026-03-13 修复记录 (Sprint 2)

### 问题 1: 记账本删除数据失败
**现象**: 记账本添加的记账信息，删除后刷新页面数据恢复

**诊断过程**:
1. 分析 `LedgerView.tsx` 组件
2. 发现 `handleDelete` 只调用 `setExpenses` 更新本地状态
3. 未调用 `deleteExpense` API 持久化删除到数据库

**修复方案**:
- 修改 `LedgerViewProps` 添加 `userId` 参数
- 修改 `handleDelete` 为 async 函数，调用 `deleteExpense` API
- 使用 `Promise.allSettled` 处理批量删除部分成功的情况
- 添加 loading 状态和禁用勾选框防止状态竞争

**代码审查改进**:
- 改进 `deleteExpense` API 返回值校验，检查是否真的删除了记录

### 问题 2: 系统设置缺失管理入口
**现象**: 找不到 AI 大模型配置和用户管理入口

**诊断过程**:
1. 检查 `SettingsView.tsx` 发现功能已存在
2. 发现入口只对 `role === 'admin'` 的用户显示
3. 缺少默认超级管理员账户

**修复方案**:
- 创建数据库迁移 `006_seed_default_super_admin.sql`
- 插入默认管理员账户: wangbo@knet.cn / 68719929
- 角色设为 admin，可访问所有管理功能

### 修改文件清单
```
modified:   frontend/src/types/index.ts
modified:   frontend/src/components/ledger/LedgerView.tsx
modified:   frontend/src/index.tsx
modified:   frontend/src/api/supabase-client.ts
new file:   supabase/migrations/006_seed_default_super_admin.sql
```

---

## 2026-03-11 修复记录 (Sprint 1)

### 问题
用户注册时报错：`Database error saving new user`

### 诊断过程
1. 分析项目架构：React + TypeScript + Vite + Supabase
2. 检查认证流程：`supabase.auth.signUp()` → 触发器 → `profiles` 表
3. 发现 RLS 策略问题：触发器缺少 `BYPASSRLS` 属性

### 根因
PostgreSQL 中 `SECURITY DEFINER` 和 `BYPASSRLS` 是独立属性：
- `SECURITY DEFINER`: 函数以定义者权限执行
- `BYPASSRLS`: 函数绕过行级安全策略

触发器只有 `SECURITY DEFINER`，没有 `BYPASSRLS`，导致 RLS 策略阻止了 profiles 表的 INSERT。

### 修复方案

#### 数据库层面
创建迁移文件 `supabase/migrations/004_fix_trigger_bypassrls.sql`:
- 给 `handle_new_user()` 添加 `BYPASSRLS`
- 给 `is_admin()` 添加 `BYPASSRLS`
- 添加 EXCEPTION 处理

#### 前端层面
优化错误处理：
- 注册时轮询等待 profile 创建
- 登录时优雅处理 profile 获取失败
- 中文友好错误信息

### 验证结果
- TypeScript 类型检查通过
- 需要部署到 Supabase 进行实际验证

### 下一步
1. 部署数据库迁移到 Supabase
2. 测试新用户注册流程
3. 提交代码到 Git
