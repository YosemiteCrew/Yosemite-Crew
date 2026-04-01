---
sidebar_position: 5
title: Validation Matrix
description: GxP-ready validation expectations for UI component classes.
---

# Validation Matrix

This document defines the engineering controls and evidence model for UI quality.
The intent is GxP-**ready** (risk-based, traceable, reproducible) — not a blanket certification claim.

---

## Evidence categories

| Category                    | Tool                              | Automation            |
| --------------------------- | --------------------------------- | --------------------- |
| Unit / integration tests    | Jest + React Testing Library      | ✅ CI                 |
| Component story coverage    | Storybook                         | ✅ Build verification |
| Accessibility checks        | Storybook `@storybook/addon-a11y` | ✅ Per-story          |
| Keyboard behavior           | Storybook interaction tests       | ✅ Per-story          |
| Visual regression           | Manual review (Storybook)         | 🔲 Planned            |
| Responsive review           | Storybook viewport presets        | Manual                |
| Manual validation checklist | GitHub PR checklist               | Manual                |

---

## Component class risk matrix

### 🔴 High risk — explicit validation checklist required

These component classes handle critical user actions. Each must have a manual validation checklist in the PR that ships or modifies them.

| Component class                         | Risk               | Checklist items                                                      |
| --------------------------------------- | ------------------ | -------------------------------------------------------------------- |
| Destructive confirmation dialogs        | Data loss          | Focus management, escape key, cancel/confirm labeling, loading state |
| File upload flows                       | Data integrity     | Error states, size limits, format validation, progress states        |
| Financial displays                      | Accuracy           | Number formatting, currency symbols, zero/null states                |
| Consent / signature surfaces            | Legal              | Clear labeling, audit trail, cannot be dismissed by accident         |
| Embedded iframe / PDF viewers           | Content integrity  | Loading states, error states, a11y labels                            |
| Data-heavy tables with critical actions | Accuracy + actions | Sorting, filtering, empty states, bulk action confirmation           |

### 🟡 Medium risk — story + a11y check required

| Component class            | Notes                                                |
| -------------------------- | ---------------------------------------------------- |
| Modal / dialog (general)   | Focus trap, escape, aria-labelledby, close button    |
| Form inputs                | Label association, error states, required indicators |
| Navigation components      | Keyboard accessibility, current page indication      |
| Search / filter components | Empty states, loading, no-results                    |
| Notification / toast       | Dismissibility, screen-reader announcement           |

### 🟢 Standard — story coverage sufficient

| Component class       | Notes                                                   |
| --------------------- | ------------------------------------------------------- |
| Display cards         | No interactive states beyond hover                      |
| Typography components | Token alignment only                                    |
| Decorative animations | Must respect `prefers-reduced-motion`                   |
| Badges / chips        | Accessible label where color is the only differentiator |

---

## Minimum test expectations per component

```
Approved primitive or overlay:
  ✅ Jest: renders without crashing
  ✅ Jest: key variants render correctly
  ✅ Jest: disabled/error state renders correctly
  ✅ Jest: callbacks fire on interaction
  ✅ Storybook: story for each variant and state
  ✅ Storybook: a11y addon passes with no violations
  ✅ Storybook: interaction story for keyboard usage (if interactive)

High-risk overlay (modal, upload, confirm):
  All of the above, plus:
  ✅ Jest: focus moves into dialog on open
  ✅ Jest: Escape key closes the dialog
  ✅ Jest: focus returns to trigger on close
  ✅ Manual checklist reviewed in PR
```

---

## Storybook interaction test expectations

Interactive components (Accordion, Modal, Dropdown, Search) must have interaction stories using `@storybook/test`:

```ts
play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: /toggle/i }));
  expect(canvas.getByRole('region')).toBeVisible();
};
```

Current interaction stories: **ModalBase** (focus trap, escape key, blocked close).

Planned: Accordion expand/collapse, Dropdown open/close, Search input/clear.

---

## CI gates (planned)

| Gate            | Command                                      | Trigger  |
| --------------- | -------------------------------------------- | -------- |
| Type check      | `npx tsc --noemit`                           | PR, push |
| Lint            | `pnpm --filter frontend run lint`            | PR, push |
| Unit tests      | `pnpm --filter frontend run test`            | PR, push |
| Storybook build | `pnpm --filter frontend run storybook:build` | PR       |

---

## Bootstrap removal progress

The following `react-bootstrap` consumers block full Bootstrap CSS removal from `layout.tsx`.
Each must be replaced before the global import is safe to remove.

| File                                      | Status               |
| ----------------------------------------- | -------------------- |
| `overlays/OtpModal/OtpModal.tsx`          | ⚠️ Pending migration |
| `overlays/Toast/Toast.tsx`                | ⚠️ Pending migration |
| `widgets/UploadImage/UploadImage.tsx`     | ⚠️ Pending migration |
| `widgets/DynamicSelect/DynamicSelect.tsx` | ⚠️ Pending migration |
| `inputs/FileInput/FileInput.tsx`          | ⚠️ Pending migration |
| `features/auth/SignIn.tsx`                | ⚠️ Pending migration |
| `features/auth/SignUp.tsx`                | ⚠️ Pending migration |
| `features/auth/ForgotPassword.tsx`        | ⚠️ Pending migration |
| `features/marketing/LandingPage.tsx`      | ⚠️ Pending migration |
