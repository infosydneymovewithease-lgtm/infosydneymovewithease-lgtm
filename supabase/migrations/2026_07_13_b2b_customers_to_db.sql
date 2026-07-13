-- 2026-07-13 企业客户迁库 + 结构化定价
-- 原本 b2bCustomers 只存在各客服浏览器 localStorage，多台电脑数据/价格可能不一致，
-- 拿来算钱危险。迁进数据库做单一数据源，并加结构化车型定价 pricing。
-- pricing 形如 {"小卡车":{"hourlyRate":100,"returnFee":110}, ...}，只存跟标准价不同的车型。
CREATE TABLE IF NOT EXISTS b2b_customers (
  id             text PRIMARY KEY,
  "companyName"  text NOT NULL,
  "contactName"  text,
  phone          text,
  wechat         text,
  address        text,
  abn            text,
  level          text DEFAULT 'B',
  "paymentMode"  text DEFAULT 'b2b_monthly',
  "monthlyOrders" integer DEFAULT 0,
  "specialPricing" text,                          -- 保留旧的自由文本备注
  pricing        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- 新：结构化车型协议价
  status         text DEFAULT '合作中',
  notes          text,
  "createdAt"    text,
  created_at     timestamptz DEFAULT now()
);

-- RLS 关闭（内部工具，跟 orders 一致），无需 policy。
-- 开 realtime，让两台电脑改客户/价格即时同步。
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_customers;
