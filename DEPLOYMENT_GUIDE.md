# 🚀 Orkio v5 - Deployment Guide (PATCH 006)

## Quick Start (Automated)

### Prerequisites
- Node.js 18+ installed
- Git installed
- Terminal access

### One-Command Deployment

```bash
chmod +x deploy-all.sh && ./deploy-all.sh
```

This script will:
1. Install Railway CLI (if needed)
2. Authenticate with Railway (opens browser)
3. Deploy API to Railway
4. Install Render CLI (if needed)
5. Authenticate with Render (opens browser)
6. Deploy Frontend+Proxy to Render

**Total time:** ~10-15 minutes (including authentication)

---

## Step-by-Step Manual Deployment

If you prefer manual control or the automated script fails:

### Step 1: Deploy API to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login (opens browser)
railway login

# Navigate to server directory
cd server

# Initialize project
railway init --name "orkio-api"

# Set environment variables
railway variables set NODE_ENV=production
railway variables set STORAGE_MODE=local
railway variables set UPLOAD_DIR=/app/uploads
railway variables set REQUEST_BODY_LIMIT_MB=20
railway variables set UPLOAD_MAX_MB=16
railway variables set RAG_INGEST_MODE=inline
railway variables set FORCE_STORAGE_LOCAL=true
railway variables set DEBUG_UPLOAD_SHORT_CIRCUIT=true

# Deploy
railway up --detach

# Get public URL
railway domain
```

**Save the Railway URL** (e.g., `https://orkio-api-production.up.railway.app`)

### Step 2: Deploy Frontend to Render

```bash
# Install Render CLI
npm install -g @render/cli

# Login (opens browser)
render login

# Navigate to client directory
cd ../client

# Create render.yaml
cat > render.yaml << 'EOF'
services:
  - type: web
    name: orkio-frontend
    env: docker
    dockerfilePath: ./Dockerfile
    envVars:
      - key: API_ORIGIN
        value: YOUR_RAILWAY_URL_HERE
    healthCheckPath: /
EOF

# Replace YOUR_RAILWAY_URL_HERE with actual Railway URL
# Example: https://orkio-api-production.up.railway.app

# Deploy
render deploy
```

---

## Acceptance Tests

After deployment, run:

```bash
chmod +x run-acceptance-tests.sh
./run-acceptance-tests.sh https://your-render-url.onrender.com
```

### Manual Tests Checklist

#### ✅ AT-DEPLOY-01: Health Check
```bash
curl https://your-render-url.onrender.com/api/health | jq
```
**Expected:** JSON response (200 or 503), never HTML

#### ✅ AT-DEPLOY-02: Agents → KB Upload
1. Open: `https://your-render-url.onrender.com/agents/default`
2. Select an agent
3. Go to "Knowledge Base" tab
4. Upload small .txt file (1KB)

**Expected with DEBUG_UPLOAD_SHORT_CIRCUIT=true:**
- Status: `completed` (in seconds)
- Railway logs:
  ```
  documents.upload.started { hasOrg:true, hasAgentId:true }
  documents.upload.completed_short_circuit
  ```

#### ✅ AT-DEPLOY-03: Chat Upload
1. Open: `https://your-render-url.onrender.com/chat`
2. Start or select conversation
3. Attach small .txt file (1KB)

**Expected:**
- Badge shows: `completed`
- Railway logs:
  ```
  documents.upload.started { hasConversationId:true }
  ```

#### ✅ AT-DEPLOY-04: Full Ingest (After Proving Upload Works)
1. In Railway dashboard: set `DEBUG_UPLOAD_SHORT_CIRCUIT=false`
2. Restart Railway service
3. Upload PDF (1-5 MB)

**Expected:**
- Status: `completed` (may take longer)
- If fails: check logs for `rag.parse.failed` or `chat.rag.failed`

#### ✅ AT-DEPLOY-05: No "Unexpected token" Errors
- No "Unexpected token" errors in browser console
- No "Unable to transform" errors
- Nginx proxy ensures JSON responses always

#### ✅ AT-DEPLOY-06: Volume Persistence
1. Note a document URL (e.g., `/uploads/...`)
2. Restart Railway service
3. Access same URL

**Expected:** Document still accessible (not 404)

---

