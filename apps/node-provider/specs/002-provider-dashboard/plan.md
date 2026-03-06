# Implementation Plan: Node Provider Dashboard

**Branch**: `002-provider-dashboard` | **Date**: 2026-03-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-provider-dashboard/spec.md`

## Summary

Add a Provider Dashboard to the `apps/node-provider` application that visualizes per-era usage contribution and computed rewards from the VDR Service Provider API. The dashboard mirrors the Customer Usage View in `apps/developer-console` but surfaces provider-specific data: rewards instead of charges. Implementation extends the shared `@cluster-apps/api` VDR client with provider methods and creates a new `ProviderUsageStore` plus UI components within the node-provider app.

## Technical Context

**Language/Version**: TypeScript (ES2020 target, strict mode)
**Primary Dependencies**: React ^18.3.1, MobX ^6.13.1, mobx-react-lite ^4.0.7, recharts ^2.15.3, axios ^1.7.2 (via @cluster-apps/api)
**Storage**: N/A (no persistence — data fetched from VDR Service API)
**Testing**: Vite test runner (if configured); manual verification via quickstart
**Target Platform**: Web browser (Vite dev server, production build)
**Project Type**: Web application (monorepo — `apps/node-provider` within `cluster-apps`)
**Performance Goals**: Chart metric switching <200ms; page load with data <3s; client-side pagination of ≤500 eras
**Constraints**: No server-side pagination; provider identity from wallet; decimal string fields
**Scale/Scope**: Single dashboard page, ~12 new files, ~1500 lines of new code

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Component Reuse First | PASS | Chart, table, pagination, error/empty states follow Customer View patterns. Cross-app boundary prevents direct import — components re-implemented with same interfaces (see research.md R-01). |
| II. Design System Compliance | PASS | All components use `@cluster-apps/ui` (MUI-based). Constitution references `@cere/cere-design-system` but that package is not installed in the monorepo — `@cluster-apps/ui` fulfills the same intent (see research.md R-07). |
| III. Type Safety & Null Handling | PASS | `ProviderEraRecord` interface mirrors API shape exactly. Decimal strings remain as `string` in model. Nullable fields handled gracefully. |
| IV. MobX Store Architecture | PASS | New `ProviderUsageStore` with observables, actions, and computed properties. Components consume via `useProviderUsageStore` hook. No fetched data in local React state. |
| V. Graceful Degradation | PASS | Loading (CircularProgress), error (ErrorBanner with retry), empty (EmptyState) states implemented. Exponential backoff (1s, 2s, 4s — max 3 attempts). |
| VI. API Contract Fidelity | PASS | Frontend interfaces in `@cluster-apps/api` types mirror API response. Transformations (reverse for chart, delta computation) happen in MobX computed properties only. |

## Project Structure

### Documentation (this feature)

```text
specs/002-provider-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output — 8 research decisions
├── data-model.md        # Phase 1 output — entity definitions
├── quickstart.md        # Phase 1 output — setup and verification
├── contracts/
│   └── vdr-provider-api.md  # Phase 1 output — API contract
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
packages/api/src/VdrServiceApi/
├── VdrServiceApi.ts          # MODIFY: + getProviderEras(), getProviderEra()
├── types.ts                  # MODIFY: + ProviderEraRecord, ProviderMetricKey, etc.
└── index.ts                  # MODIFY: + re-export new types

apps/node-provider/
├── package.json              # MODIFY: + recharts dependency
└── src/
    ├── applications/
    │   ├── index.ts                  # MODIFY: + ProviderDashboard app registration
    │   └── ProviderDashboard/
    │       ├── index.tsx             # NEW: rootPath, title, icon
    │       └── ProviderDashboard.tsx # NEW: page component (observer)
    ├── components/
    │   ├── index.ts                  # MODIFY: + ProviderDashboard exports
    │   └── ProviderDashboard/
    │       ├── UsageChartCard.tsx     # NEW: recharts AreaChart + MetricSelector
    │       ├── MetricSelector.tsx     # NEW: metric dropdown
    │       ├── PastErasCard.tsx       # NEW: table wrapper + pagination
    │       ├── PastErasTable.tsx      # NEW: era data table
    │       ├── Pagination.tsx         # NEW: page navigation controls
    │       ├── EraRangeSelector.tsx   # NEW: era range preset dropdown
    │       ├── EmptyState.tsx         # NEW: "No data" message
    │       └── ErrorBanner.tsx        # NEW: error alert + retry button
    ├── stores/
    │   ├── index.ts                  # MODIFY: + ProviderUsageStore export
    │   ├── AppStore/
    │   │   └── AppStore.ts           # MODIFY: + providerUsageStore instance
    │   └── ProviderUsageStore/
    │       ├── index.ts              # NEW: barrel export
    │       └── ProviderUsageStore.ts # NEW: MobX store
    ├── hooks/
    │   ├── index.ts                       # MODIFY: + useProviderUsageStore export
    │   └── useProviderUsageStore.ts       # NEW: store accessor hook
    └── utils/
        └── formatters.ts                  # NEW: number formatting utilities
```

**Structure Decision**: The Provider Dashboard lives within the existing `apps/node-provider` app scaffold. New files are organized following the established conventions (applications/, components/, stores/, hooks/, utils/). The shared API client is extended in `packages/api/`.

## Complexity Tracking

No constitution violations. All principles pass.
