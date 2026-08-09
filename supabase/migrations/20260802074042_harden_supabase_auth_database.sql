-- Production hardening for privacy, quota enforcement, and multi-instance
-- rate limiting. This migration is intentionally additive so it is safe for
-- projects that have already applied the initial Milo schema.

-- Account deletion must remove every application-owned record, including
-- privacy-safe analytics rows that still carry the user's UUID.
alter table public.analytics_events
  drop constraint analytics_events_user_id_fkey,
  add constraint analytics_events_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

-- Keep cascades and the queries used by the account/admin screens efficient.
create index if not exists feedback_user_id_idx
  on public.feedback (user_id);
create index if not exists analytics_events_user_id_idx
  on public.analytics_events (user_id);
create index if not exists analyses_status_created_idx
  on public.analyses (status, created_at desc);
create index if not exists analytics_events_name_created_idx
  on public.analytics_events (event_name, created_at desc);
create index if not exists feedback_value_idx
  on public.feedback (value);
create index if not exists subscriptions_active_status_idx
  on public.subscriptions (status, current_period_end)
  where status in ('active', 'trialing');

alter table public.subscriptions
  add constraint subscriptions_period_is_valid
  check (current_period_end > current_period_start);

alter table public.usage_periods
  add constraint usage_periods_period_is_valid
  check (period_end > period_start);

alter table public.analytics_events
  add constraint analytics_events_properties_are_object
  check (jsonb_typeof(properties) = 'object');

-- Explicit grants make this migration correct with the 2026 Data API default,
-- where public-schema tables are no longer automatically exposed.
revoke all on table
  public.profiles,
  public.subscriptions,
  public.analyses,
  public.replies,
  public.feedback,
  public.usage_periods,
  public.analytics_events,
  public.stripe_events
from anon, authenticated;

grant usage on schema public to authenticated;
grant select on table
  public.profiles,
  public.subscriptions,
  public.analyses,
  public.replies,
  public.feedback,
  public.usage_periods
to authenticated;

revoke all on all sequences in schema public from anon, authenticated;

-- Replace the original completion function with a price-bound version.
-- The optional default preserves safe deploy ordering: old application builds
-- continue to work, but receive free-plan entitlement until they pass Milo's
-- configured Stripe price ID.
drop function public.complete_analysis(uuid, uuid, text, integer, integer, jsonb, numeric);

create function public.complete_analysis(
  p_analysis_id uuid,
  p_user_id uuid,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_replies jsonb,
  p_estimated_cost numeric default null,
  p_expected_stripe_price_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_allowance integer;
  v_used integer;
  v_reply jsonb;
begin
  if p_user_id is null or p_analysis_id is null then
    raise exception 'Analysis and user are required';
  end if;

  if nullif(btrim(p_model), '') is null then
    raise exception 'Model is required';
  end if;

  if jsonb_typeof(p_replies) <> 'array' or jsonb_array_length(p_replies) <> 3 then
    raise exception 'Exactly three replies are required';
  end if;

  if (
    select array_agg(distinct item->>'category' order by item->>'category')
    from jsonb_array_elements(p_replies) item
  ) <> array['confident', 'playful', 'safe']::text[] then
    raise exception 'Safe, confident and playful replies are required';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_replies) item
    where jsonb_typeof(item) <> 'object'
      or nullif(btrim(item->>'text'), '') is null
      or char_length(item->>'text') > 280
      or nullif(btrim(item->>'why_it_works'), '') is null
      or char_length(item->>'why_it_works') > 360
  ) then
    raise exception 'Reply content is invalid';
  end if;

  perform 1
  from public.analyses
  where id = p_analysis_id
    and user_id = p_user_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Analysis is missing or no longer pending';
  end if;

  select current_period_start, current_period_end, 150
    into v_period_start, v_period_end, v_allowance
  from public.subscriptions
  where user_id = p_user_id
    and p_expected_stripe_price_id is not null
    and stripe_price_id = p_expected_stripe_price_id
    and status in ('active', 'trialing')
    and current_period_start <= now()
    and current_period_end > now()
  limit 1;

  if v_period_start is null then
    v_period_start := '1970-01-01 00:00:00+00'::timestamptz;
    v_period_end := '9999-12-31 23:59:59+00'::timestamptz;
    v_allowance := 5;
  end if;

  insert into public.usage_periods (
    user_id,
    period_start,
    period_end,
    allowance,
    used
  )
  values (p_user_id, v_period_start, v_period_end, v_allowance, 0)
  on conflict (user_id, period_start) do update
  set period_end = excluded.period_end,
      allowance = greatest(excluded.allowance, public.usage_periods.used),
      updated_at = now();

  select used
    into v_used
  from public.usage_periods
  where user_id = p_user_id
    and period_start = v_period_start
  for update;

  if v_used >= v_allowance then
    raise exception 'Analysis allowance exhausted';
  end if;

  insert into public.replies (analysis_id, category, reply_text, explanation)
  select
    p_analysis_id,
    (item->>'category')::public.reply_category,
    item->>'text',
    item->>'why_it_works'
  from jsonb_array_elements(p_replies) item;

  update public.usage_periods
  set used = used + 1,
      updated_at = now()
  where user_id = p_user_id
    and period_start = v_period_start;

  update public.analyses
  set status = 'completed',
      model = p_model,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      estimated_cost = p_estimated_cost
  where id = p_analysis_id
    and user_id = p_user_id;

  insert into public.analytics_events (user_id, event_name)
  values (p_user_id, 'analysis_completed');
