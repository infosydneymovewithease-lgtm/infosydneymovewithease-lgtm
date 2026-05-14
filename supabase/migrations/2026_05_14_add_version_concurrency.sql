-- M8: 并发编辑版本保护
-- Why: 师傅在 FormPage 填账单时，客服后台同时改了订单 → 后写入的覆盖前写入的
-- How: 加 version 列 + 自动 +1 trigger，前端写时带 .eq('version', expected) 做乐观锁

-- ── 1. orders 表 ─────────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS version int DEFAULT 0;

-- 已有数据：version 都设为 0 起点
UPDATE orders SET version = 0 WHERE version IS NULL;

-- ── 2. storage_orders 表 ────────────────────────────────────
ALTER TABLE storage_orders ADD COLUMN IF NOT EXISTS version int DEFAULT 0;
UPDATE storage_orders SET version = 0 WHERE version IS NULL;

-- ── 3. 通用 version+1 trigger 函数 ──────────────────────────
CREATE OR REPLACE FUNCTION public.bump_version()
RETURNS trigger AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 4. 绑定 trigger 到两张表 ─────────────────────────────────
DROP TRIGGER IF EXISTS orders_bump_version ON orders;
CREATE TRIGGER orders_bump_version
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_version();

DROP TRIGGER IF EXISTS storage_orders_bump_version ON storage_orders;
CREATE TRIGGER storage_orders_bump_version
  BEFORE UPDATE ON storage_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_version();

-- ── 验证 ─────────────────────────────────────────────────────
-- 跑完后这两个查询应该看到 version 列存在且默认 0：
-- SELECT id, version FROM orders LIMIT 3;
-- SELECT id, version FROM storage_orders LIMIT 3;

-- ── 回滚（万一出问题用）─────────────────────────────────────
-- DROP TRIGGER IF EXISTS orders_bump_version ON orders;
-- DROP TRIGGER IF EXISTS storage_orders_bump_version ON storage_orders;
-- DROP FUNCTION IF EXISTS public.bump_version();
-- ALTER TABLE orders DROP COLUMN version;
-- ALTER TABLE storage_orders DROP COLUMN version;
