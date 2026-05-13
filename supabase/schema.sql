-- Move With Ease — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)

-- ── Staff ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  username    text UNIQUE NOT NULL,
  password    text NOT NULL,
  role        text DEFAULT 'worker',
  active      boolean DEFAULT true,
  stars       integer DEFAULT 1,
  "isDriver"  boolean DEFAULT false,
  "canDrive"  jsonb DEFAULT '[]',
  created_at  timestamptz DEFAULT now()
);

-- ── Orders ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                   text PRIMARY KEY,
  created_at           timestamptz DEFAULT now(),
  "createdAt"          text,
  status               text DEFAULT '待确认',
  "serviceType"        text,
  "customerName"       text,
  "customerPhone"      text,
  wechat               text,
  date                 text,
  "startTime"          text,
  "endTime"            text,
  "fromAddress"        text,
  "toAddress"          text,
  vehicle              text,
  quote                numeric,
  "finalAmount"        numeric,
  "paymentMethod"      text,
  "depositPaid"        boolean DEFAULT false,
  "depositStatus"      text,
  "depositScreenshot"  jsonb,
  deposit              numeric DEFAULT 0,
  "distanceKm"         numeric,
  "remoteSurcharge"    numeric DEFAULT 0,
  "heavyItemFee"       numeric DEFAULT 0,
  "stairFee"           numeric DEFAULT 0,
  "quoteNote"          text,
  "requestedMaterials" jsonb,
  items                text,
  notes                text,
  source               text,
  "assignedTo"         text,
  "assignedWorkers"    jsonb DEFAULT '[]',
  "dispatchedAt"       text,
  "confirmedAt"        text,
  "confirmChecks"      jsonb,
  "csNote"             text,
  "createdBy"          text,
  "createdByName"      text,
  "ikeaOrderNo"        text,
  "storeLocation"      text,
  "rubbishDisposal"    boolean DEFAULT false,
  "riskItems"          jsonb,
  photos               jsonb,
  "hasVideo"           boolean DEFAULT false,
  "paymentStatus"      text,
  "collectedBy"        text,
  "completedAt"        text,
  materials            jsonb,
  "materialsCost"      numeric DEFAULT 0,
  "fragileItems"       jsonb DEFAULT '[]',
  "fragileDescription" text,
  "fragileEstimatedFee" numeric DEFAULT 0
);

-- ── Storage Orders ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS storage_orders (
  id                   text PRIMARY KEY,
  created_at           timestamptz DEFAULT now(),
  "createdAt"          text,
  status               text DEFAULT '待确认',
  "customerName"       text,
  "customerPhone"      text,
  wechat               text,
  "moveInDate"         text,
  "moveOutDate"        text,
  "actualMoveOutDate"  text,
  boxes                integer DEFAULT 0,
  furniture            integer DEFAULT 0,
  items                text,
  location             text,
  deposit              numeric DEFAULT 0,
  "depositStatus"      text,
  "depositScreenshot"  jsonb,
  "paymentStatus"      text,
  notes                text,
  "requestedMaterials" jsonb,
  photos               jsonb,
  "hasVideo"           boolean DEFAULT false,
  "assignedTo"         text,
  "assignedWorkers"    jsonb DEFAULT '[]',
  "dispatchedAt"       text,
  "confirmedAt"        text,
  "confirmChecks"      jsonb,
  "csNote"             text,
  "workerStatus"       text,
  "arrivedAt"          text,
  "movingFee"          numeric DEFAULT 0,
  "completedAt"        text
);

-- ── Realtime ─────────────────────────────────────────────────────────────────
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE storage_orders REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE storage_orders;

-- ── Security (disable RLS for internal-only app) ──────────────────────────────
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage_orders DISABLE ROW LEVEL SECURITY;

-- ── Seed staff ───────────────────────────────────────────────────────────────
INSERT INTO staff (id, name, username, password, role, stars, "isDriver", "canDrive") VALUES
  ('laomou',     '老木',  'laomou',     '123',  'worker', 4, false, '[]'),
  ('xiaoyu',     '小宇',  'xiaoyu',     '1234', 'worker', 1, false, '[]'),
  ('chenxi',     '晨曦',  'chenxi',     '1234', 'worker', 4, true,  '["面包车","小卡车","小卡三人","大卡车","大卡三人","双卡车"]'),
  ('laowang',    '老王',  'laowang',    '1234', 'worker', 4, true,  '["面包车","小卡车","小卡三人","大卡车","大卡三人","双卡车"]'),
  ('xiaozhang',  '小张',  'xiaozhang',  '1234', 'worker', 4, true,  '["面包车","小卡车","小卡三人","卡车单人"]'),
  ('phill',      'Phill', 'phill',      '1234', 'admin',  1, false, '[]'),
  ('annie',      'Annie', 'annie',      '1234', 'cs',     1, false, '[]'),
  ('xiaoxi',     '小溪',  'xiaoxi',     '1234', 'cs',     1, false, '[]'),
  ('xiaomei',    '小美',  'xiaomei',    '1234', 'cs',     1, false, '[]')
ON CONFLICT (id) DO NOTHING;
