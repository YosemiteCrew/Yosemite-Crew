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
This directory contains the **Next.js** web application for the Yosemite Crew veterinary practice management system. It powers the staff-facing PMS dashboard and operational workflows.
</div>

## 🧭 Overview

The web app is built with the Next.js App Router and is organized into feature modules, shared components, and services that connect to the Yosemite Crew backend.

## ✅ Prerequisites

- **Node.js**: Version `20` or higher.
- **pnpm**: Ensure you have `pnpm` installed globally.
- **Backend API**: The web app expects a running backend (local or deployed).

## 🛠️ Getting Started

### 1) Install monorepo dependencies

From the root of the repo:

```sh
pnpm install
```

### 2) Configure environment variables

Copy the example file and update the values for your environment:

```sh
cp apps/frontend/.env.example apps/frontend/.env
```

Required keys (see `.env.example`):
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_COGNITO_USERPOOLID`
- `NEXT_PUBLIC_COGNITO_CLIENTID`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_STREAM_API_KEY`

Optional developer flags:
- `NEXT_PUBLIC_DISABLE_AUTH_GUARD` (development only)
- `NEXT_PUBLIC_ORG_TYPE_OVERRIDE` (testing UI flows)

### 3) Run the app

From this directory (`apps/frontend`):

```sh
pnpm dev
```

The app runs at `http://localhost:3000` by default.

## 🧪 Scripts

From `apps/frontend`:

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the local dev server |
| `pnpm build` | Build for production |
| `pnpm start` | Start the production server |
| `pnpm lint` | Run ESLint |
| `pnpm type-check` | Run TypeScript type checks |
| `pnpm test` | Run Jest tests |

## 🧩 Project Structure

Key directories:

```
src/app
  (routes)/        # App Router route groups
  pages/           # Feature view components mounted by routes
  components/      # Shared UI components (legacy + common)
  services/        # API clients and service helpers
  stores/          # Zustand state stores
  hooks/           # Shared hooks
  utils/           # Utility helpers
  types/           # Feature data types
```

## 🔐 Development Auth Override

For local development and testing, you can bypass auth guards:

1. Open `apps/frontend/.env`
2. Set `NEXT_PUBLIC_DISABLE_AUTH_GUARD=true`
3. Restart the dev server

This disables `ProtectedRoute` and `OrgGuard`. **Do not enable this in production.**

## 🔑 Test Credentials (Dev)

Use these on the dev environment:

- **URL:** https://dev.yosemitecrew.com/signin
- **Email:** test@yosemitecrew.com
- **Password:** Yosemitecrew@123

## 🤝 Contributing

We welcome contributions! Please read `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` before opening a pull request.

## 📚 Related Docs

- `Guides/frontend-production-plan.md`
- `apps/mobileAppYC/README.md`

