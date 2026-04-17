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

ENV ARRSM_DATA_DIR=/data
ENV STATIC_DIR=/app/static

RUN useradd -m -u 1000 unstackarr \
    && mkdir -p /data \
    && chmod 700 /data \
    && chown -R unstackarr:unstackarr /app /data
USER unstackarr

VOLUME ["/data"]
EXPOSE 7676

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7676"]
