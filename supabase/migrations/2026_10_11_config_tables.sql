-- 2026-10-11 · 四板块升级 第 3 步
-- 四张配置表 —— 把「写死在代码里的运营常识」搬进数据库
--
-- 为什么这步要排在功能之前：
--   后面的客服工作台、每日对账、周月汇总都要读这些配置。
--   先把地基铺好，后面三步就只管写页面，不用再回头改表。
--
-- 全部是纯新增（CREATE TABLE），不碰任何现有表，删掉即可回滚。

-- ════════════════════════════════════════════════════════════
-- ① channel_account —— 运营账号
-- ════════════════════════════════════════════════════════════
-- 老板 10-11：目前只有「迁喜」和「盼达」是真在运营的，其余是设想。
--   迁喜 → 大卡车 + house 搬家
--   盼达 → 小卡车 + 留学生搬家
-- planned 的账号在登记表里灰显；改成 active 就自动变必填 ——
-- 以后开新号不用改代码，后台点一下就进每日登记。

CREATE TABLE IF NOT EXISTS channel_account (
  id          text PRIMARY KEY,
  platform    text NOT NULL,            -- 小红书 / 微信
  name        text NOT NULL,
  positioning text,
  status      text NOT NULL DEFAULT 'planned',  -- active / planned / paused
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN channel_account.status IS 'active=每日必须登记；planned=灰显不必填；paused=暂停不显示';

INSERT INTO channel_account (id, platform, name, positioning, status, sort_order) VALUES
  ('qianxi',   '小红书', '迁喜',     '大卡车 · house 搬家',   'active',  1),
  ('panda',    '小红书', '盼达',     '小卡车 · 留学生搬家',   'active',  2),
  ('moments',  '微信',   '朋友圈',   '全车型 · 老客复购',     'active',  3),
  ('channels', '微信',   '视频号',   '每周至少 1 条视频',     'active',  4),
  ('van',      '小红书', '面包车号', '面包车 · 小件同城',     'planned', 5),
  ('longhaul', '小红书', '长途号',   '跨州长途',             'planned', 6),
  ('storage',  '小红书', '寄存号',   '仓储寄存',             'planned', 7)
ON CONFLICT (id) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- ② shift_config —— 班次（两套，按夏令时/冬令时切）
-- ════════════════════════════════════════════════════════════
-- ⚠️ 这张表存【悉尼时间】—— 它描述的是「公司对客户开门的时间」。
--    客服在国内，界面上要换算成北京时间显示（夏差 3 小时 / 冬差 2 小时）。
--    时差绝不写死：两个时区各自算，差多少交给时区库。
--    9/29 的夏令时 bug（1465ba0）就是写死时间算出来的，不能再犯。

CREATE TABLE IF NOT EXISTS shift_config (
  season                 text PRIMARY KEY,   -- summer / winter
  start_time             time NOT NULL,      -- 悉尼时间
  end_time               time NOT NULL,      -- 悉尼时间
  break_count            integer NOT NULL DEFAULT 3,
  break_minutes          integer NOT NULL DEFAULT 60,
  overtime_alert_minutes integer NOT NULL DEFAULT 5,
  business_tz            text NOT NULL DEFAULT 'Australia/Sydney',
  staff_tz               text NOT NULL DEFAULT 'Asia/Shanghai'
);

COMMENT ON TABLE  shift_config IS '班次。start_time/end_time 是悉尼时间，显示给国内客服时按 staff_tz 换算';
COMMENT ON COLUMN shift_config.overtime_alert_minutes IS '餐休超过多少分钟提醒本人和 Annie。只提醒，不阻止';

INSERT INTO shift_config (season, start_time, end_time) VALUES
  ('summer', TIME '09:00', TIME '21:00'),   -- 北京 06:00 - 18:00
  ('winter', TIME '08:30', TIME '20:30')    -- 北京 06:30 - 18:30
ON CONFLICT (season) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- ③ break_window —— 休息窗口（给范围，不给钟点）
-- ════════════════════════════════════════════════════════════
-- 老板 10-11：「固定钟点太死板，值得给一个休息的时间，
--              两个人商量好点选，后时间被占用这样合理很多」
--
-- ⚠️ 这张表存【北京时间】—— 和 shift_config 不一样，是故意的。
--    休息窗口锚定的是客服本人的饭点（早饭 7 点、午饭 11 点半），
--    不是悉尼的钟点。按悉尼排的话午饭会落在北京上午 10 点，不是饭点。
--    冬令时整体挪半小时，因为班次在北京时间里也挪了半小时。
--
-- single_day=false：单人值班那天不排这一段 ——
-- 只有一个人在岗，休 3 小时没人接电话。老板 10-11 定：单人日只休 2 小时。

CREATE TABLE IF NOT EXISTS break_window (
  season       text    NOT NULL,
  slot_index   integer NOT NULL,
  slot_name    text    NOT NULL,
  window_start time    NOT NULL,          -- 北京时间
  window_end   time    NOT NULL,          -- 北京时间
  duration_min integer NOT NULL DEFAULT 60,
  single_day   boolean NOT NULL DEFAULT true,
  PRIMARY KEY (season, slot_index)
);

COMMENT ON TABLE  break_window IS '休息窗口（北京时间）。员工在窗口内自选 1 小时，先到先占';
COMMENT ON COLUMN break_window.single_day IS 'false = 单人值班日不开放这一段';

INSERT INTO break_window (season, slot_index, slot_name, window_start, window_end, duration_min, single_day) VALUES
  ('summer', 1, '早饭',     TIME '07:00', TIME '09:00', 60, true),
  ('summer', 2, '午饭',     TIME '11:00', TIME '13:30', 60, true),
  ('summer', 3, '下午休息', TIME '14:30', TIME '16:30', 60, false),
  ('winter', 1, '早饭',     TIME '07:30', TIME '09:30', 60, true),
  ('winter', 2, '午饭',     TIME '11:30', TIME '14:00', 60, true),
  ('winter', 3, '下午休息', TIME '15:00', TIME '17:00', 60, false)
ON CONFLICT (season, slot_index) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- ④ staff_schedule —— 每周固定休息日
-- ════════════════════════════════════════════════════════════
-- weekday 用 Postgres 的 extract(dow)：0=周日 … 6=周六
--
-- 老板 10-11 定稿：
--   小洁  休周六            6 天/周
--   佳慧  休周日 + 周一      5 天/周
-- 为什么佳慧是周日+周一（原本是周四+周日）：
--   按建单量排，单人值班日占的建单从 40% 降到 31% ——
--   两个人同时在岗的日子，正好盖住建单最多的那几天。

CREATE TABLE IF NOT EXISTS staff_schedule (
  staff_id   text    NOT NULL,
  weekday    integer NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  is_working boolean NOT NULL DEFAULT true,
  note       text,
  PRIMARY KEY (staff_id, weekday)
);

COMMENT ON COLUMN staff_schedule.weekday IS '0=周日 1=周一 … 6=周六，和 Postgres extract(dow) 一致';

-- ⚠️ staff_id 用 staff 表的 "id" 列，不是 "username"：
--    迁喜小洁 id=xiaoxi / username=lvy
INSERT INTO staff_schedule (staff_id, weekday, is_working, note)
SELECT 'xiaoxi', d, d <> 6, CASE WHEN d = 6 THEN '休周六' END FROM generate_series(0,6) d
ON CONFLICT (staff_id, weekday) DO NOTHING;

INSERT INTO staff_schedule (staff_id, weekday, is_working, note)
SELECT 'annie', d, d NOT IN (0,1), CASE WHEN d IN (0,1) THEN '休周日+周一' END FROM generate_series(0,6) d
ON CONFLICT (staff_id, weekday) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- ⑤ 读取 RPC —— 一次把四张配置全取回来
-- ════════════════════════════════════════════════════════════
-- 照 list_staff() 的约定走 SECURITY DEFINER。
-- 四张表一个往返，省得前端发四次请求。

CREATE OR REPLACE FUNCTION public.list_config()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'channelAccounts', (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.sort_order), '[]'::jsonb) FROM channel_account c),
    'shiftConfigs',    (SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM shift_config s),
    'breakWindows',    (SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.season, b.slot_index), '[]'::jsonb) FROM break_window b),
    'staffSchedules',  (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.staff_id, t.weekday), '[]'::jsonb) FROM staff_schedule t)
  )
$$;

GRANT EXECUTE ON FUNCTION public.list_config() TO anon, authenticated;
