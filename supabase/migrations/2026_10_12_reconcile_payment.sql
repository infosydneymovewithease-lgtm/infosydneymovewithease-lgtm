-- 2026-10-12 · 对账页补上「收款方式」和「定金」
--
-- 老板 10-11：「这里还是缺点东西，如现金还是转账，转账有 GST 的你知道，
--               另外是否有定金」
--
-- 两个都直接决定实收金额，之前漏了：
--   收款方式  转账要加 10% GST，现金不加
--   定金      实收 = 费用合计 + GST − 定金
--
-- 实测 286 张已完成订单：
--   GST   11 张转账单全部 = 费用 × 10%，零例外 —— 规则确定
--   定金  203 单扣了 / 32 单没扣 / 28 单定金为 0 —— 那 32 单是错的，
--         正好是对账该揪出来的

CREATE OR REPLACE FUNCTION public.reconcile_order(
  p_order_id text, p_work_date date, p_changes jsonb, p_reason text, p_changed_by text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  allowed   text[] := ARRAY[
    'workStartedAt','workEndedAt','billedHours',
    'timeFee','returnFee','stairFee','overtimeFee','heavyFee',
    'highwayFee','parkingFee','suppliesFee','fuelFee',
    -- 2026-10-12 加：这两个直接决定实收金额
    'deposit','gst',
    'finalAmount','paymentMethod','paymentStatus','workerNote'
  ];
  k text; v text; old_v text; col_type text; o jsonb; n_changed integer := 0;
BEGIN
  SELECT to_jsonb(t) INTO o FROM orders t WHERE t.id = p_order_id;
  IF o IS NULL THEN RAISE EXCEPTION '订单不存在：%', p_order_id; END IF;

  FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
    IF NOT (k = ANY(allowed)) THEN
      RAISE EXCEPTION '字段 "%" 不允许通过对账修改。可改的只有时间和费用，不含状态/订单号/客户信息/派单信息', k;
    END IF;
  END LOOP;

  FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
    v := nullif(p_changes ->> k, '');
    old_v := o ->> k;
    CONTINUE WHEN old_v IS NOT DISTINCT FROM v;

    SELECT atttypid::regtype::text INTO col_type FROM pg_attribute
     WHERE attrelid = 'orders'::regclass AND attname = k AND attnum > 0 AND NOT attisdropped;
    IF col_type IS NULL THEN RAISE EXCEPTION '字段 "%" 在 orders 表里不存在', k; END IF;

    INSERT INTO reconcile_log (work_date, order_id, order_no, field, old_value, new_value, reason, changed_by)
    VALUES (p_work_date, p_order_id, o ->> 'orderNo', k, old_v, v, p_reason, p_changed_by);

    EXECUTE format('UPDATE orders SET %I = $1::%s WHERE id = $2', k, col_type) USING v, p_order_id;
    n_changed := n_changed + 1;
  END LOOP;

  IF n_changed > 0 THEN
    INSERT INTO order_reconciled (order_id, work_date, checked_by, checked_at, note)
    VALUES (p_order_id, p_work_date, p_changed_by, now(), '补录时自动核对')
    ON CONFLICT (order_id) DO UPDATE SET checked_by = p_changed_by, checked_at = now();

    UPDATE daily_close SET status = 'pending', confirmed_by = NULL, confirmed_at = NULL
     WHERE work_date = p_work_date AND status = 'confirmed';
  END IF;

  SELECT to_jsonb(t) INTO o FROM orders t WHERE t.id = p_order_id;
  RETURN jsonb_build_object('changed', n_changed, 'order', o);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_order(text, date, jsonb, text, text) TO anon, authenticated;
