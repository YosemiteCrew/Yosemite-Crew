# Developer Portal Phase 3a - Plugin Registry

## Document Status

- Owner: Developer portal workstream (epic #1582)
- Scope: New Prisma models in `packages/database`, new backend routes in `apps/backend` (publisher, registry, and admin-boundary surfaces), publisher UI in the `/developers` portal, install/browse UI in the clinic settings area of `apps/frontend`
- Depends on: Phase 1 data plane ([data API contract](./developer-portal-data-api.md); API keys in PR #1696, built but unmerged as of 2026-07-07), the config engine's existing versioned Forms/Templates machinery, [ADR 0005](../adr/0005-ai-editing-agent-security-model.md) (draft/promote gate)
- Related: closed issue #770 (SuperAdmin plugin review queue spec, Sept 2025), [website builder plan](./developer-portal-website-builder.md) (Phase 3b), [Tier 2 GitHub App plan](./developer-portal-tier2-github-app.md)
- Status: Proposed - this is a design for ratification, not an implementation log

---

## 1. Goal

Let a developer package the configuration they built in Tier 1 - forms, templates, observation tools, integration presets - as a versioned, reviewable **plugin**, publish it through a governed review process, and let any clinic install it in a few clicks. The registry turns one developer's config work into something every clinic on the platform can benefit from, without that clinic trusting arbitrary code.

The pitch to a developer: "the dental-charting form pack you built for one clinic can be in front of every clinic on the platform." The pitch to a clinic: "install a reviewed extension the way you install a phone app - see exactly what it asks for, and nothing goes live in your practice until you press publish."

### Non-goals

- **Not arbitrary code execution.** A v1 plugin is a manifest of config contributions, full stop. No server-side hooks, no bundled JavaScript, no webhooks fired on clinic events. This is the config-over-code Tier 1 decision applied to distribution: the platform executes only reviewed platform code against validated plugin JSON. Server-side code plugins are explicitly deferred, gated on three things none of which exist today: a sandboxing design (process/runtime isolation for untrusted code), per-plugin resource limits and metering, and security review capacity to audit submitted code rather than submitted JSON.
- **Not new integration providers.** `IntegrationProvider` is a code-level enum (`IDEXX`, `MERCK_MANUALS`); a plugin may ship configuration presets for providers that already exist but cannot add a provider. New providers are core code (Tier 2 territory).
- **Not the SuperAdmin review UI.** Issue #770 already specced that surface - submitted-plugins list, pending/approved/rejected filters, manifest + permissions + scan review, approve/reject with feedback, publish, suspend/unpublish, install analytics, categories and featured placement. SuperAdmin is a separate repo; this document defines only the API boundary it consumes (section 5), not its internals.
- **Not a paid marketplace in v1.** All plugins are free at launch; monetization is an open question (section 9).

---

## 2. What a plugin is

A plugin is a **versioned manifest**: a JSON document declaring identity, requested permissions, and config-surface contributions. The contributions are the same entity shapes the config engine already stores - a form contribution carries the same `schema` + `fields` payload as the `Form`/`FormField` models, a template contribution carries a `schemaSnapshot` like `TemplateVersion`, an observation tool contribution carries `fields` + `scoringRules` like `ObservationToolDefinition`.

### Manifest schema sketch

Validated with zod on submission; unknown keys rejected.

```json
{
  "id": "com.acme.dental-charting",
  "name": "Dental Charting Pack",
  "version": "1.2.0",
  "publisher": { "organisationId": "<developer org>", "name": "Acme Vet Tools" },
  "description": "Dental intake, charting template, and pain-score tool.",
  "category": "clinical-forms",
  "permissions": {
    "scopes": ["appointments:read", "patients:read"]
  },
  "contributes": {
    "forms": [
      {
        "key": "dental-intake",
        "name": "Dental Intake",
        "category": "intake",
        "schema": { "...": "Form.schema shape" },
        "fields": [{ "...": "FormField shapes" }]
      }
    ],
    "templates": [
      {
        "key": "dental-chart",
        "kind": "...",
        "name": "Dental Chart",
        "schemaSnapshot": { "...": "TemplateVersion.schemaSnapshot shape" }
      }
    ],
    "observationTools": [
      {
        "key": "dental-pain-score",
        "name": "Dental Pain Score",
        "category": "pain",
        "fields": { "...": "..." },
        "scoringRules": { "...": "..." }
      }
    ],
    "integrations": [
      { "provider": "IDEXX", "config": { "...": "preset for IntegrationAccount.config" } }
    ]
  },
  "compatibility": { "minPlatformVersion": "1.4.0" }
}
```

Rules the validator enforces:

- `permissions.scopes` must be a subset of the canonical scope list from the [data API contract](./developer-portal-data-api.md) section 4. `*` and `:write` scopes are rejected in v1 (a config-contribution plugin has no runtime that could use them; the field exists so the manifest shape survives into a future where plugins do).
- `integrations[].provider` must be an existing `IntegrationProvider` value, and `config` presets never contain credentials - `IntegrationAccount.credentials` remains something the clinic enters itself; a manifest carrying anything credential-shaped is rejected at submission.
- Rich-text content inside contributed schemas is limited to the same sanitised markup subset as the website builder's slots - no script-bearing strings, enforced by the automated scan (section 4), re-checked at materialisation.
- `version` is semver; a submitted version must be greater than the last approved version.

---

## 3. Architecture sketch

Four surfaces around one source of truth:

1. **Publisher surface** (`/developers` portal, session auth, management plane): create a plugin, upload/edit a manifest draft, submit a version for review, see review status and feedback, view install counts for their own plugins.
2. **Review boundary** (admin API, section 5): SuperAdmin drives the review lifecycle. All durable state lives in this repo's Postgres via Prisma - SuperAdmin has no database of its own, so the registry tables here are the system of record and SuperAdmin is a client.
3. **Registry surface** (clinic-facing, in `apps/frontend` settings, existing web session auth): browse approved plugins by category, featured shelf, plugin detail page showing the manifest's permission requests app-store style, install/uninstall/update.
4. **Materialiser** (backend service): on install, transforms the approved manifest's contributions into rows in the installing org - draft `Form`s (status `draft`) with their `FormField`s, draft `Template`s (status `DRAFT`) with a `TemplateVersion`, observation tool definitions - each tagged with provenance (the `PluginInstall` id in the entity's `meta`/`rules` JSON) so updates and uninstalls can find them.

The critical property, inherited from [ADR 0005](../adr/0005-ai-editing-agent-security-model.md): **installation only ever creates drafts.** A plugin's contributions land in the clinic org exactly as if a staff member had drafted them by hand, and go live only through the existing publish machinery behind an interactive human session. The registry adds zero new paths to production config; worst case for a malicious approved plugin is littering an org's draft space with junk the clinic then declines to publish.

One honest gap: `ObservationToolDefinition` currently has no organisation column - the model is global. Materialising observation tools therefore requires adding org scoping (nullable `organisationId`, null meaning platform-global) to that model first, or deferring observation-tool contributions to v1.1. Flagged as an open question (section 9).

---

## 4. Submission and review flow

```
developer portal          apps/backend                    SuperAdmin (separate repo)
     |                        |                                |
     |-- submit version ----->|  validate manifest (zod)       |
     |                        |  automated scan (content        |
     |                        |   sanitiser, scope allowlist,   |
     |                        |   credential-shape detector)    |
     |                        |  status: submitted -> in_review |
     |                        |<------ poll review queue -------|
     |                        |<------ approve / reject --------|
     |<-- status + feedback --|  approved: plugin published     |
     |                        |   to registry                   |
```

- Submission runs the automated checks synchronously; a manifest that fails validation or the scan never reaches the queue (the developer gets the errors immediately).
- Human review in SuperAdmin sees the manifest, the requested permissions, the automated scan result, and a rendered preview of contributed forms/templates. Approve publishes the version to the registry; reject attaches feedback text the developer sees in the portal.
- First approved version flips the `Plugin` to `published`; later versions go through the same queue but publish as updates (section 6).

## 5. The SuperAdmin API boundary

A small admin surface in `apps/backend`, mounted separately from both the management and data planes (e.g. `/v1/admin/plugins`), authenticated by a service credential supplied via env (exact mechanism at implementation time; env-absent means the routes 404, same dormant-until-configured convention as the Tier 2 GitHub App). It exposes exactly what issue #770's screens need:

| Endpoint                                               | Purpose                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------- |
| `GET /v1/admin/plugins?status=...`                     | Review queue and catalogue list, filterable by lifecycle status  |
| `GET /v1/admin/plugins/:id/versions/:versionId`        | Full manifest, requested permissions, automated scan result      |
| `POST .../versions/:versionId/approve`                 | Approve and publish; records reviewer actor id                   |
| `POST .../versions/:versionId/reject`                  | Reject with mandatory feedback text                              |
| `POST /v1/admin/plugins/:id/suspend` / `.../unsuspend` | Pull from registry / restore (section 7)                         |
| `PATCH /v1/admin/plugins/:id`                          | Category correction, `featured` flag                             |
| `GET /v1/admin/plugins/:id/installs`                   | Install analytics: counts, installs over time, active orgs count |

Reviewer identity comes from SuperAdmin (its own auth), passed as an actor id and stored on the version row; the registry does not verify SuperAdmin's internal permissions, only the service credential. Analytics responses are aggregate only - no clinic org names or ids cross the boundary.

## 6. Install, update, and uninstall

**Install:** clinic browses the registry, opens a plugin, sees name/publisher/description and the permission request list, confirms. Backend creates a `PluginInstall`, materialises the contributions as drafts (section 3), and records the created entity ids on the install row. The clinic reviews each draft and promotes it with the existing publish flow. `permissions.scopes` are recorded as granted but are inert in v1 (nothing executes); recording them now means a future runtime cannot silently inherit broader grants than the clinic saw at install time.

**Update:** when a new version of an installed plugin is approved, the install is flagged `update_available` and the clinic sees it in settings. Accepting the update materialises the new version's contributions as **new drafts** alongside whatever is currently published - never touching live config. The clinic diffs, then publishes. An installed plugin update is a new draft, never a silent production change; there is no auto-update in v1.

**Uninstall:** unpublished (still-draft) contributed entities are deleted. Entities the clinic already published stay - they are the org's operational config now, and clinical records (`FormSubmission`, `TemplateInstance` rows) reference them - but lose the update linkage and are marked as orphaned-from-plugin in their provenance tag.

## 7. Suspension and revocation

- **Plugin suspended** (SuperAdmin action, per issue #770): removed from registry browse and search, new installs and updates blocked, existing installs flagged `suspended` with a notice in clinic settings. Published clinic config is NOT unpublished or deleted - a clinic's live intake form must not vanish because its publisher misbehaved. The clinic decides what to do with the notice.
- **Version revoked for cause** (e.g. the scan or a report reveals unsafe content that review missed): same as suspension plus a stronger, explicit warning on affected installs identifying the contributed entities, so the clinic can review and unpublish them deliberately. The registry never reaches into an org's published config, even for revocation; it informs, the org acts.
- Publisher-initiated delisting behaves like suspension minus the warning framing: existing installs keep working, new installs stop.

## 8. Data model sketch

Field lists only - Prisma modelling at implementation time, following existing schema conventions (`organisationId` spelling, status enums, `@@unique` guards).

**Plugin** (owned by the publisher's developer org)

- id, publisherOrganisationId, slug (unique), name, description, category
- iconUrl (nullable), featured (boolean, admin-set)
- status (draft | published | suspended | delisted)
- publishedVersionId (nullable), createdBy, createdAt, updatedAt

**PluginVersion**

- id, pluginId, version (semver string; unique per plugin)
- manifest (JSON, validated on submit), requestedScopes (string[], denormalised for queue display)
- status (draft | submitted | in_review | approved | rejected | revoked)
- scanResult (JSON, nullable), reviewFeedback (nullable), reviewerActorId (nullable), reviewedAt (nullable)
- submittedAt (nullable), createdAt, updatedAt

**PluginInstall** (owned by the installing clinic org; unique per org + plugin)

- id, organisationId, pluginId, pluginVersionId (the installed version)
- status (installed | update_available | suspended | uninstalled)
- grantedScopes (string[], snapshot of what the org accepted)
- materialisedRefs (JSON: contribution key -> created entity type + id, for updates/uninstall)
- installedBy, installedAt, updatedAt

## 9. Dependencies and sequencing

1. **Phase 1 data plane and PR #1696** - the canonical scope taxonomy that `permissions.scopes` validates against, and the org-scoping and portal conventions every registry route reuses.
2. **Phase 0 developer tenancy/signup** - publishing is cross-org by definition (a developer org's manifest materialises into clinic orgs), so publisher identity requires developer accounts with their own organisation to exist first.
3. **Config engine as-is** - Forms/Templates versioning and publish flow are consumed unchanged; the only schema change this plan needs outside its own three models is the `ObservationToolDefinition` org-scoping fix.
4. **SuperAdmin review screens (issue #770)** - can be built against section 5 as soon as the admin routes exist; registry browse/install for clinics ships only after the review loop works end to end, so nothing unreviewed is ever installable.

## 10. Open questions for the reviewer

1. **Monetization and rev-share.** v1 is free-only. When paid plugins come, is it Stripe subscriptions on the platform account with publisher payouts (a marketplace, with the platform as merchant of record for plugin fees - note the tension with ADR 0002's clinic-is-MoR posture for clinical payments), or purely a listing fee? This shapes whether install analytics need billing-grade accuracy now.
2. **External code-scan tooling.** Issue #770 specced a code-scan step. For config-only manifests the scan is content sanitisation and schema linting we write ourselves; is that sufficient for v1, or should we contract an external scanning service now so the pipeline slot exists before code plugins ever land?
3. **Featured/curation policy.** Who decides featured placement and category taxonomy, and is it editorial (maintainer judgment) or metric-driven (installs, ratings)? Ratings/reviews by clinics are not in this design - confirm they can wait.
4. **Observation tool org scoping.** Add `organisationId` (nullable) to `ObservationToolDefinition` in this workstream, or ship v1 with forms + templates + integration presets only and defer observation tools? The migration is small but touches a shared clinical model.
5. **Update notification depth.** Is the in-app `update_available` flag enough, or do clinics need email/digest notification for plugin updates - especially security-motivated revocations (section 7), where waiting for someone to open settings may be too slow?
