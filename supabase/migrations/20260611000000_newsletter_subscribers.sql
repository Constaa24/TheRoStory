-- ================================================================
-- Newsletter subscribers (double opt-in)
-- ================================================================
-- Lifecycle:
--   pending      → signup received, confirmation email sent
--   confirmed    → user clicked the confirm link; only these
--                  addresses are synced to Resend as Contacts
--   unsubscribed → kept for audit; Resend suppresses sending to
--                  unsubscribed contacts itself
--
-- Access model: service-role only. RLS is enabled with NO policies
-- and all API-role grants are revoked, so even a future policy
-- mistake cannot expose the list. Only the newsletter-* edge
-- functions (which use the service-role key) read or write it.
-- ================================================================

create table public.newsletter_subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique check (char_length(email) <= 254),
  status          text not null default 'pending'
                    check (status in ('pending', 'confirmed', 'unsubscribed')),
  confirm_token   uuid not null default gen_random_uuid(),
  -- When the most recent confirmation email went out; the confirm
  -- function rejects tokens older than 7 days.
  confirm_sent_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  confirmed_at    timestamptz,
  unsubscribed_at timestamptz
);

-- Confirm clicks look rows up by token.
create unique index newsletter_subscribers_confirm_token_idx
  on public.newsletter_subscribers (confirm_token);

alter table public.newsletter_subscribers enable row level security;

revoke all on table public.newsletter_subscribers from anon, authenticated;
