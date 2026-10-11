-- 2026-10-12 · 每日对账补强：「已核对」必须是人勾的
--
-- 老板 10-11 提醒了这一页存在的理由：
--   「她需要在微信内于每一个师傅核对好后，再和系统那的财务日结一一核对」
--
-- 第一版做错的地方：把「系统检测不出异常」当成「已核对」。
-- 这两件事完全不同 ——
--   系统能查的只有「字段齐不齐、数字离不离谱」，
--   它不可能知道佳慧有没有在微信里问过晨曦这单到底几点收的工。
-- 照原来的逻辑，一单都没对也能把当天确认掉。
--
-- 所以「核对」这个动作必须自己留痕，不能靠推断。

CREATE TABLE IF NOT EXISTS order_reconciled (
  order_id   text PRIMARY KEY,
  work_date  date        NOT NULL,
  checked_by text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  note       text
);

CREATE INDEX IF NOT EXISTS order_reconciled_date_idx ON order_reconciled (work_date);

COMMENT ON TABLE order_reconciled IS '谁在什么时候核对了哪一单。和 reconcile_log 分开：那张记「改了什么」，这张记「对过了」——一单可能对过但什么都不用改。';

CREATE OR REPLACE FUNCTION public.mark_reconciled(
  p_order_id text, p_work_date date, p_by text, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO order_reconciled (order_id, work_date, checked_by, checked_at, note)
  VALUES (p_order_id, p_work_date, p_by, now(), p_note)
  ON CONFLICT (order_id) DO UPDATE
    SET checked_by = p_by, checked_at = now(), note = COALESCE(EXCLUDED.note, order_reconciled.note)
  RETURNING to_jsonb(order_reconciled);
$$;

-- 取消勾选：删记录。这里可以删 —— 「我其实没对过」不是需要留痕的历史，
-- 和 reconcile_log 的「改了又撤」不一样，那个要留。
CREATE OR REPLACE FUNCTION public.unmark_reconciled(p_order_id text)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM order_reconciled WHERE order_id = p_order_id
  RETURNING jsonb_build_object('ok', true, 'order_id', order_id);
$$;

GRANT EXECUTE ON FUNCTION public.mark_reconciled(text, date, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unmark_reconciled(text)                 TO anon, authenticated;

-- get_reconcile 多返回一份「已核对」清单
CREATE OR REPLACE FUNCTION public.get_reconcile(p_work_date date)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'close',   (SELECT to_jsonb(d) FROM daily_close d WHERE d.work_date = p_work_date),
    'logs',    (SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.changed_at DESC), '[]'::jsonb)
                  FROM reconcile_log l WHERE l.work_date = p_work_date),
    'checked', (SELECT coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
                  FROM order_reconciled c WHERE c.work_date = p_work_date)
  )
$$;

-- 补录会让「已核对」失效 —— 改过的单要重新对一遍
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
    -- 补录【即】核对 —— 老板 10-11：
    --   「要减少劳动力简单高效，否则在订单里的修改不就好了」
    -- 佳慧和师傅对完发现系统记错才会来改这一笔，改这个动作本身就是核对。
    -- 改完再逼她勾一次「已核对」= 凭空多一步，这一页就不比订单详情页快了。
    -- （注意：客服从订单详情页改账单走的是 updateOrder，不经过这里，
    --   那种情况不会被当成已核对。）
    INSERT INTO order_reconciled (order_id, work_date, checked_by, checked_at, note)
    VALUES (p_order_id, p_work_date, p_changed_by, now(), '补录时自动核对')
    ON CONFLICT (order_id) DO UPDATE
      SET checked_by = p_changed_by, checked_at = now();

    UPDATE daily_close SET status = 'pending', confirmed_by = NULL, confirmed_at = NULL
     WHERE work_date = p_work_date AND status = 'confirmed';
  END IF;

  SELECT to_jsonb(t) INTO o FROM orders t WHERE t.id = p_order_id;
  RETURN jsonb_build_object('changed', n_changed, 'order', o);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_order(text, date, jsonb, text, text) TO anon, authenticated;


-- ════════════════════════════════════════════════════════════
-- 批量核对 —— 一天的单都正常时，不该点五次
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.mark_all_reconciled(p_work_date date, p_by text)
RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  WITH ins AS (
    INSERT INTO order_reconciled (order_id, work_date, checked_by, checked_at, note)
    SELECT o.id, p_work_date, p_by, now(), '批量核对'
      FROM orders o
     WHERE o.date = p_work_date::text AND o.status = '已完成'
    ON CONFLICT (order_id) DO NOTHING
    RETURNING 1
  ) SELECT count(*)::integer FROM ins;
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_reconciled(date, text) TO anon, authenticated;
