-- 2026-07-13 多师傅并发状态同步
-- 新增 workStartedBy：记录"是哪位师傅第一个按了开始"，用于并发提示（如"已由老王开始/完成"）。
-- 并发闸门本身不靠这列，靠条件原子写（Start: WHERE "workStartedAt" IS NULL；
-- Submit: WHERE status 不在 已完成/已取消）。这列只是让提示更友好，可空。
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "workStartedBy" text;
