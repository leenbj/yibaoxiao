# 易报销系统 Bug 修复计划

## 当前任务：Bug 修复 Sprint 5 (2026-03-13) ✅ 已完成

### 修复的 Bug

#### Bug: AI 配置"设为默认"不生效
- **现象**: 点击"设为默认"按钮没有任何提示，AI 识别仍然失败
- **根因**: 前端使用 `config.isActive`（camelCase）读取状态，但数据库字段是 `is_active`（snake_case），`getAIConfigs` 函数没有做字段名转换
- **修复内容**:
  - 修改 `getAIConfigs` 函数，添加字段名转换：
    - `is_active` → `isActive`
    - `api_key` → `apiKey`
    - `api_url` → `apiUrl`
    - `created_at` → `createdAt`
    - `updated_at` → `updatedAt`
    - `user_id` → `userId`

### 修改文件清单
```
modified:   frontend/src/api/supabase-client.ts
```

---

## 历史任务：Bug 修复 Sprint 4 (2026-03-13) ✅ 已完成

### 修复的 Bug 列表

#### Bug 1: AI 分析失败错误提示不明确 ✅ 已修复
- **现象**: 报销提交资料后提醒"AI 分析失败，请检查网络或重试"，无法知道具体原因
- **根因**: 错误处理只显示通用消息，没有显示实际的错误内容
- **修复内容**:
  - `useInvoiceAnalysis.ts`: 改为显示具体错误消息
  - `LoanView.tsx`: 改为显示具体错误消息
  - `useTravelAnalysis.ts`: 已有完善的错误提示（无需修改）

#### Bug 2: AI 配置自动激活问题 ✅ 已修复
- **现象**: 用户添加第一个 AI 配置后，配置未被激活，导致 AI 识别失败
- **根因**: `saveAIConfig` 函数中，`is_active` 默认为 `false`，用户第一次添加配置时没有激活
- **修复内容**:
  - 修改 `saveAIConfig` 函数逻辑：
    - 如果设置为默认，则激活此配置并取消其他配置的激活状态
    - 如果用户没有任何激活的配置（无论是新建还是编辑），自动激活此配置
  - 修改 `deleteAIConfig` 函数逻辑：
    - 如果删除的是激活配置，自动激活剩余的第一个配置

#### Bug 3: 记账本状态更新不持久化 ✅ 已修复
- **现象**: 在记账本中更改费用状态后刷新页面状态恢复
- **根因**: `updateStatus` 函数只更新本地状态，没有同步到数据库
- **修复内容**:
  - 导入 `updateExpense` API
  - 修改 `updateStatus` 函数，使用乐观更新策略：
    - 先保存原始状态
    - 乐观更新本地状态
    - 同步到数据库
    - 失败时正确回滚到原始状态

### 修改文件清单
```
modified:   frontend/src/api/supabase-client.ts
modified:   frontend/src/components/ledger/LedgerView.tsx
modified:   frontend/src/components/loan/LoanView.tsx
modified:   frontend/src/hooks/useInvoiceAnalysis.ts
modified:   plans/task_plan.md
```

### 验证结果
- [x] TypeScript 类型检查通过
- [ ] 需要部署到 Supabase 进行实际验证
- [ ] 需要用户测试 AI 识别功能

---

## 历史任务：Bug 修复 Sprint 3 (2026-03-13) ✅ 已完成

### 修复的 Bug 列表

#### Bug 1: 记账本删除数据失败 ✅ 已修复
- **现象**: 记账本添加的记账信息，删除后刷新页面数据恢复
- **根因**: `LedgerView.tsx` 的 `handleDelete` 只更新本地状态，未调用 API

#### Bug 2: 系统设置缺失管理入口 ✅ 已修复
- **现象**: 系统设置中找不到 AI 大模型配置和用户管理入口
- **根因**: 功能已存在，但需要管理员账户才能看到入口

#### Bug 3: 豆包模型连接失败 ✅ 已修复
- **现象**: 测试豆包模型连接失败
- **根因**: `testAIConfig` 函数未处理 doubao/volcengine 提供商

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
