# Feature Specification: Customer Usage View

**Feature Branch**: `001-customer-usage-view`
**Created**: 2026-03-05
**Status**: Draft
**Input**: User description: "Customer Usage View for Developer Console — visualize per-era usage metrics and charges"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — View Usage Trends Over Time (Priority: P1)

A customer opens the Developer Console and navigates to the Customer Usage page. They see a line chart displaying their usage data across eras. By default the chart shows **Amount Charged ($)** on the Y-axis and **Era Number** on the X-axis, plotted in chronological order (oldest era on the left, newest on the right). The customer can hover over any data point to see the exact value and era number in a tooltip.

**Why this priority**: The chart is the primary visualization that gives customers at-a-glance insight into how their usage and costs are trending. Without it the page delivers no value.

**Independent Test**: Load the Customer Usage page with a known dataset; confirm the chart renders with Amount Charged by default, eras are in ascending order, and tooltip displays correct values on hover.

**Acceptance Scenarios**:

1. **Given** the customer has usage data spanning multiple eras, **When** they open the Customer Usage page, **Then** a line chart is displayed with Era Number on the X-axis (ascending) and Amount Charged on the Y-axis.
2. **Given** the chart is displayed, **When** the customer hovers over a data point, **Then** a tooltip shows the exact value formatted with locale-aware separators (e.g., `$250,000`) and the era number.
3. **Given** the chart is displayed, **When** the customer selects a different metric from the metric dropdown (CPU Units, GPU Units, RAM Units, GETs, PUTs, or Transferred Bytes), **Then** the Y-axis data and label update instantly without any visible loading delay.
4. **Given** the chart has a legend showing all available series, **When** the customer clicks a legend item, **Then** that series is toggled on or off in the chart.

---

### User Story 2 — Browse Historical Era Data in a Table (Priority: P2)

Below the chart the customer sees a **Past Eras** table listing their usage data era by era. The table shows columns for Era, GETs, PUTs, CPU, GPU, RAM, Amount Charged ($), and a Usage Delta (%) column indicating the percentage change in charge compared to the previous era. Data is sorted by era in descending order (newest first). The table is paginated with 10 rows per page.

**Why this priority**: The table provides granular, row-level data that customers need to audit specific eras, compare periods, and verify billing. It complements the chart with precise numbers.

**Independent Test**: Load the page with a known multi-era dataset; verify all columns display correctly, pagination works, and Usage Delta is accurately calculated.

**Acceptance Scenarios**:

1. **Given** the customer has usage data for 25 eras, **When** the Past Eras table loads, **Then** it displays the first 10 eras (newest first) with pagination controls showing 3 pages.
2. **Given** the table is on page 1, **When** the customer clicks "Next" or page "2", **Then** the table shows eras 11–20.
3. **Given** an era has a charge of $32,000 and the previous era had a charge of $28,000, **When** the table renders, **Then** the Usage Delta column displays `+14%`.
4. **Given** the oldest era in the dataset, **When** the table renders, **Then** the Usage Delta column displays `—` (no prior era to compare).
5. **Given** the table is displayed, **Then** all numeric values use locale-aware formatting: integers with thousand separators, currency prefixed with `$`, and deltas showing explicit `+` or `-` signs.

---

### User Story 3 — Filter Data by Time Range (Priority: P3)

The customer sees an **Era Range** dropdown at the top-right of the page. They can select from preset time ranges: Last Week, Last Month (default), Last 3 Months, Last 6 Months, or All Time. Changing the selection refreshes both the chart and the table to show only data within the selected period.

**Why this priority**: Filtering lets customers focus on the time period most relevant to their needs. While the page works without it (showing default data), filtering is essential for customers with long usage histories.

**Independent Test**: Select each preset range and verify that both the chart and table update to reflect only eras within that period.

**Acceptance Scenarios**:

1. **Given** the Customer Usage page loads, **When** no range is explicitly selected, **Then** the default range is "Last Month" and only eras within the last 30 days are shown.
2. **Given** the customer selects "Last 3 Months", **When** the data refreshes, **Then** the chart and table show only eras whose timestamps fall within the last 90 days.
3. **Given** the customer selects "All Time", **When** the data refreshes, **Then** all available eras are shown in the chart and table.
4. **Given** the customer changes the range selector, **When** data is being fetched, **Then** skeleton/spinner indicators are shown in the chart and table areas until data arrives.

---

### Edge Cases

