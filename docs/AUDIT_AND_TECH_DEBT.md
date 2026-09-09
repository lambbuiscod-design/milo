# Milo V2 Architecture Audit & Technical Blueprint

See the full architectural audit document at [`milo_v2_architecture_audit.md`](./milo_v2_architecture_audit.md).

## Quick Summary
- **Monorepo Architecture**: Electron 43 + React 19 (`apps/desktop`), Next.js 16 (`apps/web`), shared contracts and security packages (`packages/*`), and .NET 9 native helper (`native/*`).
- **Security & Privacy Boundary**: Process isolation, strict preload allowlist (18 methods), ephemeral memory-only frame buffers (zero-knowledge privacy).
- **SQLite Progression Integration**: Connection singleton in `apps/desktop/src/main/db.ts` (`better-sqlite3`), WAL mode, foreign keys, versioned progression tables (XP, level, streaks, achievements, stats, inventory).
- **Character Engine Blueprint**: Composable SVG layers (anatomy, expression, accessory slot, animation), decoupling operational state from emotional mood.
- **Design System**: Global tokens (`--bg-primary: #10131F`, `--milo-coral: #FF8066`), typography scale (H1 30px, H2 22px, Body 15px), and non-nested UI primitives (`Button`, `Card`, `Container`, `Stack`, `SectionGroup`).
