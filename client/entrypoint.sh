#!/bin/sh
set -e

# Validate API_ORIGIN is set (ex.: https://orkio-api.up.railway.app)
: "${API_ORIGIN:?API_ORIGIN not set}"

# Gera /config.js com as variáveis do ambiente do Render
envsubst '$VITE_OAUTH_PORTAL_URL $VITE_APP_ID $API_ORIGIN $VITE_UPLOAD_MAX_MB' \
  < /usr/share/nginx/html/config.js.template \
  > /usr/share/nginx/html/config.js

# Substitute $API_ORIGIN in nginx template (full nginx.conf)
envsubst '$API_ORIGIN' \
  < /etc/nginx/nginx.conf.template \
  > /etc/nginx/nginx.conf

# Start nginx
nginx -g 'daemon off;'
