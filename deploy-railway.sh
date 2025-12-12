#!/bin/bash
set -e

echo "🚂 RAILWAY API DEPLOYMENT SCRIPT"
echo "================================="
echo ""

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

echo "✅ Railway CLI installed"
echo ""

# Login to Railway (opens browser for authentication)
echo "🔐 Logging in to Railway..."
echo "   → A browser window will open for authentication"
echo "   → Please login with: dangraebin@gmail.com"
echo ""
railway login

echo ""
echo "✅ Railway login successful"
echo ""

# Initialize Railway project
echo "📦 Initializing Railway project..."
cd server
railway init --name "orkio-api"

echo ""
echo "✅ Railway project created: orkio-api"
echo ""

# Set environment variables
echo "⚙️  Setting environment variables..."
railway variables set NODE_ENV=production
railway variables set STORAGE_MODE=local
railway variables set UPLOAD_DIR=/app/uploads
railway variables set REQUEST_BODY_LIMIT_MB=20
railway variables set UPLOAD_MAX_MB=16
railway variables set RAG_INGEST_MODE=inline
railway variables set FORCE_STORAGE_LOCAL=true
railway variables set DEBUG_UPLOAD_SHORT_CIRCUIT=true

echo ""
echo "✅ Environment variables configured"
echo ""

# Deploy to Railway
echo "🚀 Deploying API to Railway..."
railway up --detach

echo ""
echo "⏳ Waiting for deployment to complete..."
sleep 30

# Get the public URL
echo ""
echo "🌐 Getting public URL..."
RAILWAY_URL=$(railway domain)

echo ""
echo "================================="
echo "✅ RAILWAY DEPLOYMENT COMPLETE!"
echo "================================="
echo ""
echo "API URL: $RAILWAY_URL"
echo ""
echo "📋 Next steps:"
echo "   1. Save this URL for Render deployment"
echo "   2. Run: ./deploy-render.sh $RAILWAY_URL"
echo ""
echo "🔍 To view logs: railway logs"
echo "🔍 To open dashboard: railway open"
echo ""