## Troubleshooting

### Railway CLI Issues

**Problem:** `railway: command not found`
```bash
npm install -g @railway/cli
```

**Problem:** Authentication fails
```bash
railway logout
railway login
```

### Render CLI Issues

**Problem:** `render: command not found`
```bash
npm install -g @render/cli
```

**Problem:** Deployment hangs
- Check Render dashboard for build logs
- Verify `API_ORIGIN` is set correctly in render.yaml

### Upload Failures

**Problem:** Upload returns error
1. Check Railway logs: `cd server && railway logs`
2. Look for:
   - `documents.upload.started` (confirms request reached API)
   - `storage_failed` (storage issue)
   - `rag.parse.failed` (ingest issue)

**Problem:** "Unexpected token" errors
- Verify Nginx is running (Render logs)
- Check `API_ORIGIN` matches Railway URL exactly

### CORS Errors

**Problem:** Browser shows CORS errors
- This should NOT happen with Nginx proxy
- Verify `/trpc` and `/api` routes in `nginx.conf.template`
- Check Render logs for Nginx errors

---

## Viewing Logs

### Railway API Logs
```bash
cd server
railway logs
```

### Render Frontend Logs
```bash
cd client
render logs orkio-frontend
```

---

## Rollback

Both Railway and Render support rollback to previous deployments:

### Railway Rollback
1. Open Railway dashboard
2. Go to your project
3. Click "Deployments"
4. Select previous deployment
5. Click "Redeploy"

### Render Rollback
1. Open Render dashboard
2. Go to your service
3. Click "Deploys"
4. Select previous deploy
5. Click "Rollback"

---

## Environment Variables Reference

### Railway (API)

| Variable | Value | Purpose |
|----------|-------|---------|
| `NODE_ENV` | `production` | Production mode |
| `STORAGE_MODE` | `local` | Use local filesystem |
| `UPLOAD_DIR` | `/app/uploads` | Upload directory |
| `REQUEST_BODY_LIMIT_MB` | `20` | Max request size |
| `UPLOAD_MAX_MB` | `16` | Max file size |
| `RAG_INGEST_MODE` | `inline` | Process uploads inline |
| `FORCE_STORAGE_LOCAL` | `true` | Force local storage |
| `DEBUG_UPLOAD_SHORT_CIRCUIT` | `true` | Skip RAG for testing |

### Render (Frontend)

| Variable | Value | Purpose |
|----------|-------|---------|
| `API_ORIGIN` | Railway URL | Backend API endpoint |

---

## Next Steps After Successful Deployment

1. **Disable short-circuit mode** (once upload is proven working):
   - Railway dashboard → Set `DEBUG_UPLOAD_SHORT_CIRCUIT=false`
   - Restart service
   - Test PDF upload with full RAG processing

2. **Configure custom domain** (optional):
   - Railway: Add custom domain in dashboard
   - Render: Add custom domain in dashboard
   - Update DNS records

3. **Set up monitoring**:
   - Railway: Built-in metrics available
   - Render: Built-in metrics available
   - Consider external monitoring (Uptime Robot, Pingdom)

4. **Enable embeddings** (when ready):
   - Add `EMBEDDING_PROVIDER=openai`
   - Add `OPENAI_API_KEY=your_key`
   - Add `EMBEDDING_MODEL=text-embedding-3-small`
   - Restart Railway service

---

## Support

If you encounter issues:

1. **Check logs first** (Railway + Render)
2. **Verify environment variables** are set correctly
3. **Test health endpoint**: `/api/health` should return JSON
4. **Review PATCH_006_NOTES.md** for architecture details

---

## Architecture Summary

```
User Browser
    ↓
Render (Nginx)
    ├─ / → Frontend (SPA)
    ├─ /trpc → Proxy to Railway
    └─ /api → Proxy to Railway
            ↓
        Railway (Node.js API)
            └─ /app/uploads (Volume)
```

**Key Benefits:**
- ✅ No CORS issues (same origin)
- ✅ No "Unexpected token" errors (Nginx ensures JSON)
- ✅ Persistent uploads (Railway volume)
- ✅ Independent of Manus infrastructure
- ✅ Easy rollback (both platforms support it)
- ✅ Diagnostic mode (prove upload works before enabling RAG)
