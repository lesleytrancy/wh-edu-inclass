#!/usr/bin/env bash
# 一键更新：拉取最新代码 → 重建镜像 → 滚动重启（数据卷不受影响）
set -euo pipefail
cd "$(dirname "$0")/.."

git pull origin main
docker compose build
docker compose up -d --remove-orphans
docker image prune -f   # 清理悬空旧镜像

echo "更新完成，访问 http://localhost:8080"
