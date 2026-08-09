-- Privacy-safe product analytics. Browser callers may never write this table;
-- trusted routes and database transitions record only a fixed event vocabulary.

-- The former browser endpoint accepted the complete event vocabulary, so its
-- historical rows cannot be distinguished from authoritative lifecycle data.
-- Purge that untrusted history and rebuild only facts proven by source tables.
delete from public.analytics_events;

alter table public.analytics_events
  alter column user_id set not null,
  add column dedupe_key text;

alter table public.analytics_events
  add constraint analytics_events_dedupe_key_is_opaque
    check (dedupe_key is null or dedupe_key ~ '^[0-9a-f]{64}$'),
  add constraint analytics_events_properties_contract
    check (
      (
        event_name = 'reply_copied'
        and properties ? 'category'
        and properties - 'category' = '{}'::jsonb
        and properties->>'category' in ('safe', 'confident', 'playful')
      )
      or (
        event_name = 'paywall_viewed'
        and properties ? 'surface'
        and properties - 'surface' = '{}'::jsonb
        and properties->>'surface' = 'analysis_limit'
      )
      or (
        event_name not in ('reply_copied', 'paywall_viewed')
        and properties = '{}'::jsonb
      )
    );

create unique index analytics_events_dedupe_key_idx
  on public.analytics_events (dedupe_key)
  where dedupe_key is not null;

-- md5 is used twice only to hide internal source identifiers in an opaque,
-- deterministic metric key. This key is not an authentication primitive.
create function private.analytics_dedupe_key(
  p_event_name text,
  p_source text
)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select
    pg_catalog.md5('milo-analytics-v1:' || p_event_name || ':' || p_source)
    || pg_catalog.md5('milo-analytics-v2:' || p_event_name || ':' || p_source)
$$;

revoke all on function private.analytics_dedupe_key(text, text)
  from public, anon, authenticated;

