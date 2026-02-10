<!--
Sync Impact Report
==================
Version change: (none) → 1.0.0
Modified principles: N/A (initial creation)
Added sections: Core Principles (I–V), UI and Layout Standards, Implementation and Performance, Governance
Removed sections: N/A
Templates:
  .specify/templates/plan-template.md – ✅ updated (Constitution Check now references .specify/memory/constitution.md and principle list)
  .specify/templates/spec-template.md – ✅ Scope/requirements alignment (no update needed)
  .specify/templates/tasks-template.md – ✅ Task categorization compatible (no update needed)
  .cursor/commands/*.md – ✅ No constitution path updates required (project uses .specify not .specify.specify)
Follow-up TODOs: None. RATIFICATION_DATE set to first adoption date (2025-02-10).
-->

# Developer Console Constitution

## Core Principles

### I. VDR Service as Data Source

All Customer Usage and Charged data MUST be fetched from endpoints provided by the VDR Service. No alternate data sources may be used for usage or charged-amount data in the Activity Dashboard (Era vs Usage, Past Eras). Implementation MUST support filtering by era range/time period and MUST handle authentication/authorization as required by the VDR Service.

**Rationale**: Single source of truth for usage and billing ensures consistency and correct integration with backend systems.

### II. Cere Design System

All UI components MUST use the Cere Design System (`@cere/cere-design-system`). Component reference and APIs are documented at `node_modules/@cere/cere-design-system/.specify/memory/components-reference.md`. Use of other UI libraries (e.g. Material-UI, `@cluster-apps/ui`) MUST align with or wrap Cere Design System where applicable.

**Rationale**: Consistent look, behavior, and accessibility across the Developer Console.

### III. Stack and Code Patterns

New features MUST follow existing code patterns: MobX stores for state, React hooks for component logic. Charts MUST use the recharts library; tables and dropdowns MUST use the project’s established UI stack (Cere Design System, Material-UI, `@cluster-apps/ui` as in use today). New stores or services MUST integrate with the existing store architecture (e.g. ActivityStore, PaymentsStore).

**Rationale**: Consistency and maintainability; avoids fragmentation of state and UI patterns.

### IV. VDR Integration Standards

Integration with the VDR Service MUST include: a dedicated API client or store layer for VDR endpoints; authentication/authorization handling; structured error handling and retry logic for failed requests; loading states during data fetch; and appropriate caching to minimize API calls. Pagination MUST be supported when the VDR Service exposes it.

**Rationale**: Reliable, observable, and efficient integration with the VDR Service.

### V. Data Handling and Resilience

Missing or unavailable metrics (e.g. CPU/GPU/RAM when not provided by VDR) MUST be displayed as "-" or "N/A" in tables and MUST NOT break the UI. Legend items for metrics with no data MUST be hidden or disabled. Loading states MUST be shown while fetching from the VDR Service; error states MUST be shown when endpoints are unavailable. The chart MUST handle 1–100+ eras without breaking; the Past Eras table MUST support 10–1000+ eras with pagination.

**Rationale**: Predictable, robust UX and performance under partial or failing data.

## UI and Layout Standards

- **Layout**: Activity Dashboard MUST follow the defined structure: header with Developer Console title and Era Range dropdown; Era vs Usage section (metric dropdown, line chart, legend); Past Eras section (sortable table, pagination).
- **Charts**: Line chart with grey line and circular markers; minimum height 400px; responsive; tooltips for era and selected metric.
- **Tables**: Sortable columns, alternating row colors, thousand separators for numbers, currency formatted (e.g. $32,000), Usage Δ with green for positive and red for negative.
- **Pagination**: Centered below table; Prev/Next and page numbers; current page highlighted; Prev disabled on first page, Next on last page; default 10–20 rows per page.

## Implementation and Performance

- Filter changes (Era Range or metric selection) MUST result in chart and table updates within 1 second.
- Chart MUST render smoothly for 1–100+ eras; table pagination MUST perform efficiently for 10–1000+ eras.
- Usage Δ MUST be computed as ((current_era_value - previous_era_value) / previous_era_value) * 100, formatted as +X% or -X%; first era shows "-" or "N/A".

## Governance

- This constitution supersedes ad-hoc practices for the Developer Console Activity Dashboard and related VDR-backed features.
- Amendments require: documented change, version bump per semantic versioning (MAJOR: incompatible principle/section changes; MINOR: new principles/sections; PATCH: clarifications/typos), and update of this file and Sync Impact Report.
- All work touching data source, design system, or VDR integration MUST be checked for compliance with the relevant principles during review.
- For runtime development guidance, use README.md, STRUCTURE.md, and the Cere Design System component reference.

**Version**: 1.0.0 | **Ratified**: 2025-02-10 | **Last Amended**: 2025-02-10
