# PATCH 006 - Deploy Estável com Docker + Nginx Proxy

## Contexto
Deploy production-ready usando Docker + Nginx para:
- Servir front estático via Nginx
- Proxy reverso roteando /trpc e /api para backend Node
- Persistir uploads localmente com volume
- Health-check e logs padronizados

## Arquitetura Escolhida: Railway (API) + Render (Front+Proxy)

**Railway**: roda só o backend (API)
**Render**: roda frontend estático + Nginx fazendo proxy de /api e /trpc para Railway
→ Browser vê mesma origem (sem CORS), infra Manus sai da jogada

## Arquivos Necessários

### 1. server/Dockerfile (API - Railway)
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm i --frozen-lockfile

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 2. client/Dockerfile (Front + Nginx - Render)
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm i --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:1.25-alpine AS web
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 3. client/nginx.conf
```nginx
server {
  listen 80;
  server_name _;
  
  # Front estático (SPA)
  root /usr/share/nginx/html;
  index index.html;
  
  # Proxy para API interna (Railway)
  location /trpc {
    proxy_pass http://api:3000/trpc;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  
  location /api {
    proxy_pass http://api:3000/api;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  
  # Assets/SPA fallback
  location / {
    try_files $uri /index.html;
  }
}
```

### 4. docker-compose.yml (local/staging)
```yaml
version: "3.9"
services:
  api:
    build:
      context: ./server
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      STORAGE_MODE: "local"
      UPLOAD_DIR: "/app/uploads"
      REQUEST_BODY_LIMIT_MB: "20"
      UPLOAD_MAX_MB: "16"
      RAG_INGEST_MODE: "inline"
      FORCE_STORAGE_LOCAL: "true"
      DEBUG_UPLOAD_SHORT_CIRCUIT: "true"
    volumes:
      - uploads_data:/app/uploads
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 6
      
  web:
    build:
      context: ./client
      dockerfile: Dockerfile
    depends_on:
      - api
    ports:
      - "80:80"
    volumes:
      - uploads_data:/app/uploads

volumes:
  uploads_data:
```

## Plano Render (Frontend + Proxy)

### client/nginx.conf.template
```nginx
server {
  listen 80;
  server_name _;
  
  root /usr/share/nginx/html;
  index index.html;
  
  # Proxy p/ API externa (Railway). Variável injetada: $API_ORIGIN
  location /trpc {
    proxy_pass $API_ORIGIN/trpc;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  
  location /api {
    proxy_pass $API_ORIGIN/api;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  
  location / {
    try_files $uri /index.html;
  }
}
```

### client/entrypoint.sh
```bash
#!/bin/sh
set -e
: "${API_ORIGIN:?API_ORIGIN not set}"  # ex.: https://orkio-api.up.railway.app
envsubst '$API_ORIGIN' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
nginx -g 'daemon off;'
```

### client/Dockerfile (Render)
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm i --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:1.25-alpine
WORKDIR /app
COPY --from=build /app/dist /usr/share/nginx/html
COPY ./nginx.conf.template /etc/nginx/conf.d/default.conf.template
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 80
CMD ["/entrypoint.sh"]
```

### Render Dashboard (Web Service)
- ENV: `API_ORIGIN=https://SEU-SUBDOMINIO.up.railway.app`
- Deploy: ao abrir domínio Render, front chama /trpc e /api e Nginx encaminha para Railway

## Plano Railway (API)

### server/Dockerfile
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm i --frozen-lockfile

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
RUN mkdir -p /app/uploads
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Railway Dashboard (API)
- ENV:
  - NODE_ENV=production
  - STORAGE_MODE=local
  - UPLOAD_DIR=/app/uploads
  - REQUEST_BODY_LIMIT_MB=20
  - UPLOAD_MAX_MB=16
  - RAG_INGEST_MODE=inline
  - FORCE_STORAGE_LOCAL=true
  - DEBUG_UPLOAD_SHORT_CIRCUIT=true (ligar para validar upload primeiro)
