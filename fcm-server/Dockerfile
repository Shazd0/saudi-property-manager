# ZATCA signing API — build from the repository root:
#   docker build -f fcm-server/Dockerfile -t amlak-zatca .
#
# At runtime, mount zatca-cert/ (writable: PIH + counter are updated after each invoice).

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
