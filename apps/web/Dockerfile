# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/web/package*.json ./apps/web/

RUN npm install

COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/

RUN npm run build --workspace=apps/web

# ── Serve stage ───────────────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template

# envsubst replaces $PORT, $API_INTERNAL_URL, $RESOLVER; leaves nginx $variables intact
# RESOLVER is read from /etc/resolv.conf so nginx can dynamically re-resolve Railway internal hostnames
CMD ["/bin/sh", "-c", \
  "RESOLVER=$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf) && \
   envsubst '$PORT $API_INTERNAL_URL $RESOLVER' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && \
   nginx -g 'daemon off;'"]
