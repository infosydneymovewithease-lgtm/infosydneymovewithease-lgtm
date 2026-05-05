-- Add customer_code column to orders table
-- Run in: Supabase Dashboard → SQL Editor → New query

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_code TEXT;
