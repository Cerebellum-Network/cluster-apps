# Research: Node Provider Dashboard

**Branch**: `002-provider-dashboard` | **Date**: 2026-03-06

## R-01: Component Reuse Strategy (Cross-App Boundary)

**Decision**: Re-implement Customer Usage View components within `apps/node-provider/` following the same patterns, rather than extracting to a shared package.

**Rationale**: The Customer Usage View components live in `apps/developer-console/src/components/CustomerUsage/`. The monorepo workspace structure (`packages/*`, `apps/*`) does not support cross-app imports — only `packages/` exports are shared. Moving components to `@cluster-apps/ui` would require refactoring the developer-console app and is out of scope. The components are small (each <100 lines) and the implementation effort is low.

**Alternatives considered**:
- Extract to `@cluster-apps/ui`: High coupling risk, requires coordinated changes across apps, out of scope for this feature.
- Import from developer-console directly: Workspace boundaries prevent this; would break build isolation.

**Reuse approach**:
- `EraRangeSelector`, `Pagination`, `EmptyState`, `ErrorBanner` — port directly (identical logic, same props API).
- `UsageChartCard`, `PastErasTable` — adapt with provider-specific columns and metrics.
- `formatters.ts` — port utilities (`formatCurrency`, `formatDecimal`, `formatInteger`, `formatDelta`) since they're not in a shared package.

## R-02: VDR API Client Extension

**Decision**: Extend `VdrServiceApi` class in `packages/api/src/VdrServiceApi/` with provider methods and types.

**Rationale**: The API client is in the shared `@cluster-apps/api` package, accessible from both apps. Adding provider methods here follows the existing pattern and avoids duplication. The provider endpoints (`/api/provider/{id}/eras`, `/api/provider/{id}/era/{eraId}`) mirror the customer endpoints in structure.

**Changes required**:
- Add `ProviderEraRecord` interface to `types.ts` (extends customer shape with QoS fields + reward instead of charge).
- Add `ProviderMetricKey` type, `PROVIDER_METRIC_LABELS`, `ProviderTableRowData` to `types.ts`.
- Add `getProviderEras()` and `getProviderEra()` methods to `VdrServiceApi.ts`.
- Re-export new types from `index.ts`.

## R-03: Provider ID Source

**Decision**: Use the provider's wallet address from `AccountStore.address`, consistent with how `CustomerUsageStore` resolves the customer ID.

**Rationale**: The node-provider app's `AccountStore` manages wallet connection and exposes `address`. The raw spec's Open Question #1 asks about this. Since the customer view uses `accountStore.address` as the default customer ID, the same pattern applies for the provider ID. The `fetchEras` action will accept an optional override parameter (matching `CustomerUsageStore.fetchEras` signature).

**Alternatives considered**:
- URL parameter: Adds routing complexity; not needed since each provider views their own data.
- Provider selector dropdown: Multi-provider support is out of scope per spec assumptions.

## ~~R-04: QoS Summary Cards~~ (REMOVED)

*QoS summary cards removed from scope.*

## R-05: Loading State Pattern

**Decision**: Use `CircularProgress` (matching Customer view) rather than skeleton loading.

**Rationale**: The existing Customer Usage View uses `CircularProgress` inside a centered `Box`. The raw spec mentions "skeleton/spinner" but the current codebase has no skeleton component. Creating a skeleton loader is an enhancement that can be added later. The constitution's "Graceful Degradation" principle requires loading indicators but does not mandate a specific type.

## R-06: recharts Dependency

**Decision**: Add `recharts` to `apps/node-provider/package.json` as a direct dependency.

**Rationale**: `recharts` is currently only in `apps/developer-console/package.json` (^2.15.3). The node-provider app needs it for the usage chart. Install the same version for consistency.

## R-07: UI Library Clarification

**Decision**: Use `@cluster-apps/ui` (MUI-based) as the primary component library, not `@cere/cere-design-system`.

**Rationale**: The constitution references `@cere/cere-design-system`, but this package is not installed anywhere in the monorepo. Both `developer-console` and `node-provider` use `@cluster-apps/ui` which re-exports MUI components and provides custom components. The constitution's intent (design system consistency) is satisfied by using `@cluster-apps/ui` consistently.

## R-08: Stale Response Handling

**Decision**: Track a request counter in the store. Each `fetchEras` call increments the counter. When the response arrives, discard it if the counter has advanced past the request's snapshot.

**Rationale**: Spec FR-017 requires discarding stale responses when filters change rapidly. The `CustomerUsageStore` does not implement this (it overwrites on every response). A simple counter pattern avoids AbortController complexity while being sufficient for the ~500-era payload size.
