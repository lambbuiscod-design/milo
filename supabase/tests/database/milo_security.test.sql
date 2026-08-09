begin;

create extension if not exists pgtap with schema extensions;
select plan(49);

select ok(
  (select bool_and(relrowsecurity)
   from pg_class
   where oid in (
     'public.profiles'::regclass,
     'public.subscriptions'::regclass,
     'public.analyses'::regclass,
     'public.replies'::regclass,
     'public.feedback'::regclass,
     'public.usage_periods'::regclass,
     'public.analytics_events'::regclass,
     'public.stripe_events'::regclass
   )),
  'RLS is enabled on every exposed Milo table'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.complete_analysis(uuid,uuid,text,integer,integer,jsonb,numeric,text)',
    'execute'
  ),
  'anonymous callers cannot complete analyses'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.complete_analysis(uuid,uuid,text,integer,integer,jsonb,numeric,text)',
    'execute'
  ),
  'authenticated callers cannot complete analyses directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.complete_analysis(uuid,uuid,text,integer,integer,jsonb,numeric,text)',
    'execute'
  ),
  'the service role can complete analyses atomically'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.consume_rate_limit(text,text,integer,integer)',
    'execute'
  ),
  'anonymous callers cannot consume server rate limits'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.consume_rate_limit(text,text,integer,integer)',
    'execute'
  ),
  'authenticated callers cannot consume server rate limits directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.consume_rate_limit(text,text,integer,integer)',
    'execute'
  ),
  'the service role can consume server rate limits'
);

select is(
  (select allowed from public.consume_rate_limit(
    'test', repeat('a', 64), 2, 600
  )),
  true,
  'the first request is allowed'
);

select is(
  (select allowed from public.consume_rate_limit(
    'test', repeat('a', 64), 2, 600
  )),
  true,
  'the second request is allowed'
);

select is(
  (select allowed from public.consume_rate_limit(
    'test', repeat('a', 64), 2, 600
  )),
  false,
  'a request above the distributed limit is blocked'
);

select is(
  (
    select confdeltype::text
    from pg_constraint
    where conname = 'analytics_events_user_id_fkey'
      and conrelid = 'public.analytics_events'::regclass
  ),
  'c',
  'account deletion cascades into analytics events'
);

select ok(
  not has_table_privilege('authenticated', 'public.analytics_events', 'insert'),
  'authenticated clients cannot insert analytics directly'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'analytics_events_properties_contract'
      and conrelid = 'public.analytics_events'::regclass
  ),
  'analytics properties are constrained to privacy-safe shapes'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'analytics_events'
      and indexname = 'analytics_events_dedupe_key_idx'
      and indexdef ilike '%unique%'
  ),
  'analytics lifecycle events have an idempotency index'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.analyses'::regclass
      and tgname = 'record_analysis_analytics'
      and not tgisinternal
  ),
  'analysis lifecycle analytics run at the database boundary'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.feedback'::regclass
      and tgname = 'record_feedback_analytics'
      and not tgisinternal
  ),
  'feedback analytics run at the database boundary'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.subscriptions'::regclass
      and tgname = 'record_subscription_analytics'
      and not tgisinternal
  ),
  'subscription analytics run at the database boundary'
);

-- Exercise allowance changes through the same SECURITY DEFINER function used
-- by the application. A malformed model result must fail before creating a
-- usage period or consuming one of the five lifetime analyses.
insert into auth.users (id, email)
values ('10000000-0000-4000-8000-000000000001', 'free-usage@milo.test');

insert into public.analyses (
  id,
  user_id,
  selected_tone,
  relationship_stage,
  status,
  model
)
values (
  '11000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'warm',
  'new_match',
  'pending',
  'test/model'
);

select throws_ok(
  $$
    select public.complete_analysis(
      '11000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      'test/model',
      10,
      10,
      '[
        {"category":"safe","text":"","why_it_works":"Invalid empty reply"},
        {"category":"confident","text":"Confident","why_it_works":"Clear"},
        {"category":"playful","text":"Playful","why_it_works":"Light"}
      ]'::jsonb,
      0.001,
      null
    )
  $$,
  'P0001',
  'Reply content is invalid',
  'an invalid generation is rejected before completion'
);

select is(
  (select count(*) from public.usage_periods where user_id = '10000000-0000-4000-8000-000000000001'),
  0::bigint,
  'a failed free generation does not create or consume usage'
);

