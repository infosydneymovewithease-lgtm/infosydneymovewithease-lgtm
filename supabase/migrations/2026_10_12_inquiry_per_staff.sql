-- 2026-10-12 · 平台咨询登记改成【按人】存
--
-- 老板 10-12：「因为有时候是两个人，所以需要知道各自」
--
-- 原来主键是 (log_date, account_id)，不分人 ——
-- 两个人在岗时谁后填谁覆盖，分不出各自接待了多少。
-- 这也是我在月汇总里不得不标「转化率两人同天会重复计算」的原因。
-- 改成 (log_date, account_id, staff_id)，那个警告就可以拿掉。

ALTER TABLE platform_inquiry ADD COLUMN IF NOT EXISTS staff_id text;

-- 已有的几条补上填写人（recorded_by 就是填的人）
UPDATE platform_inquiry SET staff_id = recorded_by WHERE staff_id IS NULL;
UPDATE platform_inquiry SET staff_id = 'unknown'   WHERE staff_id IS NULL;

ALTER TABLE platform_inquiry ALTER COLUMN staff_id SET NOT NULL;

-- 换唯一约束：先删旧的，再建新的
ALTER TABLE platform_inquiry DROP CONSTRAINT IF EXISTS platform_inquiry_log_date_account_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS platform_inquiry_uniq
  ON platform_inquiry (log_date, account_id, staff_id);

COMMENT ON COLUMN platform_inquiry.staff_id IS '谁接待的。两个人在岗时各填各的，合计是相加';

CREATE OR REPLACE FUNCTION public.save_inquiry(
  p_log_date date, p_account_id text, p_count integer, p_by text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r platform_inquiry%ROWTYPE;
BEGIN
  SELECT * INTO r FROM platform_inquiry
   WHERE log_date = p_log_date AND account_id = p_account_id AND staff_id = p_by;

  IF r.id IS NULL THEN
    INSERT INTO platform_inquiry (log_date, account_id, staff_id, count, recorded_by,
                                  updated_at, first_filled_at, edit_count)
    VALUES (p_log_date, p_account_id, p_by, p_count, p_by, now(), now(), 0)
    RETURNING * INTO r;
  ELSE
    UPDATE platform_inquiry
       SET count = p_count, recorded_by = p_by, updated_at = now(),
           edit_count = edit_count + 1
     WHERE id = r.id
    RETURNING * INTO r;
  END IF;
  RETURN to_jsonb(r);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_inquiry(date, text, integer, text) TO anon, authenticated;
