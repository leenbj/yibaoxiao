-- 易报销 Pro - 数据库验证脚本
-- 在 Supabase SQL Editor 中运行此脚本验证数据库配置

-- ==================== 1. 检查表是否存在 ====================

SELECT
  '表检查' AS 检查项,
  CASE
    WHEN COUNT(*) = 10 THEN '✓ 所有表已创建'
    ELSE '✗ 缺少表，期望 10 个，实际 ' || COUNT(*) || ' 个'
  END AS 结果
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'profiles', 'expenses', 'reports', 'report_items',
  'loans', 'payment_accounts', 'budget_projects',
  'ai_configs', 'attachments', 'token_usage'
);

-- ==================== 2. 检查 RLS 是否启用 ====================

SELECT
  'RLS 检查' AS 检查项,
  CASE
    WHEN COUNT(*) = 0 THEN '✓ 所有表已启用 RLS'
    ELSE '✗ 以下表未启用 RLS: ' || string_agg(tablename, ', ')
  END AS 结果
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = false
AND tablename IN (
  'profiles', 'expenses', 'reports', 'report_items',
  'loans', 'payment_accounts', 'budget_projects',
  'ai_configs', 'attachments', 'token_usage'
);

-- ==================== 3. 检查枚举类型 ====================

SELECT
  '枚举类型检查' AS 检查项,
  CASE
    WHEN COUNT(*) >= 5 THEN '✓ 枚举类型已创建 (' || COUNT(*) || ' 个)'
    ELSE '✗ 枚举类型不完整，期望至少 5 个'
  END AS 结果
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN (
  'expense_status', 'report_status', 'user_role',
  'attachment_type', 'ai_provider'
)
GROUP BY t.typname;

-- ==================== 4. 检查 Storage Bucket ====================

SELECT
  'Storage Bucket 检查' AS 检查项,
  CASE
    WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'attachments')
    THEN '✓ attachments bucket 已创建'
    ELSE '✗ attachments bucket 未创建，请在 Dashboard 创建'
  END AS 结果;

-- ==================== 5. 检查 Storage 策略 ====================

SELECT
  'Storage 策略检查' AS 检查项,
  CASE
    WHEN COUNT(*) >= 3 THEN '✓ Storage 策略已配置 (' || COUNT(*) || ' 个)'
    ELSE '✗ Storage 策略不完整，期望至少 3 个'
  END AS 结果
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%附件%';

-- ==================== 6. 检查触发器 ====================

SELECT
  '触发器检查' AS 检查项,
  CASE
    WHEN COUNT(*) >= 1 THEN '✓ 用户创建触发器已配置'
    ELSE '✗ 用户创建触发器未配置'
  END AS 结果
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- ==================== 7. 检查索引 ====================

SELECT
  '索引检查' AS 检查项,
  CASE
    WHEN COUNT(*) >= 10 THEN '✓ 索引已创建 (' || COUNT(*) || ' 个)'
    ELSE '✗ 索引不完整，期望至少 10 个'
  END AS 结果
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%';

-- ==================== 8. 详细表结构 ====================

SELECT
  '表详情' AS 信息,
  table_name AS 表名,
  (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) AS 列数
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ==================== 9. RLS 策略详情 ====================

SELECT
  'RLS 策略' AS 类型,
  tablename AS 表名,
  policyname AS 策略名,
  cmd AS 操作,
  CASE
    WHEN qual IS NOT NULL THEN '有条件'
    ELSE '无条件'
  END AS 策略类型
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ==================== 10. 测试用户创建（可选）====================

-- 取消注释以下代码测试用户创建
/*
-- 创建测试用户（需要 service_role key）
SELECT auth.uid() AS 当前用户ID;

-- 检查 profiles 表是否自动创建记录
SELECT * FROM profiles LIMIT 5;
*/
