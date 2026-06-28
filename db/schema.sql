-- ============================================
-- Zebra — Supabase Schema
-- Generated: 2026-06-17
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Tables
-- ============================================

CREATE TABLE IF NOT EXISTS public.zebra_payroll_audits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tx_hash TEXT UNIQUE NOT NULL,
  total_amount NUMERIC(20, 7) NOT NULL,
  kyc_root TEXT NOT NULL,
  encrypted_view_key TEXT NOT NULL, -- ECIES encrypted AES key
  metadata_uri TEXT NOT NULL,       -- Link to encrypted IPFS CSV
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_zebra_payroll_audits_tx_hash ON public.zebra_payroll_audits (tx_hash);
CREATE INDEX IF NOT EXISTS idx_zebra_payroll_audits_created_at ON public.zebra_payroll_audits (created_at);

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE public.zebra_payroll_audits ENABLE ROW LEVEL SECURITY;

-- Read policy: anyone can read
CREATE POLICY "Allow public read on zebra_payroll_audits"
  ON public.zebra_payroll_audits
  FOR SELECT
  USING (true);

-- Write policy: anyone can insert for hackathon simplicity
CREATE POLICY "Allow public insert on zebra_payroll_audits"
  ON public.zebra_payroll_audits
  FOR INSERT
  WITH CHECK (true);

-- Table: zebra_tax_records (v2)
CREATE TABLE IF NOT EXISTS public.zebra_tax_records (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    payroll_hash VARCHAR(64) UNIQUE NOT NULL,
    tax_authority VARCHAR(56) NOT NULL,
    tax_amount NUMERIC NOT NULL,
    net_amount NUMERIC NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'complete')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.zebra_tax_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on zebra_tax_records" ON public.zebra_tax_records FOR SELECT USING (true);
CREATE POLICY "Allow public insert on zebra_tax_records" ON public.zebra_tax_records FOR INSERT WITH CHECK (true);

