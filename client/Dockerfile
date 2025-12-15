# Stage 1: Build frontend (monorepo structure)
FROM node:20-alpine AS build
WORKDIR /app

# Copy root package files first
COPY ../package.json ../pnpm-lock.yaml ./

# Enable pnpm and install dependencies
RUN corepack enable && pnpm i --frozen-lockfile

# Copy all source files
COPY ../client ./client
COPY ../shared ./shared
COPY ../vite.config.ts ./
COPY ../tsconfig.json ./
COPY ../components.json ./

# Build the frontend
WORKDIR /app/client
RUN cd /app && pnpm build

# Stage 2: Nginx + template + entrypoint
FROM nginx:1.25-alpine
WORKDIR /app

# Copy built frontend
COPY --from=build /app/client/dist /usr/share/nginx/html

# Copy nginx template and entrypoint
COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
CMD ["/entrypoint.sh"]
