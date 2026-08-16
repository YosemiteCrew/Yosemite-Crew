# UI Tokens

Primary source of tokens is `src/app/globals.css` under the `@theme` block.
Shared semantic token definitions live in `packages/design-tokens/src/`.
For the shared UI overview see [`README.md`](./README.md); for the full component list and status labels see [`INVENTORY.md`](./INVENTORY.md).

## Typography

- Use `--font-satoshi` for body/UI typography. There is no `--font-grotesk` alias anymore.
- Use `--font-newsreader` (Newsreader) for display-serif page titles and marketing moments (`.text-page-title`, `.font-newsreader`).
- Do not add `--font-grotesk` or `--grotesk-font` back.
- Use the `.text-*` Tailwind utility classes (e.g. `.text-body-4`, `.text-heading-2`) for type variants.
- Or use the `<Text>` component with the `variant` prop for inline typography.

## Colors

Two layers, both live:

- **`@theme` (`--color-*`)** - what Tailwind utilities compile against, e.g. `text-blue-text`, `bg-card-hover`. Semantic aliases live under `--color-text-*`, `--color-surface-*`, `--color-border-*`, `--color-action-*`, `--color-status-*`, `--color-input-*`.
- **Warm-bone runtime (`--blue`, `--ink`, `--screen`, `--hairline`, ...)** - used by `var(--x)` and arbitrary values such as `text-[var(--ink-muted)]`. These outnumber `--color-*` in the app about 3:1.

Rules:

- Use whichever layer the surrounding code uses; neither is deprecated.
- **Where one concept has both spellings, alias - never hold a literal in both.** `--blue-text: var(--color-blue-text)`. Hand-maintaining both is how the utility form kept resolving to a sub-AA colour after the variable form was fixed.
- **A fill token is not a text token.** `--blue` is a fill and has no contrast duty of its own; `--blue-text` must clear 4.5:1 on the bone surfaces. Using a fill as text (or a text token as a fill) is the most common colour bug in this app.
- **A fill under white text has two duties**: 4.5:1 for the label, and 3:1 against its own surface, because a selected control may drop its border and let the fill alone carry the state. `--blue-strong` exists for this and is the only value that satisfies both in each theme.
- **Ink tokens are checked against `--band` (#e8e0d2), the darkest bone surface** - not `--screen`. The light ramp bottoms out at `--ink-faint` (#66635f, 4.56:1); `--ink-faint2` shares that value because the palette has no room for a second passing step below `--ink-muted` (5.31:1). Anything lighter is unreadable, and ~476 usages were sitting at 1.90-2.64:1 before this was enforced.
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
