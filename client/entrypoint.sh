#!/bin/sh
set -e

# Validate API_ORIGIN is set (ex.: https://orkio-api.up.railway.app)
: "${API_ORIGIN:?API_ORIGIN not set}"

# Gera /config.js com as variáveis do ambiente do Render
# Observação: mantenha TODAS as vars que você usa no template na lista do envsubst
envsubst '$VITE_OAUTH_PORTAL_URL $VITE_APP_ID $API_ORIGIN $VITE_UPLOAD_MAX_MB' \
  < /usr/share/nginx/html/config.js.template \
  > /usr/share/nginx/html/config.js

# Substitute $API_ORIGIN in nginx template
envsubst '$API_ORIGIN' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
nginx -g 'daemon off;'
