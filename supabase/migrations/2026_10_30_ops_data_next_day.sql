-- ════════════════════════════════════════════════════════════
-- 43 · 运营数据改成【隔天填】（T+1）
-- 2026-10-30 老板定
-- ════════════════════════════════════════════════════════════
--
-- 老板 10-29 原话：
--   「事实上我们没有办法当天确认小红书的具体人数，除非上班到凌晨 12 点，
--     只有第二天才能确认第一天具体咨询人数」
--   「我发完当天的小红书，顺手就可以看昨天的人数，非常简单，流畅的操作」
--
-- 以前要求当天填当天的咨询数 —— 那个数在当天【物理上不存在】。
-- 人只有两条路：瞎填一个，或者空着交不了日报。
-- 14 天里只有 29% 的日报交上来，根子在这儿，不在人。
--
-- 新规矩：
--   当天填 —— 出勤打卡、小红书评论条数、问题·想改进
--   隔天填 —— 各平台咨询数、加微信人数（统一，没有例外）
--
-- 补填上限（老板 10-30：「经理最多可以补前天，我就可以随便一点，
--                        客服哪里暂时就次天填写就好了」）：
--   客服 / 运营   只能填昨天
--   经理         能补到前天
--   老板         不限
--
-- ⚠️ 这一条必须在数据库里拦。前端已经把超期的输入框变成只读了，
--    但前端拦不住改了日期重新发一次请求，也拦不住浏览器里挂着的旧版本。
--
-- ⚠️ 向后兼容：填【今天】仍然允许（today < today-1 恒为假）。
--    所以老版本的页面还挂在谁的浏览器里也不会报错 ——
--    这一点是故意的，线上有好几次假 bug 都是旧缓存引起的。


-- ── ① 记住「第一次是谁填的」 ─────────────────────────────
-- 老板 10-30：「记录一下也好，毕竟补写的时候很好记录是谁和什么时间」
-- 原来只有 recorded_by，被后面的人改一次就被覆盖掉了，
-- 「谁第一个填的」就查不到了。first_filled_at 早就有，补上对应的人。
ALTER TABLE platform_inquiry ADD COLUMN IF NOT EXISTS first_filled_by text;

COMMENT ON COLUMN platform_inquiry.first_filled_by IS
  '第一次填这条的人。recorded_by 会被后面的修改覆盖，这一列不会。
   和 log_date 比 first_filled_at 就知道隔了几天才补上的';

-- 已有的记录：第一次填的人就当是 recorded_by（能知道的最接近的值）
UPDATE platform_inquiry SET first_filled_by = recorded_by WHERE first_filled_by IS NULL;


-- ── ② save_inquiry 加补填期限 ───────────────────────────
-- ⚠️ 签名和线上那版完全一致 (date, text, integer, text)，
--    所以是 REPLACE 不是新建重载。上次（38）凭记忆写错签名，
--    结果会建出第二个函数、旧的还在跑，静默失败 —— 不能再来一次。
-- 函数体照抄 2026_10_12_inquiry_per_staff.sql 里那版（按人存的 plpgsql），
-- 只在开头加了日期窗口的校验。
CREATE OR REPLACE FUNCTION public.save_inquiry(
  p_log_date date, p_account_id text, p_count integer, p_by text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r        platform_inquiry%ROWTYPE;
  v_today  date;
  v_role   text;
  v_limit  int;
BEGIN
  -- 悉尼的今天，不是服务器的今天
  v_today := (now() AT TIME ZONE 'Australia/Sydney')::date;

  IF p_log_date > v_today THEN
    RAISE EXCEPTION '不能登记还没到的日子（%）', p_log_date;
  END IF;

  SELECT role INTO v_role FROM staff WHERE id = p_by;

  -- 查不到人就按最严的算 —— 宁可挡住，也不要默默放行一个不认识的账号
  v_limit := CASE v_role
               WHEN 'admin'   THEN 3650   -- 老板不限
               WHEN 'manager' THEN 2      -- 经理补到前天
               ELSE 1                     -- 客服 / 运营只填昨天
             END;

  IF p_log_date < v_today - v_limit THEN
    RAISE EXCEPTION '% 已经过了补填期限，你最多能补到 %。这一天请让老板补。',
      p_log_date, (v_today - v_limit);
  END IF;

  SELECT * INTO r FROM platform_inquiry
   WHERE log_date = p_log_date AND account_id = p_account_id AND staff_id = p_by;

  IF r.id IS NULL THEN
    INSERT INTO platform_inquiry (log_date, account_id, staff_id, count, recorded_by,
                                  updated_at, first_filled_at, first_filled_by, edit_count)
    VALUES (p_log_date, p_account_id, p_by, p_count, p_by, now(), now(), p_by, 0)
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


-- ── ③ 自检 ──────────────────────────────────────────────
-- 跑完看这三行。全是「对」才算成功。
SELECT '只有一个 save_inquiry（没建出重载）' AS 检查项,
       CASE WHEN count(*) = 1 THEN '对' ELSE '错 —— 有 ' || count(*) || ' 个，要删掉多余的' END AS 结果
FROM pg_proc WHERE proname = 'save_inquiry'
UNION ALL
SELECT 'first_filled_by 列建好了',
       CASE WHEN count(*) = 1 THEN '对' ELSE '错' END
FROM information_schema.columns
WHERE table_name = 'platform_inquiry' AND column_name = 'first_filled_by'
UNION ALL
SELECT '历史记录都补上了第一次填写人',
       CASE WHEN count(*) = 0 THEN '对' ELSE '还有 ' || count(*) || ' 条是空的' END
FROM platform_inquiry WHERE first_filled_by IS NULL;
