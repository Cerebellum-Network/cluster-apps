# Data Model: Node Provider Dashboard

**Branch**: `002-provider-dashboard` | **Date**: 2026-03-06

## Entities

### ProviderEraRecord

A single era's usage and reward data for a provider node. Mirrors the API response shape per Constitution Principle VI (API Contract Fidelity).

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `era_id` | `number` | No | Unique era identifier |
| `transferred_bytes` | `number` | No | Bytes transferred (zero-defaulted) |
| `stored_bytes` | `number` | No | Bytes stored (zero-defaulted) |
| `gets` | `number` | No | GET operations count |
| `puts` | `number` | No | PUT operations count |
| `computes` | `number` | No | Compute operations count |
| `cpu_units` | `string` | No | CPU usage as decimal string (12-decimal fixed-point) |
| `gpu_units` | `string` | No | GPU usage as decimal string |
| `ram_units` | `string` | No | RAM usage as decimal string |
| `latency` | `QoSLatency` | Yes | Latency percentiles; `null` when unavailable |
| `availability` | `QoSAvailability` | Yes | Uptime percentage; `null` when unavailable |
| `bandwidth` | `QoSBandwidth` | Yes | Bandwidth in Mbps; `null` when unavailable |
| `reward` | `string` | No | Reward amount as decimal string |
| `time_start` | `number` | No | Era start timestamp (epoch ms) |
| `time_end` | `number` | No | Era end timestamp (epoch ms) |

**Validation**:
- `cpu_units`, `gpu_units`, `ram_units`, `reward` are decimal strings — parsed to `number` only at display/chart time (Principle III).
- `latency`, `availability`, `bandwidth` are `null` when absent from API response — consumers MUST show fallback UI.

### QoSLatency

| Field | Type | Description |
|-------|------|-------------|
| `p50` | `number` | 50th percentile latency (ms) |
| `p95` | `number` | 95th percentile latency (ms) |
| `p99` | `number` | 99th percentile latency (ms) |

### QoSAvailability

| Field | Type | Description |
|-------|------|-------------|
| `uptime_percent` | `number` | Uptime percentage (0–100) |

### QoSBandwidth

| Field | Type | Description |
|-------|------|-------------|
| `mbps` | `number` | Bandwidth in megabits per second |

### ProviderTableRowData

Extends `ProviderEraRecord` with a computed delta field for table display.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| *(all ProviderEraRecord fields)* | | | |
| `rewardDelta` | `number` | Yes | Percentage change from prior era's reward. `null` for the oldest era. |

**Computation**: `((current_reward - previous_reward) / previous_reward) * 100`. "Previous" = next element in descending-order array (lower `era_id`).

## Enumerations

### ProviderMetricKey

Selectable chart Y-axis dimension.

| Value | Label | Source Field | Format |
|-------|-------|-------------|--------|
| `'reward'` | Reward Earned ($) | `reward` | Currency `$XX,XXX` |
| `'cpu_units'` | CPU Units | `cpu_units` | Decimal |
| `'gpu_units'` | GPU Units | `gpu_units` | Decimal |
| `'ram_units'` | RAM Units | `ram_units` | Decimal |
| `'gets'` | GETs | `gets` | Integer |
| `'puts'` | PUTs | `puts` | Integer |
| `'transferred_bytes'` | Transferred Bytes | `transferred_bytes` | Integer |

### EraRangePreset (reused)

Shared with Customer view via `@cluster-apps/api`.

| Value | Label | Offset |
|-------|-------|--------|
| `'last_week'` | Last Week | 7 days |
| `'last_month'` | Last Month | 30 days |
| `'last_3_months'` | Last 3 Months | 90 days |
| `'last_6_months'` | Last 6 Months | 180 days |
| `'all_time'` | All Time | No filter |

## Relationships

```
ProviderEraRecord
├── 0..1 QoSLatency       (nullable composition)
├── 0..1 QoSAvailability   (nullable composition)
└── 0..1 QoSBandwidth      (nullable composition)

ProviderTableRowData extends ProviderEraRecord
└── + rewardDelta: number | null (computed at store level)
```

## Store State (ProviderUsageStore)

| Observable | Type | Default | Description |
|------------|------|---------|-------------|
| `eras` | `ProviderEraRecord[]` | `[]` | Raw API response (descending order) |
| `isLoading` | `boolean` | `false` | Fetch in progress |
| `error` | `string \| null` | `null` | Error message from last failed fetch |
| `selectedMetric` | `ProviderMetricKey` | `'reward'` | Chart Y-axis selection |
| `eraRangePreset` | `EraRangePreset` | `'all_time'` | Active era range filter |

| Computed | Type | Derivation |
|----------|------|------------|
| `chartData` | `ProviderEraRecord[]` | `eras` reversed (ascending by `era_id`) |
| `tableData` | `ProviderTableRowData[]` | `eras` with `rewardDelta` appended |
| `isEmpty` | `boolean` | `!isLoading && eras.length === 0 && !error` |
