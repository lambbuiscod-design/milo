-- Desktop-only suggestion metadata. Conversation text and generated replies
-- never enter this table; the response remains ephemeral in the request path.
create table public.desktop_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  selected_tone text not null check (selected_tone in ('warm', 'confident', 'playful', 'direct')),
  relationship_stage text not null check (relationship_stage in ('new_match', 'first_dates', 'dating', 'relationship', 'conflict')),
  status public.analysis_status not null default 'pending',
  model text not null,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost numeric(12,6) check (estimated_cost is null or estimated_cost >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);

create unique index desktop_suggestions_one_pending_per_user_idx
  on public.desktop_suggestions (user_id)
  where status = 'pending';

alter table public.desktop_suggestions enable row level security;
revoke all on public.desktop_suggestions from public, anon, authenticated;

create or replace function public.reserve_desktop_suggestion(
  p_user_id uuid,
  p_request_id uuid,
  p_selected_tone text,
  p_relationship_stage text,
  p_model text,
  p_expected_stripe_price_id text default null
)
returns table (suggestion_id uuid, remaining integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_allowance integer;
  v_used integer;
  v_id uuid;
begin
  if p_user_id is null or p_request_id is null or nullif(btrim(p_model), '') is null then
    raise exception 'Invalid desktop suggestion request';
  end if;
  if p_selected_tone not in ('warm', 'confident', 'playful', 'direct')
     or p_relationship_stage not in ('new_match', 'first_dates', 'dating', 'relationship', 'conflict') then
    raise exception 'Invalid desktop suggestion preferences';
  end if;

  -- Serialize allowance checks for this account before creating the live row.
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Account is missing'; end if;

  -- A server crash must not leave the account permanently locked behind the
  -- one-pending-request constraint. The API timeout is at most 45 seconds, so
  -- two minutes gives an in-flight provider request ample time to finish.
  update public.desktop_suggestions
     set status = 'failed'
   where user_id = p_user_id
     and status = 'pending'
     and created_at < now() - interval '2 minutes';

  if exists (select 1 from public.desktop_suggestions where user_id = p_user_id and status = 'pending')
     or exists (select 1 from public.analyses where user_id = p_user_id and status = 'pending') then
    raise exception 'Suggestion already in progress';
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

  insert into public.usage_periods (user_id, period_start, period_end, allowance, used)
  values (p_user_id, v_period_start, v_period_end, v_allowance, 0)
  on conflict (user_id, period_start) do update
    set period_end = excluded.period_end,
        allowance = greatest(excluded.allowance, public.usage_periods.used),
        updated_at = now();

  select used into v_used
    from public.usage_periods
   where user_id = p_user_id and period_start = v_period_start
   for update;
  if v_used >= v_allowance then raise exception 'Analysis allowance exhausted'; end if;

  insert into public.desktop_suggestions (
    user_id, request_id, selected_tone, relationship_stage, status, model
  ) values (
    p_user_id, p_request_id, p_selected_tone, p_relationship_stage, 'pending', p_model
  ) returning id into v_id;

  return query select v_id, greatest(0, v_allowance - v_used);
end;
$$;

create or replace function public.complete_desktop_suggestion(
  p_suggestion_id uuid,
  p_user_id uuid,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_cost numeric default null,
  p_expected_stripe_price_id text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_allowance integer;
  v_used integer;
begin
  if p_suggestion_id is null or p_user_id is null or nullif(btrim(p_model), '') is null then
    raise exception 'Invalid desktop suggestion completion';
  end if;
  perform 1 from public.desktop_suggestions
   where id = p_suggestion_id and user_id = p_user_id and status = 'pending'
   for update;
  if not found then raise exception 'Desktop suggestion is missing or no longer pending'; end if;

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

  insert into public.usage_periods (user_id, period_start, period_end, allowance, used)
  values (p_user_id, v_period_start, v_period_end, v_allowance, 0)
  on conflict (user_id, period_start) do update
    set period_end = excluded.period_end,
        allowance = greatest(excluded.allowance, public.usage_periods.used),
        updated_at = now();
  select used into v_used from public.usage_periods
   where user_id = p_user_id and period_start = v_period_start for update;
  if v_used >= v_allowance then raise exception 'Analysis allowance exhausted'; end if;

  update public.usage_periods set used = used + 1, updated_at = now()
   where user_id = p_user_id and period_start = v_period_start;
  update public.desktop_suggestions set
    status = 'completed', model = p_model, input_tokens = p_input_tokens,
    output_tokens = p_output_tokens, estimated_cost = p_estimated_cost
   where id = p_suggestion_id and user_id = p_user_id;
  insert into public.analytics_events (user_id, event_name)
  values (p_user_id, 'analysis_completed');
  return greatest(0, v_allowance - v_used - 1);
end;
$$;

revoke all on function public.reserve_desktop_suggestion(uuid, uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_desktop_suggestion(uuid, uuid, text, text, text, text) to service_role;
revoke all on function public.complete_desktop_suggestion(uuid, uuid, text, integer, integer, numeric, text)
  from public, anon, authenticated;
grant execute on function public.complete_desktop_suggestion(uuid, uuid, text, integer, integer, numeric, text) to service_role;
