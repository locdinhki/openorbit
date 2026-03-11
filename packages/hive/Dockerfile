FROM node:22-slim AS builder

WORKDIR /app

# Build server
COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# Build dashboard
COPY dashboard/package.json ./dashboard/
RUN cd dashboard && npm install

COPY dashboard/ ./dashboard/
RUN cd dashboard && npm run build

# ── Production ───────────────────────────────────────────────────────────────

FROM node:22-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 8080

CMD ["node", "dist/index.js"]
