#!/bin/bash
set -e

echo "🚀 ORKIO v5 - FULL DEPLOYMENT SCRIPT"
echo "======================================"
echo ""
echo "This script will deploy:"
echo "  1. API to Railway"
echo "  2. Frontend+Proxy to Render"
echo ""
echo "You will need to authenticate twice:"
echo "  - Railway login (browser)"
echo "  - Render login (browser)"
echo ""
read -p "Press Enter to continue..."
echo ""

# Step 1: Deploy API to Railway
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1/2: Deploying API to Railway"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

chmod +x deploy-railway.sh
./deploy-railway.sh

# Extract Railway URL from output
RAILWAY_URL=$(cd server && railway domain 2>/dev/null || echo "")

if [ -z "$RAILWAY_URL" ]; then
    echo ""
    echo "⚠️  Could not auto-detect Railway URL"
    echo ""
    read -p "Please enter your Railway API URL: " RAILWAY_URL
fi

echo ""
echo "✅ Railway API deployed: $RAILWAY_URL"
echo ""
read -p "Press Enter to continue to Render deployment..."
echo ""

# Step 2: Deploy Frontend to Render
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2/2: Deploying Frontend to Render"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

chmod +x deploy-render.sh
./deploy-render.sh "$RAILWAY_URL"

echo ""
echo "======================================"
echo "✅ FULL DEPLOYMENT COMPLETE!"
echo "======================================"
echo ""
echo "🎉 Your application is now live!"
echo ""
echo "📋 URLs:"
echo "   API (Railway): $RAILWAY_URL"
echo "   Frontend (Render): Check output above"
echo ""
echo "📋 Next: Run acceptance tests"
echo "   See: PATCH_006_NOTES.md (section: Testes de aceite)"
echo ""
