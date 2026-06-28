FROM node:24-slim

# DejaVu fonts for @napi-rs/canvas text rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Pin exact pnpm version matching pnpm-lock.yaml
RUN npm install -g pnpm@10.26.1

WORKDIR /app

COPY . .

# Skip the root preinstall user-agent check (it gates out non-pnpm callers)
# and let pnpm regenerate lockfile if platform entries differ
RUN pnpm install --no-frozen-lockfile

# Build dashboard with pnpm (now it's recognized as a workspace package)
RUN pnpm --filter ade-dashboard run build

# Build the api-server bundle
RUN pnpm --filter @workspace/api-server run build

ENV NODE_ENV=production

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
