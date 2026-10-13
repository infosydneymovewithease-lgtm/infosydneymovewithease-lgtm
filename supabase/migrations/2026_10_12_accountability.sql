-- 2026-10-12 · 咨询登记的问责机制 + 账号可自助新增
--
-- 老板 10-12 四点：
--   ① 每个号每天发的内容标题粘贴进去，以证明
--   ② 备注必须真实，与罚款相连接
--   ③ 经理一定要每日确认，罚款双倍
--   ④ 以后可能增加运营平台或账户，现在好像写死了

-- ════════════════════════════════════════════════════════════
-- ① 证明：用 content_post 当凭证，不另开字段
-- ════════════════════════════════════════════════════════════
-- 老板原话是「把每天发的内容标题粘贴进去，以证明」。
-- 我第一版在 platform_inquiry 上加了 evidence 列 —— 错了：
-- 「今天发了什么」已经有 content_post 在记，等于让人填两遍，
-- 两边对不上时不知道信谁，而且月汇总的「发布」数只读 content_post，
-- 填在 evidence 里的根本不算发布。
--
-- 正确做法：发布内容只在一个地方填（content_post），
-- 咨询登记行把当天这个号发的内容【显示】出来当凭证。
-- 填一次，两处都有，数据永远一致。
--
-- （evidence 列没建出来过，所以这里什么都不用做 —— 没有历史包袱要清）

-- ════════════════════════════════════════════════════════════
-- ② 真实性声明 —— 提交日报时必须勾
-- ════════════════════════════════════════════════════════════
-- ⚠️ 声明的文字【存在数据库里，不写死在代码】。
--    罚款条款是老板的管理决定，以后改措辞、改金额不该来找我改代码。

ALTER TABLE daily_work_log ADD COLUMN IF NOT EXISTS truth_confirmed boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN daily_work_log.truth_confirmed IS '提交日报时勾的真实性声明。没勾不让提交';

CREATE TABLE IF NOT EXISTS policy_text (
  key        text PRIMARY KEY,
  content    text NOT NULL,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ⚠️ 用单个 E'' 字符串，不要把普通字符串和 E'' 拼接 ——
--    PostgreSQL 的隐式拼接不接受这种混用，会报 syntax error。
INSERT INTO policy_text (key, content) VALUES
  ('truth_declaration',
   E'我确认以上登记的咨询人数、发布内容均为真实数据，未虚报、未编造。\n如查实虚报，按公司规定罚款。'),
  ('manager_declaration',
   E'我已逐项核对今日客服登记的咨询数与发布内容，确认属实。\n如经理未每日核对、事后查出虚报，经理罚款双倍。')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE policy_text IS '声明文字。存库不写死 —— 措辞和罚则是管理决定，改它不该动代码';


-- ════════════════════════════════════════════════════════════
-- ③ 经理每日确认
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS team_day_confirm (
  work_date    date PRIMARY KEY,
  confirmed_by text NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  note         text
);

COMMENT ON TABLE team_day_confirm IS '经理每日核对确认。没确认的日子要在月汇总里列出来 —— 这是经理自己的考核项';

CREATE OR REPLACE FUNCTION public.confirm_team_day(p_work_date date, p_by text, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO team_day_confirm (work_date, confirmed_by, confirmed_at, note)
  VALUES (p_work_date, p_by, now(), p_note)
  ON CONFLICT (work_date) DO UPDATE
    SET confirmed_by = p_by, confirmed_at = now(), note = COALESCE(p_note, team_day_confirm.note)
  RETURNING to_jsonb(team_day_confirm);
$$;

GRANT EXECUTE ON FUNCTION public.confirm_team_day(date, text, text) TO anon, authenticated;


-- ════════════════════════════════════════════════════════════
-- ④ 新增运营账号 —— 以后开新号不用找人跑 SQL
-- ════════════════════════════════════════════════════════════
-- 账号名在代码里一个字都没写死，一直是从这张表读的。
-- 缺的只是「新增」这个入口，现在补上。

CREATE OR REPLACE FUNCTION public.add_channel_account(
  p_id text, p_platform text, p_name text, p_positioning text, p_status text DEFAULT 'planned')
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO channel_account (id, platform, name, positioning, status, sort_order)
  VALUES (p_id, p_platform, p_name, p_positioning, p_status,
          (SELECT coalesce(max(sort_order), 0) + 1 FROM channel_account))
  RETURNING to_jsonb(channel_account);
$$;

GRANT EXECUTE ON FUNCTION public.add_channel_account(text, text, text, text, text) TO anon, authenticated;