select is(
  (select status::text from public.analyses where id = '11000000-0000-4000-8000-000000000001'),
  'pending',
  'a failed generation leaves the analysis pending for the route to mark failed'
);

update public.analyses
set status = 'failed'
where id = '11000000-0000-4000-8000-000000000001';

select lives_ok(
  $sql$
    do $block$
    declare
      v_index integer;
      v_analysis_id uuid;
    begin
      for v_index in 1..5 loop
        v_analysis_id := (
          '11000000-0000-4000-8000-' || lpad((v_index + 1)::text, 12, '0')
        )::uuid;
        insert into public.analyses (
          id, user_id, selected_tone, relationship_stage, status, model
        ) values (
          v_analysis_id,
          '10000000-0000-4000-8000-000000000001',
          'warm',
          'new_match',
          'pending',
          'test/model'
        );
        perform public.complete_analysis(
          v_analysis_id,
          '10000000-0000-4000-8000-000000000001',
          'test/model',
          10,
          10,
          '[
            {"category":"safe","text":"Safe reply","why_it_works":"Steady"},
            {"category":"confident","text":"Confident reply","why_it_works":"Clear"},
            {"category":"playful","text":"Playful reply","why_it_works":"Light"}
          ]'::jsonb,
          0.001,
          null
        );
      end loop;
    end
    $block$;
  $sql$,
  'five successful free analyses complete through the atomic function'
);

select is(
  (
    select used
    from public.usage_periods
    where user_id = '10000000-0000-4000-8000-000000000001'
      and period_start = '1970-01-01 00:00:00+00'
  ),
  5,
  'five successful free analyses consume exactly five lifetime uses'
);

select is(
  (
    select count(*)
    from public.analyses
    where user_id = '10000000-0000-4000-8000-000000000001'
      and status = 'completed'
  ),
  5::bigint,
  'all five successful free analyses are completed'
);

select is(
  (
    select count(*)
    from public.replies r
    join public.analyses a on a.id = r.analysis_id
    where a.user_id = '10000000-0000-4000-8000-000000000001'
  ),
  15::bigint,
  'each successful free analysis persists exactly three replies'
);

insert into public.analyses (
  id, user_id, selected_tone, relationship_stage, status, model
)
values (
  '11000000-0000-4000-8000-000000000007',
  '10000000-0000-4000-8000-000000000001',
  'warm',
  'new_match',
  'pending',
  'test/model'
);

select throws_ok(
  $$
    select public.complete_analysis(
      '11000000-0000-4000-8000-000000000007',
      '10000000-0000-4000-8000-000000000001',
      'test/model',
      10,
      10,
      '[
        {"category":"safe","text":"Safe reply","why_it_works":"Steady"},
        {"category":"confident","text":"Confident reply","why_it_works":"Clear"},
        {"category":"playful","text":"Playful reply","why_it_works":"Light"}
      ]'::jsonb,
      0.001,
      null
    )
  $$,
  'P0001',
  'Analysis allowance exhausted',
  'the sixth successful-looking free analysis is rejected'
);

select is(
  (
    select used
    from public.usage_periods
    where user_id = '10000000-0000-4000-8000-000000000001'
      and period_start = '1970-01-01 00:00:00+00'
  ),
  5,
  'a rejected sixth free analysis cannot over-consume usage'
);

select is(
  (select status::text from public.analyses where id = '11000000-0000-4000-8000-000000000007'),
  'pending',
  'the rejected sixth analysis is not marked completed'
);

-- Exercise the paid monthly period at its full boundary, then advance the
-- Stripe period and prove the new period starts with an independent allowance.
insert into auth.users (id, email)
values ('20000000-0000-4000-8000-000000000001', 'paid-usage@milo.test');

insert into public.subscriptions (
  user_id,
  stripe_subscription_id,
  stripe_price_id,
  status,
  current_period_start,
  current_period_end
)
values (
  '20000000-0000-4000-8000-000000000001',
  'sub_paid_usage_test',
  'price_milo_test',
  'active',
  now() - interval '1 day',
  now() + interval '29 days'
);

