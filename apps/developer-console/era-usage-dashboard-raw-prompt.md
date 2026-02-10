# Raw Prompt: Era Usage Dashboard Components

Add the following components to the Activity Dashboard of Developer Console based on the wireframe:

## Component 1: Era vs Usage Line Chart

Add a line chart section titled "Era vs Usage" that displays usage data over different eras.

**Chart Specifications**:
- X-axis: Era No (showing era numbers 1, 2, 3, etc.)
- Y-axis: Amount ($) or selected metric value
- Chart type: Line chart with grey line and circular markers at each data point
- Minimum height: 400px
- Responsive design

**Metric Dropdown** (positioned above chart, right-aligned):
- Default selection: "Amount Charged ($)"
- Dropdown options:
  * USD($) Charged
  * CPU Units
  * GPU Units
  * RAM Units
  * GETs/PUTs
  * TransferredBytes
- Chart updates dynamically when metric selection changes
- Y-axis label updates based on selected metric

**Legend** (positioned below chart):
- Display legend items with circular icons:
  * CPU
  * GPU
  * RAM
  * GETs
  * PUTs
  * Transfer
  * Amount ($)

**Interactivity**:
- Tooltip on hover showing era details and selected metric value
- Chart should handle 1-100+ eras efficiently

## Component 2: Past Eras Table

Add a table section titled "Past Eras" displaying historical era data.

**Table Columns**:
- Era (default sorted descending, sortable)
- GETs (sortable)
- PUTs (sortable)
- CPU (sortable)
- GPU (sortable)
- RAM (sortable)
- Amount Charged ($) (sortable, formatted as currency: $32,000, $28,000, etc.)
- Usage Δ (sortable, shows percentage change: +12%, +7%, +6%, etc.)

**Usage Δ Calculation**:
- Formula: ((current_era_value - previous_era_value) / previous_era_value) * 100
- Format: +X% for positive changes, -X% for negative changes
- First era in dataset shows "-" or "N/A" (no previous era to compare)

**Pagination** (positioned below table, centered):
- Controls: "< Prev", page numbers (1, 2, 3, 4, etc.), "Next >"
- Default: 10-20 rows per page
- Current page number highlighted
- Prev button disabled on first page
- Next button disabled on last page

**Table Features**:
- All columns are sortable (click header to toggle ascending/descending)
- Clean, modern styling with alternating row colors
- Numbers formatted with thousand separators (e.g., 1,200)
- Usage Δ column: green color for positive changes, red for negative

## Component 3: Era Range Filter

Add "Era Range" dropdown in the header section (top right, next to "Developer Console" title).

**Dropdown Specifications**:
- Label: "Era Range"
- Default selection: "Last Month"
- Options:
  * Last Week
  * Last Month
  * Last 3 Months
  * Last 6 Months
  * Last Year
  * All Time

**Filter Behavior**:
- Filter applies to both "Era vs Usage" chart and "Past Eras" table
- Both components update when Era Range selection changes
- Data is filtered to show only eras within the selected time range

## Data Requirements

**Data Source**: Customer Usage and Charged data MUST be fetched from endpoints provided by VDR Service.

### VDR Service Endpoints

The dashboard MUST fetch data from VDR Service endpoints. Specific endpoint details should be documented separately, but the implementation must:

- Fetch Customer Usage data per era from VDR Service
- Fetch Charged amounts (USD or CERE) per era from VDR Service
- Support filtering by era range/time period
- Handle pagination if VDR Service endpoints support it
- Include authentication/authorization as required by VDR Service

**Required Data Fields** (from VDR Service endpoints):
- Era ID (eraId)
- GETs count
- PUTs count
- TransferredBytes
- Amount Charged (USD or CERE)
- CPU Units (if available)
- GPU Units (if available)
- RAM Units (if available)
- Usage metrics per era

**VDR Service Integration**:
- Create or update store/service to fetch data from VDR Service endpoints
- Handle authentication/authorization for VDR Service API calls
- Implement error handling for failed API requests
- Cache data appropriately to minimize API calls
- Support pagination if VDR Service endpoints support it

**Data Handling**:
- If CPU/GPU/RAM data is unavailable from VDR Service, display "-" or "N/A" in table cells
- Hide or disable legend items if no data is available for that metric
- Handle missing data gracefully in chart (don't break, show empty state if needed)
- Display loading states while fetching from VDR Service
- Display error messages if VDR Service endpoints are unavailable

## Metric Dropdown Behavior

When user selects different metrics from dropdown:

1. **USD($) Charged**: Display totalValue converted to USD (may need CERE to USD conversion rate)
2. **CPU Units**: Display CPU usage units (if available in data)
3. **GPU Units**: Display GPU usage units (if available in data)
4. **RAM Units**: Display RAM usage units (if available in data)
5. **GETs/PUTs**: Display combined GETs + PUTs count
6. **TransferredBytes**: Display transferredBytes value

Chart Y-axis and data points update to reflect selected metric.

## Implementation Notes

- Use recharts library for chart visualization (already in dependencies)
- Use Material-UI components for table and dropdowns (already in use)
- **Data Fetching**: Create or update store/service to fetch Customer Usage and Charged data from VDR Service endpoints
- Follow existing code patterns (MobX stores, React hooks)
- Use existing UI library (@cluster-apps/ui, Material-UI)
- Chart should render smoothly with up to 100 eras
- Table pagination should work efficiently with 10-1000+ eras
- Both components should update within 1 second when filters change

**VDR Service Integration Requirements**:
- Implement API client for VDR Service endpoints
- Store should handle VDR Service API calls (create new store or extend existing ActivityStore)
- Support error handling and retry logic for VDR Service API failures
- Implement loading states during VDR Service data fetching
- Cache VDR Service responses appropriately to reduce API calls
- Handle authentication tokens/credentials for VDR Service if required

## UI Component Standards

### III.I. UI Component Standards
#### III.II Design System Requirement
All UI components MUST use the Cere Design System (@cere/cere-design-system).

#### III.III Component Reference
Available components and their APIs are documented at:
`node_modules/@cere/cere-design-system/.specify/memory/components-reference.md`

## Layout Structure

```
[Developer Console Title]                    [Era Range Dropdown]
─────────────────────────────────────────────────────────────────

[Era vs Usage]
[Metric Dropdown: Amount Charged ($)]
[Line Chart - Era vs Usage]
[Legend: CPU, GPU, RAM, GETs, PUTs, Transfer, Amount ($)]

[Past Eras]
[Table with columns: Era, GETs, PUTs, CPU, GPU, RAM, Amount Charged ($), Usage Δ]
[Pagination: < Prev | 1 | 2 | 3 | 4 | Next >]
```

## Visual Design

- Chart: Grey line with circular markers
- Table: Clean, modern styling with alternating row colors
- Sort indicators: Up/down arrows on sorted column headers
- Usage Δ: Green for positive (+X%), red for negative (-X%)
- Currency formatting: $32,000 (with thousand separators)
- Pagination: Current page highlighted, disabled buttons grayed out
