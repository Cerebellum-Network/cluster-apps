# Feature Specification: Node Provider Dashboard

**Feature Branch**: `002-provider-dashboard`
**Created**: 2026-03-06
**Status**: Draft
**Input**: User description: "Node Provider Dashboard for Developer Console — visualize per-era usage contribution and computed rewards from VDR Service Provider API"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — View Reward Earnings Over Time (Priority: P1)

A node provider opens the Provider Dashboard to see how their reward earnings have changed across recent eras. They see a chart plotting reward values by era number (ascending left-to-right) and can read exact values on hover. A table below lists past eras with reward amounts and era-over-era percentage change, letting the provider quickly spot earning trends.

**Why this priority**: Reward visibility is the primary reason a provider visits this dashboard. Without it the dashboard has no core value.

**Independent Test**: Can be fully tested by loading the dashboard with provider data and verifying the chart displays rewards by era and the table shows reward values with correct delta percentages.

**Acceptance Scenarios**:

1. **Given** a provider with era data, **When** they open the Provider Dashboard, **Then** a line chart displays reward earnings per era (ascending era order) and a table below lists eras (descending) with Reward ($) and Reward Δ (%) columns.
2. **Given** a provider viewing the chart, **When** they hover over a data point, **Then** a tooltip shows the exact reward value with locale-aware formatting and the era number.
3. **Given** a table with multiple eras, **When** the provider reads the Reward Δ column, **Then** each row shows the percentage change from the prior era (e.g., `+15%`, `-8%`), and the oldest era shows `—`.
4. **Given** more than 10 eras in the selected range, **When** the provider views the table, **Then** results are paginated at 10 rows per page with Prev/Next navigation.

---

### User Story 2 — Filter Data by Era Range (Priority: P1)

A node provider wants to focus on a specific time window — last week, last month, or a longer period. They use a dropdown selector at the top-right of the page to pick a preset range. The entire page (chart and table) refreshes to reflect only eras within that window.

**Why this priority**: Without filtering, the dashboard shows all-time data which may be overwhelming and slow. Range selection is essential for actionable insights.

**Independent Test**: Can be tested by selecting different era range presets and verifying that chart data and table rows update to match the selected window.

**Acceptance Scenarios**:

1. **Given** the Provider Dashboard is loaded, **When** the provider opens the era range dropdown, **Then** they see preset options: Last Week, Last Month, Last 3 Months, Last 6 Months, All Time.
2. **Given** "Last Month" is selected, **When** the page loads data, **Then** only eras whose timestamps fall within the last 30 days appear in the chart and table.
3. **Given** the provider changes the range from "Last Month" to "Last Week", **When** the selection is confirmed, **Then** the chart and table update to show data for the new range.

---

### User Story 3 — Switch Chart Metric (Priority: P2)

A node provider wants to analyze not just rewards but also their resource contribution (CPU, GPU, RAM, data transfer, operations). A metric selector dropdown inside the chart card lets them switch the Y-axis between Reward Earned, CPU Units, GPU Units, RAM Units, GETs, PUTs, and Transferred Bytes — all without reloading data.

**Why this priority**: Multi-metric analysis adds depth but depends on the chart (US1) already working. It's an enhancement, not a prerequisite.

**Independent Test**: Can be tested by loading the dashboard, switching between each metric option, and verifying the chart Y-axis and data points update instantly without a network request.

**Acceptance Scenarios**:

1. **Given** the chart is displaying Reward Earned, **When** the provider selects "CPU Units" from the metric dropdown, **Then** the chart redraws instantly with CPU unit values on the Y-axis.
2. **Given** any metric is selected, **When** the provider hovers over a data point, **Then** the tooltip shows the correct value for the selected metric with proper formatting.
3. **Given** the provider switches metrics, **When** the chart redraws, **Then** no network request is made (the switch uses already-loaded data).

---

### User Story 5 — Handle Loading, Empty, and Error States (Priority: P3)

A node provider encounters scenarios where data is loading, no data exists for the selected period, or the data service is temporarily unavailable. The dashboard communicates each state clearly: skeleton placeholders during loading, a centered empty-state message when no data exists, and an error banner with a retry option when fetching fails.

**Why this priority**: Error handling is critical for production quality but the dashboard can be developed and demoed with happy-path data first.

**Independent Test**: Can be tested by simulating slow responses (loading), empty API responses (empty state), and network failures (error state), and verifying the correct UI appears for each.

