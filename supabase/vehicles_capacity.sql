-- ── Vehicle Capacity Management ──────────────────────────────────────────────
-- Run in: Supabase Dashboard → SQL Editor → New query

-- ── 1. vehicles table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_name       text NOT NULL,
  vehicle_type       text NOT NULL CHECK (vehicle_type IN ('van', 'small_truck', 'big_truck')),
  enabled            boolean NOT NULL DEFAULT true,
  max_orders_per_day int     NOT NULL DEFAULT 3 CHECK (max_orders_per_day >= 1),
  notes              text,
  created_at         timestamptz DEFAULT now()
);

-- Admin can read/write; anon reads via SECURITY DEFINER RPCs only
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access on vehicles"
  ON vehicles FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Seed initial fleet (idempotent)
INSERT INTO vehicles (vehicle_name, vehicle_type, enabled, max_orders_per_day) VALUES
  ('面包车1',  'van',         true, 5),
  ('小卡车1',  'small_truck', true, 3),
  ('小卡车2',  'small_truck', true, 3),
  ('大卡车1',  'big_truck',   true, 2)
ON CONFLICT DO NOTHING;


-- ── 2. get_slots_availability — dual-layer capacity ──────────────────────────
-- Returns per-slot availability considering BOTH slot cap and daily cap.
--   slot_capacity  = number of enabled vehicles of that type (one job per truck per slot)
--   daily_capacity = SUM(max_orders_per_day) for enabled vehicles of that type
--   available      = LEAST(slot_cap - slot_booked, daily_cap - daily_booked)
-- Falls back to hardcoded values when vehicles table is empty.
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
  v_slot_capacity  int;
  v_daily_capacity int;
  v_daily_booked   int;
  v_slot           text;
  v_slot_booked    int;
  v_available      int;
  v_result         jsonb := '[]'::jsonb;
BEGIN
  -- Map group → vehicle_type (vehicles table) + vehicle_keys (orders table)
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

  -- Layer 2: slot capacity = number of enabled vehicles of this type
  SELECT COUNT(*) INTO v_slot_capacity
    FROM vehicles WHERE vehicle_type = v_vehicle_type AND enabled = true;

  -- Layer 1: daily capacity = sum of max_orders_per_day for enabled vehicles
  SELECT COALESCE(SUM(max_orders_per_day), 0) INTO v_daily_capacity
    FROM vehicles WHERE vehicle_type = v_vehicle_type AND enabled = true;

  -- Fallback when vehicles table is empty
  IF v_slot_capacity = 0 THEN
    v_slot_capacity := CASE p_vehicle_group
      WHEN 'van'   THEN 1
      WHEN 'small' THEN 2
      WHEN 'large' THEN 1
      ELSE 1 END;
  END IF;
  IF v_daily_capacity = 0 THEN
    v_daily_capacity := CASE p_vehicle_group
      WHEN 'van'   THEN 5
      WHEN 'small' THEN 6
      WHEN 'large' THEN 2
      ELSE 3 END;
  END IF;

  -- Daily booked count across all slots for this type today
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

    -- Effective available = tighter of the two limits
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


-- ── 3. create_order_with_slot_check — dual-layer atomic check ─────────────────
-- Advisory lock on (vehicle_type + date) serialises ALL concurrent bookings
-- for the same vehicle type on the same day, preventing both slot-level and
-- day-level race conditions.
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

  -- Broad lock: serialise all bookings of the same type on the same date.
  -- This covers both slot-level and day-level race conditions in one lock.
  PERFORM pg_advisory_xact_lock(
    hashtext(v_vehicle_type || '::' || v_date)::bigint
  );

  -- Resolve slot capacity (with fallback)
  SELECT COUNT(*) INTO v_slot_capacity
    FROM vehicles WHERE vehicle_type = v_vehicle_type AND enabled = true;
  IF v_slot_capacity = 0 THEN
    v_slot_capacity := CASE v_vehicle_type
      WHEN 'van'         THEN 1
      WHEN 'small_truck' THEN 2
      WHEN 'big_truck'   THEN 1
      ELSE 1 END;
  END IF;

  -- Resolve daily capacity (with fallback)
  SELECT COALESCE(SUM(max_orders_per_day), 0) INTO v_daily_capacity
    FROM vehicles WHERE vehicle_type = v_vehicle_type AND enabled = true;
  IF v_daily_capacity = 0 THEN
    v_daily_capacity := CASE v_vehicle_type
      WHEN 'van'         THEN 5
      WHEN 'small_truck' THEN 6
      WHEN 'big_truck'   THEN 2
      ELSE 3 END;
  END IF;

  -- Count inside the lock (authoritative)
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

  -- Layer 2 check: slot capacity
  IF v_slot_booked >= v_slot_capacity THEN
    RETURN jsonb_build_object('success', false, 'order_id', null, 'error', 'slot_full');
  END IF;

  -- Layer 1 check: daily capacity
  IF v_daily_booked >= v_daily_capacity THEN
    RETURN jsonb_build_object('success', false, 'order_id', null, 'error', 'day_full');
  END IF;

  -- Generate order ID (Sydney time)
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
