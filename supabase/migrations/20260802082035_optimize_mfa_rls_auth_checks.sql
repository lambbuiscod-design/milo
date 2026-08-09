-- Wrap auth.jwt() itself in a scalar subquery so Postgres evaluates it once
-- per statement instead of once per row (Supabase advisor 0003).

alter policy "MFA protects profile reads"
  on public.profiles
  using (
    array[coalesce((select auth.jwt())->>'aal', 'aal1')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where user_id = (select auth.uid()) and status = 'verified'
    )
  );

alter policy "MFA protects subscription reads"
  on public.subscriptions
  using (
    array[coalesce((select auth.jwt())->>'aal', 'aal1')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where user_id = (select auth.uid()) and status = 'verified'
    )
  );

alter policy "MFA protects analysis reads"
  on public.analyses
  using (
    array[coalesce((select auth.jwt())->>'aal', 'aal1')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where user_id = (select auth.uid()) and status = 'verified'
    )
  );

alter policy "MFA protects reply reads"
  on public.replies
  using (
    array[coalesce((select auth.jwt())->>'aal', 'aal1')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where user_id = (select auth.uid()) and status = 'verified'
    )
  );

alter policy "MFA protects feedback reads"
  on public.feedback
  using (
    array[coalesce((select auth.jwt())->>'aal', 'aal1')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where user_id = (select auth.uid()) and status = 'verified'
    )
  );

alter policy "MFA protects usage reads"
  on public.usage_periods
  using (
    array[coalesce((select auth.jwt())->>'aal', 'aal1')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where user_id = (select auth.uid()) and status = 'verified'
    )
  );
