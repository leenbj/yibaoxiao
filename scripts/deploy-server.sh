#!/bin/bash
# ============================================================
# 易报销 Pro - 服务器部署脚本（宝塔面板环境）
# ============================================================
# 
# 使用方法：
#   1. 将此脚本上传到服务器
#   2. chmod +x deploy-server.sh
#   3. ./deploy-server.sh [DOCKER_USERNAME]
#
# 前置要求：
#   - 宝塔面板已安装 Docker 管理器
#   - 或手动安装 Docker 和 Docker Compose
#
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ==================== 配置 ====================
DOCKER_USERNAME="${1:-}"
DEPLOY_DIR="${2:-/www/wwwroot/yibao}"

echo ""
echo "============================================"
echo "  易报销 Pro - 服务器部署脚本"
echo "============================================"
echo ""

# 检查 Docker 用户名
if [ -z "$DOCKER_USERNAME" ]; then
    read -p "请输入 Docker Hub 用户名: " DOCKER_USERNAME
    if [ -z "$DOCKER_USERNAME" ]; then
        error "Docker Hub 用户名不能为空"
    fi
fi

BACKEND_IMAGE="${DOCKER_USERNAME}/yibao-backend"
FRONTEND_IMAGE="${DOCKER_USERNAME}/yibao-frontend"

info "Docker 用户名: $DOCKER_USERNAME"
info "部署目录: $DEPLOY_DIR"
echo ""

# ==================== 检查环境 ====================
info "检查服务器环境..."

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    warn "建议使用 root 用户运行此脚本"
fi

# 检查 Docker
if ! command -v docker &> /dev/null; then
    warn "Docker 未安装，正在安装..."
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
fi

# 检查 Docker Compose
if ! command -v docker-compose &> /dev/null; then
    if ! docker compose version &> /dev/null; then
        warn "Docker Compose 未安装，正在安装..."
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi
fi

success "环境检查通过"

# ==================== 创建部署目录 ====================
info "创建部署目录..."
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# ==================== 生成 docker-compose.yml ====================
info "生成 Docker Compose 配置..."

cat > docker-compose.yml << EOF
# ============================================================
# 易报销 Pro - 生产环境部署配置
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
      - ./data/postgres:/var/lib/postgresql/data
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

networks:
  yibao-network:
    driver: bridge
EOF

success "docker-compose.yml 已生成"

# ==================== 生成环境变量文件 ====================
if [ ! -f ".env" ]; then
    info "生成环境变量配置..."
    cat > .env << 'EOF'
# ============================================================
# 易报销 Pro - 环境变量配置
# ============================================================

# 镜像版本
IMAGE_TAG=latest

# 数据库配置
POSTGRES_USER=yibao
POSTGRES_PASSWORD=yibao123456
POSTGRES_DB=yibao

# 管理员配置
ADMIN_EMAIL=wangbo@knet.cn
ADMIN_PASSWORD=123456
ADMIN_NAME=王波
ADMIN_DEPARTMENT=管理部
EOF
    success ".env 配置文件已生成"
    warn "请根据需要修改 .env 文件中的配置"
else
    info ".env 文件已存在，跳过生成"
fi

# ==================== 拉取镜像 ====================
echo ""
info "拉取 Docker 镜像..."
info "这可能需要几分钟，取决于网络速度..."

docker-compose pull

success "镜像拉取完成"

# ==================== 启动服务 ====================
echo ""
info "启动服务..."

# 停止旧容器（如果存在）
docker-compose down 2>/dev/null || true

# 启动新容器
docker-compose up -d

success "服务启动完成"

# ==================== 等待服务就绪 ====================
info "等待服务就绪..."
sleep 10

# 检查服务状态
echo ""
info "检查服务状态..."
docker-compose ps

# ==================== 完成 ====================
echo ""
echo "============================================"
echo "  🎉 部署完成！"
echo "============================================"
echo ""

# 获取服务器 IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

success "部署目录: $DEPLOY_DIR"
success "前端地址: http://${SERVER_IP}:80"
success "后端地址: http://${SERVER_IP}:3000"
echo ""
echo "默认管理员账号："
echo "  邮箱: wangbo@knet.cn"
echo "  密码: 123456"
echo ""
echo "============================================"
echo "  📋 常用命令"
echo "============================================"
echo ""
echo "查看日志:     docker-compose logs -f"
echo "查看状态:     docker-compose ps"
echo "重启服务:     docker-compose restart"
echo "停止服务:     docker-compose down"
echo "更新镜像:     docker-compose pull && docker-compose up -d"
echo ""
echo "============================================"







