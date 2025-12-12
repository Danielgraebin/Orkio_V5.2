# 🧪 Acceptance Tests - PATCH 006

## Pré-requisitos
- Railway API deployado e funcionando
- Render Frontend deployado e funcionando
- URLs públicas de ambos salvos

---

## AT-DEPLOY-01: Health Check ✅

### Objetivo
Validar que `/api/health` retorna JSON (nunca HTML)

### Passos
```bash
curl https://SUA-URL-RENDER.onrender.com/api/health | jq
```

### Critérios de Aceite
- ✅ Retorna JSON válido
- ✅ Status code: 200 ou 503
- ✅ Contém campos: `status`, `storage`, `embeddings`, `config`
- ✅ **NUNCA** retorna HTML

### Se Falhar
- Verifique se Nginx está rodando (Render logs)
- Verifique se Railway API está acessível: `curl https://SUA-URL-RAILWAY/api/health`
- Verifique proxy config em `client/nginx.conf.template`

---

## AT-DEPLOY-02: Agents → KB Upload ✅

### Objetivo
Validar upload de documento na Knowledge Base do agente

### Passos
1. Abra: `https://SUA-URL-RENDER.onrender.com/agents/default`
2. Selecione um agente (ou crie um novo)
3. Clique na aba **"Knowledge Base"**
4. Clique em **"Upload"** ou arraste um arquivo `.txt` pequeno (1KB)
   - Conteúdo exemplo: "Este é um documento de teste para validar upload."

### Critérios de Aceite (com DEBUG_UPLOAD_SHORT_CIRCUIT=true)
- ✅ Upload completa em **segundos** (não minutos)
- ✅ Status muda para **"completed"**
- ✅ Documento aparece na lista da KB
- ✅ **SEM** toasts de erro "Unexpected token" ou "Unable to transform"

### Logs Esperados (Railway API)
Abra Railway dashboard → Logs:
```json
{"level":"info","msg":"documents.upload.started","hasOrg":true,"hasAgentId":true,"hasContent":true}
{"level":"info","msg":"documents.upload.completed_short_circuit","documentId":123,"url":"/uploads/..."}
```

### Se Falhar
- Verifique Railway logs para erros
- Verifique se `DEBUG_UPLOAD_SHORT_CIRCUIT=true` está setado
- Verifique se `FORCE_STORAGE_LOCAL=true` está setado
- Teste health: deve mostrar `forceStorageLocal: true`, `debugUploadShortCircuit: true`

---

## AT-DEPLOY-03: Chat Upload ✅

### Objetivo
Validar upload de documento no chat

### Passos
1. Abra: `https://SUA-URL-RENDER.onrender.com/chat`
2. Inicie uma nova conversa ou selecione existente
3. Clique no ícone de **anexo** (📎) ou arraste arquivo
4. Selecione um arquivo `.txt` pequeno (1KB)

### Critérios de Aceite
- ✅ Badge aparece mostrando nome do arquivo
- ✅ Status muda para **"completed"** em segundos
- ✅ **SEM** toasts de erro

### Logs Esperados (Railway API)
```json
{"level":"info","msg":"documents.upload.started","hasConversationId":true,"hasContent":true}
{"level":"info","msg":"documents.upload.completed_short_circuit","documentId":124,"url":"/uploads/..."}
```

### Se Falhar
- Mesmo troubleshooting do AT-DEPLOY-02

---

## AT-DEPLOY-04: Full Ingest (RAG Completo) ⚠️

### Objetivo
Validar processamento completo com embeddings e RAG

### ⚠️ Pré-requisito
Este teste **desliga o short-circuit**, então só execute após AT-DEPLOY-02 e AT-DEPLOY-03 passarem!

### Passos
1. Abra Railway dashboard
2. Vá em **Variables**
3. Edite: `DEBUG_UPLOAD_SHORT_CIRCUIT=false`
4. Clique em **"Restart"** (ou aguarde redeploy automático)
5. Aguarde serviço voltar (1-2 minutos)
6. Repita AT-DEPLOY-02 ou AT-DEPLOY-03 com arquivo **PDF** (1-5 MB)

### Critérios de Aceite
- ✅ Upload completa (pode demorar mais: 10-30 segundos)
- ✅ Status muda para **"completed"**
- ✅ Documento processado com sucesso

