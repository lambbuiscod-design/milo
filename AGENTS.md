# Milo monorepo instructions

- Treat `docs/SECURITY-INVARIANTS.md` as mandatory for every package.
- The existing Next.js application lives in `apps/web`; read `apps/web/AGENTS.md` before changing it.
- Desktop code belongs in `apps/desktop`, Windows-native code in `native/windows`, and reusable secret-free TypeScript in `packages`.
- Keep provider, Supabase service-role, Stripe and signing secrets out of shared packages and desktop artifacts.
- Use the pinned Node and .NET versions. Run commands from the repository root unless a package document says otherwise.
- Preserve the root Supabase migration history. Add migrations; never rename or rewrite applied migrations.
- Do not persist or log screenshots, conversation text, participant names, generated replies, clipboard content or authentication credentials.
