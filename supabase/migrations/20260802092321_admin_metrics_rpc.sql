-- Aggregate admin metrics in Postgres so PostgREST row limits cannot truncate
-- weekly-active-user or model-cost calculations. Only the trusted service role
-- may execute this function.

create function public.get_admin_metrics(p_expected_stripe_price_id text)
returns table (
  registered_users bigint,
  weekly_active_users bigint,
  analyses_completed bigint,
  analyses_failed bigint,
  active_subscriptions bigint,
  helpful_feedback bigint,
  total_feedback bigint,
  replies_copied bigint,
  total_model_cost numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.profiles),
    (
      select count(distinct user_id)
      from public.analytics_events
      where created_at >= now() - interval '7 days'
        and event_name in (
          'analysis_started',
          'analysis_completed',
          'reply_copied',
          'feedback_submitted'
        )
    ),
    (select count(*) from public.analyses where status = 'completed'),
    (select count(*) from public.analyses where status = 'failed'),
    (
      select count(*)
      from public.subscriptions
      where p_expected_stripe_price_id is not null
        and stripe_price_id = p_expected_stripe_price_id
        and status in ('active', 'trialing')
        and current_period_start <= now()
        and current_period_end > now()
    ),
    (select count(*) from public.feedback where value = 'helpful'),
    (select count(*) from public.feedback),
    (
      select count(*)
      from public.analytics_events
      where event_name = 'reply_copied'
    ),
    coalesce(
      (select sum(estimated_cost) from public.analyses where status = 'completed'),
      0::numeric
    );
$$;

revoke all on function public.get_admin_metrics(text)
  from public, anon, authenticated;
grant execute on function public.get_admin_metrics(text)
  to service_role;
