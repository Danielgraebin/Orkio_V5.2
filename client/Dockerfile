# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app

# copie somente o necessário primeiro para cachear dependências
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm i --frozen-lockfile

# agora copie o restante do código do client
COPY . .

# se você usa Shadcn e tem components.json, ele já estará no contexto (client/)
# se NÃO usa Shadcn, não há nada a fazer aqui

# build do front
RUN pnpm build

# ---------- runtime ----------
FROM nginx:1.25-alpine AS runtime
WORKDIR /usr/share/nginx/html

# copie o build do Vite/Next (ajuste o caminho abaixo)
# se seu build sai em "dist" (Vite):
COPY --from=build /app/dist ./
# se for Next com export estático (out):
# COPY --from=build /app/out ./

# copie o config.js gerado em runtime pelo entrypoint.sh (se você estiver usando esse mecanismo)
# Dica: se o seu entrypoint gera /config.js, certifique-se de servi-lo na raiz do Nginx
# (no seu nginx.conf.template já deve existir uma localização para /config.js)

# opcional: nginx.conf customizado (se você tem)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# porta padrão do nginx
EXPOSE 80

# nginx já vem com entrypoint/cmd apropriados

