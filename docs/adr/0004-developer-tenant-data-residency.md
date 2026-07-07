# 0004. Single declared region for developer tenants, with a region field for later

**Status:** Proposed
**Date:** 2026-07-07

## Context

The developer platform epic (#1582) lets external developers sign up and get their own provisioned PIMS tenant. The multitenancy primitive already exists: `packages/database/src/tenant.ts` implements schema-per-tenant (`tenant_<key>` schemas plus a `public` control plane with per-tenant client caching), though nothing calls it yet. (The v1 [Developer Data API](../plans/developer-portal-data-api.md) explicitly does not depend on this machinery; it scopes by `organisationId` rows.) Phase 0 of the epic wires developer signup to tenant provisioning, which means developer-created tenants will start holding real veterinary and pet-owner personal data - including data about EU residents, which brings GDPR into scope.

Today all hosted data lives in a single Supabase project in a single region. The epic explicitly lists "EU/GDPR data residency for developer-created tenants (Supabase region)" as an open decision, so provisioning cannot ship until this is settled one way or the other.

Constraints that shaped the options:

- GDPR does not mandate EU-only storage; cross-border transfers are lawful under an adequacy decision or Standard Contractual Clauses. But some EU customers (and some veterinary regulators) contractually require in-region hosting regardless, and that demand cannot be met with a single non-configurable region.
- The project is open source with a cloud-neutral goal. Self-hosters already exist, and a self-hosted deployment runs wherever the operator puts it - so residency must be solvable by construction for self-hosters, independent of what the hosted platform offers.
- Running one Supabase project per region multiplies operational surface: Prisma Migrate must be orchestrated per project, the per-tenant client cache in `tenant.ts` assumes a single database URL, and backups, monitoring, and incident response all fan out. There is no tenant-relocation tooling.
- There is real external demand for the developer platform (issue #1404), but no developer has yet asked for in-region hosting - the demand signal is for API access, not residency.
- Developer identity data (the SuperTokens core introduced by ADR-0003 via PR #1763, unmerged as of this ADR's date) has the same residency question as tenant data and should follow the same posture rather than getting a separate answer.

## Decision

v1 hosts all developer-provisioned tenants in a single declared region - the region of the existing Supabase project - and makes that posture explicit rather than implicit:

- `registerTenant()` in `packages/database/src/tenant.ts` records a `region` field on the tenant's control-plane row at provision time. Every tenant gets the same value today; the point is that multi-region becomes an additive change (a new value plus routing) instead of a backfill of unknowns.
- The developer Terms of Service and data-processing terms must name the hosted region and state the controller/processor split: the platform is the processor; the developer (and the clinic whose data they hold) is the controller responsible for the lawful basis of processing and for deciding whether single-region hosting satisfies their obligations.
- Self-hosting is the documented residency escape hatch: a developer who needs in-region storage before the hosted platform offers it deploys the stack in their region of choice.
- Region-per-tenant hosting (multiple Supabase projects keyed by the `region` field) is deferred to a future ADR, triggered by the first paying EU developer who contractually requires in-region hosting.

## Consequences

**Good:**

- Phase 0 tenant provisioning is unblocked without taking on multi-project database operations, per-region migration orchestration, or tenant-relocation tooling.
- The `region` field turns the eventual multi-region rollout into routing work rather than data archaeology - no tenant ever exists without a recorded region.
- The compliance posture is honest and contractual (region named in ToS, controller/processor roles assigned) instead of implied by infrastructure defaults.
- Self-hosters are unaffected: residency for them is already solved by where they deploy, and this ADR does not couple the codebase to any region.
- Auth data residency stays consistent: the SuperTokens deployment (ADR-0003, PR #1763) sits in the same declared region as tenant data, so there is one answer to "where does my data live", not two.

**Bad / accepted trade-offs:**

- EU developers whose regulators or clients require in-region storage cannot be served by the hosted platform in v1. Their only options are self-hosting or waiting, and some will walk away.
- The `region` field is dead weight until multi-region ships: a column with one constant value that no code branches on, at risk of being ignored or drifting out of habit before it is ever read.
- If the declared region is outside the EU, serving EU data controllers depends on a valid transfer mechanism (SCCs or equivalent) in the developer terms - legal work that becomes a hard launch dependency for developer signups, not just an engineering task.
- Deferral means the first in-region demand triggers a project (new Supabase project, routing, migration tooling, possibly moving an existing tenant), not a configuration change. The trigger is defined, but the lead time is not zero.

## Alternatives considered

- **Region-per-tenant now** (multiple Supabase projects keyed by region, chosen at signup): rejected. It multiplies every operational concern - Prisma Migrate runs, backups, monitoring, connection routing through a client cache built for one database URL - and requires tenant-relocation tooling that does not exist, all to serve demand that has not materialised. Issue #1404's integrator asked for programmatic auth, not residency. Building this speculatively contradicts the epic's phased approach.
- **EU-only default region for everyone**: considered, partially adopted in spirit. An EU region satisfies the strictest plausible residency demand and non-EU customers rarely require residency in the other direction, so it is the natural first choice when the primary region is ever picked fresh. Rejected as a v1 action because it would mean relocating the existing live Supabase project - a full-database migration with downtime risk for current clinic data - to solve a problem no current customer has. The preference survives as guidance: if multi-region ships, an EU region is the first addition; if the platform ever relocates wholesale, EU is the default destination.
- **Do nothing** (provision tenants, stay silent on residency): rejected. The epic names residency an open blocker for developer-created tenants, tenants provisioned without a recorded region turn future multi-region into a backfill problem, and terms that are silent on storage location leave both the platform and its developers exposed the first time a controller asks where their data is.
