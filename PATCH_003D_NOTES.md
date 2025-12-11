# PATCH 003D (HOTFIX 4) - Eliminar "Unexpected token" no Frontend

## Objetivos:
1. Impedir toast "Unexpected token 'S' … Service Unavailable" no frontend (tRPC parseando HTML do proxy)
2. Fortalecer storagePut e expor /health para diagnóstico
3. Confirmar visualmente no Chat quando documento foi processado

## Implementações:

### 1) Frontend - tRPC com fetch resiliente a HTML/503
- Substituir fetch padrão por versão que "higieniza" respostas não-JSON
- Se vier 502/503/504 ou Content-Type não JSON → cria TRPC-like error
- Simula resposta JSON para client do tRPC não quebrar
- Efeito: mesmo que proxy responda HTML/503, front sempre recebe JSON

### 2) Frontend - feedback explícito de ingestão no Chat
- Exibir uploadedFiles com status (queued/processing/completed/failed)
- Botão "atualizar contexto" quando todos terminaram
- Toast mostra apenas error.message (sempre JSON pelo passo 1)

### 3) Backend - endurecer storagePut
- Verificação de res.ok
- Checagem de content-type
- Mensagem de erro curta e consistente (sem lançar HTML cru)

### 4) Backend - endpoint /health
- Ping storage: GET /health do forge API
- Ping embeddings: POST /embeddings com input ["ping"]
- Retorna JSON: { ok, storage, embeddings }
- Status 200 se healthy, 503 se degraded

## Testes de aceite:
- /api/health retorna JSON (200 ou 503) - nada de HTML
- Upload TXT 1KB via Chat → completed e toast limpo
- Desligar storage/embeddings → upload falha com toast JSON claro
- PDF 1-5MB via Admin/Chat → completed
- Chat com agente RAG → responde; se embeddings off, responde sem RAG
