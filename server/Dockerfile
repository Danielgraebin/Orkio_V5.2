# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm i --frozen-lockfile

# Stage 2: Build application
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm build

# Stage 3: Production runtime
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production

# Copy built application and dependencies
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

# Create uploads directory for local storage
RUN mkdir -p /app/uploads

# Railway provides PORT dynamically, but we default to 3000
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/index.js"]
