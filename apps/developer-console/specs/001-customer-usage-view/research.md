# Research: Customer Usage View

**Feature**: 001-customer-usage-view
**Date**: 2026-03-05

## R1: VDR Service API Client — Where and How

**Decision**: Create `VdrServiceApi` in `packages/api/src/VdrServiceApi/` using `axios`, matching the `DacApi` pattern.

**Rationale**: All existing API clients live in the shared `@cluster-apps/api` package. `DacApi` is the closest analogy (also a REST API for era/customer data) and uses axios. Following the same pattern keeps the codebase consistent (Constitution Principle II).

**Alternatives considered**:
- *Inline fetch in the store*: Rejected — violates Pattern Consistency (stores should not contain raw fetch logic; existing stores delegate to API classes).
- *New standalone package*: Rejected — over-engineering for a single API; the existing `packages/api` package already aggregates multiple API clients.

## R2: Customer ID Source

**Decision**: Use `accountStore.address` (the wallet address of the currently authenticated user) as the `customerId` parameter for VDR Service API calls.

**Rationale**: The `ActivityStore` already uses the same wallet address to fetch customer-specific data from the DAC API (`fetchCustomerActivity(customerId)`). The VDR Service Customer API follows the same pattern (`GET /api/customer/{customerId}/eras`). The wallet address is the canonical customer identifier in the Cere ecosystem.

**Alternatives considered**:
- *URL parameter*: Rejected — the Developer Console is a single-tenant app where the logged-in user views their own data; no need for URL-based customer switching.
- *Separate customer lookup*: Rejected — no such service exists; the wallet address is the direct identifier.

## R3: Authentication Headers for VDR Service

**Decision**: Start without authentication headers, matching existing API clients (DacApi, StatsApi, IndexerApi — none inject auth headers). Add auth headers later if the VDR Service requires them.

**Rationale**: All existing API clients in `packages/api` make unauthenticated requests. The VDR Service raw spec mentions "include auth headers from existing auth context" but no concrete auth mechanism is documented. The `AccountStore` provides `createAuthToken` for DDC bucket operations, but this is DDC-specific and unlikely to be the right token for VDR Service.

**Follow-up**: If VDR Service returns 401/403, implement auth header injection using the appropriate token mechanism. The API client architecture supports adding an axios interceptor for auth headers without changing the store layer.

**Alternatives considered**:
- *Pre-emptively add auth via AccountStore.createAuthToken*: Rejected — this creates a DDC auth token, not necessarily valid for VDR Service.

## R4: Page Registration Approach

**Decision**: Register as a new Application in `src/applications/` (like ContentStorage, ContentDelivery, ActivityCapture). The application will appear in the sidebar and be mapped to a route automatically via `mapAppToRoute` in `Router.tsx`.

**Rationale**: This is the established pattern for adding top-level pages. The `Application` type requires `rootComponent`, `rootPath`, `title`, `description`, and `icon`. The router automatically maps applications to routes.

**Alternatives considered**:
- *Direct route in Router.tsx without Application registration*: Rejected — this would add the page without a sidebar entry, making it undiscoverable. The Application pattern handles both routing and navigation.

## R5: Decimal String Handling Strategy

**Decision**: Keep `charge`, `cpu_units`, `gpu_units`, `ram_units` as strings in the TypeScript type and store. Parse to `number` via `parseFloat()` only at the point of display (chart data preparation and table cell rendering).

**Rationale**: The backend sends these as decimal strings to avoid floating-point precision issues in transit. For the usage values in this feature (currency amounts, resource units), `parseFloat` provides sufficient precision for display purposes. The values are never used in financial calculations on the client — they are display-only.

**Alternatives considered**:
- *Parse to number on API response*: Rejected — loses the original precision and makes it harder to trace display issues back to API data.
- *Use BigDecimal / decimal.js library*: Rejected — adds dependency for no practical benefit; the values are display-only, not used in arithmetic beyond the delta percentage calculation (which is a ratio, so float precision is acceptable).

## R6: Environment Variable for VDR Service

**Decision**: Add `VITE_VDR_SERVICE_ENDPOINT` to `packages/api/src/constants.ts` and to all `.env.*` files at the repo root.

**Rationale**: All existing API endpoints follow this pattern (`VITE_INDEXER_ENDPOINT`, `VITE_STATS_ENDPOINT`, `VITE_DAC_ENPOINT`, etc.). Vite exposes `import.meta.env.VITE_*` variables to client code.

## R7: Recharts Configuration

**Decision**: Use `<LineChart>` from recharts with `<Line>`, `<XAxis>`, `<YAxis>`, `<Tooltip>`, and `<Legend>` components. `recharts` is already a workspace-level dependency.

**Rationale**: The raw spec explicitly calls for recharts `<LineChart>`. The library is already installed. The `<ResponsiveContainer>` wrapper handles responsive sizing natively.

**Alternatives considered**:
- *AreaChart with fill off*: The raw spec mentions this as acceptable, but LineChart is the primary recommendation and is clearer in intent.

## R8: Retry with Exponential Backoff

**Decision**: Implement retry logic in the `CustomerUsageStore` (not in the API client) using a simple recursive approach with delays of 1s, 2s, 4s (3 attempts). The store tracks retry count and exposes a manual `retry()` action.

**Rationale**: Retry logic is a business concern (how many times, when to show error) rather than a transport concern. Keeping it in the store allows the UI to observe retry state. Existing stores handle errors in the store layer (see `ActivityStore.loadCustomerActivity` catch block).

**Alternatives considered**:
- *Axios interceptor for retries*: Rejected — moves retry policy out of observable state, making it harder for the UI to show retry progress or offer manual retry.
- *Third-party retry library (axios-retry)*: Rejected — adds dependency for a simple 3-retry loop.
