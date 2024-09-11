# Cluster Apps

A collection Web Applications to manage a DDC Cluster

## Apps

- [Developer Console](apps/developer-console)
- [Node Provider Console](apps/node-provider)
- [Global Registry](apps/global-registry)

## Releases

- [Release Notes](./CHANGELOG.md)

## Quick start

1. Install dependencies:

```bash
nvm exec npm i
```

2. Copy ENV file:

```bash
cp .env.dev .env
```

3. Run an application:

```bash
nvm exec npm run start -w apps/developer-console
```

4. Build an application for production

```bash
nvm exec npm run build -w apps/developer-console
```