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
# 易报销 Pro - 生产环境部署配置（Supabase Cloud Backend）
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

success "docker-compose.yml 已生成"

# ==================== 生成环境变量文件 ====================
if [ ! -f ".env" ]; then
    info "生成环境变量配置..."
    cat > .env << 'EOF'
# ============================================================
# 易报销 Pro - 环境变量配置（Supabase Cloud Backend）
# ============================================================

# 镜像版本
IMAGE_TAG=latest

# Supabase 配置（请修改为您的 Supabase 项目配置）
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
EOF
    success ".env 配置文件已生成"
    warn "请修改 .env 文件中的 Supabase 配置"
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
echo ""
echo "后端服务: Supabase Cloud"
echo ""
echo "请使用您的 Supabase 账号登录系统"
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











