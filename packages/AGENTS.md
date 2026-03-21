# Shared Packages — Agent Rules

Inherits all root `AGENTS.md` rules. This file covers `packages/types`, `packages/fhirtypes`, and `packages/fhir`.

---

## Packages

| Package                    | Purpose                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `@yosemite-crew/types`     | Shared TypeScript types used by frontend, backend, and mobile      |
| `@yosemite-crew/fhirtypes` | FHIR (Fast Healthcare Interoperability Resources) type definitions |
| `@yosemite-crew/fhir`      | FHIR utility functions                                             |

---

## Rules

- **Breaking changes are high-impact.** Changing or removing a type in `@yosemite-crew/types` affects all three apps simultaneously.
- Always run `npx tsc --noemit` in each consuming app after changing a shared type.
- FHIR types must conform to the FHIR R4 standard — do not invent custom health data shapes.
- Do not add app-specific logic to shared packages. Types and utilities only.
- Export everything from `src/index.ts` — do not create new barrel files.
