# syntax=docker/dockerfile:1

########## Stage 1: 构建前端（Vite → dist） ##########
FROM node:22-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY vite.config.js index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

########## Stage 2: FastAPI 后端运行时 ##########
FROM python:3.12-slim AS backend
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AI_DATA_DIR=/data
WORKDIR /srv
COPY server/requirements.txt server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt
COPY server ./server
# SQLite 数据库与上传文件都落在 /data，挂卷即可持久化
VOLUME ["/data"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/api/health')" || exit 1
CMD ["uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "8000"]

########## Stage 3: nginx 静态站点 + /api 反代（对外唯一入口） ##########
FROM nginx:1.27-alpine AS final
COPY --from=frontend /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
