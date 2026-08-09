-- Every Stripe Customer generation gets a monotonically increasing revision.
-- This lets server-side retries reuse one idempotency key while ensuring a
-- Customer that was deleted in Stripe can never be returned by an old key.
alter table public.profiles
  add column billing_customer_revision integer not null default 0;

alter table public.profiles
  add constraint profiles_billing_customer_revision_is_nonnegative
  check (billing_customer_revision >= 0);
