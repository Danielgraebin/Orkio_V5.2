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
