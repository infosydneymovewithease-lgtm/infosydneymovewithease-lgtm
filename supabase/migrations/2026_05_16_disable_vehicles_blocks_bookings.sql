-- 2026-05-16: 修复"停用所有车后客户仍能下单"的 bug
--
-- 原 bug：get_slots_availability 和 create_order_with_slot_check 两个 RPC
-- 在 enabled 车辆为 0 时一律回落到硬编码兜底容量，本意是"vehicles 表为空
-- 时还能跑"，但同时也让"客服主动停用所有车"被误识别成"表为空"，导致：
--   - 客户端时段照常显示可预约
--   - create_order_with_slot_check 仍然放过订单
--
-- 修复思路：用 COUNT(*) 不带 enabled 过滤，再区分两种情况：
--   - v_total_count = 0  → 真·空表（首次部署）→ 用兜底
--   - v_total_count > 0  → 有车但全停用 → 容量保持 0 → 拒绝下单
--
-- 在 Supabase SQL Editor 跑一次即可（CREATE OR REPLACE，幂等）。

CREATE OR REPLACE FUNCTION get_slots_availability(
  p_vehicle_group text,
  p_date          text,
  p_slots         text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vehicle_type   text;
  v_vehicle_keys   text[];
  v_total_count    int;
  v_slot_capacity  int;
  v_daily_capacity int;
  v_daily_booked   int;
  v_slot           text;
  v_slot_booked    int;
  v_available      int;
  v_result         jsonb := '[]'::jsonb;
BEGIN
  IF p_vehicle_group = 'van' THEN
    v_vehicle_type := 'van';
    v_vehicle_keys := ARRAY['面包车'];
  ELSIF p_vehicle_group = 'small' THEN
    v_vehicle_type := 'small_truck';
    v_vehicle_keys := ARRAY['小卡车', '小卡三人'];
  ELSIF p_vehicle_group = 'large' THEN
    v_vehicle_type := 'big_truck';
    v_vehicle_keys := ARRAY['大卡车', '大卡三人', '双卡车'];
  ELSE
    RETURN '[]'::jsonb;
  END IF;

  SELECT COUNT(*) INTO v_total_count
    FROM vehicles WHERE vehicle_type = v_vehicle_type;

  SELECT COUNT(*) INTO v_slot_capacity
    FROM vehicles WHERE vehicle_type = v_vehicle_type AND enabled = true;

  SELECT COALESCE(SUM(max_orders_per_day), 0) INTO v_daily_capacity
    FROM vehicles WHERE vehicle_type = v_vehicle_type AND enabled = true;

  IF v_total_count = 0 THEN
    v_slot_capacity := CASE p_vehicle_group
      WHEN 'van'   THEN 1
      WHEN 'small' THEN 2
      WHEN 'large' THEN 1
      ELSE 1 END;
    v_daily_capacity := CASE p_vehicle_group
      WHEN 'van'   THEN 5
      WHEN 'small' THEN 6
      WHEN 'large' THEN 2
      ELSE 3 END;
  END IF;

  SELECT COUNT(*) INTO v_daily_booked
    FROM orders
   WHERE date    = p_date
     AND vehicle = ANY(v_vehicle_keys)
     AND status NOT IN ('已取消', '已完成', '已拒绝');

  FOREACH v_slot IN ARRAY p_slots LOOP
    SELECT COUNT(*) INTO v_slot_booked
      FROM orders
     WHERE date          = p_date
       AND "startTime"   = v_slot
       AND vehicle       = ANY(v_vehicle_keys)
       AND status NOT IN ('已取消', '已完成', '已拒绝');

    v_available := GREATEST(0,
      LEAST(
        v_slot_capacity  - v_slot_booked,
        v_daily_capacity - v_daily_booked
      )
    );

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'slot',           v_slot,
      'available',      v_available,
      'slot_capacity',  v_slot_capacity,
      'slot_booked',    v_slot_booked,
      'daily_capacity', v_daily_capacity,
      'daily_booked',   v_daily_booked
    ));
  END LOOP;

  RETURN v_result;
END;
$$;


