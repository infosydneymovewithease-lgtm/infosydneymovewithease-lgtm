-- 2026-10-12 · 四板块升级 第 6 步：周月汇总复盘
--
-- 核心原则：全自动，不让员工重抄。
-- 六块内容里只有「下阶段调整」是人工写的，其余全从已有数据算出来。
-- 所以这一步【只建一张表】—— 存那一栏人工文字。
--
-- 其余全是前端聚合（utils/summary.js），不建视图也不建函数：
--   订单/营收/客单价  ← orders
--   客服工作情况      ← daily_work_log + platform_inquiry + content_post + break_record
--   遗漏与问题        ← daily_close + reconcile_log + staff_rate
-- 聚合放前端的理由：这些数每次打开都要按不同时间窗口重算，
-- 做成数据库视图反而要为每个窗口写一套，改口径时两边都得改。

CREATE TABLE IF NOT EXISTS summary_note (
  period      text PRIMARY KEY,     -- '2026-10' 月 / '2026-W42' 周
  content     text,
  updated_by  text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE summary_note IS '周月汇总里「下阶段调整」那一栏 —— 整份报告唯一需要人工写的地方';
