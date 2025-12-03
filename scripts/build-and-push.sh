#!/bin/bash
# ============================================================
# 易报销 Pro - 本地构建并推送到 Docker Hub
# ============================================================
# 
# 使用方法：
#   ./scripts/build-and-push.sh [DOCKER_USERNAME]
#
# 示例：
#   ./scripts/build-and-push.sh myusername
#
# 前置要求：
#   1. 安装 Docker Desktop（已启用 Buildx）
#   2. 登录 Docker Hub: docker login
#
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ==================== 配置 ====================
DOCKER_USERNAME="${1:-}"
IMAGE_TAG="${2:-latest}"

# 检查 Docker 用户名
if [ -z "$DOCKER_USERNAME" ]; then
    echo ""
    echo "============================================"
    echo "  易报销 Pro - Docker 镜像构建工具"
    echo "============================================"
    echo ""
    read -p "请输入 Docker Hub 用户名: " DOCKER_USERNAME
    if [ -z "$DOCKER_USERNAME" ]; then
        error "Docker Hub 用户名不能为空"
    fi
fi

BACKEND_IMAGE="${DOCKER_USERNAME}/yibao-backend"
FRONTEND_IMAGE="${DOCKER_USERNAME}/yibao-frontend"

echo ""
echo "============================================"
echo "  易报销 Pro - 本地构建并推送"
echo "============================================"
echo ""
info "Docker 用户名: $DOCKER_USERNAME"
info "后端镜像: $BACKEND_IMAGE:$IMAGE_TAG"
info "前端镜像: $FRONTEND_IMAGE:$IMAGE_TAG"
echo ""

# ==================== 检查环境 ====================
info "检查 Docker 环境..."

if ! command -v docker &> /dev/null; then
    error "Docker 未安装，请先安装 Docker Desktop"
fi

# 检查 Docker 是否运行
if ! docker info &> /dev/null; then
    error "Docker 未运行，请启动 Docker Desktop"
fi

# 检查是否已登录 Docker Hub
if ! docker info 2>/dev/null | grep -q "Username"; then
    warn "未登录 Docker Hub，正在登录..."
    docker login || error "Docker Hub 登录失败"
fi

success "Docker 环境检查通过"

# ==================== 创建多平台构建器 ====================
info "设置多平台构建器..."

# 检查是否存在构建器
if ! docker buildx inspect yibao-builder &> /dev/null; then
    info "创建新的构建器..."
    docker buildx create --name yibao-builder --driver docker-container --bootstrap
fi

docker buildx use yibao-builder
success "构建器准备就绪"

# ==================== 构建后端镜像 ====================
echo ""
info "开始构建后端镜像（linux/amd64）..."
info "这可能需要 5-10 分钟..."

cd "$(dirname "$0")/.."

docker buildx build \
    --platform linux/amd64 \
    --file Dockerfile.backend \
    --tag "${BACKEND_IMAGE}:${IMAGE_TAG}" \
    --tag "${BACKEND_IMAGE}:latest" \
    --push \
    --progress=plain \
    .

success "后端镜像构建并推送完成！"

# ==================== 构建前端镜像 ====================
echo ""
info "开始构建前端镜像（linux/amd64）..."
info "这可能需要 3-5 分钟..."

docker buildx build \
    --platform linux/amd64 \
    --file Dockerfile.frontend \
    --tag "${FRONTEND_IMAGE}:${IMAGE_TAG}" \
    --tag "${FRONTEND_IMAGE}:latest" \
    --push \
    --progress=plain \
    .

success "前端镜像构建并推送完成！"

# ==================== 完成 ====================
echo ""
echo "============================================"
echo "  🎉 构建完成！"
echo "============================================"
echo ""
success "后端镜像: ${BACKEND_IMAGE}:${IMAGE_TAG}"
success "前端镜像: ${FRONTEND_IMAGE}:${IMAGE_TAG}"
echo ""
echo "============================================"
echo "  📋 服务器部署步骤"
echo "============================================"
echo ""
echo "1. 将以下文件上传到服务器："
echo "   - docker-compose.hub.yml"
echo "   - .env.production（从 .env.production.example 复制并修改）"
echo ""
echo "2. 在服务器上执行："
echo "   docker-compose -f docker-compose.hub.yml pull"
echo "   docker-compose -f docker-compose.hub.yml up -d"
echo ""
echo "3. 访问："
echo "   - 前端: http://服务器IP:80"
echo "   - 后端: http://服务器IP:3000"
echo ""
echo "============================================"

# 生成服务器部署配置
info "生成服务器部署配置..."

cat > docker-compose.hub.yml << EOF
# ============================================================
# 易报销 Pro - Docker Hub 部署配置
# ============================================================
# 
# 使用方法：
#   1. 复制 .env.production.example 为 .env.production
#   2. 修改 .env.production 中的配置
#   3. 运行: docker-compose -f docker-compose.hub.yml up -d
#
# ============================================================

version: '3.8'

services:
  # PostgreSQL 数据库
  postgres:
    image: postgres:15-alpine
    container_name: yibao-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-yibao}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-yibao123456}
      POSTGRES_DB: \${POSTGRES_DB:-yibao}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER:-yibao}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - yibao-network

  # 后端服务
  backend:
    image: ${BACKEND_IMAGE}:\${IMAGE_TAG:-latest}
    container_name: yibao-backend
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://\${POSTGRES_USER:-yibao}:\${POSTGRES_PASSWORD:-yibao123456}@postgres:5432/\${POSTGRES_DB:-yibao}
      ADMIN_EMAIL: \${ADMIN_EMAIL:-wangbo@knet.cn}
      ADMIN_PASSWORD: \${ADMIN_PASSWORD:-123456}
      ADMIN_NAME: \${ADMIN_NAME:-王波}
      ADMIN_DEPARTMENT: \${ADMIN_DEPARTMENT:-管理部}
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      start_period: 60s
      retries: 3
    networks:
      - yibao-network

  # 前端服务
  frontend:
    image: ${FRONTEND_IMAGE}:\${IMAGE_TAG:-latest}
    container_name: yibao-frontend
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "80:80"
    networks:
      - yibao-network

volumes:
  postgres_data:
    driver: local

networks:
  yibao-network:
    driver: bridge
EOF

success "docker-compose.hub.yml 已生成"

# 生成环境变量模板
cat > .env.production.example << 'EOF'
# ============================================================
# 易报销 Pro - 生产环境配置
# ============================================================
# 
# 使用方法：
#   1. 复制此文件为 .env.production
#   2. 修改下面的配置值
#   3. 运行: docker-compose -f docker-compose.hub.yml --env-file .env.production up -d
#
# ============================================================

# ==================== 镜像版本 ====================
IMAGE_TAG=latest

# ==================== 数据库配置 ====================
POSTGRES_USER=yibao
POSTGRES_PASSWORD=yibao123456
POSTGRES_DB=yibao

# ==================== 管理员配置 ====================
ADMIN_EMAIL=wangbo@knet.cn
ADMIN_PASSWORD=123456
ADMIN_NAME=王波
ADMIN_DEPARTMENT=管理部

# ==================== AI 配置（可选）====================
# 在系统设置中配置 AI 服务
EOF

success ".env.production.example 已生成"
echo ""


