#!/bin/bash
# 易报销 Pro - 一键部署脚本
# 
# 使用方法: 
#   curl -fsSL https://raw.githubusercontent.com/leenbj/yibaoxiao/main/deploy.sh | bash

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${GREEN}=========================================="
echo "       易报销 Pro - 一键部署"
echo -e "==========================================${NC}"

# 配置
INSTALL_DIR="/root/yibaoxiao"
REPO_URL="https://raw.githubusercontent.com/leenbj/yibaoxiao/main"

# 检查 Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker 未安装${NC}"
        echo "正在安装 Docker..."
        curl -fsSL https://get.docker.com | bash
        systemctl start docker
        systemctl enable docker
    fi
    echo -e "${GREEN}✓${NC} Docker 已就绪"
}

# 检查 Docker Compose
check_compose() {
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        echo -e "${RED}❌ Docker Compose 未安装${NC}"
        echo "正在安装 Docker Compose..."
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        COMPOSE_CMD="docker-compose"
    fi
    echo -e "${GREEN}✓${NC} Docker Compose 已就绪"
}

# 主流程
main() {
    echo ""
    echo "[1/4] 检查环境..."
    check_docker
    check_compose
    
    echo ""
    echo "[2/4] 准备配置..."
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # 下载配置文件
    curl -fsSL -o docker-compose.yml "$REPO_URL/docker-compose.prod.yml"
    
    # 配置环境变量
    if [ ! -f ".env" ]; then
        curl -fsSL -o .env "$REPO_URL/.env.production"
        
        echo ""
        echo -e "${YELLOW}请配置以下信息（直接回车使用默认值）：${NC}"
        
        read -p "数据库密码 [yibao123456]: " db_pass
        read -p "管理员邮箱 [admin@example.com]: " admin_email  
        read -p "管理员密码 [admin123456]: " admin_pass
        
        # 使用默认值
        db_pass=${db_pass:-yibao123456}
        admin_email=${admin_email:-admin@example.com}
        admin_pass=${admin_pass:-admin123456}
        
        # 更新配置
        sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$db_pass/" .env
        sed -i "s/ADMIN_EMAIL=.*/ADMIN_EMAIL=$admin_email/" .env
        sed -i "s/ADMIN_PASSWORD=.*/ADMIN_PASSWORD=$admin_pass/" .env
        
        echo -e "${GREEN}✓${NC} 配置已保存"
    else
        echo -e "${GREEN}✓${NC} 使用已有配置"
    fi
    
    echo ""
    echo "[3/4] 拉取镜像..."
    $COMPOSE_CMD pull
    
    echo ""
    echo "[4/4] 启动服务..."
    $COMPOSE_CMD down 2>/dev/null || true
    $COMPOSE_CMD up -d
    
    # 获取 IP
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || curl -s ifconfig.me 2>/dev/null || echo "服务器IP")
    ADMIN_EMAIL=$(grep ADMIN_EMAIL .env 2>/dev/null | cut -d= -f2 || echo "admin@example.com")
    
    echo ""
    echo -e "${GREEN}=========================================="
    echo "✅ 部署完成！"
    echo "==========================================${NC}"
    echo ""
    echo -e "📍 访问地址: ${GREEN}http://$SERVER_IP${NC}"
    echo -e "👤 管理员: ${GREEN}$ADMIN_EMAIL${NC}"
    echo ""
    echo -e "${YELLOW}⏳ 首次启动需要 3-5 分钟，请稍候...${NC}"
    echo ""
    echo "查看启动进度:"
    echo "  cd $INSTALL_DIR && $COMPOSE_CMD logs -f backend"
    echo ""
    echo "常用命令:"
    echo "  $COMPOSE_CMD logs -f      # 查看日志"
    echo "  $COMPOSE_CMD restart      # 重启"
    echo "  $COMPOSE_CMD down         # 停止"
    echo "  $COMPOSE_CMD pull && $COMPOSE_CMD up -d  # 更新"
}

main "$@"
