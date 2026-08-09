-- RLS callers intentionally cannot SELECT from auth.mfa_factors. Expose only
-- the minimum current-user boolean through a locked SECURITY DEFINER helper.
-- It has no user-id parameter, so callers cannot probe another account.

create function private.user_has_verified_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.mfa_factors
    where user_id = (select auth.uid())
      and status = 'verified'
  );
$$;

revoke all on function private.user_has_verified_mfa()
  from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.user_has_verified_mfa()
  to authenticated;

alter policy "MFA protects profile reads"
  on public.profiles
  using (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt())->>'aal', 'aal1') = 'aal2'
  );

alter policy "MFA protects subscription reads"
  on public.subscriptions
  using (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt())->>'aal', 'aal1') = 'aal2'
  );

alter policy "MFA protects analysis reads"
  on public.analyses
  using (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt())->>'aal', 'aal1') = 'aal2'
  );

alter policy "MFA protects reply reads"
  on public.replies
  using (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt())->>'aal', 'aal1') = 'aal2'
  );

alter policy "MFA protects feedback reads"
  on public.feedback
  using (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt())->>'aal', 'aal1') = 'aal2'
  );

alter policy "MFA protects usage reads"
  on public.usage_periods
  using (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt())->>'aal', 'aal1') = 'aal2'
  );
