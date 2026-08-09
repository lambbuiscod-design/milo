-- Optional context is sent to the model only for the active request. Keeping
-- the nullable schema field preserves migration compatibility while this
-- constraint prevents accidental retention of conversation-like text.

alter table public.analyses
  add constraint analyses_optional_context_is_ephemeral
  check (optional_context is null);

comment on column public.analyses.optional_context is
  'Reserved for schema compatibility. Milo must keep this null and process optional context in request memory only.';