- Deploy e copie URL pública (ex.: https://orkio-api.up.railway.app)
- Cole essa URL no API_ORIGIN do Render (passo 4) e redeploy o front

## Testes de Aceite (AT-DEPLOY)

### AT-DEPLOY-01: Health
```bash
curl https://SEU_DOMINIO_RENDER/api/health | jq
# Deve retornar JSON (200/503), nunca HTML
```

### AT-DEPLOY-02: Agents → KB Upload
1. Acesse https://SEU_DOMINIO_RENDER/agents/default
2. Escolha um agente, vá para aba Knowledge Base
3. Envie .txt pequeno
4. Com DEBUG_UPLOAD_SHORT_CIRCUIT=true: status **completed** em segundos
5. Logs no Railway API:
   - `documents.upload.started { hasOrg:true, hasAgentId:true }`
   - `documents.upload.completed_short_circuit`

### AT-DEPLOY-03: Chat Upload
1. Acesse https://SEU_DOMINIO_RENDER/chat
2. Anexe .txt pequeno no chat
3. Badge deve mostrar **completed**
4. Logs no Railway API:
   - `documents.upload.started { hasConversationId:true }`

### AT-DEPLOY-04: Ingest (após provar upload)
1. Desligue DEBUG_UPLOAD_SHORT_CIRCUIT=false no Railway, restart
2. Refaça upload PDF 1-5MB
3. Se falhar, colete logs `rag.parse.failed` ou `chat.rag.failed`

### AT-DEPLOY-05: Sem "Unexpected token"/"Unable to transform"
- Proxy Nginx garante JSON no batch (nunca HTML)

### AT-DEPLOY-06: Volumes persistem
- `docker compose down && up -d` → documentos continuam acessíveis em /uploads/...

## Dicas Importantes

- **Sem CORS**: Nginx no Render faz proxy, browser sempre fala com mesma origem
- **Sem "Unexpected token/transform"**: mantenha cliente tRPC único com batch/IDs (client/src/lib/trpc.ts)
- **Persistência**: uploads ficam no volume do Railway (container filesystem); se quiser S3 depois, é só trocar STORAGE_MODE
- **Rollback fácil**: Render e Railway têm histórico de deploy; se algo quebrar, use "Rollback"

## Instruções para AI-03 (Integrador)

1. **Adicionar os arquivos** acima nos diretórios indicados (server/, client/, raiz do repo)
2. **Build & up** local:
   ```bash
   docker compose build
   docker compose up -d
   docker compose logs -f api
   ```
3. **Smoke test imediato**:
   - Abra http://SEU_IP/ → deve carregar o front
   - `curl http://SEU_IP/api/health | jq` → JSON (200/503), nunca HTML
4. **Teste de upload (modo diagnóstico ON)**:
   - Acesse /agents/default → aba Knowledge Base → faça upload .txt 1KB
   - **Esperado**: status **completed** em segundos, logs no api:
     - `documents.upload.started ... hasOrg:true, hasAgentId:true`
     - `documents.upload.completed_short_circuit ...`
   - Acesse o chat e faça upload .txt 1KB:
     - `documents.upload.started ... hasConversationId:true`
     - Badge **completed**
5. **Se tudo OK**, desligar short-circuit (testar ingest):
   - `docker compose down`
   - No docker-compose.yml → DEBUG_UPLOAD_SHORT_CIRCUIT: "false" (manter FORCE_STORAGE_LOCAL: "true")
   - `docker compose up -d`
   - Testar upload PDF 1-5 MB:
     - Se falhar, capturar logs `rag.parse.failed` ou `chat.rag.failed` (aí ajustamos só ingest)

## Runbook Rápido (Droplet DO em 10 min)

1. Droplet Ubuntu 22.04 (2 vCPU / 4GB RAM)
2. SSH + Docker:
   ```bash
   sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg
   sudo install -m 0755 -d /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
   sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
   sudo usermod -aG docker $USER && newgrp docker
   ```
3. Clone do repo + patch 006:
   ```bash
   git clone <repo_url>
   cd <repo>
   # Adicionar arquivos do PATCH 006
   ```
4. Build & up:
   ```bash
   docker compose build && docker compose up -d
   ```
5. (Opcional) HTTPS automático: instale **Caddy** ou use um LB do provedor
   - Alternativa simples: aponte um **A record** do seu domínio para o IP e coloque um **ALB/NGINX com cert** na frente

## Por que isso resolve agora

- **Sai do infra do Manus** e roda numa stack determinística (Docker/Nginx)
- **Mantém a expectativa do front** (paths relativos), sem mexer no código
- **Permite diagnosticar**: com DEBUG_UPLOAD_SHORT_CIRCUIT=true você prova upload/KB/roteamento **independente** de embeddings/RAG
- **Persistência** garantida por volume; migração para S3 fica a um STORAGE_MODE de distância
