<!--
  Sync Impact Report
  ==================
  Version change: N/A → 1.0.0 (initial ratification)

  Principles established:
    I.   Design System Conformity (NEW)
    II.  Pattern Consistency (NEW)
    III. Data Precision & Formatting (NEW)
    IV.  Resilient Data Layer (NEW)
    V.   Accessibility & Responsiveness (NEW)

  Added sections:
    - Core Principles (5 principles)
    - Technology Stack Constraints
    - Development Workflow
    - Governance

  Removed sections: N/A (initial version)

  Templates requiring updates:
    - .specify/templates/plan-template.md        ✅ compatible (Constitution Check section aligns)
    - .specify/templates/spec-template.md         ✅ compatible (FR/SC sections cover all principles)
    - .specify/templates/tasks-template.md        ✅ compatible (phase structure supports story-driven delivery)
    - .specify/templates/checklist-template.md    ✅ compatible (category structure can map to principles)
    - .specify/templates/agent-file-template.md   ✅ compatible (no outdated references)

  Follow-up TODOs: None
-->

# Developer Console Constitution

## Core Principles

### I. Design System Conformity

All UI components MUST use the Cere Design System (`@cere/cere-design-system`) as the primary component library. Material-UI and `@cluster-apps/ui` MAY be used where already present in the codebase and aligned with the design system. No custom styling that diverges from the design system is permitted. Chart visualization MUST use `recharts`.

**Rationale**: A unified design language ensures visual consistency, reduces maintenance burden, and accelerates development by reusing vetted components.

### II. Pattern Consistency

All new code MUST follow existing Developer Console patterns:
- MobX stores for application state management.
- React hooks for component-level logic.
- Dedicated API client modules for external service communication.
- The established project directory structure and naming conventions.

New architectural patterns MUST NOT be introduced without explicit justification documented in the relevant plan.

**Rationale**: Consistency lowers onboarding friction, simplifies code review, and prevents architectural drift across features.

### III. Data Precision & Formatting

- Decimal string fields from backend APIs (`charge`, `cpu_units`, `gpu_units`, `ram_units`) MUST be handled with care to avoid floating-point precision loss during parsing and computation.
- All user-facing numbers MUST use `Intl.NumberFormat` for locale-aware display.
- Currency values MUST be prefixed with `$`.
- Percentage deltas MUST show explicit sign (`+` / `-`).
- Computed values (e.g., usage delta percentages) MUST have clearly defined formulas and edge-case handling (e.g., division by zero, missing prior record).

**Rationale**: Financial and usage metrics are the primary output of the console; incorrect or poorly formatted numbers erode user trust.

### IV. Resilient Data Layer

Every API client module MUST implement:
- Authentication header injection from the existing auth context.
- Structured error handling: HTTP 404 resolves to `null`/empty (not a thrown error); 4xx/5xx errors produce user-friendly messages.
- Automatic retry with exponential backoff (max 3 attempts).
- Observable loading states (`isLoading`, `error`) exposed to the UI.
- Caching where appropriate to avoid redundant fetches (e.g., metric selector changes MUST NOT trigger re-fetches when data is already loaded).

**Rationale**: The console depends on external services (VDR Service); graceful degradation and clear feedback are essential for user experience.

### V. Accessibility & Responsiveness

- All UI MUST meet WCAG AA color contrast requirements.
- Interactive chart elements (tooltips) MUST be keyboard-navigable.
- Data tables MUST follow WAI-ARIA table patterns.
- Layouts MUST adapt to container width; tables MUST horizontally scroll on narrow viewports.
- Skeleton/spinner loading indicators MUST be used instead of blank screens.

**Rationale**: Accessibility is a non-negotiable quality attribute; responsive design ensures usability across device classes.

## Technology Stack Constraints

| Concern              | Required Technology                                          |
|----------------------|--------------------------------------------------------------|
| UI Framework         | React (existing)                                             |
| Chart Library        | `recharts` (`<LineChart>` or `<AreaChart>`)                  |
| Design System        | `@cere/cere-design-system`, Material-UI, `@cluster-apps/ui` |
| State Management     | MobX (observable stores, computed properties, actions)       |
| Language             | TypeScript (strict)                                          |
| Data Fetching        | Dedicated API client modules per external service            |
| Configuration        | Environment variables (e.g., `REACT_APP_VDR_SERVICE_URL`)   |
| Number Formatting    | `Intl.NumberFormat`                                          |
| Build / Dev Server   | Existing Vite toolchain (`npm run start`, port 5173)         |

Additional constraints:
- Maximum ~500 era records per API call (largest realistic dataset for 6 months).
- Client-side pagination (page size = 10) — no server-side pagination required.
- Metric selector changes MUST be instant (no re-fetch; all data already loaded).

## Development Workflow

1. **Feature branches**: All work MUST occur on a feature branch named per convention (`[###-feature-name]`).
2. **Spec-driven development**: Every feature MUST have a specification (`spec.md`) and an implementation plan (`plan.md`) before coding begins.
3. **Story-independent delivery**: User stories MUST be independently implementable and testable. Each story MUST deliver demonstrable value on its own.
4. **Component hierarchy**: UI MUST be decomposed into focused, reusable components following the component hierarchy defined in the specification.
5. **Store-first data flow**: Data fetching and state MUST be managed in MobX stores; components MUST consume stores via React hooks or injection — no inline fetch calls in components.
6. **Error & loading states**: Every data-dependent view MUST handle loading, empty, and error states explicitly. Error states MUST include a manual retry action.
7. **Commit discipline**: Commit after each task or logical group. Commit messages MUST be descriptive and reference the task ID where applicable.

## Governance

- This constitution supersedes ad-hoc practices for all Developer Console feature work.
- Amendments require: (1) a documented rationale, (2) review by at least one team member, and (3) a migration plan for any in-flight work affected by the change.
- Version increments follow semantic versioning: MAJOR for principle removals/redefinitions, MINOR for new principles or material expansions, PATCH for clarifications and typo fixes.
- All pull requests and code reviews MUST verify compliance with these principles. Reviewers SHOULD use the Constitution Check section in the plan template as a gate.
- Complexity beyond what a principle permits MUST be justified in the plan's Complexity Tracking table.

**Version**: 1.0.0 | **Ratified**: 2026-03-05 | **Last Amended**: 2026-03-05
