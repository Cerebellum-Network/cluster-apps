# syntax=docker/dockerfile:1
#
# Builds the Cluster Console SPA into a static nginx image. Build with the
# cluster-apps monorepo root as the context:
#   docker build -f apps/cluster-console/Dockerfile -t cluster-console .
# The image is environment-agnostic: the cef-cluster-console Helm chart mounts a
# populated config.js (consoleBackendUrl, walletOrigin, walletTransport) and a
# per-environment csp.conf over the baked defaults.

FROM node:22.13.0-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build -w @cluster-apps/cluster-console

FROM nginx:1.27-alpine AS runtime
COPY apps/cluster-console/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/cluster-console/csp.conf /etc/nginx/csp.conf
COPY --from=build /app/dist/cluster-console /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
