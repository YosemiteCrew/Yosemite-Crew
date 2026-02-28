<p align="center">
  <a href="https://yosemitecrew.com/">
    <img src="https://d2il6osz49gpup.cloudfront.net/YC.svg" width="150px" alt="Yosemite Crew Logo" />
  </a>
</p>

<h1 align="center">Yosemite Crew Web App</h1>

<div align="center">

[![Next.js 15.4.9](https://img.shields.io/badge/Next.js-15.4.9-black?logo=next.js)](https://nextjs.org/)
[![React 19.1.1](https://img.shields.io/badge/React-19.1.1-61DAFB?logo=react)](https://react.dev)
[![PNPM](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Contributing](https://img.shields.io/badge/Contribute-FF9800)](https://github.com/YosemiteCrew/Yosemite-Crew/blob/main/CONTRIBUTING.md)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=yosemitecrew_Yosemite-Crew_Frontend&metric=coverage)](https://sonarcloud.io/summary/new_code?id=yosemitecrew_Yosemite-Crew_Frontend)

</div>

<div align="center">
This directory contains the Next.js web app for Yosemite Crew. It powers the staff-facing PMS dashboard and operational workflows for veterinary teams.
</div>

## 🧭 Overview

The frontend is built on the Next.js App Router and organized around feature modules. Each feature owns its pages, local components, services, and types, while shared UI, hooks, and helpers live in central folders.

# 🔍 Code Quality (SonarCloud)

[![SonarQube Cloud](https://sonarcloud.io/images/project_badges/sonarcloud-light.svg)](https://sonarcloud.io/summary/new_code?id=yosemitecrew_Yosemite-Crew_Frontend)

| Quality Gate                                                                                                                                                                                                              | Coverage                                                                                                                                                                                                   | Bugs                                                                                                                                                                                               | Code Smells                                                                                                                                                                                                      | Reliability                                                                                                                                                                                                                    | Security                                                                                                                                                                                                                 | Maintainability                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=yosemitecrew_Yosemite-Crew_Frontend&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=yosemitecrew_Yosemite-Crew_Frontend) | [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=yosemitecrew_Yosemite-Crew_Frontend&metric=coverage)](https://sonarcloud.io/summary/new_code?id=yosemitecrew_Yosemite-Crew_Frontend) | [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=yosemitecrew_Yosemite-Crew_Frontend&metric=bugs)](https://sonarcloud.io/summary/new_code?id=yosemitecrew_Yosemite-Crew_Frontend) | [![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=yosemitecrew_Yosemite-Crew_Frontend&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=yosemitecrew_Yosemite-Crew_Frontend) | [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=yosemitecrew_Yosemite-Crew_Frontend&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=yosemitecrew_Yosemite-Crew_Frontend) | [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=yosemitecrew_Yosemite-Crew_Frontend&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=yosemitecrew_Yosemite-Crew_Frontend) | [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=yosemitecrew_Yosemite-Crew_Frontend&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=yosemitecrew_Yosemite-Crew_Frontend) |

## ✅ Prerequisites

- **Node.js**: `20` or higher
- **pnpm**: Installed globally
- **Backend API**: Running locally or available in a dev/staging environment

## 🛠️ Getting Started

### 1) Install monorepo dependencies

From the repo root:

```sh
pnpm install
```

### 2) Configure environment variables

```sh
cp apps/frontend/.env.example apps/frontend/.env
```

Required keys (see `.env.example`):

- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_COGNITO_USERPOOLID`
- `NEXT_PUBLIC_COGNITO_CLIENTID`
- `NEXT_PUBLIC_COGNITO_USERPOOLID_PROD`
- `NEXT_PUBLIC_COGNITO_CLIENTID_PROD`
- `NEXT_PUBLIC_STREAM_API_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SANDBOX_PUBLISH`
- `STRIPE_KEY`
- `SANDBOX_SECRET`
- `SANDBOX_PUBLISH`

Optional dev flags:

- `NEXT_PUBLIC_DISABLE_AUTH_GUARD` (dev only)
- `NEXT_PUBLIC_ORG_TYPE_OVERRIDE` (UI testing)

### 3) Run the app

```sh
pnpm dev
```

The app runs at `http://localhost:3000`.

## 🧪 Scripts

From `apps/frontend`:

| Command           | Description                 |
| ----------------- | --------------------------- |
| `pnpm dev`        | Start the dev server        |
| `pnpm build`      | Build for production        |
| `pnpm start`      | Start the production server |
| `pnpm lint`       | Run ESLint                  |
| `pnpm type-check` | Run TypeScript checks       |
| `pnpm test`       | Run Jest tests              |

## 🔑 Shared Dev Login

Use this account for testing on the deployed dev web app:

- URL: `https://dev.yosemitecrew.com/signin`
- Email: `test@yosemitecrew.com`
- Password: `Yosemitecrew@123`

## 🧱 Project Structure

```
src/app
  (routes)/        # App Router route groups
  config/          # App config + shared route/status config
  constants/       # App-wide constants
  features/        # Feature modules (pages/components/hooks/services/types)
  hooks/           # Shared hooks
  lib/             # Utilities + domain helpers
  services/        # API clients (axios + http wrapper)
  stores/          # Zustand state stores
  ui/              # Shared UI primitives, inputs, widgets, layouts
```

## 🧩 Feature Modules

Feature folders are the default unit of ownership. Each feature includes:

- `pages/` for feature screens used by routes
- `components/` for feature‑specific UI
- `services/` for API calls
- `hooks/` and `types/` scoped to the feature

## 🎨 UI System

Shared UI lives in `src/app/ui`:

- Primitives (buttons, accordion, layout scaffolding)
- Inputs (form controls, dropdowns, datepickers)
- Widgets (uploaders, labels, charts, tables)

## 🔐 Development Auth Override

To bypass auth guards locally:

1. Set `NEXT_PUBLIC_DISABLE_AUTH_GUARD=true` in `apps/frontend/.env`
2. Restart the dev server

This disables `ProtectedRoute` and `OrgGuard`. Keep it off in production.

## 🧪 Testing

We use Jest + Testing Library. Run:

```sh
pnpm test
```

## 🤝 Contributing

Contributions are welcome. Please read `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` before opening a pull request.

## 📚 Related Docs

- `Guides/frontend-production-plan.md`
- `apps/mobileAppYC/README.md`
