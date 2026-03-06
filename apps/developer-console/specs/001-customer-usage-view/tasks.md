# Tasks: Customer Usage View

**Input**: Design documents from `specs/001-customer-usage-view/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Configuration and shared types/utilities that all subsequent phases depend on

- [x] T001 [P] Add `VDR_SERVICE_ENDPOINT` constant to `packages/api/src/constants.ts` (reading `import.meta.env.VITE_VDR_SERVICE_ENDPOINT`) and add `VITE_VDR_SERVICE_ENDPOINT=` placeholder to `.env.dev`, `.env.stage`, `.env.prod` at repo root
- [x] T002 [P] Create TypeScript types (`CustomerEraRecord`, `MetricKey`, `EraRangePreset`, `TableRowData`) in `packages/api/src/VdrServiceApi/types.ts` per data-model.md entity definitions
- [x] T003 [P] Create `Intl.NumberFormat`-based formatting helpers (`formatInteger`, `formatCurrency`, `formatDecimal`, `formatDelta`) in `apps/developer-console/src/utils/formatters.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API client, MobX store, page shell, and shared UI components that MUST be complete before ANY user story can begin

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create `VdrServiceApi` class with `getCustomerEras()` and `getCustomerEra()` methods in `packages/api/src/VdrServiceApi/VdrServiceApi.ts`, using axios and `VDR_SERVICE_ENDPOINT` constant. Handle errors per contract: 404→`null`/`[]`, 4xx→user-friendly message, 5xx→service unavailable message. Create barrel export in `packages/api/src/VdrServiceApi/index.ts` and add export to `packages/api/src/index.ts`
- [x] T005 Create `CustomerUsageStore` class with `makeAutoObservable` in `apps/developer-console/src/stores/CustomerUsageStore/CustomerUsageStore.ts`. Implement observables (`eras`, `isLoading`, `error`, `selectedMetric`, `eraRangePreset`), actions (`fetchEras`, `setMetric`, `setEraRange`, `retry`, `reset`), and computed properties (`chartData`, `tableData` with delta calculation, `isEmpty`). Include exponential backoff retry (1s, 2s, 4s, max 3 attempts). Create barrel export in `apps/developer-console/src/stores/CustomerUsageStore/index.ts`
- [x] T006 Wire `CustomerUsageStore` into `AppStore`: add `readonly customerUsageStore: CustomerUsageStore` property and instantiate in constructor in `apps/developer-console/src/stores/AppStore/AppStore.ts`. Pass `this.accountStore` as constructor arg. Add export to `apps/developer-console/src/stores/index.ts`
- [x] T007 Create `useCustomerUsageStore` hook in `apps/developer-console/src/hooks/useCustomerUsageStore.ts` (follow `usePaymentHistoryStore` pattern: access via `useAppStore().customerUsageStore`). Add export to `apps/developer-console/src/hooks/index.ts`
- [x] T008 [P] Create `EmptyState` component displaying centered "No usage data for the selected period." message in `apps/developer-console/src/components/CustomerUsage/EmptyState.tsx` using `@cluster-apps/ui` Typography and Box
- [x] T009 [P] Create `ErrorBanner` component with inline error message and "Retry" button in `apps/developer-console/src/components/CustomerUsage/ErrorBanner.tsx` using `@cluster-apps/ui` Alert and Button. Accept `message: string` and `onRetry: () => void` props
- [x] T010 Create `CustomerUsage` page shell component in `apps/developer-console/src/applications/CustomerUsage/CustomerUsage.tsx`. Wrap with `observer()`. Use `useCustomerUsageStore()` and `useAccountStore()`. Call `store.fetchEras(account.address)` on mount via `useEffect`. Render loading skeleton while `store.isLoading`, `ErrorBanner` when `store.error`, `EmptyState` when `store.isEmpty`, and placeholder content areas for chart and table when data is available
- [x] T011 Register `CustomerUsage` as an Application: create `apps/developer-console/src/applications/CustomerUsage/index.ts` with `Application` type definition (title: "Customer Usage", rootPath: "customer-usage", icon, description). Add to applications array in `apps/developer-console/src/applications/index.ts`

**Checkpoint**: At this point, navigating to `/customer-usage` should show the page shell with loading → empty state (or error if no VDR endpoint configured). The sidebar should display the "Customer Usage" entry.

---

## Phase 3: User Story 1 — View Usage Trends Over Time (Priority: P1) 🎯 MVP

