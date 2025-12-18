# ===== build stage =====
FROM node:20-alpine AS build
WORKDIR /app

# Manifests (cache de deps)
COPY package.json ./
# Se existir package-lock.json, ótimo. Se não existir, o build não quebra.
COPY package-lock.json ./ 2>/dev/null || true

RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# App
COPY . .
RUN npm run build

# ===== runtime stage =====
FROM nginx:1.25-alpine AS runtime

# Se você NÃO tiver nginx.conf no client/, me avise que eu te mando um arquivo pronto.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Vite output padrão
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
