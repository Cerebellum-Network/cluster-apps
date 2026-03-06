# VDR Service — Provider API Contract

**Branch**: `002-provider-dashboard` | **Date**: 2026-03-06

The frontend consumes these provider endpoints from the VDR Service. Base URL is configured via `VITE_VDR_SERVICE_ENDPOINT` environment variable.

## GET `/api/provider/{providerId}/eras`

Returns all eras for a provider in **descending order** (newest first).

### Parameters

| Parameter | Location | Type | Required | Description |
|-----------|----------|------|----------|-------------|
| `providerId` | path | string | Yes | Provider wallet address |
| `from` | query | number | No | Minimum era ID (inclusive) |
| `to` | query | number | No | Maximum era ID (inclusive) |
| `timeFrom` | query | number | No | Minimum timestamp in ms (inclusive) |
| `timeTo` | query | number | No | Maximum timestamp in ms (inclusive) |

**Constraint**: `from`/`to` and `timeFrom`/`timeTo` are mutually exclusive.

### Response — 200 OK

```json
[
  {
    "era_id": 3626205,
    "transferred_bytes": 2048000,
    "stored_bytes": 1024000,
    "gets": 30000,
    "puts": 6000,
    "computes": 0,
    "cpu_units": "1000",
    "gpu_units": "200",
    "ram_units": "4000",
    "latency": { "p50": 12, "p95": 45, "p99": 120 },
    "availability": { "uptime_percent": 99.95 },
    "bandwidth": { "mbps": 850 },
    "reward": "1800000",
    "time_start": 1740578400000,
    "time_end": 1740578879999
  }
]
```

### Field Types

| Field | Type | Notes |
|-------|------|-------|
| `era_id` | integer | |
| `transferred_bytes` | integer | Zero-defaulted |
| `stored_bytes` | integer | Zero-defaulted |
| `gets` | integer | Zero-defaulted |
| `puts` | integer | Zero-defaulted |
| `computes` | integer | Zero-defaulted |
| `cpu_units` | string | Decimal string (12-decimal fixed-point) |
| `gpu_units` | string | Decimal string |
| `ram_units` | string | Decimal string |
| `latency` | object \| null | Omitted or `null` when unavailable |
| `availability` | object \| null | Omitted or `null` when unavailable |
| `bandwidth` | object \| null | Omitted or `null` when unavailable |
| `reward` | string | Decimal string |
| `time_start` | integer | Epoch milliseconds |
| `time_end` | integer | Epoch milliseconds |

### Error Responses

| Status | Body | Frontend handling |
|--------|------|-------------------|
| 404 | `{"error": "not_found", "message": "..."}` | Return empty array |
| 5xx | varies | Throw "Service temporarily unavailable" |
| Other 4xx | varies | Throw "Failed to load usage data" |
| No response | — | Throw "Unable to connect" |

---

## GET `/api/provider/{providerId}/era/{eraId}`

Returns a single era record for a provider.

### Parameters

| Parameter | Location | Type | Required | Description |
|-----------|----------|------|----------|-------------|
| `providerId` | path | string | Yes | Provider wallet address |
| `eraId` | path | number | Yes | Era identifier |

### Response — 200 OK

Same shape as a single element of the eras array above.

### Error Responses

| Status | Body | Frontend handling |
|--------|------|-------------------|
| 404 | `{"error": "not_found", "message": "..."}` | Return `null` |
| 5xx | varies | Throw "Service temporarily unavailable" |
| Other 4xx | varies | Throw "Failed to load usage data" |
| No response | — | Throw "Unable to connect" |
