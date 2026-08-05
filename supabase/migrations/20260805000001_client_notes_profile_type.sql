-- Phase 3B: client_notes gets a note_type instead of a blanket
-- one-note-per-client rule. ProtectPlus will eventually want a real note
-- timeline — multiple timestamped notes per client, each attributed to
-- whichever producer or admin wrote it, never overwritten. A table-wide
-- unique(agency_id, client_id) constraint would make that permanently
-- impossible at the schema level; today's single-editable-textarea
-- behavior is a current UI choice, not a property the data model should
-- freeze in place.
--
-- Uniqueness applies to exactly one type — the one the current textarea
-- actually edits — leaving ordinary notes free to be many-per-client,
-- unconstrained, from day one.

create type client_note_type as enum ('profile', 'timeline');

-- Existing rows (none exist with meaningfully different semantics yet, but
-- the column needs a value) and any future row that doesn't specify a type
-- default to 'timeline' — the unconstrained, many-per-client case.
-- Defaulting the other way would be the wrong failure mode: a forgotten
-- explicit type on some future insert path would silently collide with an
-- existing profile note instead of just creating an ordinary note.
alter table public.client_notes
  add column note_type client_note_type not null default 'timeline';

-- A PARTIAL unique index, not a table constraint — Postgres's mechanism
-- for "unique only among rows matching a condition." Any number of
-- 'timeline' rows can share a (agency_id, client_id) pair; at most one
-- 'profile' row can.
create unique index client_notes_one_profile_per_client
  on public.client_notes (agency_id, client_id)
  where note_type = 'profile';

-- Upsert against a partial unique index needs ON CONFLICT (...) WHERE
-- <predicate> DO UPDATE, which supabase-js's generic .upsert() cannot
-- express (it only accepts a column list, no predicate) — this narrow RPC
-- is the correct tool for exactly that gap, not a style choice.
--
-- SECURITY DEFINER bypasses RLS by design, so this function re-implements
-- the same ownership check client_notes_insert/_update already enforce for
-- direct table access, rather than relying on RLS to catch it underneath.
create or replace function public.upsert_client_profile_note(p_client_id uuid, p_body text)
returns public.client_notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.client_notes;
begin
  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id
      and c.agency_id = public.current_agency_id()
      and public.owns_or_admin(c.assigned_producer_id)
  ) then
    raise exception 'Not authorized to write a note for this client';
  end if;

  insert into public.client_notes (agency_id, client_id, note_type, body)
  values (public.current_agency_id(), p_client_id, 'profile', p_body)
  on conflict (agency_id, client_id) where note_type = 'profile'
  do update set body = excluded.body
  returning * into result;
  -- created_by/updated_by are NOT set here — stamp_actor() (already
  -- attached to client_notes since Phase 2) fires on whichever branch
  -- actually runs (TG_OP distinguishes INSERT from the ON CONFLICT UPDATE)
  -- and stamps them from auth.uid() itself, exactly like every other write
  -- path in this app.

  return result;
end;
$$;

revoke all on function public.upsert_client_profile_note(uuid, text) from public;
grant execute on function public.upsert_client_profile_note(uuid, text) to authenticated;
