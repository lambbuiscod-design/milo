create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused');
create type public.analysis_status as enum ('pending', 'completed', 'failed', 'blocked');
create type public.reply_category as enum ('safe', 'confident', 'playful');
create type public.feedback_value as enum ('helpful', 'not_helpful');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_price_id text not null,
  status public.subscription_status not null,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  selected_tone text not null check (selected_tone in ('warm', 'confident', 'playful', 'direct')),
  relationship_stage text not null check (relationship_stage in ('new_match', 'first_dates', 'dating', 'relationship', 'conflict')),
  optional_context text check (char_length(optional_context) <= 500),
  status public.analysis_status not null default 'pending',
  model text not null,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost numeric(12,6) check (estimated_cost is null or estimated_cost >= 0),
  created_at timestamptz not null default now()
);

create index analyses_user_created_idx on public.analyses(user_id, created_at desc);

create table public.replies (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  category public.reply_category not null,
  reply_text text not null check (char_length(reply_text) <= 280),
  explanation text not null check (char_length(explanation) <= 360),
  created_at timestamptz not null default now(),
  unique (analysis_id, category)
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  reply_id uuid not null references public.replies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  value public.feedback_value not null,
  created_at timestamptz not null default now(),
  unique (reply_id, user_id)
);

create table public.usage_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  allowance integer not null check (allowance > 0),
  used integer not null default 0 check (used >= 0 and used <= allowance),
  updated_at timestamptz not null default now(),
  unique (user_id, period_start)
);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  event_name text not null check (event_name in ('signup_completed', 'analysis_started', 'analysis_completed', 'analysis_failed', 'reply_copied', 'feedback_submitted', 'paywall_viewed', 'checkout_started', 'subscription_started', 'subscription_cancelled')),
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index analytics_events_created_idx on public.analytics_events(created_at desc);

create table public.stripe_events (
  id text primary key,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.analyses enable row level security;
alter table public.replies enable row level security;
alter table public.feedback enable row level security;
alter table public.usage_periods enable row level security;
alter table public.analytics_events enable row level security;
alter table public.stripe_events enable row level security;

create policy "Users read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Users read own subscription" on public.subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users read own analyses" on public.analyses for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users read own replies" on public.replies for select to authenticated using (exists (select 1 from public.analyses where analyses.id = replies.analysis_id and analyses.user_id = (select auth.uid())));
create policy "Users read own feedback" on public.feedback for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users read own usage" on public.usage_periods for select to authenticated using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select on public.profiles, public.subscriptions, public.analyses, public.replies, public.feedback, public.usage_periods to authenticated;
revoke all on public.analytics_events, public.stripe_events from anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''));
  insert into public.analytics_events (user_id, event_name) values (new.id, 'signup_completed');
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.complete_analysis(
  p_analysis_id uuid,
  p_user_id uuid,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_replies jsonb,
  p_estimated_cost numeric default null
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
  if jsonb_typeof(p_replies) <> 'array' or jsonb_array_length(p_replies) <> 3 then
    raise exception 'Exactly three replies are required';
  end if;
  if (select count(distinct item->>'category') from jsonb_array_elements(p_replies) item) <> 3 then
    raise exception 'Reply categories must be unique';
  end if;

  perform 1 from public.analyses where id = p_analysis_id and user_id = p_user_id and status = 'pending' for update;
  if not found then raise exception 'Analysis is missing or no longer pending'; end if;

  select current_period_start, current_period_end, 150
    into v_period_start, v_period_end, v_allowance
    from public.subscriptions
    where user_id = p_user_id and status in ('active', 'trialing') and current_period_end > now()
    limit 1;

  if v_period_start is null then
    v_period_start := '1970-01-01 00:00:00+00'::timestamptz;
    v_period_end := '9999-12-31 23:59:59+00'::timestamptz;
    v_allowance := 5;
  end if;

  insert into public.usage_periods (user_id, period_start, period_end, allowance, used)
  values (p_user_id, v_period_start, v_period_end, v_allowance, 0)
  on conflict (user_id, period_start) do nothing;

  select used into v_used from public.usage_periods where user_id = p_user_id and period_start = v_period_start for update;
  if v_used >= v_allowance then raise exception 'Analysis allowance exhausted'; end if;

  update public.usage_periods set used = used + 1, updated_at = now() where user_id = p_user_id and period_start = v_period_start;
  update public.analyses set status = 'completed', model = p_model, input_tokens = p_input_tokens, output_tokens = p_output_tokens, estimated_cost = p_estimated_cost where id = p_analysis_id and user_id = p_user_id;

  for v_reply in select value from jsonb_array_elements(p_replies)
  loop
    insert into public.replies (analysis_id, category, reply_text, explanation)
    values (p_analysis_id, (v_reply->>'category')::public.reply_category, v_reply->>'text', v_reply->>'why_it_works');
  end loop;
  insert into public.analytics_events (user_id, event_name) values (p_user_id, 'analysis_completed');
end;
$$;

revoke all on function public.complete_analysis(uuid, uuid, text, integer, integer, jsonb, numeric) from public, anon, authenticated;
grant execute on function public.complete_analysis(uuid, uuid, text, integer, integer, jsonb, numeric) to service_role;
