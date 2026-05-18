-- 5/18: B2B 企业客户联动
-- 给 orders 和 storage_orders 加 3 个字段：
--   isB2BOrder       boolean，标记企业月结单（跳过定金、不出现在工作台待办）
--   b2bCompanyId     text，关联 b2bCustomers 表
--   b2bCompanyName   text，冗余存公司名方便订单卡片显示

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS "isB2BOrder"     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "b2bCompanyId"   text,
  ADD COLUMN IF NOT EXISTS "b2bCompanyName" text;

ALTER TABLE storage_orders
  ADD COLUMN IF NOT EXISTS "isB2BOrder"     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "b2bCompanyId"   text,
  ADD COLUMN IF NOT EXISTS "b2bCompanyName" text;
