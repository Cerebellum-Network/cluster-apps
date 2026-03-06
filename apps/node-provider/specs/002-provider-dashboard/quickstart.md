# Quickstart: Node Provider Dashboard

**Branch**: `002-provider-dashboard` | **Date**: 2026-03-06

## Prerequisites

- Node.js 18+
- npm 9+
- Git

## Setup

```bash
git checkout 002-provider-dashboard
cd /path/to/cluster-apps
npm install
```

## Run the node-provider app

```bash
npm run dev -w apps/node-provider
```

The app starts at `http://localhost:5173` (default Vite port).

## Environment variables

Create or update `.env` in the repo root (or `apps/node-provider/.env`):

```env
VITE_VDR_SERVICE_ENDPOINT=https://vdr-service.example.com
```

This configures the VDR Service base URL used by `@cluster-apps/api`.

## Verify the Provider Dashboard

1. Open the app in a browser.
2. Log in with a provider wallet.
3. Navigate to **Provider Dashboard** in the sidebar.
4. Verify:
   - Area chart shows reward data by era.
   - Past Eras table lists eras with Reward ($) and Reward Δ (%).
   - Era range selector filters all sections.
   - Metric selector changes the chart without reloading.

## Run tests

```bash
npm test -w apps/node-provider
```

## Lint

```bash
npm run lint
```

## Build

```bash
npm run build -w apps/node-provider
```

## Project structure (this feature)

```
packages/api/src/VdrServiceApi/
├── VdrServiceApi.ts          # + getProviderEras(), getProviderEra()
└── types.ts                  # + ProviderEraRecord, ProviderMetricKey, etc.

apps/node-provider/src/
├── applications/
│   └── ProviderDashboard/
│       ├── index.tsx         # Application registration (rootPath, icon)
│       └── ProviderDashboard.tsx  # Page component
├── components/
│   └── ProviderDashboard/
│       ├── UsageChartCard.tsx
│       ├── PastErasCard.tsx
│       ├── PastErasTable.tsx
│       ├── EraRangeSelector.tsx
│       ├── MetricSelector.tsx
│       ├── Pagination.tsx
│       ├── EmptyState.tsx
│       └── ErrorBanner.tsx
├── stores/
│   └── ProviderUsageStore/
│       ├── index.ts
│       └── ProviderUsageStore.ts
├── hooks/
│   └── useProviderUsageStore.ts
└── utils/
    └── formatters.ts         # formatCurrency, formatDecimal, etc.
```
