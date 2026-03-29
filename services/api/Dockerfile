FROM node:20-alpine
# cache bust

WORKDIR /app

# Install dependencies from monorepo root so workspace packages resolve
COPY package.json ./
COPY packages/ ./packages/
COPY services/api/ ./services/api/

RUN npm install --workspace=services/api --include-workspace-root

WORKDIR /app/services/api

EXPOSE 3001

CMD ["npx", "tsx", "src/index.ts"]
