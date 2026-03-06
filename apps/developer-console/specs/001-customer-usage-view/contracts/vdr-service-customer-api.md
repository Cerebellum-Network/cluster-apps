# Contract: VDR Service Customer API

**Feature**: 001-customer-usage-view
**Date**: 2026-03-05
**Base URL**: Configured via `VITE_VDR_SERVICE_ENDPOINT` environment variable

## Endpoints Consumed

### GET `/api/customer/{customerId}/eras`

Returns all era records for a customer within an optional range.

**Path parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `customerId` | `string` | Customer identifier (wallet address) |

**Query parameters** (all optional, mutually exclusive pairs):

| Parameter | Type | Description |
|-----------|------|-------------|
| `from` | `i64` | Minimum era ID (inclusive) |
| `to` | `i64` | Maximum era ID (inclusive) |
| `timeFrom` | `i64` | Minimum timestamp in ms (inclusive) |
| `timeTo` | `i64` | Maximum timestamp in ms (inclusive) |

**Mutual exclusivity**: `from`/`to` and `timeFrom`/`timeTo` MUST NOT be combined. Use one pair or neither.

**Response**: `200 OK`

```json
[
  {
    "era_id": 3626205,
    "transferred_bytes": 1024000,
    "stored_bytes": 512000,
    "gets": 15000,
    "puts": 3000,
    "computes": 0,
    "cpu_units": "500",
    "gpu_units": "100",
    "ram_units": "2000",
    "charge": "2350000",
    "time_start": 1740578400000,
    "time_end": 1740578879999
  }
]
```

**Response ordering**: Descending by `era_id` (newest first).

**Empty result**: Returns `[]` (empty array) when no eras match the filter criteria.

**Field types**:
- Integer fields: `era_id`, `transferred_bytes`, `stored_bytes`, `gets`, `puts`, `computes`, `time_start`, `time_end`
- Decimal string fields: `cpu_units`, `gpu_units`, `ram_units`, `charge` (converted from 12-decimal fixed-point on backend)
- All 12 fields are always present (zero-defaulted when absent on backend)

### GET `/api/customer/{customerId}/era/{eraId}`

Returns a single era record for a customer.

**Path parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `customerId` | `string` | Customer identifier (wallet address) |
| `eraId` | `number` | Era identifier |

**Response**: `200 OK` — Same shape as one element of the array above.

**Error response**: `404 Not Found`

```json
{
  "error": "not_found",
  "message": "Era not found for customer"
}
```

## TypeScript Interface (for `packages/api`)

```typescript
interface VdrApiClient {
  getCustomerEras(customerId: string, params?: {
    from?: number;
    to?: number;
    timeFrom?: number;
    timeTo?: number;
  }): Promise<CustomerEraRecord[]>;

  getCustomerEra(
    customerId: string,
    eraId: number,
  ): Promise<CustomerEraRecord | null>;
}
```

## Error Handling Contract

| HTTP Status | Client Behavior |
|-------------|-----------------|
| `200` | Parse response body as `CustomerEraRecord[]` or `CustomerEraRecord` |
| `404` | Return `null` (single era) or `[]` (eras list) — do not throw |
| `4xx` (other) | Throw with user-friendly message: "Failed to load usage data. Please try again." |
| `5xx` | Throw with user-friendly message: "Service temporarily unavailable. Please try again later." |
| Network error | Throw with user-friendly message: "Unable to connect. Please check your connection." |

## Usage in This Feature

- **List eras**: `getCustomerEras(walletAddress, { timeFrom, timeTo })` — used on page load and era range change.
- **Single era**: `getCustomerEra(walletAddress, eraId)` — reserved for future single-era detail view (not used in initial release).
