# syntax=docker/dockerfile:1
#
# Builds the Billing Console SPA into a static nginx image.
#
# The image is environment-agnostic: it ships a placeholder config.js (see
# public/config.js). The deployment (cef-billing-console Helm chart) mounts a
# populated config.js over it via a ConfigMap, so one image serves every
# environment. See src/config.ts for the runtime-config contract.

# ---- Build stage -----------------------------------------------------------
FROM node:22.13.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime stage ---------------------------------------------------------
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
