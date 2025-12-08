# Orkio v5 Platform - TODO

## Phase 1: Database Schema
- [x] Design conversations table (id, userId, orgSlug, title, createdAt, updatedAt)
- [x] Design messages table (id, conversationId, role, content, createdAt)
- [x] Update users table with orgSlug for multi-tenant support
- [x] Push database migrations

## Phase 2: Backend - Authentication & Multi-tenant
- [x] Implement user registration with orgSlug
- [x] Implement user login with JWT token generation
- [x] Add multi-tenant isolation middleware
- [x] Create protected procedures with user context

## Phase 3: Backend - Chat Features
- [x] Create conversation CRUD procedures (create, list, get, delete)
- [x] Create message procedures (create, list)
- [x] Implement streaming chat with LLM integration
- [x] Add conversation persistence

## Phase 4: Frontend - Authentication
- [x] Create login/register page
- [x] Implement JWT token storage and management
- [x] Add authentication guards for protected routes
- [x] Create user profile display

## Phase 5: Frontend - Chat Interface
- [x] Build chat page with message input
- [x] Implement streaming message display
- [x] Add conversation history sidebar
- [x] Create new conversation button
- [x] Add conversation switching

## Phase 6: Testing
- [x] Write vitest tests for auth procedures
- [x] Write vitest tests for conversation procedures
- [x] Write vitest tests for message procedures
- [x] Write vitest tests for multi-tenant isolation
- [x] Test streaming functionality

## Phase 7: Deployment & Production Tests
- [ ] Deploy to Vercel
- [ ] Configure environment variables (DATABASE_URL, JWT_SECRET, etc.)
- [ ] Execute AT-06 production tests:
  - [ ] Test user registration
  - [ ] Test login with JWT
  - [ ] Test chat with streaming
  - [ ] Test conversation persistence
  - [ ] Test multi-tenant isolation
- [ ] Deliver final report with public URLs

## Known Issues
- None yet

## Future Enhancements
- Add conversation search
- Add message editing/deletion
- Add file attachments
- Add conversation sharing

## Phase 8: Admin Console
- [x] Create admin procedures (getAllUsers, getAllConversations, getStats)
- [x] Build admin dashboard with metrics
- [x] Implement user management interface (list, view, promote to admin)
- [x] Implement conversation monitoring (view all conversations across orgs)
- [x] Add analytics charts (users over time, conversations, messages)
- [x] Add admin route protection (only admin role can access)
- [x] Test admin console functionality

## Phase 9: V4.5 Integration - Agents, RAG, Voice
- [ ] Fix admin console database query error
- [ ] Read and analyze v4.5 blueprint
- [ ] Create agents table (id, name, systemPrompt, model, temperature, tools, orgSlug)
- [ ] Create documents table (id, name, content, orgSlug, collectionId)
- [ ] Create collections table (id, name, orgSlug)
- [ ] Create embeddings table (id, documentId, chunkIndex, embedding, content)
- [ ] Create agent_conversations table (agentId, conversationId)
- [ ] Implement agent CRUD procedures
- [ ] Implement document upload and ingest pipeline
- [ ] Implement collection management procedures
- [ ] Implement vector search for RAG
- [ ] Implement STT endpoint with Whisper
- [ ] Add Agents tab to admin console
- [ ] Add Documents tab to admin console
- [ ] Add Collections tab to admin console
- [ ] Add agent selector to chat UI
- [ ] Add microphone button to chat UI
- [ ] Add RAG sources display to chat UI
- [ ] Write integration tests (AT-07)
- [ ] Test agent creation and configuration
- [ ] Test document upload and RAG
- [ ] Test voice-to-text in chat

## Bug Fix: NotFoundError in Production Admin Console
- [x] Investigate NotFoundError when clicking "Create Agent" in production
- [x] Analyze AgentsManager Dialog/Portal implementation
- [x] Fix hydration issues or Portal conflicts
- [x] Stabilize React keys in agent list
- [x] Test agent creation flow in dev environment
- [x] Add integration test for admin agent creation
- [ ] Publish fix to production
- [ ] Validate fix in production (orkioplatform-jbcwtaex.manus.space/admin)

## PATCH 008.A: Fix Select Component in Chat (Agent Dropdown)
- [x] Locate Select component for agent selection in Chat.tsx
- [x] Remove any `<SelectItem value="">` instances
- [x] Replace with sentinel value "none" for "No agent" option
- [x] Use `value={value ?? "none"}` in Select component
- [x] Add proper placeholder via SelectValue
- [x] Test agent selection in dev environment
- [ ] Publish fix to production
- [ ] Validate in production (AT-08): open chat, select agent, send message

