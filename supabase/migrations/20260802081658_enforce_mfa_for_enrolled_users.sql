-- A user who opted into MFA expects a stolen AAL1 session to be unable to
-- read their Milo records through the Data API. These restrictive policies
-- compose with the existing ownership policies; service_role continues to
-- bypass RLS for trusted server operations.

create policy "MFA protects profile reads"
  on public.profiles
  as restrictive
  for select
  to authenticated
  using (
    array[coalesce((select auth.jwt()->>'aal'), 'aal1')] <@ (
      select case
        when count(id) > 0 then array['aal2']
        else array['aal1', 'aal2']
      end
      from auth.mfa_factors
      where user_id = (select auth.uid())
        and status = 'verified'
    )
  );

create policy "MFA protects subscription reads"
  on public.subscriptions
  as restrictive
  for select
  to authenticated
  using (
    array[coalesce((select auth.jwt()->>'aal'), 'aal1')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where user_id = (select auth.uid()) and status = 'verified'
    )
  );

create policy "MFA protects analysis reads"
  on public.analyses
  as restrictive
  for select
  to authenticated
  using (
    array[coalesce((select auth.jwt()->>'aal'), 'aal1')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where user_id = (select auth.uid()) and status = 'verified'
    )
  );

create policy "MFA protects reply reads"
  on public.replies
  as restrictive
  for select
  to authenticated
  using (
    array[coalesce((select auth.jwt()->>'aal'), 'aal1')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where user_id = (select auth.uid()) and status = 'verified'
    )
  );

create policy "MFA protects feedback reads"
  on public.feedback
  as restrictive
  for select
  to authenticated
  using (
    array[coalesce((select auth.jwt()->>'aal'), 'aal1')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where user_id = (select auth.uid()) and status = 'verified'
    )
  );

create policy "MFA protects usage reads"
  on public.usage_periods
  as restrictive
  for select
  to authenticated
  using (
    array[coalesce((select auth.jwt()->>'aal'), 'aal1')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where user_id = (select auth.uid()) and status = 'verified'
    )
  );
