# Mobile App Patterns — Yosemite Crew

## Description

Use this skill when working on apps/mobileAppYC. Covers React Native architecture, navigation, Redux state management, and mobile-specific conventions.

TRIGGER: any task in apps/mobileAppYC — screens, components, navigation, state, or native integrations.

---

## Architecture

```
apps/mobileAppYC/
  src/
    screens/        ← Full-screen views
    components/     ← Reusable UI components
    navigation/     ← React Navigation config
    store/          ← Redux Toolkit slices
    services/       ← API calls (axios)
    hooks/          ← Custom React hooks
    utils/          ← Pure utility functions
    i18n/           ← Translation files (i18next)
    assets/         ← Images, fonts
```

---

## State Management

**Redux Toolkit** (not Zustand — that's frontend only). Redux Persist is enabled.

```ts
// Define a slice
import { createSlice } from '@reduxjs/toolkit';

const appointmentSlice = createSlice({
  name: 'appointments',
  initialState,
  reducers: { ... },
});
```

Never mix Redux and local `useState` for the same piece of data. Local state is for ephemeral UI state (modal open, input focus). Shared/persisted state goes in Redux.

---

## Navigation

**React Navigation 7** with bottom tabs + native stack + drawer.

```ts
// Type your navigation params
type RootStackParamList = {
  Home: undefined;
  AppointmentDetail: { appointmentId: string };
};
```

Never navigate with bare strings — always use typed route names.

---

## Forms

**react-hook-form + Yup** for all forms.

```tsx
const schema = yup.object({ name: yup.string().required() });
const { control, handleSubmit } = useForm({ resolver: yupResolver(schema) });
```

---

## Internationalisation

All user-visible strings must go through **i18next**.

```tsx
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
<Text>{t('appointments.title')}</Text>;
```

Never hardcode English strings in components.

---

## Authentication

AWS Amplify Auth is the mobile auth provider. Firebase handles push notifications and supplementary auth flows. Never bypass Amplify for core auth.

---

## Payments

`@stripe/stripe-react-native` — use the SDK's pre-built UI sheets where possible. Never build custom card input from scratch.

---

## Testing

- **Jest 29** + Testing Library for React Native.
- **Detox** for E2E (run separately, not part of standard CI).
- Target tests: `pnpm --filter mobileAppYC run test -- --testPathPattern="path/to/file"`
- Never run the full suite without `--testPathPattern`.

---

## Gotchas

- `react-native-permissions` requires explicit permission requests before accessing camera, location, contacts — never assume granted.
- `react-native-fs` paths differ between iOS and Android — use `RNFS.DocumentDirectoryPath` not hardcoded paths.
- Redux Persist can cause stale state after schema changes — bump the persist version key when changing slice shape.
- `@gorhom/bottom-sheet` requires `GestureHandlerRootView` at app root — it's already there, don't remove it.
- Reactotron is dev-only — guard with `__DEV__` checks.
- i18n resource files are in `src/i18n/` — add new keys there before using `t()`.
