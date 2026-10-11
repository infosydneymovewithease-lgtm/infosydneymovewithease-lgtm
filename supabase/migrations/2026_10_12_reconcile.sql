-- 2026-10-12 · 四板块升级 第 4 步：每日对账
-- ⚠️ 全场最高风险的一步 —— 唯一会修改现有 orders 数据的功能
--
-- Annie 的真实工作流（老板 10-11 描述）：
--   师傅干完活 → 微信里报给 Annie → Annie 打开对账页逐单对
--   → 对不上当场补 → 全部对完确认当日收入
--
-- 数据证明这个环节必要（9/1 以来 65 张已完成订单）：
--   实际开始时间 缺 22%   实际结束时间 缺 55%   计费工时 缺 0%
--   → 工时是人填的，不是测出来的。微信核对是目前唯一的真实性保障，
--     但完全在系统外，核对结果也不回写。
--
-- 安全设计的核心思路：
--   【不靠前端自觉】把白名单和留痕写进数据库函数。
--   前端有 bug、有人直接调 API、以后换个客户端 —— 规则都还在。

-- ════════════════════════════════════════════════════════════
-- ① daily_close —— 日结状态
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS daily_close (
  work_date    date PRIMARY KEY,
  status       text NOT NULL DEFAULT 'pending',   -- pending / confirmed
  confirmed_by text,
  confirmed_at timestamptz,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE daily_close IS '当日对账状态。确认后如果又有补录，自动退回 pending';


-- ════════════════════════════════════════════════════════════
-- ② reconcile_log —— 补录留痕（整个功能的安全底座）
-- ════════════════════════════════════════════════════════════
-- 为什么必须有：补录直接改订单金额和工时，进而改工资。
-- 没有留痕，以后出争议（师傅说工资少了、客户说多收了）完全查不清。
--
-- undone_at 不为空 = 这条补录已被撤销，订单已还原成 old_value。
-- 不删记录 —— 「改了又撤」本身就是要留的信息。

CREATE TABLE IF NOT EXISTS reconcile_log (
  id         bigserial PRIMARY KEY,
  work_date  date    NOT NULL,
  order_id   text    NOT NULL,
  order_no   text,
  field      text    NOT NULL,
  old_value  text,
  new_value  text,
  reason     text,
  changed_by text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  undone_at  timestamptz,
  undone_by  text
);

CREATE INDEX IF NOT EXISTS reconcile_log_date_idx  ON reconcile_log (work_date DESC);
CREATE INDEX IF NOT EXISTS reconcile_log_order_idx ON reconcile_log (order_id, changed_at DESC);


-- ════════════════════════════════════════════════════════════
-- ③ reconcile_order() —— 唯一允许的补录通道
-- ════════════════════════════════════════════════════════════
-- 防护四件事：
--   1. 白名单 —— 只有钱和时间能改。status / orderNo / 客户信息 /
--      派单信息【写死在函数里不可改】，前端传了也会被拒绝并报错
--   2. 同事务 —— 先写 reconcile_log 再 UPDATE orders，一起成功或一起失败
--   3. 幂等记录 —— 每个字段一行日志，撤销时能单条还原
--   4. 退回待确认 —— 已确认的日子被补录，自动退回 pending，不能偷偷改完就算

CREATE OR REPLACE FUNCTION public.reconcile_order(
  p_order_id   text,
  p_work_date  date,
  p_changes    jsonb,
  p_reason     text,
  p_changed_by text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- ⚠️ 这张白名单就是整个功能的边界。往里加字段前先想清楚：
  --    这个字段改了会影响谁的钱？能不能撤销？
  allowed   text[] := ARRAY[
    'workStartedAt','workEndedAt','billedHours',
    'timeFee','returnFee','stairFee','overtimeFee','heavyFee',
    'highwayFee','parkingFee','suppliesFee','fuelFee',
    'finalAmount','paymentMethod','paymentStatus','workerNote'
  ];
  k         text;
  v         text;
  old_v     text;
  col_type  text;
  o         jsonb;
  n_changed integer := 0;
BEGIN
  SELECT to_jsonb(t) INTO o FROM orders t WHERE t.id = p_order_id;
  IF o IS NULL THEN
    RAISE EXCEPTION '订单不存在：%', p_order_id;
  END IF;

  -- 先全量校验再动手 —— 不允许「改了一半才发现有非法字段」
  FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
    IF NOT (k = ANY(allowed)) THEN
      RAISE EXCEPTION '字段 "%" 不允许通过对账修改。可改的只有时间和费用，不含状态/订单号/客户信息/派单信息', k;
    END IF;
  END LOOP;

  FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
    v     := nullif(p_changes ->> k, '');   -- 前端清空输入框会送来 ''，当成 NULL
    old_v := o ->> k;
    CONTINUE WHEN old_v IS NOT DISTINCT FROM v;   -- 没变就不记也不改

    -- ⚠️ 必须按列的真实类型转换。
    --    EXECUTE 'SET "billedHours" = $1' USING <text> 会直接报
    --    「column is of type numeric but expression is of type text」。
    --    从 pg_attribute 查真实类型，顺带也挡住了白名单里写错的字段名。
    SELECT atttypid::regtype::text INTO col_type
      FROM pg_attribute
     WHERE attrelid = 'orders'::regclass AND attname = k
       AND attnum > 0 AND NOT attisdropped;
    IF col_type IS NULL THEN
      RAISE EXCEPTION '字段 "%" 在 orders 表里不存在', k;
    END IF;

    INSERT INTO reconcile_log (work_date, order_id, order_no, field, old_value, new_value, reason, changed_by)
    VALUES (p_work_date, p_order_id, o ->> 'orderNo', k, old_v, v, p_reason, p_changed_by);

    EXECUTE format('UPDATE orders SET %I = $1::%s WHERE id = $2', k, col_type)
      USING v, p_order_id;
    n_changed := n_changed + 1;
  END LOOP;

  -- 已确认的日子被改 → 退回待确认，逼人重新看一遍
  IF n_changed > 0 THEN
    UPDATE daily_close
       SET status = 'pending', confirmed_by = NULL, confirmed_at = NULL
     WHERE work_date = p_work_date AND status = 'confirmed';
  END IF;

  SELECT to_jsonb(t) INTO o FROM orders t WHERE t.id = p_order_id;
  RETURN jsonb_build_object('changed', n_changed, 'order', o);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_order(text, date, jsonb, text, text) TO anon, authenticated;


-- ════════════════════════════════════════════════════════════
-- ④ undo_reconcile() —— 单条撤销
-- ════════════════════════════════════════════════════════════
-- 把那一个字段还原成 old_value，并在日志上盖「已撤销」的戳。
-- 日志行不删 —— 「改了又撤」本身就是要留的信息。

CREATE OR REPLACE FUNCTION public.undo_reconcile(p_log_id bigint, p_undone_by text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r        reconcile_log%ROWTYPE;
  col_type text;
BEGIN
  SELECT * INTO r FROM reconcile_log WHERE id = p_log_id;
  IF r IS NULL               THEN RAISE EXCEPTION '补录记录不存在：%', p_log_id; END IF;
  IF r.undone_at IS NOT NULL THEN RAISE EXCEPTION '这条补录已经撤销过了'; END IF;

  SELECT atttypid::regtype::text INTO col_type
    FROM pg_attribute
   WHERE attrelid = 'orders'::regclass AND attname = r.field
     AND attnum > 0 AND NOT attisdropped;

  -- 同样要按真实类型还原，否则撤销会在 numeric 列上报类型错
  EXECUTE format('UPDATE orders SET %I = $1::%s WHERE id = $2', r.field, col_type)
    USING r.old_value, r.order_id;

  UPDATE reconcile_log SET undone_at = now(), undone_by = p_undone_by WHERE id = p_log_id;

  UPDATE daily_close
     SET status = 'pending', confirmed_by = NULL, confirmed_at = NULL
   WHERE work_date = r.work_date AND status = 'confirmed';

  RETURN jsonb_build_object('ok', true, 'order_id', r.order_id,
                            'field', r.field, 'restored', r.old_value);
END;
$$;

GRANT EXECUTE ON FUNCTION public.undo_reconcile(bigint, text) TO anon, authenticated;


-- ════════════════════════════════════════════════════════════
-- ⑤ 确认 / 取消确认当日
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.close_day(p_work_date date, p_by text, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO daily_close (work_date, status, confirmed_by, confirmed_at, note)
  VALUES (p_work_date, 'confirmed', p_by, now(), p_note)
  ON CONFLICT (work_date) DO UPDATE
    SET status = 'confirmed', confirmed_by = p_by, confirmed_at = now(),
        note = COALESCE(EXCLUDED.note, daily_close.note)
  RETURNING to_jsonb(daily_close);
$$;

CREATE OR REPLACE FUNCTION public.reopen_day(p_work_date date)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE daily_close
     SET status = 'pending', confirmed_by = NULL, confirmed_at = NULL
   WHERE work_date = p_work_date
  RETURNING to_jsonb(daily_close);
$$;

GRANT EXECUTE ON FUNCTION public.close_day(date, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_day(date)            TO anon, authenticated;


-- ════════════════════════════════════════════════════════════
-- ⑥ 读取：某天的日结状态 + 补录历史
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_reconcile(p_work_date date)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'close', (SELECT to_jsonb(d) FROM daily_close d WHERE d.work_date = p_work_date),
    'logs',  (SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.changed_at DESC), '[]'::jsonb)
                FROM reconcile_log l WHERE l.work_date = p_work_date)
  )
$$;

GRANT EXECUTE ON FUNCTION public.get_reconcile(date) TO anon, authenticated;
