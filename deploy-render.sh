#!/bin/bash
set -e

echo "🎨 RENDER FRONTEND DEPLOYMENT SCRIPT"
echo "====================================="
echo ""

# Check if API URL was provided
if [ -z "$1" ]; then
    echo "❌ Error: Railway API URL required"
    echo ""
    echo "Usage: ./deploy-render.sh <RAILWAY_API_URL>"
    echo "Example: ./deploy-render.sh https://orkio-api-production.up.railway.app"
    echo ""
    exit 1
fi

API_URL=$1
echo "📍 Railway API URL: $API_URL"
echo ""

# Check if render CLI is installed
if ! command -v render &> /dev/null; then
    echo "❌ Render CLI not found. Installing..."
    npm install -g @render/cli
fi

echo "✅ Render CLI installed"
echo ""

# Login to Render (opens browser for authentication)
echo "🔐 Logging in to Render..."
echo "   → A browser window will open for authentication"
echo "   → Please login with: dangraebin@gmail.com"
echo ""
render login

echo ""
echo "✅ Render login successful"
echo ""

# Create render.yaml configuration
echo "📝 Creating Render configuration..."
cd client
cat > render.yaml << EOF
services:
  - type: web
    name: orkio-frontend
    env: docker
    dockerfilePath: ./Dockerfile
    envVars:
      - key: API_ORIGIN
        value: $API_URL
    healthCheckPath: /
EOF

echo ""
echo "✅ Render configuration created"
echo ""

# Deploy to Render
echo "🚀 Deploying Frontend to Render..."
render deploy

echo ""
echo "⏳ Waiting for deployment to complete..."
sleep 30

# Get the public URL
echo ""
echo "🌐 Getting public URL..."
RENDER_URL=$(render services list | grep orkio-frontend | awk '{print $3}')

echo ""
echo "====================================="
echo "✅ RENDER DEPLOYMENT COMPLETE!"
echo "====================================="
echo ""
echo "Frontend URL: $RENDER_URL"
echo "API URL: $API_URL"
echo ""
echo "📋 Next steps:"
echo "   1. Open: $RENDER_URL"
echo "   2. Run acceptance tests (see PATCH_006_NOTES.md)"
echo ""
echo "🔍 To view logs: render logs orkio-frontend"
echo "🔍 To open dashboard: render open orkio-frontend"
echo ""