## PATCH 008.C: Definitive Select Fix (Use 'default' sentinel)
- [x] Replace 'none' with 'default' sentinel in Chat.tsx Select component
- [x] Update onValueChange logic to handle 'default' → null
- [x] Add value prop to Select: `value={selectedAgentId != null ? selectedAgentId.toString() : "default"}`
- [x] Verify no `<SelectItem value="">` exists
- [x] Test: Create conversation without agent (should work)
- [x] Test: Create conversation with agent selected (should work)
- [x] Test: Switch from agent to "Default Assistant" (should work)
- [ ] Save checkpoint
- [ ] Deploy to production
- [ ] Validate in production: /chat/default/... works without error

## PATCH 008.D: Hardening Select Component (Final Fix)
- [x] Extract selectValue as constant in Chat.tsx
- [x] Add `.filter((agent) => agent.id != null)` before mapping agents
- [x] Improve parsing with `Number.isNaN` check in onValueChange
- [x] Run global grep to find any `SelectItem value=""`
- [x] Fix any remaining empty values found (NONE FOUND)
- [x] Test: /admin → Agents → Create agent
- [x] Test: /chat → Start conversation without agent
- [x] Test: /chat → Start conversation with agent selected
- [x] Test: /chat → Switch between agents
- [ ] Save checkpoint
- [ ] Deploy to production
- [ ] Validate in production: /chat/default/... works in all 3 scenarios

## PATCH 009.A: Definitive Select Fix (Simplified)
- [x] Add DEFAULT_AGENT_VALUE constant at top of Chat.tsx
- [x] Simplify Select component (remove IIFE)
- [x] Use DEFAULT_AGENT_VALUE in value prop and onValueChange
- [x] Remove .filter() - keep simple map
- [x] Test Select behavior in dev

## PATCH 009.B: Edit Agent Modal
- [x] Add Edit button to agent cards in AgentsManager
- [x] Create editingAgent state
- [x] Create openEditModal function
- [x] Build Edit Agent Dialog with form fields
- [x] Add model selector dropdown in edit modal
- [x] Implement updateAgent mutation in backend (already existed)
- [x] Test agent editing flow in dev
- [ ] Save checkpoint
- [ ] Deploy to production
- [ ] Validate all scenarios in production

## PATCH 011.A: Upload de Documentos + Pipeline RAG
- [x] Diagnosticar estado atual do pipeline de upload/processamento
- [x] Verificar schema das tabelas: collections, documents, embeddings
- [x] Corrigir endpoint documents.upload para:
  - [x] Salvar arquivo no storage (S3)
  - [x] Extrair texto (suporte PDF, DOCX, TXT)
  - [x] Fazer chunking (500 chars com overlap)
  - [x] Gerar embeddings usando OpenAI
  - [x] Salvar embeddings na tabela
  - [x] Atualizar status: pending → processing → completed/failed
  - [x] Em caso de erro: marcar status=failed e logar motivo
- [ ] Testar upload de documento no Admin
- [ ] Verificar que status chega em "completed"
- [ ] Verificar embeddings salvos no banco

## PATCH 011.B: Agent + RAG no Chat
- [x] Verificar/criar tabela agent_collections (agentId, collectionId) - já existia
- [x] Adicionar multi-select de Collections no AgentsManager (create/edit)
- [x] Implementar linkagem agent ↔ collections no backend
- [x] No chat backend, quando agent tem RAG ON:
  - [x] Gerar embedding da pergunta do usuário
  - [x] Buscar chunks relevantes via cosine similarity
  - [x] Montar contexto RAG com chunks + metadados
  - [x] Incluir contexto no system prompt antes do LLM
- [x] Garantir que chat funciona normalmente se RAG OFF ou sem coleções
- [ ] Testar: criar agent com RAG, vincular coleção, perguntar sobre documento

## PATCH 012.A: Ligação entre Agentes (HAG / Multi-Agent)
- [x] Criar tabela agent_links (parentAgentId, childAgentId)
- [x] Adicionar multi-select "Linked Agents" no AgentsManager (edit)
- [x] Implementar procedures para link/unlink agents
- [x] No chat backend, quando agent tem linked agents:
  - [x] Detectar quando deve chamar agent filho
  - [x] Implementar forward simples (MVP: chamar primeiro linked agent)
  - [x] Retornar resposta do agent filho
- [ ] Testar: criar agent A ligado a agent B, chat com A deve chamar B
- [x] Documentar fluxo de orquestração implementado