CREATE OR REPLACE FUNCTION create_order_with_slot_check(
  p_order jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vehicle        text;
  v_vehicle_type   text;
  v_vehicle_keys   text[];
  v_date           text;
  v_slot           text;
  v_total_count    int;
  v_slot_capacity  int;
  v_daily_capacity int;
  v_slot_booked    int;
  v_daily_booked   int;
  v_new_id         text;
BEGIN
  v_vehicle := p_order->>'vehicle';
  v_date    := p_order->>'date';
  v_slot    := p_order->>'startTime';

  IF v_vehicle = ANY(ARRAY['面包车']) THEN
    v_vehicle_type := 'van';
    v_vehicle_keys := ARRAY['面包车'];
  ELSIF v_vehicle = ANY(ARRAY['小卡车', '小卡三人']) THEN
    v_vehicle_type := 'small_truck';
    v_vehicle_keys := ARRAY['小卡车', '小卡三人'];
  ELSIF v_vehicle = ANY(ARRAY['大卡车', '大卡三人', '双卡车']) THEN
    v_vehicle_type := 'big_truck';
    v_vehicle_keys := ARRAY['大卡车', '大卡三人', '双卡车'];
  ELSE
    RETURN jsonb_build_object('success', false, 'order_id', null, 'error', '未知车型');
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(v_vehicle_type || '::' || v_date)::bigint
  );

  SELECT COUNT(*) INTO v_total_count
    FROM vehicles WHERE vehicle_type = v_vehicle_type;

  SELECT COUNT(*) INTO v_slot_capacity
    FROM vehicles WHERE vehicle_type = v_vehicle_type AND enabled = true;

  SELECT COALESCE(SUM(max_orders_per_day), 0) INTO v_daily_capacity
    FROM vehicles WHERE vehicle_type = v_vehicle_type AND enabled = true;

  IF v_total_count = 0 THEN
    v_slot_capacity := CASE v_vehicle_type
      WHEN 'van'         THEN 1
      WHEN 'small_truck' THEN 2
      WHEN 'big_truck'   THEN 1
      ELSE 1 END;
    v_daily_capacity := CASE v_vehicle_type
      WHEN 'van'         THEN 5
      WHEN 'small_truck' THEN 6
      WHEN 'big_truck'   THEN 2
      ELSE 3 END;
  END IF;

  SELECT COUNT(*) INTO v_slot_booked
    FROM orders
   WHERE date          = v_date
     AND "startTime"   = v_slot
     AND vehicle       = ANY(v_vehicle_keys)
     AND status NOT IN ('已取消', '已完成', '已拒绝');

  SELECT COUNT(*) INTO v_daily_booked
    FROM orders
   WHERE date    = v_date
     AND vehicle = ANY(v_vehicle_keys)
     AND status NOT IN ('已取消', '已完成', '已拒绝');

  IF v_slot_booked >= v_slot_capacity THEN
    RETURN jsonb_build_object('success', false, 'order_id', null, 'error', 'slot_full');
  END IF;

  IF v_daily_booked >= v_daily_capacity THEN
    RETURN jsonb_build_object('success', false, 'order_id', null, 'error', 'day_full');
  END IF;

  v_new_id := 'ORD-'
    || to_char(now() AT TIME ZONE 'Australia/Sydney', 'YYYYMMDD')
    || '-'
    || upper(substring(md5(random()::text) from 1 for 4));

  INSERT INTO orders (
    id, "createdAt", status, "serviceType",
    "customerName", "customerPhone", wechat,
    date, "startTime", "fromAddress", "toAddress",
    vehicle, quote, "depositPaid", "depositStatus",
    "depositScreenshot", deposit, "distanceKm",
    "remoteSurcharge", "stairFee", "quoteNote",
    "requestedMaterials", items, notes, source,
    "assignedTo", "assignedWorkers", "createdBy", "createdByName"
  ) VALUES (
    v_new_id,
    COALESCE(p_order->>'createdAt', now()::text),
    COALESCE(p_order->>'status', '待确认'),
    p_order->>'serviceType',
    p_order->>'customerName',
    p_order->>'customerPhone',
    p_order->>'wechat',
    v_date,
    v_slot,
    p_order->>'fromAddress',
    p_order->>'toAddress',
    v_vehicle,
    CASE WHEN p_order->>'quote' IS NOT NULL AND p_order->>'quote' != 'null'
         THEN (p_order->>'quote')::numeric ELSE NULL END,
    COALESCE((p_order->>'depositPaid')::boolean, false),
    p_order->>'depositStatus',
    CASE WHEN p_order->'depositScreenshot' IS NOT NULL AND p_order->>'depositScreenshot' != 'null'
         THEN p_order->'depositScreenshot' ELSE NULL END,
    COALESCE((p_order->>'deposit')::numeric, 0),
    CASE WHEN p_order->>'distanceKm' IS NOT NULL AND p_order->>'distanceKm' != 'null'
         THEN (p_order->>'distanceKm')::numeric ELSE NULL END,
    COALESCE((p_order->>'remoteSurcharge')::numeric, 0),
    COALESCE((p_order->>'stairFee')::numeric, 0),
    p_order->>'quoteNote',
    CASE WHEN p_order->'requestedMaterials' IS NOT NULL AND p_order->>'requestedMaterials' != 'null'
         THEN p_order->'requestedMaterials' ELSE NULL END,
    p_order->>'items',
    p_order->>'notes',
    COALESCE(p_order->>'source', '官网自助预约'),
    NULL,
    '[]'::jsonb,
    COALESCE(p_order->>'createdBy', 'customer'),
    COALESCE(p_order->>'createdByName', '客户自助')
  );

  RETURN jsonb_build_object('success', true, 'order_id', v_new_id, 'error', null);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'order_id', null, 'error', SQLERRM);
END;
$$;