**Goal**: Customer sees an interactive line chart with era-by-era usage data, can switch metrics, hover for tooltips, and toggle legend items

**Independent Test**: Navigate to Customer Usage page with a known dataset; confirm chart renders with Amount Charged by default, eras in ascending order on X-axis, tooltip shows formatted values on hover, metric selector switches Y-axis instantly

### Implementation for User Story 1

- [x] T012 [P] [US1] Create `MetricSelector` dropdown component in `apps/developer-console/src/components/CustomerUsage/MetricSelector.tsx`. Render a `Select` dropdown with options: Amount Charged (default), CPU Units, GPU Units, RAM Units, GETs, PUTs, Transferred Bytes. Accept `value: MetricKey` and `onChange: (key: MetricKey) => void` props
- [x] T013 [US1] Create `UsageChartCard` component in `apps/developer-console/src/components/CustomerUsage/UsageChartCard.tsx`. Use recharts `ResponsiveContainer`, `LineChart`, `Line`, `XAxis` (dataKey: `era_id`), `YAxis`, `Tooltip` (custom formatter using `formatCurrency`/`formatInteger`/`formatDecimal` from formatters.ts based on selected metric), and `Legend` (clickable to toggle series). Include `MetricSelector` in the card header. Accept `data: CustomerEraRecord[]`, `selectedMetric: MetricKey`, and `onMetricChange: (key: MetricKey) => void` props. Parse decimal string fields via `parseFloat()` when preparing chart data
- [x] T014 [US1] Integrate `UsageChartCard` into `CustomerUsage` page: replace the chart placeholder in `apps/developer-console/src/applications/CustomerUsage/CustomerUsage.tsx` with `<UsageChartCard data={store.chartData} selectedMetric={store.selectedMetric} onMetricChange={store.setMetric} />`

**Checkpoint**: User Story 1 is fully functional — chart renders, metric selector works instantly, tooltips show formatted values, legend toggles series

---

## Phase 4: User Story 2 — Browse Historical Era Data in a Table (Priority: P2)

**Goal**: Customer sees a paginated table of past eras with formatted usage metrics and percentage change delta

**Independent Test**: Load page with 25+ eras; verify table shows 10 rows per page, columns formatted correctly, pagination navigates pages, Usage Delta shows correct percentages with `—` for oldest era

### Implementation for User Story 2

- [x] T015 [P] [US2] Create `Pagination` component in `apps/developer-console/src/components/CustomerUsage/Pagination.tsx`. Render Previous/Next buttons and page number indicators. Accept `currentPage: number`, `totalPages: number`, and `onPageChange: (page: number) => void` props. Use `@cluster-apps/ui` Button and Box
- [x] T016 [US2] Create `PastErasTable` component in `apps/developer-console/src/components/CustomerUsage/PastErasTable.tsx`. Render columns: Era (`era_id`), GETs (`formatInteger`), PUTs (`formatInteger`), CPU (`formatDecimal`), GPU (`formatDecimal`), RAM (`formatDecimal`), Amount Charged (`formatCurrency`), Usage Δ (`formatDelta` or `—`). Accept `data: TableRowData[]` prop. Use `@cluster-apps/ui` Table components. Add WAI-ARIA table role attributes
- [x] T017 [US2] Create `PastErasCard` component in `apps/developer-console/src/components/CustomerUsage/PastErasCard.tsx`. Manage client-side pagination state (page size = 10). Slice `tableData` by current page. Compose `PastErasTable` and `Pagination`. Accept `data: TableRowData[]` prop. Add horizontal scroll wrapper for narrow viewports
- [x] T018 [US2] Integrate `PastErasCard` into `CustomerUsage` page: replace the table placeholder in `apps/developer-console/src/applications/CustomerUsage/CustomerUsage.tsx` with `<PastErasCard data={store.tableData} />`

**Checkpoint**: User Stories 1 AND 2 are both independently functional — chart and table render together, pagination works, delta calculations correct

---

## Phase 5: User Story 3 — Filter Data by Time Range (Priority: P3)

**Goal**: Customer can select a time range preset to filter both chart and table data, with loading indicators during re-fetch

**Independent Test**: Select each preset (Last Week, Last Month, Last 3 Months, Last 6 Months, All Time); verify both chart and table update with loading indicator during transition

### Implementation for User Story 3

