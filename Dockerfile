# ── 构建阶段 ────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# 先复制依赖清单，利用 Docker 层缓存（只有 package.json 变动才重新 install）
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src ./src
COPY client ./client
RUN npm run build

# ── 运行阶段 ────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

EXPOSE 3100

CMD ["node", "dist/index.js"]
