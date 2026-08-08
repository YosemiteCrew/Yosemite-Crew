# @yosemite-crew/database

Prisma schema, migrations, and the shared Postgres client. Prisma Migrate is the
source of truth for the schema (see
[ADR 0001](../../docs/adr/0001-postgres-prisma-source-of-truth.md)).

## Scripts

| Script            | Purpose                                                       |
| ----------------- | ------------------------------------------------------------- |
| `prisma:generate` | Regenerate the Prisma client. Safe to run anytime.            |
| `prisma:migrate`  | `migrate dev` - authoring migrations locally. Never in prod.  |
| `prisma:deploy`   | `migrate deploy` - apply pending migrations. See below first. |
| `prisma:studio`   | Browse the database.                                          |

## Baseline an existing database before the first `prisma:deploy`

`prisma migrate deploy` decides what to apply by reading the `_prisma_migrations`
table. **If that table is missing, Prisma treats every migration as unapplied and
replays the whole history from `20260403050659_yc_term_migration`.**

This matters because not every environment's schema was created by Prisma
Migrate - databases predating the Mongo-to-Postgres migration, restores from a
dump, and anything created with `prisma db push` all lack `_prisma_migrations`.
Replaying against a populated database is not a no-op:

- The first `CREATE TABLE` fails because the table already exists, aborting the
  deploy part-way and leaving the schema in a half-migrated state.
- `20260609102059_catalog_module` contains `DROP TABLE` statements (see below).
  A replay reaching it is destructive.

So, on any database that already has the schema but no `_prisma_migrations`,
baseline it once before the first deploy, marking each already-applied migration
as resolved:

```bash
cd packages/database

# Inspect first: an empty result means the DB is NOT baselined.
psql "$DATABASE_URL" -c 'SELECT migration_name FROM _prisma_migrations ORDER BY finished_at;'

# Mark every migration the database already reflects as applied.
for m in prisma/migrations/*/; do
  pnpm prisma migrate resolve --applied "$(basename "$m")" --schema prisma/schema.prisma
done

# Now safe: applies only genuinely-pending migrations.
pnpm run prisma:deploy
```

Only mark migrations the database actually reflects. If it is baselined only
part-way through the history, resolve up to that point and let `prisma:deploy`
apply the genuine remainder.

A brand-new empty database needs none of this - `prisma:deploy` builds it from
scratch correctly.

## Dropped scaffolding in `20260609102059_catalog_module`

That migration drops tables created weeks earlier by
`20260607120000_tenant_control_plane` and `20260507181639_supertoken_migration`:

| Dropped table                                                       | Status                                                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `Tenant`, `TenantMembership`, `Enterprise`, `EnterpriseMembership`  | Abandoned scaffolding. No model in `schema.prisma`, never recreated.              |
| `auth_accounts`, `auth_challenges`, `auth_factors`, `auth_sessions` | Abandoned scaffolding. No model in `schema.prisma`, never recreated.              |
| `auth_identities`                                                   | **Live.** Recreated by `20260703090000_supertokens_provider_and_auth_identities`. |

The drops are intentional and the migration is already applied everywhere, so it
must not be edited - rewriting an applied migration changes its checksum and
breaks `migrate deploy` on every database that has already run it.

One loose end: `src/tenant.ts` still issues raw SQL against `public."Tenant"`
(`findTenantByKey`, `registerTenant`), which no longer exists. Those helpers are
exported through `src/index.ts` and re-exported by
`apps/backend/src/config/prisma.ts`, but nothing calls them, so the breakage is
latent rather than live. They should be removed with the rest of the tenant
control-plane scaffolding rather than repaired.
