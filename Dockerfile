# Stage 1: Build aşaması
FROM node:18-alpine AS builder

WORKDIR /app

# Package dosyalarını kopyala
COPY package*.json ./

# TÜM dependencies kur (dev dahil - build için lazım)
RUN npm ci

# Uygulama kodunu kopyala
COPY . .

# Build et
RUN npm run build

# Stage 2: Production aşaması (runtime)
FROM node:18-alpine AS production

WORKDIR /app

# Builder'dan built artifacts'ı kopyala
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/public ./public

# Port expose et
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Uygulamayı başlat
CMD ["npm", "start"]
