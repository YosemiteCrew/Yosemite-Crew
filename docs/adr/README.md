# Architecture Decision Records

An ADR captures a single architectural decision: the context that forced it, the decision itself, and the trade-offs accepted. It exists so a new contributor can understand _why_ the code looks the way it does without reverse-engineering it from git blame or asking in Discord.

## When to write one

Write an ADR when a decision is expensive to reverse, crosses app/package boundaries, or picks between two reasonable designs where the reasoning would otherwise be lost. Examples: choosing a datastore or migration strategy, a payment/settlement model, an auth or persistence trade-off, a public API contract shape.

Skip it for anything a code review can fully capture on its own — a new utility function, a bug fix, a routine dependency bump.

## Process

1. Copy [`template.md`](./template.md) to `NNNN-kebab-case-title.md`, where `NNNN` is the next number in sequence (see the index below). Numbers are never reused, even if a proposed ADR is rejected.
2. Open it as part of the PR that makes (or already made) the decision, or as a standalone docs PR for retroactive documentation.
3. Status starts at `Proposed`. Once the PR merges, update it to `Accepted`.
4. If a later decision replaces this one, mark the old ADR `Superseded by ADR-000X` and link forward; don't delete or rewrite history.

## Index

| #                                                            | Title                                                                     | Status                                                                 | Date       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------- |
| [0001](./0001-postgres-prisma-source-of-truth.md)            | Postgres + Prisma as the target source of truth                           | Accepted (migration complete - exit criteria met by #1819, 2026-07-18) | 2026-06-07 |
| [0002](./0002-stripe-direct-charges-merchant-of-record.md)   | Stripe Standard Connect with direct charges; clinic as merchant of record | Accepted                                                               | 2026-06-25 |
| [0003](./0003-provider-neutral-auth-boundary-supertokens.md) | Provider-neutral auth boundary with SuperTokens as the first adapter      | Accepted (implemented via PR #1763, merged 2026-07-16)                 | 2026-07-02 |
| [0005](./0005-ai-editing-agent-security-model.md)            | Security model for the AI editing agent in the developer portal           | Proposed (nothing implemented on `dev`; see the note in the ADR)       | 2026-07-07 |

0004 is deliberately unused. It was drafted as a developer-tenant data-residency
decision on the `feat/dev-portal-phase2-foundations` branch, but its Context asserts
that `packages/database/src/tenant.ts` implements a live schema-per-tenant primitive,
and that table was dropped in `20260609102059_catalog_module` on 2026-06-12, 25 days
before the draft was written. Rather than merge a public document asserting a deleted
capability, the number is left free for a residency ADR written against what the repo
actually has.

See also [SuperAdmin ADR-0001](https://github.com/YosemiteCrew/SuperAdmin/blob/main/docs/adr/0001-audit-log-on-supertokens-usermetadata.md) for the audit-log persistence decision in the SuperAdmin app (separate repo, separate ADR log — it documents SuperAdmin's own codebase).
