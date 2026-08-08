-- =============================================================================
-- Migration: 0001_extensions.sql
-- Purpose  : Enable Postgres extensions required by the SaaS platform.
-- =============================================================================

-- UUID generation (gen_random_uuid is also available natively via pgcrypto)
create extension if not exists "pgcrypto";

-- Useful for case-insensitive text comparisons later (e.g. emails)
create extension if not exists "citext";
