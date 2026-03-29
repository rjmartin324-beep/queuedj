FROM node:20-alpine
LABEL build="3"

WORKDIR /app

# Copy workspace manifests + lock file first so npm ci layer is cached
COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY services/api/package.json ./services/api/package.json

# Deterministic install — uses lock file, much faster than npm install
RUN npm ci --workspace=services/api --include-workspace-root

# Copy source after install so code changes don't bust the npm layer
COPY services/api/ ./services/api/

WORKDIR /app/services/api

EXPOSE 3001

CMD ["npx", "tsx", "src/index.ts"]
