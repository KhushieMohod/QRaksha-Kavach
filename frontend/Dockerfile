# Stage 1: Build production assets
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm and dependencies
RUN npm install -g pnpm

COPY frontend/package.json frontend/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || npm install

COPY frontend/ ./
RUN pnpm run build || npm run build

# Stage 2: Serve production assets via Nginx
FROM nginx:alpine

# Copy built SPA artifacts
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