**Acceptance Scenarios**:

1. **Given** data is being fetched, **When** the dashboard is loading, **Then** a loading spinner appears in the chart and table area.
2. **Given** the API returns an empty array for the selected range, **When** loading completes, **Then** a centered message reads "No usage data for the selected period."
3. **Given** the API returns an error, **When** loading fails, **Then** an inline error banner appears with a "Retry" button.
4. **Given** the provider clicks "Retry", **When** the request is re-attempted, **Then** the system retries with backoff (up to 3 automatic attempts) and clears the error state on success.

---

### Edge Cases

- What happens when the provider has exactly one era? The table shows one row with `—` for Reward Δ, and the chart shows a single data point.
- What happens when reward or resource unit values are extremely large (e.g., billions)? Number formatting MUST handle large numbers gracefully with locale-aware separators.
- What happens when the provider switches era ranges rapidly? Only the most recent request's result should be displayed; stale responses from earlier requests MUST be discarded.
- What happens when the API returns a `404` for a single-era lookup? The system treats it as "no data" and displays the empty state or skips that era gracefully.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a line chart of per-era data with era number on the X-axis (ascending order) and the selected metric value on the Y-axis.
- **FR-002**: System MUST provide a metric selector dropdown with options: Reward Earned ($), CPU Units, GPU Units, RAM Units, GETs, PUTs, Transferred Bytes. Default selection is Reward Earned.
- **FR-003**: System MUST display a data table listing past eras in descending order with columns: Era, GETs, PUTs, CPU, GPU, RAM, Reward ($), and Reward Δ (%).
- **FR-004**: System MUST compute Reward Δ as the percentage change from the immediately prior era's reward. The oldest era in the dataset MUST show `—`.
- **FR-005**: System MUST paginate the table at 10 rows per page with Prev/Next page navigation.
- **FR-006**: System MUST provide an era range selector with presets: Last Week, Last Month, Last 3 Months, Last 6 Months, All Time. Changing the selection MUST refresh all dashboard sections.
- **FR-009**: Switching the chart metric MUST be instantaneous (no data re-fetching required).
- **FR-010**: System MUST show loading indicators (skeletons/spinners) while data is being fetched.
- **FR-011**: System MUST show a centered empty-state message when no data exists for the selected period.
- **FR-012**: System MUST show an error banner with a "Retry" button when data fetching fails.
- **FR-013**: Automatic retry on failure MUST use exponential backoff with a maximum of 3 attempts.
- **FR-014**: System MUST format all numbers using locale-aware formatting. Reward values MUST be prefixed with `$`. Percentage deltas MUST show sign (`+`/`-`).
- **FR-015**: Chart and table MUST adapt to the container width.
- **FR-016**: System MUST discard stale responses when the user changes filters before a previous request completes.

### Key Entities

- **Provider Era Record**: A single era's data for a provider, containing: era identifier, 8 usage metrics (transferred bytes, stored bytes, GETs, PUTs, computes, CPU units, GPU units, RAM units), reward amount, and time boundaries (start/end timestamps).
- **Era Range Preset**: A named time window (Last Week, Last Month, Last 3 Months, Last 6 Months, All Time) that determines which eras are displayed.
- **Provider Metric**: A selectable dimension for the chart Y-axis (Reward Earned, CPU Units, GPU Units, RAM Units, GETs, PUTs, Transferred Bytes).

## Assumptions

- The provider identity is available from the application context (session, route, or wallet). The dashboard does not need a provider selection UI.
- The data source returns at most ~500 eras per request, making client-side pagination and metric switching feasible without server-side support.
- The dashboard shows aggregated provider-level data. Per-node breakdowns are out of scope for this feature.
- `stored_bytes` and `computes` are available in the data but excluded from the table columns and chart metric options (consistent with the Customer Usage View).
- Currency formatting uses `$` for both customer charges and provider rewards. No differentiation in symbol or label is required at this time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Providers can view their reward trend across eras and identify earning changes within 10 seconds of opening the dashboard.
- **SC-002**: Switching between chart metrics completes in under 200ms with no visible loading state (instant re-render from cached data).
- **SC-003**: Changing the era range filter refreshes all dashboard sections (chart, table) within 3 seconds on a standard connection.
- **SC-004**: The dashboard is fully usable on viewports from 320px to 2560px wide without horizontal scrolling or content overflow.
- **SC-005**: Failed data fetches show a recoverable error state; providers can retry without reloading the page.