- [x] T019 [US3] Create `EraRangeSelector` dropdown component in `apps/developer-console/src/components/CustomerUsage/EraRangeSelector.tsx`. Render a `Select` dropdown with preset options: Last Week, Last Month (default), Last 3 Months, Last 6 Months, All Time. Accept `value: EraRangePreset` and `onChange: (preset: EraRangePreset) => void` props
- [x] T020 [US3] Integrate `EraRangeSelector` into `CustomerUsage` page header (top-right position) in `apps/developer-console/src/applications/CustomerUsage/CustomerUsage.tsx`. Connect to `store.eraRangePreset` and `store.setEraRange`. Verify that changing the range triggers re-fetch and shows loading skeleton in both chart and table areas

**Checkpoint**: All three user stories are independently functional — chart, table, and range filter all work together

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, responsiveness, and final validation

- [x] T021 [P] Verify WCAG AA color contrast on chart lines and legend items; ensure chart tooltips are keyboard-navigable via recharts `accessibilityLayer` prop in `apps/developer-console/src/components/CustomerUsage/UsageChartCard.tsx`
- [x] T022 [P] Verify `PastErasTable` horizontal scroll works on viewports below 768px width; confirm all table cells remain readable and no content is clipped in `apps/developer-console/src/components/CustomerUsage/PastErasTable.tsx`
- [ ] T023 Run quickstart.md validation: follow all steps in `specs/001-customer-usage-view/quickstart.md`, verify each interaction in the "Key Interactions to Test" table, and confirm all acceptance scenarios from spec.md pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — all 3 tasks can run in parallel immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
  - T004 depends on T001 (constants) and T002 (types)
  - T005 depends on T002 (types) and T004 (API client)
  - T006 depends on T005
  - T007 depends on T006
  - T008, T009 can run in parallel with T004–T007 (different files)
  - T010 depends on T005–T009 (needs store, hook, EmptyState, ErrorBanner)
  - T011 depends on T010
- **User Story 1 (Phase 3)**: Depends on Phase 2 — No dependencies on US2 or US3
- **User Story 2 (Phase 4)**: Depends on Phase 2 — No dependencies on US1 or US3
- **User Story 3 (Phase 5)**: Depends on Phase 2 — No dependencies on US1 or US2
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent after Phase 2 — chart, metric selector, tooltip, legend
- **User Story 2 (P2)**: Independent after Phase 2 — table, pagination, delta calculation
- **User Story 3 (P3)**: Independent after Phase 2 — range selector, re-fetch integration

### Within Each User Story

- Models/types are shared (created in Setup phase)
- Component creation before page integration
- Formatters before components that use them

### Parallel Opportunities

- **Phase 1**: All 3 tasks (T001, T002, T003) run in parallel
- **Phase 2**: T008 + T009 run in parallel with each other and with T004
- **Phase 3**: T012 runs in parallel with T004–T007 chain (different files)
- **Phase 4**: T015 runs in parallel with T012–T013 (different files)
- **Phase 6**: T021 + T022 run in parallel

---

## Parallel Example: Phase 1

```bash
# Launch all setup tasks together:
Task: "Add VDR_SERVICE_ENDPOINT to packages/api/src/constants.ts and .env files"
Task: "Create types in packages/api/src/VdrServiceApi/types.ts"
Task: "Create formatters in apps/developer-console/src/utils/formatters.ts"
```

## Parallel Example: Phase 2

```bash
# After T004 (API client) completes, these can run in parallel:
Task: "Create EmptyState in apps/developer-console/src/components/CustomerUsage/EmptyState.tsx"
Task: "Create ErrorBanner in apps/developer-console/src/components/CustomerUsage/ErrorBanner.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (3 tasks)
2. Complete Phase 2: Foundational (8 tasks) — page shell with loading/error/empty
3. Complete Phase 3: User Story 1 (3 tasks) — chart with metric selector
4. **STOP and VALIDATE**: Navigate to `/customer-usage`, verify chart renders with real data
5. Deploy/demo if ready — chart alone provides at-a-glance usage insight

### Incremental Delivery

1. Setup + Foundational → Page shell visible in sidebar, shows loading/empty state
2. Add User Story 1 → Chart with metric switching (MVP!)
3. Add User Story 2 → Paginated table with delta calculations
4. Add User Story 3 → Era range filter controlling both views
5. Polish → Accessibility, responsiveness, final validation

### Sequential Execution (Single Developer)

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

Estimated task execution: ~23 tasks total, all with exact file paths and clear deliverables.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable after Phase 2
- No test tasks included (no test framework configured in workspace)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
