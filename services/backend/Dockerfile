FROM node:22-slim AS base
RUN corepack enable

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY services/backend/package.json services/backend/

# Install dependencies
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    cd services/backend && pnpm install --frozen-lockfile --prod

# Copy source
COPY services/backend/src services/backend/src
COPY services/backend/tsconfig.json services/backend/

WORKDIR /app/services/backend

EXPOSE 3001

CMD ["node", "--import", "tsx", "src/index.ts"]