select lives_ok(
  $sql$
    do $block$
    declare
      v_index integer;
      v_analysis_id uuid;
    begin
      for v_index in 1..150 loop
        v_analysis_id := (
          '21000000-0000-4000-8000-' || lpad(v_index::text, 12, '0')
        )::uuid;
        insert into public.analyses (
          id, user_id, selected_tone, relationship_stage, status, model
        ) values (
          v_analysis_id,
          '20000000-0000-4000-8000-000000000001',
          'confident',
          'dating',
          'pending',
          'test/model'
        );
        perform public.complete_analysis(
          v_analysis_id,
          '20000000-0000-4000-8000-000000000001',
          'test/model',
          10,
          10,
          '[
            {"category":"safe","text":"Safe reply","why_it_works":"Steady"},
            {"category":"confident","text":"Confident reply","why_it_works":"Clear"},
            {"category":"playful","text":"Playful reply","why_it_works":"Light"}
          ]'::jsonb,
          0.001,
          'price_milo_test'
        );
      end loop;
    end
    $block$;
  $sql$,
  '150 successful paid analyses complete in one billing period'
);

select is(
  (
    select used
    from public.usage_periods
    where user_id = '20000000-0000-4000-8000-000000000001'
      and period_start = now() - interval '1 day'
  ),
  150,
  'the paid period records all 150 successful analyses'
);

select is(
  (
    select count(*)
    from public.analyses
    where user_id = '20000000-0000-4000-8000-000000000001'
      and status = 'completed'
  ),
  150::bigint,
  'all 150 allowed paid analyses are completed'
);

select is(
  (
    select count(*)
    from public.replies r
    join public.analyses a on a.id = r.analysis_id
    where a.user_id = '20000000-0000-4000-8000-000000000001'
  ),
  450::bigint,
  'the paid analyses persist exactly 450 categorized replies'
);

insert into public.analyses (
  id, user_id, selected_tone, relationship_stage, status, model
)
values (
  '21000000-0000-4000-8000-000000000151',
  '20000000-0000-4000-8000-000000000001',
  'confident',
  'dating',
  'pending',
  'test/model'
);

select throws_ok(
  $$
    select public.complete_analysis(
      '21000000-0000-4000-8000-000000000151',
      '20000000-0000-4000-8000-000000000001',
      'test/model',
      10,
      10,
      '[
        {"category":"safe","text":"Safe reply","why_it_works":"Steady"},
        {"category":"confident","text":"Confident reply","why_it_works":"Clear"},
        {"category":"playful","text":"Playful reply","why_it_works":"Light"}
      ]'::jsonb,
      0.001,
      'price_milo_test'
    )
  $$,
  'P0001',
  'Analysis allowance exhausted',
  'the 151st paid analysis is rejected'
);

select is(
  (
    select used
    from public.usage_periods
    where user_id = '20000000-0000-4000-8000-000000000001'
      and period_start = now() - interval '1 day'
  ),
  150,
  'the rejected 151st paid analysis cannot over-consume usage'
);

select is(
  (select status::text from public.analyses where id = '21000000-0000-4000-8000-000000000151'),
  'pending',
  'the rejected 151st paid analysis is not marked completed'
);

update public.analyses
set status = 'failed'
where id = '21000000-0000-4000-8000-000000000151';

update public.subscriptions
set current_period_start = now() - interval '1 minute',
    current_period_end = now() + interval '30 days',
    updated_at = now()
where user_id = '20000000-0000-4000-8000-000000000001';

insert into public.analyses (
  id, user_id, selected_tone, relationship_stage, status, model
)
values (
  '21000000-0000-4000-8000-000000000152',
  '20000000-0000-4000-8000-000000000001',
  'confident',
  'dating',
  'pending',
  'test/model'
);

select lives_ok(
  $$
    select public.complete_analysis(
      '21000000-0000-4000-8000-000000000152',
      '20000000-0000-4000-8000-000000000001',
      'test/model',
      10,
      10,
      '[
        {"category":"safe","text":"Safe reply","why_it_works":"Steady"},
        {"category":"confident","text":"Confident reply","why_it_works":"Clear"},
        {"category":"playful","text":"Playful reply","why_it_works":"Light"}
      ]'::jsonb,
      0.001,
      'price_milo_test'
    )
  $$,
  'a successful analysis consumes the renewed paid period'
);

select is(
  (
    select used
    from public.usage_periods
    where user_id = '20000000-0000-4000-8000-000000000001'
      and period_start = now() - interval '1 day'
  ),
  150,
  'renewal leaves the exhausted prior paid period unchanged'
);

