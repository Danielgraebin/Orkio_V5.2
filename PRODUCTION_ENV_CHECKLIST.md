# Production ENV Checklist - PATCH 005E

## Required Environment Variables

Configure these in **Settings → Secrets** in the Management UI, then **Publish** to apply:

```bash
# Storage Configuration
FORCE_STORAGE_LOCAL=true          # Force local storage (no Forge API)
STORAGE_MODE=local                # Storage mode: local or forge
UPLOAD_DIR=./uploads              # Local upload directory

# Upload Limits
REQUEST_BODY_LIMIT_MB=20          # Max request body size
UPLOAD_MAX_MB=16                  # Max file upload size

# Diagnostic Toggles
DEBUG_UPLOAD_SHORT_CIRCUIT=true   # Skip RAG/embeddings (instant completed status)

# RAG Configuration
RAG_INGEST_MODE=inline            # Ingest mode: inline or queue
```

## Validation Steps

### 1. After Setting ENV Variables
- Click **Publish** button in Management UI
- Wait for deployment to complete (~30-60 seconds)
- Verify ENV applied: `curl https://your-domain.manus.space/api/health | jq .env`

Expected output:
```json
{
  "env": {
    "storageMode": "local",
    "forceStorageLocal": true,
    "debugUploadShortCircuit": true,
    "ragIngestMode": "inline",
    "uploadMaxMB": 16
  }
}
```

### 2. Test A: Agents KB Upload
1. Navigate to `/agents/default`
2. Select an agent
3. Go to **Knowledge Base** tab
4. Upload a `.txt` file (1KB)

**Expected behavior:**
- Network: `POST /trpc/documents.upload` with `Content-Type: application/json`
- Response: JSON array (batch) with `result.data.id`
- Logs: 
  ```
  documents.upload.started { hasOrg:true, hasAgentId:true, hasContent:true }
  documents.upload.completed_short_circuit
  ```
- UI: Status badge shows "completed" immediately

### 3. Test B: Chat Upload
1. Navigate to `/chat`
2. Start or select a conversation
3. Click attach icon and upload a `.txt` file (1KB)

**Expected behavior:**
- Network: `POST /trpc/documents.upload` with `Content-Type: application/json`
- Response: JSON array (batch) with `result.data.id`
- Logs:
  ```
  documents.upload.started { hasOrg:true, hasConversationId:true, hasContent:true }
  documents.upload.completed_short_circuit
  ```
- UI: Badge shows "completed" after polling

## Troubleshooting

If upload fails, collect these 3 pieces of evidence:

### 1. Network Request
Open DevTools → Network → Find `/trpc/documents.upload`
- URL
- Content-Type (should be `application/json`)
- Request Payload (check for `agentId`/`conversationId`/`orgSlug`/`content`)

### 2. Network Response
- Response body (should be JSON array, not HTML)
- Status code

### 3. Server Logs
Look for these two lines in server output:
```
documents.upload.started { ... }
documents.upload.completed_short_circuit (or storage_failed/unhandled)
```

Send these 3 pieces of evidence for targeted debugging.

## Next Steps After Validation

Once both Test A and Test B pass:

1. **Disable short-circuit**: Set `DEBUG_UPLOAD_SHORT_CIRCUIT=false`
2. **Test full ingest**: Upload PDF → verify RAG processing works
3. **Monitor logs**: Look for `rag.parse.failed` or `chat.rag.failed` if issues occur
4. **Remove test endpoint**: Delete `server/test-upload-endpoint.ts` and route from `server/_core/index.ts`