### Logs Esperados (Railway API)
```json
{"level":"info","msg":"documents.upload.started",...}
{"level":"info","msg":"rag.parse.started",...}
{"level":"info","msg":"rag.parse.completed","chunks":15}
{"level":"info","msg":"documents.upload.completed","documentId":125}
```

### Se Falhar
Capture logs de erro:
- `rag.parse.failed` → problema no parsing (pdf-parse/mammoth)
- `rag.embed.failed` → problema nos embeddings
- `chat.rag.failed` → problema na busca de chunks

**Próximo passo se falhar:**
- Envie logs completos para análise
- Patch cirúrgico de 5-10 linhas será criado

---

## AT-DEPLOY-05: Sem "Unexpected Token" Errors ✅

### Objetivo
Confirmar que **nunca** aparecem erros de parsing JSON

### Passos
1. Abra DevTools (F12) → Console
2. Execute todos os testes anteriores (AT-DEPLOY-02, AT-DEPLOY-03)
3. Monitore console durante uploads

### Critérios de Aceite
- ✅ **ZERO** erros "Unexpected token"
- ✅ **ZERO** erros "Unable to transform response from server"
- ✅ **ZERO** erros CORS

### Por que isso funciona agora
- Nginx garante que todas respostas sejam JSON
- tRPC client resiliente (batch/IDs) trata erros 5xx
- Proxy elimina CORS (mesma origem)

---

## AT-DEPLOY-06: Volume Persistence ✅

### Objetivo
Validar que uploads persistem após restart

### Passos
1. Após AT-DEPLOY-02 ou AT-DEPLOY-03, copie a URL de um documento
   - Exemplo: `https://SUA-URL-RAILWAY/uploads/orgs/default/uploads/123-test.txt`
2. Abra Railway dashboard
3. Clique em **"Restart"** no serviço
4. Aguarde serviço voltar (1-2 minutos)
5. Tente acessar a mesma URL do documento

### Critérios de Aceite
- ✅ Documento ainda acessível (não 404)
- ✅ Conteúdo correto

### Se Falhar
- Verifique se volume está montado em `/app/uploads`
- Railway dashboard → Settings → Volumes
- Confirme mount path: `/app/uploads`

---

## Resumo de Aceite

| Teste | Status | Observações |
|-------|--------|-------------|
| AT-DEPLOY-01 | ⬜ | Health retorna JSON |
| AT-DEPLOY-02 | ⬜ | Agents KB upload → completed |
| AT-DEPLOY-03 | ⬜ | Chat upload → completed |
| AT-DEPLOY-04 | ⬜ | Full ingest (após desligar short-circuit) |
| AT-DEPLOY-05 | ⬜ | Zero "Unexpected token" errors |
| AT-DEPLOY-06 | ⬜ | Uploads persistem após restart |

---

## Próximos Passos

### Se TODOS os testes passarem ✅
1. **Produção está pronta!**
2. Configurar domínio customizado (opcional)
3. Monitorar logs por 24h
4. Considerar adicionar embeddings reais (OpenAI)

### Se AT-DEPLOY-04 falhar ⚠️
1. **NÃO ENTRAR EM PÂNICO** - upload básico funciona!
2. Capturar logs completos do Railway
3. Identificar erro específico:
   - `rag.parse.failed` → problema parsing PDF/DOCX
   - `rag.embed.failed` → problema embeddings
4. Patch cirúrgico será criado (5-10 linhas)

### Se AT-DEPLOY-02 ou AT-DEPLOY-03 falharem ❌
1. Verificar Railway logs imediatamente
2. Verificar Render logs (Nginx)
3. Testar health endpoint
4. Verificar ENV variables (Railway + Render)
5. Se necessário, rollback e revisar configuração

---

## Comandos Úteis

### Testar Health
```bash
# Via Render (proxy)
curl https://SUA-URL-RENDER/api/health | jq

# Via Railway (direto)
curl https://SUA-URL-RAILWAY/api/health | jq
```

### Ver Logs Railway
```bash
# No dashboard: Deployments → View Logs
# Ou via CLI (se instalado):
cd server && railway logs
```

### Ver Logs Render
```bash
# No dashboard: Logs tab
# Ou via CLI (se instalado):
cd client && render logs orkio-frontend
```

### Forçar Redeploy
```bash
# Railway: Dashboard → Redeploy
# Render: Dashboard → Manual Deploy → Deploy latest commit
```
