# 🎨 Render Manual Deployment Guide

## Pré-requisitos
- Conta Render (login com dangraebin@gmail.com)
- URL pública do Railway API (do passo anterior)
- Código do projeto (pasta `client/`)

---

## Passo 1: Criar Novo Web Service

1. Acesse: https://dashboard.render.com/
2. Clique em **"New +"** → **"Web Service"**

---

## Passo 2: Conectar Repositório

**Opção A: GitHub**
1. Clique em **"Connect a repository"**
2. Autorize Render a acessar seu repositório
3. Selecione o repositório do Orkio v5

**Opção B: Upload Manual**
1. Se não tiver GitHub conectado, use "Public Git Repository"
2. Cole a URL do repositório

---

## Passo 3: Configurar Serviço

Preencha os campos:

| Campo | Valor |
|-------|-------|
| **Name** | `orkio-frontend` |
| **Region** | Escolha mais próximo (ex: Ohio, São Paulo) |
| **Branch** | `main` (ou sua branch principal) |
| **Root Directory** | `client` |
| **Environment** | `Docker` |
| **Dockerfile Path** | `client/Dockerfile` |

---

## Passo 4: Configurar Variáveis de Ambiente

1. Role até **"Environment Variables"**
2. Clique em **"Add Environment Variable"**
3. Adicione:

```
Key: API_ORIGIN
Value: https://SUA-URL-RAILWAY.up.railway.app
```

**⚠️ IMPORTANTE:**
- Substitua `SUA-URL-RAILWAY.up.railway.app` pela URL real do Railway (do passo anterior)
- **NÃO** adicione barra `/` no final
- Exemplo correto: `https://orkio-api-production.up.railway.app`

---

## Passo 5: Configurar Plano

1. Selecione o plano:
   - **Free** (para testes)
   - **Starter** ($7/mês - recomendado para produção)

---

## Passo 6: Deploy

1. Clique em **"Create Web Service"**
2. Render iniciará o build automaticamente
3. Acompanhe os logs em tempo real

**O que esperar nos logs:**
```
==> Building...
==> Dockerfile detected
==> Building image...
Step 1/X : FROM node:20-alpine AS build
...
==> Build successful!
==> Deploying...
==> Your service is live at https://orkio-frontend.onrender.com
```

---

## Passo 7: Obter URL Pública

1. Após deploy bem-sucedido, copie a URL pública
   - Exemplo: `https://orkio-frontend.onrender.com`
2. **SALVE ESTA URL** - você usará para testes

---

## Passo 8: Validar Frontend

### Teste 1: Carregar Frontend
```bash
curl -I https://SUA-URL-RENDER.onrender.com
```

**Esperado:**
- Status: `200 OK`
- Content-Type: `text/html`

### Teste 2: Health via Proxy
```bash
curl https://SUA-URL-RENDER.onrender.com/api/health | jq
```

**Esperado:**
- Retorna JSON (mesmo resultado do Railway)
- Nginx está fazendo proxy corretamente

### Teste 3: Abrir no Browser
1. Abra: `https://SUA-URL-RENDER.onrender.com`
2. Deve carregar a página do Orkio v5
3. Faça login se necessário

---

## Passo 9: Validar Proxy (tRPC)

1. Abra DevTools (F12)
2. Vá em **Network**
3. Navegue no site (ex: ir para /chat)
4. Procure por requests para `/trpc/...`

**Esperado:**
- Requests para `/trpc/` retornam JSON
- Status: 200
- **Sem erros CORS**
- **Sem "Unexpected token" ou "Unable to transform"**

---

## Troubleshooting

### Build falha: "Cannot find Dockerfile"
- Verifique "Root Directory": deve ser `client`
- Verifique "Dockerfile Path": deve ser `client/Dockerfile` ou apenas `Dockerfile`

### "API_ORIGIN not set" no log
- Verifique se a variável `API_ORIGIN` está configurada
- Vá em "Environment" → "Environment Variables"
- Confirme que o valor está correto (URL do Railway)

### Proxy não funciona (/api retorna 404)
- Verifique se `nginx.conf.template` existe em `client/`
- Verifique se `entrypoint.sh` está executando
- Logs devem mostrar: `envsubst` substituindo `$API_ORIGIN`

### CORS errors no browser
- Isso **NÃO** deveria acontecer com Nginx
- Verifique se o proxy está configurado corretamente
- Teste: `curl https://SUA-URL-RENDER/api/health` (deve retornar JSON, não erro CORS)

### Frontend carrega mas /trpc falha
- Verifique se Railway API está rodando
- Teste Railway diretamente: `curl https://SUA-URL-RAILWAY/api/health`
- Verifique se `API_ORIGIN` no Render está correto (sem barra no final)

---

## Próximo Passo

Após Render Frontend funcionando:
→ Seguir para **ACCEPTANCE_TESTS.md** para validar uploads
