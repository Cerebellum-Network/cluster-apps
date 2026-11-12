# syntax=docker/dockerfile:1
#
# Builds the Developer Console SPA into a static nginx image.
#
# IMPORTANT: build with the cluster-apps MONOREPO ROOT as the context (the app is
# an npm-workspaces member with no app-level lockfile), e.g.
#   docker build -f apps/developer-console/Dockerfile -t developer-console .
# The repo's docker-build workflow sets `context: .` + this `file:` accordingly.
#
# The image is environment-agnostic: it ships a placeholder config.js (see
# apps/developer-console/public/config.js). The deployment (cef-developer-console
# Helm chart) mounts a populated config.js over it via a ConfigMap, so one image
# serves every environment. See apps/developer-console/src/config.ts for the
# runtime-config contract.

# ---- Build stage -----------------------------------------------------------
FROM node:22.13.0-alpine AS build
WORKDIR /app
# Whole monorepo: `npm ci` is workspace-wide off the root lockfile, then build
# only this app. Vite writes to <root>/dist/developer-console (see vite.config.ts).
COPY . .
RUN npm ci && npm run build -w @cluster-apps/developer-console

# ---- Runtime stage ---------------------------------------------------------
FROM nginx:1.27-alpine AS runtime
COPY apps/developer-console/nginx.conf /etc/nginx/conf.d/default.conf
# Baked default CSP/security-headers snippet (nginx.conf includes it). The
# cef-developer-console Helm chart mounts a per-env copy over /etc/nginx/csp.conf.
COPY apps/developer-console/csp.conf /etc/nginx/csp.conf
COPY --from=build /app/dist/developer-console /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
