#!/bin/sh
set -e

# Validate API_ORIGIN is set (ex.: https://orkio-api.up.railway.app)
: "${API_ORIGIN:?API_ORIGIN not set}"

# Substitute $API_ORIGIN in nginx template
envsubst '$API_ORIGIN' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx
nginx -g 'daemon off;'
