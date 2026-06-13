-- ================================================================
-- Explicit deny-all policy for newsletter_subscribers
-- ================================================================
-- The table has RLS enabled with no policies, plus all grants revoked
-- from anon/authenticated — so it is already fully locked to the API
-- (only service_role, which bypasses RLS, reads/writes it via the
-- newsletter-* edge functions). That is the intended posture.
--
-- The Supabase linter's `rls_enabled_no_policy` advisory can't
-- distinguish "deliberately locked" from "forgot to add policies", so
-- it warns. Adding a single permissive policy that grants nothing
-- (USING false / WITH CHECK false) clears the advisory and makes the
-- deny-all intent explicit. This changes nothing functionally:
--
--   * anon / authenticated were already blocked at the grant layer and
--     remain blocked (the policy would deny them even if a grant were
--     ever re-added by mistake — defense in depth).
--   * service_role bypasses RLS entirely, so the edge functions are
--     unaffected.
-- ================================================================

drop policy if exists "No API access to newsletter subscribers"
  on public.newsletter_subscribers;

create policy "No API access to newsletter subscribers"
  on public.newsletter_subscribers
  as permissive
  for all
  to anon, authenticated
  using (false)
  with check (false);
