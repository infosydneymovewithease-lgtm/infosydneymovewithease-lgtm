-- 2026-07-13 实际工作时间
-- 客服可为订单设定"跟客户约定的具体到场/开工时间"（如时段 08:00–10:00，客户要 9:00 到）。
-- 与 startTime（时段标签，兼运力分桶键，不动）、workStartedAt（师傅实际按开始计时那一刻）都不同。
-- actualStartTime 必填才有意义，actualEndTime 可空。存 HH:MM 文本。
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "actualStartTime" text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "actualEndTime" text;
