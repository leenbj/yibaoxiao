-- 附件自动清理迁移
-- 规则：
-- - 草稿(draft): 7天后清理附件
-- - 已提交(submitted): 5天后清理附件
-- - 已支付(paid): 立即清理附件
-- 注意：只清理附件文件，报销单记录保留

-- ==================== 添加清理相关字段 ====================

ALTER TABLE public.attachments
ADD COLUMN IF NOT EXISTS cleanup_after timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_cleaned boolean DEFAULT false;

-- 创建索引加速清理查询
CREATE INDEX IF NOT EXISTS idx_attachments_cleanup
ON public.attachments(cleanup_after)
WHERE is_cleaned = false;

-- 创建附件清理日志表
CREATE TABLE IF NOT EXISTS public.attachment_cleanup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id text NOT NULL,
  storage_path text,
  file_name text,
  file_size bigint,
  reason text NOT NULL,
  cleaned_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- ==================== 设置清理时间的触发器 ====================

CREATE OR REPLACE FUNCTION public.schedule_attachment_cleanup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  cleanup_interval interval;
BEGIN
  -- 根据报销单状态设置清理时间间隔
  CASE NEW.status
    WHEN 'paid' THEN
      -- 已支付：立即清理（设置为当前时间）
      cleanup_interval := interval '0 seconds';
    WHEN 'submitted' THEN
      -- 已提交：5天后清理
      cleanup_interval := interval '5 days';
    WHEN 'draft' THEN
      -- 草稿：7天后清理
      cleanup_interval := interval '7 days';
    ELSE
      cleanup_interval := interval '7 days';
  END CASE;

  -- 更新关联附件的清理时间
  UPDATE public.attachments
  SET cleanup_after = now() + cleanup_interval
  WHERE report_id = NEW.id
    AND is_cleaned = false;

  RETURN NEW;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS schedule_attachment_cleanup_trigger ON public.reports;
CREATE TRIGGER schedule_attachment_cleanup_trigger
  AFTER UPDATE OF status ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.schedule_attachment_cleanup();

-- ==================== 为已有数据设置清理时间 ====================

UPDATE public.attachments a
SET cleanup_after = now() +
  CASE r.status
    WHEN 'paid' THEN interval '0 seconds'
    WHEN 'submitted' THEN interval '5 days'
    ELSE interval '7 days'
  END
FROM public.reports r
WHERE a.report_id = r.id
  AND a.cleanup_after IS NULL
  AND a.is_cleaned = false;

-- ==================== 借款单附件清理触发器 ====================

CREATE OR REPLACE FUNCTION public.schedule_loan_attachment_cleanup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  cleanup_interval interval;
BEGIN
  CASE NEW.status
    WHEN 'paid' THEN
      cleanup_interval := interval '0 seconds';
    WHEN 'submitted' THEN
      cleanup_interval := interval '5 days';
    ELSE
      cleanup_interval := interval '7 days';
  END CASE;

  UPDATE public.attachments
  SET cleanup_after = now() + cleanup_interval
  WHERE loan_id = NEW.id
    AND is_cleaned = false;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schedule_loan_attachment_cleanup_trigger ON public.loans;
CREATE TRIGGER schedule_loan_attachment_cleanup_trigger
  AFTER UPDATE OF status ON public.loans
  FOR EACH ROW
  EXECUTE FUNCTION public.schedule_loan_attachment_cleanup();

-- 更新已有借款单附件
UPDATE public.attachments a
SET cleanup_after = now() +
  CASE l.status
    WHEN 'paid' THEN interval '0 seconds'
    WHEN 'submitted' THEN interval '5 days'
    ELSE interval '7 days'
  END
FROM public.loans l
WHERE a.loan_id = l.id
  AND a.cleanup_after IS NULL
  AND a.is_cleaned = false;
