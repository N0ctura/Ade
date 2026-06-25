FROM node:24-slim

# Install DejaVu fonts (needed for @napi-rs/canvas text rendering)
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config first for better layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy all package.json files so pnpm can resolve the workspace
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/ ./lib/
COPY scripts/package.json ./scripts/

# Install all dependencies (with scripts — needed for native modules like @napi-rs/canvas)
RUN pnpm install --frozen-lockfile

# Copy the rest of the source
COPY . .

# Build the api-server bundle
RUN pnpm --filter @workspace/api-server run build

ENV NODE_ENV=production

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
