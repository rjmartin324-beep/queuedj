FROM node:20-alpine
LABEL build="2"

WORKDIR /app

# Copy lock file first so npm ci layer is cached
COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY services/realtime/package.json ./services/realtime/package.json

RUN npm ci --workspace=services/realtime --include-workspace-root

# Copy source after install so code changes don't bust the npm layer
COPY services/realtime/ ./services/realtime/

# Bundle realtime + shared-types into a single compiled JS file using esbuild.
# Running tsx (TypeScript compiler) at runtime adds ~200MB+ to heap, causing OOM
# crashes on Railway's 512MB container limit.
# esbuild inlines @queuedj/shared-types (workspace package) and marks npm packages
# as external so they are still loaded from node_modules at runtime.
RUN npx esbuild services/realtime/src/index.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --outfile=services/realtime/dist/index.js \
  --external:pg \
  --external:redis \
  --external:socket.io \
  --external:@socket.io/redis-adapter \
  --external:@sentry/node

WORKDIR /app/services/realtime

EXPOSE 3002

# --max-old-space-size=400 tells V8 to GC aggressively before hitting
# Railway's 512MB hard container limit (process was crashing at ~475MB)
CMD ["node", "--max-old-space-size=450", "dist/index.js"]