- **No data for selected period**: When no eras exist within the selected range, both the chart and table areas display a centered message: "No usage data for the selected period."
- **Data fetch failure**: On a network or server error, an inline error banner is shown (not a full-page crash) with a "Retry" button. Automatic retry is attempted up to 3 times with increasing delays before surfacing the manual retry option.
- **Single era in dataset**: The chart renders a single data point. The table shows one row with `—` in the Usage Delta column.
- **Very large charge or metric values**: Numbers are formatted with locale-aware separators to remain readable (e.g., `$1,234,567`).
- **Zero-value metrics**: When all usage fields are zero for an era, the row still appears in the table and the data point appears in the chart at y = 0.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display a line chart with Era Number on the X-axis (ascending chronological order) and a selectable metric on the Y-axis.
- **FR-002**: The system MUST provide a metric selector dropdown within the chart card with these options: Amount Charged (default), CPU Units, GPU Units, RAM Units, GETs, PUTs, and Transferred Bytes.
- **FR-003**: Switching the selected metric MUST update the chart instantly without re-fetching data from the server.
- **FR-004**: The chart MUST display a tooltip on hover showing the exact metric value (locale-formatted) and the era number.
- **FR-005**: The chart MUST include a toggle-able legend for visible series.
- **FR-006**: The system MUST display a "Past Eras" data table with columns: Era, GETs, PUTs, CPU, GPU, RAM, Amount Charged ($), and Usage Delta (%).
- **FR-007**: The table MUST be sorted by era number in descending order (newest first) by default.
- **FR-008**: The Usage Delta column MUST show the percentage change in charge compared to the immediately preceding era, displayed as `+X%` or `-X%`. The oldest era in the dataset MUST show `—`.
- **FR-009**: The table MUST be paginated client-side with 10 rows per page, with Previous/Next and page number controls.
- **FR-010**: The system MUST provide an Era Range selector with presets: Last Week, Last Month (default), Last 3 Months, Last 6 Months, and All Time.
- **FR-011**: Changing the era range MUST refresh both the chart and the table.
- **FR-012**: The system MUST show skeleton/spinner loading indicators in the chart and table areas while data is being fetched.
- **FR-013**: When no data exists for the selected period, the system MUST display a centered empty-state message: "No usage data for the selected period."
- **FR-014**: On data fetch failure, the system MUST show an inline error banner with a "Retry" button. The system MUST NOT crash or display a blank page.
- **FR-015**: The system MUST attempt automatic retry with exponential backoff (up to 3 attempts) before requiring manual retry.
- **FR-016**: All user-facing numbers MUST be formatted with locale-aware separators. Currency values MUST be prefixed with `$`. Percentage deltas MUST display explicit `+` or `-` signs.

### Key Entities

- **Era Record**: Represents a single billing era for a customer. Key attributes: era identifier, usage metrics (GETs, PUTs, transferred bytes, stored bytes, CPU units, GPU units, RAM units, compute units), total charge, and the time window (start and end timestamps) the era covers.
- **Era Range Preset**: A named time-range filter (Last Week, Last Month, Last 3 Months, Last 6 Months, All Time) that determines which eras are displayed.
- **Metric**: A selectable dimension of usage data that can be plotted on the chart's Y-axis (Amount Charged, CPU Units, GPU Units, RAM Units, GETs, PUTs, Transferred Bytes).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Customers can view their usage trends within 3 seconds of navigating to the Customer Usage page (time from navigation to chart and table fully rendered with data).
- **SC-002**: Switching the chart metric updates the visualization in under 100 milliseconds with no visible loading state (data already available client-side).
- **SC-003**: Changing the era range filter refreshes both chart and table within 3 seconds, with loading indicators visible during the transition.
- **SC-004**: Table pagination (page changes) completes in under 100 milliseconds (client-side operation).
- **SC-005**: 100% of numeric values displayed on the page use locale-aware formatting (no raw unformatted numbers).
- **SC-006**: The page gracefully handles data fetch failures — users are never shown a blank or crashed page; they always see an actionable error message with a retry option.
- **SC-007**: The chart and table adapt to the browser width. On viewports narrower than the table's natural width, horizontal scrolling is available. No content is clipped or hidden without a scroll affordance.
- **SC-008**: Chart tooltips are reachable via keyboard navigation (not mouse-only).

## Assumptions

- The **customer identity** is derived from the currently authenticated user session in the Developer Console. No additional customer ID input is required from the user.
- The **currency symbol** is `$` (USD) as shown in the wireframe. If the system later adopts token-denominated units (e.g., CERE), only display formatting changes would be needed.
- **Stored Bytes** and **Computes** are available in the underlying data but are excluded from both the chart metric selector and the table columns, consistent with the wireframe. They remain available in the data model for future use.
- **Transferred Bytes** is available as a chart metric but excluded from the table columns, consistent with the wireframe.
- **Row click** on the Past Eras table is a no-op in this initial release. A single-era detail view is deferred to a future feature.
- The maximum dataset size for a single range query is approximately 500 era records (covering ~6 months). Client-side pagination and chart rendering are designed for this scale.
