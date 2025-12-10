# PATCH 003C (HOTFIX 3) - Eliminar "Unexpected token 'S' Service Unavailable"

## Problema:
Toast "Unexpected token 'S' … Service Unavailable" indica que reverse proxy/host retornou 503 HTML para /trpc/documents.upload. Frontend (tRPC) tentou parsear JSON e falhou.

## Causas comuns:
- Body limit/timeout no proxy
- Storage/embeddings intermitente
- Exceção não capturada no handler

## Soluções:

### 1) Garantir JSON SEMPRE no tRPC (middleware)
- Adicionar errorFormatter e onError globais em server/_core/trpc.ts
- Forçar formato estável JSON (sem stack em prod)

### 2) Timeout defensivo em documents.upload
- Criar função withTimeout para operações longas
- Aplicar em storagePut (20s timeout)
- Aplicar em rag.processDocument (30s timeout)
- Sempre retornar TRPCError com mensagem clara

### 3) Borda/Proxy (se aplicável)
- client_max_body_size 30m
- proxy_read_timeout 120s
- proxy_send_timeout 120s
- proxy_buffering off

### 4) ENV confirmados:
```
RAG_INGEST_MODE=inline
UPLOAD_MAX_MB=16
REQUEST_BODY_LIMIT_MB=20
EMBEDDING_PROVIDER=forge
EMBEDDING_BASE_URL=https://forge.manus.im/v1
BUILT_IN_FORGE_API_KEY=...
```

### 5) Chat: manter vínculo com conversa
- conversationId não pode ser null
- Backend cria/usa collection: conversation-<id>
- RAG do chat.stream consulta coleção do agente + coleção da conversa

## Critérios de aceite:
- ✅ Upload em Chat e Admin retorna JSON no sucesso/falha (sem "Unexpected token…")
- ✅ Arquivos pequenos (1–5 MB): completed
- ✅ DOCX/PDF problemáticos: failed COM mensagem JSON clara
- ✅ Chat responde e usa RAG quando embeddings OK
