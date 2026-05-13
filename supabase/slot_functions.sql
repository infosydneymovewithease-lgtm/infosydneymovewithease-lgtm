-- ── Booking Slot Inventory Functions ────────────────────────────────────────
-- Run this in: Supabase Dashboard → SQL Editor → New query

-- ── 1. Query availability for multiple slots at once (for frontend display) ──
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
  v_vehicle_keys  text[];
  v_capacity      int;
  v_slot          text;
  v_booked        int;
  v_result        jsonb := '[]'::jsonb;
BEGIN
  IF p_vehicle_group = 'van' THEN
    v_vehicle_keys := ARRAY['面包车'];
    v_capacity     := 1;
  ELSIF p_vehicle_group = 'small' THEN
    v_vehicle_keys := ARRAY['小卡车', '小卡三人'];
    v_capacity     := 2;
  ELSIF p_vehicle_group = 'large' THEN
    v_vehicle_keys := ARRAY['大卡车', '大卡三人', '双卡车'];
    v_capacity     := 1;
  ELSE
    RETURN '[]'::jsonb;
  END IF;

  FOREACH v_slot IN ARRAY p_slots LOOP
    SELECT
      (SELECT COUNT(*) FROM orders
        WHERE date        = p_date
          AND "startTime" = v_slot
          AND vehicle     = ANY(v_vehicle_keys)
          AND status NOT IN ('已取消', '已完成'))
      +
      (SELECT COUNT(*) FROM storage_orders
        WHERE date        = p_date
          AND "startTime" = v_slot
          AND vehicle     = ANY(v_vehicle_keys)
          AND status NOT IN ('已取消', '已完成'))
    INTO v_booked;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'slot',      v_slot,
      'capacity',  v_capacity,
      'booked',    v_booked,
      'available', GREATEST(v_capacity - v_booked, 0)
    ));
  END LOOP;

  RETURN v_result;
END;
$$;


-- ── 2. Create order with atomic slot check (prevents race conditions) ─────────
CREATE OR REPLACE FUNCTION create_order_with_slot_check(
  p_order jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vehicle       text;
  v_vehicle_group text;
  v_vehicle_keys  text[];
  v_capacity      int;
  v_date          text;
  v_slot          text;
  v_booked        int;
  v_new_id        text;
BEGIN
  v_vehicle := p_order->>'vehicle';
  v_date    := p_order->>'date';
  v_slot    := p_order->>'startTime';

  -- Map vehicle → group + sibling configs + capacity
  IF v_vehicle = ANY(ARRAY['面包车']) THEN
    v_vehicle_group := 'van';
    v_vehicle_keys  := ARRAY['面包车'];
    v_capacity      := 1;
  ELSIF v_vehicle = ANY(ARRAY['小卡车', '小卡三人']) THEN
    v_vehicle_group := 'small';
    v_vehicle_keys  := ARRAY['小卡车', '小卡三人'];
    v_capacity      := 2;
  ELSIF v_vehicle = ANY(ARRAY['大卡车', '大卡三人', '双卡车']) THEN
    v_vehicle_group := 'large';
    v_vehicle_keys  := ARRAY['大卡车', '大卡三人', '双卡车'];
    v_capacity      := 1;
  ELSE
    RETURN jsonb_build_object('success', false, 'order_id', null, 'error', '未知车型');
  END IF;

  -- Advisory lock: serialise concurrent requests for the same slot
  PERFORM pg_advisory_xact_lock(
    hashtext(v_vehicle_group || '::' || v_date || '::' || v_slot)::bigint
  );

  -- Re-count inside the lock (orders + storage_orders share the slot pool)
  SELECT
    (SELECT COUNT(*) FROM orders
      WHERE date        = v_date
        AND "startTime" = v_slot
        AND vehicle     = ANY(v_vehicle_keys)
        AND status NOT IN ('已取消', '已完成'))
    +
    (SELECT COUNT(*) FROM storage_orders
      WHERE date        = v_date
        AND "startTime" = v_slot
        AND vehicle     = ANY(v_vehicle_keys)
        AND status NOT IN ('已取消', '已完成'))
  INTO v_booked;

  IF v_booked >= v_capacity THEN
    RETURN jsonb_build_object(
      'success',  false,
      'order_id', null,
      'error',    'slot_full'
    );
  END IF;

  -- Generate order ID matching JS pattern: ORD-YYYYMMDD-XXXX (Sydney time)
  v_new_id := 'ORD-'
    || to_char(now() AT TIME ZONE 'Australia/Sydney', 'YYYYMMDD')
    || '-'
    || upper(substring(md5(random()::text) from 1 for 4));

  INSERT INTO orders (
    id,
    "createdAt",
    status,
    "serviceType",
    "customerName",
    "customerPhone",
    wechat,
    date,
    "startTime",
    "fromAddress",
    "toAddress",
    vehicle,
    quote,
    "depositPaid",
    "depositStatus",
    "depositScreenshot",
    deposit,
    "distanceKm",
    "remoteSurcharge",
    "stairFee",
    "quoteNote",
    "requestedMaterials",
    items,
    notes,
    source,
    "assignedTo",
    "assignedWorkers",
    "createdBy",
    "createdByName"
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

  RETURN jsonb_build_object(
    'success',  true,
    'order_id', v_new_id,
    'error',    null
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success',  false,
    'order_id', null,
    'error',    SQLERRM
  );
END;
$$;
