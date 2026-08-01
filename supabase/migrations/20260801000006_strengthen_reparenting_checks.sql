-- Corrective migration: UPDATE WITH CHECK for family_members, client_notes,
-- and documents only verified `agency_id = current_agency_id()` — it never
-- re-verified that a *new* client_id (if the update changes it) still
-- points to a client the caller owns. USING is evaluated against the row
-- being updated (its old values) and gates whether the update can start at
-- all; WITH CHECK is evaluated against the resulting new row and is the
-- only place that can catch a producer changing client_id mid-update to
-- point at a client they don't own — reparenting a family member, note, or
-- document onto someone else's client. Regression coverage:
-- tests/rls/reparenting.test.ts.

alter policy family_members_update on family_members
  with check (
    agency_id = current_agency_id()
    and exists (
      select 1 from clients c
      where c.id = family_members.client_id and owns_or_admin(c.assigned_producer_id)
    )
  );

alter policy client_notes_update on client_notes
  with check (
    agency_id = current_agency_id()
    and exists (
      select 1 from clients c
      where c.id = client_notes.client_id and owns_or_admin(c.assigned_producer_id)
    )
  );

alter policy documents_update on documents
  with check (
    agency_id = current_agency_id()
    and (
      client_id is null
      or exists (
        select 1 from clients c
        where c.id = documents.client_id and owns_or_admin(c.assigned_producer_id)
      )
    )
  );
