# PATCH 003B (HOTFIX 2) - Correções Adicionais

## Problemas a corrigir:
1. Upload failed: "Unexpected token 'S', 'Service Unavailable' is not valid JSON"
2. PDFs/DOCX em Failed ou Processing infinito
3. Deixar Redis opcional e embeddings estáveis (sem 404)

## Arquivos a alterar:

### Backend
- [x] server/_core/embeddings.ts - já criado (provider unificado Forge/OpenAI)
- [ ] server/_core/env.ts - adicionar UPLOAD_MAX_MB, REQUEST_BODY_LIMIT_MB
- [ ] server/rag.ts - já usa embeddings.ts, lazy loading, retries (OK)
- [ ] server/ragQueue.ts - já exporta getRagQueue() (OK)
- [ ] server/routers.ts - em documents.upload:
  - [ ] Validar tamanho do arquivo (base64)
  - [ ] Try/catch completo em storagePut e rag.processDocument
  - [ ] **Sempre retornar TRPCError (JSON)** - nunca throw Error
  - [ ] Usar getRagQueue() quando RAG_INGEST_MODE=queue
  - [ ] No chat.stream, capturar falha do RAG e seguir resposta sem RAG
- [ ] server/_core/http.ts (se existir) ou arquivo que cria servidor Express/Fastify:
  - [ ] Aumentar body limit conforme patch

### Frontend
- [ ] client/src/pages/Chat.tsx e client/src/components/AgentsManager.tsx:
  - [ ] Bloquear upload acima de VITE_UPLOAD_MAX_MB
  - [ ] Mensagens de erro via toast.error(error.message)
  - [ ] Garantir cleanup de setInterval (evitar removeChild ao desmontar)

## Variáveis de ambiente:

### Limites de upload (server)
```
UPLOAD_MAX_MB=16
REQUEST_BODY_LIMIT_MB=20
```

### Embeddings (escolher 1 provedor)
**Forge:**
```
EMBEDDING_PROVIDER=forge
EMBEDDING_BASE_URL=https://forge.manus.im/v1
EMBEDDING_MODEL=text-embedding-3-large
BUILT_IN_FORGE_API_KEY=... (já configurado)
```

**OpenAI:**
```
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-large
```

### Gerais
```
RAG_INGEST_MODE=inline  # deixa Redis opcional
MAX_FILES_PER_COLLECTION=20
AUTO_AGENT_KB=true
LOG_LEVEL=info
# REDIS_URL=redis://localhost:6379  # opcional, só se usar fila
```

### Frontend
```
VITE_UPLOAD_MAX_MB=16
```

## Testes de sanidade (AT-HOTFIX):

### A) Upload OK (Chat e Admin)
1. Envie um PDF de 1-5 MB
2. **Esperado:** processing → completed
3. **Se falhar:** toast com mensagem JSON legível (nada de "Unexpected token...")

### B) Chat sem erro de embeddings
1. Selecione agente com enableRAG=true
2. Envie mensagem
3. **Esperado:** sem Embeddings 404. Se provider indisponível, resposta sai **sem RAG** e loga chat.rag.failed

### C) Limite de tamanho
1. Tente enviar arquivo > 16 MB
2. **Esperado:** bloqueio no front e/ou PAYLOAD_TOO_LARGE do backend

### D) UI estável
1. Navegue entre Admin → Documents e outras páginas
2. **Esperado:** sem erro removeChild ... not a child

## Critérios de aceite:
- ✅ Nenhum toast com "Unexpected token ... Service Unavailable"
- ✅ Uploads concluem (PDF/DOCX) com status completed ou failed **com mensagem JSON**
- ✅ Chat responde mesmo sem embeddings; logs chat.answer e, em falha de RAG, chat.rag.failed
- ✅ Admin não quebra ao sair/entrar
