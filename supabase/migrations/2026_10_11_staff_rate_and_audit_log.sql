-- 2026-10-11 · 四板块升级 第 2 步
-- ① 工资费率入库（带生效日期）  ② 操作日志 audit_log
--
-- 方案见桌面「迁喜系统升级-设计方案-v2-20261010」
--
-- 背景：
--   费率原本硬编码在 src/pages/admin/WageRecords.jsx:7-20 的 WORKERS 常量里。
--   两个后果：
--     1. 名单里漏了老周（laozhou）—— 他干了 95 单 / 278.5 小时，
--        而且工资页是遍历那个常量生成行的，所以他【从来没在工资结算页上出现过】
--     2. 每次招人、调价都要改代码重新部署
--
-- 为什么要带 effective_from：
--   小宇 2026-08-01 起从 $30 涨到 $31。如果只存一个当前值，
--   改完之后打开 7 月的工资页，系统会拿 $31 去乘 7 月的工时 ——
--   历史工资被追溯改写，对账就没有意义了。
--
-- 安全说明：
--   本次沿用现有约定（三张业务表 RLS 关闭、敏感读取走 SECURITY DEFINER RPC）。
--   费率通过 list_staff_rates() 暴露，不直接开表。
--   audit_log 目前允许客户端写入，与现有安全姿态一致；
--   彻底收口留给「安全第二批 RLS」那个独立项目。

-- ════════════════════════════════════════════════════════════
-- ① staff_rate —— 工资费率（带生效日期）
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS staff_rate (
  staff_id       text        NOT NULL,
  effective_from date        NOT NULL,
  hourly_rate    numeric     NOT NULL,
  is_driver      boolean     NOT NULL DEFAULT false,
  driver_rates   jsonb,                 -- 司机按车型的加成，null = 用 hourly_rate
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, effective_from)
);

COMMENT ON TABLE  staff_rate IS '工资费率，按生效日期分段。算工资时取订单日期当时生效的那条。';
COMMENT ON COLUMN staff_rate.driver_rates IS '{"大卡车":40,"小卡车":37,...}；只有该人担任司机(assignedTo)时才适用';

-- ── 初始数据（2026-10-11 老板确认）──────────────────────────
-- 用 2020-01-01 作为"系统启用前"的兜底起点，保证任何历史订单都能匹配到一条

INSERT INTO staff_rate (staff_id, effective_from, hourly_rate, is_driver, driver_rates, note) VALUES
  ('laomou',    DATE '2020-01-01', 33, false, NULL, '老木 · 迁移自代码常量'),
  ('xiaoyu',    DATE '2020-01-01', 30, false, NULL, '小宇 · 迁移自代码常量'),
  ('xiaoyu',    DATE '2026-08-01', 31, false, NULL, '小宇 · 老板 10-11 确认 8/1 起涨 1 刀'),
  ('laozhou',   DATE '2020-01-01', 32, false, NULL, '老周 · 原代码名单遗漏，老板 10-11 确认 $32、不开车'),
  ('chenxi',    DATE '2020-01-01', 33, true,
     '{"大卡车":40,"大卡三人":40,"小卡车":37,"小卡三人":37,"卡车单人":37,"面包车":34,"双卡车":37}'::jsonb,
     '晨曦 · 迁移自代码常量'),
  ('laowang',   DATE '2020-01-01', 33, true,
     '{"大卡车":40,"大卡三人":40,"小卡车":37,"小卡三人":37,"卡车单人":37,"面包车":34,"双卡车":37}'::jsonb,
     '老王 · 迁移自代码常量'),
  ('xiaozhang', DATE '2020-01-01', 33, true,
     '{"大卡车":40,"大卡三人":40,"小卡车":37,"小卡三人":37,"卡车单人":37,"面包车":34,"双卡车":37}'::jsonb,
     '小张 · 迁移自代码常量')
ON CONFLICT (staff_id, effective_from) DO NOTHING;

-- ── 读取 RPC ────────────────────────────────────────────────
-- 照 list_staff() 的约定走 SECURITY DEFINER。
-- ⚠️ 故意【不加】active 过滤 —— 停用的员工（如已回国的老周）
--    历史工资仍要能算、能显示姓名。

CREATE OR REPLACE FUNCTION public.list_staff_rates()
RETURNS TABLE (
  staff_id       text,
  name           text,
  effective_from date,
  hourly_rate    numeric,
  is_driver      boolean,
  driver_rates   jsonb,
  active         boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.staff_id, s.name, r.effective_from,
         r.hourly_rate, r.is_driver, r.driver_rates, s.active
  FROM staff_rate r
  JOIN staff s ON s.id = r.staff_id
  ORDER BY r.staff_id, r.effective_from
$$;

GRANT EXECUTE ON FUNCTION public.list_staff_rates() TO anon, authenticated;


-- ════════════════════════════════════════════════════════════
-- ② audit_log —— 操作日志
-- ════════════════════════════════════════════════════════════
-- 用途：
--   · 对账追溯 ——「这单金额怎么变的」一查就知道谁、什么时候、从多少改到多少
--   · 以后 AI 小秘书的「每人每天干了什么」直接用这张表
-- 现在就建的理由：历史操作记录补不回来，今天不记，以后永远没有今天的数据。

CREATE TABLE IF NOT EXISTS audit_log (
  id          bigserial   PRIMARY KEY,
  staff_id    text,
  action      text        NOT NULL,   -- login / create_order / update_order /
                                      -- dispatch / reconcile / submit_report / ...
  target_type text,                   -- order / daily_close / platform_inquiry / ...
  target_id   text,
  detail      jsonb,                  -- {field, old, new} 之类
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_staff_time_idx ON audit_log (staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_target_idx     ON audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS audit_log_time_idx       ON audit_log (created_at DESC);

COMMENT ON TABLE audit_log IS '操作日志。写入失败不应阻塞主流程（客户端 fire-and-forget）。';


-- ════════════════════════════════════════════════════════════
-- ③ 老周停用 —— 单独一条，确认后再跑
-- ════════════════════════════════════════════════════════════
-- 他已回国、归期未定，但 staff 里仍是启用，会出现在派单列表里可能误派。
-- list_staff() 有 WHERE active = true，停用后他从派单列表消失；
-- 而 list_staff_rates() 没有 active 过滤，历史工资照常能算能显示。
-- 回来时把 true 改回去即可，数据和历史工资全部保留。
--
UPDATE staff SET active = false WHERE id = 'laozhou';  -- 老板 10-11：先不起用他
