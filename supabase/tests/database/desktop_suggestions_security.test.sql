begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.desktop_suggestions'::regclass),
  'desktop suggestion metadata has RLS enabled'
);

select ok(
  not has_table_privilege('anon', 'public.desktop_suggestions', 'select'),
  'anonymous clients cannot read desktop suggestion metadata'
);

select ok(
  not has_table_privilege('authenticated', 'public.desktop_suggestions', 'select'),
  'authenticated clients cannot read desktop suggestion metadata directly'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.reserve_desktop_suggestion(uuid,uuid,text,text,text,text)',
    'execute'
  ),
  'anonymous clients cannot reserve desktop suggestions'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.reserve_desktop_suggestion(uuid,uuid,text,text,text,text)',
    'execute'
  ),
  'authenticated clients cannot reserve desktop suggestions directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.reserve_desktop_suggestion(uuid,uuid,text,text,text,text)',
    'execute'
  ),
  'the service role can reserve desktop suggestions'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.complete_desktop_suggestion(uuid,uuid,text,integer,integer,numeric,text)',
    'execute'
  ),
  'the service role can complete desktop suggestions'
);

select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'desktop_suggestions'
      and column_name in ('conversation_text', 'transcript', 'reply_text', 'replies', 'screenshot')
  ),
  'desktop suggestion metadata has no transcript, screenshot, or reply columns'
);

select * from finish();
rollback;
