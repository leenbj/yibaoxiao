#!/bin/bash
# ============================================================
# 易报销 Pro - 快速部署脚本（Supabase Cloud Backend）
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
    echo "  后端: Supabase Cloud"
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

        log_info "创建 .env 文件..."
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
        log_success "已创建 .env 文件"
        log_warning "⚠️  请编辑 .env 文件，配置您的 Supabase 项目信息！"
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
        log_success ".env 文件存在"
    fi
}

# 拉取镜像
pull_images() {
    log_info "拉取 Docker 镜像..."

    if [ -f "docker-compose.hub.yml" ]; then
        docker-compose -f docker-compose.hub.yml pull
    else
        log_warning "未找到 docker-compose.hub.yml，尝试从源码构建..."
    fi
    log_success "镜像准备完成"
}

# 启动服务
start_services() {
    log_info "启动服务..."

    if [ -f "docker-compose.hub.yml" ]; then
        docker-compose -f docker-compose.hub.yml up -d
    else
        log_error "未找到 docker-compose.hub.yml"
        exit 1
    fi
    log_success "服务启动成功"
}

# 等待服务就绪
wait_for_services() {
    log_info "等待服务就绪..."

    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -f http://localhost:8080/health &> /dev/null; then
            log_success "前端服务就绪"
            break
        fi

        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done

    if [ $attempt -eq $max_attempts ]; then
        log_warning "服务启动超时"
        log_info "检查日志: docker-compose -f docker-compose.hub.yml logs"
    fi

    echo ""
}

# 显示服务状态
show_status() {
    log_info "服务状态："
    echo ""
    docker-compose -f docker-compose.hub.yml ps
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
    echo ""
    echo "☁️  后端服务: Supabase Cloud"
    echo ""
    echo "👤 登录方式："
    echo "   请使用您在 Supabase 注册的账号登录"
    echo ""
    echo "============================================"
    echo "  🔧 常用命令"
    echo "============================================"
    echo ""
    echo "查看日志："
    echo "  docker-compose -f docker-compose.hub.yml logs -f"
    echo ""
    echo "重启服务："
    echo "  docker-compose -f docker-compose.hub.yml restart"
    echo ""
    echo "停止服务："
    echo "  docker-compose -f docker-compose.hub.yml down"
    echo ""
    echo "更新服务："
    echo "  docker-compose -f docker-compose.hub.yml pull"
    echo "  docker-compose -f docker-compose.hub.yml up -d"
    echo ""
}

# 主函数
main() {
    print_header

    # 检查是否在项目根目录
    if [ ! -f "docker-compose.hub.yml" ]; then
        log_error "未找到 docker-compose.hub.yml"
        log_info "请先运行 ./scripts/build-and-push.sh 生成部署配置"
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
