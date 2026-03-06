# Data Model: Customer Usage View

**Feature**: 001-customer-usage-view
**Date**: 2026-03-05

## Entities

### CustomerEraRecord

Represents a single billing era's usage data for a customer, as returned by the VDR Service API.

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `era_id` | `number` | API | Unique era identifier (integer) |
| `transferred_bytes` | `number` | API | Total bytes transferred during the era |
| `stored_bytes` | `number` | API | Total bytes stored during the era |
| `gets` | `number` | API | Number of GET operations |
| `puts` | `number` | API | Number of PUT operations |
| `computes` | `number` | API | Number of compute operations |
| `cpu_units` | `string` | API | CPU resource units consumed (decimal string) |
| `gpu_units` | `string` | API | GPU resource units consumed (decimal string) |
| `ram_units` | `string` | API | RAM resource units consumed (decimal string) |
| `charge` | `string` | API | Total charge for the era (decimal string) |
| `time_start` | `number` | API | Era start timestamp in milliseconds (epoch) |
| `time_end` | `number` | API | Era end timestamp in milliseconds (epoch) |

**Validation rules**:
- All numeric fields are non-negative (zero-defaulted by backend when absent).
- String decimal fields (`cpu_units`, `gpu_units`, `ram_units`, `charge`) are always present and parseable via `parseFloat()`.
- `time_start < time_end` for any valid era.
- `era_id` is unique across the dataset.

**Notes**:
- `stored_bytes` and `computes` are received from the API but excluded from the chart metric selector and table columns in this release.
- The API returns eras in descending order (newest first). The store reverses this for chart display (ascending).

### MetricKey

Enum-like union type representing a selectable chart metric.

| Value | Maps to Field | Display Label |
|-------|---------------|---------------|
| `'charge'` | `charge` | Amount Charged ($) |
| `'cpu_units'` | `cpu_units` | CPU Units |
| `'gpu_units'` | `gpu_units` | GPU Units |
| `'ram_units'` | `ram_units` | RAM Units |
| `'gets'` | `gets` | GETs |
| `'puts'` | `puts` | PUTs |
| `'transferred_bytes'` | `transferred_bytes` | Transferred Bytes |

### EraRangePreset

Enum-like union type representing a time-range filter preset.

| Value | Label | Calculation (relative to `Date.now()`) |
|-------|-------|----------------------------------------|
| `'last_week'` | Last Week | `timeFrom = now - 7 days` |
| `'last_month'` | Last Month | `timeFrom = now - 30 days` |
| `'last_3_months'` | Last 3 Months | `timeFrom = now - 90 days` |
| `'last_6_months'` | Last 6 Months | `timeFrom = now - 180 days` |
| `'all_time'` | All Time | No `timeFrom`/`timeTo` params sent |

**Default**: `'last_month'`

### TableRowData (derived)

Extends `CustomerEraRecord` with a computed field for table display.

| Field | Type | Description |
|-------|------|-------------|
| *...all CustomerEraRecord fields* | — | Inherited |
| `usageDelta` | `number \| null` | Percentage change in `charge` vs the immediately preceding era. `null` for the oldest era in the dataset. |

**Delta formula**: `((current_charge - previous_charge) / previous_charge) * 100`

**Edge cases**:
- Oldest era in dataset: `usageDelta = null` → displayed as `—`
- Previous era charge is `0`: `usageDelta = null` → displayed as `—` (avoids division by zero)
- Current era charge is `0` and previous is non-zero: `usageDelta = -100` → displayed as `-100%`

## State Model (CustomerUsageStore)

### Observables

| Observable | Type | Default | Description |
|------------|------|---------|-------------|
| `eras` | `CustomerEraRecord[]` | `[]` | Raw era records from the API |
| `isLoading` | `boolean` | `false` | True while a fetch is in progress |
| `error` | `string \| null` | `null` | Error message if the last fetch failed |
| `selectedMetric` | `MetricKey` | `'charge'` | Currently selected chart metric |
| `eraRangePreset` | `EraRangePreset` | `'last_month'` | Currently selected range filter |

### Actions

| Action | Trigger | Side Effects |
|--------|---------|--------------|
| `fetchEras(customerId)` | Range change, initialization, retry | Sets `isLoading=true`, calls VDR API, updates `eras` or `error`, sets `isLoading=false` |
| `setMetric(key)` | Metric selector change | Updates `selectedMetric` (no fetch) |
| `setEraRange(preset)` | Range selector change | Updates `eraRangePreset`, triggers `fetchEras()` |
| `retry()` | Error banner retry button | Clears `error`, re-invokes `fetchEras()` |
| `reset()` | Account change / logout | Clears all observables to defaults |

### Computed Properties

| Computed | Returns | Description |
|----------|---------|-------------|
| `chartData` | `CustomerEraRecord[]` | `eras` reversed (ascending by `era_id`) for chart X-axis |
| `tableData` | `TableRowData[]` | `eras` as-is (descending) with `usageDelta` appended per row |
| `isEmpty` | `boolean` | `!isLoading && eras.length === 0 && !error` |

## Data Flow

```
User selects era range
  → store.setEraRange(preset)
    → store.fetchEras(accountStore.address)
      → VdrServiceApi.getCustomerEras(customerId, { timeFrom, timeTo })
        → API response: CustomerEraRecord[]
          → store.eras = response (descending)
            → store.chartData (computed, ascending)
            → store.tableData (computed, with deltas)
              → Chart re-renders with chartData
              → Table re-renders with tableData

User selects metric
  → store.setMetric(key)
    → Chart re-renders (reads store.selectedMetric + store.chartData)
    → No API call

User clicks pagination
  → Component-local page state changes
    → Table slices store.tableData[start:end]
    → No API call, no store change
```
