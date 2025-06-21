---
title: Cluster Apps Documentation
description: Web applications for managing DDC (Decentralized Data Cloud) clusters
---

# Cluster Apps

A collection of web applications for managing DDC (Decentralized Data Cloud) clusters, built as a TypeScript monorepo with React, Vite, and MobX.

## Overview

This monorepo contains three main applications and five shared packages for managing and interacting with DDC clusters:

### Applications
- **[Developer Console](components/developer-console.md)** - Main interface for developers to manage DDC storage, content delivery, and activity capture
- **[Node Provider Console](components/node-provider.md)** - Tool for DDC node operators to manage and monitor their nodes
- **[Global Registry](components/global-registry.md)** - Global access management for DDC clusters

### Shared Packages
- **[UI Components](components/packages.md#ui-package)** - Reusable Material-UI based components
- **[API Utilities](components/packages.md#api-package)** - HTTP client and API abstractions
- **[Analytics](components/packages.md#analytics-package)** - User tracking and analytics
- **[Reporting](components/packages.md#reporting-package)** - Data reporting utilities
- **[ESLint Config](components/packages.md#eslint-config-package)** - Shared linting configuration

## Quick Start

### Prerequisites
- Node.js (version specified in `.nvmrc`)
- npm (comes with Node.js)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd cluster-apps
   ```

2. **Install dependencies:**
   ```bash
   nvm exec npm i
   ```

3. **Copy environment configuration:**
   ```bash
   cp .env.dev .env
   ```

### Running Applications

#### Developer Console
```bash
nvm exec npm run start -w apps/developer-console
```
Open http://localhost:5173/

#### Node Provider Console
```bash
nvm exec npm run start -w apps/node-provider
```

#### Global Registry
```bash
nvm exec npm run start -w apps/global-registry
```

### Building for Production

Build all applications:
```bash
npm run build
```

Build specific application:
```bash
npm run build -w apps/developer-console
```

## Environment Variables

Key environment variables (see [Environment Configuration](development/environment.md) for complete list):

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_APP_ID` | Application identifier | `developer-console` |
| `VITE_DDC_NETWORK` | DDC network (devnet/testnet/mainnet) | `testnet` |
| `VITE_DDC_CLUSTER_ID` | Target DDC cluster ID | - |
| `VITE_DDC_STORAGE_NODE_URL` | Storage node endpoint | - |
| `VITE_FEATURE_USER_ONBOARDING` | Enable user onboarding flow | `false` |

## Development

### Code Quality
```bash
# Lint all packages
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run check-types
```

### Project Structure
```
cluster-apps/
├── apps/                    # Applications
│   ├── developer-console/   # Main developer interface
│   ├── node-provider/      # Node management console
│   └── global-registry/    # Access management
├── packages/               # Shared packages
│   ├── ui/                # UI components
│   ├── api/               # API utilities
│   ├── analytics/         # Analytics
│   ├── reporting/         # Reporting
│   └── eslint-config/     # Linting config
└── docs/                  # Documentation
```

## Documentation Structure

- **[Architecture](architecture/)** - System design and module structure
- **[Components](components/)** - Individual app and package documentation
- **[Development](development/)** - Development guides and standards
- **[Extension](extension/)** - How to extend and customize
- **[Functionality](functionality/)** - Deployment and troubleshooting

## Key Technologies

- **Frontend**: React 18, TypeScript, Vite
- **State Management**: MobX
- **UI Framework**: Material-UI (MUI)
- **DDC Integration**: @cere-ddc-sdk packages
- **Wallet**: @cere/embed-wallet
- **Build System**: Vite with TypeScript
- **Monorepo**: npm workspaces

## Contributing

See [Development Guide](development/guide.md) and [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed contribution guidelines.

## Release Notes

See [CHANGELOG.md](../CHANGELOG.md) for version history and release notes.

## Support

- Documentation: Browse the [docs/](.) directory
- Issues: Create GitHub issues for bugs and feature requests
- Community: Join our [Discord](https://discord.gg/HtkRSgUCMB) 