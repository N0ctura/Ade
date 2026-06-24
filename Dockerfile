FROM node:24-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./

COPY artifacts/api-server/ ./artifacts/api-server/
COPY artifacts/data/ ./artifacts/data/
COPY lib/ ./lib/
COPY scripts/ ./scripts/

RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm rebuild

RUN pnpm --filter @workspace/api-server run build

EXPOSE 5000

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
