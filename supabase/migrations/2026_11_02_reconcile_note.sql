-- ════════════════════════════════════════════════════════════
-- 45 · 每日对账加「核对备注」
-- 2026-11-02 老板定
-- ════════════════════════════════════════════════════════════
--
-- 老板原话：
--   「我觉得这个每日对账，每个订单里都应该可以看到师傅的备注，
--     也要可以自己备注」
--
-- 两件事：
--   ① 看到师傅的备注 —— workerNote 列早就有（师傅在交单页写的），
--      对账界面里一个字都没显示。纯前端，不需要 SQL。
--   ② 自己能备注 —— 这个要新列。
--
-- 为什么不复用 order_reconciled.note：
--   那张表的 unmark_reconciled 是 DELETE 整行。
--   取消勾选 = 备注连同一起没了。而备注恰恰是最该留住的那一条
--   （「师傅微信确认 6 小时属实」），比勾没勾重要得多。
--
-- 为什么走 reconcile_order 而不是直接写表：
--   备注会进 reconcile_log —— 谁写的、什么时候、从什么改成什么，全留痕。
--   顺带解决老板 11-01 碰到的那个：没改数字时「保存」按钮一直是灰的，
--   现在写备注本身就算一项改动，按钮就亮了。
--
-- ⚠️ 函数体从 44-优惠上限20刀.sql 原样抄来，只在 allowed 数组末尾
--    加了 'reconcileNote'。参数名和顺序一个字没动。

ALTER TABLE orders ADD COLUMN IF NOT EXISTS "reconcileNote" text;

COMMENT ON COLUMN orders."reconcileNote" IS
  '核对备注 —— 对账的人自己写的。和师傅写的 workerNote 分开两栏，
   谁说的话算谁的，不能混在一起';

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
    'deposit','gst','discountAmount','otherFee','otherFeeNote',
    'finalAmount','paymentMethod','paymentStatus','workerNote','reconcileNote'
  ];
  k text; v text; old_v text; col_type text; same boolean; o jsonb; n_changed integer := 0;
  v_role text; v_disc_new numeric; v_disc_old numeric;
BEGIN
  SELECT to_jsonb(t) INTO o FROM orders t WHERE t.id = p_order_id;
  IF o IS NULL THEN RAISE EXCEPTION '订单不存在：%', p_order_id; END IF;

  FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
    IF NOT (k = ANY(allowed)) THEN
      RAISE EXCEPTION '字段 "%" 不允许通过对账修改。可改的只有时间和费用，不含状态/订单号/客户信息/派单信息', k;
    END IF;
  END LOOP;

  -- ── 优惠上限（2026-10-31 老板定）────────────────────────
  -- 老板：「师傅和客服不需要那么大的优惠权利，超过 20 刀需要我批准更好」
  -- 师傅端只有 $10/$20 两个按钮，天然超不过；能填任意数的是对账和订单详情。
  -- ⚠️ 只在【改大】时拦。历史上已经存着 $50 的单，经理照样要能对账 ——
  --    拦住一个她根本没动过的旧值，等于把那天的账锁死。
  IF jsonb_exists(p_changes, 'discountAmount') THEN
    SELECT role INTO v_role FROM staff WHERE id = p_changed_by;
    v_disc_new := coalesce(nullif(p_changes ->> 'discountAmount','')::numeric, 0);
    v_disc_old := coalesce(nullif(o ->> 'discountAmount','')::numeric, 0);
    IF coalesce(v_role,'') <> 'admin' AND v_disc_new > 20 AND v_disc_new > v_disc_old THEN
      RAISE EXCEPTION '优惠 $% 超过 $20，要老板批准。$10 / $20 可以直接填，更多的先打电话说明缘由。',
        v_disc_new;
    END IF;
  END IF;

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


-- ── 自检 ────────────────────────────────────────────────
SELECT 'reconcileNote 列建好了' AS 检查项,
       CASE WHEN count(*) = 1 THEN '对' ELSE '错' END AS 结果
  FROM information_schema.columns
 WHERE table_name = 'orders' AND column_name = 'reconcileNote'
UNION ALL
SELECT '只有一个 reconcile_order（没建出重载）',
       CASE WHEN count(*) = 1 THEN '对' ELSE '错 —— 有 ' || count(*) || ' 个' END
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'reconcile_order'
UNION ALL
SELECT '白名单含 reconcileNote',
       CASE WHEN bool_or(pg_get_functiondef(p.oid) LIKE '%reconcileNote%') THEN '对' ELSE '错' END
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'reconcile_order'
UNION ALL
SELECT '优惠上限还在（44 没被抄丢）',
       CASE WHEN bool_or(pg_get_functiondef(p.oid) LIKE '%超过 $20，要老板批准%') THEN '对' ELSE '错' END
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'reconcile_order'
UNION ALL
SELECT '其他费用白名单还在（42 没被抄丢）',
       CASE WHEN bool_or(pg_get_functiondef(p.oid) LIKE '%otherFeeNote%') THEN '对' ELSE '错' END
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'reconcile_order';
