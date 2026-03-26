FROM node:20-alpine

WORKDIR /app

# Install dependencies from monorepo root so workspace packages resolve
COPY package.json ./
COPY packages/ ./packages/
COPY services/realtime/ ./services/realtime/

RUN npm install --workspace=services/realtime --include-workspace-root

WORKDIR /app/services/realtime

EXPOSE 3002

CMD ["npx", "tsx", "src/index.ts"]
