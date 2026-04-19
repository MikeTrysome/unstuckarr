# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend
FROM python:3.12-slim
WORKDIR /app

RUN pip install --no-cache-dir --upgrade pip

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# Copy built frontend into static/
COPY --from=frontend-build /build/dist/ ./static/

ENV UNSTUCKARR_DATA_DIR=/data
ENV STATIC_DIR=/app/static

RUN apt-get update && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1000 unstuckarr \
    && mkdir -p /data \
    && chmod 755 /data \
    && chown -R unstuckarr:unstuckarr /app /data

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

VOLUME ["/data"]
EXPOSE 7676

LABEL net.unraid.docker.icon="https://raw.githubusercontent.com/MikeTrysome/unstuckarr/main/frontend/public/icon.png" \
      org.opencontainers.image.version="0.2.0"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
