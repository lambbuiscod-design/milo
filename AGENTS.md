# Milo monorepo instructions

- Treat `docs/SECURITY-INVARIANTS.md` as mandatory for every package.
- The existing Next.js application lives in `apps/web`; read `apps/web/AGENTS.md` before changing it.
- Desktop code belongs in `apps/desktop`, Windows-native code in `native/windows`, and reusable secret-free TypeScript in `packages`.
- Keep provider, Supabase service-role, Stripe and signing secrets out of shared packages and desktop artifacts.
- Use the pinned Node and .NET versions. Run commands from the repository root unless a package document says otherwise.
- Preserve the root Supabase migration history. Add migrations; never rename or rewrite applied migrations.
- Do not persist or log screenshots, conversation text, participant names, generated replies, clipboard content or authentication credentials.
- After each coherent implementation is verified, create a descriptive commit and push it to the current branch's configured upstream. Never commit secrets, local environment files, dependencies or generated release artifacts, and do not push a failing state unless the user explicitly requests a checkpoint.
