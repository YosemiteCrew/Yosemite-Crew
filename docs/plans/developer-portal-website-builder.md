# Developer Portal Phase 3b - Clinic Website Builder

## Document Status

- Owner: Developer portal workstream (epic #1582)
- Scope: New builder surface in `apps/frontend` (developer portal area), new backend routes, one new package for templates, a static-build worker
- Depends on: Phase 1 data plane ([data API contract](./developer-portal-data-api.md); API keys in PR #1696, built but unmerged as of 2026-07-07), Phase 2 AI editor + agent rules ([ADR 0005](../adr/0005-ai-editing-agent-security-model.md)), template model versioning already in the config engine
- Status: Proposed - this is a design for ratification, not an implementation log
- Related: Discussion #1259 (VibeSDK evaluation), issue #1404 (external integrator demand)

---

## 1. Goal

Give a clinic (or a developer acting for one) a public-facing marketing website - services, team, opening hours, directions, and working links into the clinic's existing public booking page - generated from a template, edited through the same AI-assisted loop as the rest of the portal, and hosted for them with zero infrastructure knowledge required.

The pitch to a clinic is one sentence: "describe your practice, get a website with online booking wired in, publish it under your own domain."

### Non-goals

- **Not a general-purpose site builder.** We are not competing with Wix or Framer. The template gallery is veterinary-specific and deliberately small. A user who wants a portfolio site or a web shop is out of scope.
- **Not a clinical surface.** The builder never reads or writes PIMS clinical data models (patients, appointments, medical records, FHIR resources). Its only contact with the PIMS is a URL: the clinic's public booking page. This keeps the entire surface outside the compliance boundary.
- **Not a replacement for the PIMS frontend.** `apps/frontend` remains the operational product. The builder produces marketing sites that link into it; it does not re-render any PIMS screen.

---

## 2. Relationship to VibeSDK

Discussion #1259 rejected VibeSDK as a platform foundation: it is coupled to Cloudflare (Workers, Durable Objects, Workers for Platforms) while our core runs on AWS and Supabase, and cloud neutrality is a stated goal for the self-hostable core. That decision stands. VibeSDK was explicitly retained as a UX and pattern reference for exactly one surface - this one - because a website builder is naturally isolated: it shares no data models with the PIMS and its output is static content.

### What we borrow (patterns)

- **The core loop: generate -> live preview -> iterate -> deploy.** The user describes what they want, sees a rendered site immediately, refines it conversationally, and publishes when happy. This loop is the whole product; everything else serves it.
- **Template-grounded generation.** VibeSDK's key reliability insight is that the AI never starts from a blank page - it selects and mutates a known-good template. We adopt this and tighten it further (section 3): our AI edits a structured config, not code.
- **Draft/live separation with instant preview.** Edits render in a preview sandbox; nothing is public until an explicit publish step.

### What we re-implement on our stack

| VibeSDK approach                            | Our approach                                                                                                                                                                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM calls via Cloudflare AI Gateway         | Developer-supplied (BYO) inference key under [ADR 0005](../adr/0005-ai-editing-agent-security-model.md)'s custody rules - client-side by default, server-side vault only as an explicit opt-in, no platform-held inference key (same conventions as the Phase 2 AI editor) |
| Apps run as Workers in sandboxed containers | Sites are statically built - no user code executes server-side at all, so no sandbox runtime is needed                                                                                                                                                                     |
| Deploy to Workers for Platforms             | Static export uploaded to object storage behind a CDN. Reference deployment: S3 + CloudFront. Self-hosted deployment: a directory served by nginx. The build worker writes to a storage interface, not to a vendor SDK                                                     |
| Durable Objects for session state           | Postgres via Prisma (Supabase), same as everything else                                                                                                                                                                                                                    |

The static-output decision is what makes the rest cheap: hosting is a file sync, rollback is repointing a prefix, and the security review surface is "can the template render unsafe HTML," not "can generated code escape a sandbox."

---

## 3. Architecture sketch

Five pieces, in data-flow order:

### 3.1 Template gallery

A small set of opinionated veterinary site templates (initially 3-5: e.g. single-vet practice, multi-location clinic, mobile/house-call vet) in a public package, tentatively `packages/site-templates`. Each template ships:

- Section components (hero, services grid, team, hours/location, testimonials, contact) with typed props.
- A **manifest** declaring which sections exist, which slots each exposes (text, image, list, booking-link), and constraints (e.g. hero requires a headline, max 12 services).
- Default content and imagery so a freshly provisioned site is complete, not skeletal.

Templates are code and go through normal PR review. Clinic users never edit them.

### 3.2 Site-config model

Everything user- or AI-editable lives in one JSON document validated against a schema derived from the template manifest:

- `template` + `templateVersion`
- `branding` - logo asset ref, colour palette (constrained to accessible pairs), font choice from an allowed list
- `pages[]` - ordered sections per page, each section = `{ type, slots }`
- `booking` - the wiring block: the clinic's public booking page URL (derived from its org, not free-typed) plus which CTAs point at it
- `seo` - title, description, social image

This mirrors the existing config-engine philosophy (Forms, Templates, ObservationTool): structured config over free-form artifacts.

### 3.3 AI editing

The Phase 2 AI editor is pointed at the site config, not at code. Tools exposed to the model (per ADR 0005 rules) are of the shape `get_site_config`, `update_section`, `set_branding`, `add_page` - every mutation is schema-validated before it lands. The model can therefore never produce an undeployable or script-injecting site: worst case is ugly, not broken or unsafe. Free-form code generation is explicitly rejected for this surface; if we ever want it, that is a new design doc.

Slot content that admits rich text is limited to a small sanitised markup subset rendered through the template components - no raw HTML passthrough.

### 3.4 Build and hosting

- Publishing enqueues a **static build job** (same queue infrastructure as existing backend workers): load config version, render template to static HTML/CSS/assets, upload to object storage under `sites/<siteId>/<deployId>/`, flip an alias/pointer to the new deploy. Rollback = flip the pointer back.
- Preview uses the same renderer against the draft config, served from a preview prefix behind portal auth (short-lived signed URLs), so preview and production cannot drift.

### 3.5 Addressing

- Default: a platform subdomain per site, `<slug>.sites.<platform-domain>`, wildcard DNS + wildcard cert, CDN routes on Host header.
- Custom domains: clinic CNAMEs to us; we verify via a DNS TXT challenge and provision a cert (ACM in the reference deployment; certbot notes for self-hosters). Custom domains can ship after subdomains - see open questions.

---

## 4. Data model sketch

Field lists only - Prisma modelling happens at implementation time, and versioning deliberately mirrors the existing template model's draft/publish pattern.

**DeveloperSite** (org-scoped, like DeveloperApiKey)

- id, organisationId, name, slug (unique, drives the subdomain)
- templateId, status (draft | live | suspended)
- customDomain (nullable), customDomainVerifiedAt (nullable)
- createdBy, createdAt, updatedAt

**SiteConfigVersion**

- id, siteId, version (monotonic per site)
- config (JSON, schema-validated on write)
- state (draft | published | archived) - one draft head and one published version per site at a time
- createdBy (user id, plus a flag or actor field for AI-authored revisions), createdAt, publishedAt (nullable)

**SiteDeploy**

- id, siteId, configVersionId
- status (queued | building | live | failed | rolled_back)
- storagePrefix, error (nullable)
- triggeredBy, startedAt, finishedAt

**SiteAsset** (uploaded logos/photos)

- id, siteId, kind, storageKey, contentType, byteSize, createdAt

No table in this surface references a clinical model. The only cross-boundary value is the booking page URL, resolved read-only from the org.

---

## 5. Dependencies and sequencing

This is **Phase 3b** and builds strictly after:

1. **Phase 1 data plane** - org-scoped auth and API-key/middleware conventions (PR #1696, pending merge; contract in [developer-portal-data-api.md](./developer-portal-data-api.md)) that builder routes reuse; usage metering if site builds/hosting are ever billed.
2. **Phase 2 AI editor and ADR 0005** - the agent loop, tool-authorisation rules, and BYO-key handling are built once in Phase 2; the builder registers its site-config tools with that machinery rather than growing its own.
3. **Template model versioning** - the draft/publish pattern SiteConfigVersion mirrors already exists in the config engine; we copy its shape, not reinvent it.

The template package and static renderer have no dependencies and can be prototyped early, but nothing user-facing ships before Phase 2 lands.

---

## 6. Security and isolation posture

Summarising why this surface is safe to build as an appendage rather than a new trust domain:

- **No server-side execution of user-influenced code.** Output is static files; the build worker runs only reviewed template code against validated JSON.
- **No clinical data access.** Builder routes require portal auth and org scoping but touch only the tables in section 4. The booking URL is resolved server-side from the org record, never accepted as free input, so a site cannot be pointed at a phishing booking page through the config.
- **Injection surface is the slot renderer.** All slot content is escaped or run through the sanitised markup subset; templates never interpolate config values into script or style contexts. This is the one invariant template PRs must be reviewed against.
- **AI blast radius is one draft config version.** Agent tools mutate the draft only; publish is a separate human action, consistent with ADR 0005's human-in-the-loop rule for externally visible effects.

---

## 7. Open questions for the reviewer

1. **Domain/DNS UX.** Ship subdomains-only first and defer custom domains (with their verification and cert-provisioning UX) to a follow-up? Or is a custom domain table-stakes for a clinic to take this seriously at launch?
2. **Custom code escape hatch.** Do we ever allow a raw HTML/CSS block or custom section for power users? Current design says no (it reopens the sandboxing and safety questions we designed away). If a demand signal appears, the proposed answer is "contribute a template or section via PR," keeping custom code in reviewed template land. Confirm or challenge.
3. **Moderation of generated and published content.** Sites are published under our platform subdomain, which makes us the host of record. Do we need pre-publish checks (AI or rule-based) for prohibited content and trademark/impersonation issues, plus a report/takedown path and the `suspended` status wired to it, at launch - or is post-hoc takedown enough for the initial cohort of known clinics?
4. **Where the renderer lives.** Proposed: a plain React-to-static build in the worker, independent of the Next.js app, so self-hosters do not need the whole frontend toolchain to build sites. Acceptable, or should we reuse the `apps/frontend` stack for component sharing despite the heavier coupling?
