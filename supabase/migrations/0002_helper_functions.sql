-- =============================================================================
-- Migration: 0002_helper_functions.sql
-- Purpose  : Reusable helper functions/triggers shared across every table.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- set_updated_at()
-- Generic trigger function that stamps NEW.updated_at with the current time
-- on every UPDATE. Attached per-table in each table's migration file so that
-- no application code is ever responsible for maintaining updated_at.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger function: sets NEW.updated_at = now() on every row update. Attach via
   "create trigger trg_<table>_updated_at before update on <table> for each row
   execute function public.set_updated_at();"';
