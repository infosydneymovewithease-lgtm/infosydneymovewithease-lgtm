-- 2026-10-13 · 运营账号可以删、可以改
--
-- 老板 10-13：「我添加没问题了，删除怎么删除」
-- 顺带发现他加的「抖音」平台栏写成了小红书 —— 所以也要能改。
--
-- ⚠️ 删除有条件：已经有咨询登记或发布记录的账号【不能删】。
--    删了那些历史记录就成了孤儿 —— platform_inquiry 里躺着一个
--    查不到名字的 account_id，月汇总和周报会显示成乱码一样的东西。
--    这种情况下正确做法是「停用」：不再出现在每日登记里，历史照常可查。

CREATE OR REPLACE FUNCTION public.delete_channel_account(p_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE n_inq integer; n_post integer; nm text;
BEGIN
  SELECT name INTO nm FROM channel_account WHERE id = p_id;
  IF nm IS NULL THEN RAISE EXCEPTION '账号不存在：%', p_id; END IF;

  SELECT count(*) INTO n_inq  FROM platform_inquiry WHERE account_id = p_id;
  SELECT count(*) INTO n_post FROM content_post     WHERE account_id = p_id;

  IF n_inq > 0 OR n_post > 0 THEN
    RAISE EXCEPTION '「%」已经有 % 条咨询登记、% 条发布记录，不能删除。请改成「停用」—— 它会从每日登记里消失，但历史数据还查得到。',
      nm, n_inq, n_post;
  END IF;

  DELETE FROM channel_account WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'deleted', nm);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_channel_account(text) TO anon, authenticated;
