-- 2026-10-12 · 平台咨询登记的可信度痕迹
--
-- 老板 10-12 提的问题：「我是客服，晚上我很累，我想随便填写糊弄一下就好」
--
-- 先说清楚边界：这个数【无法验证】。咨询发生在微信和小红书里，
-- 系统看不见，任何自报数字都能编。这是物理限制，不是能靠设计消除的。
--
-- 能做的是让糊弄留下痕迹，并把痕迹给 Annie 看：
--   first_filled_at  第一次填的时间（和打卡时间比，能看出是不是下班前一口气补的）
--   edit_count       改过几次
--   fill_seconds     从当天第一个框到最后一个框花了多久（几秒填完 = 没去平台看）
--
-- ⚠️ 这些痕迹【只在 Annie 的视图和月汇总里显示】，
--    客服自己那页不提示 —— 提示了等于教她怎么绕过。

ALTER TABLE platform_inquiry ADD COLUMN IF NOT EXISTS first_filled_at timestamptz;
ALTER TABLE platform_inquiry ADD COLUMN IF NOT EXISTS edit_count      integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN platform_inquiry.first_filled_at IS '第一次填的时间。和 daily_work_log.clock_in 比可以看出是不是下班前一口气补的';
COMMENT ON COLUMN platform_inquiry.edit_count IS '改过几次。改很多次不一定可疑，但配合其他信号有参考价值';

-- 已有的 4 条补上首次填写时间（就用 updated_at，这是我们能知道的最接近的值）
UPDATE platform_inquiry SET first_filled_at = updated_at WHERE first_filled_at IS NULL;

-- 写入走这个函数：第一次填记时间，之后只累加 edit_count
CREATE OR REPLACE FUNCTION public.save_inquiry(
  p_log_date date, p_account_id text, p_count integer, p_by text)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO platform_inquiry (log_date, account_id, count, recorded_by, updated_at, first_filled_at, edit_count)
  VALUES (p_log_date, p_account_id, p_count, p_by, now(), now(), 0)
  ON CONFLICT (log_date, account_id) DO UPDATE
    SET count = p_count,
        recorded_by = p_by,
        updated_at = now(),
        edit_count = platform_inquiry.edit_count + 1
  RETURNING to_jsonb(platform_inquiry);
$$;

GRANT EXECUTE ON FUNCTION public.save_inquiry(date, text, integer, text) TO anon, authenticated;
