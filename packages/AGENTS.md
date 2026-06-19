# Shared Packages — Agent Rules

Inherits all root `AGENTS.md` rules. This file covers shared workspace packages under `packages/`.

---

## Packages

| Package                        | Purpose                                                       |
| ------------------------------ | ------------------------------------------------------------- |
| `@yosemite-crew/auth`          | Shared auth helpers (config + Express middleware)             |
| `@yosemite-crew/database`      | Prisma schema, migrations, and database client ownership      |
| `@yosemite-crew/design-tokens` | Shared semantic design tokens — consumed by web and mobile    |
| `@yosemite-crew/fhir`          | FHIR R4 compatibility helpers and generated types             |
| `@yosemite-crew/fhirtypes`     | Generated FHIR R4 resource type definitions                   |
| `@yosemite-crew/lib`           | Shared errors, types, and reusable utilities                  |
| `@yosemite-crew/types`         | Shared TypeScript types used by frontend, backend, and mobile |

---

## Rules

- **Breaking changes are high-impact.** Changing or removing a type in `@yosemite-crew/types` affects all three apps simultaneously.
- Always run `npx tsc --noemit` in each consuming app after changing a shared type.
- FHIR types must conform to the FHIR R4 standard — do not invent custom health data shapes.
- Do not add app-specific logic to shared packages. Keep package responsibilities narrow and reusable.
- Export everything from `src/index.ts` — do not create new barrel files.
- Keep Prisma schema and migrations in `@yosemite-crew/database`.