end;
$$;

revoke all on function public.complete_analysis(
  uuid, uuid, text, integer, integer, jsonb, numeric, text
) from public, anon, authenticated;
grant execute on function public.complete_analysis(
  uuid, uuid, text, integer, integer, jsonb, numeric, text
) to service_role;

-- Keep rate-limit state outside the exposed Data API schema. Keys are SHA-256
-- hashes, so neither raw IP addresses nor raw user identifiers are stored.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.rate_limit_windows (
  scope text not null,
  key_hash text not null,
  window_start timestamptz not null,
  expires_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (scope, key_hash, window_start),
  check (scope ~ '^[a-z0-9:_-]{1,64}$'),
  check (key_hash ~ '^[0-9a-f]{64}$'),
  check (expires_at > window_start)
);

create index rate_limit_windows_expires_idx
  on private.rate_limit_windows (expires_at);

revoke all on table private.rate_limit_windows from public, anon, authenticated;

create function public.consume_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_reset_at timestamptz;
  v_count integer;
begin
  if p_scope is null or p_scope !~ '^[a-z0-9:_-]{1,64}$' then
    raise exception 'Invalid rate-limit scope';
  end if;
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate-limit key';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'Invalid rate-limit allowance';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit window';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );
  v_reset_at := v_window_start + make_interval(secs => p_window_seconds);

  -- Every key cleans its prior windows. One percent of requests also performs
  -- indexed global expiry so one-off attacker keys cannot grow the table
  -- indefinitely without requiring an external cron service.
  if random() < 0.01 then
    delete from private.rate_limit_windows where expires_at <= v_now;
  else
    delete from private.rate_limit_windows
    where scope = p_scope
      and key_hash = p_key_hash
      and expires_at <= v_now;
  end if;

  insert into private.rate_limit_windows (
    scope,
    key_hash,
    window_start,
    expires_at,
    request_count
  )
  values (p_scope, p_key_hash, v_window_start, v_reset_at, 1)
  on conflict (scope, key_hash, window_start) do update
  set request_count = least(
    private.rate_limit_windows.request_count + 1,
    p_limit + 1
  )
  returning request_count into v_count;

  return query
  select
    v_count <= p_limit,
    greatest(0, p_limit - v_count),
    v_reset_at;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer)
  to service_role;

-- New functions in application schemas should not silently become public API.
alter default privileges in schema public
  revoke execute on functions from public;
alter default privileges in schema private
  revoke execute on functions from public;
