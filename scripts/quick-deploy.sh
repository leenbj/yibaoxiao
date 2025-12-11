#!/bin/bash
# ============================================================
# 易报销 Pro - 快速部署脚本
# ============================================================
#
# 用途：在服务器上快速部署易报销 Pro
# 使用：./scripts/quick-deploy.sh
#
# ============================================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 打印标题
print_header() {
    echo ""
    echo "============================================"
    echo "  🚀 易报销 Pro - 快速部署脚本"
    echo "============================================"
    echo ""
}

# 检查依赖
check_dependencies() {
    log_info "检查系统依赖..."

    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        log_error "未安装 Docker，请先安装 Docker"
        log_info "安装命令: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi
    log_success "Docker 已安装: $(docker --version)"

    # 检查 Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "未安装 Docker Compose，请先安装"
        log_info "安装命令: https://docs.docker.com/compose/install/"
        exit 1
    fi
    log_success "Docker Compose 已安装: $(docker-compose --version)"

    # 检查 Docker 服务
    if ! docker info &> /dev/null; then
        log_error "Docker 服务未启动，请启动 Docker"
        log_info "启动命令: sudo systemctl start docker"
        exit 1
    fi
    log_success "Docker 服务正在运行"
}

# 检查配置文件
check_config() {
    log_info "检查配置文件..."

    if [ ! -f ".env" ]; then
        log_warning ".env 文件不存在"

        if [ -f ".env.production.example" ]; then
            log_info "发现 .env.production.example，正在复制..."
            cp .env.production.example .env
            log_success "已创建 .env 文件"
            log_warning "⚠️  请编辑 .env 文件，修改数据库密码和管理员配置！"
            log_info "编辑命令: nano .env 或 vim .env"

            read -p "是否现在编辑配置文件？(y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                ${EDITOR:-nano} .env
            else
                log_warning "请稍后手动编辑 .env 文件"
                exit 0
            fi
        else
            log_error "未找到配置文件模板"
            exit 1
        fi
    else
        log_success ".env 文件存在"
    fi
}

# 拉取镜像
pull_images() {
    log_info "拉取 Docker 镜像..."

    if docker-compose -f docker-compose.prod.yml pull; then
        log_success "镜像拉取成功"
    else
        log_error "镜像拉取失败"
        log_info "可能原因："
        log_info "  1. 网络连接问题"
        log_info "  2. 镜像仓库权限问题（私有镜像需要登录）"
        log_info "  3. 镜像名称错误"
        exit 1
    fi
}

# 启动服务
start_services() {
    log_info "启动服务..."

    if docker-compose -f docker-compose.prod.yml up -d; then
        log_success "服务启动成功"
    else
        log_error "服务启动失败"
        log_info "查看日志: docker-compose -f docker-compose.prod.yml logs"
        exit 1
    fi
}

# 等待服务就绪
wait_for_services() {
    log_info "等待服务就绪..."

    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -f http://localhost:3000/api/health &> /dev/null; then
            log_success "后端服务就绪"
            break
        fi

        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done

    if [ $attempt -eq $max_attempts ]; then
        log_warning "后端服务启动超时"
        log_info "检查日志: docker-compose -f docker-compose.prod.yml logs backend"
    fi

    echo ""
}

# 显示服务状态
show_status() {
    log_info "服务状态："
    echo ""
    docker-compose -f docker-compose.prod.yml ps
    echo ""
}

# 显示访问信息
show_access_info() {
    log_success "部署完成！"
    echo ""
    echo "============================================"
    echo "  📋 访问信息"
    echo "============================================"
    echo ""
    echo "🌐 前端地址: http://localhost"
    echo "🔧 后端地址: http://localhost:3000"
    echo "📊 健康检查: http://localhost:3000/api/health"
    echo ""
    echo "👤 默认管理员账号："
    echo "   邮箱：查看 .env 文件中的 ADMIN_EMAIL"
    echo "   密码：查看 .env 文件中的 ADMIN_PASSWORD"
    echo ""
    echo "⚠️  首次登录后请立即修改密码！"
    echo ""
    echo "============================================"
    echo "  🔧 常用命令"
    echo "============================================"
    echo ""
    echo "查看日志："
    echo "  docker-compose -f docker-compose.prod.yml logs -f"
    echo ""
    echo "重启服务："
    echo "  docker-compose -f docker-compose.prod.yml restart"
    echo ""
    echo "停止服务："
    echo "  docker-compose -f docker-compose.prod.yml down"
    echo ""
    echo "更新服务："
    echo "  docker-compose -f docker-compose.prod.yml pull"
    echo "  docker-compose -f docker-compose.prod.yml up -d"
    echo ""
}

# 主函数
main() {
    print_header

    # 检查是否在项目根目录
    if [ ! -f "docker-compose.prod.yml" ]; then
        log_error "未找到 docker-compose.prod.yml"
        log_info "请在项目根目录运行此脚本"
        exit 1
    fi

    # 执行部署流程
    check_dependencies
    check_config
    pull_images
    start_services
    wait_for_services
    show_status
    show_access_info
}

# 执行主函数
main
