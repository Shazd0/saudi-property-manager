# ZATCA signing API — build from the repository root:
#   docker build -f fcm-server/Dockerfile -t zatca-api .
#
# At runtime, mount your certificate folder (same files as local zatca-cert/):
#   docker run -d -p 3002:3002 -v /secure/zatca-cert:/app/zatca-cert:ro -e ZATCA_CORS_ORIGINS=https://your-spa-host.example.com zatca-api
#
# Put Nginx or Caddy in front on the VPS for HTTPS; set VITE_ZATCA_SERVICE_URL to that public URL when building the Amlak app.

FROM node:20-alpine
WORKDIR /app
COPY fcm-server/package.json fcm-server/package-lock.json ./fcm-server/
RUN cd fcm-server && npm ci --omit=dev
COPY fcm-server/ ./fcm-server/
RUN mkdir -p /app/zatca-cert
ENV ZATCA_PORT=3002
ENV ZATCA_HOST=0.0.0.0
ENV ZATCA_CERT_DIR=/app/zatca-cert
EXPOSE 3002
CMD ["node", "fcm-server/zatca-service.js"]
