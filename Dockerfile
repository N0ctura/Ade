FROM node:24-alpine

# Installa pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copia i file di configurazione workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Copia tutti i pacchetti
COPY artifacts/ ./artifacts/
COPY lib/ ./lib/
COPY scripts/ ./scripts/

# Installa le dipendenze
RUN pnpm install --frozen-lockfile

# Build del progetto
RUN pnpm run build

EXPOSE 5000

# Avvia il server
CMD ["node", "artifacts/api-server/dist/index.js"]
