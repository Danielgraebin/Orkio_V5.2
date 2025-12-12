# 🚂 Railway Manual Deployment Guide

## Pré-requisitos
- Conta Railway (login com dangraebin@gmail.com)
- Código do projeto (pasta `server/`)

---

## Passo 1: Criar Novo Projeto

1. Acesse: https://railway.app/dashboard
2. Clique em **"New Project"**
3. Selecione **"Deploy from GitHub repo"** (ou "Empty Project" se preferir upload manual)

---

## Passo 2: Conectar Repositório (Opção GitHub)

**Se usar GitHub:**
1. Autorize Railway a acessar seu repositório
2. Selecione o repositório do Orkio v5
3. Railway detectará automaticamente o `server/Dockerfile`

**Se usar upload manual:**
1. Selecione "Empty Project"
2. Clique em "Add Service" → "GitHub Repo" → "Deploy from local directory"
3. Faça upload da pasta `server/`

---

## Passo 3: Configurar Dockerfile

1. Railway deve detectar automaticamente `server/Dockerfile`
2. Se não detectar:
   - Clique no serviço
   - Vá em "Settings"
   - Em "Build", selecione "Dockerfile"
   - Defina "Dockerfile Path": `Dockerfile`
   - Defina "Docker Context": `.` (raiz do server/)

---

## Passo 4: Configurar Variáveis de Ambiente

1. No serviço, clique em **"Variables"**
2. Adicione as seguintes variáveis (uma por uma):

```
NODE_ENV=production
STORAGE_MODE=local
UPLOAD_DIR=/app/uploads
REQUEST_BODY_LIMIT_MB=20
UPLOAD_MAX_MB=16
RAG_INGEST_MODE=inline
FORCE_STORAGE_LOCAL=true
DEBUG_UPLOAD_SHORT_CIRCUIT=true
```

**Como adicionar:**
- Clique em "+ New Variable"
- Digite o nome (ex: `NODE_ENV`)
- Digite o valor (ex: `production`)
- Clique em "Add"
- Repita para todas as variáveis

---

## Passo 5: Configurar Volume (Persistência de Uploads)

1. No serviço, clique em **"Settings"**
2. Role até **"Volumes"**
3. Clique em **"+ New Volume"**
4. Configure:
   - **Mount Path**: `/app/uploads`
   - **Size**: 1 GB (ou mais, conforme necessidade)
5. Clique em **"Add"**

---

## Passo 6: Configurar Porta

1. No serviço, vá em **"Settings"**
2. Em **"Networking"**, verifique:
   - **Port**: `3000` (ou deixe vazio, Railway detecta automaticamente)
3. Certifique-se de que **"Generate Domain"** está ativado

---

## Passo 7: Deploy

1. Clique em **"Deploy"** (ou aguarde deploy automático)
2. Acompanhe os logs em **"Deployments"** → **"View Logs"**
3. Aguarde até ver: `Server running on http://localhost:3000/`

---

## Passo 8: Obter URL Pública

1. Após deploy bem-sucedido, vá em **"Settings"**
2. Em **"Networking"**, copie a **"Public URL"**
   - Exemplo: `https://orkio-api-production.up.railway.app`
3. **SALVE ESTA URL** - você precisará dela para o Render

---

## Passo 9: Validar API

Teste o endpoint de health:

```bash
curl https://SUA-URL-RAILWAY.up.railway.app/api/health | jq
```

**Esperado:**
- Retorna JSON (não HTML)
- Status code: 200 ou 503
- Contém campos: `status`, `storage`, `embeddings`, `config`

---

## Troubleshooting

### Deploy falha com "Port already in use"
- Verifique se `PORT` está configurado como variável de ambiente
- Railway injeta `PORT` automaticamente, não precisa configurar manualmente

### "Cannot find module 'dist/index.js'"
- Verifique se o build está funcionando
- Logs devem mostrar: `pnpm build` executando com sucesso
- Verifique se `dist/` foi criado

### Uploads não persistem após restart
- Verifique se o volume está montado em `/app/uploads`
- Vá em "Settings" → "Volumes" e confirme mount path

### Health endpoint retorna 404
- Verifique se o servidor está rodando (logs devem mostrar "Server running")
- Teste: `curl https://SUA-URL/api/health` (com `/api/` no path)

---

## Próximo Passo

Após Railway API funcionando:
→ Seguir para **RENDER_MANUAL_DEPLOY.md** para deploy do Frontend
