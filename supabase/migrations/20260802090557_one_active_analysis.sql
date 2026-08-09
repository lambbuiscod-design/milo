-- Prevent concurrent requests from spending model credits after the same user
-- has only one allowance slot left. A crashed request is reclaimable after two
-- minutes; normal model calls are bounded to 45 seconds by the application.

with ranked_pending as (
  select
    id,
    row_number() over (partition by user_id order by created_at desc, id desc) as pending_rank
  from public.analyses
  where status = 'pending'
)
update public.analyses
set status = 'failed'
from ranked_pending
where public.analyses.id = ranked_pending.id
  and ranked_pending.pending_rank > 1;

update public.analyses
set status = 'failed'
where status = 'pending'
  and created_at < now() - interval '2 minutes';

create unique index analyses_one_pending_per_user_idx
  on public.analyses (user_id)
  where status = 'pending';
