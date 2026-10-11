-- 2026-10-12 · reconcile_order 数值字段按数值比较
--
-- 老板实测发现：存完之后 reconcile_log 里多出一条 `gst: 0 → 0.00`。
-- 值根本没变，只是前端把自动算的值格式化成了两位小数。
-- 原来用 `old_v IS NOT DISTINCT FROM v` 比的是 text，'0' ≠ '0.00' → 记了一条废日志。
--
-- 每存一次就多一条，以后查「这单金额怎么变的」会被噪音淹掉 ——
-- 而 reconcile_log 存在的全部意义就是出争议时查得清。
--
-- 前端已经改成数值比较不再发这种值了，这里是第二道防线：
-- 就算别的客户端送了格式不同的同值，数据库也不记。

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
    'deposit','gst',
    'finalAmount','paymentMethod','paymentStatus','workerNote'
  ];
  k text; v text; old_v text; col_type text; same boolean; o jsonb; n_changed integer := 0;
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

    SELECT atttypid::regtype::text INTO col_type FROM pg_attribute
     WHERE attrelid = 'orders'::regclass AND attname = k AND attnum > 0 AND NOT attisdropped;
    IF col_type IS NULL THEN RAISE EXCEPTION '字段 "%" 在 orders 表里不存在', k; END IF;

    -- 数值列按数值比：'0' 和 '0.00' 是同一个值，不该记成改动
    IF col_type IN ('numeric','integer','bigint','smallint','double precision','real') THEN
      same := (old_v IS NULL AND v IS NULL)
           OR (old_v IS NOT NULL AND v IS NOT NULL AND abs(old_v::numeric - v::numeric) < 0.005);
    ELSE
      same := old_v IS NOT DISTINCT FROM v;
    END IF;
    CONTINUE WHEN same;

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

-- 清掉刚才那条废记录（新旧值其实一样）
DELETE FROM reconcile_log
 WHERE old_value IS NOT NULL AND new_value IS NOT NULL
   AND old_value ~ '^-?[0-9]+(\.[0-9]+)?$' AND new_value ~ '^-?[0-9]+(\.[0-9]+)?$'
   AND abs(old_value::numeric - new_value::numeric) < 0.005;
