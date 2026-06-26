# Postgres Migration Runbook

> Resolves finding `sqlite-still-provider`. This is the **one** Sprint-1B-R task that
> requires a credential the sandbox does not have (a hosted Postgres URL). Everything
> the finding warned about *in code* — the read-modify-write races on `client_context`
> and the `EXAMPLES` row — is already fixed and is provider-agnostic (see
> `src/lib/approval-actions.ts` and `src/trigger/mcf-build.ts`, both now transactional).

## Why dev still runs SQLite

The hosted preview VM has no Postgres server and no `pg` driver. Forcing
`provider = "postgresql"` would break the running preview and could not be verified
here. So dev/preview stays on SQLite (`DATABASE_URL=file:./dev.db`) and the cutover
below is performed once, against a real hosted database, before onboarding any
paying client. The application code does not change — only the datasource and the
migration baseline.

## Cutover steps (run once, in a real environment)

1. **Provision** a Postgres database (Neon or Supabase). Copy the pooled connection
   string into `DATABASE_URL` and the direct (non-pooled) string into `DIRECT_URL`.

2. **Flip the provider** in `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DIRECT_URL")
   }
   ```

3. **(Optional, Sprint 2+) restore semantic retrieval.** pgvector is explicitly
   descoped for Sprint 1. When example retrieval ships, enable the extension and add
   the embedding column back to `ClientContext`:
   ```prisma
   // embedding Unsupported("vector(1536)")?
   ```
   plus a migration that runs `CREATE EXTENSION IF NOT EXISTS vector;`.

4. **Generate the baseline migration** (there is intentionally no committed migration
   today — a SQLite-dialect migration would be wrong for Postgres):
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Deploy** in CI/production:
   ```bash
   npx prisma migrate deploy
   ```
   `dev.db` must not exist on the deploy path. Add `prisma/dev.db` to the deploy
   ignore list (already git-ignored).

6. **Verify concurrency** — the behaviour the finding demanded. Run two writers
   against the same client's context concurrently and confirm no lost update:
   ```bash
   # pseudocode: fire two simultaneous discovery-variant approvals for one client
   # and assert both appended to the EXAMPLES row (version incremented by 2).
   ```
   The EXAMPLES append and the MCF upserts are wrapped in interactive transactions,
   so the second writer serializes behind the first rather than clobbering it.

## Acceptance (finding `sqlite-still-provider`)

- [ ] `prisma migrate deploy` runs clean against hosted Postgres.
- [ ] `dev.db` is absent from the deploy artifact.
- [ ] Concurrent two-write test against `client_context` does not lose an update.
- [x] RMW races fixed in code (provider-agnostic) — done in this branch.
- [x] `ProcessedWebhookEvent` replaces the FK-violating `clientId:'system'` idempotency
      hack, so webhook idempotency survives the move to Postgres — done in this branch.
