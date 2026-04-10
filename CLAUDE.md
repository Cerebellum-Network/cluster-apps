# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Use `nvm exec` to ensure the correct Node version is used.

```bash
# Install dependencies
nvm exec npm i

# Copy environment variables before first run
cp .env.dev .env

# Run an app in dev mode (replace developer-console with node-provider or global-registry as needed)
nvm exec npm run start -w apps/developer-console

# Build a single app for production
nvm exec npm run build -w apps/developer-console

# Type-check all workspaces
npm run check-types

# Type-check a single workspace
npm run check-types -w apps/developer-console

# Lint
npm run lint

# Lint with auto-fix
npm run lint:fix
```

There are no test commands — this repo has no test suite.

## Architecture

### Monorepo layout

```
apps/         Three standalone Vite+React apps (developer-console, node-provider, global-registry)
packages/     Shared libraries consumed by apps (no build step — apps import source directly)
  ui/         MUI-based component library, theming, shared hooks
  api/        API clients (IndexerApi, StatsApi, FaucetApi, ClusterManagementApi, etc.)
  reporting/  Sentry error boundary + Reporting singleton
  analytics/  GTM wrapper
  eslint-config/  Shared ESLint rules
```

Packages export from their `src/` directory — there is no build step for packages. TypeScript path alias `@cluster-apps/*` resolves to `./packages/*/src`.

Within each app, `~/` is an alias for that app's `src/` directory.

### State management (developer-console)

The app uses **MobX** throughout. The root `AppStore` owns all other stores and is injected via React Context:

```
AppStore
  ├── AccountStore   — wallet connection, blockchain, DDC client, account/balance/bucket data
  ├── OnboardingStore — multi-step onboarding flow orchestration
  ├── QuestsStore    — gamification/quest tracking
  ├── PaymentsHistoryStore
  └── ActivityStore
```

`AppStore` is instantiated once in the root component via `useState(() => new AppStore())` and provided via `AppStoreContext`.

### AccountStore resource pattern

`AccountStore` manages reactive data through lazy-loaded poll resources. The pattern is:

- `createPullResource(fn, options)` in `createPullResource.ts` — wraps a polling async function in a `mobx-utils` `fromResource`. It calls `fn()` on an interval and surfaces errors via `Reporting.error` (its own `.catch` handler).
- Individual resources (`createBalanceResource`, `createAccountResource`, etc.) in `resources.ts` call `createPullResource`. **Do not add try/catch inside these resource functions** — errors must propagate to `createPullResource`'s handler so they reach Sentry.
- Resources are instantiated in `AccountStore.bootstrap()` when the wallet connects and cleared in `cleanup()` on disconnect.

### Sub-applications (developer-console)

`apps/developer-console/src/applications/` defines three pluggable DDC use-case modules (ContentStorage, ContentDelivery, ActivityCapture). Each exports an `Application` object with metadata (title, description, icon, widget component). The registry at `applications/index.ts` collects them for the router.

### Environment variables

All env vars use the `VITE_` prefix. Copy `.env.dev` to `.env` for local development. Key categories: wallet/auth (`APP_ID`, `APP_ENV`), DDC network (`DDC_NETWORK`, `DDC_CLUSTER_ID`), API endpoints (`INDEXER_ENDPOINT`, `FAUCET_ENDPOINT`, etc.), observability (`SENTRY_DNS`, `GTM_ID`), and feature flags (`FEATURE_USER_ONBOARDING`).

### TypeScript

- Strict mode is on. `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch` are all enforced.
- `@typescript-eslint/no-explicit-any` is **disabled** — the ESLint config allows `any`, but prefer proper types when the information is available (e.g. use `UserInfo | undefined` instead of an inline object with `any` fields).
- Prettier config: single quotes, 120-char line width, trailing commas everywhere.
