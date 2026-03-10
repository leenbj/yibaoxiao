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

FRONTEND_IMAGE="${DOCKER_USERNAME}/yibao-frontend"

echo ""
echo "============================================"
echo "  易报销 Pro - 本地构建并推送"
echo "  后端: Supabase Cloud"
echo "============================================"
echo ""
info "Docker 用户名: $DOCKER_USERNAME"
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

# ==================== 读取环境变量 ====================
info "读取 Supabase 配置..."

cd "$(dirname "$0")/.."

# 从 frontend/.env 读取配置
if [ -f "frontend/.env" ]; then
    export $(grep -v '^#' frontend/.env | xargs)
    info "Supabase URL: ${VITE_SUPABASE_URL}"
else
    warn "未找到 frontend/.env 文件，请确保在构建时传递环境变量"
fi

# ==================== 构建前端镜像 ====================
echo ""
info "开始构建前端镜像（linux/amd64）..."
info "这可能需要 3-5 分钟..."

docker buildx build \
    --platform linux/amd64 \
    --file Dockerfile.frontend \
    --build-arg VITE_SUPABASE_URL="${VITE_SUPABASE_URL}" \
    --build-arg VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY}" \
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
success "前端镜像: ${FRONTEND_IMAGE}:${IMAGE_TAG}"
echo ""
echo "后端服务: Supabase Cloud"
echo ""
echo "============================================"
echo "  📋 服务器部署步骤"
echo "============================================"
echo ""
echo "1. 将以下文件上传到服务器："
echo "   - docker-compose.hub.yml"
echo "   - .env（配置 Supabase URL 和 Key）"
echo ""
echo "2. 在服务器上执行："
echo "   docker-compose -f docker-compose.hub.yml pull"
echo "   docker-compose -f docker-compose.hub.yml up -d"
echo ""
echo "3. 访问："
echo "   前端: http://服务器IP:80"
echo ""
echo "============================================"

# 生成服务器部署配置
info "生成服务器部署配置..."

cat > docker-compose.hub.yml << EOF
# ============================================================
# 易报销 Pro - Docker Hub 部署配置（Supabase Cloud Backend）
# ============================================================
#
# 使用方法：
#   1. 创建 .env 文件配置 Supabase
#   2. 运行: docker-compose -f docker-compose.hub.yml up -d
#
# ============================================================

version: '3.8'

services:
  # 前端服务
  frontend:
    image: ${FRONTEND_IMAGE}:\${IMAGE_TAG:-latest}
    container_name: yibao-frontend
    restart: unless-stopped
    ports:
      - "80:8080"
    environment:
      - VITE_SUPABASE_URL=\${VITE_SUPABASE_URL}
      - VITE_SUPABASE_ANON_KEY=\${VITE_SUPABASE_ANON_KEY}
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      start_period: 10s
      retries: 3

networks:
  default:
    driver: bridge
EOF

success "docker-compose.hub.yml 已生成"
