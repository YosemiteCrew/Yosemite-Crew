---
sidebar_position: 2
title: Design Tokens
description: How to read, use, and extend the shared semantic token package.
---

# Design Tokens

All design decisions live in `packages/design-tokens`. This package is the single source of truth for color, typography, spacing, radius, shadow, motion, and z-index.

---

## Token philosophy

Tokens describe **intent**, not raw values.

```ts
// ❌ Wrong — raw value, no semantic meaning
color: '#302f2e';

// ✅ Correct — semantic intent
color: token.color.text.primary;
```

Token names should be readable as sentences:

- `color.text.primary` → "the color of primary text"
- `color.action.danger.bg` → "the background color of a danger action"
- `radius.xl` → "extra-large border radius"

---

## Token categories

### Color tokens

```ts
import { color } from '@yosemite-crew/design-tokens';

color.text.primary; // #302f2e — primary text
color.text.secondary; // #595958
color.text.brand; // #247aed — brand blue text
color.text.error; // #ea3729

color.surface.card; // #ffffff — card background
color.surface.subtle; // #eaeaea — subtle surface
color.surface.brandLight; // #f2f8ff — light brand tint

color.border.default; // #eaeaea
color.border.active; // #247aed — focused input border

color.action.primary.bg; // #302f2e — primary button background
color.action.brand.bg; // #247aed — brand button background
color.action.danger.bg; // #ea3729 — danger button background

color.status.success.text; // #008f5d
color.status.warning.bg; // #fef3e9
```

### Typography tokens

```ts
import { typographyRole, fontSize, fontWeight } from '@yosemite-crew/design-tokens';

// Semantic role — describes where to use the type style
typographyRole['heading-1']; // 28px / medium / -0.035em letterSpacing
typographyRole['body-4']; // 16px / normal / relaxed line-height
typographyRole['label-1']; // 16px / medium / -0.02em / line-height: 1
typographyRole['caption-2']; // 12px / normal
```

On **web** these are consumed via Tailwind utility classes:

```html
<p class="text-body-4 text-text-primary">Body text</p>
<h1 class="text-heading-1 text-text-primary">Heading</h1>
```

Or via the `<Text>` component:

```tsx
<Text variant="body-4">Body text</Text>
<Text variant="heading-1">Heading</Text>
```

### Spacing tokens

```ts
import { spacing } from '@yosemite-crew/design-tokens';

spacing['4']; // 1rem / 16px
spacing['6']; // 1.5rem / 24px
spacing['8']; // 2rem / 32px
```

On web use Tailwind spacing utilities directly: `p-4`, `gap-6`, `px-8`.

### Radius tokens

```ts
import { radius, radiusRole } from '@yosemite-crew/design-tokens';

radiusRole.button; // 1.5rem (rounded-2xl — matches current primitives)
radiusRole.badge; // 9999px (pill shape)
radiusRole.card; // 1.5rem
```

### Shadow tokens

```ts
import { shadowRole } from '@yosemite-crew/design-tokens';

shadowRole.card; // 0 1px 3px rgba(0,0,0,0.1)
shadowRole.modal; // 0 0 12px rgba(0,0,0,0.18)
shadowRole.dropdown; // 0 4px 6px rgba(0,0,0,0.15)
```

### Motion tokens

```ts
import { duration, easing, motionRole } from '@yosemite-crew/design-tokens';

duration.fast; // 150ms
duration.normal; // 300ms

easing.easeInOut; // cubic-bezier(0.4, 0, 0.2, 1)
easing.spring; // cubic-bezier(0.34, 1.56, 0.64, 1)

motionRole.buttonHover; // { duration: 300, easing: easeInOut }
motionRole.modalOpen; // { duration: 300, easing: easeOut }
```

---

## Web consumption

`globals.css` under `@theme` is the canonical web token block. It maps token values to CSS custom properties. The names follow this pattern:

```
--color-text-primary         ← color.text.primary
--color-action-primary-bg    ← color.action.primary.bg
--color-border-active        ← color.border.active
--font-satoshi               ← platform font
--radius-xl                  ← radius.xl
--shadow-md                  ← shadow.md
```

These CSS vars are available as Tailwind theme values:

```html
<div class="text-text-primary border-border-active">...</div>
```

---

## Mobile consumption

```ts
import { mobileTheme } from '@yosemite-crew/design-tokens/mobile';
// or
import { semanticColorsLight } from '@/theme/semanticTokens';

// mobileTheme is a structured object covering colors, spacing, fontSize, radius, shadow, zIndex, duration
const styles = StyleSheet.create({
  container: {
    backgroundColor: mobileTheme.color.surfaceCard,
    padding: mobileTheme.spacing['4'],
    borderRadius: mobileTheme.radius.xl,
  },
});
```

Platform-specific values (liquid-glass, iOS shadow, SFProText) stay in the mobile theme files and are **not** in the shared token contract.

---

## Adding a new token

1. Identify which category the token belongs to (color, spacing, radius, etc.)
2. Edit the relevant file in `packages/design-tokens/src/`
3. The token must describe **intent**, not a raw value
4. Add the CSS var equivalent to `packages/design-tokens/src/web.ts`
5. Add the mobile equivalent to `packages/design-tokens/src/mobile.ts` if relevant
6. Do NOT add app-specific business logic to the token package
