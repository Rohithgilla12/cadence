# Static landing page for cadence.gilla.fun. nginx:alpine with the page
# baked in — same deploy chain as cadence-api: GitHub Actions builds + pushes
# `ghcr.io/rohithgilla12/cadence-landing:<sha>`, Portainer pulls the new
# image on next stack update.

FROM nginx:1.27-alpine

LABEL org.opencontainers.image.source="https://github.com/Rohithgilla12/cadence"
LABEL org.opencontainers.image.description="Cadence marketing landing page"
LABEL org.opencontainers.image.licenses="proprietary"

# Default nginx config is fine — it serves /usr/share/nginx/html on :80
# and handles SPA-style fallback well enough for our flat tree.
COPY index.html /usr/share/nginx/html/index.html
COPY brand /usr/share/nginx/html/brand

# Cloudflare Tunnel will set its own X-Forwarded-* headers; nginx default
# logs them.
EXPOSE 80