-- Signup is authoritative at the auth.users insertion boundary.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''));

  insert into public.analytics_events (
    user_id,
    event_name,
    dedupe_key
  )
  values (
    new.id,
    'signup_completed',
    private.analytics_dedupe_key('signup_completed', new.id::text)
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user()
  from public, anon, authenticated;

create function private.record_analysis_analytics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.analytics_events (
      user_id,
      event_name,
      dedupe_key,
      created_at
    )
    values (
      new.user_id,
      'analysis_started',
      private.analytics_dedupe_key('analysis_started', new.id::text),
      new.created_at
    )
    on conflict do nothing;
  elsif old.status is distinct from new.status and new.status = 'failed' then
    insert into public.analytics_events (user_id, event_name, dedupe_key)
    values (
      new.user_id,
      'analysis_failed',
      private.analytics_dedupe_key('analysis_failed', new.id::text)
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.record_analysis_analytics()
  from public, anon, authenticated;

create trigger record_analysis_analytics
after insert or update of status on public.analyses
for each row execute function private.record_analysis_analytics();

create function private.record_feedback_analytics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.analytics_events (
    user_id,
    event_name,
    dedupe_key,
    created_at
  )
  values (
    new.user_id,
    'feedback_submitted',
    private.analytics_dedupe_key('feedback_submitted', new.id::text),
    new.created_at
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function private.record_feedback_analytics()
  from public, anon, authenticated;

create trigger record_feedback_analytics
after insert on public.feedback
for each row execute function private.record_feedback_analytics();

create function private.record_subscription_analytics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status in ('active', 'trialing') then
      insert into public.analytics_events (user_id, event_name, dedupe_key)
      values (
        new.user_id,
        'subscription_started',
        private.analytics_dedupe_key(
          'subscription_started',
          new.stripe_subscription_id
        )
      )
      on conflict do nothing;
    end if;

    if new.status = 'canceled' or new.cancel_at_period_end then
      insert into public.analytics_events (user_id, event_name, dedupe_key)
      values (
        new.user_id,
        'subscription_cancelled',
        private.analytics_dedupe_key(
          'subscription_cancelled',
          new.stripe_subscription_id
        )
      )
      on conflict do nothing;
    end if;
  else
    if (
      new.status in ('active', 'trialing')
      and (
        old.stripe_subscription_id is distinct from new.stripe_subscription_id
        or old.status not in ('active', 'trialing')
      )
    ) then
      insert into public.analytics_events (user_id, event_name, dedupe_key)
      values (
        new.user_id,
        'subscription_started',
        private.analytics_dedupe_key(
          'subscription_started',
          new.stripe_subscription_id
        )
      )
      on conflict do nothing;
    end if;

    if (
      (
        new.status = 'canceled'
        and old.status is distinct from new.status
      )
      or (
        new.cancel_at_period_end
        and not old.cancel_at_period_end
      )
      or (
        old.stripe_subscription_id is distinct from new.stripe_subscription_id
        and (new.status = 'canceled' or new.cancel_at_period_end)
      )
    ) then
      insert into public.analytics_events (user_id, event_name, dedupe_key)
      values (
        new.user_id,
        'subscription_cancelled',
        private.analytics_dedupe_key(
          'subscription_cancelled',
          new.stripe_subscription_id
        )
      )
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.record_subscription_analytics()
  from public, anon, authenticated;

create trigger record_subscription_analytics
after insert or update of status, stripe_subscription_id, cancel_at_period_end
on public.subscriptions
for each row execute function private.record_subscription_analytics();

-- Backfill only minimal lifecycle facts for records created before these
-- triggers existed. Internal identifiers are never copied into properties.
insert into public.analytics_events (
  user_id,
  event_name,
  dedupe_key,
  created_at
)
select
  profiles.id,
  'signup_completed',
  private.analytics_dedupe_key('signup_completed', profiles.id::text),
  profiles.created_at
from public.profiles
on conflict do nothing;

insert into public.analytics_events (
  user_id,
  event_name,
  dedupe_key,
  created_at
)
select
  analyses.user_id,
  'analysis_started',
  private.analytics_dedupe_key('analysis_started', analyses.id::text),
  analyses.created_at
from public.analyses
on conflict do nothing;

insert into public.analytics_events (
  user_id,
  event_name,
  dedupe_key,
  created_at
)
select
  analyses.user_id,
  'analysis_completed',
  private.analytics_dedupe_key('analysis_completed', analyses.id::text),
  analyses.created_at
from public.analyses
where analyses.status = 'completed'
on conflict do nothing;

insert into public.analytics_events (
  user_id,
  event_name,
  dedupe_key,
  created_at
)
select
  analyses.user_id,
  'analysis_failed',
  private.analytics_dedupe_key('analysis_failed', analyses.id::text),
  analyses.created_at
from public.analyses
where analyses.status = 'failed'
on conflict do nothing;

insert into public.analytics_events (
  user_id,
  event_name,
  dedupe_key,
  created_at
)
select
  feedback.user_id,
  'feedback_submitted',
  private.analytics_dedupe_key('feedback_submitted', feedback.id::text),
  feedback.created_at
from public.feedback
on conflict do nothing;

insert into public.analytics_events (
  user_id,
  event_name,
  dedupe_key,
  created_at
)
select
  subscriptions.user_id,
  'subscription_started',
  private.analytics_dedupe_key(
    'subscription_started',
    subscriptions.stripe_subscription_id
  ),
  subscriptions.created_at
from public.subscriptions
where subscriptions.status in (
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'paused',
  'canceled'
)
on conflict do nothing;

insert into public.analytics_events (
  user_id,
  event_name,
  dedupe_key,
  created_at
)
select
  subscriptions.user_id,
  'subscription_cancelled',
  private.analytics_dedupe_key(
    'subscription_cancelled',
    subscriptions.stripe_subscription_id
  ),
  subscriptions.updated_at
from public.subscriptions
where subscriptions.status = 'canceled'
   or subscriptions.cancel_at_period_end
on conflict do nothing;

-- Keep the analytics table server-only even if Data API defaults change.
revoke all on table public.analytics_events from public, anon, authenticated;
do $$
begin
  if pg_catalog.to_regclass('public.analytics_events_id_seq') is not null then
    execute 'revoke all on sequence public.analytics_events_id_seq '
      || 'from public, anon, authenticated';
  end if;
end;
$$;
