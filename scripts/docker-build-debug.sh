#!/bin/bash
# ============================================================
# Docker 构建本地调试脚本
# 用于在本地测试 GitHub Actions 中的 Docker 构建过程
# ============================================================

set -e

echo "============================================================"
echo "🔧 易报销 Pro - Docker 构建本地调试"
echo "============================================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker 已安装${NC}"
docker --version
echo ""

# 获取脚本所在目录的项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "项目根目录: $PROJECT_ROOT"
echo ""

# ==================== 后端镜像构建 ====================
echo -e "${YELLOW}[1/2] 构建后端镜像...${NC}"
echo ""

BUILD_CMD="docker build \
  -f \"$PROJECT_ROOT/Dockerfile.backend\" \
  --tag yibaoxiao-backend:debug \
  --build-arg NODE_OPTIONS=--max-old-space-size=3072 \
  --progress=plain \
  \"$PROJECT_ROOT\""

echo "执行命令: $BUILD_CMD"
echo ""

if eval "$BUILD_CMD"; then
    echo -e "${GREEN}✓ 后端镜像构建成功${NC}"
    docker images | grep yibaoxiao-backend
else
    echo -e "${RED}❌ 后端镜像构建失败${NC}"
    exit 1
fi

echo ""
echo ""

# ==================== 前端镜像构建 ====================
echo -e "${YELLOW}[2/2] 构建前端镜像...${NC}"
echo ""

BUILD_CMD="docker build \
  -f \"$PROJECT_ROOT/Dockerfile.frontend\" \
  --tag yibaoxiao-frontend:debug \
  --progress=plain \
  \"$PROJECT_ROOT\""

echo "执行命令: $BUILD_CMD"
echo ""

if eval "$BUILD_CMD"; then
    echo -e "${GREEN}✓ 前端镜像构建成功${NC}"
    docker images | grep yibaoxiao-frontend
else
    echo -e "${RED}❌ 前端镜像构建失败${NC}"
    exit 1
fi

echo ""
echo "============================================================"
echo -e "${GREEN}✓ 所有镜像构建完成${NC}"
echo "============================================================"
echo ""
echo "后端镜像: yibaoxiao-backend:debug"
echo "前端镜像: yibaoxiao-frontend:debug"
echo ""
echo "后续步骤:"
echo "1. 测试后端镜像: docker run --rm yibaoxiao-backend:debug node --version"
echo "2. 推送镜像: docker tag yibaoxiao-backend:debug ghcr.io/<USER>/yibaoxiao-backend:debug"
echo "3. 推送镜像: docker push ghcr.io/<USER>/yibaoxiao-backend:debug"
echo ""
