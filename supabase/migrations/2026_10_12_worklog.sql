-- 2026-10-12 · 四板块升级 第 5 步：客服工作台
--
-- 结构（一个入口，两个视角）：
--   客服在自己日报里填 → Annie 的团队视图自动汇总。只填一次，两处都能用。
--
--   出勤        上班 / 三段餐休 / 下班
--   平台咨询登记  7 个触点，每天逐个检查（必填）
--   每日工作记录  发布内容 / 主动开发 / 问题
--
-- 全部纯新增，不碰任何现有表。

-- ════════════════════════════════════════════════════════════
-- ① daily_work_log —— 每人每天一条
-- ════════════════════════════════════════════════════════════
-- ⚠️ 时间一律 timestamptz，绝不存「09:00」裸字符串。
--    客服在国内、公司在悉尼，夏令时差 3 小时冬令时差 2 小时，
--    存裸字符串就等着跟 9/29 那个 bug 一样翻车。

CREATE TABLE IF NOT EXISTS daily_work_log (
  id           bigserial PRIMARY KEY,
  work_date    date NOT NULL,
  staff_id     text NOT NULL,
  clock_in     timestamptz,
  clock_out    timestamptz,
  outreach     text,          -- 主动开发 / 其他工作
  issues       text,          -- 问题 / 明天注意
  submitted_at timestamptz,   -- 空 = 未提交
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_date, staff_id)
);

CREATE INDEX IF NOT EXISTS daily_work_log_date_idx ON daily_work_log (work_date DESC);

COMMENT ON COLUMN daily_work_log.submitted_at IS '空=未提交。平台咨询没逐个登记完就不让提交';


-- ════════════════════════════════════════════════════════════
-- ② break_record —— 每段休息一行
-- ════════════════════════════════════════════════════════════
-- ⚠️ 这里和 06_数据表设计.md 的原始方案不一样，是故意的。
--    原方案把三段休息写成 daily_work_log 的 6 个固定列
--    （breakfast_start/end、lunch_start/end、dinner_start/end）。
--
--    但老板 10-11 把休息改成了【窗口制 + 先到先占】：
--      谁先点「去休息」，那个小时就被占住，另一个人看到是灰的。
--    这需要随时查「今天这个小时被谁占了」——
--    固定列要横着扫 3 列 × N 个人，一行一段只要一句 WHERE。
--    而且以后补到三人、或者改成 6 段各 30 分，这张表不用动。

CREATE TABLE IF NOT EXISTS break_record (
  id         bigserial PRIMARY KEY,
  work_date  date    NOT NULL,
  staff_id   text    NOT NULL,
  slot_index integer NOT NULL,          -- 对应 break_window.slot_index
  started_at timestamptz NOT NULL,
  ended_at   timestamptz,               -- 空 = 还在休息中
  minutes    integer,                   -- 结束时算好存下来，省得每次减
  overtime   boolean NOT NULL DEFAULT false,  -- 超过配置的时长
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_date, staff_id, slot_index)
);

CREATE INDEX IF NOT EXISTS break_record_date_idx ON break_record (work_date, started_at);

COMMENT ON TABLE break_record IS '每人每段休息一行。先到先占：查同一天同一时段有没有别人占了';


-- ════════════════════════════════════════════════════════════
-- ③ platform_inquiry —— 平台咨询登记
-- ════════════════════════════════════════════════════════════
-- 老板强调：7 个触点一定要每天逐个检查登记，而且要直观。
-- 未开通的号也列出来（channel_account.status='planned'），一直在客服眼前，
-- 不会被忘掉；Annie 把号开起来后改个状态就自动变必填。

CREATE TABLE IF NOT EXISTS platform_inquiry (
  id          bigserial PRIMARY KEY,
  log_date    date    NOT NULL,
  account_id  text    NOT NULL,         -- → channel_account.id
  count       integer NOT NULL DEFAULT 0,
  recorded_by text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (log_date, account_id)
);

CREATE INDEX IF NOT EXISTS platform_inquiry_date_idx ON platform_inquiry (log_date DESC);


-- ════════════════════════════════════════════════════════════
-- ④ content_post —— 发布了什么内容
-- ════════════════════════════════════════════════════════════
-- 老板 10-11：运营每周最少保证出一个视频（微信视频号）。
-- kind 分图文/视频就是为了统计「这周视频出了没」。

CREATE TABLE IF NOT EXISTS content_post (
  id         bigserial PRIMARY KEY,
  post_date  date NOT NULL,
  account_id text NOT NULL,             -- → channel_account.id
  kind       text NOT NULL DEFAULT 'image',  -- image / video
  title      text,
  posted_by  text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_post_date_idx ON content_post (post_date DESC);


-- ════════════════════════════════════════════════════════════
-- ⑤ 读取 RPC —— 某天的全部工作数据，一次取回
-- ════════════════════════════════════════════════════════════
-- 客服自己的日报和 Annie 的团队视图读的是同一份数据，
-- 差别只在前端怎么展示 —— 不要做两套查询，那是数字对不上的开始。

CREATE OR REPLACE FUNCTION public.get_workday(p_work_date date)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'logs',      (SELECT coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
                    FROM daily_work_log l WHERE l.work_date = p_work_date),
    'breaks',    (SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.started_at), '[]'::jsonb)
                    FROM break_record b WHERE b.work_date = p_work_date),
    'inquiries', (SELECT coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
                    FROM platform_inquiry i WHERE i.log_date = p_work_date),
    'posts',     (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.created_at), '[]'::jsonb)
                    FROM content_post c WHERE c.post_date = p_work_date)
  )
$$;

GRANT EXECUTE ON FUNCTION public.get_workday(date) TO anon, authenticated;


-- ════════════════════════════════════════════════════════════
-- ⑥ 一周的咨询登记（Annie 的账号 × 星期表，漏登记标红用）
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_inquiry_week(p_from date, p_to date)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
    FROM platform_inquiry i
   WHERE i.log_date BETWEEN p_from AND p_to
$$;

GRANT EXECUTE ON FUNCTION public.get_inquiry_week(date, date) TO anon, authenticated;
