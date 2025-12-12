# Stage 1: Build frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm i --frozen-lockfile
COPY . .
# O front usa "/trpc" relativo; não mudar nada
RUN pnpm build

# Stage 2: Nginx + template + entrypoint
FROM nginx:1.25-alpine
WORKDIR /app

# Copy built frontend
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx template and entrypoint
COPY ./nginx.conf.template /etc/nginx/conf.d/default.conf.template
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
CMD ["/entrypoint.sh"]
