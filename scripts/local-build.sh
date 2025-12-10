#!/bin/bash
# ============================================================
# 易报销 Pro - 本地 Docker 构建脚本
# ============================================================
#
# 用法：
#   ./scripts/local-build.sh [命令]
#
# 命令：
#   build    - 构建镜像
#   up       - 启动服务
#   down     - 停止服务
#   restart  - 重启服务
#   logs     - 查看日志
#   clean    - 清理镜像和数据
#   status   - 查看状态
#   help     - 显示帮助
#
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.local.yml"

# 打印带颜色的信息
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查 Docker 是否运行
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        error "Docker 未运行，请先启动 Docker"
        exit 1
    fi
}

# 构建镜像
cmd_build() {
    info "开始构建本地 Docker 镜像..."
    check_docker
    
    cd "$PROJECT_DIR"
    
    info "构建后端镜像..."
    docker-compose -f "$COMPOSE_FILE" build backend
    
    info "构建前端镜像..."
    docker-compose -f "$COMPOSE_FILE" build frontend
    
    success "镜像构建完成！"
    echo ""
    info "构建的镜像："
    docker images | grep "yibao.*local-latest" || true
}

# 启动服务
cmd_up() {
    info "启动本地 Docker 服务..."
    check_docker
    
    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" up -d
    
    success "服务启动完成！"
    echo ""
    info "访问地址："
    echo "  - 前端：http://localhost:8080"
    echo "  - 后端：http://localhost:3001"
    echo "  - 数据库：localhost:5433"
    echo ""
    info "查看日志：./scripts/local-build.sh logs"
}

# 停止服务
cmd_down() {
    info "停止本地 Docker 服务..."
    check_docker
    
    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" down
    
    success "服务已停止"
}

# 重启服务
cmd_restart() {
    info "重启本地 Docker 服务..."
    cmd_down
    cmd_up
}

# 查看日志
cmd_logs() {
    info "查看服务日志..."
    check_docker
    
    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" logs -f --tail=100
}

# 清理镜像和数据
cmd_clean() {
    warn "这将删除本地构建的镜像和数据卷！"
    read -p "确认继续？(y/N): " confirm
    
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        info "停止服务..."
        check_docker
        
        cd "$PROJECT_DIR"
        docker-compose -f "$COMPOSE_FILE" down -v --rmi local
        
        info "清理镜像..."
        docker rmi yibao-backend:local-latest 2>/dev/null || true
        docker rmi yibao-frontend:local-latest 2>/dev/null || true
        
        success "清理完成"
    else
        info "已取消"
    fi
}

# 查看状态
cmd_status() {
    info "服务状态："
    check_docker
    
    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" ps
    
    echo ""
    info "本地镜像："
    docker images | grep "yibao.*local-latest" || echo "  (无本地镜像)"
}

# 显示帮助
cmd_help() {
    echo "============================================================"
    echo "  易报销 Pro - 本地 Docker 构建脚本"
    echo "============================================================"
    echo ""
    echo "用法："
    echo "  ./scripts/local-build.sh [命令]"
    echo ""
    echo "命令："
    echo "  build    - 构建镜像"
    echo "  up       - 启动服务"
    echo "  down     - 停止服务"
    echo "  restart  - 重启服务"
    echo "  logs     - 查看日志"
    echo "  clean    - 清理镜像和数据"
    echo "  status   - 查看状态"
    echo "  help     - 显示帮助"
    echo ""
    echo "端口映射（避免与本地开发冲突）："
    echo "  - 前端：8080 -> 80"
    echo "  - 后端：3001 -> 3000"
    echo "  - 数据库：5433 -> 5432"
    echo ""
    echo "快速开始："
    echo "  1. ./scripts/local-build.sh build  # 构建镜像"
    echo "  2. ./scripts/local-build.sh up     # 启动服务"
    echo "  3. 访问 http://localhost:8080"
    echo ""
}

# 主入口
main() {
    case "${1:-help}" in
        build)   cmd_build ;;
        up)      cmd_up ;;
        down)    cmd_down ;;
        restart) cmd_restart ;;
        logs)    cmd_logs ;;
        clean)   cmd_clean ;;
        status)  cmd_status ;;
        help|*)  cmd_help ;;
    esac
}

main "$@"

