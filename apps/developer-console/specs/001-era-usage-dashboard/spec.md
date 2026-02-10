# Feature Specification: Era Usage Dashboard

**Feature Branch**: `001-era-usage-dashboard`  
**Created**: 2025-02-10  
**Status**: Draft  
**Input**: Add Era Usage Dashboard components to Activity Dashboard (Era vs Usage chart, Past Eras table, Era Range filter); data from VDR Service.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View usage over time (Priority: P1)

As a developer or account viewer, I want to see usage and charged amounts over eras in a line chart so that I can understand trends at a glance. I can choose which metric to plot (amount charged, CPU, GPU, RAM, GETs/PUTs, transferred bytes) and restrict the time range. The chart shows era numbers on the horizontal axis and the selected metric on the vertical axis, with a clear legend and tooltips on hover.

**Why this priority**: The chart is the primary way to see trends; without it, users cannot quickly compare usage across eras.

**Independent Test**: Select a metric and an era range; confirm the chart displays the correct eras and values, legend matches available metrics, and tooltips show era and value. Change metric and range and confirm the chart updates.

**Acceptance Scenarios**:

1. **Given** I am on the Activity Dashboard, **When** the page loads, **Then** I see an "Era vs Usage" line chart with a default metric (e.g. Amount Charged) and a default era range (e.g. Last Month).
2. **Given** the chart is visible, **When** I change the metric from a dropdown above the chart, **Then** the chart and Y-axis label update to show the selected metric (USD charged, CPU, GPU, RAM, GETs/PUTs, or TransferredBytes).
3. **Given** the chart is visible, **When** I hover a data point, **Then** I see a tooltip with era details and the selected metric value.
4. **Given** multiple metrics exist in the data, **When** I view the chart, **Then** I see a legend below the chart with items for CPU, GPU, RAM, GETs, PUTs, Transfer, and Amount ($); items with no data are hidden or disabled.
5. **Given** the chart is displayed, **When** the data set has 1 to 100+ eras, **Then** the chart renders without errors and remains usable (responsive, minimum readable height).

---

### User Story 2 - Inspect historical eras in a table (Priority: P2)

As a developer or account viewer, I want to see past eras in a sortable, paginated table so that I can compare exact numbers and see period-over-period change. The table shows Era, GETs, PUTs, CPU, GPU, RAM, Amount Charged, and Usage Δ (percentage change vs previous era). I can sort by any column and move through pages.

**Why this priority**: The table supports detailed analysis and auditing; it complements the chart with precise values and delta.

**Independent Test**: Open the Past Eras table; sort by different columns, change page, and confirm Usage Δ is correct for non-first eras and shown as "-" or "N/A" for the first era. Verify currency and number formatting.

**Acceptance Scenarios**:

1. **Given** I am on the Activity Dashboard, **When** I scroll to the "Past Eras" section, **Then** I see a table with columns: Era (default sort descending), GETs, PUTs, CPU, GPU, RAM, Amount Charged ($), Usage Δ.
2. **Given** the table is visible, **When** I click a column header, **Then** the table re-sorts by that column (ascending/descending) with a visible sort indicator.
3. **Given** the table has more than one page, **When** I use pagination controls (Prev, page numbers, Next), **Then** I see the correct page; Prev is disabled on the first page and Next on the last page; current page is highlighted.
4. **Given** a row is not the first era in the set, **When** I view the Usage Δ column, **Then** I see the percentage change vs the previous era (e.g. +12%, -5%); positive in one visual style (e.g. green), negative in another (e.g. red).
5. **Given** the first era in the dataset has no previous era, **When** I view its Usage Δ cell, **Then** I see "-" or "N/A".
6. **Given** the table is visible, **When** numeric values are shown, **Then** numbers use thousand separators and Amount Charged is formatted as currency (e.g. $32,000). Missing CPU/GPU/RAM show "-" or "N/A".

---

### User Story 3 - Filter by era range (Priority: P3)

As a developer or account viewer, I want to choose an era range (e.g. Last Week, Last Month, Last 3/6/12 months, All Time) in the header so that both the chart and the table show only eras within that range. The filter is in a single place and drives both components.

**Why this priority**: Time-scoping is essential for relevance; without it, users may be overwhelmed by irrelevant history.

**Independent Test**: Change the Era Range dropdown; confirm both the Era vs Usage chart and the Past Eras table update to show only data within the selected range.

**Acceptance Scenarios**:

1. **Given** I am on the Activity Dashboard, **When** I look at the header, **Then** I see an "Era Range" dropdown (e.g. top right near the Developer Console title) with options: Last Week, Last Month, Last 3 Months, Last 6 Months, Last Year, All Time; default is Last Month.
2. **Given** I select a different era range, **When** the selection is applied, **Then** both the "Era vs Usage" chart and the "Past Eras" table update to show only eras within that range.
3. **Given** I have changed the era range, **When** the data has finished loading, **Then** the chart and table reflect the new range within a short, predictable time (e.g. under a few seconds).

