# PATCH 004 (CRITICAL) - tRPC Batch Format + UX

## Problema:
"Unable to transform response from server" ocorre porque respostas de erro não seguem formato batch do tRPC.

## Correções:

### 1) tRPC client - batch error envelope
- Criar makeBatchErrorEnvelope() que retorna array com formato batch correto
- Formato: `[{ error: { json: { message, code }, meta: {} } }]`
- Aplicar em respostas não-JSON ou 5xx
- Aplicar em network errors

### 2) Chat UX - status final e erro legível
- Validar tamanho antes de enviar (VITE_UPLOAD_MAX_MB)
- Exibir completed ou failed no badge
- onError: toast.error(error.message) sem parsing adicional
- Badges mostram nome do arquivo + status

### 3) Agents KB - rota no Admin
- Verificar rota /agents/:orgSlug está registrada
- AgentsManager tem aba Knowledge Base
- KB usa agents.get para obter kbCollectionId
- Permite upload/list/delete direto na KB do agente

## Testes de aceite:
- Upload TXT 1KB no Chat → badge completed
- Upload PDF 1-5MB → completed
- Forçar falha → sem "Unexpected token" ou "Unable to transform"
- Toast limpo com mensagem JSON
- /agents/:org → aba Knowledge Base visível e funcionando
