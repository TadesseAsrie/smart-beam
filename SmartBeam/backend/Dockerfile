FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-impress libreoffice-writer fonts-dejavu fonts-liberation fonts-noto-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npm run build
COPY receiver/ ./receiver/
ENV NODE_ENV=production DATA_DIR=/data RECEIVER_DIR=/app/receiver PORT=8080
VOLUME /data
EXPOSE 8080
CMD ["node", "dist/server.js"]
