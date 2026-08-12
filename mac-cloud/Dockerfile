# Shared image for amlak-api, mcp (start:mcp), and automation-worker (start:automation).
# Compose overrides CMD per service; keep EXPOSE aligned with published ports.
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 8787 8791 8792

CMD ["npm", "start"]