select is(
  (
    select used
    from public.usage_periods
    where user_id = '20000000-0000-4000-8000-000000000001'
      and period_start = now() - interval '1 minute'
  ),
  1,
  'renewal starts a distinct paid usage period at one use'
);

-- Populate two complete ownership graphs, authenticate as the first user,
-- and prove every user-readable table returns the owner's row while hiding
-- the other user's row. Running as `authenticated` ensures RLS is active.
insert into auth.users (id, email)
values
  ('30000000-0000-4000-8000-000000000001', 'rls-owner@milo.test'),
  ('30000000-0000-4000-8000-000000000002', 'rls-other@milo.test');

insert into public.subscriptions (
  id, user_id, stripe_subscription_id, stripe_price_id, status,
  current_period_start, current_period_end
)
values
  (
    '31000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'sub_rls_owner',
    'price_rls',
    'canceled',
    now() - interval '2 days',
    now() - interval '1 day'
  ),
  (
    '31000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    'sub_rls_other',
    'price_rls',
    'canceled',
    now() - interval '2 days',
    now() - interval '1 day'
  );

insert into public.analyses (
  id, user_id, selected_tone, relationship_stage, status, model
)
values
  (
    '32000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'warm', 'dating', 'completed', 'test/model'
  ),
  (
    '32000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    'warm', 'dating', 'completed', 'test/model'
  );

insert into public.replies (
  id, analysis_id, category, reply_text, explanation
)
values
  (
    '33000000-0000-4000-8000-000000000001',
    '32000000-0000-4000-8000-000000000001',
    'safe', 'Owner reply', 'Owner explanation'
  ),
  (
    '33000000-0000-4000-8000-000000000002',
    '32000000-0000-4000-8000-000000000002',
    'safe', 'Other reply', 'Other explanation'
  );

insert into public.feedback (reply_id, user_id, value)
values
  (
    '33000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'helpful'
  ),
  (
    '33000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    'not_helpful'
  );

insert into public.usage_periods (
  user_id, period_start, period_end, allowance, used
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '1970-01-01 00:00:00+00',
    '9999-12-31 23:59:59+00',
    5,
    1
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '1970-01-01 00:00:00+00',
    '9999-12-31 23:59:59+00',
    5,
    1
  );

set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is(
  (select count(*) from public.profiles where id = '30000000-0000-4000-8000-000000000001'),
  1::bigint,
  'an authenticated user can read their own profile'
);
select is(
  (select count(*) from public.profiles where id = '30000000-0000-4000-8000-000000000002'),
  0::bigint,
  'an authenticated user cannot read another profile'
);

select is(
  (select count(*) from public.subscriptions where user_id = '30000000-0000-4000-8000-000000000001'),
  1::bigint,
  'an authenticated user can read their own subscription'
);
select is(
  (select count(*) from public.subscriptions where user_id = '30000000-0000-4000-8000-000000000002'),
  0::bigint,
  'an authenticated user cannot read another subscription'
);

select is(
  (select count(*) from public.analyses where user_id = '30000000-0000-4000-8000-000000000001'),
  1::bigint,
  'an authenticated user can read their own analysis'
);
select is(
  (select count(*) from public.analyses where user_id = '30000000-0000-4000-8000-000000000002'),
  0::bigint,
  'an authenticated user cannot read another analysis'
);

select is(
  (select count(*) from public.replies where analysis_id = '32000000-0000-4000-8000-000000000001'),
  1::bigint,
  'an authenticated user can read replies for their own analysis'
);
select is(
  (select count(*) from public.replies where analysis_id = '32000000-0000-4000-8000-000000000002'),
  0::bigint,
  'an authenticated user cannot read replies for another analysis'
);

select is(
  (select count(*) from public.feedback where user_id = '30000000-0000-4000-8000-000000000001'),
  1::bigint,
  'an authenticated user can read their own feedback'
);
select is(
  (select count(*) from public.feedback where user_id = '30000000-0000-4000-8000-000000000002'),
  0::bigint,
  'an authenticated user cannot read another user''s feedback'
);

select is(
  (select count(*) from public.usage_periods where user_id = '30000000-0000-4000-8000-000000000001'),
  1::bigint,
  'an authenticated user can read their own usage period'
);
select is(
  (select count(*) from public.usage_periods where user_id = '30000000-0000-4000-8000-000000000002'),
  0::bigint,
  'an authenticated user cannot read another usage period'
);

reset role;

select * from finish();
rollback;
