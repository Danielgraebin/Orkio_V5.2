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
