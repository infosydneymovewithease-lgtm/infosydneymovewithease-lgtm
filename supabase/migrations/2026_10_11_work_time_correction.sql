-- 2026-10-11 · 四板块升级 第 2.5 步下半部分
-- 师傅补填「实际收工时间」的留痕字段
--
-- 背景：
--   师傅忘记点「结束」→ workEndedAt 一路往后跑 → 工时和加班费一起失控。
--   计算封顶（pricing.js OVERTIME_HOURS_CAP）只是不让错数进账单，
--   真正把时间修对还得靠人 —— 只有师傅知道实际几点收的工。
--
-- 老板原话：
--   「不可以开始下一单，需要上一单结束，师傅点上一单结束的时候
--     让他们填写原因和实际工作时间」
--
-- 为什么要留痕而不是直接盖掉 workEndedAt：
--   补填的时间是师傅回忆出来的，不是测量出来的。
--   对账时必须能看出「这个收工时间是补的，不是打卡打出来的」，
--   否则下个月再看这单，没人知道该不该信这个数。

ALTER TABLE orders ADD COLUMN IF NOT EXISTS "endFixReason"   text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "endFixNote"     text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "endFixBy"       text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "endFixAt"       timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "endFixHoursLate" numeric;

COMMENT ON COLUMN orders."endFixReason"    IS 'forgot/battery/signal/other —— 固定选项，用来判断是人的问题还是 App 的问题';
COMMENT ON COLUMN orders."endFixBy"        IS '哪个师傅补的。多人单谁先补谁说了算，其余人看到结果直接过';
COMMENT ON COLUMN orders."endFixHoursLate" IS '补填时已经挂了多少小时 —— 越大说明发现得越晚，是衡量提醒有没有生效的指标';

-- 对账页要按「补过时间的单」筛，加个索引
CREATE INDEX IF NOT EXISTS orders_end_fix_idx ON orders ("endFixAt" DESC) WHERE "endFixAt" IS NOT NULL;
