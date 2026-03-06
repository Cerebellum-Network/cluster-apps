# Implementation Plan: Customer Usage View

**Branch**: `001-customer-usage-view` | **Date**: 2026-03-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-customer-usage-view/spec.md`

## Summary

Add a Customer Usage page to the Developer Console that visualizes per-era usage metrics and charges from the VDR Service Customer API. The page contains an interactive line chart (recharts) with a metric selector and a paginated data table showing era-by-era usage with delta calculations. A global era range filter controls both views. Data is fetched once per range change; metric switching and pagination are instant client-side operations.

## Technical Context

**Language/Version**: TypeScript (ES2020 target, strict mode via root tsconfig)
**Primary Dependencies**: React, recharts (already in workspace), MobX + mobx-react-lite, @cere/cere-design-system, @cluster-apps/ui, axios
**Storage**: N/A — client-side only; all data sourced from VDR Service REST API
**Testing**: No test framework currently configured in the workspace
**Target Platform**: Web browser (Vite dev server, port 5173)
**Project Type**: Frontend web application (extending existing SPA)
**Performance Goals**: Initial page load with data <3s, metric switch <100ms, pagination <100ms
**Constraints**: ~500 era records max per API call; client-side pagination only; no server-side pagination
**Scale/Scope**: Single new page addition to existing Developer Console; 1 new MobX store, 1 new API client, ~8 new components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Design System Conformity | ✅ PASS | Uses @cere/cere-design-system and @cluster-apps/ui for all UI; recharts for charts (per constitution mandate) |
| II | Pattern Consistency | ✅ PASS | New `CustomerUsageStore` follows `makeAutoObservable` class pattern (matches ActivityStore, PaymentsHistoryStore). New `VdrServiceApi` in packages/api follows DacApi pattern. New application registered in applications/index.ts |
| III | Data Precision & Formatting | ✅ PASS | Decimal strings (`charge`, `cpu_units`, `gpu_units`, `ram_units`) parsed with `parseFloat` at display time only; `Intl.NumberFormat` for all user-facing numbers; delta formula clearly defined with edge cases |
| IV | Resilient Data Layer | ✅ PASS | VdrServiceApi implements axios with error handling; store exposes `isLoading`, `error` observables; exponential backoff retry (max 3); 404→empty; metric changes use cached data |
| V | Accessibility & Responsiveness | ✅ PASS | Recharts supports keyboard-navigable tooltips; table uses WAI-ARIA patterns from design system; responsive container widths; skeleton loading states |

## Project Structure

### Documentation (this feature)

```text
specs/001-customer-usage-view/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── vdr-service-customer-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code

```text
packages/api/src/
├── VdrServiceApi/
│   ├── VdrServiceApi.ts       # API client for VDR Service
│   ├── types.ts               # CustomerEraRecord, MetricKey, EraRangePreset
│   └── index.ts               # Re-exports
├── constants.ts               # + VITE_VDR_SERVICE_ENDPOINT
└── index.ts                   # + export VdrServiceApi

apps/developer-console/src/
├── applications/
│   ├── CustomerUsage/
│   │   ├── index.ts           # Application definition
│   │   └── CustomerUsage.tsx  # Root component
│   └── index.ts               # + customerUsage in array
├── stores/
│   ├── CustomerUsageStore/
│   │   ├── CustomerUsageStore.ts
│   │   └── index.ts
│   ├── AppStore/AppStore.ts   # + customerUsageStore instance
│   └── index.ts               # + export CustomerUsageStore
├── hooks/
│   ├── useCustomerUsageStore.ts
│   └── index.ts               # + export
├── components/
│   └── CustomerUsage/
│       ├── EraRangeSelector.tsx
│       ├── UsageChartCard.tsx
│       ├── MetricSelector.tsx
│       ├── PastErasCard.tsx
│       ├── PastErasTable.tsx
│       ├── Pagination.tsx
│       ├── EmptyState.tsx
│       └── ErrorBanner.tsx
└── utils/
    └── formatters.ts          # Intl.NumberFormat helpers
```

**Structure Decision**: Follows existing web application pattern — API client in shared `packages/api`, store + components + hooks in `apps/developer-console/src`. New page registered as an Application (matching ContentStorage, ContentDelivery, ActivityCapture pattern).

## Complexity Tracking

> No constitution violations — table intentionally left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