---

### Edge Cases

- What happens when the backend (VDR Service) returns no data for the selected era range? The chart and table show an empty state or clear message; the UI does not break.
- What happens when some metrics (e.g. CPU, GPU, RAM) are not available for an era? Those cells show "-" or "N/A"; legend items for metrics with no data are hidden or disabled.
- What happens when the backend is slow or unavailable? Users see a loading state while fetching and a clear error message if the request fails; the rest of the page remains usable.
- What happens when the user selects a very large range (e.g. All Time) with many eras? The chart remains usable (e.g. up to 100+ eras) and the table uses pagination (e.g. 10–20 rows per page) so the UI stays responsive.
- What happens for the first era in the dataset? Usage Δ shows "-" or "N/A" because there is no previous era to compare.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST obtain all customer usage and charged-amount data from the organization's designated usage and billing service (VDR Service); no other source may be used for this dashboard.
- **FR-002**: The system MUST display an "Era vs Usage" line chart with era numbers on the horizontal axis and a single selectable metric on the vertical axis; the default metric MUST be amount charged (e.g. USD); the chart MUST support at least: USD charged, CPU units, GPU units, RAM units, GETs/PUTs combined, and TransferredBytes.
- **FR-003**: The system MUST provide a metric selector above the chart; when the user changes the selection, the chart and axis labels MUST update to reflect the chosen metric.
- **FR-004**: The system MUST display a "Past Eras" table with sortable columns: Era (default sort descending), GETs, PUTs, CPU, GPU, RAM, Amount Charged ($), and Usage Δ (percentage change vs previous era).
- **FR-005**: Usage Δ MUST be computed as ((current_era_value − previous_era_value) / previous_era_value) × 100; displayed as +X% or −X%; the first era in the set MUST show "-" or "N/A".
- **FR-006**: The system MUST provide pagination for the Past Eras table (Prev, page numbers, Next) with a configurable default page size (e.g. 10–20 rows); Prev disabled on first page, Next on last page; current page clearly indicated.
- **FR-007**: The system MUST provide an Era Range filter in the header with options such as Last Week, Last Month, Last 3/6/12 months, and All Time; the filter MUST apply to both the chart and the table so only eras within the selected range are shown.
- **FR-008**: The system MUST show loading states while fetching data and clear error messages when the data source is unavailable; it MUST NOT break the UI when data is missing or partial.
- **FR-009**: When a metric or era has no value (e.g. CPU/GPU/RAM not provided), the system MUST display "-" or "N/A" in the table and MUST hide or disable the corresponding legend item in the chart.
- **FR-010**: The system MUST support filtering by era range and pagination as provided by the data source where available; access to the data source MUST respect the organization's authentication and authorization requirements.

### Key Entities

- **Era**: A time period used for usage and billing; identified by an era ID; has associated usage metrics (GETs, PUTs, CPU, GPU, RAM, TransferredBytes) and charged amount (USD or designated currency).
- **Usage metric**: A measurable quantity per era (e.g. GETs, PUTs, CPU units, GPU units, RAM units, transferred bytes, amount charged); may be optional for some eras.
- **Era range**: A user-selected time scope (e.g. Last Week, Last Month, Last 3 Months, Last 6 Months, Last Year, All Time) that filters which eras are displayed in the chart and table.

## Assumptions

- The VDR Service exposes endpoints that can provide usage and charged amounts per era and support filtering by time/era range; exact endpoint contracts are defined elsewhere.
- Currency for "Amount Charged" is USD or a single designated currency; conversion rules (e.g. from CERE to USD) are defined by the organization.
- The dashboard is used by authenticated users with permission to view usage and charged data for their scope (e.g. account or tenant).
- "Era" ordering and numbering are consistent with the data source; the UI displays eras in the order provided or in a well-defined sort order (e.g. descending by era number by default).
- Design and layout follow the organization's design system (e.g. Cere Design System) for consistency with the rest of the Developer Console.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can see usage trends over eras in a chart and switch the displayed metric without leaving the page; the chart updates within a few seconds of changing the selection.
- **SC-002**: Users can inspect exact values and period-over-period change in a table; sorting and pagination work for at least 1,000+ eras without the page becoming unusable.
- **SC-003**: When the user changes the era range, both the chart and the table reflect the new range within a short, predictable time (e.g. under a few seconds).
- **SC-004**: When the data source is unavailable or returns errors, users see a clear message and loading/error states instead of a broken or blank screen.
- **SC-005**: Missing or partial data (e.g. no CPU for an era) is shown as "-" or "N/A" and does not cause incorrect calculations or layout breaks.
