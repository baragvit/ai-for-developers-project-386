# syntax=docker/dockerfile:1

# ---- Build frontend and backend ----
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY api-contract/package.json api-contract/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY e2e/package.json e2e/
RUN npm ci

COPY api-contract api-contract
COPY backend backend
COPY frontend frontend
RUN npm run build

# ---- Production dependencies of the backend only ----
FROM node:22-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY api-contract/package.json api-contract/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY e2e/package.json e2e/
RUN npm ci --omit=dev --workspace backend

# ---- Runtime: one process serves the API and the built SPA ----
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    STATIC_DIR=/app/frontend/dist

COPY --from=deps /app/node_modules ./node_modules
COPY backend/package.json backend/
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/frontend/dist frontend/dist

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/owner" > /dev/null || exit 1

CMD ["node", "backend/dist/main.js"]
