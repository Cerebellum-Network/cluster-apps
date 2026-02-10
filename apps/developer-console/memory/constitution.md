<!--
Sync Impact Report:
Version change: 1.0.0 → 1.1.0
Modified principles: None
Added sections: External Service Integration (Principle VI)
Removed sections: None
Templates requiring updates:
  ✅ spec-template.md - No changes needed (already supports requirements section)
  ✅ plan-template.md - No changes needed (Constitution Check section exists)
  ✅ tasks-template.md - No changes needed (task structure supports API integration requirements)
Follow-up TODOs: None
-->

# Developer Console Constitution

## Core Principles

### I. Component-Based Architecture

All features MUST be implemented as reusable, self-contained components. Components must be independently testable and documented with clear purpose. No organizational-only components allowed.

### II. State Management

Application state MUST be managed using MobX stores. All data fetching and state updates MUST go through stores. React components MUST use observer pattern for reactive updates.

### III. UI Component Standards (NON-NEGOTIABLE)

All UI components MUST use the Cere Design System (@cere/cere-design-system). No custom UI components should be created when equivalent Cere Design System components exist. Available components and their APIs are documented at: `node_modules/@cere/cere-design-system/.specify/memory/components-reference.md`

**Rationale**: Ensures consistent design language, reduces maintenance burden, and provides standardized accessibility and behavior patterns across the application.

### IV. Data Visualization

Charts and graphs MUST use recharts library for visualization. All data visualizations MUST be responsive and handle datasets of varying sizes (1-1000+ items) efficiently.

### V. Type Safety

All code MUST use TypeScript with strict type checking enabled. No `any` types allowed except in exceptional cases with explicit justification. All data models MUST have type definitions.

### VI. External Service Integration

All external service integrations (e.g., VDR Service, APIs) MUST be implemented through dedicated stores or services. External service calls MUST include:

- Proper authentication/authorization handling
- Comprehensive error handling and retry logic
- Appropriate caching strategies to minimize API calls
- Loading state management
- Type-safe API client implementations

**Rationale**: Centralized external service integration ensures consistent error handling, improves maintainability, and provides a single point of control for API interactions. This pattern is essential for services like VDR Service that provide Customer Usage and Charged data.

## Additional Constraints

### Technology Stack

- **Frontend Framework**: React with TypeScript
- **State Management**: MobX
- **UI Library**: Cere Design System (@cere/cere-design-system)
- **Charts**: recharts
- **Build Tool**: Vite
- **Package Manager**: npm

### Code Organization

- Components organized by feature/application in `src/applications/`
- Shared components in `src/components/`
- Stores in `src/stores/` with MobX (including external service integration stores)
- Hooks in `src/hooks/`
- Utilities in `src/utils/`
- Routes in `src/routes/`
- API clients and external service integrations in stores or dedicated service modules

### Performance Requirements

- Chart rendering MUST complete within 1 second for datasets up to 100 eras
- Table pagination MUST work efficiently with 10-1000+ items
- Filter changes MUST update UI within 1 second
- All components MUST be responsive and mobile-friendly

## Development Workflow

### Code Review Requirements

- All PRs MUST verify compliance with UI Component Standards (Principle III)
- All new components MUST use Cere Design System components
- TypeScript strict mode violations MUST be resolved before merge
- MobX observer pattern MUST be used for reactive components

### Testing Requirements

- All stores MUST be testable independently
- Components using stores MUST be testable with mock stores
- Integration tests required for user-facing features
- Edge cases for data visualization (empty states, large datasets) MUST be tested
- External service integrations MUST be testable with mocked API responses
- Error handling for external service failures MUST be tested

### Documentation Requirements

- All new features MUST include user stories with acceptance criteria
- Component APIs MUST be documented
- Data flow diagrams required for complex features
- README updates required for new setup or configuration changes

## Governance

This constitution supersedes all other development practices. All code contributions MUST comply with these principles. Amendments require:

1. Documentation of the change rationale
2. Update to this constitution file with version increment
3. Propagation of changes to dependent templates and documentation
4. Review and approval before implementation

**Compliance**: All PRs and code reviews MUST verify compliance with these principles. Complexity must be justified. Use this constitution as the primary reference for development guidance.

**Version**: 1.1.0 | **Ratified**: 2025-01-27 | **Last Amended**: 2025-01-27
