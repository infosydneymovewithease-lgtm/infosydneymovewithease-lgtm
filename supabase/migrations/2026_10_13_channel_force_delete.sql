-- 2026-10-13 · 删账号允许「连记录一起删」
--
-- 老板 10-13：「我想把它删除但是还是做不到」
--
-- 他新建抖音后在日报里填了个 0，那就算一条登记记录，被保护挡住了。
-- 但那条记录就是个 0，删掉毫无损失 —— 我的保护做得太死：
-- 只分「有记录/没记录」，没分「有价值的记录/试出来的垃圾」。
--
-- 改成两步：
--   默认    有记录就拒绝，并在报错里说清有多少条、以及可以强制删
--   强制    连记录一起删，返回删了多少 —— 没有孤儿数据
--
-- 原来担心的「孤儿数据」是指【删账号留记录】。
-- 连记录一起删不会产生孤儿，所以强制删是安全的 ——
-- 唯一的代价是那些历史记录真的没了，所以界面上必须先说清楚删什么。

CREATE OR REPLACE FUNCTION public.delete_channel_account(p_id text, p_force boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE n_inq integer; n_post integer; nm text; total_people integer;
BEGIN
  SELECT name INTO nm FROM channel_account WHERE id = p_id;
  IF nm IS NULL THEN RAISE EXCEPTION '账号不存在：%', p_id; END IF;

  SELECT count(*), coalesce(sum(count), 0) INTO n_inq, total_people
    FROM platform_inquiry WHERE account_id = p_id;
  SELECT count(*) INTO n_post FROM content_post WHERE account_id = p_id;

  IF (n_inq > 0 OR n_post > 0) AND NOT p_force THEN
    RAISE EXCEPTION '「%」有 % 条咨询登记（共 % 人）、% 条发布记录。要么改成「停用」保留历史，要么确认连记录一起删。',
      nm, n_inq, total_people, n_post;
  END IF;

  IF p_force THEN
    DELETE FROM platform_inquiry WHERE account_id = p_id;
    DELETE FROM content_post     WHERE account_id = p_id;
  END IF;

  DELETE FROM channel_account WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'deleted', nm,
                            'inquiries', n_inq, 'posts', n_post, 'people', total_people);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_channel_account(text, boolean) TO anon, authenticated;

-- 查某个账号有多少记录 —— 界面上删之前先问清楚
CREATE OR REPLACE FUNCTION public.channel_account_usage(p_id text)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'inquiries', (SELECT count(*) FROM platform_inquiry WHERE account_id = p_id),
    'people',    (SELECT coalesce(sum(count), 0) FROM platform_inquiry WHERE account_id = p_id),
    'posts',     (SELECT count(*) FROM content_post WHERE account_id = p_id),
    'firstDate', (SELECT min(log_date)::text FROM platform_inquiry WHERE account_id = p_id)
  )
$$;

GRANT EXECUTE ON FUNCTION public.channel_account_usage(text) TO anon, authenticated;
