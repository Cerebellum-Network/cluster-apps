# Quickstart: Customer Usage View

**Feature**: 001-customer-usage-view
**Date**: 2026-03-05

## Prerequisites

- Node.js (version compatible with existing workspace)
- npm (workspace-level install)
- Access to a VDR Service instance (dev/stage/prod)

## Setup

1. **Install dependencies** (from repo root):

   ```bash
   npm i
   ```

2. **Add VDR Service endpoint** to the appropriate `.env` file at the repo root:

   ```bash
   # Add to .env.dev, .env.stage, or .env.prod
   VITE_VDR_SERVICE_ENDPOINT=https://your-vdr-service-url
   ```

3. **Copy environment file** (if not already done):

   ```bash
   cp .env.stage .env
   ```

4. **Start the application**:

   ```bash
   npm run start -w apps/developer-console
   ```

5. **Open** http://localhost:5173/

6. **Log in** with your email (Cere Embed Wallet).

7. **Navigate** to "Customer Usage" in the sidebar.

## Verify It Works

1. After login, the Customer Usage page should appear in the sidebar navigation.
2. The page loads with "Last Month" selected by default.
3. If you have usage data, you should see:
   - A line chart showing "Amount Charged ($)" over eras
   - A table of past eras with usage metrics and delta percentages
4. If you have no usage data, you should see: "No usage data for the selected period."

## Key Interactions to Test

| Action | Expected Result |
|--------|-----------------|
| Open Customer Usage page | Chart and table render with data (or empty state) |
| Change metric selector to "CPU Units" | Chart Y-axis updates instantly (no loading spinner) |
| Change era range to "Last 3 Months" | Loading indicator appears; chart and table refresh |
| Hover over chart data point | Tooltip shows formatted value and era number |
| Click page 2 in table pagination | Table shows next 10 rows instantly |
| Disconnect network, click "Retry" | Error banner appears; retry button re-fetches |

## File Locations

| Concern | Path |
|---------|------|
| API client | `packages/api/src/VdrServiceApi/` |
| MobX store | `apps/developer-console/src/stores/CustomerUsageStore/` |
| Page component | `apps/developer-console/src/applications/CustomerUsage/` |
| UI components | `apps/developer-console/src/components/CustomerUsage/` |
| Store hook | `apps/developer-console/src/hooks/useCustomerUsageStore.ts` |
| Formatters | `apps/developer-console/src/utils/formatters.ts` |
| Env config | Root `.env.*` files → `VITE_VDR_SERVICE_ENDPOINT` |
