# UI Tokens

Primary source of tokens is `src/app/globals.css` under the `@theme` block.
Shared semantic token definitions live in `packages/design-tokens/src/`.

## Typography

- Use `--font-satoshi` for all web typography. There is no `--font-grotesk` alias anymore.
- The web app is **Satoshi-only**. Do not add `--font-grotesk` or `--grotesk-font` back.
- Use the `.text-*` Tailwind utility classes (e.g. `.text-body-4`, `.text-heading-2`) for type variants.
- Or use the `<Text>` component with the `variant` prop for inline typography.

## Colors

- Use `--color-*` tokens for all UI colors.
- Semantic aliases live under `--color-text-*`, `--color-surface-*`, `--color-border-*`, `--color-action-*`, `--color-status-*`, `--color-input-*`.
- Never hardcode hex values in components. Use a CSS variable or a Tailwind token class.

## Component status labels

Each shared component carries one of:

| Status         | Meaning                                               |
| -------------- | ----------------------------------------------------- |
| `Approved`     | Allowed for new development                           |
| `In migration` | Allowed with caution while replacement work completes |
| `Legacy`       | Existing use allowed, new use blocked                 |
| `Deprecated`   | Replacement required; removal planned                 |

A component is only `Approved` when it has: token alignment, stable API, tests, story coverage, a11y review, usage docs, and clear ownership.
