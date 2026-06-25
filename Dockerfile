FROM node:24-slim

# DejaVu fonts for @napi-rs/canvas text rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm via npm (avoids corepack version issues)
RUN npm install -g pnpm@10

WORKDIR /app

# Copy everything at once (simpler, avoids partial-copy bugs)
COPY . .

# Install all workspace deps (scripts run — required for native modules like @napi-rs/canvas)
RUN pnpm install --frozen-lockfile

# Build the api-server bundle
RUN pnpm --filter @workspace/api-server run build

ENV NODE_ENV=production

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
