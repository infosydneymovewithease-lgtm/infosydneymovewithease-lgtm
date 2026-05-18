-- 5/18: 把现有 ruby/michelle 那 2 条订单标记为 B2B 企业月结单
-- 这两条单的客户是 KO 地产中介的 Ruby（合作客户），但创建时还没有 B2B 联动功能
-- 跑完这条之后这 2 条单：
--   - 不再出现在工作台「待确认 / 定金未收」待办里
--   - 订单卡片显示绿色"🏢 KO地产中介"chip
--   - 在订单详情里显示企业月结标签

-- ⚠️ 注意：b2bCompanyId 需要替换为真实 ID
-- 你可以在浏览器后台打开「企业客户」→ 点 KO 地产中介 → 看 URL，例如
-- https://qianxibanjia.com.au/admin/b2b/B2B-0002 → 那 B2B-0002 就是 ID
-- 如果不确定 ID，先把下面这条注释掉，让 b2bCompanyId 为 NULL 也不影响展示。

UPDATE orders
SET
  "isB2BOrder"     = true,
  "b2bCompanyName" = 'KO地产中介',
  "b2bCompanyId"   = 'B2B-0002',          -- ← 替换成真实 ID（不确定就设 NULL）
  "depositPaid"    = true,
  "depositStatus"  = '企业月结',
  "deposit"        = 0,
  status           = '未派单'
WHERE id IN ('ORD-20260517-OS4F', 'ORD-20260517-3R0Y');
