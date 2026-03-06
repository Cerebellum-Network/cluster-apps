# Tasks: Node Provider Dashboard

**Input**: Design documents from `/specs/002-provider-dashboard/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested in the feature specification. Tasks focus on implementation only.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Shared API package**: `packages/api/src/VdrServiceApi/`
- **Node provider app**: `apps/node-provider/src/`
- Paths are relative to repo root (`/Users/ksr/RustroverProjects/cluster-apps/`)

## Phase 1: Setup

**Purpose**: Add dependency and create utility module shared by all user stories

- [x] T001 Add `recharts` ^2.15.3 dependency to `apps/node-provider/package.json` and run `npm install`
- [x] T002 Create number formatting utilities in `apps/node-provider/src/utils/formatters.ts` — port `formatCurrency`, `formatDecimal`, `formatInteger`, `formatDelta`, `formatMetricValue` from `apps/developer-console/src/utils/formatters.ts`, adapting `MetricKey` references to use `ProviderMetricKey` and adding `'reward'` case mapping to `formatCurrency`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API types, API methods, MobX store, hook, and application shell that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [P] Add provider types to `packages/api/src/VdrServiceApi/types.ts` — add `QoSLatency`, `QoSAvailability`, `QoSBandwidth`, `ProviderEraRecord`, `ProviderMetricKey`, `ProviderTableRowData`, `ProviderErasParams`, `PROVIDER_METRIC_LABELS` per data-model.md; re-export all new types from `packages/api/src/VdrServiceApi/index.ts` and `packages/api/src/index.ts`
- [x] T004 [P] Add provider API methods to `packages/api/src/VdrServiceApi/VdrServiceApi.ts` — implement `getProviderEras(providerId, params?)` and `getProviderEra(providerId, eraId)` following the same pattern as `getCustomerEras`/`getCustomerEra` (404 → `[]`/`null`, 5xx → service error, other → generic error) per contracts/vdr-provider-api.md
- [x] T005 Create `ProviderUsageStore` in `apps/node-provider/src/stores/ProviderUsageStore/ProviderUsageStore.ts` — MobX store with observables (`eras`, `isLoading`, `error`, `selectedMetric`, `eraRangePreset`), actions (`fetchEras`, `setMetric`, `setEraRange`, `retry`, `reset`), and computed properties (`chartData`, `tableData` with `rewardDelta`, `latestEraQoS`, `totalReward`, `isEmpty`) per data-model.md; include request counter for stale response handling per research.md R-08; use exponential backoff retry (1s, 2s, 4s); add barrel export in `apps/node-provider/src/stores/ProviderUsageStore/index.ts`
- [x] T006 Register `ProviderUsageStore` in `apps/node-provider/src/stores/AppStore/AppStore.ts` — add `readonly providerUsageStore: ProviderUsageStore` property, instantiate in constructor passing `this.accountStore`; export from `apps/node-provider/src/stores/index.ts`
- [x] T007 Create `useProviderUsageStore` hook in `apps/node-provider/src/hooks/useProviderUsageStore.ts` — returns `useAppStore().providerUsageStore`; export from `apps/node-provider/src/hooks/index.ts`
- [x] T008 Create Provider Dashboard application shell: create `apps/node-provider/src/applications/ProviderDashboard/index.tsx` with `rootPath: 'provider-dashboard'`, title, description, and icon; create `apps/node-provider/src/applications/ProviderDashboard/ProviderDashboard.tsx` as an `observer` page component with header, placeholder content area, and `useEffect` calling `store.fetchEras()` on mount; register in `apps/node-provider/src/applications/index.ts`

**Checkpoint**: Foundation ready — store loads provider era data, app is routable, user story UI work can begin

---

## Phase 3: User Story 1 — View Reward Earnings Over Time (Priority: P1) 🎯 MVP

**Goal**: Provider sees a line chart of reward earnings by era and a paginated table of past eras with reward delta percentages

**Independent Test**: Open Provider Dashboard with a provider that has era data. Verify the chart shows rewards ascending by era, the table shows eras descending with Reward ($) and Reward Δ (%), and pagination works at 10 rows per page.

### Implementation for User Story 1

- [x] T009 [P] [US1] Create `UsageChartCard` component in `apps/node-provider/src/components/ProviderDashboard/UsageChartCard.tsx` — recharts `<LineChart>` with `<XAxis dataKey="era_id">`, `<YAxis>`, `<Tooltip>` (locale-formatted value + era number), `<Legend>`, `<Line dataKey={selectedMetric}>`; accept props: `data: ProviderEraRecord[]`, `selectedMetric: ProviderMetricKey`, `onMetricChange`; parse decimal string fields to number for chart data; wrap in a bordered `Card` from `@cluster-apps/ui`
- [x] T010 [P] [US1] Create `PastErasTable` component in `apps/node-provider/src/components/ProviderDashboard/PastErasTable.tsx` — MUI `Table` with columns: Era, GETs, PUTs, CPU, GPU, RAM, Reward ($), Reward Δ (%); format using `formatInteger`, `formatDecimal`, `formatCurrency`, `formatDelta` from `~/utils/formatters`; accept `data: ProviderTableRowData[]`
- [x] T011 [P] [US1] Create `Pagination` component in `apps/node-provider/src/components/ProviderDashboard/Pagination.tsx` — Prev/Next + page number indicator; accept `currentPage`, `totalPages`, `onPageChange` props; port from `apps/developer-console/src/components/CustomerUsage/Pagination.tsx`
- [x] T012 [US1] Create `PastErasCard` component in `apps/node-provider/src/components/ProviderDashboard/PastErasCard.tsx` — wrapper that takes `data: ProviderTableRowData[]`, implements client-side pagination (page size 10), renders `PastErasTable` with current page slice and `Pagination` controls; port from `apps/developer-console/src/components/CustomerUsage/PastErasCard.tsx`
- [x] T013 [US1] Wire chart and table into `ProviderDashboard.tsx` — replace placeholder content: render `<UsageChartCard>` with `store.chartData`, `store.selectedMetric`, and metric change handler; render `<PastErasCard>` with `store.tableData`; show content only when `!store.isLoading && !store.isEmpty && !store.error`

**Checkpoint**: User Story 1 is functional — chart and table render with real data, pagination works

---

## Phase 4: User Story 2 — Filter Data by Era Range (Priority: P1)

**Goal**: Provider selects a time range preset and all dashboard sections refresh

**Independent Test**: Select each era range preset (Last Week through All Time) and verify the chart and table update to show only eras in that window.

### Implementation for User Story 2

- [x] T014 [P] [US2] Create `EraRangeSelector` component in `apps/node-provider/src/components/ProviderDashboard/EraRangeSelector.tsx` — MUI `TextField` with `select` rendering `MenuItem` for each `EraRangePreset`; use `ERA_RANGE_LABELS` from `@cluster-apps/api`; accept `value` and `onChange` props; port from `apps/developer-console/src/components/CustomerUsage/EraRangeSelector.tsx`
- [x] T015 [US2] Integrate `EraRangeSelector` into `ProviderDashboard.tsx` page header — add to the top-right of the page header, wire `value={store.eraRangePreset}` and `onChange={preset => store.setEraRange(preset)}`; verify changing the range re-fetches data and updates chart + table

**Checkpoint**: User Story 2 is functional — era range filtering works across all dashboard sections

---

## ~~Phase 5: User Story 3 — Monitor QoS at a Glance~~ (REMOVED)

*QoS summary cards removed from scope. T016 and T017 cancelled.*

---

## Phase 5: User Story 4 — Switch Chart Metric (Priority: P2)

**Goal**: Provider selects a different metric and the chart Y-axis updates instantly without re-fetching data

**Independent Test**: With the dashboard loaded, switch between each of the 7 metric options. Verify the chart redraws instantly, the tooltip shows correctly formatted values, and no network requests are made.

### Implementation for User Story 4

- [x] T018 [P] [US4] Create `MetricSelector` component in `apps/node-provider/src/components/ProviderDashboard/MetricSelector.tsx` — MUI `TextField` with `select` rendering `MenuItem` for each `ProviderMetricKey`; use `PROVIDER_METRIC_LABELS` from `@cluster-apps/api`; accept `value` and `onChange` props
- [x] T019 [US4] Integrate `MetricSelector` into `UsageChartCard.tsx` — render the selector inside the chart card header (top-right); wire to the `onMetricChange` callback already accepted as a prop; verify chart Y-axis updates immediately on metric change with no API call

**Checkpoint**: User Story 4 is functional — all 7 metrics selectable with instant chart updates

---

## Phase 7: User Story 5 — Handle Loading, Empty, and Error States (Priority: P3)

**Goal**: Dashboard displays clear feedback during loading, when no data exists, and when API calls fail

**Independent Test**: Simulate slow response → verify loading spinner. Simulate empty response → verify "No usage data" message. Simulate network error → verify error banner with Retry button.

### Implementation for User Story 5

- [x] T020 [P] [US5] Create `EmptyState` component in `apps/node-provider/src/components/ProviderDashboard/EmptyState.tsx` — centered `Typography` with message "No usage data for the selected period."; port from `apps/developer-console/src/components/CustomerUsage/EmptyState.tsx`
- [x] T021 [P] [US5] Create `ErrorBanner` component in `apps/node-provider/src/components/ProviderDashboard/ErrorBanner.tsx` — MUI `Alert` severity `error` with message text and a "Retry" `Button`; accept `message: string` and `onRetry: () => void` props; port from `apps/developer-console/src/components/CustomerUsage/ErrorBanner.tsx`
- [x] T022 [US5] Integrate loading, empty, and error states into `ProviderDashboard.tsx` — add `CircularProgress` spinner when `store.isLoading`; render `EmptyState` when `store.isEmpty`; render `ErrorBanner` when `store.error` with `onRetry={() => store.retry()}`; ensure states are mutually exclusive and render in priority: error > loading > empty > content

**Checkpoint**: User Story 5 is functional — all three states render correctly

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup, exports, and validation

- [x] T023 [P] Export all ProviderDashboard components from `apps/node-provider/src/components/index.ts`
- [x] T024 [P] Create ProviderDashboard icon component in `apps/node-provider/src/applications/ProviderDashboard/icons/` (follow `PayoutsIcon.tsx` pattern) and reference it in `apps/node-provider/src/applications/ProviderDashboard/index.tsx`
- [x] T025 Verify build passes: run `npm run build -w apps/node-provider` and `npm run lint` and fix any type errors or lint issues
- [ ] T026 Run quickstart.md validation: follow steps in `specs/002-provider-dashboard/quickstart.md` end-to-end and verify all acceptance scenarios from spec.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T002 needs formatters for metric value formatting context) — BLOCKS all user stories
- **User Stories (Phase 3–7)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 priority — execute sequentially (US1 first, then US2)
  - US3 and US4 are both P2 — can run in parallel (different components/files)
  - US5 is P3 — executes after US1–US4
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no other story dependencies
- **User Story 2 (P1)**: Can start after Foundational — integrates into `ProviderDashboard.tsx` (same file as US1 wiring, so execute after US1)
- ~~**User Story 3 (P2)**~~: Removed from scope
- **User Story 4 (P2)**: Can start after Foundational — depends on `UsageChartCard` from US1 existing (adds `MetricSelector` into it)
- **User Story 5 (P3)**: Can start after Foundational — integrates into `ProviderDashboard.tsx`

### Within Each User Story

- Components before page integration
- Reusable/generic components (Pagination, EmptyState) before composite components (PastErasCard, ProviderDashboard)
- Each story is independently verifiable at its checkpoint

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run sequentially (T002 needs npm install from T001)
- **Phase 2**: T003 and T004 in parallel (different files in packages/api); T005 after T003+T004; T006 after T005; T007 after T006; T008 after T007
- **Phase 3 (US1)**: T009, T010, T011 in parallel (different component files); T012 after T010+T011; T013 after T009+T012
- **Phase 4 (US2)**: T014 standalone; T015 after T014
- ~~**Phase 5 (US3)**~~: Removed from scope
- **Phase 5 (US4)**: T018 standalone; T019 after T018
- **Phase 6 (US5)**: T020 and T021 in parallel; T022 after T020+T021
- **Phase 7**: T023 and T024 in parallel; T025 after all; T026 after T025

---

## Parallel Example: User Story 1

```bash
# Launch all independent components together:
Task: "Create UsageChartCard in apps/node-provider/src/components/ProviderDashboard/UsageChartCard.tsx"
Task: "Create PastErasTable in apps/node-provider/src/components/ProviderDashboard/PastErasTable.tsx"
Task: "Create Pagination in apps/node-provider/src/components/ProviderDashboard/Pagination.tsx"

# Then compose them:
Task: "Create PastErasCard wrapping PastErasTable + Pagination"
Task: "Wire chart and table into ProviderDashboard.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (chart + table)
4. Complete Phase 4: User Story 2 (era range filter)
5. **STOP and VALIDATE**: Dashboard shows reward data with era filtering
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (chart + table) → Test → Demo (MVP!)
3. Add US2 (era filter) → Test → Demo
4. Add US4 (metric switching) → Test → Demo
5. Add US5 (loading/error/empty) → Test → Production-ready
6. Polish → Final validation

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (chart + table) → then US2 (era filter)
   - Developer B: US4 (metric switching) → then US5 (error states)
   - Developer C: Polish
3. Stories integrate independently into `ProviderDashboard.tsx`

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All component ports from `developer-console` follow same props API but are independent implementations
- Decimal string fields (`reward`, `cpu_units`, `gpu_units`, `ram_units`) remain as strings in the store and are parsed to numbers only at display/chart time
