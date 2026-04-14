---
sidebar_position: 1
title: UI System Overview
description: How the Yosemite Crew UI platform is structured, what it owns, and how to use it.
---

# UI System Overview

The Yosemite Crew UI platform is a production-grade, agent-friendly design system covering the web app (`apps/frontend`) and mobile app (`apps/mobileAppYC`).

---

## Architecture

```
packages/design-tokens/      ← Shared semantic token source of truth
  src/color.ts               ← Color palette + semantic aliases
  src/typography.ts          ← Type scale + role definitions
  src/spacing.ts             ← Spacing scale
  src/radius.ts              ← Border radius scale
  src/shadow.ts              ← Elevation/shadow scale
  src/motion.ts              ← Duration + easing tokens
  src/zindex.ts              ← Layering tokens
  src/web.ts                 ← CSS variable output for web
  src/mobile.ts              ← React Native theme output for mobile

apps/frontend/src/app/ui/    ← Web component library
  Button.tsx / Card.tsx /    ← Core primitives
  Text.tsx / Badge.tsx ...
  primitives/                ← Low-level building blocks
  inputs/                    ← Form controls
  overlays/                  ← Modals, toasts, loaders
  layout/                    ← Header, sidebar, guards
  cards/                     ← Card variants
  tables/                    ← Data tables
  widgets/                   ← Domain composites
  INVENTORY.md               ← Full component inventory with status labels

apps/mobileAppYC/src/theme/  ← Mobile theme API
  semanticTokens.ts          ← Semantic token mapping for mobile
  colors.ts / typography.ts  ← Platform-specific values
```

**Storybook** lives in `apps/frontend` and runs at port 6006:

```bash
pnpm --filter frontend run storybook
```

---

## Design decisions

| Decision                                | Rationale                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Shared tokens, separate implementations | Web and mobile share semantic meaning but not rendering. Liquid-glass stays mobile-only.                   |
| Storybook for web, Docusaurus for docs  | Storybook is the component workbench. Docusaurus is for architecture, governance, and contribution guides. |
| Satoshi-only web typography             | `--font-grotesk` aliases are fully removed. `--font-satoshi` is the single web font family.                |
| Bootstrap removal is phased             | Bootstrap CSS is loaded in `layout.tsx` until all 9 remaining `react-bootstrap` consumers are replaced.    |
| No shadcn / Radix / MUI                 | The design system is custom-built on Tailwind CSS 4. Do not import new component libraries.                |

---

## Quick reference

- Token source of truth: [`packages/design-tokens/src/`](https://github.com/YosemiteCrew/Yosemite-Crew/tree/dev/packages/design-tokens/src)
- Web globals: [`apps/frontend/src/app/globals.css`](https://github.com/YosemiteCrew/Yosemite-Crew/blob/dev/apps/frontend/src/app/globals.css)
- Web component inventory: [`apps/frontend/src/app/ui/INVENTORY.md`](https://github.com/YosemiteCrew/Yosemite-Crew/blob/dev/apps/frontend/src/app/ui/INVENTORY.md)
- Mobile semantic mapping: [`apps/mobileAppYC/src/theme/semanticTokens.ts`](https://github.com/YosemiteCrew/Yosemite-Crew/blob/dev/apps/mobileAppYC/src/theme/semanticTokens.ts)
