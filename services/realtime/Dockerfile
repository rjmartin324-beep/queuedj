FROM node:20-alpine

WORKDIR /app

# Install dependencies from monorepo root so workspace packages resolve
COPY package.json ./
COPY packages/ ./packages/
COPY services/realtime/ ./services/realtime/

RUN npm install --workspace=services/realtime --include-workspace-root

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

CMD ["node", "dist/index.js"]
