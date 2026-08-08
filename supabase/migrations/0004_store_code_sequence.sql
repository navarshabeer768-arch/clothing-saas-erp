-- =============================================================================
-- Migration: 0004_store_code_sequence.sql
-- Purpose  : Concurrency-safe generation of human-readable Store IDs
--            (e.g. STORE-0001, STORE-0002, ...) using a real Postgres SEQUENCE.
--            A sequence guarantees no two concurrent store-creation requests
--            can ever receive the same number, without needing application-side
--            locking or "select max()+1" races.
-- =============================================================================

create sequence if not exists public.store_code_seq
  as bigint
  start with 1
  increment by 1
  no cycle;

-- -----------------------------------------------------------------------------
-- generate_store_code()
-- Returns the next formatted store code, e.g. 'STORE-0001'.
-- Padding is 4 digits by default; once the sequence exceeds 9999 the code
-- simply grows to 'STORE-10000', etc. Centralizing the format here means the
-- prefix/padding can be changed later in one place without touching app code.
-- -----------------------------------------------------------------------------
create or replace function public.generate_store_code()
returns text
language plpgsql
as $$
declare
  next_val bigint;
begin
  next_val := nextval('public.store_code_seq');
  return 'STORE-' || lpad(next_val::text, 4, '0');
end;
$$;

comment on function public.generate_store_code() is
  'Concurrency-safe next human-readable store code, e.g. STORE-0001. Backed by a
   real sequence so simultaneous store creations never collide. Call this only
   from trusted server-side store-creation logic, never from the browser.';
