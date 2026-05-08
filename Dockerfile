# Multi-stage build: stage 1 builds the Vite frontend, stage 2 runs the Express server.
# `gcloud run deploy --source .` from the repo root uses this Dockerfile.

# ---------- Stage 1: build the frontend ----------
FROM node:20-alpine AS web-build
WORKDIR /web

# Install deps (cached layer when package files unchanged)
COPY web/package*.json ./
RUN npm ci

# Build
COPY web/ ./
RUN npm run build
# /web/dist now contains the static bundle

# ---------- Stage 2: server runtime ----------
FROM node:20-alpine
WORKDIR /app/server

# Install server prod deps only
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy server source
COPY server/ ./

# Bundled hub data is loaded from GCS in prod (via GCS_BUCKET env var) but we also
# include the JSON files for local-fallback / docker-without-GCS smoke tests.
COPY data/hubs.json /app/data/hubs.json
COPY data/sport-catalog.json /app/data/sport-catalog.json
COPY data/city-hubs.json /app/data/city-hubs.json

# Drop the built frontend into the path index.js looks for static files at
COPY --from=web-build /web/dist ./public

ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