## Critérios de Aceite (Produção)
- [ ] Upload documento → status vai para "ready"
- [ ] Criar coleção → vincular documentos
- [ ] Criar/editar agent → ativar RAG → vincular coleções
- [ ] Chat com agent RAG → respostas usando conteúdo dos documentos
- [ ] Criar agent A ligado a agent B → chat com A chama B

## 🔥 CRITICAL PRODUCTION ISSUES (Prioridade Máxima)

### Issue 1: Upload de Documentos Travando
- [x] Diagnosticar por que documentos ficam em "Processing..." indefinidamente
- [x] Verificar se processDocument está sendo chamado corretamente
- [x] Verificar se embeddings estão sendo salvos
- [x] Adicionar timeout e error handling robusto
- [x] Garantir que status muda para "completed" ou "failed"
- [x] Corrigido endpoint embeddings: api.openai.com → forge.manus.im
- [x] Adicionados logs detalhados em todo o pipeline
- [ ] Testar upload de PDF, DOCX, TXT em produção

### Issue 2: RAG Não Funcionando no Chat
- [x] Verificar se agent_collections está sendo consultado
- [x] Verificar se searchRelevantChunks está retornando resultados
- [x] Verificar se contexto RAG está sendo incluído no LLM
- [x] Adicionar logs de debug: "RAG: found N chunks for agent X"
- [x] Logs adicionados em chat.stream e searchRelevantChunks
- [ ] Testar pergunta sobre documento com agent RAG ON
- [ ] Validar resposta usa conteúdo do documento

### Issue 3: NotFoundError em Dialogs/Select (Produção)
- [x] Revisar todos Dialog em Chat.tsx
- [x] Revisar todos Dialog em AgentsManager.tsx
- [x] Revisar todos Dialog em DocumentsManager.tsx
- [x] Revisar todos Dialog em CollectionsManager.tsx
- [x] Garantir modal={true} em todos Dialog - todos corretos
- [x] Verificar que nenhum SelectItem tem value="" - nenhum encontrado
- [x] Adicionado safety check no DialogPortal (isMounted)
- [ ] Testar em produção: criar/editar agent sem erros
- [ ] Testar em produção: chat com agent sem erros

## PATCH 011.C: Upload de Documentos 100% Funcional no Admin
- [x] Diagnosticar erro "Unexpected token '<', '<!doctype'... is not valid JSON"
- [x] Corrigir mutation de upload para retornar JSON correto
- [x] Validar pipeline completo: upload → extração → chunking → embeddings → status
- [x] Mostrar status correto na UI: Pending → Processing → Ready/Failed
- [x] Permitir mínimo 20 arquivos por collection (limite adicionado)
- [ ] Testar upload de 3 documentos reais (PDF, DOCX, TXT) em produção
- [ ] Verificar que status chega em "Ready" após processamento
- [x] Garantir mensagem de erro amigável se processamento falhar

## PATCH 011.D: Vincular Collections a Agents (RAG por Agente)
- [x] Validar multi-select de Collections no Admin → Agents (já implementado)
- [x] Garantir que agent_collections é atualizada corretamente (create/edit)
- [x] Validar RAG no chat: agent com RAG ON + collections vinculadas
- [ ] Testar fluxo completo em produção:
  - [ ] Criar Collection no Admin
  - [ ] Upload 2-3 documentos na Collection
  - [ ] Criar/editar Agent e vincular Collection
  - [ ] No chat, escolher Agent e perguntar sobre conteúdo dos docs
  - [ ] Verificar que resposta usa conteúdo dos documentos

## PATCH 011.E: Upload de Documentos pelo Chat (ADIADO)
- [ ] Adicionar botão/área "Upload de documentos" na tela de chat
- [ ] Criar Collection automática por conversa: conversation-{conversationId}
- [ ] Reutilizar endpoint de upload do Admin
- [ ] Vincular documentos à collection automática
- [ ] Se agent tem RAG ON, incluir collection automática no escopo
- [ ] Permitir mínimo 20 arquivos por conversa
- [ ] Adicionar aviso amigável se exceder limite
- [ ] Testar upload direto pelo chat

NOTA: Funcionalidade adiada. Usuários devem usar Admin Console para upload.

## Limite de Arquivos
- [x] Adicionar validação de limite (20 arquivos) no backend
- [x] Retornar erro claro: "Maximum 20 files per collection..."
- [ ] Tratar erro no frontend com mensagem amigável (toast)
- [ ] Documentar como aumentar limite via env/config
